/**
 * Live facts for the chatbot, read from our own database before the AI answers.
 *
 * The question is scanned for crop names, district names and topic words
 * ("দাম", "বৃষ্টি", "ব্যালেন্স", "অর্ডার" ...). Matching data is fetched here and
 * handed to the AI as context, so it can say "আজ ঢাকায় আলু ৳ 30-35/কেজি"
 * from real numbers instead of guessing. This works with every AI provider
 * (no function-calling needed) and the AI never touches the database itself:
 * a user only ever sees their OWN wallet and trades.
 */
const db = require("../config/db");
const weather = require("./weatherService");
const { adviceFor } = require("./weatherAdvice");

const TOPICS = {
  price: /দাম|দর|বাজারদর|বাজার দর|মূল্য|কত টাকা|কেজি কত|মণ কত|price|rate|cost of|market/i,
  weather: /আবহাওয়া|আবহাওয়া|বৃষ্টি|ঝড়|ঝড়|তাপমাত্রা|গরম|শীত|কুয়াশা|কুয়াশা|রোদ|বাতাস|বন্যা|weather|rain|storm|temperature|forecast|wind|fog/i,
  wallet: /ব্যালেন্স|ওয়ালেট|ওয়ালেট|জমা|টাকা তোল|টাকা উত্তোলন|উইথড্র|ডিপোজিট|balance|wallet|deposit|withdraw/i,
  trades: /লেনদেন|অর্ডার|ট্রেড|ডেলিভারি|প্রস্তাব|অফার|কেনা|বিক্রি|সেফ ট্রেড|trade|order|delivery|offer|purchase|escrow/i
};

// Endings that can follow a Bangla name: আলুর, ধানের, ঢাকায়, ঢাকাতে, আমটা ...
const SUFFIX = /^(|র|ের|এর|ে|য়|য়|তে|য়ে|য়ে|টা|টি|গুলো|গুলোর|ও|ই|s)(?=$|[\s.,?!।:;'"()\-])/;
const UNIT_BN = { kg: "কেজি", maund: "মণ", ton: "টন", piece: "পিস", dozen: "ডজন", hali: "হালি", bundle: "আঁটি", crate: "ক্যারেট" };

let lookups = null; // { crops, districts } cached for 10 minutes
let lookupsAt = 0;

async function getLookups() {
  if (lookups && Date.now() - lookupsAt < 10 * 60 * 1000) return lookups;
  const [crops] = await db.query("SELECT id, name_bn, name_en FROM crops WHERE is_active = 1");
  const [districts] = await db.query("SELECT id, name_bn, name_en FROM districts");
  lookups = { crops, districts };
  lookupsAt = Date.now();
  return lookups;
}

/**
 * Finds which items are named in the text. Longer names win, so "মিষ্টি আলু"
 * is not also read as "আলু", and "আম" inside "আমার" is not a mango.
 */
function findNamed(text, items) {
  let rest = ` ${text.toLowerCase()} `;
  const names = items
    .flatMap((item) => [item.name_bn, item.name_en.toLowerCase()].filter(Boolean).map((name) => ({ item, name })))
    .sort((a, b) => b.name.length - a.name.length);
  const found = new Map();
  for (const { item, name } of names) {
    let from = 0;
    for (;;) {
      const at = rest.indexOf(name, from);
      if (at === -1) break;
      const before = rest[at - 1];
      const after = rest.slice(at + name.length);
      if (/[\s.,?!।:;'"(\-]/.test(before) && SUFFIX.test(after)) {
        found.set(item.id, item);
        rest = rest.slice(0, at) + " ".repeat(name.length) + after; // blank it so shorter names do not match inside
        break;
      }
      from = at + 1;
    }
  }
  return [...found.values()];
}

const taka = (n) => `৳ ${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

// ------------------------------------------------------------ fetchers
async function priceFacts(crops, districts) {
  const lines = [];
  for (const crop of crops.slice(0, 3)) {
    const params = [crop.id];
    let where = "mp.crop_id = ?";
    if (districts.length) {
      where += ` AND mp.district_id IN (${districts.map(() => "?").join(",")})`;
      params.push(...districts.map((d) => d.id));
    }
    // Newest date for this crop (and district), then every market on that date.
    const [rows] = await db.query(
      `SELECT mp.market_name, mp.unit, mp.min_price, mp.max_price, mp.price_date, d.name_bn AS district
       FROM market_prices mp JOIN districts d ON d.id = mp.district_id
       WHERE ${where} AND mp.price_date = (SELECT MAX(price_date) FROM market_prices mp WHERE ${where})
       ORDER BY d.name_bn LIMIT 8`,
      [...params, ...params]
    );
    if (rows.length === 0) {
      lines.push(`- ${crop.name_bn} (${crop.name_en}): no price in the Krishi Roth database${districts.length ? " for that district" : ""}.`);
      continue;
    }
    lines.push(`- ${crop.name_bn} (${crop.name_en}), prices dated ${rows[0].price_date}:`);
    for (const r of rows) {
      lines.push(`  • ${r.district}, ${r.market_name}: ${taka(r.min_price)} - ${taka(r.max_price)} per ${UNIT_BN[r.unit] || r.unit}`);
    }
  }
  return lines.length ? `MARKET PRICES (from the Krishi Roth market price page):\n${lines.join("\n")}` : "";
}

async function weatherFacts(district) {
  try {
    const data = await weather.getForecast(district.id);
    const c = data.current;
    const days = data.daily.slice(0, 4).map((d, i) =>
      `  • ${i === 0 ? "today" : i === 1 ? "tomorrow" : d.date}: ${d.bn}, ${Math.round(d.min)}-${Math.round(d.max)}°C, rain chance ${d.rain_chance ?? 0}%, rain ${d.rain_mm ?? 0} mm, wind up to ${Math.round(d.wind_max ?? 0)} km/h`
    );
    const tips = adviceFor(data).map((t) => `  • ${t.bn}`);
    return [
      `WEATHER for ${district.name_bn} (${district.name_en}) district, source Open-Meteo:`,
      `  • now: ${c.bn}, ${Math.round(c.temperature)}°C, humidity ${c.humidity}%, wind ${Math.round(c.wind)} km/h`,
      ...days,
      tips.length ? "  Farming tips for this forecast:" : "",
      ...tips
    ].filter(Boolean).join("\n");
  } catch {
    return `WEATHER: not available right now for ${district.name_en}.`;
  }
}

async function walletFacts(userId) {
  const [[wallet]] = await db.query("SELECT available, escrow, pending_withdrawal FROM wallets WHERE user_id = ?", [userId]);
  const [deposits] = await db.query(
    "SELECT amount, method, status, created_at FROM wallet_deposits WHERE user_id = ? ORDER BY id DESC LIMIT 3",
    [userId]
  );
  const [withdrawals] = await db.query(
    "SELECT amount, method, status, created_at FROM wallet_withdrawals WHERE user_id = ? ORDER BY id DESC LIMIT 3",
    [userId]
  );
  const w = wallet || { available: 0, escrow: 0, pending_withdrawal: 0 };
  return [
    "THIS USER'S WALLET:",
    `  • available balance ${taka(w.available)}, held in Safe Trade ${taka(w.escrow)}, waiting to be withdrawn ${taka(w.pending_withdrawal)}`,
    ...deposits.map((d) => `  • deposit ${taka(d.amount)} by ${d.method} on ${d.created_at.slice(0, 10)}: ${d.status}`),
    ...withdrawals.map((d) => `  • withdrawal ${taka(d.amount)} to ${d.method} on ${d.created_at.slice(0, 10)}: ${d.status}`)
  ].join("\n");
}

async function tradeFacts(userId) {
  const [rows] = await db.query(
    `SELECT t.id, t.status, t.escrow_status, t.total_amount, t.quantity, t.unit, t.auto_release_at, t.created_at,
            c.name_bn AS crop, IF(t.buyer_id = ?, 'buyer', 'farmer') AS my_side,
            IF(t.buyer_id = ?, f.name, b.name) AS other_party
     FROM trade_records t
     JOIN crop_listings l ON l.id = t.listing_id
     JOIN crops c ON c.id = l.crop_id
     JOIN users b ON b.id = t.buyer_id
     JOIN users f ON f.id = t.farmer_id
     WHERE t.buyer_id = ? OR t.farmer_id = ?
     ORDER BY t.id DESC LIMIT 5`,
    [userId, userId, userId, userId]
  );
  if (rows.length === 0) return "THIS USER'S TRADES: none yet.";
  return [
    "THIS USER'S LATEST TRADES (statuses: payment_pending = buyer has not paid yet, payment_confirmed = money held in Safe Trade, delivery_pending = farmer started delivery, completed, cancelled, disputed):",
    ...rows.map((t) =>
      `  • trade #${t.id}: ${t.quantity} ${UNIT_BN[t.unit] || t.unit} ${t.crop}, ${taka(t.total_amount)}, user is the ${t.my_side}, other party ${t.other_party}, status ${t.status}, Safe Trade money ${t.escrow_status}${t.auto_release_at && t.status === "delivery_pending" ? `, auto-release to farmer on ${t.auto_release_at.slice(0, 10)}` : ""}`
    )
  ].join("\n");
}

/**
 * @param {object} user  req.user (id, name, role, district_id)
 * @param {string} question
 * @returns {Promise<{ text: string, used: string[] }>} context for the AI and which live sources were used
 */
async function liveContext(user, question) {
  const { crops, districts } = await getLookups();
  const namedCrops = findNamed(question, crops);
  const namedDistricts = findNamed(question, districts);
  const homeDistrict = districts.find((d) => d.id === user.district_id);
  const parts = [];
  const used = [];

  const tasks = [];
  if (namedCrops.length && TOPICS.price.test(question)) {
    tasks.push(priceFacts(namedCrops, namedDistricts).then((t) => t && (parts.push(t), used.push("market_prices"))));
  }
  if (TOPICS.weather.test(question)) {
    const district = namedDistricts[0] || homeDistrict || districts.find((d) => d.id === 18);
    if (district) tasks.push(weatherFacts(district).then((t) => (parts.push(t), used.push("weather"))));
  }
  if (TOPICS.wallet.test(question)) tasks.push(walletFacts(user.id).then((t) => (parts.push(t), used.push("wallet"))));
  if (TOPICS.trades.test(question)) tasks.push(tradeFacts(user.id).then((t) => (parts.push(t), used.push("trades"))));
  await Promise.all(tasks.map((t) => t.catch((error) => console.error("[chat context]", error.message))));

  const profile = `THE USER: ${user.name}, role ${user.role}${homeDistrict ? `, lives in ${homeDistrict.name_bn} (${homeDistrict.name_en}) district` : ""}. Today is ${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" })}.`;
  return { text: [profile, ...parts].join("\n\n"), used };
}

module.exports = { liveContext, findNamed };
