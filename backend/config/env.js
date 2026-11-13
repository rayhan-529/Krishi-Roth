/**
 * Loads backend/.env and exposes one validated config object.
 *
 * The .env file is always read from the backend folder, so the scripts
 * work no matter which folder you run them from.
 */
const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
  quiet: true
});

function read(name, fallback = "") {
  const value = process.env[name];
  return value === undefined ? fallback : String(value).trim();
}

const config = {
  nodeEnv: read("NODE_ENV", "development"),
  port: Number(read("PORT", "5000")) || 5000,
  clientUrl: read("CLIENT_URL", "http://localhost:5173"),
  // Set TRUST_PROXY=true when the API runs behind a hosting proxy (Render, Railway, Nginx).
  trustProxy: ["1", "true", "yes"].includes(read("TRUST_PROXY", "false").toLowerCase()),

  db: {
    host: read("DB_HOST", "localhost"),
    port: Number(read("DB_PORT", "3306")) || 3306,
    user: read("DB_USER", "root"),
    // An empty password is allowed (XAMPP's default root account has none).
    password: process.env.DB_PASSWORD ?? "",
    name: read("DB_NAME", "krishi_roth"),
    // Cloud databases (TiDB Cloud, Aiven, PlanetScale...) require an encrypted connection.
    // Database session time zone; Bangladesh is UTC+06:00 all year.
    timezone: /^[+-]\d{2}:\d{2}$/.test(read("DB_TIMEZONE", "+06:00")) ? read("DB_TIMEZONE", "+06:00") : "+06:00",
    ssl: ["1", "true", "yes"].includes(read("DB_SSL", "false").toLowerCase())
  },

  jwt: {
    secret: process.env.JWT_SECRET ?? "",
    expiresIn: read("JWT_EXPIRES_IN", "1d")
  }
};

config.isProduction = config.nodeEnv === "production";

/**
 * Stops the program with a clear message when required settings are missing.
 * @param {string[]} names - environment variable names that must be set
 */
function assertEnv(names) {
  const missing = names.filter((name) => !read(name));

  if (missing.length > 0) {
    throw new Error(
      `Missing required setting(s) in backend/.env: ${missing.join(", ")}.\n` +
        "Copy backend/.env.example to backend/.env and fill in the values."
    );
  }

  if (!/^[A-Za-z0-9_]+$/.test(config.db.name)) {
    throw new Error("DB_NAME may only contain English letters, numbers and underscore (_).");
  }

  if (names.includes("JWT_SECRET") && config.jwt.secret.length < 32) {
    throw new Error(
      "JWT_SECRET must be at least 32 characters long.\n" +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
    );
  }
}

/** Settings the database scripts need. */
const DB_SETTINGS = ["DB_HOST", "DB_USER", "DB_NAME"];

/** Settings the API server needs. */
const SERVER_SETTINGS = [...DB_SETTINGS, "JWT_SECRET"];

module.exports = { config, assertEnv, DB_SETTINGS, SERVER_SETTINGS };
