/**
 * Registration, login (one login for every role, including admin),
 * current user, logout and password change.
 */
const bcrypt = require("bcryptjs");
const db = require("../config/db");
const v = require("../utils/validator");
const ApiError = require("../utils/ApiError");
const { send } = require("../utils/response");
const { checkPasswordStrength, BCRYPT_ROUNDS } = require("../utils/password");
const { USER_COLUMNS } = require("../middleware/auth");
const { issueToken, revokeSession, revokeAllSessions } = require("../services/tokenService");
const { notify } = require("../services/notificationService");
const { logActivity } = require("../services/activityService");
const crypto = require("crypto");
const { verifyIdToken } = require("../services/socialAuthService");
const { completeLogin } = require("./twoFactorController");
const { requireCodeFor } = require("../services/twoFactorService");

// Roles a person may choose when registering. Admin is never allowed.
const REGISTER_ROLES = ["farmer", "buyer", "labour", "harvester_owner", "tractor_owner", "transport_owner"];

// Used when an account is not found, so a wrong email takes as long as a
// wrong password (prevents discovering which accounts exist).
const DUMMY_HASH = bcrypt.hashSync("krishi-roth-timing-guard", BCRYPT_ROUNDS);

const schemas = {
  register: {
    name: v.string().required().min(2).max(100),
    phone: v.phone().required(),
    // Required: needed for password-reset codes and sign-in links.
    email: v.email().required(),
    // Not needed when signing up with Google/Apple (provider + id_token).
    password: v.string(),
    provider: v.enum(["google", "apple"]),
    id_token: v.string().max(5000),
    role: v.enum(REGISTER_ROLES).required(),
    district_id: v.id().required(),
    upazila: v.string().max(80),
    preferred_language: v.enum(["bn", "en"]).default("bn")
  },
  login: {
    identifier: v.string().required().max(150),
    password: v.string().required().max(200),
    // "Remember this device" token from an earlier two-step login
    device_token: v.string().max(200)
  },
  changePassword: {
    current_password: v.string().required(),
    new_password: v.string().required(),
    // Needed when two-step verification is on
    code: v.string().max(6)
  }
};

/** The user fields that are safe to send to the browser. */
function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    profile_photo: user.profile_photo,
    district_id: user.district_id,
    upazila: user.upazila,
    verification_status: user.verification_status,
    preferred_language: user.preferred_language
  };
}

function passwordError(problem) {
  return ApiError.badRequest(problem.bn, problem.en, { password: problem, new_password: problem });
}

async function register(req, res) {
  const data = req.body;

  // Sign-up with Google/Apple: the verified email from the provider is used
  // and a random password is stored (the user can set one later via reset).
  let social = null;
  if (data.provider || data.id_token) {
    if (!data.provider || !data.id_token) {
      throw ApiError.badRequest("লগইন তথ্য অসম্পূর্ণ।", "Sign-in details are incomplete.");
    }
    social = await verifyIdToken(data.provider, data.id_token);
    if (social.email) data.email = social.email;
    const column = data.provider === "google" ? "google_id" : "apple_id";
    const [linked] = await db.query(`SELECT id FROM users WHERE ${column} = ? LIMIT 1`, [social.sub]);
    if (linked.length > 0) {
      throw new ApiError(409, "এই অ্যাকাউন্ট দিয়ে আগেই নিবন্ধন করা হয়েছে। লগইন করুন।", "This account is already registered. Please log in.");
    }
    data.password = crypto.randomBytes(30).toString("base64url");
  } else {
    const problem = checkPasswordStrength(data.password);
    if (problem) throw ApiError.badRequest(problem.bn, problem.en, { password: problem });
  }

  const [taken] = await db.query(
    "SELECT phone, email FROM users WHERE phone = ? OR (email IS NOT NULL AND email = ?)",
    [data.phone, data.email]
  );
  if (taken.length > 0) {
    const errors = {};
    if (taken.some((u) => u.phone === data.phone)) {
      errors.phone = { bn: "এই মোবাইল নম্বর দিয়ে আগেই নিবন্ধন করা হয়েছে।", en: "This mobile number is already registered." };
    }
    if (data.email && taken.some((u) => u.email === data.email)) {
      errors.email = { bn: "এই ইমেইল দিয়ে আগেই নিবন্ধন করা হয়েছে।", en: "This email is already registered." };
    }
    throw new ApiError(409, "এই তথ্য দিয়ে আগেই অ্যাকাউন্ট আছে।", "An account with these details already exists.", errors);
  }

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  const [result] = await db.query(
    `INSERT INTO users (name, phone, email, password_hash, role, district_id, upazila, preferred_language, google_id, apple_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name, data.phone, data.email, passwordHash, data.role, data.district_id, data.upazila, data.preferred_language,
      social && social.provider === "google" ? social.sub : null,
      social && social.provider === "apple" ? social.sub : null
    ]
  );

  const [rows] = await db.query(`SELECT ${USER_COLUMNS} FROM users u WHERE u.id = ?`, [result.insertId]);
  const user = rows[0];

  await notify(null, user.id, {
    type: "announcement",
    title: ["কৃষি রথে স্বাগতম!", "Welcome to Krishi Roth!"],
    body: [
      "আপনার প্রোফাইল সম্পূর্ণ করুন এবং যাচাইয়ের জন্য আবেদন করুন।",
      "Complete your profile and request verification."
    ],
    link: "/profile"
  });

  req.user = user;
  await logActivity(req, "user.register", "user", user.id, user.role);

  send(req, res, {
    status: 201,
    message: ["নিবন্ধন সফল হয়েছে।", "Registration successful."],
    data: { ...(await issueToken(user, req)), user: toPublicUser(user) }
  });
}

async function login(req, res) {
  const { identifier, password } = req.body;

  // The identifier can be an email address or a mobile number.
  let column = "email";
  let value = identifier.trim().toLowerCase();
  if (!value.includes("@")) {
    const phone = v.phone().run(value);
    if (phone.error) {
      throw ApiError.badRequest("সঠিক মোবাইল নম্বর বা ইমেইল দিন।", "Enter a valid mobile number or email.", {
        identifier: phone.error
      });
    }
    column = "phone";
    value = phone.value;
  }

  const [rows] = await db.query(`SELECT ${USER_COLUMNS}, u.password_hash FROM users u WHERE u.${column} = ? LIMIT 1`, [value]);
  const user = rows[0];
  const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

  if (!user || !ok) {
    throw ApiError.unauthorized(
      "মোবাইল নম্বর/ইমেইল অথবা পাসওয়ার্ড সঠিক নয়।",
      "The mobile number/email or password is incorrect."
    );
  }

  if (user.is_blocked) {
    throw ApiError.forbidden(
      "আপনার অ্যাকাউন্টটি বন্ধ করা হয়েছে। অ্যাডমিনের সঙ্গে যোগাযোগ করুন।",
      "Your account has been blocked. Please contact the administrator."
    );
  }

  // Issues the token, or asks for a two-step code first (new device).
  await completeLogin(req, res, user, "user.login");
}

async function me(req, res) {
  send(req, res, { data: { user: toPublicUser(req.user) } });
}

async function logout(req, res) {
  await revokeSession(req.sessionJti);
  await logActivity(req, "user.logout", "user", req.user.id);
  send(req, res, { message: ["আপনি লগআউট করেছেন।", "You have logged out."] });
}

/** Signs the user out on every device by invalidating all old tokens. */
async function logoutAll(req, res) {
  await revokeAllSessions(req.user.id);
  await logActivity(req, "user.logout_all", "user", req.user.id);
  send(req, res, { message: ["সব ডিভাইস থেকে লগআউট হয়েছে।", "Logged out from all devices."] });
}

async function changePassword(req, res) {
  const { current_password: current, new_password: next } = req.body;

  const [[row]] = await db.query("SELECT password_hash FROM users WHERE id = ?", [req.user.id]);
  if (!(await bcrypt.compare(current, row.password_hash))) {
    const message = { bn: "বর্তমান পাসওয়ার্ড সঠিক নয়।", en: "Current password is incorrect." };
    throw ApiError.badRequest(message.bn, message.en, { current_password: message });
  }

  const problem = checkPasswordStrength(next);
  if (problem) throw passwordError(problem);

  // With two-step verification on, a code is also needed.
  await requireCodeFor(req.user.id, "password_change", req.body.code);

  if (current === next) {
    const message = { bn: "নতুন পাসওয়ার্ড আগের থেকে আলাদা হতে হবে।", en: "The new password must be different." };
    throw ApiError.badRequest(message.bn, message.en, { new_password: message });
  }

  const hash = await bcrypt.hash(next, BCRYPT_ROUNDS);
  await db.query(
    "UPDATE users SET password_hash = ?, password_changed_at = NOW() WHERE id = ?",
    [hash, req.user.id]
  );
  await revokeAllSessions(req.user.id);

  // Old tokens are now invalid everywhere; give this device a fresh one.
  const [rows] = await db.query(`SELECT ${USER_COLUMNS} FROM users u WHERE u.id = ?`, [req.user.id]);
  await logActivity(req, "user.password_change", "user", req.user.id);

  send(req, res, {
    message: ["পাসওয়ার্ড পরিবর্তন হয়েছে। অন্য সব ডিভাইস থেকে লগআউট করা হয়েছে।", "Password changed. You were logged out on other devices."],
    data: { ...(await issueToken(rows[0], req)), user: toPublicUser(rows[0]) }
  });
}

module.exports = { schemas, register, login, me, logout, logoutAll, changePassword, toPublicUser, REGISTER_ROLES };
