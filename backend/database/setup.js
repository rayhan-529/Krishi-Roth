/**
 * Krishi Roth database setup
 * ---------------------------------------------------------------
 *   npm run db:setup   Create the database (if missing), create all
 *                      tables and load the reference seed data.
 *                      Safe to run again: existing data is kept.
 *
 *   npm run db:reset   DELETE the whole database and build it again.
 *                      Asks you to type the database name first.
 *
 * Old projects: if an older "users" table (with a "password" column)
 * is found, it is renamed to users_legacy_<date>, the new schema is
 * created, and every old account is copied across with its id,
 * name, email, role and password hash, so existing logins keep working.
 */
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const mysql = require("mysql2/promise");
const { config, assertEnv, DB_SETTINGS } = require("../config/env");

const SQL_FILES = ["schema.sql", "seed.sql"];

async function main() {
  assertEnv(DB_SETTINGS);
  const reset = process.argv.includes("--reset");

  if (reset && config.isProduction) {
    throw new Error("db:reset is disabled when NODE_ENV=production.");
  }

  // Connect WITHOUT choosing a database, because it may not exist yet.
  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    ssl: config.db.ssl ? { minVersion: "TLSv1.2", rejectUnauthorized: true } : undefined,
    charset: "utf8mb4_unicode_ci"
  });

  try {
    await checkServerVersion(conn);
    const dbName = config.db.name; // validated by assertEnv: letters, numbers, _

    if (reset) {
      await confirmReset(dbName);
      await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
      console.log(`Deleted database "${dbName}".`);
    }

    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await conn.query(`USE \`${dbName}\``);
    console.log(`Using database "${dbName}".`);

    const legacyTable = await moveLegacyUsersTable(conn, dbName);

    for (const file of SQL_FILES) {
      const count = await runSqlFile(conn, file);
      console.log(`Applied ${file} (${count} statements).`);
    }

    await applyUpgrades(conn, dbName);

    if (legacyTable) {
      await copyLegacyUsers(conn, dbName, legacyTable);
    }

    await printSummary(conn, dbName);
    console.log("\nDatabase setup complete.");
    console.log("Next step: npm run admin:create   (creates the admin account from .env)");
  } finally {
    await conn.end();
  }
}

/** Warns when the MySQL/MariaDB version is too old for CHECK constraints. */
async function checkServerVersion(conn) {
  const [[row]] = await conn.query("SELECT VERSION() AS version");
  const version = row.version;
  const isMaria = /mariadb/i.test(version);
  const [major, minor, patch] = version.split(/[.-]/).map((part) => Number(part) || 0);

  const tooOld = isMaria
    ? major < 10 || (major === 10 && minor < 4)
    : major < 8 || (major === 8 && minor === 0 && patch < 16);

  console.log(`Connected to ${isMaria ? "MariaDB" : "MySQL"} ${version}`);

  if (tooOld) {
    console.warn(
      "WARNING: This version is older than MySQL 8.0.16 / MariaDB 10.4. " +
        "Data CHECK rules will not be enforced. Please upgrade if you can."
    );
  }
}

/** Splits a .sql file into statements and runs them one by one. */
async function runSqlFile(conn, fileName) {
  const filePath = path.join(__dirname, fileName);
  const text = fs.readFileSync(filePath, "utf8").replace(/^﻿/, "");

  // Remove full-line comments, then split on a ";" at the end of a line.
  const withoutComments = text
    .split(/\r?\n/)
    .filter((line) => !/^\s*--/.test(line))
    .join("\n");

  const statements = withoutComments
    .split(/;\s*(?:\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    try {
      await conn.query(statement);
    } catch (error) {
      const preview = statement.split("\n")[0].slice(0, 120);
      throw new Error(`${fileName}: failed at "${preview}"\n${error.message}`);
    }
  }

  return statements.length;
}

/**
 * If a "users" table from the old version exists (it has "password"
 * but no "password_hash" column), rename it so the new table can be made.
 * @returns {Promise<string|null>} the legacy table name, or null
 */
async function moveLegacyUsersTable(conn, dbName) {
  const [columns] = await conn.query(
    `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'`,
    [dbName]
  );

  if (columns.length === 0) return null;

  const names = columns.map((column) => column.name);
  if (names.includes("password_hash")) return null; // already the new schema

  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const legacyTable = `users_legacy_${stamp}`;

  await conn.query(`RENAME TABLE \`users\` TO \`${legacyTable}\``);
  console.log(`Found an old "users" table. Renamed it to "${legacyTable}" so accounts can be migrated.`);
  return legacyTable;
}

/**
 * Brings a database created by an earlier version of schema.sql up to date.
 * CREATE TABLE IF NOT EXISTS never changes an existing table, so new
 * columns are added here. Every step checks first, so it is safe to repeat.
 */
async function applyUpgrades(conn, dbName) {
  const columnExists = async (table, column) => {
    const [rows] = await conn.query(
      `SELECT 1 FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [dbName, table, column]
    );
    return rows.length > 0;
  };

  // v1.1: verification documents are stored privately inside the database.
  // The Phase 2 table (with a document_file column) was never used, so it is
  // rebuilt when empty.
  if (await columnExists("user_verifications", "document_file")) {
    const [[{ n }]] = await conn.query("SELECT COUNT(*) AS n FROM user_verifications");
    if (Number(n) === 0) {
      await conn.query("DROP TABLE user_verifications");
      await runSqlFile(conn, "schema.sql");
      console.log("Upgrade: rebuilt user_verifications for private document storage");
    } else {
      console.warn("Upgrade skipped: user_verifications has rows; run npm run db:reset on a development database.");
    }
  }

  // v1.2: Google / Apple sign-in ids.
  for (const column of ["google_id", "apple_id"]) {
    if (!(await columnExists("users", column))) {
      const key = `uq_users_${column.split("_")[0]}`;
      await conn.query(`ALTER TABLE users ADD COLUMN ${column} VARCHAR(64) NULL, ADD UNIQUE KEY ${key} (${column})`);
      console.log(`Upgrade: added users.${column}`);
    }
  }

  // v1.3: Safe Trade escrow columns on trades (wallet tables come from schema.sql).
  const escrowColumns = [
    ["escrow_status", "ENUM('none','held','released','refunded') NOT NULL DEFAULT 'none'"],
    ["escrow_amount", "DECIMAL(14,2) NULL"],
    ["escrow_held_at", "DATETIME NULL"],
    ["escrow_settled_at", "DATETIME NULL"],
    ["auto_release_at", "DATETIME NULL"]
  ];
  for (const [column, definition] of escrowColumns) {
    if (!(await columnExists("trade_records", column))) {
      await conn.query(`ALTER TABLE trade_records ADD COLUMN ${column} ${definition}`);
      console.log(`Upgrade: added trade_records.${column}`);
    }
  }
  await conn.query(
    "ALTER TABLE trade_records MODIFY payment_method ENUM('cash','bkash','nagad','rocket','bank_transfer','other','wallet') NULL"
  );

  // v1.1: the project no longer ships sample (demonstration) market prices.
  const [removed] = await conn.query("DELETE FROM market_prices WHERE source = 'sample'");
  if (removed.affectedRows > 0) {
    console.log(`Upgrade: removed ${removed.affectedRows} sample market price row(s)`);
  }
}

/** Copies accounts from the old users table into the new one. */
async function copyLegacyUsers(conn, dbName, legacyTable) {
  const [columns] = await conn.query(
    `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [dbName, legacyTable]
  );
  const has = new Set(columns.map((column) => column.name));

  for (const required of ["id", "name", "email", "password", "role"]) {
    if (!has.has(required)) {
      console.warn(
        `Could not migrate old accounts: column "${required}" is missing in ${legacyTable}. ` +
          "The old table was kept unchanged."
      );
      return;
    }
  }

  const createdAt = has.has("created_at") ? "COALESCE(old.created_at, NOW())" : "NOW()";

  // Unknown old roles become "farmer" (the only role the old app could register).
  const [result] = await conn.query(
    `INSERT IGNORE INTO users (id, name, email, password_hash, role, created_at)
     SELECT old.id,
            LEFT(TRIM(old.name), 100),
            LOWER(TRIM(old.email)),
            old.password,
            CASE
              WHEN CONVERT(old.role USING utf8mb4) COLLATE utf8mb4_unicode_ci IN (SELECT code FROM roles)
              THEN CONVERT(old.role USING utf8mb4) COLLATE utf8mb4_unicode_ci
              ELSE 'farmer'
            END,
            ${createdAt}
     FROM \`${legacyTable}\` AS old
     WHERE old.email IS NOT NULL AND TRIM(old.email) <> ''`
  );

  const [[{ total }]] = await conn.query(`SELECT COUNT(*) AS total FROM \`${legacyTable}\``);

  console.log(`Migrated ${result.affectedRows} of ${total} old account(s) into the new users table.`);
  if (result.affectedRows < total) {
    console.warn("Some old accounts were skipped (empty or duplicate email). Check the legacy table.");
  }
  console.log(
    `The old table "${legacyTable}" was kept as a backup. ` +
      `When you are happy, you can delete it in MySQL with: DROP TABLE ${legacyTable};`
  );
}

async function printSummary(conn, dbName) {
  const [[{ tables }]] = await conn.query(
    `SELECT COUNT(*) AS tables FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`,
    [dbName]
  );

  const counts = {};
  for (const table of ["roles", "districts", "crops", "expense_categories", "market_prices", "users"]) {
    const [[row]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${table}\``);
    counts[table] = row.n;
  }

  console.log(`\nTables: ${tables}`);
  console.table(counts);
}

function confirmReset(dbName) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  return new Promise((resolve, reject) => {
    rl.question(
      `\nThis will DELETE ALL DATA in database "${dbName}".\nType the database name to confirm: `,
      (answer) => {
        rl.close();
        if (answer.trim() === dbName) resolve();
        else reject(new Error("Reset cancelled. Nothing was changed."));
      }
    );
  });
}

main().catch((error) => {
  console.error(`\nDatabase setup failed:\n${error.message}`);
  if (error.code === "ECONNREFUSED") {
    console.error("Is MySQL running? (XAMPP: start MySQL in the XAMPP Control Panel.)");
  } else if (error.code === "ER_ACCESS_DENIED_ERROR") {
    console.error("Check DB_USER and DB_PASSWORD in backend/.env.");
  }
  process.exitCode = 1;
});
