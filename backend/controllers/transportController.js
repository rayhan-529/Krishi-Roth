/**
 * Crop transport services.
 *   Public:          search vehicles, view a vehicle
 *   Transport owner: register and manage own vehicles
 * The registration number is private: only the owner and admins see it.
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

const VEHICLE_TYPES = ["truck", "mini_truck", "pickup", "covered_van", "van", "trolley", "nosimon", "boat", "other"];
const CAPACITY_UNITS = ["kg", "maund", "ton"];
const PRICE_UNITS = ["per_km", "per_trip", "per_day", "per_ton"];

const fields = {
  vehicle_type: v.enum(VEHICLE_TYPES).required(),
  name: v.string().required().min(2).max(120),
  registration_number: v.string().max(40),
  capacity: v.number().required().min(0.01).max(100000),
  capacity_unit: v.enum(CAPACITY_UNITS).required(),
  price: v.number().required().min(0).max(10000000),
  price_unit: v.enum(PRICE_UNITS).required(),
  district_id: v.id().required(),
  upazila: v.string().max(80),
  description: v.string().max(3000),
  is_available: v.boolean().default(true)
};

const schemas = {
  create: fields,
  update: { ...fields, remove_image_ids: v.array(v.id()).default([]) },
  availability: { is_available: v.boolean().required() },
  search: {
    q: v.string().max(100),
    vehicle_type: v.enum(VEHICLE_TYPES),
    district_id: v.id(),
    division_id: v.id(),
    max_price: v.number().min(0),
    min_capacity_kg: v.number().min(0),
    available_only: v.boolean().default(true),
    sort: v.enum(["rating", "price_asc", "capacity_desc", "newest"]).default("rating"),
    page: v.integer(),
    limit: v.integer()
  }
};

const SORTS = {
  rating: "ORDER BY rs.average_rating IS NULL, rs.average_rating DESC, t.id DESC",
  price_asc: "ORDER BY t.price ASC",
  capacity_desc: "ORDER BY capacity_kg DESC",
  newest: "ORDER BY t.created_at DESC"
};

// Capacity converted to kg so vehicles in different units can be compared (1 maund = 37.32 kg).
const CAPACITY_KG = "t.capacity * CASE t.capacity_unit WHEN 'ton' THEN 1000 WHEN 'maund' THEN 37.32 ELSE 1 END";

const VEHICLE_SELECT = `
  SELECT t.id, t.owner_id, t.vehicle_type, t.name, t.capacity, t.capacity_unit, ROUND(${CAPACITY_KG}, 2) AS capacity_kg,
         t.price, t.price_unit, t.district_id, d.name_bn AS district_bn, d.name_en AS district_en, t.upazila,
         t.description, t.is_available, t.status, t.created_at,
         (SELECT image_path FROM transport_vehicle_images i WHERE i.vehicle_id = t.id ORDER BY i.sort_order, i.id LIMIT 1) AS cover_image,
         u.name AS owner_name, u.profile_photo AS owner_photo, u.verification_status AS owner_verification,
         COALESCE(rs.review_count, 0) AS review_count, rs.average_rating,
         (SELECT COUNT(*) FROM bookings b WHERE b.transport_vehicle_id = t.id AND b.status = 'completed') AS completed_jobs`;

const VEHICLE_FROM = `
  FROM transport_vehicles t
  JOIN users u ON u.id = t.owner_id
  JOIN districts d ON d.id = t.district_id
  LEFT JOIN user_rating_summary rs ON rs.user_id = t.owner_id`;

async function search(req, res) {
  const f = req.q;
  const filter = sqlFilter("t.status = 'active'", "u.is_blocked = 0");
  areaFilter(filter, f, "t.district_id", "t.owner_id");
  if (f.vehicle_type) filter.add("t.vehicle_type = ?", f.vehicle_type);
  if (f.max_price !== null) filter.add("t.price <= ?", f.max_price);
  if (f.min_capacity_kg !== null) filter.add(`${CAPACITY_KG} >= ?`, f.min_capacity_kg);
  if (f.available_only) filter.add("t.is_available = 1");
  filter.search(f.q, ["t.name", "u.name", "t.upazila"]);

  const { rows, meta } = await paginate(db, {
    selectSql: VEHICLE_SELECT,
    fromSql: `${VEHICLE_FROM} ${filter.where}`,
    params: filter.params,
    orderSql: SORTS[f.sort],
    paging: getPagination(req.query, 12)
  });
  send(req, res, { data: rows, meta });
}

async function findVehicle(id, { withPrivate = false } = {}) {
  const [rows] = await db.query(
    `${VEHICLE_SELECT}${withPrivate ? ", t.registration_number" : ""} ${VEHICLE_FROM} WHERE t.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function show(req, res) {
  const vehicle = await findVehicle(req.params.id);
  const isOwner = req.user && vehicle && vehicle.owner_id === req.user.id;
  const isAdmin = req.user && req.user.role === "admin";
  if (!vehicle || (vehicle.status !== "active" && !isOwner && !isAdmin)) {
    throw ApiError.notFound("যানবাহনটি পাওয়া যায়নি।", "Vehicle not found.");
  }
  if (isOwner || isAdmin) {
    const [[row]] = await db.query("SELECT registration_number FROM transport_vehicles WHERE id = ?", [vehicle.id]);
    vehicle.registration_number = row.registration_number;
  }
  vehicle.images = await listImages(db, "vehicle", vehicle.id);
  const [areas] = await db.query(
    `SELECT d.name_bn AS district_bn, d.name_en AS district_en, sa.upazila
     FROM provider_service_areas sa JOIN districts d ON d.id = sa.district_id WHERE sa.user_id = ?`,
    [vehicle.owner_id]
  );
  vehicle.service_areas = areas;
  send(req, res, { data: vehicle });
}

async function mine(req, res) {
  const [rows] = await db.query(
    `${VEHICLE_SELECT}, t.registration_number,
       (SELECT COUNT(*) FROM bookings b WHERE b.transport_vehicle_id = t.id AND b.status = 'pending') AS pending_bookings
     ${VEHICLE_FROM} WHERE t.owner_id = ? AND t.status <> 'removed' ORDER BY t.created_at DESC`,
    [req.user.id]
  );
  send(req, res, { data: rows });
}

async function findOwn(conn, req) {
  const [rows] = await conn.query("SELECT * FROM transport_vehicles WHERE id = ? FOR UPDATE", [req.params.id]);
  const vehicle = rows[0];
  if (!vehicle || vehicle.status === "removed") throw ApiError.notFound("যানবাহনটি পাওয়া যায়নি।", "Vehicle not found.");
  if (vehicle.owner_id !== req.user.id) throw ApiError.forbidden();
  return vehicle;
}

async function create(req, res) {
  const d = req.body;
  const id = await withTransaction(async (conn) => {
    const [result] = await conn.query(
      `INSERT INTO transport_vehicles (owner_id, vehicle_type, name, registration_number, capacity, capacity_unit,
                                       price, price_unit, district_id, upazila, description, is_available)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, d.vehicle_type, d.name, d.registration_number, d.capacity, d.capacity_unit, d.price,
        d.price_unit, d.district_id, d.upazila, d.description, d.is_available ? 1 : 0]
    );
    await syncImages(conn, "vehicle", result.insertId, req.files || []);
    return result.insertId;
  });

  await logActivity(req, "vehicle.create", "vehicle", id);
  send(req, res, {
    status: 201,
    message: ["যানবাহন নিবন্ধন হয়েছে।", "Vehicle registered."],
    data: await findVehicle(id, { withPrivate: true })
  });
}

async function update(req, res) {
  const d = req.body;
  const cleanup = await withTransaction(async (conn) => {
    const vehicle = await findOwn(conn, req);
    await conn.query(
      `UPDATE transport_vehicles SET vehicle_type = ?, name = ?, registration_number = ?, capacity = ?,
              capacity_unit = ?, price = ?, price_unit = ?, district_id = ?, upazila = ?, description = ?, is_available = ?
       WHERE id = ?`,
      [d.vehicle_type, d.name, d.registration_number, d.capacity, d.capacity_unit, d.price, d.price_unit,
        d.district_id, d.upazila, d.description, d.is_available ? 1 : 0, vehicle.id]
    );
    return syncImages(conn, "vehicle", vehicle.id, req.files || [], d.remove_image_ids);
  });

  cleanup();
  await logActivity(req, "vehicle.update", "vehicle", req.params.id);
  send(req, res, {
    message: ["তথ্য হালনাগাদ হয়েছে।", "Vehicle updated."],
    data: await findVehicle(req.params.id, { withPrivate: true })
  });
}

async function setAvailability(req, res) {
  await withTransaction(async (conn) => {
    const vehicle = await findOwn(conn, req);
    await conn.query("UPDATE transport_vehicles SET is_available = ? WHERE id = ?", [req.body.is_available ? 1 : 0, vehicle.id]);
  });
  send(req, res, {
    message: ["অবস্থা হালনাগাদ হয়েছে।", "Availability updated."],
    data: await findVehicle(req.params.id, { withPrivate: true })
  });
}

async function remove(req, res) {
  const cleanup = await withTransaction(async (conn) => {
    const vehicle = await findOwn(conn, req);
    const [[{ open }]] = await conn.query(
      "SELECT COUNT(*) AS open FROM bookings WHERE transport_vehicle_id = ? AND status IN ('pending','accepted','in_progress')",
      [vehicle.id]
    );
    if (Number(open) > 0) throw ApiError.conflict("এই যানবাহনের চলমান বুকিং আছে।", "This vehicle has open bookings.");

    const [[{ total }]] = await conn.query("SELECT COUNT(*) AS total FROM bookings WHERE transport_vehicle_id = ?", [vehicle.id]);
    if (Number(total) > 0) {
      await conn.query("UPDATE transport_vehicles SET status = 'removed', is_available = 0 WHERE id = ?", [vehicle.id]);
      return () => {};
    }
    const done = await deleteAllImageFiles(conn, "vehicle", vehicle.id);
    await conn.query("DELETE FROM transport_vehicles WHERE id = ?", [vehicle.id]);
    return done;
  });

  cleanup();
  await logActivity(req, "vehicle.delete", "vehicle", req.params.id);
  send(req, res, { message: ["যানবাহনটি মুছে ফেলা হয়েছে।", "Vehicle removed."] });
}

module.exports = { schemas, search, show, mine, create, update, setAvailability, remove, VEHICLE_TYPES, PRICE_UNITS };
