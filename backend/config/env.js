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
  },

  // Outgoing email (password-reset codes, sign-in links). When SMTP_HOST is
  // empty the email is printed in the server console instead (development).
  mail: {
    host: read("SMTP_HOST"),
    port: Number(read("SMTP_PORT", "587")) || 587,
    secure: ["1", "true", "yes"].includes(read("SMTP_SECURE", "false").toLowerCase()),
    user: read("SMTP_USER"),
    // Gmail shows App passwords as "abcd efgh ijkl mnop"; the spaces are not part of it.
    // Gmail App passwords ("abcd efgh ijkl mnop") and Brevo SMTP keys never contain
    // spaces, so any space or line break picked up while copy-pasting is removed.
    // Other providers' passwords are only trimmed at the ends.
    pass: /gmail\.com|brevo\.com/i.test(read("SMTP_HOST"))
      ? (process.env.SMTP_PASS ?? "").replace(/\s+/g, "")
      : (process.env.SMTP_PASS ?? "").trim(),
    // Defaults to the SMTP account itself (Gmail always sends from that address).
    from: read("MAIL_FROM") || (read("SMTP_USER") ? `Krishi Roth <${read("SMTP_USER")}>` : "Krishi Roth <no-reply@krishiroth.local>")
  },

  // Wallet: the platform's own numbers that users send "Add balance" money to.
  // Leave a number empty to hide that method.
  wallet: {
    numbers: {
      bkash: read("WALLET_BKASH_NUMBER"),
      nagad: read("WALLET_NAGAD_NUMBER"),
      rocket: read("WALLET_ROCKET_NUMBER")
    },
    minDeposit: Number(read("WALLET_MIN_DEPOSIT", "50")) || 50,
    maxDeposit: Number(read("WALLET_MAX_DEPOSIT", "100000")) || 100000,
    minWithdrawal: Number(read("WALLET_MIN_WITHDRAWAL", "100")) || 100,
    // Secret key in the SMS-forwarder webhook URL. Empty = automatic SMS verification is off.
    smsSecret: read("WALLET_SMS_SECRET")
  },

  // Social sign-in. Leave empty to switch a provider off.
  social: {
    googleClientId: read("GOOGLE_CLIENT_ID"),
    // Apple "Services ID" (e.g. com.example.krishiroth.web)
    appleClientId: read("APPLE_CLIENT_ID")
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
