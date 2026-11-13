/**
 * Authentication and role-based access control (RBAC).
 *
 *   router.get("/mine", authenticate, authorize("farmer"), controller.mine);
 *   router.use(authenticate, authorize("admin"));   // whole admin router
 *
 * On EVERY request the token's session (jti) and the user's role and
 * blocked status are read from MySQL, so logout, password changes, blocks
 * and role changes take effect at once. The token alone is never trusted.
 */
const db = require("../config/db");
const ApiError = require("../utils/ApiError");
const { verifyToken } = require("../services/tokenService");

const USER_COLUMNS = `u.id, u.name, u.email, u.phone, u.role, u.profile_photo, u.district_id, u.upazila,
  u.verification_status, u.is_blocked, u.preferred_language`;

const expired = () =>
  ApiError.unauthorized(
    "আপনার লগইনের মেয়াদ শেষ হয়েছে। আবার লগইন করুন।",
    "Your session has expired. Please log in again."
  );

function readToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : null;
}

async function loadUserFromToken(token) {
  const payload = verifyToken(token);
  if (!payload) throw expired();

  const [rows] = await db.query(
    `SELECT ${USER_COLUMNS}
     FROM user_sessions s JOIN users u ON u.id = s.user_id
     WHERE s.jti = ? AND s.revoked_at IS NULL AND s.expires_at > NOW()
     LIMIT 1`,
    [payload.jti]
  );
  const user = rows[0];

  if (!user || String(user.id) !== String(payload.sub)) throw expired();

  if (user.is_blocked) {
    throw ApiError.forbidden(
      "আপনার অ্যাকাউন্টটি বন্ধ করা হয়েছে। অ্যাডমিনের সঙ্গে যোগাযোগ করুন।",
      "Your account has been blocked. Please contact the administrator."
    );
  }

  return { user, jti: payload.jti };
}

/** Requires a valid login. Sets req.user and req.sessionJti. */
async function authenticate(req, res, next) {
  const token = readToken(req);
  if (!token) throw ApiError.unauthorized();
  const { user, jti } = await loadUserFromToken(token);
  req.user = user;
  req.sessionJti = jti;
  next();
}

/** Uses the login if a valid one is sent, but also allows visitors. */
async function optionalAuth(req, res, next) {
  const token = readToken(req);
  req.user = null;
  if (token) {
    try {
      const { user, jti } = await loadUserFromToken(token);
      req.user = user;
      req.sessionJti = jti;
    } catch {
      req.user = null;
    }
  }
  next();
}

/** Allows only the listed roles. Use after authenticate. */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) throw ApiError.unauthorized();
    if (!roles.includes(req.user.role)) throw ApiError.forbidden();
    next();
  };
}

module.exports = { authenticate, optionalAuth, authorize, USER_COLUMNS };
