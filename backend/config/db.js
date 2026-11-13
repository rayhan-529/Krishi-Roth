/**
 * The ONE MySQL connection pool used by the whole backend.
 *
 * Always import it like this:
 *   const db = require("../config/db");
 *   const [rows] = await db.execute("SELECT ... WHERE id = ?", [id]);
 *
 * Always pass user input as "?" parameters — never build SQL strings
 * with user input. That is what protects us from SQL injection.
 */
const mysql = require("mysql2/promise");
const { config } = require("./env");

const db = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.name,
  ssl: config.db.ssl ? { minVersion: "TLSv1.2", rejectUnauthorized: true } : undefined,
  charset: "utf8mb4_unicode_ci", // Bengali text needs utf8mb4
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true, // return DECIMAL columns (prices, quantities) as numbers
  dateStrings: true // return DATE/DATETIME as plain strings (no timezone shifting)
});

// Every connection uses Bangladesh time (UTC+06:00, no daylight saving), so
// NOW()/CURDATE() mean the same thing on a local PC and on a cloud database.
db.pool.on("connection", (connection) => {
  connection.query(`SET time_zone = '${config.db.timezone}'`);
});

/**
 * Checks that MySQL is reachable and the schema has been created.
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
async function checkConnection() {
  try {
    await db.query("SELECT 1");
  } catch (error) {
    return { ok: false, message: describeConnectionError(error) };
  }

  try {
    await db.query("SELECT 1 FROM roles LIMIT 1");
    return { ok: true, message: `MySQL connected (database: ${config.db.name})` };
  } catch {
    return {
      ok: false,
      message: `Connected to MySQL, but the tables are missing. Run: npm run db:setup`
    };
  }
}

/** Turns common MySQL errors into plain-English advice. */
function describeConnectionError(error) {
  switch (error.code) {
    case "ECONNREFUSED":
      return `Cannot reach MySQL at ${config.db.host}:${config.db.port}. Is MySQL (or XAMPP MySQL) running?`;
    case "ER_ACCESS_DENIED_ERROR":
      return "MySQL rejected the username/password. Check DB_USER and DB_PASSWORD in backend/.env.";
    case "ER_BAD_DB_ERROR":
      return `Database "${config.db.name}" does not exist yet. Run: npm run db:setup`;
    case "ER_NO_SUCH_TABLE":
      return `A table is missing (${error.message}). Run: npm run db:setup`;
    default:
      return error.code ? `MySQL error ${error.code}: ${error.message}` : error.message;
  }
}

db.checkConnection = checkConnection;
db.describeConnectionError = describeConnectionError;

module.exports = db;
