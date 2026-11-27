/**
 * In-app notifications.
 *
 *   await notify(db, userId, {
 *     type: "offer_new",
 *     title: ["নতুন ক্রয় প্রস্তাব", "New purchase offer"],
 *     body:  ["...", "..."],
 *     link: "/offers",
 *     entityType: "offer", entityId: 12
 *   });
 *
 * The text is saved in the receiving user's preferred language
 * (users.preferred_language), so each person reads it in their language.
 * Pass a transaction connection as the first argument to make the
 * notification part of the same transaction.
 *
 * If the user has the site open, the new notification is also pushed to
 * them live (see liveService). Inside a withTransaction() the push waits
 * until the transaction is committed, so a rolled-back notification is
 * never shown.
 */
const db = require("../config/db");
const live = require("./liveService");

const NOTIFICATION_COLUMNS = "id, type, title, body, link, entity_type, entity_id, is_read, read_at, created_at";

/** Reads the saved notification and sends it to the user's open tabs. */
async function pushLive(userId, notificationId) {
  if (!live.isOnline(userId)) return;
  const [[row]] = await db.query(`SELECT ${NOTIFICATION_COLUMNS} FROM notifications WHERE id = ? AND user_id = ?`, [
    notificationId,
    userId
  ]);
  if (!row) return;
  live.publish(userId, "notification", { notification: row, unread: await live.unreadCount(null, userId) });
}

function schedulePush(conn, userId, notificationId) {
  if (!live.isOnline(userId)) return;
  const task = () => pushLive(userId, notificationId);
  if (conn && typeof conn.afterCommit === "function") conn.afterCommit(task);
  else task().catch((error) => console.error("Live notification failed:", error.message));
}

async function notify(conn, userId, { type, title, body = null, link = null, entityType = null, entityId = null }) {
  const [titleBn, titleEn] = title;
  const [bodyBn, bodyEn] = body || [null, null];

  const [result] = await (conn || db).query(
    `INSERT INTO notifications (user_id, type, title, body, link, entity_type, entity_id)
     SELECT id, ?,
            IF(preferred_language = 'en', ?, ?),
            IF(preferred_language = 'en', ?, ?),
            ?, ?, ?
     FROM users WHERE id = ?`,
    [type, titleEn || titleBn, titleBn, bodyEn || bodyBn, bodyBn, link, entityType, entityId, userId]
  );
  if (result.affectedRows) schedulePush(conn, userId, result.insertId);
}

/** Sends the same notification to several users. */
async function notifyMany(conn, userIds, payload) {
  for (const userId of new Set(userIds)) {
    await notify(conn, userId, payload);
  }
}

/**
 * Pushes an announcement (inserted in bulk by the admin) to everyone who is
 * online right now. Call it after the transaction has been committed.
 */
async function pushAnnouncement(announcementId) {
  const online = live.onlineUserIds();
  if (!online.length) return;
  const [rows] = await db.query(
    `SELECT user_id, ${NOTIFICATION_COLUMNS} FROM notifications WHERE announcement_id = ? AND user_id IN (?)`,
    [announcementId, online]
  );
  for (const { user_id: userId, ...notification } of rows) {
    live.publish(userId, "notification", { notification, unread: await live.unreadCount(null, userId) });
  }
}

module.exports = { notify, notifyMany, pushAnnouncement, NOTIFICATION_COLUMNS };
