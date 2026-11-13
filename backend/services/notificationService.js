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
 */
const db = require("../config/db");

async function notify(conn, userId, { type, title, body = null, link = null, entityType = null, entityId = null }) {
  const [titleBn, titleEn] = title;
  const [bodyBn, bodyEn] = body || [null, null];

  await (conn || db).query(
    `INSERT INTO notifications (user_id, type, title, body, link, entity_type, entity_id)
     SELECT id, ?,
            IF(preferred_language = 'en', ?, ?),
            IF(preferred_language = 'en', ?, ?),
            ?, ?, ?
     FROM users WHERE id = ?`,
    [type, titleEn || titleBn, titleBn, bodyEn || bodyBn, bodyBn, link, entityType, entityId, userId]
  );
}

/** Sends the same notification to several users. */
async function notifyMany(conn, userIds, payload) {
  for (const userId of new Set(userIds)) {
    await notify(conn, userId, payload);
  }
}

module.exports = { notify, notifyMany };
