/**
 * Creates (or updates) the administrator account from backend/.env.
 *
 *   npm run admin:create
 *
 * Required in .env:
 *   ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD (same rule as every user:
 *   at least 8 characters)
 *
 * Behaviour
 *   - No account with ADMIN_EMAIL  -> a new admin account is created.
 *   - Existing ADMIN account        -> its name and password are updated
 *                                      (use this to rotate the password).
 *   - Existing NON-admin account    -> refused, so a normal user is never
 *                                      silently turned into an admin.
 *                                      Run with --promote to allow it:
 *                                      npm run admin:create -- --promote
 *
 * Nobody can register as admin through the website; this script is the
 * only way to create one.
 */
const bcrypt = require("bcryptjs");
const { assertEnv, DB_SETTINGS } = require("../config/env");
const { checkPasswordStrength, BCRYPT_ROUNDS } = require("../utils/password");

async function createAdmin(db) {
  assertEnv([...DB_SETTINGS, "ADMIN_NAME", "ADMIN_EMAIL", "ADMIN_PASSWORD"]);

  const name = process.env.ADMIN_NAME.trim();
  const email = process.env.ADMIN_EMAIL.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const allowPromote = process.argv.includes("--promote");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("ADMIN_EMAIL is not a valid email address.");
  }

  const problem = checkPasswordStrength(password);
  if (problem) {
    throw new Error(`ADMIN_PASSWORD is too weak: ${problem.en}`);
  }

  const [existing] = await db.execute("SELECT id, role FROM users WHERE email = ? LIMIT 1", [email]);
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  if (existing.length === 0) {
    const [result] = await db.execute(
      `INSERT INTO users (name, email, password_hash, role, verification_status)
       VALUES (?, ?, ?, 'admin', 'verified')`,
      [name, email, passwordHash]
    );
    console.log(`Admin account created (id ${result.insertId}, ${email}).`);
    return;
  }

  const user = existing[0];

  if (user.role !== "admin" && !allowPromote) {
    throw new Error(
      `${email} already belongs to a "${user.role}" account. ` +
        "Use a different ADMIN_EMAIL, or run: npm run admin:create -- --promote"
    );
  }

  await db.execute(
    `UPDATE users
     SET name = ?, password_hash = ?, role = 'admin', is_blocked = 0,
         verification_status = 'verified', password_changed_at = NOW()
     WHERE id = ?`,
    [name, passwordHash, user.id]
  );
  // The password changed, so every existing login of this account ends.
  await db.execute("UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL", [user.id]);

  console.log(
    user.role === "admin"
      ? `Admin account updated (id ${user.id}, ${email}). The password from .env is now active.`
      : `Account ${email} (id ${user.id}) was promoted from "${user.role}" to admin.`
  );
}

async function main() {
  // Required here (not at the top) so a missing .env is reported clearly.
  const db = require("../config/db");

  try {
    await createAdmin(db);
  } catch (error) {
    console.error(`Admin creation failed: ${db.describeConnectionError(error)}`);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

main();
