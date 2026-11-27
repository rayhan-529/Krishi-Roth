/**
 * Safe, additive database upgrades.
 *
 * Runs automatically when the API starts (server.js), and by hand with:
 *   npm run db:migrate
 *
 * It only ADDS what is missing (tables, columns, indexes). It never deletes
 * or changes data, so it is safe to run on the live database again and again.
 * (database/setup.js is for creating a fresh database.)
 */
const fs = require("fs");
const path = require("path");
const db = require("../config/db");
const { config } = require("../config/env");

/** New tables, in dependency order. Their definitions are read from schema.sql. */
const TABLES = ["auth_codes", "trusted_devices", "wallets", "wallet_deposits", "wallet_withdrawals", "wallet_transactions", "wallet_sms", "weather_alerts", "kb_documents", "kb_chunks"];

/** Every purpose auth_codes must accept (checked against the live ENUM). */
const AUTH_CODE_PURPOSES = ["password_reset", "login_link", "login_2fa", "enable_2fa", "disable_2fa", "withdraw", "password_change"];

const COLUMNS = [
  // v1.2: Google / Apple sign-in
  ["users", "google_id", "VARCHAR(64) NULL", "uq_users_google"],
  ["users", "apple_id", "VARCHAR(64) NULL", "uq_users_apple"],
  // v1.4: two-step verification
  ["users", "two_factor_enabled", "TINYINT(1) NOT NULL DEFAULT 0"],
  ["users", "two_factor_method", "ENUM('email','sms') NOT NULL DEFAULT 'email'"],
  // v1.3: Safe Trade escrow
  ["trade_records", "escrow_status", "ENUM('none','held','released','refunded') NOT NULL DEFAULT 'none'"],
  ["trade_records", "escrow_amount", "DECIMAL(14,2) NULL"],
  ["trade_records", "escrow_held_at", "DATETIME NULL"],
  ["trade_records", "escrow_settled_at", "DATETIME NULL"],
  ["trade_records", "auto_release_at", "DATETIME NULL"],
  // v1.6: chatbot answers remember which knowledge-base documents they used
  ["chatbot_messages", "sources", "TEXT NULL"],
  ["kb_documents", "content_hash", "CHAR(64) NULL"],
  // v1.7: delivery map and live vehicle location
  ["trade_records", "pickup_lat", "DECIMAL(9,6) NULL"],
  ["trade_records", "pickup_lng", "DECIMAL(9,6) NULL"],
  ["trade_records", "drop_lat", "DECIMAL(9,6) NULL"],
  ["trade_records", "drop_lng", "DECIMAL(9,6) NULL"],
  ["trade_records", "tracking_active", "TINYINT(1) NOT NULL DEFAULT 0"],
  ["trade_records", "tracking_by", "INT UNSIGNED NULL"],
  ["trade_records", "vehicle_info", "VARCHAR(200) NULL"],
  ["trade_records", "live_lat", "DECIMAL(9,6) NULL"],
  ["trade_records", "live_lng", "DECIMAL(9,6) NULL"],
  ["trade_records", "live_accuracy", "INT UNSIGNED NULL"],
  ["trade_records", "live_speed", "DECIMAL(6,2) NULL"],
  ["trade_records", "live_heading", "SMALLINT NULL"],
  ["trade_records", "live_updated_at", "DATETIME NULL"]
];

function createStatement(schema, table) {
  const match = schema.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?\\) ENGINE=InnoDB[^;]*;`));
  if (!match) throw new Error(`schema.sql has no CREATE TABLE for ${table}`);
  return match[0];
}

/**
 * @returns {Promise<string[]>} the changes that were made (empty when up to date)
 */
async function runMigrations(conn = db) {
  const changes = [];
  const dbName = config.db.name;

  const columnType = async (table, column) => {
    const [rows] = await conn.query(
      "SELECT COLUMN_TYPE AS type FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?",
      [dbName, table, column]
    );
    return rows[0] ? String(rows[0].type) : null;
  };
  const indexExists = async (table, index) => {
    const [rows] = await conn.query(
      "SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1",
      [dbName, table, index]
    );
    return rows.length > 0;
  };

  // 1. Columns (each ALTER on its own, for TiDB/MySQL compatibility)
  for (const [table, column, definition, uniqueIndex] of COLUMNS) {
    // A table that does not exist yet is created below from schema.sql, which already has the column.
    const [tableRows] = await conn.query("SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?", [dbName, table]);
    if (tableRows.length === 0) continue;
    if (!(await columnType(table, column))) {
      await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
      changes.push(`added ${table}.${column}`);
    }
    if (uniqueIndex && !(await indexExists(table, uniqueIndex))) {
      await conn.query(`ALTER TABLE \`${table}\` ADD UNIQUE KEY \`${uniqueIndex}\` (\`${column}\`)`);
      changes.push(`added index ${uniqueIndex}`);
    }
  }

  // 2. Trades can be paid from the wallet
  const paymentType = await columnType("trade_records", "payment_method");
  if (paymentType && !paymentType.includes("'wallet'")) {
    await conn.query(
      "ALTER TABLE trade_records MODIFY payment_method ENUM('cash','bkash','nagad','rocket','bank_transfer','other','wallet') NULL"
    );
    changes.push("trade_records.payment_method allows 'wallet'");
  }

  // 3. New tables
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  for (const table of TABLES) {
    const [exists] = await conn.query(
      "SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?",
      [dbName, table]
    );
    if (exists.length === 0) {
      await conn.query(createStatement(schema, table));
      changes.push(`created table ${table}`);
    }
  }

  // 4. auth_codes created by an earlier version: new purposes + 2FA login challenge
  const purposeType = await columnType("auth_codes", "purpose");
  if (purposeType && AUTH_CODE_PURPOSES.some((p) => !purposeType.includes(`'${p}'`))) {
    await conn.query(
      `ALTER TABLE auth_codes MODIFY purpose ENUM(${AUTH_CODE_PURPOSES.map((p) => `'${p}'`).join(",")}) NOT NULL`
    );
    changes.push("auth_codes.purpose allows two-step codes");
  }
  if (!(await columnType("auth_codes", "challenge_hash"))) {
    await conn.query("ALTER TABLE auth_codes ADD COLUMN challenge_hash CHAR(64) NULL");
    changes.push("added auth_codes.challenge_hash");
  }
  if (!(await indexExists("auth_codes", "idx_auth_codes_challenge"))) {
    await conn.query("ALTER TABLE auth_codes ADD KEY idx_auth_codes_challenge (challenge_hash)");
    changes.push("added index idx_auth_codes_challenge");
  }

  return changes;
}

module.exports = { runMigrations };

// npm run db:migrate
if (require.main === module) {
  runMigrations()
    .then((changes) => {
      console.log(changes.length ? `Database upgraded:\n  - ${changes.join("\n  - ")}` : "Database is already up to date.");
    })
    .catch((error) => {
      console.error("Migration failed:", error.message);
      process.exitCode = 1;
    })
    .finally(() => db.end());
}
