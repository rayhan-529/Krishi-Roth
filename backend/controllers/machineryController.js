/**
 * Harvester and tractor rental.
 *   Public: search machines of one type, view a machine
 *   Owner:  harvester owners manage harvesters; tractor owners manage tractors
 */
const db = require("../config/db");
const v = require("../utils/validator");
const ApiError = require("../utils/ApiError");
const { send } = require("../utils/response");
const { getPagination, paginate } = require("../utils/pagination");
const { sqlFilter } = require("../utils/sqlFilter");
const { withTransaction } = require("../services/transaction");
const { listImages, syncImages, deleteAllImageFiles } = require("../services/imageService");
const { logActivity } = require("../services/activityService");
const { areaFilter } = require("./labourController");

const PRICE_UNITS = ["per_hour", "per_day", "per_acre", "per_bigha", "per_decimal"];
const TYPE_BY_ROLE = { harvester_owner: "harvester", tractor_owner: "tractor" };

const fields = {
  name: v.string().required().min(2).max(120),
  brand: v.string().max(80),
  model: v.string().max(80),
  model_year: v.integer().min(1950).max(2100),
  horsepower: v.integer().min(1).max(2000),
  description: v.string().max(3000),
  rental_price: v.number().required().min(0).max(10000000),
  price_unit: v.enum(PRICE_UNITS).required(),
  district_id: v.id().required(),
  upazila: v.string().max(80),
  is_available: v.boolean().default(true)
};

const schemas = {
  create: fields,
  update: { ...fields, remove_image_ids: v.array(v.id()).default([]) },
  availability: { is_available: v.boolean().required() },
  search: {
    type: v.enum(["harvester", "tractor"]).required(),
    q: v.string().max(100),
    district_id: v.id(),
    division_id: v.id(),
    max_price: v.number().min(0),
    price_unit: v.enum(PRICE_UNITS),
    available_only: v.boolean().default(true),
    sort: v.enum(["rating", "price_asc", "price_desc", "newest"]).default("rating"),
    page: v.integer(),
    limit: v.integer()
  }
};

const SORTS = {
  rating: "ORDER BY rs.average_rating IS NULL, rs.average_rating DESC, m.id DESC",
  price_asc: "ORDER BY m.rental_price ASC",
  price_desc: "ORDER BY m.rental_price DESC",
  newest: "ORDER BY m.created_at DESC"
};

const MACHINE_SELECT = `
  SELECT m.id, m.owner_id, m.machine_type, m.name, m.brand, m.model, m.model_year, m.horsepower, m.description,
         m.rental_price, m.price_unit, m.district_id, d.name_bn AS district_bn, d.name_en AS district_en,
         m.upazila, m.is_available, m.status, m.created_at,
         (SELECT image_path FROM machinery_images i WHERE i.machinery_id = m.id ORDER BY i.sort_order, i.id LIMIT 1) AS cover_image,
         u.name AS owner_name, u.profile_photo AS owner_photo, u.verification_status AS owner_verification,
         COALESCE(rs.review_count, 0) AS review_count, rs.average_rating,
         (SELECT COUNT(*) FROM bookings b WHERE b.machinery_id = m.id AND b.status = 'completed') AS completed_jobs`;

const MACHINE_FROM = `
  FROM machinery m
  JOIN users u ON u.id = m.owner_id
  JOIN districts d ON d.id = m.district_id
  LEFT JOIN user_rating_summary rs ON rs.user_id = m.owner_id`;

async function search(req, res) {
  const f = req.q;
  const filter = sqlFilter("m.status = 'active'", "u.is_blocked = 0");
  filter.add("m.machine_type = ?", f.type);
  areaFilter(filter, f, "m.district_id", "m.owner_id");
  if (f.max_price !== null) filter.add("m.rental_price <= ?", f.max_price);
  if (f.price_unit) filter.add("m.price_unit = ?", f.price_unit);
  if (f.available_only) filter.add("m.is_available = 1");
  filter.search(f.q, ["m.name", "m.brand", "m.model", "u.name", "m.upazila"]);

  const { rows, meta } = await paginate(db, {
    selectSql: MACHINE_SELECT,
    fromSql: `${MACHINE_FROM} ${filter.where}`,
    params: filter.params,
    orderSql: SORTS[f.sort],
    paging: getPagination(req.query, 12)
  });
  send(req, res, { data: rows, meta });
}

async function findMachine(id) {
  const [rows] = await db.query(`${MACHINE_SELECT} ${MACHINE_FROM} WHERE m.id = ?`, [id]);
  return rows[0] || null;
}

async function show(req, res) {
  const machine = await findMachine(req.params.id);
  const isOwner = req.user && machine && machine.owner_id === req.user.id;
  const isAdmin = req.user && req.user.role === "admin";
  if (!machine || (machine.status !== "active" && !isOwner && !isAdmin)) {
    throw ApiError.notFound("যন্ত্রটি পাওয়া যায়নি।", "Machine not found.");
  }
  machine.images = await listImages(db, "machinery", machine.id);
  const [areas] = await db.query(
    `SELECT d.name_bn AS district_bn, d.name_en AS district_en, sa.upazila
     FROM provider_service_areas sa JOIN districts d ON d.id = sa.district_id WHERE sa.user_id = ?`,
    [machine.owner_id]
  );
  machine.service_areas = areas;
  send(req, res, { data: machine });
}

async function mine(req, res) {
  const [rows] = await db.query(
    `${MACHINE_SELECT},
       (SELECT COUNT(*) FROM bookings b WHERE b.machinery_id = m.id AND b.status = 'pending') AS pending_bookings
     ${MACHINE_FROM} WHERE m.owner_id = ? AND m.status <> 'removed' ORDER BY m.created_at DESC`,
    [req.user.id]
  );
  send(req, res, { data: rows });
}

async function findOwn(conn, req) {
  const [rows] = await conn.query("SELECT * FROM machinery WHERE id = ? FOR UPDATE", [req.params.id]);
  const machine = rows[0];
  if (!machine || machine.status === "removed") throw ApiError.notFound("যন্ত্রটি পাওয়া যায়নি।", "Machine not found.");
  if (machine.owner_id !== req.user.id) throw ApiError.forbidden();
  return machine;
}

async function create(req, res) {
  const d = req.body;
  const type = TYPE_BY_ROLE[req.user.role];

  const id = await withTransaction(async (conn) => {
    const [result] = await conn.query(
      `INSERT INTO machinery (owner_id, machine_type, name, brand, model, model_year, horsepower, description,
                              rental_price, price_unit, district_id, upazila, is_available)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, type, d.name, d.brand, d.model, d.model_year, d.horsepower, d.description, d.rental_price,
        d.price_unit, d.district_id, d.upazila, d.is_available ? 1 : 0]
    );
    await syncImages(conn, "machinery", result.insertId, req.files || []);
    return result.insertId;
  });

  await logActivity(req, "machinery.create", "machinery", id);
  send(req, res, {
    status: 201,
    message: ["যন্ত্র নিবন্ধন হয়েছে।", "Machine registered."],
    data: await findMachine(id)
  });
}

async function update(req, res) {
  const d = req.body;
  const cleanup = await withTransaction(async (conn) => {
    const machine = await findOwn(conn, req);
    await conn.query(
      `UPDATE machinery SET name = ?, brand = ?, model = ?, model_year = ?, horsepower = ?, description = ?,
              rental_price = ?, price_unit = ?, district_id = ?, upazila = ?, is_available = ?
       WHERE id = ?`,
      [d.name, d.brand, d.model, d.model_year, d.horsepower, d.description, d.rental_price, d.price_unit,
        d.district_id, d.upazila, d.is_available ? 1 : 0, machine.id]
    );
    return syncImages(conn, "machinery", machine.id, req.files || [], d.remove_image_ids);
  });

  cleanup();
  await logActivity(req, "machinery.update", "machinery", req.params.id);
  send(req, res, { message: ["তথ্য হালনাগাদ হয়েছে।", "Machine updated."], data: await findMachine(req.params.id) });
}

async function setAvailability(req, res) {
  await withTransaction(async (conn) => {
    const machine = await findOwn(conn, req);
    await conn.query("UPDATE machinery SET is_available = ? WHERE id = ?", [req.body.is_available ? 1 : 0, machine.id]);
  });
  send(req, res, { message: ["অবস্থা হালনাগাদ হয়েছে।", "Availability updated."], data: await findMachine(req.params.id) });
}

/** Removes a machine. Machines with booking history are hidden, not deleted. */
async function remove(req, res) {
  const cleanup = await withTransaction(async (conn) => {
    const machine = await findOwn(conn, req);
    const [[{ open }]] = await conn.query(
      "SELECT COUNT(*) AS open FROM bookings WHERE machinery_id = ? AND status IN ('pending','accepted','in_progress')",
      [machine.id]
    );
    if (Number(open) > 0) {
      throw ApiError.conflict("এই যন্ত্রের চলমান বুকিং আছে।", "This machine has open bookings.");
    }
    const [[{ total }]] = await conn.query("SELECT COUNT(*) AS total FROM bookings WHERE machinery_id = ?", [machine.id]);
    if (Number(total) > 0) {
      await conn.query("UPDATE machinery SET status = 'removed', is_available = 0 WHERE id = ?", [machine.id]);
      return () => {};
    }
    const done = await deleteAllImageFiles(conn, "machinery", machine.id);
    await conn.query("DELETE FROM machinery WHERE id = ?", [machine.id]);
    return done;
  });

  cleanup();
  await logActivity(req, "machinery.delete", "machinery", req.params.id);
  send(req, res, { message: ["যন্ত্রটি মুছে ফেলা হয়েছে।", "Machine removed."] });
}

module.exports = { schemas, search, show, mine, create, update, setAvailability, remove, PRICE_UNITS };
