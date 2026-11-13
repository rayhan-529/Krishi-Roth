/**
 * Buyer <-> farmer messages about a listing ("Contact the seller").
 * A buyer starts a conversation from a listing; after that both sides reply.
 */
const db = require("../config/db");
const v = require("../utils/validator");
const ApiError = require("../utils/ApiError");
const { send } = require("../utils/response");
const { withTransaction } = require("../services/transaction");
const { notify } = require("../services/notificationService");

const schemas = {
  start: { listing_id: v.id().required(), body: v.string().required().max(2000) },
  reply: { body: v.string().required().max(2000) }
};

async function start(req, res) {
  const { listing_id: listingId, body } = req.body;

  const conversationId = await withTransaction(async (conn) => {
    const [rows] = await conn.query(
      `SELECT l.id, l.farmer_id, l.status, u.is_blocked FROM crop_listings l JOIN users u ON u.id = l.farmer_id
       WHERE l.id = ?`,
      [listingId]
    );
    const listing = rows[0];
    if (!listing || listing.status === "removed" || listing.is_blocked) {
      throw ApiError.notFound("বিজ্ঞাপনটি পাওয়া যায়নি।", "Listing not found.");
    }
    if (listing.farmer_id === req.user.id) throw ApiError.forbidden();

    await conn.query(
      `INSERT INTO conversations (listing_id, farmer_id, buyer_id, last_message_at) VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE last_message_at = NOW()`,
      [listing.id, listing.farmer_id, req.user.id]
    );
    const [[conversation]] = await conn.query(
      "SELECT id FROM conversations WHERE listing_id = ? AND farmer_id = ? AND buyer_id = ?",
      [listing.id, listing.farmer_id, req.user.id]
    );

    await conn.query("INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)", [
      conversation.id,
      req.user.id,
      body
    ]);
    await notify(conn, listing.farmer_id, {
      type: "message",
      title: [`${req.user.name} আপনাকে বার্তা পাঠিয়েছেন`, `New message from ${req.user.name}`],
      body: [body.slice(0, 200), body.slice(0, 200)],
      link: `/messages/${conversation.id}`,
      entityType: "conversation",
      entityId: conversation.id
    });
    return conversation.id;
  });

  send(req, res, { status: 201, message: ["বার্তা পাঠানো হয়েছে।", "Message sent."], data: { conversation_id: conversationId } });
}

async function list(req, res) {
  const [rows] = await db.query(
    `SELECT cv.id, cv.listing_id, cv.farmer_id, cv.buyer_id, cv.last_message_at,
            c.name_bn AS crop_bn, c.name_en AS crop_en,
            IF(cv.farmer_id = ?, b.name, f.name) AS other_name,
            IF(cv.farmer_id = ?, b.id, f.id) AS other_id,
            IF(cv.farmer_id = ?, b.profile_photo, f.profile_photo) AS other_photo,
            (SELECT m.body FROM messages m WHERE m.conversation_id = cv.id ORDER BY m.id DESC LIMIT 1) AS last_message,
            (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = cv.id AND m.sender_id <> ? AND m.read_at IS NULL) AS unread
     FROM conversations cv
     JOIN users f ON f.id = cv.farmer_id
     JOIN users b ON b.id = cv.buyer_id
     LEFT JOIN crop_listings l ON l.id = cv.listing_id
     LEFT JOIN crops c ON c.id = l.crop_id
     WHERE cv.farmer_id = ? OR cv.buyer_id = ?
     ORDER BY cv.last_message_at DESC
     LIMIT 100`,
    [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id]
  );
  send(req, res, { data: rows });
}

async function findConversation(conn, req) {
  const [rows] = await conn.query(
    `SELECT cv.*, f.name AS farmer_name, b.name AS buyer_name, c.name_bn AS crop_bn, c.name_en AS crop_en,
            l.status AS listing_status
     FROM conversations cv
     JOIN users f ON f.id = cv.farmer_id
     JOIN users b ON b.id = cv.buyer_id
     LEFT JOIN crop_listings l ON l.id = cv.listing_id
     LEFT JOIN crops c ON c.id = l.crop_id
     WHERE cv.id = ?`,
    [req.params.id]
  );
  const conversation = rows[0];
  if (!conversation || (conversation.farmer_id !== req.user.id && conversation.buyer_id !== req.user.id)) {
    throw ApiError.notFound("কথোপকথনটি পাওয়া যায়নি।", "Conversation not found.");
  }
  return conversation;
}

async function messages(req, res) {
  const conversation = await findConversation(db, req);

  await db.query(
    "UPDATE messages SET read_at = NOW() WHERE conversation_id = ? AND sender_id <> ? AND read_at IS NULL",
    [conversation.id, req.user.id]
  );
  const [rows] = await db.query(
    `SELECT id, sender_id, body, read_at, created_at FROM messages
     WHERE conversation_id = ? ORDER BY id DESC LIMIT 200`,
    [conversation.id]
  );

  send(req, res, { data: { conversation, messages: rows.reverse() } });
}

async function reply(req, res) {
  const conversation = await findConversation(db, req);
  const otherId = conversation.farmer_id === req.user.id ? conversation.buyer_id : conversation.farmer_id;

  const [blocked] = await db.query("SELECT is_blocked FROM users WHERE id = ?", [otherId]);
  if (blocked[0] && blocked[0].is_blocked) {
    throw ApiError.badRequest("এই ব্যবহারকারীকে এখন বার্তা পাঠানো যাবে না।", "You cannot message this user now.");
  }

  const [result] = await db.query("INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)", [
    conversation.id,
    req.user.id,
    req.body.body
  ]);
  await db.query("UPDATE conversations SET last_message_at = NOW() WHERE id = ?", [conversation.id]);

  await notify(null, otherId, {
    type: "message",
    title: [`${req.user.name} আপনাকে বার্তা পাঠিয়েছেন`, `New message from ${req.user.name}`],
    body: [req.body.body.slice(0, 200), req.body.body.slice(0, 200)],
    link: `/messages/${conversation.id}`,
    entityType: "conversation",
    entityId: conversation.id
  });

  const [[message]] = await db.query("SELECT id, sender_id, body, read_at, created_at FROM messages WHERE id = ?", [result.insertId]);
  send(req, res, { status: 201, data: message });
}

module.exports = { schemas, start, list, messages, reply };
