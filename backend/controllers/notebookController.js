/**
 * Digital expense notebook (খরচের খাতা) — farmer only, own notebooks only.
 *
 * The notebook page works like a paper notebook: the farmer edits rows in a
 * grid and presses Save. saveRows() receives every row and, in one
 * transaction, updates changed rows, inserts new rows and deletes rows that
 * were removed. Row totals are calculated by MySQL (generated column), so
 * total = quantity x unit price can never be wrong.
 */
const db = require("../config/db");
const v = require("../utils/validator");
const ApiError = require("../utils/ApiError");
const { send } = require("../utils/response");
const { withTransaction } = require("../services/transaction");
const { logActivity } = require("../services/activityService");

const SEASONS = ["rabi", "kharif_1", "kharif_2", "boro", "aus", "aman", "year_round"];
const MAX_ROWS = 300;

const rowRule = {
  id: v.id(),
  item_name: v.string().required().max(150),
  category_id: v.id().required(),
  quantity: v.number().min(0).max(99999999).default(1),
  unit: v.string().max(20),
  unit_price: v.number().required().min(0).max(99999999),
  expense_date: v.date().required(),
  notes: v.string().max(255)
};

const schemas = {
  save: {
    title: v.string().required().min(2).max(150),
    harvest_id: v.id(),
    crop_id: v.id(),
    season: v.enum(SEASONS),
    year: v.integer().min(2000).max(2100),
    notes: v.string().max(2000)
  },
  show: { from: v.date(), to: v.date(), category_id: v.id() }
};

const NOTEBOOK_SELECT = `
  SELECT n.*, c.name_bn AS crop_bn, c.name_en AS crop_en,
         hc.name_bn AS harvest_crop_bn, hc.name_en AS harvest_crop_en, h.field_name AS harvest_field,
         h.land_size, h.land_unit,
         (SELECT COALESCE(SUM(e.total_cost), 0) FROM expenses e WHERE e.notebook_id = n.id) AS total_cost,
         (SELECT COUNT(*) FROM expenses e WHERE e.notebook_id = n.id) AS rows_count
  FROM expense_notebooks n
  LEFT JOIN crops c ON c.id = n.crop_id
  LEFT JOIN harvests h ON h.id = n.harvest_id
  LEFT JOIN crops hc ON hc.id = h.crop_id`;

async function findOwn(conn, req, id = req.params.id, { lock = false } = {}) {
  const [rows] = await conn.query(
    `SELECT id, farmer_id FROM expense_notebooks WHERE id = ? ${lock ? "FOR UPDATE" : ""}`,
    [id]
  );
  if (!rows[0] || rows[0].farmer_id !== req.user.id) {
    throw ApiError.notFound("খাতাটি পাওয়া যায়নি।", "Notebook not found.");
  }
  return rows[0];
}

async function checkLinks(req, data) {
  if (data.harvest_id) {
    const [rows] = await db.query("SELECT farmer_id, crop_id FROM harvests WHERE id = ?", [data.harvest_id]);
    if (!rows[0] || rows[0].farmer_id !== req.user.id) {
      const message = { bn: "ফসলের রেকর্ডটি পাওয়া যায়নি।", en: "Harvest record not found." };
      throw ApiError.badRequest(message.bn, message.en, { harvest_id: message });
    }
    if (!data.crop_id) data.crop_id = rows[0].crop_id;
  }
}

async function list(req, res) {
  const [rows] = await db.query(`${NOTEBOOK_SELECT} WHERE n.farmer_id = ? ORDER BY n.updated_at DESC`, [req.user.id]);
  send(req, res, { data: rows });
}

/** One notebook with its rows (optionally filtered) and totals by category. */
async function show(req, res) {
  await findOwn(db, req);
  const [[notebook]] = await db.query(`${NOTEBOOK_SELECT} WHERE n.id = ?`, [req.params.id]);

  const where = ["e.notebook_id = ?"];
  const params = [notebook.id];
  if (req.q.from) {
    where.push("e.expense_date >= ?");
    params.push(req.q.from);
  }
  if (req.q.to) {
    where.push("e.expense_date <= ?");
    params.push(req.q.to);
  }
  if (req.q.category_id) {
    where.push("e.category_id = ?");
    params.push(req.q.category_id);
  }

  const [rows] = await db.query(
    `SELECT e.id, e.line_no, e.item_name, e.category_id, ec.name_bn AS category_bn, ec.name_en AS category_en,
            e.quantity, e.unit, e.unit_price, e.total_cost, e.expense_date, e.notes
     FROM expenses e JOIN expense_categories ec ON ec.id = e.category_id
     WHERE ${where.join(" AND ")}
     ORDER BY e.line_no, e.id`,
    params
  );

  const [byCategory] = await db.query(
    `SELECT ec.id AS category_id, ec.name_bn AS category_bn, ec.name_en AS category_en,
            SUM(e.total_cost) AS total
     FROM expenses e JOIN expense_categories ec ON ec.id = e.category_id
     WHERE ${where.join(" AND ")}
     GROUP BY ec.id ORDER BY total DESC`,
    params
  );

  const filteredTotal = rows.reduce((sum, row) => sum + Number(row.total_cost), 0);
  send(req, res, {
    data: { notebook, rows, by_category: byCategory, filtered_total: Number(filteredTotal.toFixed(2)) }
  });
}

async function create(req, res) {
  const data = req.body;
  await checkLinks(req, data);

  const [result] = await db.query(
    `INSERT INTO expense_notebooks (farmer_id, harvest_id, crop_id, title, season, year, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [req.user.id, data.harvest_id, data.crop_id, data.title, data.season, data.year, data.notes]
  );

  await logActivity(req, "notebook.create", "notebook", result.insertId);
  const [[notebook]] = await db.query(`${NOTEBOOK_SELECT} WHERE n.id = ?`, [result.insertId]);
  send(req, res, { status: 201, message: ["নতুন খাতা তৈরি হয়েছে।", "Notebook created."], data: notebook });
}

async function update(req, res) {
  await findOwn(db, req);
  const data = req.body;
  await checkLinks(req, data);

  await db.query(
    `UPDATE expense_notebooks SET harvest_id = ?, crop_id = ?, title = ?, season = ?, year = ?, notes = ? WHERE id = ?`,
    [data.harvest_id, data.crop_id, data.title, data.season, data.year, data.notes, req.params.id]
  );
  const [[notebook]] = await db.query(`${NOTEBOOK_SELECT} WHERE n.id = ?`, [req.params.id]);
  send(req, res, { message: ["খাতার তথ্য হালনাগাদ হয়েছে।", "Notebook updated."], data: notebook });
}

async function remove(req, res) {
  await findOwn(db, req);
  await db.query("DELETE FROM expense_notebooks WHERE id = ?", [req.params.id]);
  await logActivity(req, "notebook.delete", "notebook", req.params.id);
  send(req, res, { message: ["খাতাটি মুছে ফেলা হয়েছে।", "Notebook deleted."] });
}

/** Validates every row; collects errors as { "rows.3.unit_price": {...} }. */
function validateRows(rawRows) {
  if (!Array.isArray(rawRows)) {
    throw ApiError.badRequest("খাতার সারিগুলো পড়া যায়নি।", "The notebook rows could not be read.");
  }
  if (rawRows.length > MAX_ROWS) {
    throw ApiError.badRequest(`একটি খাতায় সর্বোচ্চ ${MAX_ROWS}টি সারি রাখা যাবে।`, `A notebook can hold at most ${MAX_ROWS} rows.`);
  }

  const clean = [];
  const errors = {};
  rawRows.forEach((raw, index) => {
    const { value, errors: rowErrors } = v.validate(rowRule, raw || {});
    if (rowErrors) {
      for (const [field, message] of Object.entries(rowErrors)) errors[`rows.${index}.${field}`] = message;
    } else {
      clean.push({ ...value, line_no: index + 1 });
    }
  });

  if (Object.keys(errors).length) {
    throw ApiError.badRequest(
      "কিছু সারিতে তথ্য ঠিক নেই। লাল চিহ্নিত ঘরগুলো দেখুন।",
      "Some rows have problems. Please check the highlighted cells.",
      errors
    );
  }
  return clean;
}

/** Saves the whole grid in one transaction. */
async function saveRows(req, res) {
  const rows = validateRows(req.body.rows);

  await withTransaction(async (conn) => {
    await findOwn(conn, req, req.params.id, { lock: true });

    const [existing] = await conn.query("SELECT id FROM expenses WHERE notebook_id = ?", [req.params.id]);
    const existingIds = new Set(existing.map((row) => row.id));
    const keptIds = new Set();

    for (const row of rows) {
      if (row.id && existingIds.has(row.id)) {
        keptIds.add(row.id);
        await conn.query(
          `UPDATE expenses SET line_no = ?, item_name = ?, category_id = ?, quantity = ?, unit = ?, unit_price = ?,
                  expense_date = ?, notes = ?
           WHERE id = ? AND notebook_id = ?`,
          [row.line_no, row.item_name, row.category_id, row.quantity, row.unit, row.unit_price, row.expense_date,
            row.notes, row.id, req.params.id]
        );
      } else {
        await conn.query(
          `INSERT INTO expenses (notebook_id, line_no, item_name, category_id, quantity, unit, unit_price, expense_date, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [req.params.id, row.line_no, row.item_name, row.category_id, row.quantity, row.unit, row.unit_price,
            row.expense_date, row.notes]
        );
      }
    }

    const removed = [...existingIds].filter((id) => !keptIds.has(id));
    if (removed.length > 0) {
      await conn.query("DELETE FROM expenses WHERE notebook_id = ? AND id IN (?)", [req.params.id, removed]);
    }
    await conn.query("UPDATE expense_notebooks SET updated_at = NOW() WHERE id = ?", [req.params.id]);
  });

  await logActivity(req, "notebook.save_rows", "notebook", req.params.id, `${rows.length} rows`);
  req.q = {};
  return show(req, res);
}

/** Production cost summary across all notebooks (per crop and per harvest). */
async function summary(req, res) {
  const [[totals]] = await db.query(
    `SELECT COALESCE(SUM(e.total_cost), 0) AS total_cost, COUNT(DISTINCT n.id) AS notebooks, COUNT(e.id) AS rows_count
     FROM expense_notebooks n LEFT JOIN expenses e ON e.notebook_id = n.id WHERE n.farmer_id = ?`,
    [req.user.id]
  );
  const [byCrop] = await db.query(
    `SELECT COALESCE(c.id, 0) AS crop_id, c.name_bn AS crop_bn, c.name_en AS crop_en, SUM(e.total_cost) AS total
     FROM expense_notebooks n JOIN expenses e ON e.notebook_id = n.id LEFT JOIN crops c ON c.id = n.crop_id
     WHERE n.farmer_id = ? GROUP BY c.id ORDER BY total DESC`,
    [req.user.id]
  );
  const [byCategory] = await db.query(
    `SELECT ec.id AS category_id, ec.name_bn AS category_bn, ec.name_en AS category_en, SUM(e.total_cost) AS total
     FROM expense_notebooks n JOIN expenses e ON e.notebook_id = n.id JOIN expense_categories ec ON ec.id = e.category_id
     WHERE n.farmer_id = ? GROUP BY ec.id ORDER BY total DESC`,
    [req.user.id]
  );
  const [byHarvest] = await db.query(
    `SELECT h.id AS harvest_id, c.name_bn AS crop_bn, c.name_en AS crop_en, h.field_name, h.land_size, h.land_unit,
            h.actual_quantity, h.quantity_unit, SUM(e.total_cost) AS total,
            IF(h.actual_quantity > 0, ROUND(SUM(e.total_cost) / h.actual_quantity, 2), NULL) AS cost_per_unit
     FROM harvests h JOIN crops c ON c.id = h.crop_id
     JOIN expense_notebooks n ON n.harvest_id = h.id JOIN expenses e ON e.notebook_id = n.id
     WHERE h.farmer_id = ? GROUP BY h.id ORDER BY h.id DESC`,
    [req.user.id]
  );

  send(req, res, { data: { totals, by_crop: byCrop, by_category: byCategory, by_harvest: byHarvest } });
}

module.exports = { schemas, list, show, create, update, remove, saveRows, summary, SEASONS };
