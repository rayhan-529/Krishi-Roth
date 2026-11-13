/**
 * AI chatbot with saved conversation history (per user).
 */
const db = require("../config/db");
const v = require("../utils/validator");
const ApiError = require("../utils/ApiError");
const { send } = require("../utils/response");
const ai = require("../services/aiService");

const HISTORY_MESSAGES = 12; // earlier messages sent to the AI for context

const schemas = {
  send: {
    conversation_id: v.id(),
    message: v.string().required().min(2).max(2000),
    language: v.enum(["bn", "en"]).default("bn")
  }
};

async function status(req, res) {
  send(req, res, { data: ai.status() });
}

async function conversations(req, res) {
  const [rows] = await db.query(
    `SELECT c.id, c.title, c.language, c.created_at, c.updated_at,
            (SELECT COUNT(*) FROM chatbot_messages m WHERE m.conversation_id = c.id) AS message_count
     FROM chatbot_conversations c WHERE c.user_id = ? ORDER BY c.updated_at DESC LIMIT 50`,
    [req.user.id]
  );
  send(req, res, { data: rows });
}

async function findOwn(req, id) {
  const [rows] = await db.query("SELECT * FROM chatbot_conversations WHERE id = ? AND user_id = ?", [id, req.user.id]);
  if (!rows[0]) throw ApiError.notFound("কথোপকথনটি পাওয়া যায়নি।", "Conversation not found.");
  return rows[0];
}

async function messages(req, res) {
  const conversation = await findOwn(req, req.params.id);
  const [rows] = await db.query(
    "SELECT id, role, content, created_at FROM chatbot_messages WHERE conversation_id = ? ORDER BY id",
    [conversation.id]
  );
  send(req, res, { data: { conversation, messages: rows } });
}

async function remove(req, res) {
  const conversation = await findOwn(req, req.params.id);
  await db.query("DELETE FROM chatbot_conversations WHERE id = ?", [conversation.id]);
  send(req, res, { message: ["কথোপকথন মুছে ফেলা হয়েছে।", "Conversation deleted."] });
}

const AI_ERRORS = {
  not_configured: [503, "এআই চ্যাটবট এখনো চালু করা হয়নি (API key দেওয়া নেই)। অ্যাডমিনকে জানান।", "The AI chatbot is not configured yet (no API key). Please tell the administrator."],
  rate_limited: [503, "এআই সেবা এখন ব্যস্ত। এক মিনিট পর আবার চেষ্টা করুন।", "The AI service is busy. Please try again in a minute."],
  auth: [503, "এআই সেবার API key সঠিক নয়। অ্যাডমিনকে জানান।", "The AI service key is not valid. Please tell the administrator."],
  blocked: [422, "এই প্রশ্নের উত্তর দেওয়া যায়নি। প্রশ্নটি অন্যভাবে লিখে দেখুন।", "This question could not be answered. Please try asking differently."],
  failed: [502, "এআই সেবা থেকে উত্তর পাওয়া যায়নি। আবার চেষ্টা করুন।", "No answer from the AI service. Please try again."]
};

/** Sends the user's question to the AI and saves both messages. */
async function sendMessage(req, res) {
  const { message, language } = req.body;

  if (!ai.status().configured) {
    const [status, bn, en] = AI_ERRORS.not_configured;
    throw new ApiError(status, bn, en);
  }

  let conversation = null;
  let history = [];
  if (req.body.conversation_id) {
    conversation = await findOwn(req, req.body.conversation_id);
    const [rows] = await db.query(
      "SELECT role, content FROM chatbot_messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?",
      [conversation.id, HISTORY_MESSAGES]
    );
    history = rows.reverse();
  }

  let reply;
  try {
    reply = await ai.generateReply([...history, { role: "user", content: message }], language);
  } catch (error) {
    if (!(error instanceof ai.AiError)) throw error;
    console.error(`AI ${error.kind}: ${error.message}`);
    const [status, bn, en] = AI_ERRORS[error.kind] || AI_ERRORS.failed;
    throw new ApiError(status, bn, en);
  }

  if (!conversation) {
    const title = message.replace(/\s+/g, " ").slice(0, 80);
    const [result] = await db.query("INSERT INTO chatbot_conversations (user_id, title, language) VALUES (?, ?, ?)", [
      req.user.id,
      title,
      language
    ]);
    conversation = { id: result.insertId, title, language };
  }

  await db.query("INSERT INTO chatbot_messages (conversation_id, role, content) VALUES (?, 'user', ?)", [
    conversation.id,
    message
  ]);
  const [saved] = await db.query(
    "INSERT INTO chatbot_messages (conversation_id, role, content, provider, model) VALUES (?, 'assistant', ?, ?, ?)",
    [conversation.id, reply.text, reply.provider, reply.model]
  );
  await db.query("UPDATE chatbot_conversations SET updated_at = NOW() WHERE id = ?", [conversation.id]);

  send(req, res, {
    data: {
      conversation_id: conversation.id,
      title: conversation.title,
      reply: { id: saved.insertId, role: "assistant", content: reply.text, created_at: new Date().toISOString() }
    }
  });
}

module.exports = { schemas, status, conversations, messages, remove, sendMessage };
