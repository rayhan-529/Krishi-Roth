/**
 * One dashboard endpoint that returns the right numbers for the user's role.
 */
const db = require("../config/db");
const { send } = require("../utils/response");
const { sendHarvestReminders } = require("../services/reminderService");

/** Last `count` months as "YYYY-MM", oldest first. */
function lastMonths(count) {
  const months = [];
  const date = new Date();
  date.setDate(1);
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

/** Turns rows of { month, value } into a full series with zeros for empty months. */
function monthSeries(rows, count = 6) {
  const map = Object.fromEntries(rows.map((row) => [row.month, Number(row.value)]));
  return lastMonths(count).map((month) => ({ month, value: map[month] || 0 }));
}

async function common(userId) {
  const [notifications] = await db.query(
    "SELECT id, type, title, body, link, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 5",
    [userId]
  );
  const [[{ unread }]] = await db.query("SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND is_read = 0", [userId]);
  const [[rating]] = await db.query("SELECT review_count, average_rating FROM user_rating_summary WHERE user_id = ?", [userId]);
  return {
    recent_notifications: notifications,
    unread_notifications: Number(unread),
    rating: rating || { review_count: 0, average_rating: null }
  };
}

async function farmer(userId) {
  await sendHarvestReminders(userId);

  const [[c]] = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM crop_listings WHERE farmer_id = ? AND status <> 'removed') AS total_listings,
       (SELECT COUNT(*) FROM crop_listings WHERE farmer_id = ? AND status = 'active') AS active_listings,
       (SELECT COUNT(*) FROM harvests WHERE farmer_id = ?) AS total_harvests,
       (SELECT COUNT(*) FROM harvests WHERE farmer_id = ? AND status <> 'completed') AS ongoing_harvests,
       (SELECT COALESCE(SUM(e.total_cost), 0) FROM expenses e JOIN expense_notebooks n ON n.id = e.notebook_id
         WHERE n.farmer_id = ?) AS total_expenses,
       (SELECT COUNT(*) FROM bookings WHERE requester_id = ? AND status IN ('pending','accepted','in_progress')) AS active_bookings,
       (SELECT COUNT(*) FROM purchase_offers WHERE farmer_id = ? AND status = 'pending') AS pending_offers,
       (SELECT COUNT(*) FROM trade_records WHERE farmer_id = ? AND status IN ('payment_pending','payment_confirmed','delivery_pending','disputed')) AS active_trades,
       (SELECT COALESCE(SUM(total_amount), 0) FROM trade_records WHERE farmer_id = ? AND status = 'completed') AS total_sales`,
    Array(9).fill(userId)
  );

  const [prices] = await db.query(
    `SELECT mp.id, c.name_bn AS crop_bn, c.name_en AS crop_en, mp.market_name, d.name_bn AS district_bn,
            d.name_en AS district_en, mp.unit, mp.min_price, mp.max_price, mp.price_date
     FROM market_prices mp JOIN crops c ON c.id = mp.crop_id JOIN districts d ON d.id = mp.district_id
     ORDER BY mp.price_date DESC, mp.id DESC LIMIT 6`
  );
  const [upcoming] = await db.query(
    `SELECT h.id, c.name_bn AS crop_bn, c.name_en AS crop_en, h.field_name, h.expected_harvest_date, h.status,
            DATEDIFF(h.expected_harvest_date, CURDATE()) AS days_to_harvest
     FROM harvests h JOIN crops c ON c.id = h.crop_id
     WHERE h.farmer_id = ? AND h.status <> 'completed' AND h.expected_harvest_date IS NOT NULL
     ORDER BY h.expected_harvest_date LIMIT 5`,
    [userId]
  );
  const [offers] = await db.query(
    `SELECT po.id, po.quantity, po.unit, po.offered_price_per_unit, po.total_amount, po.created_at,
            c.name_bn AS crop_bn, c.name_en AS crop_en, b.name AS buyer_name
     FROM purchase_offers po JOIN crop_listings l ON l.id = po.listing_id JOIN crops c ON c.id = l.crop_id
     JOIN users b ON b.id = po.buyer_id
     WHERE po.farmer_id = ? AND po.status = 'pending' ORDER BY po.created_at DESC LIMIT 5`,
    [userId]
  );
  const [expenseRows] = await db.query(
    `SELECT DATE_FORMAT(e.expense_date, '%Y-%m') AS month, SUM(e.total_cost) AS value
     FROM expenses e JOIN expense_notebooks n ON n.id = e.notebook_id
     WHERE n.farmer_id = ? AND e.expense_date >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 5 MONTH)
     GROUP BY month`,
    [userId]
  );
  const [expenseByCategory] = await db.query(
    `SELECT ec.name_bn AS category_bn, ec.name_en AS category_en, SUM(e.total_cost) AS total
     FROM expenses e JOIN expense_notebooks n ON n.id = e.notebook_id JOIN expense_categories ec ON ec.id = e.category_id
     WHERE n.farmer_id = ? GROUP BY ec.id ORDER BY total DESC LIMIT 6`,
    [userId]
  );

  return {
    counts: c,
    market_prices: prices,
    upcoming_harvests: upcoming,
    pending_offers: offers,
    monthly_expenses: monthSeries(expenseRows),
    expense_by_category: expenseByCategory
  };
}

async function buyer(userId) {
  const [[c]] = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM purchase_offers WHERE buyer_id = ? AND status = 'pending') AS pending_offers,
       (SELECT COUNT(*) FROM purchase_offers WHERE buyer_id = ? AND status = 'accepted') AS accepted_offers,
       (SELECT COUNT(*) FROM trade_records WHERE buyer_id = ? AND status IN ('payment_pending','payment_confirmed','delivery_pending','disputed')) AS active_trades,
       (SELECT COUNT(*) FROM trade_records WHERE buyer_id = ? AND status = 'completed') AS completed_trades,
       (SELECT COALESCE(SUM(total_amount), 0) FROM trade_records WHERE buyer_id = ? AND status = 'completed') AS total_purchases,
       (SELECT COUNT(*) FROM bookings WHERE requester_id = ? AND status IN ('pending','accepted','in_progress')) AS active_bookings`,
    Array(6).fill(userId)
  );
  const [trades] = await db.query(
    `SELECT t.id, t.status, t.quantity, t.unit, t.total_amount, t.updated_at, c.name_bn AS crop_bn, c.name_en AS crop_en,
            f.name AS farmer_name
     FROM trade_records t JOIN crop_listings l ON l.id = t.listing_id JOIN crops c ON c.id = l.crop_id
     JOIN users f ON f.id = t.farmer_id
     WHERE t.buyer_id = ? ORDER BY t.updated_at DESC LIMIT 5`,
    [userId]
  );
  const [listings] = await db.query(
    `SELECT l.id, c.name_bn AS crop_bn, c.name_en AS crop_en, l.variety, l.quantity_available, l.unit, l.price_per_unit,
            d.name_bn AS district_bn, d.name_en AS district_en, l.created_at,
            (SELECT image_path FROM crop_listing_images i WHERE i.listing_id = l.id ORDER BY i.sort_order, i.id LIMIT 1) AS cover_image
     FROM crop_listings l JOIN crops c ON c.id = l.crop_id JOIN districts d ON d.id = l.district_id
     JOIN users u ON u.id = l.farmer_id
     WHERE l.status = 'active' AND u.is_blocked = 0 ORDER BY l.created_at DESC LIMIT 6`
  );
  const [purchaseRows] = await db.query(
    `SELECT DATE_FORMAT(completed_at, '%Y-%m') AS month, SUM(total_amount) AS value FROM trade_records
     WHERE buyer_id = ? AND status = 'completed'
       AND completed_at >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 5 MONTH)
     GROUP BY month`,
    [userId]
  );
  return { counts: c, recent_trades: trades, new_listings: listings, monthly_purchases: monthSeries(purchaseRows) };
}

async function provider(user) {
  const userId = user.id;
  const [[c]] = await db.query(
    `SELECT
       SUM(status = 'pending') AS pending,
       SUM(status = 'accepted') AS accepted,
       SUM(status = 'in_progress') AS in_progress,
       SUM(status = 'completed') AS completed,
       SUM(status IN ('rejected','cancelled')) AS closed,
       COALESCE(SUM(IF(status = 'completed', estimated_total, 0)), 0) AS completed_value
     FROM bookings WHERE provider_id = ?`,
    [userId]
  );
  const [requests] = await db.query(
    `SELECT b.id, b.booking_type, b.start_date, b.end_date, b.status, b.estimated_total, b.created_at,
            rq.name AS requester_name, m.name AS machine_name, t.name AS vehicle_name,
            wd.name_bn AS work_district_bn, wd.name_en AS work_district_en
     FROM bookings b JOIN users rq ON rq.id = b.requester_id
     LEFT JOIN machinery m ON m.id = b.machinery_id LEFT JOIN transport_vehicles t ON t.id = b.transport_vehicle_id
     LEFT JOIN districts wd ON wd.id = b.work_district_id
     WHERE b.provider_id = ? AND b.status IN ('pending','accepted','in_progress')
     ORDER BY FIELD(b.status, 'pending') DESC, b.start_date LIMIT 8`,
    [userId]
  );
  const [jobRows] = await db.query(
    `SELECT DATE_FORMAT(completed_at, '%Y-%m') AS month, COUNT(*) AS value FROM bookings
     WHERE provider_id = ? AND status = 'completed'
       AND completed_at >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 5 MONTH)
     GROUP BY month`,
    [userId]
  );

  const services = {};
  if (user.role === "labour") {
    const [rows] = await db.query("SELECT daily_wage, is_available FROM labour_profiles WHERE user_id = ?", [userId]);
    services.labour_profile = rows[0] || null;
  } else if (user.role === "transport_owner") {
    const [[row]] = await db.query(
      "SELECT COUNT(*) AS total, SUM(is_available) AS available FROM transport_vehicles WHERE owner_id = ? AND status <> 'removed'",
      [userId]
    );
    services.vehicles = row;
  } else {
    const [[row]] = await db.query(
      "SELECT COUNT(*) AS total, SUM(is_available) AS available FROM machinery WHERE owner_id = ? AND status <> 'removed'",
      [userId]
    );
    services.machinery = row;
  }
  const [[areas]] = await db.query("SELECT COUNT(*) AS n FROM provider_service_areas WHERE user_id = ?", [userId]);

  return {
    counts: Object.fromEntries(Object.entries(c).map(([k, val]) => [k, Number(val) || 0])),
    open_requests: requests,
    monthly_jobs: monthSeries(jobRows),
    services,
    service_area_count: Number(areas.n)
  };
}

async function show(req, res) {
  const user = req.user;
  let data = {};
  if (user.role === "farmer") data = await farmer(user.id);
  else if (user.role === "buyer") data = await buyer(user.id);
  else if (["labour", "harvester_owner", "tractor_owner", "transport_owner"].includes(user.role)) data = await provider(user);

  send(req, res, { data: { role: user.role, ...data, ...(await common(user.id)) } });
}

module.exports = { show, monthSeries, lastMonths };
