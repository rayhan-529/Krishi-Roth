/**
 * Writes to activity_logs (shown as "Recent activities" to admins).
 * Logging must never break the real action, so errors are only printed.
 */
const db = require("../config/db");

async function logActivity(req, action, entityType = null, entityId = null, details = null) {
  try {
    await db.query(
      `INSERT INTO activity_logs (actor_id, action, entity_type, entity_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.user ? req.user.id : null,
        action,
        entityType,
        entityId,
        details ? String(details).slice(0, 1000) : null,
        (req.ip || "").slice(0, 45)
      ]
    );
  } catch (error) {
    console.error("Activity log failed:", error.message);
  }
}

module.exports = { logActivity };
