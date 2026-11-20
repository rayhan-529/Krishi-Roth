/**
 * Extra ways to sign in, and password recovery:
 *   - forgot password: a 6-digit code is emailed, then a new password is set
 *   - email sign-in link: a one-time link logs the user in
 *   - Google / Apple sign-in (existing accounts log in; new ones go to registration)
 */
const crypto = require("crypto");
const db = require("../config/db");
const { config } = require("../config/env");
const v = require("../utils/validator");
const ApiError = require("../utils/ApiError");
const { send } = require("../utils/response");
const { checkPasswordStrength, BCRYPT_ROUNDS } = require("../utils/password");
const bcrypt = require("bcryptjs");
const { USER_COLUMNS } = require("../middleware/auth");
const { issueToken, revokeAllSessions } = require("../services/tokenService");
const { logActivity } = require("../services/activityService");
const { sendResetCode, sendLoginLink } = require("../services/mailService");
const { verifyIdToken, isEnabled } = require("../services/socialAuthService");
const { toPublicUser } = require("./authController");
const { completeLogin } = require("./twoFactorController");

const CODE_MINUTES = 15;
const LINK_MINUTES = 15;
const MAX_ATTEMPTS = 5;
const RESEND_SECONDS = 60;

const schemas = {
  email: { email: v.email().required() },
  resetPassword: {
    email: v.email().required(),
    code: v.string().required().pattern(/^\d{6}$/, { bn: "6 সংখ্যার কোড দিন।", en: "Enter the 6-digit code." }),
    new_password: v.string().required()
  },
  loginLink: { token: v.string().required().max(200) },
  social: {
    provider: v.enum(["google", "apple"]).required(),
    id_token: v.string().required().max(5000),
    device_token: v.string().max(200)
  }
};

const sha256 = (text) => crypto.createHash("sha256").update(text).digest("hex");

/** Same reply whether or not the email belongs to an account (no account discovery). */
const SENT_MESSAGE = [
  "এই ইমেইলে অ্যাকাউন্ট থাকলে আমরা একটি ইমেইল পাঠিয়েছি। ইনবক্স ও স্প্যাম ফোল্ডার দেখুন।",
  "If an account uses this email, we have sent a message. Check your inbox and spam folder."
];

async function findByEmail(email) {
  const [rows] = await db.query(`SELECT ${USER_COLUMNS} FROM users u WHERE u.email = ? LIMIT 1`, [email]);
  return rows[0] || null;
}

/** True when a code of this purpose was sent to the user less than a minute ago. */
async function sentRecently(userId, purpose) {
  const [rows] = await db.query(
    `SELECT 1 FROM auth_codes
     WHERE user_id = ? AND purpose = ? AND created_at > DATE_SUB(NOW(), INTERVAL ? SECOND) LIMIT 1`,
    [userId, purpose, RESEND_SECONDS]
  );
  return rows.length > 0;
}

/** Replaces any earlier unused code of the same purpose with a new one. */
async function storeCode(userId, purpose, hash, minutes) {
  await db.query("UPDATE auth_codes SET used_at = NOW() WHERE user_id = ? AND purpose = ? AND used_at IS NULL", [userId, purpose]);
  await db.query(
    "INSERT INTO auth_codes (user_id, purpose, code_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))",
    [userId, purpose, hash, minutes]
  );
}

function assertNotBlocked(user) {
  if (user.is_blocked) {
    throw ApiError.forbidden(
      "আপনার অ্যাকাউন্টটি বন্ধ করা হয়েছে। অ্যাডমিনের সঙ্গে যোগাযোগ করুন।",
      "Your account has been blocked. Please contact the administrator."
    );
  }
}

/** Logs the user in and sends the usual { token, user } reply. */
async function finishLogin(req, res, user, action) {
  assertNotBlocked(user);
  await db.query("UPDATE users SET last_login_at = NOW() WHERE id = ?", [user.id]);
  req.user = user;
  await logActivity(req, action, "user", user.id);
  send(req, res, {
    message: ["লগইন সফল হয়েছে।", "Logged in successfully."],
    data: { ...(await issueToken(user, req)), user: toPublicUser(user) }
  });
}

// ------------------------------------------------------------ forgot password
async function forgotPassword(req, res) {
  const user = await findByEmail(req.body.email);
  if (user && !user.is_blocked && !(await sentRecently(user.id, "password_reset"))) {
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    await storeCode(user.id, "password_reset", sha256(`${user.id}:${code}`), CODE_MINUTES);
    await sendResetCode(user, code, CODE_MINUTES);
  }
  send(req, res, { message: SENT_MESSAGE, data: { expires_in_minutes: CODE_MINUTES } });
}

async function resetPassword(req, res) {
  const { email, code, new_password: newPassword } = req.body;
  const invalid = () => ApiError.badRequest("কোডটি সঠিক নয় বা মেয়াদ শেষ হয়ে গেছে।", "The code is wrong or has expired.", {
    code: { bn: "কোডটি সঠিক নয় বা মেয়াদ শেষ।", en: "Wrong or expired code." }
  });

  const user = await findByEmail(email);
  if (!user) throw invalid();

  const [rows] = await db.query(
    `SELECT id, code_hash, attempts FROM auth_codes
     WHERE user_id = ? AND purpose = 'password_reset' AND used_at IS NULL AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1`,
    [user.id]
  );
  const row = rows[0];
  if (!row) throw invalid();

  const expected = Buffer.from(row.code_hash, "hex");
  const given = Buffer.from(sha256(`${user.id}:${code}`), "hex");
  if (!crypto.timingSafeEqual(expected, given)) {
    const attempts = row.attempts + 1;
    await db.query(
      `UPDATE auth_codes SET attempts = ?, used_at = IF(? >= ?, NOW(), used_at) WHERE id = ?`,
      [attempts, attempts, MAX_ATTEMPTS, row.id]
    );
    throw invalid();
  }

  const problem = checkPasswordStrength(newPassword);
  if (problem) throw ApiError.badRequest(problem.bn, problem.en, { new_password: problem });

  assertNotBlocked(user);
  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await db.query("UPDATE users SET password_hash = ?, password_changed_at = NOW() WHERE id = ?", [hash, user.id]);
  await db.query("UPDATE auth_codes SET used_at = NOW() WHERE id = ?", [row.id]);
  await revokeAllSessions(user.id);

  req.user = user;
  await logActivity(req, "user.password_reset", "user", user.id);
  await db.query("UPDATE users SET last_login_at = NOW() WHERE id = ?", [user.id]);
  send(req, res, {
    message: ["পাসওয়ার্ড পরিবর্তন হয়েছে।", "Your password has been reset."],
    data: { ...(await issueToken(user, req)), user: toPublicUser(user) }
  });
}

// ------------------------------------------------------------ email sign-in link
function frontendUrl() {
  return config.clientUrl.split(",")[0].trim().replace(/\/$/, "");
}

async function requestLoginLink(req, res) {
  const user = await findByEmail(req.body.email);
  if (user && !user.is_blocked && !(await sentRecently(user.id, "login_link"))) {
    const token = crypto.randomBytes(32).toString("base64url");
    await storeCode(user.id, "login_link", sha256(token), LINK_MINUTES);
    await sendLoginLink(user, `${frontendUrl()}/login/link?token=${token}`, LINK_MINUTES);
  }
  send(req, res, { message: SENT_MESSAGE });
}

async function verifyLoginLink(req, res) {
  const [rows] = await db.query(
    `SELECT id, user_id FROM auth_codes
     WHERE code_hash = ? AND purpose = 'login_link' AND used_at IS NULL AND expires_at > NOW() LIMIT 1`,
    [sha256(req.body.token)]
  );
  if (!rows[0]) {
    throw ApiError.badRequest("লিংকটি আর কার্যকর নয়। নতুন লিংক চান।", "This link is no longer valid. Please request a new one.");
  }
  const [result] = await db.query("UPDATE auth_codes SET used_at = NOW() WHERE id = ? AND used_at IS NULL", [rows[0].id]);
  if (result.affectedRows === 0) {
    throw ApiError.badRequest("লিংকটি আগেই ব্যবহার করা হয়েছে।", "This link has already been used.");
  }
  const [users] = await db.query(`SELECT ${USER_COLUMNS} FROM users u WHERE u.id = ?`, [rows[0].user_id]);
  await finishLogin(req, res, users[0], "user.login_link");
}

// ------------------------------------------------------------ Google / Apple
async function socialLogin(req, res) {
  const { provider, id_token: idToken } = req.body;
  const identity = await verifyIdToken(provider, idToken);
  const column = provider === "google" ? "google_id" : "apple_id";

  let [rows] = await db.query(`SELECT ${USER_COLUMNS} FROM users u WHERE u.${column} = ? LIMIT 1`, [identity.sub]);
  let user = rows[0];

  // An existing account with the same verified email is linked automatically.
  if (!user && identity.email) {
    user = await findByEmail(identity.email);
    if (user) await db.query(`UPDATE users SET ${column} = ? WHERE id = ? AND ${column} IS NULL`, [identity.sub, user.id]);
  }

  if (user) return completeLogin(req, res, user, `user.login_${provider}`);

  // No account yet: the browser finishes registration (role, phone, district).
  send(req, res, {
    message: ["অ্যাকাউন্ট খুলতে বাকি তথ্য দিন।", "Complete your details to create an account."],
    data: { needs_registration: true, profile: { name: identity.name, email: identity.email } }
  });
}

/** Which sign-in options the server has switched on. */
function providers(req, res) {
  send(req, res, { data: { google: isEnabled("google"), apple: isEnabled("apple") } });
}

module.exports = { schemas, forgotPassword, resetPassword, requestLoginLink, verifyLoginLink, socialLogin, providers };
