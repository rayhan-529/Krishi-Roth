/**
 * Automatic "Add balance" verification from payment SMS.
 *
 * An SMS-forwarder app on the phone that holds the platform's bKash/Nagad/
 * Rocket SIM posts every incoming SMS to /api/wallet-sms. We keep only real
 * "money received" messages from the official senders, read the amount,
 * sender number and TrxID, and approve the pending deposit that has the same
 * method + TrxID + amount. Anything that does not match stays for an admin.
 *
 * Example messages:
 *   bKash:  You have received Tk 500.00 from 01712345678. Ref 12. Fee Tk 0.00. Balance Tk 1,500.00. TrxID 9ABC1D2E3F at 18/11/2026 10:30
 *   Nagad:  Money Received. Amount: Tk 500.00 Sender: 01712345678 Ref: N/A TxnID: 7ABCD123 Balance: Tk 1,000.00 18/11/2026 10:30
 *   Rocket: Tk500.00 received from A/C:017123456781 Fee:Tk0, Your A/C Balance: Tk1,000.00 TxnId:1234567890 Date:18-NOV-26 10:30:00 am.
 */
const wallet = require("./walletService");
const { notify } = require("./notificationService");

/** Official SMS sender ids. A normal phone cannot send from these names. */
const SENDERS = {
  bkash: /^bkash$/i,
  nagad: /^nagad$/i,
  rocket: /^(16216|rocket)$/i
};

/**
 * The method comes ONLY from the official sender id. A message without a sender
 * id is ignored: anyone can type a "You have received Tk ..." text from a normal
 * phone, so the text itself is never trusted.
 */
function detectMethod(from) {
  const sender = String(from || "").replace(/[\s+-]/g, "");
  for (const [method, pattern] of Object.entries(SENDERS)) {
    if (pattern.test(sender)) return method;
  }
  return null;
}

/**
 * @returns {{ method, amount, senderNumber, trxId } | null} null when it is not an incoming payment SMS
 */
function parsePaymentSms(from, rawText) {
  const text = String(rawText || "").replace(/\s+/g, " ").trim();
  if (!text) return null;

  const method = detectMethod(from);
  if (!method) return null;

  // Only money coming IN. "Send money" confirmations, OTPs, offers are ignored.
  if (!/(you have received|money received|received from|cash in)/i.test(text)) return null;

  const trx = text.match(/\b(?:trx\s*id|txn\s*id|transaction\s*id)\s*[:.]?\s*([A-Z0-9]{6,20})\b/i);
  const amount =
    text.match(/amount\s*:?\s*tk\.?\s*([\d,]+(?:\.\d{1,2})?)/i) ||
    text.match(/(?:received|cash in)\s*(?:of\s*)?tk\.?\s*([\d,]+(?:\.\d{1,2})?)/i) ||
    text.match(/tk\.?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:has been\s*)?received/i);
  if (!trx || !amount) return null;

  const sender = text.match(/(?:from|sender\s*:?)\s*(?:a\/c\s*:?\s*)?(\+?88)?(01\d{9,10})/i);
  const value = Number(amount[1].replace(/,/g, ""));
  if (!(value > 0)) return null;

  return {
    method,
    amount: wallet.MONEY(value),
    senderNumber: sender ? sender[2] : null,
    trxId: trx[1].toUpperCase()
  };
}

/**
 * Approves a pending deposit with a matching SMS. Both rows must already be
 * locked or freshly read inside `conn` (a transaction). Returns true when approved.
 */
async function approveIfMatching(conn, deposit, sms) {
  if (!deposit || !sms || deposit.status !== "pending" || sms.matched_deposit_id) return false;
  if (deposit.method !== sms.method || deposit.trx_id.toUpperCase() !== sms.trx_id.toUpperCase()) return false;
  if (wallet.MONEY(deposit.amount) !== wallet.MONEY(sms.amount)) return false;

  await conn.query(
    "UPDATE wallet_deposits SET status = 'approved', admin_note = ?, reviewed_by = NULL, reviewed_at = NOW() WHERE id = ?",
    ["Auto-verified by SMS", deposit.id]
  );
  await conn.query("UPDATE wallet_sms SET matched_deposit_id = ? WHERE id = ?", [deposit.id, sms.id]);
  await wallet.creditDeposit(conn, deposit, null);
  await notify(conn, deposit.user_id, {
    type: "announcement",
    title: [`৳${wallet.MONEY(deposit.amount)} আপনার ওয়ালেটে যোগ হয়েছে`, `৳${wallet.MONEY(deposit.amount)} was added to your wallet`],
    body: ["পেমেন্ট স্বয়ংক্রিয়ভাবে যাচাই হয়েছে।", "Your payment was verified automatically."],
    link: "/wallet"
  });
  return true;
}

/** After a deposit request: approve it at once if the SMS already arrived. */
async function matchDeposit(conn, depositId) {
  const [[deposit]] = await conn.query("SELECT * FROM wallet_deposits WHERE id = ? FOR UPDATE", [depositId]);
  if (!deposit) return false;
  const [[sms]] = await conn.query(
    "SELECT * FROM wallet_sms WHERE method = ? AND trx_id = ? AND matched_deposit_id IS NULL FOR UPDATE",
    [deposit.method, deposit.trx_id.toUpperCase()]
  );
  return approveIfMatching(conn, deposit, sms);
}

/** After an SMS arrives: approve the waiting deposit with the same TrxID, if any. */
async function matchSms(conn, smsId) {
  const [[sms]] = await conn.query("SELECT * FROM wallet_sms WHERE id = ? FOR UPDATE", [smsId]);
  if (!sms) return false;
  const [[deposit]] = await conn.query(
    "SELECT * FROM wallet_deposits WHERE method = ? AND trx_id = ? AND status = 'pending' FOR UPDATE",
    [sms.method, sms.trx_id]
  );
  return approveIfMatching(conn, deposit, sms);
}

module.exports = { parsePaymentSms, matchDeposit, matchSms };
