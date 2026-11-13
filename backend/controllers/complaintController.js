/**
 * Complaints sent by users to the administrators.
 */
const db = require("../config/db");
const v = require("../utils/validator");
const ApiError = require("../utils/ApiError");
const { send } = require("../utils/response");
const { notifyMany } = require("../services/notificationService");
const { logActivity } = require("../services/activityService");

const CATEGORIES = ["fraud", "payment", "delivery", "quality", "behaviour", "service", "technical", "other"];

const schemas = {
  create: {
    category: v.enum(CATEGORIES).required(),
    subject: v.string().required().min(3).max(200),
    description: v.string().required().min(10).max(5000),
    against_user_id: v.id(),
    trade_id: v.id(),
    booking_id: v.id()
  }
};

async function create(req, res) {
  const d = req.body;

  // A complaint can only point to a trade/booking the user took part in.
  if (d.trade_id) {
    const [[trade]] = await db.query("SELECT buyer_id, farmer_id FROM trade_records WHERE id = ?", [d.trade_id]);
    if (!trade || ![trade.buyer_id, trade.farmer_id].includes(req.user.id)) throw ApiError.notFound();
  }
  if (d.booking_id) {
    const [[booking]] = await db.query("SELECT requester_id, provider_id FROM bookings WHERE id = ?", [d.booking_id]);
    if (!booking || ![booking.requester_id, booking.provider_id].includes(req.user.id)) throw ApiError.notFound();
  }
  if (d.against_user_id === req.user.id) d.against_user_id = null;

  const [result] = await db.query(
    `INSERT INTO complaints (complainant_id, against_user_id, trade_id, booking_id, category, subject, description)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [req.user.id, d.against_user_id, d.trade_id, d.booking_id, d.category, d.subject, d.description]
  );

  const [admins] = await db.query("SELECT id FROM users WHERE role = 'admin' AND is_blocked = 0");
  await notifyMany(null, admins.map((a) => a.id), {
    type: "announcement",
    title: ["নতুন অভিযোগ এসেছে", "New complaint received"],
    body: [d.subject, d.subject],
    link: "/admin/complaints",
    entityType: "complaint",
    entityId: result.insertId
  });

  await logActivity(req, "complaint.create", "complaint", result.insertId);
  send(req, res, {
    status: 201,
    message: ["আপনার অভিযোগ পাঠানো হয়েছে। অ্যাডমিন শীঘ্রই দেখবেন।", "Your complaint was sent. An admin will review it soon."],
    data: { id: result.insertId }
  });
}

async function mine(req, res) {
  const [rows] = await db.query(
    `SELECT c.id, c.category, c.subject, c.description, c.status, c.admin_note, c.trade_id, c.booking_id,
            c.created_at, c.resolved_at, u.name AS against_name
     FROM complaints c LEFT JOIN users u ON u.id = c.against_user_id
     WHERE c.complainant_id = ? ORDER BY c.created_at DESC`,
    [req.user.id]
  );
  send(req, res, { data: rows });
}

module.exports = { schemas, create, mine, CATEGORIES };
