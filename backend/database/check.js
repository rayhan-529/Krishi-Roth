/**
 * Quick MySQL check:  npm run db:check
 * Prints whether the backend can reach MySQL and whether the tables exist.
 */
const { assertEnv, DB_SETTINGS } = require("../config/env");

async function main() {
  assertEnv(DB_SETTINGS);
  const db = require("../config/db");

  try {
    const result = await db.checkConnection();
    console.log(result.ok ? `OK: ${result.message}` : `PROBLEM: ${result.message}`);

    if (result.ok) {
      const [[counts]] = await db.query(
        `SELECT
           (SELECT COUNT(*) FROM users)         AS users,
           (SELECT COUNT(*) FROM crops)         AS crops,
           (SELECT COUNT(*) FROM market_prices) AS market_prices,
           (SELECT COUNT(*) FROM users WHERE role = 'admin') AS admins`
      );
      console.table(counts);
      if (counts.admins === 0) {
        console.log("No admin account yet. Run: npm run admin:create");
      }
    } else {
      process.exitCode = 1;
    }
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
