/**
 * The logged-in user's notifications.
 */
const db = require("../config/db");
const v = require("../utils/validator");
const { send } = require("../utils/response");
const { getPagination, paginate } = require("../utils/pagination");
const ApiError = require("../utils/ApiError");
const live = require("../services/liveService");
const { NOTIFICATION_COLUMNS } = require("../services/notificationService");

const schemas = {
  list: { unread_only: v.boolean().default(false), type: v.string().max(50), page: v.integer(), limit: v.integer() }
};

async function list(req, res) {
  const where = ["user_id = ?"];
  const params = [req.user.id];
  if (req.q.unread_only) where.push("is_read = 0");
  if (req.q.type) {
    where.push("type = ?");
    params.push(req.q.type);
  }

  const { rows, meta } = await paginate(db, {
    selectSql: `SELECT ${NOTIFICATION_COLUMNS}`,
    fromSql: `FROM notifications WHERE ${where.join(" AND ")}`,
    params,
    orderSql: "ORDER BY created_at DESC, id DESC",
    paging: getPagination(req.query, 20)
  });
  const [[{ unread }]] = await db.query("SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND is_read = 0", [
    req.user.id
  ]);
  send(req, res, { data: rows, meta: { ...meta, unread: Number(unread) } });
}

/** Small endpoint polled by the bell icon. */
async function unreadCount(req, res) {
  const [[{ unread }]] = await db.query("SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND is_read = 0", [
    req.user.id
  ]);
  const [[{ messages }]] = await db.query(
    `SELECT COUNT(*) AS messages FROM messages m JOIN conversations c ON c.id = m.conversation_id
     WHERE (c.farmer_id = ? OR c.buyer_id = ?) AND m.sender_id <> ? AND m.read_at IS NULL`,
    [req.user.id, req.user.id, req.user.id]
  );
  send(req, res, { data: { unread: Number(unread), unread_messages: Number(messages) } });
}

/** One-time ticket for opening the live stream (EventSource cannot send the login header). */
async function streamTicket(req, res) {
  send(req, res, { data: live.issueTicket(req.user.id, req.sessionJti) });
}

/** Live stream: GET /notifications/stream?ticket=... (Server-Sent Events). */
async function stream(req, res) {
  const owner = live.redeemTicket(req.query.ticket);
  if (!owner || !(await live.sessionIsValid(owner.userId, owner.jti))) {
    throw ApiError.unauthorized(
      "লাইভ নোটিফিকেশনের সংযোগ শেষ হয়েছে। আবার চেষ্টা করুন।",
      "The live notification link has expired. Please try again."
    );
  }
  live.openStream(req, res, owner, { unread: await live.unreadCount(null, owner.userId) });
}

async function markRead(req, res) {
  await db.query("UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ? AND user_id = ? AND is_read = 0", [
    req.params.id,
    req.user.id
  ]);
  live.publishUnread(req.user.id).catch(() => {});
  send(req, res, { data: { id: req.params.id, is_read: 1 } });
}

async function markAllRead(req, res) {
  const [result] = await db.query("UPDATE notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0", [
    req.user.id
  ]);
  live.publishUnread(req.user.id).catch(() => {});
  send(req, res, {
    message: ["সব নোটিফিকেশন পড়া হয়েছে।", "All notifications marked as read."],
    data: { updated: result.affectedRows }
  });
}

async function remove(req, res) {
  await db.query("DELETE FROM notifications WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
  live.publishUnread(req.user.id).catch(() => {});
  send(req, res, { message: ["মুছে ফেলা হয়েছে।", "Deleted."] });
}

module.exports = { schemas, list, unreadCount, streamTicket, stream, markRead, markAllRead, remove };
