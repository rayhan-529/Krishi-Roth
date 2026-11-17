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
const TABLES = ["auth_codes", "wallets", "wallet_deposits", "wallet_withdrawals", "wallet_transactions", "wallet_sms"];

const COLUMNS = [
  // v1.2: Google / Apple sign-in
  ["users", "google_id", "VARCHAR(64) NULL", "uq_users_google"],
  ["users", "apple_id", "VARCHAR(64) NULL", "uq_users_apple"],
  // v1.3: Safe Trade escrow
  ["trade_records", "escrow_status", "ENUM('none','held','released','refunded') NOT NULL DEFAULT 'none'"],
  ["trade_records", "escrow_amount", "DECIMAL(14,2) NULL"],
  ["trade_records", "escrow_held_at", "DATETIME NULL"],
  ["trade_records", "escrow_settled_at", "DATETIME NULL"],
  ["trade_records", "auto_release_at", "DATETIME NULL"]
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
