/**
 * Crop market prices.
 *   Public: list latest prices (search/filter), compare markets for a crop.
 *   Admin:  add, edit, delete prices.
 *
 * Prices are entered by admins (source = 'admin'). No live government
 * price feed is connected; the UI says so.
 */
const db = require("../config/db");
const v = require("../utils/validator");
const ApiError = require("../utils/ApiError");
const { send } = require("../utils/response");
const { getPagination, paginate } = require("../utils/pagination");
const { sqlFilter } = require("../utils/sqlFilter");
const { notifyMany } = require("../services/notificationService");
const { logActivity } = require("../services/activityService");
const { UNITS } = require("./listingController");

const priceFields = {
  crop_id: v.id().required(),
  market_name: v.string().required().min(2).max(120),
  district_id: v.id().required(),
  unit: v.enum(UNITS).required(),
  min_price: v.number().required().min(0).max(99999999),
  max_price: v.number().required().min(0).max(99999999),
  price_date: v.date().required(),
  source_note: v.string().max(255)
};

const schemas = {
  save: priceFields,
  list: {
    q: v.string().max(100),
    crop_id: v.id(),
    category_id: v.id(),
    district_id: v.id(),
    division_id: v.id(),
    history: v.boolean().default(false),
    page: v.integer(),
    limit: v.integer()
  },
  compare: { crop_id: v.id().required(), unit: v.enum(UNITS) },
  matrix: {
    q: v.string().max(100),
    category_id: v.id(),
    division_id: v.id()
  }
};

const PRICE_SELECT = `
  SELECT mp.id, mp.crop_id, c.name_bn AS crop_bn, c.name_en AS crop_en, c.category_id,
         cc.name_bn AS category_bn, cc.name_en AS category_en, mp.market_name, mp.district_id,
         d.name_bn AS district_bn, d.name_en AS district_en, dv.name_bn AS division_bn, dv.name_en AS division_en,
         mp.unit, mp.min_price, mp.max_price, ROUND((mp.min_price + mp.max_price) / 2, 2) AS avg_price,
         mp.price_date, mp.source, mp.source_note, mp.updated_at`;

const PRICE_FROM = `
  FROM market_prices mp
  JOIN crops c ON c.id = mp.crop_id
  JOIN crop_categories cc ON cc.id = c.category_id
  JOIN districts d ON d.id = mp.district_id
  JOIN divisions dv ON dv.id = d.division_id`;

// Only the newest price of each crop at each market (unless history is requested).
const LATEST_ONLY = `mp.price_date = (
  SELECT MAX(m2.price_date) FROM market_prices m2
  WHERE m2.crop_id = mp.crop_id AND m2.market_name = mp.market_name
    AND m2.district_id = mp.district_id AND m2.unit = mp.unit)`;

async function list(req, res) {
  const f = req.q;
  const filter = sqlFilter();
  if (!f.history) filter.add(LATEST_ONLY);
  filter.search(f.q, ["c.name_bn", "c.name_en", "mp.market_name"]);
  if (f.crop_id) filter.add("mp.crop_id = ?", f.crop_id);
  if (f.category_id) filter.add("c.category_id = ?", f.category_id);
  if (f.district_id) filter.add("mp.district_id = ?", f.district_id);
  if (f.division_id) filter.add("d.division_id = ?", f.division_id);

  const { rows, meta } = await paginate(db, {
    selectSql: PRICE_SELECT,
    fromSql: `${PRICE_FROM} ${filter.where}`,
    params: filter.params,
    orderSql: "ORDER BY mp.price_date DESC, c.name_en, mp.market_name",
    paging: getPagination(req.query, 20)
  });

  const [[latest]] = await db.query("SELECT MAX(updated_at) AS last_updated FROM market_prices");
  send(req, res, { data: rows, meta: { ...meta, last_updated: latest.last_updated } });
}

/**
 * Every crop's latest average price in each division (or in each district
 * of one division when division_id is given): one row per crop and unit.
 */
async function matrix(req, res) {
  const f = req.q;
  const filter = sqlFilter(LATEST_ONLY);
  filter.search(f.q, ["c.name_bn", "c.name_en", "mp.market_name", "d.name_bn", "d.name_en"]);
  if (f.category_id) filter.add("c.category_id = ?", f.category_id);
  if (f.division_id) filter.add("d.division_id = ?", f.division_id);
  const col = f.division_id ? "mp.district_id" : "d.division_id";

  const [cells] = await db.query(
    `SELECT mp.crop_id, mp.unit, ${col} AS col_id,
            ROUND(AVG((mp.min_price + mp.max_price) / 2), 2) AS avg_price,
            MIN(mp.min_price) AS min_price, MAX(mp.max_price) AS max_price, COUNT(*) AS markets
     ${PRICE_FROM} ${filter.where}
     GROUP BY mp.crop_id, mp.unit, ${col}`,
    filter.params
  );
  const [totals] = await db.query(
    `SELECT mp.crop_id, MIN(c.name_bn) AS crop_bn, MIN(c.name_en) AS crop_en,
            MIN(cc.name_bn) AS category_bn, MIN(cc.name_en) AS category_en, mp.unit,
            ROUND(AVG((mp.min_price + mp.max_price) / 2), 2) AS avg_price,
            MIN(mp.min_price) AS min_price, MAX(mp.max_price) AS max_price,
            COUNT(*) AS markets, MAX(mp.price_date) AS price_date,
            SUM(mp.source = 'sample') AS sample_count
     ${PRICE_FROM} ${filter.where}
     GROUP BY mp.crop_id, mp.unit
     ORDER BY MIN(c.category_id), MIN(c.name_en)`,
    filter.params
  );

  const rows = totals.map((t) => ({
    ...t,
    is_sample: Number(t.sample_count) > 0,
    cells: Object.fromEntries(
      cells
        .filter((c) => c.crop_id === t.crop_id && c.unit === t.unit)
        .map((c) => [c.col_id, { avg_price: c.avg_price, min_price: c.min_price, max_price: c.max_price, markets: c.markets }])
    )
  }));
  send(req, res, { data: { by: f.division_id ? "district" : "division", rows } });
}

/** Latest price of one crop at every market, plus the recent price trend. */
async function compare(req, res) {
  const [[crop]] = await db.query("SELECT id, name_bn, name_en, default_unit FROM crops WHERE id = ?", [req.q.crop_id]);
  if (!crop) throw ApiError.notFound("ফসলটি পাওয়া যায়নি।", "Crop not found.");

  let unit = req.q.unit;
  if (!unit) {
    const [[common]] = await db.query(
      "SELECT unit FROM market_prices WHERE crop_id = ? GROUP BY unit ORDER BY COUNT(*) DESC LIMIT 1",
      [crop.id]
    );
    unit = common ? common.unit : crop.default_unit;
  }

  const [markets] = await db.query(
    `${PRICE_SELECT} ${PRICE_FROM} WHERE mp.crop_id = ? AND mp.unit = ? AND ${LATEST_ONLY} ORDER BY avg_price ASC`,
    [crop.id, unit]
  );

  const [trend] = await db.query(
    `SELECT price_date, ROUND(AVG((min_price + max_price) / 2), 2) AS avg_price,
            MIN(min_price) AS min_price, MAX(max_price) AS max_price
     FROM market_prices WHERE crop_id = ? AND unit = ?
     GROUP BY price_date ORDER BY price_date DESC LIMIT 30`,
    [crop.id, unit]
  );

  const averages = markets.map((m) => Number(m.avg_price));
  send(req, res, {
    data: {
      crop,
      unit,
      markets,
      trend: trend.reverse(),
      summary: markets.length
        ? {
            lowest: Math.min(...averages),
            highest: Math.max(...averages),
            average: Number((averages.reduce((a, b) => a + b, 0) / averages.length).toFixed(2))
          }
        : null
    }
  });
}

function checkRange(data) {
  if (data.max_price < data.min_price) {
    const message = { bn: "সর্বোচ্চ দাম সর্বনিম্ন দামের কম হতে পারবে না।", en: "Maximum price cannot be below the minimum price." };
    throw ApiError.badRequest(message.bn, message.en, { max_price: message });
  }
}

async function findPrice(id) {
  const [rows] = await db.query(`${PRICE_SELECT} ${PRICE_FROM} WHERE mp.id = ?`, [id]);
  return rows[0];
}

async function create(req, res) {
  const data = req.body;
  checkRange(data);

  const [result] = await db.query(
    `INSERT INTO market_prices (crop_id, market_name, district_id, unit, min_price, max_price, price_date, source,
                                source_note, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'admin', ?, ?, ?)`,
    [data.crop_id, data.market_name, data.district_id, data.unit, data.min_price, data.max_price, data.price_date,
      data.source_note, req.user.id, req.user.id]
  );
  const price = await findPrice(result.insertId);

  // Tell farmers who are selling or growing this crop.
  const [farmers] = await db.query(
    `SELECT DISTINCT farmer_id AS id FROM crop_listings WHERE crop_id = ? AND status = 'active'
     UNION
     SELECT DISTINCT farmer_id FROM harvests WHERE crop_id = ? AND status <> 'completed'`,
    [data.crop_id, data.crop_id]
  );
  await notifyMany(null, farmers.map((f) => f.id), {
    type: "market_price",
    title: [`${price.crop_bn}-এর নতুন বাজারদর`, `New market price for ${price.crop_en}`],
    body: [
      `${price.market_name}: ৳${price.min_price} - ৳${price.max_price}`,
      `${price.market_name}: BDT ${price.min_price} - ${price.max_price}`
    ],
    link: `/market-prices?crop_id=${data.crop_id}`,
    entityType: "market_price",
    entityId: price.id
  });

  await logActivity(req, "market_price.create", "market_price", price.id);
  send(req, res, { status: 201, message: ["বাজারদর যোগ হয়েছে।", "Market price added."], data: price });
}

async function update(req, res) {
  const data = req.body;
  checkRange(data);

  const [result] = await db.query(
    `UPDATE market_prices SET crop_id = ?, market_name = ?, district_id = ?, unit = ?, min_price = ?, max_price = ?,
            price_date = ?, source = 'admin', source_note = ?, updated_by = ?
     WHERE id = ?`,
    [data.crop_id, data.market_name, data.district_id, data.unit, data.min_price, data.max_price, data.price_date,
      data.source_note, req.user.id, req.params.id]
  );
  if (result.affectedRows === 0) throw ApiError.notFound();

  await logActivity(req, "market_price.update", "market_price", req.params.id);
  send(req, res, { message: ["বাজারদর হালনাগাদ হয়েছে।", "Market price updated."], data: await findPrice(req.params.id) });
}

async function remove(req, res) {
  const [result] = await db.query("DELETE FROM market_prices WHERE id = ?", [req.params.id]);
  if (result.affectedRows === 0) throw ApiError.notFound();
  await logActivity(req, "market_price.delete", "market_price", req.params.id);
  send(req, res, { message: ["বাজারদর মুছে ফেলা হয়েছে।", "Market price deleted."] });
}

module.exports = { schemas, list, compare, matrix, create, update, remove };
