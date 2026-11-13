/**
 * Fills the site with realistic demo data so no page or report is empty.
 *
 *   npm run demo:seed               add all demo data
 *   npm run demo:seed -- --remove   delete everything this script added
 *
 * What it adds
 *   - demo farmers, buyers, labourers, harvester/tractor/transport owners
 *   - crop listings (বিজ্ঞাপন), machinery, transport vehicles, labour profiles
 *   - purchase offers + trades spread over the last 12 months
 *   - service bookings, harvests, expense notebooks, reviews,
 *     complaints, announcements and activity-log entries
 *
 * All demo accounts use emails ending in @demo.krishiroth.local and the
 * password "demo12345". Running it again does not create duplicates:
 * each part is skipped when its demo data already exists.
 * Real (non-demo) accounts are never touched.
 */
const bcrypt = require("bcryptjs");
const { assertEnv, DB_SETTINGS } = require("../config/env");
const { BCRYPT_ROUNDS } = require("../utils/password");

const DEMO_DOMAIN = "@demo.krishiroth.local";
const DEMO_PASSWORD = "demo12345";
const ANNOUNCEMENT_TAG = "[ডেমো] ";

// Fixed-seed random numbers, so every run produces the same demo data.
let seedState = 20261113;
function rand() {
  seedState = (seedState + 0x6d2b79f5) | 0;
  let t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (list) => list[Math.floor(rand() * list.length)];
const between = (min, max) => min + Math.floor(rand() * (max - min + 1));
const round = (n, step = 1) => Math.round(n / step) * step;

// ---------------------------------------------------------------------
// Demo people (district ids come from seed.sql)
// ---------------------------------------------------------------------
const FARMERS = [
  {
    key: "karim", name: "আব্দুল করিম", district: 51, upazila: "পবা", verified: true,
    listings: [
      { crop: "mango", variety: "হিমসাগর", qty: 800, unit: "kg", price: 120, min: 20, days: -3,
        desc: "রাসায়নিকমুক্ত হিমসাগর আম, গাছ থেকে সরাসরি পাড়া। ক্যারেটে প্যাক করে দেওয়া হবে।" },
      { crop: "litchi", variety: "বোম্বাই", qty: 300, unit: "kg", price: 260, min: 10, days: -2,
        desc: "টাটকা বোম্বাই লিচু, মিষ্টি ও রসালো।" },
      { crop: "paddy", variety: "ব্রি ধান-২৮", qty: 120, unit: "maund", price: 1350, min: 10, days: -10,
        desc: "শুকনো ও পরিষ্কার ধান, গুদামে রাখা আছে।" }
    ]
  },
  {
    key: "rahima", name: "রহিমা বেগম", district: 45, upazila: "শিবগঞ্জ", verified: true,
    listings: [
      { crop: "potato", variety: "ডায়মন্ড", qty: 5000, unit: "kg", price: 28, min: 200, days: -15,
        desc: "হিমাগার থেকে তোলা ভালো মানের আলু। বড় পরিমাণে নিলে দাম আলোচনা সাপেক্ষ।" },
      { crop: "green-chili", variety: null, qty: 250, unit: "kg", price: 90, min: 10, days: -1,
        desc: "আজকের তোলা টাটকা কাঁচা মরিচ।" },
      { crop: "red-amaranth", variety: null, qty: 400, unit: "bundle", price: 15, min: 50, days: 0,
        desc: "জৈব সারে চাষ করা লাল শাক।" }
    ]
  },
  {
    key: "selim", name: "মোঃ সেলিম উদ্দিন", district: 33, upazila: "ঝিকরগাছা", verified: false,
    listings: [
      { crop: "cauliflower", variety: "স্নোবল", qty: 1500, unit: "piece", price: 35, min: 100, days: -2,
        desc: "বড় সাইজের সাদা ফুলকপি, পাইকারি বিক্রি।" },
      { crop: "tomato", variety: "বারি টমেটো-১৪", qty: 900, unit: "kg", price: 45, min: 50, days: -1,
        desc: "লাল ও শক্ত টমেটো, দূরে পাঠানোর উপযোগী।" },
      { crop: "brinjal", variety: "খটখটিয়া", qty: 600, unit: "kg", price: 40, min: 30, days: -2,
        desc: "বিষমুক্ত বেগুন, ফেরোমন ফাঁদ ব্যবহার করে চাষ।" }
    ]
  },
  {
    key: "nasrin", name: "নাসরিন আক্তার", district: 42, upazila: "ত্রিশাল", verified: true,
    listings: [
      { crop: "jackfruit", variety: null, qty: 250, unit: "piece", price: 180, min: 10, days: -4,
        desc: "পাকা ও মিষ্টি কাঁঠাল, প্রতিটি ৬-১০ কেজি।" },
      { crop: "pineapple", variety: "হানিকুইন", qty: 1200, unit: "piece", price: 40, min: 50, days: -3,
        desc: "মধুপুরের হানিকুইন আনারস।" },
      { crop: "ginger", variety: null, qty: 350, unit: "kg", price: 160, min: 20, days: -20,
        desc: "দেশি আদা, ভালোভাবে শুকানো।" }
    ]
  },
  {
    key: "jamal", name: "জামাল হোসেন", district: 59, upazila: "মিঠাপুকুর", verified: false,
    listings: [
      { crop: "maize", variety: "হাইব্রিড", qty: 200, unit: "maund", price: 1100, min: 20, days: -12,
        desc: "শুকনো ভুট্টার দানা, পোলট্রি খাদ্যের জন্য উপযুক্ত।" },
      { crop: "onion", variety: "তাহেরপুরী", qty: 2000, unit: "kg", price: 65, min: 100, days: -25,
        desc: "ঝাঁঝালো দেশি পেঁয়াজ, ভালো সংরক্ষণযোগ্য।" },
      { crop: "jute", variety: "তোষা", qty: 80, unit: "maund", price: 3200, min: 5, days: -30,
        desc: "সোনালি আঁশের উন্নত মানের তোষা পাট।" }
    ]
  },
  {
    key: "habib", name: "হাবিবুর রহমান", district: 64, upazila: "জৈন্তাপুর", verified: true,
    listings: [
      { crop: "banana", variety: "সাগর কলা", qty: 300, unit: "dozen", price: 70, min: 20, days: -2,
        desc: "পুষ্ট ও পাকা সাগর কলা, পাইকারি দামে।" },
      { crop: "turmeric", variety: null, qty: 400, unit: "kg", price: 140, min: 25, days: -18,
        desc: "পাহাড়ি জমির হলুদ, রোদে শুকানো।" },
      { crop: "pumpkin", variety: null, qty: 700, unit: "kg", price: 30, min: 50, days: -5,
        desc: "বড় সাইজের মিষ্টি কুমড়া।" }
    ]
  },
  {
    key: "shahana", name: "শাহানা পারভীন", district: 36, upazila: "কুমারখালী", verified: true,
    listings: [
      { crop: "lentil", variety: "বারি মসুর-৮", qty: 600, unit: "kg", price: 115, min: 40, days: -40,
        desc: "চিকন দানার দেশি মসুর ডাল, পরিষ্কার করা।" },
      { crop: "garlic", variety: "দেশি", qty: 500, unit: "kg", price: 180, min: 20, days: -35,
        desc: "ঝাঁঝালো দেশি রসুন, শুকনো।" },
      { crop: "mustard", variety: "বারি সরিষা-১৪", qty: 40, unit: "maund", price: 3600, min: 5, days: -50,
        desc: "তেলের জন্য উন্নত মানের সরিষা।" }
    ]
  },
  {
    key: "anwar", name: "আনোয়ার হোসেন", district: 30, upazila: "মধুপুর", verified: false,
    listings: [
      { crop: "guava", variety: "থাই পেয়ারা", qty: 900, unit: "kg", price: 60, min: 40, days: -2,
        desc: "বড় ও কচকচে থাই পেয়ারা।" },
      { crop: "papaya", variety: null, qty: 600, unit: "kg", price: 45, min: 30, days: -3,
        desc: "সবুজ ও পাকা দুই ধরনের পেঁপে পাওয়া যাবে।" },
      { crop: "cucumber", variety: null, qty: 500, unit: "kg", price: 35, min: 30, days: -1,
        desc: "টাটকা শসা, প্রতিদিন তোলা হয়।" }
    ]
  }
];

const BUYERS = [
  { key: "buyer.faruk", name: "ফারুক ট্রেডার্স", district: 18, upazila: "কারওয়ান বাজার", verified: true },
  { key: "buyer.salma", name: "সালমা এন্টারপ্রাইজ", district: 10, upazila: "পাহাড়তলী", verified: true },
  { key: "buyer.mizan", name: "মিজানুর রহমান", district: 35, upazila: "সোনাডাঙ্গা", verified: false },
  { key: "buyer.rupa", name: "রুপা ফুডস লিমিটেড", district: 20, upazila: "টঙ্গী", verified: true }
];

const LABOURERS = [
  { key: "labour.babul", name: "বাবুল মিয়া", district: 51, upazila: "পবা", verified: true,
    skills: "ধান কাটা, চারা রোপণ, নিড়ানি", years: 12, wage: 700,
    details: "১২ বছর ধরে ধান ও সবজি খেতে কাজ করছি। দলসহ কাজ করতে পারি।" },
  { key: "labour.rafiq", name: "রফিকুল ইসলাম", district: 59, upazila: "পীরগঞ্জ", verified: false,
    skills: "আলু তোলা, সেচ, কীটনাশক স্প্রে", years: 6, wage: 650,
    details: "আলু ও ভুট্টা খেতে অভিজ্ঞ। নিজের স্প্রে মেশিন আছে।" },
  { key: "labour.morjina", name: "মর্জিনা খাতুন", district: 33, upazila: "ঝিকরগাছা", verified: true,
    skills: "সবজি তোলা, বাছাই ও প্যাকিং", years: 8, wage: 550,
    details: "ফুল ও সবজি বাছাই ও প্যাকিংয়ে দক্ষ।" }
];

const MACHINE_OWNERS = [
  { key: "harvester.sumon", name: "সুমন এগ্রো সার্ভিস", role: "harvester_owner", district: 48, upazila: "মান্দা", verified: true,
    machines: [
      { type: "harvester", name: "কম্বাইন হারভেস্টার", brand: "Kubota", model: "DC-70G", year: 2022, hp: 70,
        price: 3500, unit: "per_bigha", desc: "ধান ও গম কাটা, মাড়াই ও ঝাড়াই একসাথে। অভিজ্ঞ চালকসহ।" },
      { type: "harvester", name: "মিনি রিপার", brand: "Yanmar", model: "AW-22", year: 2021, hp: 22,
        price: 1800, unit: "per_bigha", desc: "ছোট জমির জন্য উপযুক্ত ধান কাটার যন্ত্র।" }
    ] },
  { key: "harvester.nur", name: "নূর হারভেস্টিং", role: "harvester_owner", district: 61, upazila: "বানিয়াচং", verified: false,
    machines: [
      { type: "harvester", name: "হাওর কম্বাইন হারভেস্টার", brand: "ACI", model: "Foton", year: 2023, hp: 88,
        price: 4000, unit: "per_bigha", desc: "হাওর এলাকার বোরো ধান দ্রুত কাটার জন্য।" }
    ] },
  { key: "tractor.alamgir", name: "আলমগীর ট্রাক্টর সার্ভিস", role: "tractor_owner", district: 45, upazila: "শেরপুর", verified: true,
    machines: [
      { type: "tractor", name: "মাহিন্দ্রা ট্রাক্টর", brand: "Mahindra", model: "575 DI", year: 2020, hp: 45,
        price: 1200, unit: "per_hour", desc: "জমি চাষ, রোটাভেটর ও ট্রলি সুবিধাসহ।" },
      { type: "tractor", name: "পাওয়ার টিলার", brand: "Dongfeng", model: "DF-12", year: 2019, hp: 12,
        price: 900, unit: "per_bigha", desc: "ছোট জমি চাষের জন্য সাশ্রয়ী।" }
    ] },
  { key: "tractor.kamal", name: "কামাল হোসেন", role: "tractor_owner", district: 12, upazila: "চান্দিনা", verified: true,
    machines: [
      { type: "tractor", name: "সোনালিকা ট্রাক্টর", brand: "Sonalika", model: "DI-750", year: 2021, hp: 50,
        price: 6000, unit: "per_day", desc: "সারাদিনের জন্য ভাড়া, চালক ও জ্বালানিসহ।" }
    ] }
];

const TRANSPORT_OWNERS = [
  { key: "transport.jahid", name: "জাহিদ পরিবহন", district: 52, upazila: "উল্লাপাড়া", verified: true,
    vehicles: [
      { type: "truck", name: "৫ টন ট্রাক", reg: "ঢাকা মেট্রো ট-১১-২২৩৩", cap: 5, capUnit: "ton", price: 45, unit: "per_km",
        desc: "সারা দেশে ফসল পরিবহন। ত্রিপল ঢাকা দেওয়া হয়।" },
      { type: "covered_van", name: "কাভার্ড ভ্যান", reg: "সিরাজগঞ্জ ন-১১-৪৫৬৭", cap: 3, capUnit: "ton", price: 9000, unit: "per_trip",
        desc: "সবজি ও ফলের জন্য ঢাকা গাড়ি।" }
    ] },
  { key: "transport.sohel", name: "সোহেল পিকআপ সার্ভিস", district: 33, upazila: "যশোর সদর", verified: false,
    vehicles: [
      { type: "pickup", name: "পিকআপ ভ্যান", reg: "যশোর ন-১৩-৭৮৯০", cap: 1.5, capUnit: "ton", price: 3500, unit: "per_trip",
        desc: "কাছাকাছি বাজারে দ্রুত পণ্য পৌঁছে দেওয়া।" }
    ] },
  { key: "transport.belal", name: "বেলাল নৌ পরিবহন", district: 3, upazila: "চরফ্যাশন", verified: true,
    vehicles: [
      { type: "boat", name: "ইঞ্জিন নৌকা", reg: null, cap: 4, capUnit: "ton", price: 5000, unit: "per_day",
        desc: "চর ও নদী এলাকা থেকে ফসল আনা-নেওয়া।" },
      { type: "nosimon", name: "নছিমন", reg: null, cap: 30, capUnit: "maund", price: 1500, unit: "per_trip",
        desc: "গ্রামের রাস্তায় অল্প দূরত্বে পরিবহন।" }
    ] }
];

const COMPLAINTS = [
  { category: "delivery", status: "open", subject: "পণ্য সময়মতো পৌঁছায়নি",
    description: "অর্ডার করা আলু নির্ধারিত তারিখের দুই দিন পরে এসেছে। পরিবহন খরচ নিয়েও ঝামেলা হয়েছে।" },
  { category: "quality", status: "in_review", subject: "টমেটোর মান খারাপ ছিল",
    description: "ছবিতে যেমন দেখানো হয়েছিল, পাওয়া টমেটো তেমন ছিল না। প্রায় ২০% নষ্ট।" },
  { category: "payment", status: "resolved", subject: "বিকাশ পেমেন্ট নিশ্চিত হচ্ছিল না",
    description: "বিকাশে টাকা পাঠানোর পরেও কৃষক পেমেন্ট নিশ্চিত করেননি।",
    admin_note: "দুই পক্ষের সাথে কথা বলে লেনদেন নিশ্চিত করা হয়েছে।" },
  { category: "service", status: "dismissed", subject: "হারভেস্টার দেরিতে এসেছে",
    description: "বুকিংয়ের দিন হারভেস্টার তিন ঘণ্টা দেরিতে এসেছে।",
    admin_note: "বৃষ্টির কারণে দেরি হয়েছিল, প্রমাণ দেখানো হয়েছে।" },
  { category: "behaviour", status: "open", subject: "ক্রেতার আচরণ ভালো ছিল না",
    description: "দরদাম নিয়ে ক্রেতা অশোভন ভাষা ব্যবহার করেছেন।" }
];

const ANNOUNCEMENTS = [
  { title: "আমন মৌসুমের বাজারদর হালনাগাদ", target: null, daysAgo: 2,
    body: "সারা দেশের প্রধান বাজারগুলোর ধান ও সবজির সর্বশেষ বাজারদর যোগ করা হয়েছে। বিক্রির আগে বাজারদর পাতা দেখে নিন।" },
  { title: "কৃষকদের জন্য যাচাইকরণ ক্যাম্পেইন", target: "farmer", daysAgo: 9,
    body: "এনআইডি দিয়ে প্রোফাইল যাচাই করুন। যাচাই করা কৃষকদের বিজ্ঞাপন ক্রেতারা বেশি বিশ্বাস করেন।" },
  { title: "নিরাপদ লেনদেনের নিয়ম", target: "buyer", daysAgo: 20,
    body: "পণ্য বুঝে না পাওয়া পর্যন্ত লেনদেন 'সম্পন্ন' করবেন না। কোনো সমস্যা হলে অভিযোগ পাতা থেকে জানান।" },
  { title: "বোরো ধান কাটার মৌসুমে আগাম বুকিং করুন", target: null, daysAgo: 45,
    body: "হারভেস্টার ও শ্রমিকের চাহিদা বাড়ছে। প্রয়োজনের অন্তত এক সপ্তাহ আগে বুকিং দিন।" }
];

const TRADE_REVIEWS = [
  "ভালো মানের পণ্য, সময়মতো পেয়েছি।", "দাম ন্যায্য, আবার কিনব।", "কৃষক খুব আন্তরিক ছিলেন।",
  "প্যাকিং ভালো ছিল, কোনো পণ্য নষ্ট হয়নি।", "ছবির সাথে পণ্যের মিল আছে।", "পরিমাণে একটু কম ছিল।"
];
const BOOKING_REVIEWS = [
  "সময়মতো এসে কাজ শেষ করেছেন।", "দক্ষ ও পরিশ্রমী।", "যন্ত্র ভালো অবস্থায় ছিল।",
  "ভাড়া একটু বেশি, তবে কাজ ভালো।", "আবার বুকিং দেব।"
];

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
async function upsertUser(db, person, role, passwordHash) {
  const email = `${person.key}${DEMO_DOMAIN}`;
  const [rows] = await db.execute("SELECT id FROM users WHERE email = ?", [email]);
  if (rows[0]) return { id: rows[0].id, created: false };

  const createdDaysAgo = between(120, 360);
  const [r] = await db.execute(
    `INSERT INTO users (name, email, password_hash, role, district_id, upazila, verification_status,
                        created_at, last_login_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY), DATE_SUB(NOW(), INTERVAL ? DAY))`,
    [person.name, email, passwordHash, role, person.district, person.upazila,
      person.verified ? "verified" : "unverified", createdDaysAgo, between(0, 10)]
  );
  return { id: r.insertId, created: true };
}

async function count(db, sql, params) {
  const [[row]] = await db.query(sql, params);
  return Number(row.n);
}

const ago = (days, hours = 0) => `DATE_SUB(NOW(), INTERVAL ${Number(days) * 24 + Number(hours)} HOUR)`;

// ---------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------
async function seed(db) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);
  const [crops] = await db.query("SELECT id, slug, default_unit FROM crops");
  const cropBySlug = Object.fromEntries(crops.map((c) => [c.slug, c]));
  const [categories] = await db.query("SELECT id, code FROM expense_categories");
  const categoryId = Object.fromEntries(categories.map((c) => [c.code, c.id]));
  const [[admin]] = await db.query("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1");
  const adminId = admin ? admin.id : null;

  const added = {};
  const bump = (name, n = 1) => { added[name] = (added[name] || 0) + n; };

  // ---- People --------------------------------------------------------
  const farmers = [];
  for (const f of FARMERS) {
    const u = await upsertUser(db, f, "farmer", passwordHash);
    if (u.created) bump("farmers");
    farmers.push({ ...f, id: u.id });
  }
  const buyers = [];
  for (const b of BUYERS) {
    const u = await upsertUser(db, b, "buyer", passwordHash);
    if (u.created) bump("buyers");
    buyers.push({ ...b, id: u.id });
  }
  const labourers = [];
  for (const l of LABOURERS) {
    const u = await upsertUser(db, l, "labour", passwordHash);
    if (u.created) bump("labourers");
    labourers.push({ ...l, id: u.id });
  }
  const machineOwners = [];
  for (const m of MACHINE_OWNERS) {
    const u = await upsertUser(db, m, m.role, passwordHash);
    if (u.created) bump("machine owners");
    machineOwners.push({ ...m, id: u.id });
  }
  const transportOwners = [];
  for (const t of TRANSPORT_OWNERS) {
    const u = await upsertUser(db, t, "transport_owner", passwordHash);
    if (u.created) bump("transport owners");
    transportOwners.push({ ...t, id: u.id });
  }

  // ---- Active crop listings (বিজ্ঞাপন) ------------------------------
  for (const f of farmers) {
    if (await count(db, "SELECT COUNT(*) n FROM crop_listings WHERE farmer_id = ?", [f.id])) continue;
    for (const l of f.listings) {
      const crop = cropBySlug[l.crop];
      if (!crop) { console.warn(`  skipped: crop "${l.crop}" not found`); continue; }
      await db.query(
        `INSERT INTO crop_listings
           (farmer_id, crop_id, variety, quantity, quantity_available, unit, price_per_unit,
            min_order_quantity, is_negotiable, district_id, upazila, harvest_date, description, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, DATE_ADD(CURDATE(), INTERVAL ? DAY), ?, 'active', ${ago(between(0, 6), between(0, 20))})`,
        [f.id, crop.id, l.variety, l.qty, l.qty, l.unit, l.price, l.min, f.district, f.upazila, l.days, l.desc]
      );
      bump("active listings");
    }
  }

  // ---- Labour profiles ----------------------------------------------
  for (const l of labourers) {
    if (await count(db, "SELECT COUNT(*) n FROM labour_profiles WHERE user_id = ?", [l.id])) continue;
    await db.query(
      `INSERT INTO labour_profiles (user_id, skills, experience_years, experience_details, daily_wage,
                                    district_id, upazila, is_available, available_from)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURDATE())`,
      [l.id, l.skills, l.years, l.details, l.wage, l.district, l.upazila]
    );
    await db.query("INSERT IGNORE INTO provider_service_areas (user_id, district_id, upazila) VALUES (?, ?, '')", [l.id, l.district]);
    bump("labour profiles");
  }

  // ---- Machinery ----------------------------------------------------
  const machines = [];
  for (const o of machineOwners) {
    let [rows] = await db.query("SELECT id, machine_type, rental_price, price_unit FROM machinery WHERE owner_id = ?", [o.id]);
    if (rows.length === 0) {
      for (const m of o.machines) {
        await db.query(
          `INSERT INTO machinery (owner_id, machine_type, name, brand, model, model_year, horsepower, description,
                                  rental_price, price_unit, district_id, upazila, is_available, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'active', ${ago(between(100, 300))})`,
          [o.id, m.type, m.name, m.brand, m.model, m.year, m.hp, m.desc, m.price, m.unit, o.district, o.upazila]
        );
        bump("machines");
      }
      await db.query("INSERT IGNORE INTO provider_service_areas (user_id, district_id, upazila) VALUES (?, ?, '')", [o.id, o.district]);
      [rows] = await db.query("SELECT id, machine_type, rental_price, price_unit FROM machinery WHERE owner_id = ?", [o.id]);
    }
    rows.forEach((r) => machines.push({ ...r, owner_id: o.id, district: o.district }));
  }

  // ---- Transport vehicles -------------------------------------------
  const vehicles = [];
  for (const o of transportOwners) {
    let [rows] = await db.query("SELECT id, price, price_unit FROM transport_vehicles WHERE owner_id = ?", [o.id]);
    if (rows.length === 0) {
      for (const v of o.vehicles) {
        await db.query(
          `INSERT INTO transport_vehicles (owner_id, vehicle_type, name, registration_number, capacity, capacity_unit,
                                           price, price_unit, district_id, upazila, description, is_available, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'active', ${ago(between(100, 300))})`,
          [o.id, v.type, v.name, v.reg, v.cap, v.capUnit, v.price, v.unit, o.district, o.upazila, v.desc]
        );
        bump("vehicles");
      }
      await db.query("INSERT IGNORE INTO provider_service_areas (user_id, district_id, upazila) VALUES (?, ?, '')", [o.id, o.district]);
      [rows] = await db.query("SELECT id, price, price_unit FROM transport_vehicles WHERE owner_id = ?", [o.id]);
    }
    rows.forEach((r) => vehicles.push({ ...r, owner_id: o.id, district: o.district }));
  }

  const demoIds = [...farmers, ...buyers, ...labourers, ...machineOwners, ...transportOwners].map((p) => p.id);

  // ---- Trades over the last 12 months (sold listings + offers + trades)
  const tradeIds = [];
  if (!(await count(db, "SELECT COUNT(*) n FROM trade_records WHERE buyer_id IN (?)", [buyers.map((b) => b.id)]))) {
    const sellable = farmers.flatMap((f) => f.listings.map((l) => ({ farmer: f, ...l })));
    const TRADES = 48;
    for (let i = 0; i < TRADES; i++) {
      // More trades in recent months, a few in every month.
      const daysAgo = i < 12 ? i * 29 + between(0, 20) : Math.floor(Math.pow(rand(), 1.6) * 340);
      const item = pick(sellable);
      const crop = cropBySlug[item.crop];
      if (!crop) continue;
      const buyer = pick(buyers);
      const price = round(item.price * (0.85 + rand() * 0.3), item.price >= 500 ? 10 : 1);
      const qty = round(Math.max(item.min || 1, item.qty * (0.1 + rand() * 0.4)), item.qty >= 1000 ? 50 : 5);
      const total = Math.round(qty * price * 100) / 100;

      let status;
      if (daysAgo > 25) {
        const r = rand();
        status = r < 0.8 ? "completed" : r < 0.93 ? "cancelled" : "disputed";
      } else {
        status = pick(["payment_pending", "payment_confirmed", "delivery_pending", "completed", "completed"]);
      }

      const [listing] = await db.query(
        `INSERT INTO crop_listings
           (farmer_id, crop_id, variety, quantity, quantity_available, unit, price_per_unit, min_order_quantity,
            is_negotiable, district_id, upazila, harvest_date, description, status, created_at)
         VALUES (?, ?, ?, ?, 0, ?, ?, ?, 1, ?, ?, DATE_SUB(CURDATE(), INTERVAL ? DAY), ?, ?, ${ago(daysAgo + 3)})`,
        [item.farmer.id, crop.id, item.variety, qty, item.unit, item.price, item.min, item.farmer.district,
          item.farmer.upazila, daysAgo + 5, item.desc, status === "cancelled" ? "expired" : status === "completed" ? "sold" : "reserved"]
      );
      bump("sold listings");

      const [offer] = await db.query(
        `INSERT INTO purchase_offers (listing_id, buyer_id, farmer_id, quantity, unit, offered_price_per_unit,
                                      message, status, responded_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'accepted', ${ago(daysAgo)}, ${ago(daysAgo + 1)})`,
        [listing.insertId, buyer.id, item.farmer.id, qty, item.unit, price, "পাইকারি দামে নিতে চাই, দ্রুত ডেলিভারি দরকার।"]
      );
      bump("offers");

      const paid = ["payment_confirmed", "delivery_pending", "completed", "disputed"].includes(status);
      const delivered = ["completed", "disputed"].includes(status);
      const [trade] = await db.query(
        `INSERT INTO trade_records
           (offer_id, listing_id, buyer_id, farmer_id, quantity, unit, price_per_unit, total_amount, status,
            payment_method, payment_reference, payment_marked_at, payment_confirmed_at, delivery_method,
            delivery_address, expected_delivery_date, delivered_at, buyer_confirmed_at, completed_at,
            cancelled_at, cancelled_by, cancel_reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${paid ? ago(daysAgo, -6) : "NULL"}, ${paid ? ago(daysAgo, -10) : "NULL"},
                 ?, ?, DATE_ADD(DATE_SUB(CURDATE(), INTERVAL ? DAY), INTERVAL 3 DAY),
                 ${delivered ? ago(Math.max(daysAgo - 2, 0)) : "NULL"},
                 ${status === "completed" ? ago(Math.max(daysAgo - 2, 0), -2) : "NULL"},
                 ${status === "completed" ? ago(Math.max(daysAgo - 2, 0), -2) : "NULL"},
                 ${status === "cancelled" ? ago(daysAgo, -12) : "NULL"}, ?, ?, ${ago(daysAgo)})`,
        [offer.insertId, listing.insertId, buyer.id, item.farmer.id, qty, item.unit, price, total, status,
          status === "payment_pending" || status === "cancelled" ? null : pick(["bkash", "nagad", "cash", "bank_transfer"]),
          paid ? `TX${between(10000000, 99999999)}` : null,
          pick(["buyer_pickup", "farmer_delivery", "transport_service"]),
          `${buyer.upazila}, গুদাম নং ${between(1, 20)}`, daysAgo,
          status === "cancelled" ? buyer.id : null,
          status === "cancelled" ? "পরিবহন পাওয়া যায়নি, তাই অর্ডার বাতিল।" : null]
      );
      tradeIds.push({ id: trade.insertId, status, buyer: buyer.id, farmer: item.farmer.id, daysAgo });
      bump("trades");

      await db.query(
        `INSERT INTO trade_status_history (trade_id, from_status, to_status, changed_by, created_at)
         VALUES (?, NULL, 'payment_pending', ?, ${ago(daysAgo)})`,
        [trade.insertId, item.farmer.id]
      );
      if (status !== "payment_pending") {
        await db.query(
          `INSERT INTO trade_status_history (trade_id, from_status, to_status, changed_by, created_at)
           VALUES (?, 'payment_pending', ?, ?, ${ago(Math.max(daysAgo - 2, 0))})`,
          [trade.insertId, status, status === "cancelled" ? buyer.id : item.farmer.id]
        );
      }
    }

    // A few offers that are still waiting for the farmer's answer.
    const [open] = await db.query(
      "SELECT id, farmer_id, unit, price_per_unit, quantity_available FROM crop_listings WHERE farmer_id IN (?) AND status = 'active' LIMIT 8",
      [farmers.map((f) => f.id)]
    );
    for (const l of open) {
      await db.query(
        `INSERT INTO purchase_offers (listing_id, buyer_id, farmer_id, quantity, unit, offered_price_per_unit, message, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${ago(between(0, 4), between(1, 20))})`,
        [l.id, pick(buyers).id, l.farmer_id, round(Number(l.quantity_available) * 0.2, 5) || 1, l.unit,
          round(Number(l.price_per_unit) * 0.92, 1), "দাম একটু কমালে পুরোটা নিতে পারি।", pick(["pending", "pending", "rejected"])]
      );
      bump("offers");
    }

    // Reviews: buyers review farmers on most completed trades.
    for (const t of tradeIds.filter((x) => x.status === "completed")) {
      if (rand() < 0.25) continue;
      await db.query(
        `INSERT IGNORE INTO reviews (reviewer_id, reviewee_id, trade_id, rating, comment, created_at)
         VALUES (?, ?, ?, ?, ?, ${ago(Math.max(t.daysAgo - 3, 0))})`,
        [t.buyer, t.farmer, t.id, pick([5, 5, 4, 4, 4, 3]), pick(TRADE_REVIEWS)]
      );
      bump("reviews");
    }
  }

  // ---- Bookings (labour, harvester, tractor, transport) ---------------
  if (!(await count(db, "SELECT COUNT(*) n FROM bookings WHERE requester_id IN (?)", [farmers.map((f) => f.id)]))) {
    const providers = [
      ...labourers.map((l) => ({ type: "labour", provider: l.id, price: l.wage, unit: "per_day", sizeUnit: null })),
      ...machines.map((m) => ({ type: m.machine_type, provider: m.owner_id, machinery: m.id, price: Number(m.rental_price),
        unit: m.price_unit, sizeUnit: m.price_unit === "per_bigha" ? "bigha" : m.price_unit === "per_hour" ? "hour" : null })),
      ...vehicles.map((v) => ({ type: "transport", provider: v.owner_id, vehicle: v.id, price: Number(v.price),
        unit: v.price_unit, sizeUnit: v.price_unit === "per_km" ? "km" : null }))
    ];
    const BOOKINGS = 34;
    for (let i = 0; i < BOOKINGS; i++) {
      const p = providers[i % providers.length];
      const farmer = pick(farmers);
      const daysAgo = i < providers.length ? between(0, 30) : between(5, 330);
      const startOffset = -daysAgo + between(1, 6);
      const length = p.type === "transport" ? 0 : between(0, 3);
      const size = p.sizeUnit === "bigha" ? between(2, 15) : p.sizeUnit === "hour" ? between(3, 10) : p.sizeUnit === "km" ? between(20, 250) : null;
      const units = size || (p.unit === "per_day" ? length + 1 : 1) * (p.type === "labour" ? between(2, 6) : 1);
      const total = Math.round(p.price * units);

      let status;
      if (startOffset < -3) status = pick(["completed", "completed", "completed", "cancelled", "rejected"]);
      else status = pick(["pending", "accepted", "in_progress", "pending"]);

      const [b] = await db.query(
        `INSERT INTO bookings
           (booking_type, requester_id, provider_id, machinery_id, transport_vehicle_id, start_date, end_date,
            work_district_id, work_upazila, work_address, destination, work_size, work_size_unit, quoted_price,
            price_unit, estimated_total, requester_note, provider_note, status, responded_at, completed_at,
            cancelled_at, cancelled_by, created_at)
         VALUES (?, ?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL ? DAY), DATE_ADD(CURDATE(), INTERVAL ? DAY),
                 ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                 ${status === "pending" ? "NULL" : ago(daysAgo, -5)},
                 ${status === "completed" ? ago(Math.max(daysAgo - 4, 0)) : "NULL"},
                 ${status === "cancelled" ? ago(daysAgo, -8) : "NULL"}, ?, ${ago(daysAgo)})`,
        [p.type, farmer.id, p.provider, p.machinery || null, p.vehicle || null, startOffset, startOffset + length,
          farmer.district, farmer.upazila, `${farmer.upazila}, উত্তর মাঠ`,
          p.type === "transport" ? pick(["কারওয়ান বাজার, ঢাকা", "চট্টগ্রাম রেয়াজউদ্দিন বাজার", "যশোর বড় বাজার"]) : null,
          size, p.sizeUnit, p.price, p.unit, total,
          pick(["সকাল ৭টার মধ্যে আসবেন।", "জমি রাস্তার পাশেই।", "বৃষ্টির আগে কাজ শেষ করতে হবে।", null]),
          status === "rejected" ? "ওই তারিখে অন্য জায়গায় বুকিং আছে।" : status === "accepted" ? "ঠিক সময়ে পৌঁছে যাব।" : null,
          status, status === "cancelled" ? farmer.id : null]
      );
      bump("bookings");

      if (status === "completed" && rand() < 0.75) {
        await db.query(
          `INSERT IGNORE INTO reviews (reviewer_id, reviewee_id, booking_id, rating, comment, created_at)
           VALUES (?, ?, ?, ?, ?, ${ago(Math.max(daysAgo - 5, 0))})`,
          [farmer.id, p.provider, b.insertId, pick([5, 5, 4, 4, 3]), pick(BOOKING_REVIEWS)]
        );
        bump("reviews");
      }
    }
  }

  // ---- Harvests -----------------------------------------------------
  if (!(await count(db, "SELECT COUNT(*) n FROM harvests WHERE farmer_id IN (?)", [farmers.map((f) => f.id)]))) {
    const plans = [
      ["paddy", "ব্রি ধান-৮৯", "bigha", "maund"], ["potato", "ডায়মন্ড", "bigha", "kg"], ["maize", "হাইব্রিড", "bigha", "maund"],
      ["tomato", "বারি-১৪", "decimal", "kg"], ["onion", "তাহেরপুরী", "bigha", "kg"], ["mustard", "বারি-১৪", "bigha", "maund"],
      ["jute", "তোষা", "bigha", "maund"], ["brinjal", null, "decimal", "kg"], ["wheat", "বারি গম-৩৩", "bigha", "maund"],
      ["lentil", "বারি মসুর-৮", "bigha", "kg"], ["cauliflower", "স্নোবল", "decimal", "piece"], ["garlic", null, "decimal", "kg"]
    ];
    const statuses = ["planned", "growing", "growing", "ready", "harvesting", "completed", "completed", "completed"];
    for (const f of farmers) {
      for (let k = 0; k < 3; k++) {
        const [slug, variety, landUnit, qtyUnit] = pick(plans);
        const crop = cropBySlug[slug];
        if (!crop) continue;
        const status = pick(statuses);
        const land = landUnit === "decimal" ? between(20, 120) : between(1, 8);
        const expected = qtyUnit === "maund" ? land * between(15, 25) : qtyUnit === "piece" ? land * 40 : land * (landUnit === "decimal" ? 40 : 2500);
        const plantedAgo = status === "planned" ? -between(5, 30) : status === "completed" ? between(120, 300) : between(30, 100);
        const harvestIn = status === "completed" ? -(plantedAgo - between(80, 110)) : between(-5, 60);
        await db.query(
          `INSERT INTO harvests (farmer_id, crop_id, variety, field_name, land_size, land_unit, expected_quantity,
                                 actual_quantity, quantity_unit, planting_date, expected_harvest_date, actual_harvest_date,
                                 status, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_SUB(CURDATE(), INTERVAL ? DAY), DATE_ADD(CURDATE(), INTERVAL ? DAY),
                   ${status === "completed" ? "DATE_ADD(CURDATE(), INTERVAL ? DAY)" : "?"}, ?, ?, ${ago(Math.max(plantedAgo, 1) + 2)})`,
          [f.id, crop.id, variety, pick(["উত্তর মাঠ", "পুকুর পাড়ের জমি", "বাড়ির পাশের খেত", "নদীর ধারের জমি"]),
            land, landUnit, expected, status === "completed" ? round(expected * (0.85 + rand() * 0.25)) : null,
            qtyUnit, plantedAgo, harvestIn, status === "completed" ? harvestIn : null, status,
            pick(["সময়মতো সেচ দিতে হবে।", "পোকার আক্রমণ কম ছিল।", "এবার ফলন ভালো আশা করছি।", null])]
        );
        bump("harvests");
      }
    }
  }

  // ---- Expense notebooks (খরচের খাতা) -------------------------------
  if (!(await count(db, "SELECT COUNT(*) n FROM expense_notebooks WHERE farmer_id IN (?)", [farmers.map((f) => f.id)]))) {
    const BOOKS = [
      { crop: "paddy", title: "বোরো ধান ২০২৬", season: "boro", rows: [
        ["বীজ (ব্রি ধান-৮৯)", "seed", 20, "kg", 70], ["ইউরিয়া সার", "fertilizer", 60, "kg", 27], ["টিএসপি সার", "fertilizer", 30, "kg", 30],
        ["জমি চাষ (ট্রাক্টর)", "land_preparation", 3, "bigha", 1200], ["সেচ", "irrigation", 3, "bigha", 2500],
        ["রোপণ শ্রমিক", "labour", 8, "day", 650], ["কীটনাশক", "pesticide", 2, "bottle", 450], ["ধান কাটা (হারভেস্টার)", "machinery_rent", 3, "bigha", 3500] ] },
      { crop: "potato", title: "আলু চাষ — রবি মৌসুম", season: "rabi", rows: [
        ["বীজ আলু", "seed", 600, "kg", 45], ["সার (ইউরিয়া+পটাশ)", "fertilizer", 150, "kg", 32], ["জমি চাষ", "land_preparation", 2, "bigha", 1100],
        ["সেচ", "irrigation", 4, "time", 900], ["শ্রমিক", "labour", 12, "day", 600], ["হিমাগার ভাড়া", "storage", 60, "bag", 280], ["পরিবহন", "transport", 2, "trip", 3500] ] },
      { crop: "tomato", title: "টমেটো খেত", season: "rabi", rows: [
        ["চারা", "seed", 1500, "piece", 3], ["জৈব সার", "fertilizer", 10, "bag", 400], ["মাচা ও খুঁটি", "other", 1, "lot", 4500],
        ["কীটনাশক স্প্রে", "pesticide", 4, "time", 600], ["শ্রমিক", "labour", 10, "day", 550] ] },
      { crop: "maize", title: "ভুট্টা ২০২৬", season: "rabi", rows: [
        ["হাইব্রিড বীজ", "seed", 8, "kg", 650], ["সার", "fertilizer", 120, "kg", 28], ["জমি বর্গা", "land_lease", 1, "season", 18000],
        ["সেচ", "irrigation", 5, "time", 1000], ["মাড়াই", "machinery_rent", 1, "lot", 6000] ] },
      { crop: "mango", title: "আম বাগান পরিচর্যা", season: "year_round", rows: [
        ["ছত্রাকনাশক", "pesticide", 6, "time", 1200], ["সার", "fertilizer", 80, "kg", 30], ["ফ্রুট ব্যাগ", "other", 3000, "piece", 2],
        ["পাড়া ও প্যাকিং শ্রমিক", "labour", 15, "day", 600], ["ক্যারেট", "storage", 100, "piece", 120], ["ট্রাক ভাড়া", "transport", 2, "trip", 9000] ] },
      { crop: "onion", title: "পেঁয়াজ চাষ", season: "rabi", rows: [
        ["বীজ", "seed", 2, "kg", 3200], ["সার", "fertilizer", 100, "kg", 30], ["নিড়ানি শ্রমিক", "labour", 9, "day", 600],
        ["সেচ", "irrigation", 6, "time", 800] ] }
    ];
    for (let i = 0; i < BOOKS.length; i++) {
      const book = BOOKS[i];
      const farmer = farmers[i % farmers.length];
      const crop = cropBySlug[book.crop];
      const startAgo = between(60, 220);
      const [n] = await db.query(
        `INSERT INTO expense_notebooks (farmer_id, crop_id, title, season, year, notes, created_at)
         VALUES (?, ?, ?, ?, 2026, ?, ${ago(startAgo)})`,
        [farmer.id, crop ? crop.id : null, book.title, book.season, "মৌসুমের সব খরচ এখানে লিখে রাখছি।"]
      );
      bump("notebooks");
      let line = 0;
      for (const [item, cat, qty, unit, price] of book.rows) {
        await db.query(
          `INSERT INTO expenses (notebook_id, line_no, item_name, category_id, quantity, unit, unit_price, expense_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, DATE_SUB(CURDATE(), INTERVAL ? DAY))`,
          [n.insertId, ++line, item, categoryId[cat] || categoryId.other, qty, unit, price, Math.max(startAgo - line * 7, 0)]
        );
        bump("expense rows");
      }
    }
  }

  // ---- Complaints ---------------------------------------------------
  if (!(await count(db, "SELECT COUNT(*) n FROM complaints WHERE complainant_id IN (?)", [demoIds]))) {
    for (let i = 0; i < COMPLAINTS.length; i++) {
      const c = COMPLAINTS[i];
      const complainant = i % 2 === 0 ? buyers[i % buyers.length] : farmers[i % farmers.length];
      const against = i % 2 === 0 ? farmers[(i + 1) % farmers.length] : buyers[(i + 1) % buyers.length];
      const daysAgo = between(1, 60);
      const done = c.status === "resolved" || c.status === "dismissed";
      await db.query(
        `INSERT INTO complaints (complainant_id, against_user_id, category, subject, description, status, admin_note,
                                 handled_by, resolved_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${done ? ago(Math.max(daysAgo - 2, 0)) : "NULL"}, ${ago(daysAgo)})`,
        [complainant.id, against.id, c.category, c.subject, c.description, c.status, c.admin_note || null,
          c.status === "open" ? null : adminId]
      );
      bump("complaints");
    }
  }

  // ---- Announcements ------------------------------------------------
  for (const a of ANNOUNCEMENTS) {
    const title = ANNOUNCEMENT_TAG + a.title;
    if (await count(db, "SELECT COUNT(*) n FROM announcements WHERE title = ?", [title])) continue;
    await db.query(
      `INSERT INTO announcements (title, body, target_role, created_by, created_at) VALUES (?, ?, ?, ?, ${ago(a.daysAgo)})`,
      [title, a.body, a.target, adminId]
    );
    bump("announcements");
  }

  // ---- Activity log -------------------------------------------------
  if (!(await count(db, "SELECT COUNT(*) n FROM activity_logs WHERE actor_id IN (?)", [demoIds]))) {
    const events = [];
    for (const p of [...farmers, ...buyers, ...labourers, ...machineOwners, ...transportOwners]) {
      events.push([p.id, "user.register", "user", p.id, between(120, 360)]);
      events.push([p.id, "user.login", "user", p.id, between(0, 10)]);
    }
    const [listings] = await db.query("SELECT id, farmer_id, created_at FROM crop_listings WHERE farmer_id IN (?) ORDER BY id DESC LIMIT 20", [farmers.map((f) => f.id)]);
    listings.forEach((l) => events.push([l.farmer_id, "listing.create", "listing", l.id, between(0, 30)]));
    const [trades] = await db.query("SELECT id, buyer_id, farmer_id FROM trade_records WHERE buyer_id IN (?) ORDER BY id DESC LIMIT 15", [buyers.map((b) => b.id)]);
    trades.forEach((t) => {
      events.push([t.buyer_id, "offer.create", "offer", t.id, between(1, 40)]);
      events.push([t.farmer_id, "offer.accept", "trade", t.id, between(0, 39)]);
    });
    const [books] = await db.query("SELECT id, provider_id, requester_id FROM bookings WHERE requester_id IN (?) ORDER BY id DESC LIMIT 12", [farmers.map((f) => f.id)]);
    books.forEach((b) => events.push([b.requester_id, "booking.create", "booking", b.id, between(0, 40)]));
    machines.forEach((m) => events.push([m.owner_id, "machinery.create", "machinery", m.id, between(100, 300)]));
    vehicles.forEach((v) => events.push([v.owner_id, "vehicle.create", "vehicle", v.id, between(100, 300)]));

    for (const [actor, action, entity, entityId, daysAgo] of events) {
      await db.query(
        `INSERT INTO activity_logs (actor_id, action, entity_type, entity_id, ip_address, created_at)
         VALUES (?, ?, ?, ?, '127.0.0.1', ${ago(daysAgo, between(0, 23))})`,
        [actor, action, entity, entityId]
      );
    }
    bump("activity entries", events.length);
  }

  const summary = Object.entries(added).map(([k, v]) => `${k}: ${v}`).join(", ");
  console.log(summary ? `Demo data added — ${summary}.` : "Demo data already present, nothing new added.");
  console.log(`Demo login: <name>${DEMO_DOMAIN} / ${DEMO_PASSWORD}`);
  console.log(`  farmer: karim${DEMO_DOMAIN}   buyer: buyer.faruk${DEMO_DOMAIN}   labour: labour.babul${DEMO_DOMAIN}`);
}

// ---------------------------------------------------------------------
// Remove everything the script added
// ---------------------------------------------------------------------
async function remove(db) {
  const [users] = await db.query("SELECT id FROM users WHERE email LIKE ?", [`%${DEMO_DOMAIN}`]);
  const [ann] = await db.query("DELETE FROM announcements WHERE title LIKE ?", [`${ANNOUNCEMENT_TAG}%`]);
  if (users.length === 0) {
    console.log(ann.affectedRows ? `Removed ${ann.affectedRows} demo announcements.` : "No demo data found.");
    return;
  }
  const ids = [users.map((u) => u.id)];
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const steps = [
      ["DELETE FROM reviews WHERE reviewer_id IN (?) OR reviewee_id IN (?)", [...ids, ...ids]],
      ["DELETE FROM complaints WHERE complainant_id IN (?) OR against_user_id IN (?)", [...ids, ...ids]],
      ["DELETE h FROM trade_status_history h JOIN trade_records t ON t.id = h.trade_id WHERE t.buyer_id IN (?) OR t.farmer_id IN (?)", [...ids, ...ids]],
      ["DELETE FROM trade_records WHERE buyer_id IN (?) OR farmer_id IN (?)", [...ids, ...ids]],
      ["DELETE FROM purchase_offers WHERE buyer_id IN (?) OR farmer_id IN (?)", [...ids, ...ids]],
      ["DELETE FROM bookings WHERE requester_id IN (?) OR provider_id IN (?)", [...ids, ...ids]],
      ["DELETE m FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.farmer_id IN (?) OR c.buyer_id IN (?)", [...ids, ...ids]],
      ["DELETE FROM conversations WHERE farmer_id IN (?) OR buyer_id IN (?)", [...ids, ...ids]],
      ["DELETE i FROM crop_listing_images i JOIN crop_listings l ON l.id = i.listing_id WHERE l.farmer_id IN (?)", ids],
      ["DELETE FROM crop_listings WHERE farmer_id IN (?)", ids],
      ["DELETE i FROM machinery_images i JOIN machinery m ON m.id = i.machinery_id WHERE m.owner_id IN (?)", ids],
      ["DELETE FROM machinery WHERE owner_id IN (?)", ids],
      ["DELETE i FROM transport_vehicle_images i JOIN transport_vehicles v ON v.id = i.vehicle_id WHERE v.owner_id IN (?)", ids],
      ["DELETE FROM transport_vehicles WHERE owner_id IN (?)", ids],
      ["DELETE FROM labour_profiles WHERE user_id IN (?)", ids],
      ["DELETE FROM provider_service_areas WHERE user_id IN (?)", ids],
      ["DELETE e FROM expenses e JOIN expense_notebooks n ON n.id = e.notebook_id WHERE n.farmer_id IN (?)", ids],
      ["DELETE FROM expense_notebooks WHERE farmer_id IN (?)", ids],
      ["DELETE FROM harvests WHERE farmer_id IN (?)", ids],
      ["DELETE FROM notifications WHERE user_id IN (?)", ids],
      ["DELETE FROM activity_logs WHERE actor_id IN (?)", ids],
      ["DELETE FROM user_sessions WHERE user_id IN (?)", ids],
      ["DELETE FROM user_verifications WHERE user_id IN (?)", ids],
      ["DELETE FROM chatbot_conversations WHERE user_id IN (?)", ids],
      ["DELETE FROM users WHERE id IN (?)", ids]
    ];
    for (const [sql, params] of steps) await conn.query(sql, params);
    await conn.commit();
    console.log(`Removed ${users.length} demo accounts with all their data, and ${ann.affectedRows} demo announcements.`);
  } catch (e) {
    await conn.rollback();
    if (e.code === "ER_ROW_IS_REFERENCED_2") {
      throw new Error("A real account is linked to demo data (offer, trade, booking or message). Remove that first, or reset the DB.");
    }
    throw e;
  } finally {
    conn.release();
  }
}

async function main() {
  assertEnv(DB_SETTINGS);
  const db = require("../config/db");
  try {
    await (process.argv.includes("--remove") ? remove(db) : seed(db));
  } catch (error) {
    console.error(`Demo seed failed: ${db.describeConnectionError ? db.describeConnectionError(error) : error.message}`);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

main();
