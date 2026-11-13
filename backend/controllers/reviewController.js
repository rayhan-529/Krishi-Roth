/**
 * Ratings and reviews.
 * Only the two people in a COMPLETED trade or booking can review each other,
 * once each. The database also enforces "one review per person per trade/booking".
 */
const db = require("../config/db");
const v = require("../utils/validator");
const ApiError = require("../utils/ApiError");
const { send } = require("../utils/response");
const { getPagination, paginate } = require("../utils/pagination");
const { notify } = require("../services/notificationService");
const { logActivity } = require("../services/activityService");

const schemas = {
  create: {
    trade_id: v.id(),
    booking_id: v.id(),
    rating: v.integer().required().min(1).max(5),
    comment: v.string().max(1000)
  },
  list: { page: v.integer(), limit: v.integer() }
};

async function create(req, res) {
  const d = req.body;
  if (!!d.trade_id === !!d.booking_id) {
    throw ApiError.badRequest("একটি লেনদেন বা বুকিং বেছে নিন।", "Choose one trade or booking to review.");
  }

  let revieweeId;
  if (d.trade_id) {
    const [[trade]] = await db.query("SELECT buyer_id, farmer_id, status FROM trade_records WHERE id = ?", [d.trade_id]);
    if (!trade || (trade.buyer_id !== req.user.id && trade.farmer_id !== req.user.id)) throw ApiError.notFound();
    if (trade.status !== "completed") {
      throw ApiError.badRequest("লেনদেন সম্পন্ন হওয়ার পর রিভিউ দেওয়া যাবে।", "You can review after the trade is completed.");
    }
    revieweeId = trade.buyer_id === req.user.id ? trade.farmer_id : trade.buyer_id;
  } else {
    const [[booking]] = await db.query("SELECT requester_id, provider_id, status FROM bookings WHERE id = ?", [d.booking_id]);
    if (!booking || (booking.requester_id !== req.user.id && booking.provider_id !== req.user.id)) throw ApiError.notFound();
    if (booking.status !== "completed") {
      throw ApiError.badRequest("বুকিং সম্পন্ন হওয়ার পর রিভিউ দেওয়া যাবে।", "You can review after the booking is completed.");
    }
    revieweeId = booking.requester_id === req.user.id ? booking.provider_id : booking.requester_id;
  }

  try {
    const [result] = await db.query(
      "INSERT INTO reviews (reviewer_id, reviewee_id, trade_id, booking_id, rating, comment) VALUES (?, ?, ?, ?, ?, ?)",
      [req.user.id, revieweeId, d.trade_id, d.booking_id, d.rating, d.comment]
    );
    await notify(null, revieweeId, {
      type: "review",
      title: [`আপনি ${d.rating} তারকা রেটিং পেয়েছেন`, `You received a ${d.rating}-star rating`],
      body: d.comment ? [d.comment, d.comment] : null,
      link: "/profile",
      entityType: "review",
      entityId: result.insertId
    });
    await logActivity(req, "review.create", "review", result.insertId);
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw ApiError.conflict("আপনি আগেই রিভিউ দিয়েছেন।", "You have already reviewed this.");
    }
    throw error;
  }

  send(req, res, { status: 201, message: ["রিভিউ দেওয়ার জন্য ধন্যবাদ।", "Thank you for your review."] });
}

/** Completed trades and bookings the user has not reviewed yet. */
async function pending(req, res) {
  const [trades] = await db.query(
    `SELECT 'trade' AS kind, t.id, t.completed_at AS finished_at, c.name_bn AS title_bn, c.name_en AS title_en,
            IF(t.buyer_id = ?, f.name, b.name) AS other_name, IF(t.buyer_id = ?, f.id, b.id) AS other_id
     FROM trade_records t JOIN crop_listings l ON l.id = t.listing_id JOIN crops c ON c.id = l.crop_id
     JOIN users b ON b.id = t.buyer_id JOIN users f ON f.id = t.farmer_id
     WHERE t.status = 'completed' AND (t.buyer_id = ? OR t.farmer_id = ?)
       AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.trade_id = t.id AND r.reviewer_id = ?)
     ORDER BY t.completed_at DESC LIMIT 20`,
    [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id]
  );
  const [bookings] = await db.query(
    `SELECT 'booking' AS kind, bk.id, bk.completed_at AS finished_at, bk.booking_type AS title_bn, bk.booking_type AS title_en,
            IF(bk.requester_id = ?, pv.name, rq.name) AS other_name, IF(bk.requester_id = ?, pv.id, rq.id) AS other_id
     FROM bookings bk JOIN users rq ON rq.id = bk.requester_id JOIN users pv ON pv.id = bk.provider_id
     WHERE bk.status = 'completed' AND (bk.requester_id = ? OR bk.provider_id = ?)
       AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.booking_id = bk.id AND r.reviewer_id = ?)
     ORDER BY bk.completed_at DESC LIMIT 20`,
    [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id]
  );
  send(req, res, { data: [...trades, ...bookings] });
}

/** Visible reviews about one user. */
async function forUser(req, res) {
  const { rows, meta } = await paginate(db, {
    selectSql: `SELECT r.id, r.rating, r.comment, r.created_at, r.trade_id, r.booking_id,
                       u.id AS reviewer_id, u.name AS reviewer_name, u.role AS reviewer_role, u.profile_photo AS reviewer_photo`,
    fromSql: "FROM reviews r JOIN users u ON u.id = r.reviewer_id WHERE r.reviewee_id = ? AND r.is_hidden = 0",
    params: [req.params.id],
    orderSql: "ORDER BY r.created_at DESC",
    paging: getPagination(req.query, 10)
  });
  const [[summary]] = await db.query(
    "SELECT review_count, average_rating FROM user_rating_summary WHERE user_id = ?",
    [req.params.id]
  );
  send(req, res, { data: rows, meta: { ...meta, summary: summary || { review_count: 0, average_rating: null } } });
}

module.exports = { schemas, create, pending, forUser };
