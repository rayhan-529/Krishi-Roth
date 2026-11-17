/**
 * Krishi Roth API server
 *   npm run dev     (development, restarts on changes)
 *   npm start       (production)
 */
const { config, assertEnv, SERVER_SETTINGS } = require("./config/env");

// Stop immediately with a clear message if .env is incomplete.
try {
  assertEnv(SERVER_SETTINGS);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const db = require("./config/db");
const language = require("./middleware/language");
const { apiLimiter } = require("./middleware/rateLimit");
const { PUBLIC_DIR } = require("./middleware/upload");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const { startScheduler } = require("./services/reminderService");
const { runMigrations } = require("./database/migrate");
const { storageDriver } = require("./services/storageService");
const { status: aiStatus } = require("./services/aiService");
const apiRoutes = require("./routes");

const app = express();

// Behind a hosting proxy (Render, Railway, Nginx) this makes req.ip the real visitor IP,
// which the rate limiter needs.
if (config.trustProxy) app.set("trust proxy", 1);
app.disable("x-powered-by");

// ---- Security and parsing -------------------------------------------
app.use(
  helmet({
    // Photos are loaded by the frontend from another domain.
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

const allowedOrigins = config.clientUrl.split(",").map((url) => url.trim().replace(/\/$/, "")).filter(Boolean);
app.use(
  cors({
    origin(origin, callback) {
      // Requests without an Origin header (curl, health checks) are allowed.
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    }
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(language);

// ---- Public photos (local storage driver) ---------------------------
app.use("/uploads", express.static(PUBLIC_DIR, { maxAge: "7d", index: false, dotfiles: "deny" }));

// ---- Routes ----------------------------------------------------------
app.get("/", (req, res) => {
  res.json({ success: true, message: "Krishi Roth API is running", data: { docs: "/api/health" } });
});

app.get("/api/health", async (req, res) => {
  const result = await db.checkConnection();
  res.status(result.ok ? 200 : 503).json({
    success: result.ok,
    message: result.ok ? "Krishi Roth API is running" : "Database is not ready",
    data: { database: result.message, storage: storageDriver(), ai: aiStatus().configured ? "configured" : "not configured" }
  });
});

app.use("/api", apiLimiter, apiRoutes);

// ---- 404 and error handler (must stay last) --------------------------
app.use(notFound);
app.use(errorHandler);

// ---- Start -----------------------------------------------------------
app.listen(config.port, async () => {
  console.log(`Krishi Roth API running at http://localhost:${config.port}`);
  console.log(`Allowed frontend origin(s): ${allowedOrigins.join(", ")}`);
  console.log(`Photo storage: ${storageDriver()} | AI chatbot: ${aiStatus().configured ? aiStatus().provider : "not configured"}`);

  const result = await db.checkConnection();
  console.log(result.ok ? result.message : `WARNING: ${result.message}`);
  if (!result.ok) return;

  // Add any new tables/columns this version needs (additive only, never deletes data).
  try {
    const changes = await runMigrations();
    if (changes.length) console.log(`Database upgraded: ${changes.join(", ")}`);
  } catch (error) {
    console.error("WARNING: database upgrade failed:", error.message);
  }
  startScheduler();
});
