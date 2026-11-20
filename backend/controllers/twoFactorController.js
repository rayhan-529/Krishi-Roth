/**
 * Two-step verification endpoints.
 *
 * Login (password or Google/Apple) calls completeLogin(): when 2FA is on and
 * the device is not trusted, no token is issued yet; the browser gets a
 * challenge, the user enters the code, and /auth/login/verify finishes it.
 */
const db = require("../config/db");
const v = require("../utils/validator");
const ApiError = require("../utils/ApiError");
const { send } = require("../utils/response");
const { USER_COLUMNS } = require("../middleware/auth");
const { issueToken } = require("../services/tokenService");
const { logActivity } = require("../services/activityService");
const twoFactor = require("../services/twoFactorService");

// authController requires this file, so it is loaded lazily to avoid a require cycle.
const publicUser = (user) => require("./authController").toPublicUser(user);

const codeRule = () =>
  v.string().required().pattern(/^\d{6}$/, { bn: "6 সংখ্যার কোড দিন।", en: "Enter the 6-digit code." });

const schemas = {
  verifyLogin: { challenge: v.string().required().max(100), code: codeRule(), remember_device: v.boolean().default(false) },
  resendLogin: { challenge: v.string().required().max(100) },
  sendCode: {
    purpose: v.enum(["enable_2fa", "disable_2fa", "withdraw", "password_change"]).required(),
    method: v.enum(["email", "sms"])
  },
  enable: { method: v.enum(["email", "sms"]).required(), code: codeRule() },
  disable: { code: codeRule() }
};

function assertNotBlocked(user) {
  if (user.is_blocked) {
    throw ApiError.forbidden(
      "আপনার অ্যাকাউন্টটি বন্ধ করা হয়েছে। অ্যাডমিনের সঙ্গে যোগাযোগ করুন।",
      "Your account has been blocked. Please contact the administrator."
    );
  }
}

async function issueSession(req, res, user, action, extra = {}) {
  await db.query("UPDATE users SET last_login_at = NOW() WHERE id = ?", [user.id]);
  req.user = user;
  await logActivity(req, action, "user", user.id);
  send(req, res, {
    message: ["লগইন সফল হয়েছে।", "Logged in successfully."],
    data: { ...(await issueToken(user, req)), user: publicUser(user), ...extra }
  });
}

/**
 * Finishes a password / Google / Apple login: either issues the token or,
 * when two-step verification is needed, sends the code and returns a challenge.
 */
async function completeLogin(req, res, user, action) {
  assertNotBlocked(user);
  const settings = await twoFactor.getSettings(user.id);
  const deviceToken = req.body.device_token || req.get("x-device-token");
  if (settings.enabled && !(await twoFactor.isTrustedDevice(user.id, deviceToken))) {
    const challenge = await twoFactor.startLoginChallenge(user.id);
    req.user = user;
    await logActivity(req, `${action}_2fa_sent`, "user", user.id);
    return send(req, res, {
      message: ["যাচাই কোড পাঠানো হয়েছে।", "We sent you a verification code."],
      data: { two_factor_required: true, ...challenge }
    });
  }
  return issueSession(req, res, user, action);
}

async function verifyLogin(req, res) {
  const { challenge, code, remember_device: remember } = req.body;
  const userId = await twoFactor.verifyLoginChallenge(challenge, code);
  const [[user]] = await db.query(`SELECT ${USER_COLUMNS} FROM users u WHERE u.id = ?`, [userId]);
  assertNotBlocked(user);
  const extra = remember ? { device_token: await twoFactor.trustDevice(user.id, req) } : {};
  await issueSession(req, res, user, "user.login_2fa", extra);
}

async function resendLogin(req, res) {
  const channel = await twoFactor.resendLoginChallenge(req.body.challenge);
  send(req, res, { message: ["নতুন কোড পাঠানো হয়েছে।", "A new code was sent."], data: channel });
}

// ------------------------------------------------------------ settings (logged in)
async function status(req, res) {
  const s = await twoFactor.getSettings(req.user.id);
  const [devices] = await db.query(
    `SELECT id, label, ip_address, last_used_at, created_at, expires_at FROM trusted_devices
     WHERE user_id = ? AND expires_at > NOW() ORDER BY COALESCE(last_used_at, created_at) DESC`,
    [req.user.id]
  );
  send(req, res, {
    data: {
      enabled: s.enabled,
      forced: s.forced,
      method: s.method,
      sms_available: s.smsAvailable,
      email: twoFactor.maskEmail(s.user.email),
      phone: twoFactor.maskPhone(s.user.phone),
      trust_days: twoFactor.TRUST_DAYS,
      devices
    }
  });
}

async function sendCode(req, res) {
  const { purpose, method } = req.body;
  const s = await twoFactor.getSettings(req.user.id);
  if (purpose === "enable_2fa" && method === "sms" && !s.smsAvailable) {
    throw ApiError.badRequest("SMS এখন চালু নেই। ইমেইল বেছে নিন।", "SMS is not available right now. Choose email.");
  }
  if (purpose === "disable_2fa" && s.forced) {
    throw ApiError.forbidden("অ্যাডমিনের জন্য টু-স্টেপ বন্ধ করা যায় না।", "Two-step verification cannot be turned off for admins.");
  }
  const channel = await twoFactor.sendCode(req.user.id, purpose, { method: purpose === "enable_2fa" ? method : undefined });
  send(req, res, {
    message: [`কোড পাঠানো হয়েছে: ${channel.destination}`, `Code sent to ${channel.destination}`],
    data: { ...channel, expires_in_minutes: twoFactor.CODE_MINUTES }
  });
}

async function enable(req, res) {
  const { method, code } = req.body;
  const s = await twoFactor.getSettings(req.user.id);
  if (method === "sms" && !s.smsAvailable) {
    throw ApiError.badRequest("SMS এখন চালু নেই। ইমেইল বেছে নিন।", "SMS is not available right now. Choose email.");
  }
  // The code was sent through the chosen method, so it also proves that method works.
  await twoFactor.verifyCode(req.user.id, "enable_2fa", code);
  await db.query("UPDATE users SET two_factor_enabled = 1, two_factor_method = ? WHERE id = ?", [method, req.user.id]);
  // This device was just verified, so trust it.
  const deviceToken = await twoFactor.trustDevice(req.user.id, req);
  await logActivity(req, "user.2fa_enable", "user", req.user.id, method);
  send(req, res, {
    message: ["টু-স্টেপ ভেরিফিকেশন চালু হয়েছে।", "Two-step verification is on."],
    data: { enabled: true, method, device_token: deviceToken }
  });
}

async function disable(req, res) {
  const s = await twoFactor.getSettings(req.user.id);
  if (s.forced) {
    throw ApiError.forbidden("অ্যাডমিনের জন্য টু-স্টেপ বন্ধ করা যায় না।", "Two-step verification cannot be turned off for admins.");
  }
  await twoFactor.verifyCode(req.user.id, "disable_2fa", req.body.code);
  await db.query("UPDATE users SET two_factor_enabled = 0 WHERE id = ?", [req.user.id]);
  await db.query("DELETE FROM trusted_devices WHERE user_id = ?", [req.user.id]);
  await logActivity(req, "user.2fa_disable", "user", req.user.id);
  send(req, res, { message: ["টু-স্টেপ ভেরিফিকেশন বন্ধ হয়েছে।", "Two-step verification is off."], data: { enabled: false } });
}

async function removeDevice(req, res) {
  const [result] = await db.query("DELETE FROM trusted_devices WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
  if (!result.affectedRows) throw ApiError.notFound();
  send(req, res, { message: ["ডিভাইসটি সরানো হয়েছে।", "Device removed."] });
}

module.exports = { schemas, completeLogin, verifyLogin, resendLogin, status, sendCode, enable, disable, removeDevice };
