/**
 * Harvest management (farmer only, own records only).
 */
const db = require("../config/db");
const v = require("../utils/validator");
const ApiError = require("../utils/ApiError");
const { send } = require("../utils/response");
const { getPagination, paginate } = require("../utils/pagination");
const { sqlFilter } = require("../utils/sqlFilter");
const { logActivity } = require("../services/activityService");
const { UNITS } = require("./listingController");
const { sendHarvestReminders } = require("../services/reminderService");

const STATUSES = ["planned", "growing", "ready", "harvesting", "completed"];
const LAND_UNITS = ["decimal", "katha", "bigha", "acre", "hectare"];

const fields = {
  crop_id: v.id().required(),
  variety: v.string().max(100),
  field_name: v.string().max(100),
  land_size: v.number().required().min(0.01).max(999999),
  land_unit: v.enum(LAND_UNITS).required(),
  expected_quantity: v.number().min(0).max(99999999),
  actual_quantity: v.number().min(0).max(99999999),
  quantity_unit: v.enum(UNITS).default("maund"),
  planting_date: v.date(),
  expected_harvest_date: v.date(),
  actual_harvest_date: v.date(),
  status: v.enum(STATUSES).default("planned"),
  notes: v.string().max(3000)
};

const schemas = {
  save: fields,
  status: { status: v.enum(STATUSES).required(), actual_harvest_date: v.date(), actual_quantity: v.number().min(0) },
  list: {
    status: v.enum(STATUSES),
    crop_id: v.id(),
    year: v.integer().min(2000).max(2100),
    q: v.string().max(100),
    page: v.integer(),
    limit: v.integer()
  }
};

const HARVEST_SELECT = `
  SELECT h.*, c.name_bn AS crop_bn, c.name_en AS crop_en,
         DATEDIFF(h.expected_harvest_date, CURDATE()) AS days_to_harvest,
         (SELECT COALESCE(SUM(e.total_cost), 0) FROM expense_notebooks n JOIN expenses e ON e.notebook_id = n.id
          WHERE n.harvest_id = h.id) AS total_expense`;

const HARVEST_FROM = "FROM harvests h JOIN crops c ON c.id = h.crop_id";

function checkDates(data) {
  const errors = {};
  if (data.planting_date && data.expected_harvest_date && data.expected_harvest_date < data.planting_date) {
    errors.expected_harvest_date = { bn: "কাটার তারিখ রোপণের আগে হতে পারে না।", en: "Harvest date cannot be before planting." };
  }
  if (data.planting_date && data.actual_harvest_date && data.actual_harvest_date < data.planting_date) {
    errors.actual_harvest_date = { bn: "কাটার তারিখ রোপণের আগে হতে পারে না।", en: "Harvest date cannot be before planting." };
  }
  if (Object.keys(errors).length) {
    throw ApiError.badRequest("তারিখগুলো ঠিক নেই।", "The dates are not correct.", errors);
  }
}

async function findOwn(req, id = req.params.id) {
  const [rows] = await db.query(`${HARVEST_SELECT} ${HARVEST_FROM} WHERE h.id = ?`, [id]);
  const harvest = rows[0];
  if (!harvest || harvest.farmer_id !== req.user.id) {
    throw ApiError.notFound("ফসলের রেকর্ডটি পাওয়া যায়নি।", "Harvest record not found.");
  }
  return harvest;
}

async function list(req, res) {
  const f = req.q;
  const filter = sqlFilter("h.farmer_id = ?");
  filter.params.push(req.user.id);
  if (f.status) filter.add("h.status = ?", f.status);
  if (f.crop_id) filter.add("h.crop_id = ?", f.crop_id);
  if (f.year) filter.add("YEAR(COALESCE(h.planting_date, h.expected_harvest_date, h.created_at)) = ?", f.year);
  filter.search(f.q, ["c.name_bn", "c.name_en", "h.variety", "h.field_name"]);

  const { rows, meta } = await paginate(db, {
    selectSql: HARVEST_SELECT,
    fromSql: `${HARVEST_FROM} ${filter.where}`,
    params: filter.params,
    orderSql: "ORDER BY h.status = 'completed', h.expected_harvest_date IS NULL, h.expected_harvest_date, h.id DESC",
    paging: getPagination(req.query, 12)
  });

  // Check for reminders whenever the farmer opens the page (the server may
  // have been asleep when the scheduled check would have run).
  await sendHarvestReminders(req.user.id);

  send(req, res, { data: rows, meta });
}

/** Harvests expected within the next 14 days (dashboard widget). */
async function upcoming(req, res) {
  const [rows] = await db.query(
    `${HARVEST_SELECT} ${HARVEST_FROM}
     WHERE h.farmer_id = ? AND h.status <> 'completed' AND h.expected_harvest_date IS NOT NULL
       AND h.expected_harvest_date <= DATE_ADD(CURDATE(), INTERVAL 14 DAY)
     ORDER BY h.expected_harvest_date LIMIT 10`,
    [req.user.id]
  );
  send(req, res, { data: rows });
}

async function show(req, res) {
  const harvest = await findOwn(req);
  const [notebooks] = await db.query(
    `SELECT n.id, n.title, COALESCE(SUM(e.total_cost), 0) AS total_cost, COUNT(e.id) AS rows_count
     FROM expense_notebooks n LEFT JOIN expenses e ON e.notebook_id = n.id
     WHERE n.harvest_id = ? GROUP BY n.id ORDER BY n.id`,
    [harvest.id]
  );
  harvest.notebooks = notebooks;
  send(req, res, { data: harvest });
}

function normalise(data) {
  // A completed harvest needs its real harvest date.
  if (data.status === "completed" && !data.actual_harvest_date) {
    const message = { bn: "ফসল কাটার আসল তারিখ দিন।", en: "Enter the actual harvest date." };
    throw ApiError.badRequest(message.bn, message.en, { actual_harvest_date: message });
  }
  checkDates(data);
}

async function create(req, res) {
  const d = req.body;
  normalise(d);

  const [result] = await db.query(
    `INSERT INTO harvests (farmer_id, crop_id, variety, field_name, land_size, land_unit, expected_quantity,
       actual_quantity, quantity_unit, planting_date, expected_harvest_date, actual_harvest_date, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.user.id, d.crop_id, d.variety, d.field_name, d.land_size, d.land_unit, d.expected_quantity,
      d.actual_quantity, d.quantity_unit, d.planting_date, d.expected_harvest_date, d.actual_harvest_date,
      d.status, d.notes]
  );

  await logActivity(req, "harvest.create", "harvest", result.insertId);
  send(req, res, {
    status: 201,
    message: ["ফসলের রেকর্ড যোগ হয়েছে।", "Harvest record added."],
    data: await findOwn(req, result.insertId)
  });
}

async function update(req, res) {
  const existing = await findOwn(req);
  const d = req.body;
  normalise(d);

  // A new expected date means a new reminder should be sent.
  const resetReminder = existing.expected_harvest_date !== d.expected_harvest_date;

  await db.query(
    `UPDATE harvests SET crop_id = ?, variety = ?, field_name = ?, land_size = ?, land_unit = ?, expected_quantity = ?,
       actual_quantity = ?, quantity_unit = ?, planting_date = ?, expected_harvest_date = ?, actual_harvest_date = ?,
       status = ?, notes = ? ${resetReminder ? ", reminder_sent_at = NULL" : ""}
     WHERE id = ?`,
    [d.crop_id, d.variety, d.field_name, d.land_size, d.land_unit, d.expected_quantity, d.actual_quantity,
      d.quantity_unit, d.planting_date, d.expected_harvest_date, d.actual_harvest_date, d.status, d.notes, existing.id]
  );

  await logActivity(req, "harvest.update", "harvest", existing.id);
  send(req, res, { message: ["রেকর্ড হালনাগাদ হয়েছে।", "Record updated."], data: await findOwn(req) });
}

async function setStatus(req, res) {
  const existing = await findOwn(req);
  const { status } = req.body;
  const actualDate = req.body.actual_harvest_date || existing.actual_harvest_date;

  if (status === "completed" && !actualDate) {
    const message = { bn: "ফসল কাটার আসল তারিখ দিন।", en: "Enter the actual harvest date." };
    throw ApiError.badRequest(message.bn, message.en, { actual_harvest_date: message });
  }

  await db.query(
    "UPDATE harvests SET status = ?, actual_harvest_date = ?, actual_quantity = COALESCE(?, actual_quantity) WHERE id = ?",
    [status, status === "completed" ? actualDate : existing.actual_harvest_date, req.body.actual_quantity, existing.id]
  );

  await logActivity(req, "harvest.status", "harvest", existing.id, status);
  send(req, res, { message: ["অবস্থা হালনাগাদ হয়েছে।", "Status updated."], data: await findOwn(req) });
}

async function remove(req, res) {
  const existing = await findOwn(req);
  // Linked expense notebooks are kept (their harvest link becomes empty).
  await db.query("DELETE FROM harvests WHERE id = ?", [existing.id]);
  await logActivity(req, "harvest.delete", "harvest", existing.id);
  send(req, res, { message: ["রেকর্ড মুছে ফেলা হয়েছে।", "Record deleted."] });
}

module.exports = { schemas, list, upcoming, show, create, update, setStatus, remove, STATUSES, LAND_UNITS };
