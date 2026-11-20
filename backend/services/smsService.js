/**
 * Sends SMS through a Bangladeshi bulk-SMS gateway (for two-step codes).
 *
 *   SMS_PROVIDER=alpha       Alpha SMS   (https://sms.net.bd)
 *   SMS_PROVIDER=bulksmsbd   BulkSMSBD   (https://bulksmsbd.net)
 *   SMS_API_KEY=...          from the provider's dashboard
 *   SMS_SENDER_ID=...        optional (needed by some BulkSMSBD accounts)
 *
 * With no SMS_API_KEY, SMS is switched off and nothing is sent.
 */
const { config } = require("../config/env");
const ApiError = require("../utils/ApiError");

function isConfigured() {
  return Boolean(config.sms.apiKey);
}

/** 01XXXXXXXXX -> 8801XXXXXXXXX (the format both gateways expect). */
function toInternational(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (/^8801\d{9}$/.test(digits)) return digits;
  if (/^01\d{9}$/.test(digits)) return `88${digits}`;
  return null;
}

async function postForm(url, fields) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
    signal: AbortSignal.timeout(15000)
  });
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    // some gateways answer plain text
  }
  return { status: response.status, body, text };
}

async function sendViaAlpha(to, message) {
  const result = await postForm("https://api.sms.net.bd/sendsms", { api_key: config.sms.apiKey, msg: message, to });
  // Success: { "error": 0, "msg": "Request successfully submitted", ... }
  if (result.body && Number(result.body.error) === 0) return;
  throw new Error(`Alpha SMS: ${(result.body && result.body.msg) || result.text.slice(0, 200)}`);
}

async function sendViaBulkSmsBd(to, message) {
  const fields = { api_key: config.sms.apiKey, type: "text", number: to, message };
  if (config.sms.senderId) fields.senderid = config.sms.senderId;
  const result = await postForm("https://bulksmsbd.net/api/smsapi", fields);
  // Success: { "response_code": 202, "success_message": "SMS Submitted Successfully", ... }
  if (result.body && Number(result.body.response_code) === 202) return;
  throw new Error(`BulkSMSBD: ${(result.body && (result.body.error_message || result.body.response_code)) || result.text.slice(0, 200)}`);
}

/**
 * @param {string} phone  Bangladeshi mobile number
 * @param {string} message plain text (keep it short: one SMS is 160 English / 70 Bengali characters)
 */
async function sendSms(phone, message) {
  if (!isConfigured()) {
    throw ApiError.unavailable("SMS সার্ভিস এখনো চালু করা হয়নি।", "SMS is not set up on the server yet.");
  }
  const to = toInternational(phone);
  if (!to) throw ApiError.badRequest("মোবাইল নম্বরটি সঠিক নয়।", "The mobile number is not valid.");

  try {
    if (config.sms.provider === "bulksmsbd") await sendViaBulkSmsBd(to, message);
    else await sendViaAlpha(to, message);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.error("[sms] Sending failed:", err.message);
    throw ApiError.unavailable(
      "এখন SMS পাঠানো যাচ্ছে না। একটু পরে আবার চেষ্টা করুন।",
      "Could not send the SMS right now. Please try again shortly."
    );
  }
}

module.exports = { isConfigured, sendSms, toInternational };
