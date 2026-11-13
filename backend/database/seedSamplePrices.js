/**
 * Fills market_prices with SAMPLE prices (source = 'sample') for every crop
 * in every district for the last 7 days, so the price pages have data to show.
 *
 *   npm run prices:sample              add / refresh sample prices
 *   npm run prices:sample -- --remove  delete all sample prices
 *
 * These numbers are approximate and generated: they are NOT real market
 * rates. The website labels them "নমুনা" (sample). Prices that an admin
 * enters (source = 'admin') are never touched by this script.
 */
const { assertEnv, DB_SETTINGS } = require("../config/env");

const DAYS = 7;
const NOTE = "নমুনা দাম (আসল বাজারদর নয়) / Sample price, not a real market rate";

// Rough base price (taka) per crop's default unit.
const BASE = {
  paddy: 1300, rice: 62, wheat: 1600, maize: 1150,
  brinjal: 45, tomato: 55, cauliflower: 35, cabbage: 30, "bitter-gourd": 70, pumpkin: 35,
  "bottle-gourd": 45, okra: 50, "green-chili": 90, cucumber: 45, spinach: 15, "red-amaranth": 12,
  mango: 110, jackfruit: 170, banana: 90, litchi: 250, guava: 70, papaya: 45, pineapple: 40,
  lentil: 120, "mung-bean": 140, "grass-pea": 85,
  mustard: 3400, sesame: 160, groundnut: 140,
  onion: 70, garlic: 160, ginger: 170, turmeric: 220, "dry-chili": 320,
  potato: 30, "sweet-potato": 40, jute: 3100
};

// Deterministic 0..1 noise so re-runs give the same numbers.
function noise(...parts) {
  let h = 2166136261;
  for (const ch of parts.join("|")) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

function round(n) {
  if (n >= 1000) return Math.round(n / 10) * 10;
  if (n >= 100) return Math.round(n);
  return Math.round(n * 2) / 2;
}

async function seed(db) {
  const [crops] = await db.query("SELECT id, slug, default_unit FROM crops WHERE is_active = 1");
  const [districts] = await db.query("SELECT id, division_id, name_bn FROM districts");

  const rows = [];
  for (const crop of crops) {
    const base = BASE[crop.slug] || 50;
    for (const d of districts) {
      const divisionFactor = 0.92 + noise(crop.slug, "div", d.division_id) * 0.16; // ±8 %
      const districtFactor = 0.95 + noise(crop.slug, d.id) * 0.1; // ±5 %
      for (let day = DAYS - 1; day >= 0; day--) {
        const dayFactor = 0.97 + noise(crop.slug, d.id, day) * 0.06; // ±3 %
        const mid = base * divisionFactor * districtFactor * dayFactor;
        const spread = 0.04 + noise(crop.slug, d.id, day, "s") * 0.05;
        const min = round(mid * (1 - spread));
        const max = Math.max(min, round(mid * (1 + spread)));
        rows.push([crop.id, `${d.name_bn} সদর বাজার`, d.id, crop.default_unit, min, max, day]);
      }
    }
  }

  // Remove old sample rows first so the window always ends today.
  await db.query("DELETE FROM market_prices WHERE source = 'sample'");

  const BATCH = 1000;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const values = chunk.map(() => "(?, ?, ?, ?, ?, ?, DATE_SUB(CURDATE(), INTERVAL ? DAY), 'sample', ?)").join(",");
    // INSERT IGNORE: never overwrite an admin price for the same crop/market/day.
    await db.query(
      `INSERT IGNORE INTO market_prices
         (crop_id, market_name, district_id, unit, min_price, max_price, price_date, source, source_note)
       VALUES ${values}`,
      chunk.flatMap((r) => [...r, NOTE])
    );
  }
  console.log(`Sample prices written: ${rows.length} (${crops.length} crops × ${districts.length} districts × ${DAYS} days).`);
  console.log("These are SAMPLE numbers, not real market rates. Remove with: npm run prices:sample -- --remove");
}

async function remove(db) {
  const [r] = await db.query("DELETE FROM market_prices WHERE source = 'sample'");
  console.log(`Removed ${r.affectedRows} sample prices.`);
}

async function main() {
  assertEnv(DB_SETTINGS);
  const db = require("../config/db");
  try {
    await (process.argv.includes("--remove") ? remove(db) : seed(db));
  } catch (error) {
    console.error(`Sample price seed failed: ${db.describeConnectionError ? db.describeConnectionError(error) : error.message}`);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

main();
