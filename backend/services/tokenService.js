/**
 * Login tokens (JWT) backed by the user_sessions table.
 *
 * Every login and every registration calls issueToken(), which creates a
 * NEW token with its own random id (jti). The jti is stored in
 * user_sessions, so:
 *   - every token is unique, even for the same user on the same second;
 *   - logout really ends that token on the server;
 *   - a password change, an admin block or "log out everywhere" ends all
 *     of a user's tokens at once.
 */
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const { config } = require("../config/env");

const ALGORITHM = "HS256";

/**
 * Creates a session row and returns a signed token for it.
 * @param {object} user  row with id and role
 * @param {import("express").Request} req
 * @param {object} [conn] optional transaction connection
 * @returns {Promise<{ token: string, expires_at: string }>}
 */
async function issueToken(user, req, conn = db) {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ sub: String(user.id), role: user.role, jti }, config.jwt.secret, {
    algorithm: ALGORITHM,
    expiresIn: config.jwt.expiresIn
  });

  const { iat, exp } = jwt.decode(token);
  await conn.query(
    `INSERT INTO user_sessions (jti, user_id, expires_at, ip_address, user_agent)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND), ?, ?)`,
    [jti, user.id, exp - iat, (req.ip || "").slice(0, 45), String(req.get("user-agent") || "").slice(0, 255)]
  );

  return { token, expires_at: new Date(exp * 1000).toISOString() };
}

/**
 * Checks the signature and expiry of a token.
 * @returns {{ sub: string, role: string, jti: string } | null}
 */
function verifyToken(token) {
  try {
    const payload = jwt.verify(token, config.jwt.secret, { algorithms: [ALGORITHM] });
    return payload && payload.jti && payload.sub ? payload : null;
  } catch {
    return null;
  }
}

/** Ends one session (logout on this device). */
async function revokeSession(jti) {
  await db.query("UPDATE user_sessions SET revoked_at = NOW() WHERE jti = ? AND revoked_at IS NULL", [jti]);
}

/**
 * Ends every session of a user, optionally keeping one (the current device).
 * @param {number} userId
 * @param {{ exceptJti?: string, conn?: object }} [options]
 */
async function revokeAllSessions(userId, { exceptJti = null, conn = db } = {}) {
  await conn.query(
    `UPDATE user_sessions SET revoked_at = NOW()
     WHERE user_id = ? AND revoked_at IS NULL AND (? IS NULL OR jti <> ?)`,
    [userId, exceptJti, exceptJti]
  );
}

/** Deletes sessions that expired more than 7 days ago (housekeeping). */
async function deleteOldSessions() {
  await db.query("DELETE FROM user_sessions WHERE expires_at < DATE_SUB(NOW(), INTERVAL 7 DAY)");
}

module.exports = { issueToken, verifyToken, revokeSession, revokeAllSessions, deleteOldSessions };
