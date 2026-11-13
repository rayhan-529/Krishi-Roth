/**
 * Lookup lists the frontend needs for dropdowns and labels:
 * roles, divisions, districts, crop categories, crops, expense categories.
 * The frontend loads this once and caches it.
 */
const db = require("../config/db");
const { send } = require("../utils/response");

async function lookups(req, res) {
  const [roles] = await db.query(
    "SELECT code, name_bn, name_en, is_self_registrable, is_service_provider FROM roles ORDER BY FIELD(code, 'farmer','buyer','labour','harvester_owner','tractor_owner','transport_owner','admin')"
  );
  const [divisions] = await db.query("SELECT id, name_bn, name_en FROM divisions ORDER BY id");
  const [districts] = await db.query("SELECT id, division_id, name_bn, name_en FROM districts ORDER BY name_en");
  const [cropCategories] = await db.query("SELECT id, slug, name_bn, name_en FROM crop_categories ORDER BY sort_order");
  const [crops] = await db.query(
    "SELECT id, category_id, slug, name_bn, name_en, default_unit FROM crops WHERE is_active = 1 ORDER BY category_id, name_en"
  );
  const [expenseCategories] = await db.query(
    "SELECT id, code, name_bn, name_en FROM expense_categories ORDER BY sort_order"
  );

  res.set("Cache-Control", "public, max-age=300");
  send(req, res, {
    data: {
      roles,
      divisions,
      districts,
      crop_categories: cropCategories,
      crops,
      expense_categories: expenseCategories
    }
  });
}

/** Real platform numbers for the home page (no invented figures). */
async function publicStats(req, res) {
  const [[stats]] = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM users WHERE role = 'farmer' AND is_blocked = 0) AS farmers,
       (SELECT COUNT(*) FROM users WHERE role = 'buyer' AND is_blocked = 0) AS buyers,
       (SELECT COUNT(*) FROM users WHERE role IN ('labour','harvester_owner','tractor_owner','transport_owner')
          AND is_blocked = 0) AS service_providers,
       (SELECT COUNT(*) FROM crop_listings WHERE status = 'active') AS active_listings,
       (SELECT COUNT(*) FROM trade_records WHERE status = 'completed') AS completed_trades,
       (SELECT COUNT(*) FROM market_prices) AS market_prices`
  );
  res.set("Cache-Control", "public, max-age=120");
  send(req, res, { data: stats });
}

module.exports = { lookups, publicStats };
