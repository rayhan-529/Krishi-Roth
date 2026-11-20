/**
 * Two-step verification (2FA).
 *
 * When it is on (optional; required for admins when ADMIN_REQUIRE_2FA=true), a code is needed for:
 *   - signing in from a device that is not trusted yet  (purpose "login_2fa")
 *   - withdrawing money from the wallet                 (purpose "withdraw")
 *   - changing the password                             (purpose "password_change")
 * Codes go by SMS when the user chose SMS and SMS is set up, otherwise by email.
 * "Remember this device" stores a random token in the browser so that device
 * skips the login code for TRUST_DAYS days.
 */
const crypto = require("crypto");
const db = require("../config/db");
const ApiError = require("../utils/ApiError");
const sms = require("./smsService");
const mail = require("./mailService");
const { config } = require("../config/env");

const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_SECONDS = 45;
const TRUST_DAYS = 90;

const sha256 = (text) => crypto.createHash("sha256").update(String(text)).digest("hex");
const newCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, "0");

function maskEmail(email) {
  if (!email) return null;
  const [name, domain] = email.split("@");
  return `${name.slice(0, 2)}${"*".repeat(Math.max(1, name.length - 2))}@${domain}`;
}

function maskPhone(phone) {
  if (!phone) return null;
  return `${phone.slice(0, 3)}*****${phone.slice(-3)}`;
}

/** The user's 2FA settings plus what is needed to send a code. */
async function getSettings(userId, conn = db) {
  const [[u]] = await conn.query(
    "SELECT id, name, email, phone, role, preferred_language, two_factor_enabled, two_factor_method FROM users WHERE id = ?",
    [userId]
  );
  if (!u) return null;
  // Admins can be required to use 2FA with ADMIN_REQUIRE_2FA=true.
  const forced = u.role === "admin" && config.adminRequire2fa;
  return {
    user: u,
    forced,
    enabled: forced || Boolean(u.two_factor_enabled),
    method: u.two_factor_method,
    smsAvailable: sms.isConfigured() && Boolean(u.phone)
  };
}

/** Where the code will actually go: the chosen method when possible, else the other one. */
function pickChannel(settings, preferred = settings.method) {
  const { user } = settings;
  if (preferred === "sms" && settings.smsAvailable) return { method: "sms", destination: maskPhone(user.phone) };
  if (user.email) return { method: "email", destination: maskEmail(user.email) };
  if (settings.smsAvailable) return { method: "sms", destination: maskPhone(user.phone) };
  throw ApiError.badRequest(
    "কোড পাঠানোর জন্য প্রোফাইলে একটি ইমেইল দিন।",
    "Add an email address to your profile so we can send you a code."
  );
}

async function deliver(settings, channel, code, purpose) {
  const { user } = settings;
  if (channel.method === "sms") {
    const [whatBn, whatEn] = mail.PURPOSE_TEXT[purpose] || ["যাচাই", "verification"];
    const text = user.preferred_language === "en"
      ? `Krishi Roth code: ${code} (${whatEn}). Valid ${CODE_MINUTES} min. Never share it.`
      : `কৃষি রথ কোড: ${code} (${whatBn})। ${CODE_MINUTES} মিনিট কার্যকর। কাউকে বলবেন না।`;
    await sms.sendSms(user.phone, text);
  } else {
    await mail.sendSecurityCode(user, code, CODE_MINUTES, purpose);
  }
}

function tooSoon() {
  return ApiError.badRequest(
    `কিছুক্ষণ আগে কোড পাঠানো হয়েছে। ${RESEND_SECONDS} সেকেন্ড পর আবার চেষ্টা করুন।`,
    `A code was just sent. Please wait ${RESEND_SECONDS} seconds before asking again.`
  );
}

/**
 * Creates a code, replaces any earlier unused one of the same purpose, and sends it.
 * @param {object} [options] { method: preferred channel, challengeHash: ties a login code to one login try }
 * @returns {Promise<{ method: "email"|"sms", destination: string }>}
 */
async function sendCode(userId, purpose, options = {}) {
  const settings = await getSettings(userId);
  if (!settings) throw ApiError.notFound();
  const channel = pickChannel(settings, options.method);

  const [recent] = await db.query(
    `SELECT 1 FROM auth_codes WHERE user_id = ? AND purpose = ? AND used_at IS NULL
       AND created_at > DATE_SUB(NOW(), INTERVAL ? SECOND) LIMIT 1`,
    [userId, purpose, RESEND_SECONDS]
  );
  if (recent.length) throw tooSoon();

  const code = newCode();
  await db.query("UPDATE auth_codes SET used_at = NOW() WHERE user_id = ? AND purpose = ? AND used_at IS NULL", [userId, purpose]);
  await db.query(
    `INSERT INTO auth_codes (user_id, purpose, code_hash, challenge_hash, expires_at)
     VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
    [userId, purpose, sha256(`${userId}:${purpose}:${code}`), options.challengeHash || null, CODE_MINUTES]
  );
  await deliver(settings, channel, code, purpose);
  return channel;
}

function invalidCode() {
  const message = { bn: "কোডটি সঠিক নয় বা মেয়াদ শেষ।", en: "The code is wrong or has expired." };
  return ApiError.badRequest(message.bn, message.en, { code: message });
}

/** Checks and uses up a code. Throws when it is wrong, expired or used. */
async function verifyCode(userId, purpose, code, conn = db, challengeHash = null) {
  if (!/^\d{6}$/.test(String(code || ""))) throw invalidCode();
  const [[row]] = await conn.query(
    `SELECT id, code_hash, attempts FROM auth_codes
     WHERE user_id = ? AND purpose = ? AND used_at IS NULL AND expires_at > NOW()
       AND (? IS NULL OR challenge_hash = ?)
     ORDER BY id DESC LIMIT 1 FOR UPDATE`,
    [userId, purpose, challengeHash, challengeHash]
  );
  if (!row) throw invalidCode();

  const expected = Buffer.from(row.code_hash, "hex");
  const given = Buffer.from(sha256(`${userId}:${purpose}:${code}`), "hex");
  if (!crypto.timingSafeEqual(expected, given)) {
    const attempts = row.attempts + 1;
    await conn.query("UPDATE auth_codes SET attempts = ?, used_at = IF(? >= ?, NOW(), used_at) WHERE id = ?", [
      attempts, attempts, MAX_ATTEMPTS, row.id
    ]);
    throw invalidCode();
  }
  await conn.query("UPDATE auth_codes SET used_at = NOW() WHERE id = ?", [row.id]);
}

// ------------------------------------------------------------ login challenge
/** Starts a 2FA login: sends the code and returns the challenge the browser must send back. */
async function startLoginChallenge(userId) {
  const challenge = crypto.randomBytes(24).toString("base64url");
  const channel = await sendCode(userId, "login_2fa", { challengeHash: sha256(challenge) });
  return { challenge, ...channel, expires_in_minutes: CODE_MINUTES };
}

/** Finds the user of a still-open login challenge. */
async function userForChallenge(challenge) {
  const [[row]] = await db.query(
    `SELECT user_id FROM auth_codes WHERE challenge_hash = ? AND purpose = 'login_2fa' AND used_at IS NULL AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1`,
    [sha256(challenge)]
  );
  if (!row) {
    throw ApiError.badRequest("লগইনের সময় শেষ। আবার লগইন করুন।", "This sign-in has expired. Please log in again.");
  }
  return row.user_id;
}

/** Checks a login code against its challenge. Returns the user id. */
async function verifyLoginChallenge(challenge, code) {
  const userId = await userForChallenge(challenge);
  await verifyCode(userId, "login_2fa", code, db, sha256(challenge));
  return userId;
}

/** Resends a login code for the same challenge. */
async function resendLoginChallenge(challenge) {
  const userId = await userForChallenge(challenge);
  const channel = await sendCode(userId, "login_2fa", { challengeHash: sha256(challenge) });
  return channel;
}

// ------------------------------------------------------------ trusted devices
async function isTrustedDevice(userId, deviceToken) {
  if (!deviceToken || typeof deviceToken !== "string" || deviceToken.length > 200) return false;
  const [[row]] = await db.query(
    "SELECT id FROM trusted_devices WHERE user_id = ? AND token_hash = ? AND expires_at > NOW()",
    [userId, sha256(deviceToken)]
  );
  if (!row) return false;
  await db.query("UPDATE trusted_devices SET last_used_at = NOW() WHERE id = ?", [row.id]);
  return true;
}

function deviceLabel(userAgent = "") {
  const ua = String(userAgent);
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iPhone" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} · ${os}` : browser;
}

/** Remembers this browser; returns the token it must keep. */
async function trustDevice(userId, req) {
  const token = crypto.randomBytes(32).toString("base64url");
  await db.query(
    `INSERT INTO trusted_devices (user_id, token_hash, label, ip_address, last_used_at, expires_at)
     VALUES (?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? DAY))`,
    [userId, sha256(token), deviceLabel(req.get("user-agent")), (req.ip || "").slice(0, 45), TRUST_DAYS]
  );
  return token;
}

/** A code is needed for this action when 2FA is on. */
async function requireCodeFor(userId, purpose, code) {
  const settings = await getSettings(userId);
  if (!settings || !settings.enabled) return;
  if (!code) {
    const message = { bn: "যাচাই কোড দিন।", en: "Enter the verification code." };
    throw ApiError.badRequest(message.bn, message.en, { code: message });
  }
  await verifyCode(userId, purpose, code);
}

module.exports = {
  CODE_MINUTES,
  TRUST_DAYS,
  getSettings,
  pickChannel,
  maskEmail,
  maskPhone,
  sendCode,
  verifyCode,
  startLoginChallenge,
  userForChallenge,
  resendLoginChallenge,
  verifyLoginChallenge,
  isTrustedDevice,
  trustDevice,
  requireCodeFor
};
