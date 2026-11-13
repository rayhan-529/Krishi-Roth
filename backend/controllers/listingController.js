/**
 * Farmer-to-market crop listings.
 *   Public:  browse/search listings, view one listing
 *   Farmer:  create, edit, mark sold, delete own listings
 */
const db = require("../config/db");
const v = require("../utils/validator");
const ApiError = require("../utils/ApiError");
const { send } = require("../utils/response");
const { getPagination, paginate } = require("../utils/pagination");
const { withTransaction } = require("../services/transaction");
const { listImages, syncImages, deleteAllImageFiles } = require("../services/imageService");
const { notifyMany } = require("../services/notificationService");
const { logActivity } = require("../services/activityService");

const UNITS = ["kg", "maund", "ton", "piece", "dozen", "hali", "bundle", "crate"];

const listingFields = {
  crop_id: v.id().required(),
  variety: v.string().max(100),
  quantity: v.number().required().min(0.01).max(9999999),
  unit: v.enum(UNITS).required(),
  price_per_unit: v.number().required().min(0.01).max(99999999),
  min_order_quantity: v.number().min(0.01).max(9999999),
  is_negotiable: v.boolean().default(true),
  district_id: v.id().required(),
  upazila: v.string().max(80),
  harvest_date: v.date(),
  description: v.string().max(3000)
};

const schemas = {
  create: listingFields,
  update: { ...listingFields, remove_image_ids: v.array(v.id()).default([]) },
  status: { status: v.enum(["active", "sold", "expired"]).required() },
  search: {
    q: v.string().max(100),
    crop_id: v.id(),
    category_id: v.id(),
    district_id: v.id(),
    division_id: v.id(),
    unit: v.enum(UNITS),
    min_price: v.number().min(0),
    max_price: v.number().min(0),
    min_quantity: v.number().min(0),
    verified_only: v.boolean().default(false),
    sort: v.enum(["newest", "price_asc", "price_desc", "quantity_desc"]).default("newest"),
    page: v.integer(),
    limit: v.integer()
  },
  mine: {
    status: v.enum(["active", "reserved", "sold", "expired", "removed"]),
    page: v.integer(),
    limit: v.integer()
  }
};

const SORTS = {
  newest: "ORDER BY l.created_at DESC, l.id DESC",
  price_asc: "ORDER BY l.price_per_unit ASC, l.id DESC",
  price_desc: "ORDER BY l.price_per_unit DESC, l.id DESC",
  quantity_desc: "ORDER BY l.quantity_available DESC, l.id DESC"
};

const LISTING_SELECT = `
  SELECT l.id, l.farmer_id, l.crop_id, c.name_bn AS crop_bn, c.name_en AS crop_en,
         cc.id AS category_id, cc.name_bn AS category_bn, cc.name_en AS category_en,
         l.variety, l.quantity, l.quantity_available, l.unit, l.price_per_unit, l.min_order_quantity,
         l.is_negotiable, l.district_id, d.name_bn AS district_bn, d.name_en AS district_en, l.upazila,
         l.harvest_date, l.description, l.status, l.created_at, l.updated_at,
         (SELECT image_path FROM crop_listing_images i WHERE i.listing_id = l.id
          ORDER BY i.sort_order, i.id LIMIT 1) AS cover_image,
         u.name AS farmer_name, u.profile_photo AS farmer_photo, u.verification_status AS farmer_verification,
         COALESCE(rs.review_count, 0) AS farmer_review_count, rs.average_rating AS farmer_rating`;

const LISTING_FROM = `
  FROM crop_listings l
  JOIN crops c ON c.id = l.crop_id
  JOIN crop_categories cc ON cc.id = c.category_id
  JOIN districts d ON d.id = l.district_id
  JOIN users u ON u.id = l.farmer_id
  LEFT JOIN user_rating_summary rs ON rs.user_id = l.farmer_id`;

/** Public marketplace search. */
async function search(req, res) {
  const f = req.q;
  const where = ["l.status = 'active'", "u.is_blocked = 0", "l.quantity_available > 0"];
  const params = [];
  const add = (clause, ...values) => {
    where.push(clause);
    params.push(...values);
  };

  if (f.q) {
    where.push("(c.name_bn LIKE ? OR c.name_en LIKE ? OR l.variety LIKE ?)");
    params.push(`%${f.q}%`, `%${f.q}%`, `%${f.q}%`);
  }
  if (f.crop_id) add("l.crop_id = ?", f.crop_id);
  if (f.category_id) add("c.category_id = ?", f.category_id);
  if (f.district_id) add("l.district_id = ?", f.district_id);
  if (f.division_id) add("d.division_id = ?", f.division_id);
  if (f.unit) add("l.unit = ?", f.unit);
  if (f.min_price !== null) add("l.price_per_unit >= ?", f.min_price);
  if (f.max_price !== null) add("l.price_per_unit <= ?", f.max_price);
  if (f.min_quantity !== null) add("l.quantity_available >= ?", f.min_quantity);
  if (f.verified_only) where.push("u.verification_status = 'verified'");

  const { rows, meta } = await paginate(db, {
    selectSql: LISTING_SELECT,
    fromSql: `${LISTING_FROM} WHERE ${where.join(" AND ")}`,
    params,
    orderSql: SORTS[f.sort],
    paging: getPagination(req.query, 12)
  });

  send(req, res, { data: rows, meta });
}

async function findListing(conn, id) {
  const [rows] = await conn.query(`${LISTING_SELECT} ${LISTING_FROM} WHERE l.id = ?`, [id]);
  return rows[0] || null;
}

/** Loads a listing and makes sure the current farmer owns it. */
async function findOwnListing(conn, req, { lock = false } = {}) {
  const [rows] = await conn.query(
    `SELECT * FROM crop_listings WHERE id = ? ${lock ? "FOR UPDATE" : ""}`,
    [req.params.id]
  );
  const listing = rows[0];
  if (!listing) throw ApiError.notFound("বিজ্ঞাপনটি পাওয়া যায়নি।", "Listing not found.");
  if (listing.farmer_id !== req.user.id) throw ApiError.forbidden();
  return listing;
}

/** One listing with photos, seller details and recent market prices for the crop. */
async function show(req, res) {
  const listing = await findListing(db, req.params.id);
  const isOwner = req.user && listing && req.user.id === listing.farmer_id;
  const isAdmin = req.user && req.user.role === "admin";

  if (!listing || (listing.status === "removed" && !isOwner && !isAdmin)) {
    throw ApiError.notFound("বিজ্ঞাপনটি পাওয়া যায়নি।", "Listing not found.");
  }

  listing.images = await listImages(db, "listing", listing.id);

  const [prices] = await db.query(
    `SELECT mp.id, mp.market_name, d.name_bn AS district_bn, d.name_en AS district_en, mp.unit,
            mp.min_price, mp.max_price, mp.price_date, mp.source
     FROM market_prices mp JOIN districts d ON d.id = mp.district_id
     WHERE mp.crop_id = ? ORDER BY mp.price_date DESC, mp.id DESC LIMIT 5`,
    [listing.crop_id]
  );
  listing.market_prices = prices;

  if (req.user && req.user.role === "buyer") {
    const [offers] = await db.query(
      `SELECT id, quantity, offered_price_per_unit, total_amount, status, created_at
       FROM purchase_offers WHERE listing_id = ? AND buyer_id = ? ORDER BY created_at DESC`,
      [listing.id, req.user.id]
    );
    listing.my_offers = offers;
  }

  if (isOwner) {
    const [[counts]] = await db.query(
      "SELECT COUNT(*) AS pending_offers FROM purchase_offers WHERE listing_id = ? AND status = 'pending'",
      [listing.id]
    );
    listing.pending_offers = counts.pending_offers;
  }

  send(req, res, { data: listing });
}

/** The farmer's own listings (all statuses). */
async function mine(req, res) {
  const where = ["l.farmer_id = ?"];
  const params = [req.user.id];
  const add = (clause, ...values) => {
    where.push(clause);
    params.push(...values);
  };
  if (req.q.status) add("l.status = ?", req.q.status);

  const { rows, meta } = await paginate(db, {
    selectSql: `${LISTING_SELECT},
      (SELECT COUNT(*) FROM purchase_offers po WHERE po.listing_id = l.id AND po.status = 'pending') AS pending_offers`,
    fromSql: `${LISTING_FROM} WHERE ${where.join(" AND ")}`,
    params,
    orderSql: "ORDER BY l.created_at DESC",
    paging: getPagination(req.query, 10)
  });

  send(req, res, { data: rows, meta });
}

function checkMinOrder(data) {
  if (data.min_order_quantity !== null && data.min_order_quantity > data.quantity) {
    const message = { bn: "সর্বনিম্ন অর্ডার মোট পরিমাণের বেশি হতে পারবে না।", en: "Minimum order cannot exceed the total quantity." };
    throw ApiError.badRequest(message.bn, message.en, { min_order_quantity: message });
  }
}

async function create(req, res) {
  const data = req.body;
  checkMinOrder(data);

  const id = await withTransaction(async (conn) => {
    const [result] = await conn.query(
      `INSERT INTO crop_listings
         (farmer_id, crop_id, variety, quantity, quantity_available, unit, price_per_unit, min_order_quantity,
          is_negotiable, district_id, upazila, harvest_date, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id, data.crop_id, data.variety, data.quantity, data.quantity, data.unit, data.price_per_unit,
        data.min_order_quantity, data.is_negotiable ? 1 : 0, data.district_id, data.upazila, data.harvest_date,
        data.description
      ]
    );
    await syncImages(conn, "listing", result.insertId, req.files || []);
    return result.insertId;
  });

  await logActivity(req, "listing.create", "listing", id);
  send(req, res, {
    status: 201,
    message: ["ফসলের বিজ্ঞাপন প্রকাশিত হয়েছে।", "Crop listing published."],
    data: await findListing(db, id)
  });
}

async function update(req, res) {
  const data = req.body;
  checkMinOrder(data);

  const cleanup = await withTransaction(async (conn) => {
    const listing = await findOwnListing(conn, req, { lock: true });

    if (["sold", "removed"].includes(listing.status)) {
      throw ApiError.badRequest("বিক্রি হওয়া বা মুছে ফেলা বিজ্ঞাপন পরিবর্তন করা যাবে না।", "Sold or removed listings cannot be edited.");
    }

    // Keep the quantity already committed to accepted offers.
    const committed = Number(listing.quantity) - Number(listing.quantity_available);
    const available = Number((data.quantity - committed).toFixed(2));
    if (available < 0) {
      const message = {
        bn: `কমপক্ষে ${committed} দিতে হবে, কারণ এই পরিমাণ ইতিমধ্যে গৃহীত প্রস্তাবে আছে।`,
        en: `Quantity must be at least ${committed} because that much is already in accepted offers.`
      };
      throw ApiError.badRequest(message.bn, message.en, { quantity: message });
    }
    if (committed > 0 && data.unit !== listing.unit) {
      const message = { bn: "গৃহীত প্রস্তাব থাকায় একক পরিবর্তন করা যাবে না।", en: "The unit cannot change after an offer was accepted." };
      throw ApiError.badRequest(message.bn, message.en, { unit: message });
    }

    let status = listing.status;
    if (available > 0 && status === "reserved") status = "active";
    if (available === 0 && status === "active") status = "reserved";

    await conn.query(
      `UPDATE crop_listings
       SET crop_id = ?, variety = ?, quantity = ?, quantity_available = ?, unit = ?, price_per_unit = ?,
           min_order_quantity = ?, is_negotiable = ?, district_id = ?, upazila = ?, harvest_date = ?,
           description = ?, status = ?
       WHERE id = ?`,
      [
        data.crop_id, data.variety, data.quantity, available, data.unit, data.price_per_unit,
        data.min_order_quantity, data.is_negotiable ? 1 : 0, data.district_id, data.upazila, data.harvest_date,
        data.description, status, listing.id
      ]
    );

    return syncImages(conn, "listing", listing.id, req.files || [], data.remove_image_ids);
  });

  cleanup();
  await logActivity(req, "listing.update", "listing", req.params.id);
  send(req, res, {
    message: ["বিজ্ঞাপন হালনাগাদ হয়েছে।", "Listing updated."],
    data: await findListing(db, req.params.id)
  });
}

/** Expires every pending offer on a listing and tells the buyers. */
async function expirePendingOffers(conn, listingId, reason) {
  const [pending] = await conn.query(
    "SELECT id, buyer_id FROM purchase_offers WHERE listing_id = ? AND status = 'pending'",
    [listingId]
  );
  if (pending.length === 0) return;

  await conn.query(
    "UPDATE purchase_offers SET status = 'expired', responded_at = NOW() WHERE listing_id = ? AND status = 'pending'",
    [listingId]
  );
  await notifyMany(conn, pending.map((o) => o.buyer_id), {
    type: "offer_rejected",
    title: ["আপনার প্রস্তাবটি আর প্রযোজ্য নয়", "Your offer is no longer open"],
    body: reason,
    link: "/offers",
    entityType: "listing",
    entityId: listingId
  });
}

/** Farmer marks a listing sold, expired, or makes it active again. */
async function setStatus(req, res) {
  const { status } = req.body;

  await withTransaction(async (conn) => {
    const listing = await findOwnListing(conn, req, { lock: true });

    if (listing.status === "removed") {
      throw ApiError.badRequest("মুছে ফেলা বিজ্ঞাপন পরিবর্তন করা যাবে না।", "A removed listing cannot be changed.");
    }
    if (status === "active" && Number(listing.quantity_available) <= 0) {
      throw ApiError.badRequest("বিক্রির জন্য কোনো পরিমাণ বাকি নেই। আগে পরিমাণ বাড়ান।", "No quantity left. Increase the quantity first.");
    }

    await conn.query("UPDATE crop_listings SET status = ? WHERE id = ?", [status, listing.id]);

    if (status !== "active") {
      await expirePendingOffers(conn, listing.id, [
        "কৃষক বিজ্ঞাপনটি বন্ধ করেছেন।",
        "The farmer has closed this listing."
      ]);
    }
  });

  await logActivity(req, `listing.${status}`, "listing", req.params.id);
  send(req, res, {
    message: ["অবস্থা হালনাগাদ হয়েছে।", "Status updated."],
    data: await findListing(db, req.params.id)
  });
}

/**
 * Deletes a listing. If it already has offers or trades, it is hidden
 * (status "removed") instead, so trade history is never lost.
 */
async function remove(req, res) {
  const result = await withTransaction(async (conn) => {
    const listing = await findOwnListing(conn, req, { lock: true });

    const [[{ openTrades }]] = await conn.query(
      `SELECT COUNT(*) AS openTrades FROM trade_records
       WHERE listing_id = ? AND status IN ('payment_pending','payment_confirmed','delivery_pending','disputed')`,
      [listing.id]
    );
    if (Number(openTrades) > 0) {
      throw ApiError.conflict(
        "এই বিজ্ঞাপনে চলমান লেনদেন আছে। লেনদেন শেষ হলে মুছুন।",
        "This listing has trades in progress. Delete it after they finish."
      );
    }

    const [[{ history }]] = await conn.query(
      `SELECT (SELECT COUNT(*) FROM purchase_offers WHERE listing_id = ?) +
              (SELECT COUNT(*) FROM trade_records WHERE listing_id = ?) AS history`,
      [listing.id, listing.id]
    );

    if (Number(history) > 0) {
      await expirePendingOffers(conn, listing.id, ["কৃষক বিজ্ঞাপনটি মুছে ফেলেছেন।", "The farmer deleted this listing."]);
      await conn.query("UPDATE crop_listings SET status = 'removed' WHERE id = ?", [listing.id]);
      return { cleanup: () => {}, soft: true };
    }

    const cleanup = await deleteAllImageFiles(conn, "listing", listing.id);
    await conn.query("DELETE FROM crop_listings WHERE id = ?", [listing.id]);
    return { cleanup, soft: false };
  });

  result.cleanup();
  await logActivity(req, "listing.delete", "listing", req.params.id, result.soft ? "soft" : "hard");
  send(req, res, { message: ["বিজ্ঞাপনটি মুছে ফেলা হয়েছে।", "Listing deleted."] });
}

module.exports = { schemas, search, show, mine, create, update, setStatus, remove, findListing, UNITS };
