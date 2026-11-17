/**
 * Webhook for the SMS-forwarder app (automatic "Add balance" verification).
 *
 *   POST /api/wallet-sms?key=WALLET_SMS_SECRET
 *   body (JSON or form): { "from": "bKash", "text": "You have received Tk 500.00 ..." }
 *
 * Field names differ between forwarder apps, so several common names are accepted.
 * Without the right key the endpoint answers 404, as if it did not exist.
 */
const crypto = require("crypto");
const db = require("../config/db");
const { config } = require("../config/env");
const { send } = require("../utils/response");
const ApiError = require("../utils/ApiError");
const { withTransaction } = require("../services/transaction");
const { parsePaymentSms, matchSms } = require("../services/smsPaymentService");

const TEXT_FIELDS = ["text", "message", "body", "content", "msg", "sms"];
const FROM_FIELDS = ["from", "sender", "address", "phone", "number", "originatingAddress"];

function pick(source, names) {
  for (const name of names) {
    if (source && source[name] !== undefined && source[name] !== null && String(source[name]).trim()) {
      return String(source[name]);
    }
  }
  return "";
}

function keyMatches(given) {
  const secret = config.wallet.smsSecret;
  if (!secret || !given) return false;
  const a = Buffer.from(crypto.createHash("sha256").update(String(given)).digest("hex"));
  const b = Buffer.from(crypto.createHash("sha256").update(secret).digest("hex"));
  return crypto.timingSafeEqual(a, b);
}

async function receive(req, res) {
  if (!keyMatches(req.get("x-webhook-key") || req.query.key)) throw ApiError.notFound();

  const body = req.body || {};
  const from = pick(body, FROM_FIELDS) || pick(req.query, FROM_FIELDS);
  const text = pick(body, TEXT_FIELDS) || pick(req.query, TEXT_FIELDS);
  const payment = parsePaymentSms(from, text);

  // Not a payment SMS (OTP, offer, money sent out, unknown sender): accept and ignore.
  if (!payment) return send(req, res, { data: { payment: false } });

  const result = await withTransaction(async (conn) => {
    const [inserted] = await conn.query(
      `INSERT IGNORE INTO wallet_sms (method, amount, sender_number, trx_id, sms_from, raw_text)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [payment.method, payment.amount, payment.senderNumber, payment.trxId, from.slice(0, 40), text.slice(0, 1000)]
    );
    // The same SMS forwarded twice is stored once.
    if (inserted.affectedRows === 0) return { duplicate: true, matched: false };
    return { duplicate: false, matched: await matchSms(conn, inserted.insertId) };
  });

  console.log(
    `[wallet-sms] ${payment.method} ৳${payment.amount} TrxID ${payment.trxId}` +
      (result.duplicate ? " (duplicate)" : result.matched ? " -> deposit auto-approved" : " -> waiting for a matching request")
  );
  send(req, res, { data: { payment: true, ...result } });
}

/** For the admin page: is auto-verification on, and when did the last SMS arrive? */
async function status() {
  const [[last]] = await db.query("SELECT MAX(created_at) AS last_sms_at, COUNT(*) AS total FROM wallet_sms");
  return { enabled: Boolean(config.wallet.smsSecret), last_sms_at: last.last_sms_at, total: Number(last.total) };
}

module.exports = { receive, status };
