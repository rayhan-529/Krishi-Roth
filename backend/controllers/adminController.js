/**
 * Administrator panel. Every route using this controller is protected by
 * authenticate + authorize("admin") on the server (see routes/adminRoutes.js).
 */
const db = require("../config/db");
const v = require("../utils/validator");
const ApiError = require("../utils/ApiError");
const { send } = require("../utils/response");
const { getPagination, paginate } = require("../utils/pagination");
const { sqlFilter } = require("../utils/sqlFilter");
const { withTransaction } = require("../services/transaction");
const { notify, notifyMany } = require("../services/notificationService");
const { logActivity } = require("../services/activityService");
const { revokeAllSessions } = require("../services/tokenService");
const trades = require("../services/tradeService");
const wallet = require("../services/walletService");
const { monthSeries } = require("./dashboardController");
const { BOOKING_SELECT, BOOKING_FROM, TYPES: BOOKING_TYPES, STATUSES: BOOKING_STATUSES } = require("./bookingController");
const { TRADE_STATUSES } = require("./tradeController");
const { CATEGORIES: COMPLAINT_CATEGORIES } = require("./complaintController");
const { UNITS } = require("./listingController");

const USER_ROLES = ["farmer", "buyer", "labour", "harvester_owner", "tractor_owner", "transport_owner", "admin"];
const NON_ADMIN_ROLES = USER_ROLES.filter((r) => r !== "admin");
const paging = { page: v.integer(), limit: v.integer() };

const schemas = {
  users: {
    q: v.string().max(100),
    role: v.enum(USER_ROLES),
    status: v.enum(["active", "blocked"]),
    verification: v.enum(["unverified", "pending", "verified", "rejected"]),
    ...paging
  },
  block: { reason: v.string().required().min(3).max(255) },
  role: { role: v.enum(NON_ADMIN_ROLES).required() },
  listings: { q: v.string().max(100), status: v.enum(["active", "reserved", "sold", "expired", "removed"]), ...paging },
  listingStatus: { status: v.enum(["removed", "active"]).required(), admin_note: v.string().max(255) },
  crop: {
    category_id: v.id().required(),
    slug: v.string().required().pattern(/^[a-z0-9-]{2,60}$/, {
      bn: "ছোট হাতের ইংরেজি অক্ষর, সংখ্যা ও - ব্যবহার করুন।",
      en: "Use lowercase English letters, numbers and -."
    }),
    name_en: v.string().required().min(2).max(80),
    name_bn: v.string().required().min(1).max(80),
    default_unit: v.enum(UNITS).required(),
    is_active: v.boolean().default(true)
  },
  bookings: { q: v.string().max(100), status: v.enum(BOOKING_STATUSES), booking_type: v.enum(BOOKING_TYPES), ...paging },
  bookingCancel: { note: v.string().required().min(3).max(500) },
  trades: { q: v.string().max(100), status: v.enum(TRADE_STATUSES), ...paging },
  resolveTrade: { to_status: v.enum(["completed", "cancelled"]).required(), note: v.string().required().min(3).max(500) },
  complaints: {
    q: v.string().max(100),
    status: v.enum(["open", "in_review", "resolved", "dismissed"]),
    category: v.enum(COMPLAINT_CATEGORIES),
    ...paging
  },
  complaintUpdate: { status: v.enum(["open", "in_review", "resolved", "dismissed"]).required(), admin_note: v.string().max(3000) },
  reviews: { q: v.string().max(100), hidden: v.boolean(), max_rating: v.integer().min(1).max(5), ...paging },
  hideReview: { reason: v.string().required().min(3).max(255) },
  announcement: {
    title: v.string().required().min(3).max(200),
    body: v.string().required().min(3).max(5000),
    target_role: v.enum(USER_ROLES)
  },
  activity: { q: v.string().max(100), ...paging }
};

// ---------------------------------------------------------------- stats
async function stats(req, res) {
  const [[c]] = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM users) AS total_users,
       (SELECT COUNT(*) FROM users WHERE role = 'farmer') AS farmers,
       (SELECT COUNT(*) FROM users WHERE role = 'buyer') AS buyers,
       (SELECT COUNT(*) FROM users WHERE role IN ('labour','harvester_owner','tractor_owner','transport_owner')) AS service_providers,
       (SELECT COUNT(*) FROM users WHERE is_blocked = 1) AS blocked_users,
       (SELECT COUNT(*) FROM crop_listings WHERE status <> 'removed') AS total_listings,
       (SELECT COUNT(*) FROM crop_listings WHERE status = 'active') AS active_listings,
       (SELECT COUNT(*) FROM trade_records) AS total_trades,
       (SELECT COUNT(*) FROM trade_records WHERE status = 'disputed') AS disputed_trades,
       (SELECT COALESCE(SUM(total_amount), 0) FROM trade_records WHERE status = 'completed') AS completed_trade_value,
       (SELECT COUNT(*) FROM bookings) AS total_bookings,
       (SELECT COUNT(*) FROM bookings WHERE status IN ('pending','accepted','in_progress')) AS open_bookings,
       (SELECT COUNT(*) FROM user_verifications WHERE status = 'pending') AS pending_verifications,
       (SELECT COUNT(*) FROM complaints WHERE status IN ('open','in_review')) AS open_complaints,
       (SELECT COUNT(*) FROM market_prices) AS market_prices,
       (SELECT COUNT(*) FROM harvests) AS harvests`
  );
  const [byRole] = await db.query(
    `SELECT r.code AS role, r.name_bn, r.name_en, COUNT(u.id) AS total
     FROM roles r LEFT JOIN users u ON u.role = r.code GROUP BY r.code
     ORDER BY FIELD(r.code, 'farmer','buyer','labour','harvester_owner','tractor_owner','transport_owner','admin')`
  );
  const [registrations] = await db.query(
    `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS value FROM users
     WHERE created_at >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 5 MONTH) GROUP BY month`
  );
  const [activity] = await db.query(
    `SELECT a.id, a.action, a.entity_type, a.entity_id, a.details, a.created_at, u.name AS actor_name, u.role AS actor_role
     FROM activity_logs a LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.id DESC LIMIT 12`
  );

  send(req, res, {
    data: { counts: c, users_by_role: byRole, monthly_registrations: monthSeries(registrations), recent_activity: activity }
  });
}

// ---------------------------------------------------------------- users
async function users(req, res) {
  const f = req.q;
  const filter = sqlFilter();
  if (f.role) filter.add("u.role = ?", f.role);
  if (f.status) filter.add("u.is_blocked = ?", f.status === "blocked" ? 1 : 0);
  if (f.verification) filter.add("u.verification_status = ?", f.verification);
  filter.search(f.q, ["u.name", "u.email", "u.phone"]);

  const { rows, meta } = await paginate(db, {
    selectSql: `SELECT u.id, u.name, u.email, u.phone, u.role, u.verification_status, u.is_blocked, u.blocked_reason,
                       u.created_at, u.last_login_at, d.name_bn AS district_bn, d.name_en AS district_en`,
    fromSql: `FROM users u LEFT JOIN districts d ON d.id = u.district_id ${filter.where}`,
    params: filter.params,
    orderSql: "ORDER BY u.id DESC",
    paging: getPagination(req.query, 20)
  });
  send(req, res, { data: rows, meta });
}

async function userDetail(req, res) {
  const [rows] = await db.query(
    `SELECT u.id, u.name, u.email, u.phone, u.role, u.profile_photo, u.district_id, d.name_bn AS district_bn,
            d.name_en AS district_en, u.upazila, u.address, u.bio, u.verification_status, u.is_blocked, u.blocked_reason,
            u.blocked_at, u.created_at, u.last_login_at, COALESCE(rs.review_count, 0) AS review_count, rs.average_rating
     FROM users u LEFT JOIN districts d ON d.id = u.district_id LEFT JOIN user_rating_summary rs ON rs.user_id = u.id
     WHERE u.id = ?`,
    [req.params.id]
  );
  const user = rows[0];
  if (!user) throw ApiError.notFound("ব্যবহারকারী পাওয়া যায়নি।", "User not found.");

  const [[counts]] = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM crop_listings WHERE farmer_id = ?) AS listings,
       (SELECT COUNT(*) FROM trade_records WHERE buyer_id = ? OR farmer_id = ?) AS trades,
       (SELECT COUNT(*) FROM bookings WHERE requester_id = ? OR provider_id = ?) AS bookings,
       (SELECT COUNT(*) FROM complaints WHERE against_user_id = ?) AS complaints_against,
       (SELECT COUNT(*) FROM user_sessions WHERE user_id = ? AND revoked_at IS NULL AND expires_at > NOW()) AS active_sessions`,
    [user.id, user.id, user.id, user.id, user.id, user.id, user.id]
  );
  const [verifications] = await db.query(
    "SELECT id, document_type, status, admin_note, created_at, reviewed_at FROM user_verifications WHERE user_id = ? ORDER BY id DESC",
    [user.id]
  );
  send(req, res, { data: { ...user, counts, verifications } });
}

async function findTargetUser(req) {
  const [[user]] = await db.query("SELECT id, name, role, is_blocked FROM users WHERE id = ?", [req.params.id]);
  if (!user) throw ApiError.notFound("ব্যবহারকারী পাওয়া যায়নি।", "User not found.");
  if (user.id === req.user.id) {
    throw ApiError.badRequest("নিজের অ্যাকাউন্টে এই কাজ করা যাবে না।", "You cannot do this to your own account.");
  }
  if (user.role === "admin") {
    throw ApiError.forbidden("অন্য অ্যাডমিনের অ্যাকাউন্ট এখান থেকে পরিবর্তন করা যাবে না।", "Admin accounts cannot be changed here.");
  }
  return user;
}

async function blockUser(req, res) {
  const user = await findTargetUser(req);
  await db.query("UPDATE users SET is_blocked = 1, blocked_reason = ?, blocked_at = NOW() WHERE id = ?", [req.body.reason, user.id]);
  await revokeAllSessions(user.id);
  await logActivity(req, "admin.user_block", "user", user.id, req.body.reason);
  send(req, res, { message: ["অ্যাকাউন্ট বন্ধ করা হয়েছে।", "Account blocked."] });
}

async function unblockUser(req, res) {
  const user = await findTargetUser(req);
  await db.query("UPDATE users SET is_blocked = 0, blocked_reason = NULL, blocked_at = NULL WHERE id = ?", [user.id]);
  await notify(null, user.id, {
    type: "announcement",
    title: ["আপনার অ্যাকাউন্ট আবার চালু করা হয়েছে", "Your account has been unblocked"],
    link: "/dashboard"
  });
  await logActivity(req, "admin.user_unblock", "user", user.id);
  send(req, res, { message: ["অ্যাকাউন্ট আবার চালু করা হয়েছে।", "Account unblocked."] });
}

async function changeRole(req, res) {
  const user = await findTargetUser(req);
  await db.query("UPDATE users SET role = ? WHERE id = ?", [req.body.role, user.id]);
  await notify(null, user.id, {
    type: "announcement",
    title: ["আপনার অ্যাকাউন্টের ধরন পরিবর্তন করা হয়েছে", "Your account type was changed"],
    link: "/dashboard"
  });
  await logActivity(req, "admin.user_role", "user", user.id, `${user.role} -> ${req.body.role}`);
  send(req, res, { message: ["ভূমিকা পরিবর্তন হয়েছে।", "Role changed."] });
}

// ---------------------------------------------------------------- listings & crops
async function listings(req, res) {
  const f = req.q;
  const filter = sqlFilter();
  if (f.status) filter.add("l.status = ?", f.status);
  filter.search(f.q, ["c.name_bn", "c.name_en", "u.name", "l.variety"]);

  const { rows, meta } = await paginate(db, {
    selectSql: `SELECT l.id, l.farmer_id, u.name AS farmer_name, c.name_bn AS crop_bn, c.name_en AS crop_en, l.variety,
                       l.quantity, l.quantity_available, l.unit, l.price_per_unit, l.status, l.admin_note, l.created_at,
                       d.name_bn AS district_bn, d.name_en AS district_en,
                       (SELECT COUNT(*) FROM purchase_offers po WHERE po.listing_id = l.id) AS offers`,
    fromSql: `FROM crop_listings l JOIN crops c ON c.id = l.crop_id JOIN users u ON u.id = l.farmer_id
              JOIN districts d ON d.id = l.district_id ${filter.where}`,
    params: filter.params,
    orderSql: "ORDER BY l.id DESC",
    paging: getPagination(req.query, 20)
  });
  send(req, res, { data: rows, meta });
}

async function setListingStatus(req, res) {
  const { status, admin_note: note } = req.body;
  if (status === "removed" && !note) {
    const message = { bn: "সরানোর কারণ লিখুন।", en: "Write the reason for removal." };
    throw ApiError.badRequest(message.bn, message.en, { admin_note: message });
  }

  await withTransaction(async (conn) => {
    const [[listing]] = await conn.query("SELECT * FROM crop_listings WHERE id = ? FOR UPDATE", [req.params.id]);
    if (!listing) throw ApiError.notFound();

    if (status === "removed") {
      await conn.query("UPDATE crop_listings SET status = 'removed', admin_note = ? WHERE id = ?", [note, listing.id]);
      const [pending] = await conn.query("SELECT id, buyer_id FROM purchase_offers WHERE listing_id = ? AND status = 'pending'", [listing.id]);
      if (pending.length) {
        await conn.query("UPDATE purchase_offers SET status = 'expired', responded_at = NOW() WHERE listing_id = ? AND status = 'pending'", [listing.id]);
        await notifyMany(conn, pending.map((p) => p.buyer_id), {
          type: "offer_rejected",
          title: ["আপনার প্রস্তাবটি আর প্রযোজ্য নয়", "Your offer is no longer open"],
          body: ["বিজ্ঞাপনটি অ্যাডমিন সরিয়ে দিয়েছেন।", "The listing was removed by an administrator."],
          link: "/offers"
        });
      }
    } else {
      const restored = Number(listing.quantity_available) > 0 ? "active" : "reserved";
      await conn.query("UPDATE crop_listings SET status = ?, admin_note = ? WHERE id = ?", [restored, note, listing.id]);
    }

    await notify(conn, listing.farmer_id, {
      type: "announcement",
      title:
        status === "removed"
          ? ["আপনার একটি বিজ্ঞাপন অ্যাডমিন সরিয়ে দিয়েছেন", "An administrator removed one of your listings"]
          : ["আপনার বিজ্ঞাপন আবার চালু করা হয়েছে", "Your listing was restored"],
      body: note ? [note, note] : null,
      link: `/listings/${listing.id}`,
      entityType: "listing",
      entityId: listing.id
    });
  });

  await logActivity(req, `admin.listing_${status}`, "listing", req.params.id, note);
  send(req, res, { message: ["বিজ্ঞাপনের অবস্থা হালনাগাদ হয়েছে।", "Listing status updated."] });
}

async function crops(req, res) {
  const [rows] = await db.query(
    `SELECT c.id, c.category_id, cc.name_bn AS category_bn, cc.name_en AS category_en, c.slug, c.name_bn, c.name_en,
            c.default_unit, c.is_active,
            (SELECT COUNT(*) FROM crop_listings l WHERE l.crop_id = c.id) AS listings,
            (SELECT COUNT(*) FROM market_prices mp WHERE mp.crop_id = c.id) AS prices
     FROM crops c JOIN crop_categories cc ON cc.id = c.category_id ORDER BY cc.sort_order, c.name_en`
  );
  send(req, res, { data: rows });
}

async function saveCrop(req, res) {
  const d = req.body;
  let id = req.params.id;
  if (id) {
    const [result] = await db.query(
      "UPDATE crops SET category_id = ?, slug = ?, name_en = ?, name_bn = ?, default_unit = ?, is_active = ? WHERE id = ?",
      [d.category_id, d.slug, d.name_en, d.name_bn, d.default_unit, d.is_active ? 1 : 0, id]
    );
    if (result.affectedRows === 0) throw ApiError.notFound();
  } else {
    const [result] = await db.query(
      "INSERT INTO crops (category_id, slug, name_en, name_bn, default_unit, is_active) VALUES (?, ?, ?, ?, ?, ?)",
      [d.category_id, d.slug, d.name_en, d.name_bn, d.default_unit, d.is_active ? 1 : 0]
    );
    id = result.insertId;
  }
  await logActivity(req, req.params.id ? "admin.crop_update" : "admin.crop_create", "crop", id);
  send(req, res, { status: req.params.id ? 200 : 201, message: ["ফসলের তালিকা হালনাগাদ হয়েছে।", "Crop saved."], data: { id } });
}

// ---------------------------------------------------------------- harvest & expense overviews
async function harvestOverview(req, res) {
  const [byStatus] = await db.query("SELECT status, COUNT(*) AS total FROM harvests GROUP BY status");
  const [byCrop] = await db.query(
    `SELECT c.name_bn AS crop_bn, c.name_en AS crop_en, COUNT(*) AS total, COUNT(DISTINCT h.farmer_id) AS farmers
     FROM harvests h JOIN crops c ON c.id = h.crop_id GROUP BY c.id ORDER BY total DESC LIMIT 10`
  );
  const [[upcoming]] = await db.query(
    `SELECT COUNT(*) AS total FROM harvests WHERE status <> 'completed'
     AND expected_harvest_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 14 DAY)`
  );
  const [byDistrict] = await db.query(
    `SELECT d.name_bn AS district_bn, d.name_en AS district_en, COUNT(*) AS total
     FROM harvests h JOIN users u ON u.id = h.farmer_id JOIN districts d ON d.id = u.district_id
     GROUP BY d.id ORDER BY total DESC LIMIT 10`
  );
  send(req, res, { data: { by_status: byStatus, by_crop: byCrop, upcoming_14_days: Number(upcoming.total), by_district: byDistrict } });
}

/** Totals only — individual farmers' notebooks stay private. */
async function expenseOverview(req, res) {
  const [[totals]] = await db.query(
    `SELECT COUNT(DISTINCT n.id) AS notebooks, COUNT(DISTINCT n.farmer_id) AS farmers, COALESCE(SUM(e.total_cost), 0) AS total_cost
     FROM expense_notebooks n LEFT JOIN expenses e ON e.notebook_id = n.id`
  );
  const [byCategory] = await db.query(
    `SELECT ec.name_bn AS category_bn, ec.name_en AS category_en, SUM(e.total_cost) AS total, COUNT(*) AS rows_count
     FROM expenses e JOIN expense_categories ec ON ec.id = e.category_id GROUP BY ec.id ORDER BY total DESC`
  );
  const [byCrop] = await db.query(
    `SELECT c.name_bn AS crop_bn, c.name_en AS crop_en, COUNT(DISTINCT n.id) AS notebooks,
            ROUND(SUM(e.total_cost) / COUNT(DISTINCT n.id), 2) AS average_per_notebook
     FROM expense_notebooks n JOIN expenses e ON e.notebook_id = n.id JOIN crops c ON c.id = n.crop_id
     GROUP BY c.id ORDER BY notebooks DESC LIMIT 10`
  );
  send(req, res, { data: { totals, by_category: byCategory, by_crop: byCrop } });
}

// ---------------------------------------------------------------- bookings & trades
async function bookings(req, res) {
  const f = req.q;
  const filter = sqlFilter();
  if (f.status) filter.add("b.status = ?", f.status);
  if (f.booking_type) filter.add("b.booking_type = ?", f.booking_type);
  filter.search(f.q, ["rq.name", "pv.name", "m.name", "t.name"]);

  const { rows, meta } = await paginate(db, {
    selectSql: BOOKING_SELECT,
    fromSql: `${BOOKING_FROM} ${filter.where}`,
    params: filter.params,
    orderSql: "ORDER BY b.id DESC",
    paging: getPagination(req.query, 20)
  });
  send(req, res, { data: rows, meta });
}

async function cancelBooking(req, res) {
  await withTransaction(async (conn) => {
    const [[booking]] = await conn.query("SELECT * FROM bookings WHERE id = ? FOR UPDATE", [req.params.id]);
    if (!booking) throw ApiError.notFound();
    if (!["pending", "accepted", "in_progress"].includes(booking.status)) {
      throw ApiError.badRequest("শুধু চলমান বুকিং বাতিল করা যায়।", "Only open bookings can be cancelled.");
    }
    await conn.query(
      "UPDATE bookings SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = ?, provider_note = ? WHERE id = ?",
      [req.user.id, `Admin: ${req.body.note}`, booking.id]
    );
    await notifyMany(conn, [booking.requester_id, booking.provider_id], {
      type: "booking_status",
      title: ["অ্যাডমিন একটি বুকিং বাতিল করেছেন", "An administrator cancelled a booking"],
      body: [req.body.note, req.body.note],
      link: `/bookings/${booking.id}`,
      entityType: "booking",
      entityId: booking.id
    });
  });
  await logActivity(req, "admin.booking_cancel", "booking", req.params.id, req.body.note);
  send(req, res, { message: ["বুকিং বাতিল করা হয়েছে।", "Booking cancelled."] });
}

async function tradeList(req, res) {
  const f = req.q;
  const filter = sqlFilter();
  if (f.status) filter.add("t.status = ?", f.status);
  filter.search(f.q, ["b.name", "f.name", "c.name_bn", "c.name_en"]);

  const { rows, meta } = await paginate(db, {
    selectSql: `SELECT t.id, t.status, t.quantity, t.unit, t.price_per_unit, t.total_amount, t.payment_method,
                       t.created_at, t.updated_at, c.name_bn AS crop_bn, c.name_en AS crop_en,
                       b.id AS buyer_id, b.name AS buyer_name, f.id AS farmer_id, f.name AS farmer_name`,
    fromSql: `FROM trade_records t JOIN crop_listings l ON l.id = t.listing_id JOIN crops c ON c.id = l.crop_id
              JOIN users b ON b.id = t.buyer_id JOIN users f ON f.id = t.farmer_id ${filter.where}`,
    params: filter.params,
    orderSql: "ORDER BY FIELD(t.status, 'disputed') DESC, t.updated_at DESC",
    paging: getPagination(req.query, 20)
  });
  const [summary] = await db.query("SELECT status, COUNT(*) AS total, SUM(total_amount) AS value FROM trade_records GROUP BY status");
  send(req, res, { data: rows, meta: { ...meta, summary } });
}

/**
 * Admin decides a disputed trade: completed (escrow paid to the farmer) or
 * cancelled (escrow refunded to the buyer).
 */
async function resolveTrade(req, res) {
  const { to_status: toStatus, note } = req.body;

  await withTransaction(async (conn) => {
    const trade = await trades.lockTrade(conn, req.params.id);
    if (!trade) throw ApiError.notFound();
    if (trade.status !== "disputed") {
      throw ApiError.badRequest("শুধু অভিযোগকৃত লেনদেনের সিদ্ধান্ত দেওয়া যায়।", "Only disputed trades can be resolved here.");
    }

    if (toStatus === "completed") {
      await trades.changeStatus(conn, trade, "completed", req.user.id, `Admin: ${note}`, ", completed_at = NOW(), auto_release_at = NULL");
      await wallet.releaseEscrow(conn, trade, req.user.id, `Admin decision: ${note}`);
      await trades.markListingSoldIfFinished(conn, trade);
    } else {
      await trades.changeStatus(conn, trade, "cancelled", req.user.id, `Admin: ${note}`,
        ", cancelled_at = NOW(), cancelled_by = ?, cancel_reason = ?, auto_release_at = NULL", [req.user.id, note]);
      await wallet.refundEscrow(conn, trade, req.user.id, `Admin decision: ${note}`);
      await trades.restoreListingQuantity(conn, trade);
    }

    await conn.query(
      "UPDATE complaints SET status = 'resolved', admin_note = ?, handled_by = ?, resolved_at = NOW() WHERE trade_id = ? AND status IN ('open','in_review')",
      [note, req.user.id, trade.id]
    );
    await trades.notifyParties(conn, trade, req.user.id,
      toStatus === "completed"
        ? ["অ্যাডমিন লেনদেনটি সম্পন্ন ঘোষণা করেছেন", "An administrator marked the trade completed"]
        : ["অ্যাডমিন লেনদেনটি বাতিল করেছেন", "An administrator cancelled the trade"],
      [note, note]);
  });

  await logActivity(req, `admin.trade_${toStatus}`, "trade", req.params.id, note);
  send(req, res, { message: ["লেনদেনের সিদ্ধান্ত সংরক্ষণ হয়েছে।", "Trade decision saved."] });
}

// ---------------------------------------------------------------- complaints & reviews
async function complaints(req, res) {
  const f = req.q;
  const filter = sqlFilter();
  if (f.status) filter.add("c.status = ?", f.status);
  if (f.category) filter.add("c.category = ?", f.category);
  filter.search(f.q, ["c.subject", "cu.name", "au.name"]);

  const { rows, meta } = await paginate(db, {
    selectSql: `SELECT c.*, cu.name AS complainant_name, cu.role AS complainant_role, au.name AS against_name,
                       h.name AS handled_by_name`,
    fromSql: `FROM complaints c JOIN users cu ON cu.id = c.complainant_id LEFT JOIN users au ON au.id = c.against_user_id
              LEFT JOIN users h ON h.id = c.handled_by ${filter.where}`,
    params: filter.params,
    orderSql: "ORDER BY FIELD(c.status, 'open', 'in_review') DESC, c.created_at DESC",
    paging: getPagination(req.query, 20)
  });
  send(req, res, { data: rows, meta });
}

async function updateComplaint(req, res) {
  const { status, admin_note: note } = req.body;
  const [[complaint]] = await db.query("SELECT id, complainant_id FROM complaints WHERE id = ?", [req.params.id]);
  if (!complaint) throw ApiError.notFound();

  await db.query(
    `UPDATE complaints SET status = ?, admin_note = ?, handled_by = ?,
            resolved_at = IF(? IN ('resolved','dismissed'), NOW(), NULL) WHERE id = ?`,
    [status, note, req.user.id, status, complaint.id]
  );
  await notify(null, complaint.complainant_id, {
    type: "announcement",
    title: ["আপনার অভিযোগের অবস্থা হালনাগাদ হয়েছে", "Your complaint was updated"],
    body: note ? [note, note] : null,
    link: "/complaints",
    entityType: "complaint",
    entityId: complaint.id
  });
  await logActivity(req, "admin.complaint_update", "complaint", complaint.id, status);
  send(req, res, { message: ["অভিযোগ হালনাগাদ হয়েছে।", "Complaint updated."] });
}

async function reviews(req, res) {
  const f = req.q;
  const filter = sqlFilter();
  if (f.hidden !== null) filter.add("r.is_hidden = ?", f.hidden ? 1 : 0);
  if (f.max_rating) filter.add("r.rating <= ?", f.max_rating);
  filter.search(f.q, ["r.comment", "ru.name", "te.name"]);

  const { rows, meta } = await paginate(db, {
    selectSql: `SELECT r.*, ru.name AS reviewer_name, te.name AS reviewee_name`,
    fromSql: `FROM reviews r JOIN users ru ON ru.id = r.reviewer_id JOIN users te ON te.id = r.reviewee_id ${filter.where}`,
    params: filter.params,
    orderSql: "ORDER BY r.created_at DESC",
    paging: getPagination(req.query, 20)
  });
  send(req, res, { data: rows, meta });
}

async function hideReview(req, res) {
  const [result] = await db.query("UPDATE reviews SET is_hidden = 1, hidden_reason = ?, hidden_by = ? WHERE id = ?", [
    req.body.reason,
    req.user.id,
    req.params.id
  ]);
  if (result.affectedRows === 0) throw ApiError.notFound();
  await logActivity(req, "admin.review_hide", "review", req.params.id, req.body.reason);
  send(req, res, { message: ["রিভিউটি লুকানো হয়েছে।", "Review hidden."] });
}

async function unhideReview(req, res) {
  const [result] = await db.query("UPDATE reviews SET is_hidden = 0, hidden_reason = NULL, hidden_by = NULL WHERE id = ?", [
    req.params.id
  ]);
  if (result.affectedRows === 0) throw ApiError.notFound();
  await logActivity(req, "admin.review_unhide", "review", req.params.id);
  send(req, res, { message: ["রিভিউটি আবার দেখা যাবে।", "Review visible again."] });
}

// ---------------------------------------------------------------- announcements
async function announcements(req, res) {
  const [rows] = await db.query(
    `SELECT a.id, a.title, a.body, a.target_role, a.created_at, u.name AS created_by_name,
            (SELECT COUNT(*) FROM notifications n WHERE n.announcement_id = a.id) AS recipients
     FROM announcements a LEFT JOIN users u ON u.id = a.created_by ORDER BY a.id DESC LIMIT 100`
  );
  send(req, res, { data: rows });
}

async function createAnnouncement(req, res) {
  const { title, body, target_role: role } = req.body;

  const recipients = await withTransaction(async (conn) => {
    const [result] = await conn.query("INSERT INTO announcements (title, body, target_role, created_by) VALUES (?, ?, ?, ?)", [
      title,
      body,
      role,
      req.user.id
    ]);
    const [sent] = await conn.query(
      `INSERT INTO notifications (user_id, type, title, body, link, entity_type, entity_id, announcement_id)
       SELECT id, 'announcement', ?, ?, '/notifications', 'announcement', ?, ? FROM users
       WHERE is_blocked = 0 ${role ? "AND role = ?" : ""}`,
      role ? [title, body.slice(0, 1000), result.insertId, result.insertId, role] : [title, body.slice(0, 1000), result.insertId, result.insertId]
    );
    return sent.affectedRows;
  });

  await logActivity(req, "admin.announcement", "announcement", null, title);
  send(req, res, {
    status: 201,
    message: [`ঘোষণা ${recipients} জনকে পাঠানো হয়েছে।`, `Announcement sent to ${recipients} user(s).`],
    data: { recipients }
  });
}

// ---------------------------------------------------------------- reports & activity
async function reports(req, res) {
  const [tradesByMonth] = await db.query(
    `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS trades,
            SUM(IF(status = 'completed', total_amount, 0)) AS completed_value
     FROM trade_records WHERE created_at >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 11 MONTH)
     GROUP BY month ORDER BY month`
  );
  const [listingsByCategory] = await db.query(
    `SELECT cc.name_bn AS category_bn, cc.name_en AS category_en, COUNT(l.id) AS total
     FROM crop_categories cc LEFT JOIN crops c ON c.category_id = cc.id
     LEFT JOIN crop_listings l ON l.crop_id = c.id AND l.status <> 'removed'
     GROUP BY cc.id ORDER BY total DESC`
  );
  const [topCrops] = await db.query(
    `SELECT c.name_bn AS crop_bn, c.name_en AS crop_en, COUNT(l.id) AS listings,
            COALESCE(SUM(t.total_amount), 0) AS traded_value
     FROM crops c JOIN crop_listings l ON l.crop_id = c.id
     LEFT JOIN trade_records t ON t.listing_id = l.id AND t.status = 'completed'
     GROUP BY c.id ORDER BY listings DESC LIMIT 10`
  );
  const [bookingsByType] = await db.query(
    "SELECT booking_type, status, COUNT(*) AS total FROM bookings GROUP BY booking_type, status ORDER BY booking_type"
  );
  const [usersByDistrict] = await db.query(
    `SELECT d.name_bn AS district_bn, d.name_en AS district_en, COUNT(*) AS total
     FROM users u JOIN districts d ON d.id = u.district_id GROUP BY d.id ORDER BY total DESC LIMIT 10`
  );
  const [tradeStatus] = await db.query("SELECT status, COUNT(*) AS total FROM trade_records GROUP BY status");

  send(req, res, {
    data: {
      trades_by_month: tradesByMonth,
      listings_by_category: listingsByCategory,
      top_crops: topCrops,
      bookings_by_type: bookingsByType,
      users_by_district: usersByDistrict,
      trade_status: tradeStatus
    }
  });
}

async function activity(req, res) {
  const filter = sqlFilter();
  filter.search(req.q.q, ["a.action", "u.name", "a.details"]);
  const { rows, meta } = await paginate(db, {
    selectSql: `SELECT a.id, a.action, a.entity_type, a.entity_id, a.details, a.ip_address, a.created_at,
                       u.name AS actor_name, u.role AS actor_role`,
    fromSql: `FROM activity_logs a LEFT JOIN users u ON u.id = a.actor_id ${filter.where}`,
    params: filter.params,
    orderSql: "ORDER BY a.id DESC",
    paging: getPagination(req.query, 30)
  });
  send(req, res, { data: rows, meta });
}

module.exports = {
  schemas,
  stats,
  users,
  userDetail,
  blockUser,
  unblockUser,
  changeRole,
  listings,
  setListingStatus,
  crops,
  saveCrop,
  harvestOverview,
  expenseOverview,
  bookings,
  cancelBooking,
  tradeList,
  resolveTrade,
  complaints,
  updateComplaint,
  reviews,
  hideReview,
  unhideReview,
  announcements,
  createAnnouncement,
  reports,
  activity
};
