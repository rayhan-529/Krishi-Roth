/**
 * Bookings for labour, harvesters, tractors and transport.
 *
 *   Farmer (and buyer, for transport) sends a booking request.
 *   The provider accepts or rejects it, starts the work and marks it done.
 *
 * Status flow:
 *   pending -> accepted -> in_progress -> completed
 *   pending -> rejected
 *   pending/accepted -> cancelled (requester), accepted -> cancelled (provider)
 *
 * The same machine, vehicle or worker cannot be accepted for two
 * overlapping date ranges.
 */
const db = require("../config/db");
const v = require("../utils/validator");
const ApiError = require("../utils/ApiError");
const { send } = require("../utils/response");
const { getPagination, paginate } = require("../utils/pagination");
const { sqlFilter } = require("../utils/sqlFilter");
const { withTransaction } = require("../services/transaction");
const { notify } = require("../services/notificationService");
const { logActivity } = require("../services/activityService");

const TYPES = ["labour", "harvester", "tractor", "transport"];
const STATUSES = ["pending", "accepted", "rejected", "cancelled", "in_progress", "completed"];
const PROVIDER_ROLE = { labour: "labour", harvester: "harvester_owner", tractor: "tractor_owner", transport: "transport_owner" };

const schemas = {
  create: {
    booking_type: v.enum(TYPES).required(),
    labour_id: v.id(),
    machinery_id: v.id(),
    transport_vehicle_id: v.id(),
    start_date: v.date().required(),
    end_date: v.date().required(),
    work_district_id: v.id().required(),
    work_upazila: v.string().max(80),
    work_address: v.string().max(255),
    destination: v.string().max(255),
    work_size: v.number().min(0).max(1000000),
    work_size_unit: v.string().max(20),
    requester_note: v.string().max(2000)
  },
  action: {
    action: v.enum(["accept", "reject", "start", "complete", "cancel"]).required(),
    note: v.string().max(500)
  },
  list: {
    as: v.enum(["requester", "provider"]),
    status: v.enum(STATUSES),
    booking_type: v.enum(TYPES),
    page: v.integer(),
    limit: v.integer()
  }
};

const BOOKING_SELECT = `
  SELECT b.*, rq.name AS requester_name, rq.profile_photo AS requester_photo, rq.verification_status AS requester_verification,
         pv.name AS provider_name, pv.profile_photo AS provider_photo, pv.verification_status AS provider_verification,
         m.name AS machine_name, t.name AS vehicle_name, t.vehicle_type,
         wd.name_bn AS work_district_bn, wd.name_en AS work_district_en,
         DATEDIFF(b.end_date, b.start_date) + 1 AS days`;

const BOOKING_FROM = `
  FROM bookings b
  JOIN users rq ON rq.id = b.requester_id
  JOIN users pv ON pv.id = b.provider_id
  LEFT JOIN machinery m ON m.id = b.machinery_id
  LEFT JOIN transport_vehicles t ON t.id = b.transport_vehicle_id
  LEFT JOIN districts wd ON wd.id = b.work_district_id`;

/** Works out who provides the service and the price snapshot. */
async function resolveTarget(conn, data) {
  const notAvailable = () =>
    ApiError.badRequest("এই সেবাটি এখন বুক করা যাবে না।", "This service cannot be booked right now.");

  if (data.booking_type === "labour") {
    if (!data.labour_id) throw ApiError.badRequest("শ্রমিক বেছে নিন।", "Choose a worker.");
    const [rows] = await conn.query(
      `SELECT lp.user_id, lp.daily_wage, lp.is_available, u.is_blocked, u.role
       FROM labour_profiles lp JOIN users u ON u.id = lp.user_id WHERE lp.user_id = ?`,
      [data.labour_id]
    );
    const p = rows[0];
    if (!p || p.is_blocked || !p.is_available || p.role !== "labour") throw notAvailable();
    return { providerId: p.user_id, machineryId: null, vehicleId: null, price: Number(p.daily_wage), unit: "per_day" };
  }

  if (data.booking_type === "transport") {
    if (!data.transport_vehicle_id) throw ApiError.badRequest("যানবাহন বেছে নিন।", "Choose a vehicle.");
    const [rows] = await conn.query(
      `SELECT t.id, t.owner_id, t.price, t.price_unit, t.is_available, t.status, u.is_blocked
       FROM transport_vehicles t JOIN users u ON u.id = t.owner_id WHERE t.id = ?`,
      [data.transport_vehicle_id]
    );
    const t = rows[0];
    if (!t || t.is_blocked || !t.is_available || t.status !== "active") throw notAvailable();
    return { providerId: t.owner_id, machineryId: null, vehicleId: t.id, price: Number(t.price), unit: t.price_unit };
  }

  if (!data.machinery_id) throw ApiError.badRequest("যন্ত্র বেছে নিন।", "Choose a machine.");
  const [rows] = await conn.query(
    `SELECT m.id, m.owner_id, m.machine_type, m.rental_price, m.price_unit, m.is_available, m.status, u.is_blocked
     FROM machinery m JOIN users u ON u.id = m.owner_id WHERE m.id = ?`,
    [data.machinery_id]
  );
  const m = rows[0];
  if (!m || m.is_blocked || !m.is_available || m.status !== "active" || m.machine_type !== data.booking_type) {
    throw notAvailable();
  }
  return { providerId: m.owner_id, machineryId: m.id, vehicleId: null, price: Number(m.rental_price), unit: m.price_unit };
}

/** Rough cost estimate for per-day and per-land-size prices (shown as an estimate only). */
function estimate(target, data) {
  const days = Math.round((new Date(data.end_date) - new Date(data.start_date)) / 86400000) + 1;
  if (["per_day"].includes(target.unit)) return Number((target.price * days).toFixed(2));
  if (["per_trip"].includes(target.unit)) return target.price;
  if (data.work_size && ["per_acre", "per_bigha", "per_decimal", "per_hour", "per_km", "per_ton"].includes(target.unit)) {
    return Number((target.price * data.work_size).toFixed(2));
  }
  return null;
}

async function create(req, res) {
  const data = req.body;

  if (data.booking_type !== "transport" && req.user.role !== "farmer") {
    throw ApiError.forbidden("শুধু কৃষক এই সেবা বুক করতে পারেন।", "Only farmers can book this service.");
  }
  const today = new Date().toISOString().slice(0, 10);
  const errors = {};
  if (data.start_date < today) errors.start_date = { bn: "আজ বা পরের তারিখ দিন।", en: "Choose today or a later date." };
  if (data.end_date < data.start_date) errors.end_date = { bn: "শেষ তারিখ শুরুর আগে হতে পারে না।", en: "End date cannot be before the start date." };
  if (Object.keys(errors).length) throw ApiError.badRequest("তারিখগুলো ঠিক নেই।", "The dates are not correct.", errors);

  const id = await withTransaction(async (conn) => {
    const target = await resolveTarget(conn, data);
    if (target.providerId === req.user.id) throw ApiError.forbidden();

    const [result] = await conn.query(
      `INSERT INTO bookings (booking_type, requester_id, provider_id, machinery_id, transport_vehicle_id, start_date,
         end_date, work_district_id, work_upazila, work_address, destination, work_size, work_size_unit, quoted_price,
         price_unit, estimated_total, requester_note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.booking_type, req.user.id, target.providerId, target.machineryId, target.vehicleId, data.start_date,
        data.end_date, data.work_district_id, data.work_upazila, data.work_address, data.destination, data.work_size,
        data.work_size_unit, target.price, target.unit, estimate(target, data), data.requester_note]
    );

    await notify(conn, target.providerId, {
      type: "booking_new",
      title: ["নতুন বুকিং অনুরোধ", "New booking request"],
      body: [
        `${req.user.name} ${data.start_date} থেকে ${data.end_date} পর্যন্ত বুক করতে চান।`,
        `${req.user.name} wants to book from ${data.start_date} to ${data.end_date}.`
      ],
      link: `/bookings/${result.insertId}`,
      entityType: "booking",
      entityId: result.insertId
    });
    return result.insertId;
  });

  await logActivity(req, "booking.create", "booking", id, data.booking_type);
  send(req, res, {
    status: 201,
    message: ["বুকিং অনুরোধ পাঠানো হয়েছে।", "Booking request sent."],
    data: await loadBooking(id)
  });
}

async function loadBooking(id) {
  const [rows] = await db.query(`${BOOKING_SELECT} ${BOOKING_FROM} WHERE b.id = ?`, [id]);
  return rows[0] || null;
}

async function list(req, res) {
  const f = req.q;
  const filter = sqlFilter();
  if (f.as === "requester") filter.add("b.requester_id = ?", req.user.id);
  else if (f.as === "provider") filter.add("b.provider_id = ?", req.user.id);
  else filter.add("(b.requester_id = ? OR b.provider_id = ?)", req.user.id, req.user.id);
  if (f.status) filter.add("b.status = ?", f.status);
  if (f.booking_type) filter.add("b.booking_type = ?", f.booking_type);

  const { rows, meta } = await paginate(db, {
    selectSql: BOOKING_SELECT,
    fromSql: `${BOOKING_FROM} ${filter.where}`,
    params: filter.params,
    orderSql: "ORDER BY FIELD(b.status, 'pending', 'accepted', 'in_progress') DESC, b.start_date DESC, b.id DESC",
    paging: getPagination(req.query, 10)
  });
  send(req, res, { data: rows, meta });
}

async function show(req, res) {
  const booking = await loadBooking(req.params.id);
  const isParty = booking && (booking.requester_id === req.user.id || booking.provider_id === req.user.id);
  if (!booking || (!isParty && req.user.role !== "admin")) {
    throw ApiError.notFound("বুকিংটি পাওয়া যায়নি।", "Booking not found.");
  }

  // Contact details are shared once the booking is accepted.
  if (["accepted", "in_progress", "completed"].includes(booking.status) || req.user.role === "admin") {
    const [[contacts]] = await db.query(
      `SELECT rq.phone AS requester_phone, pv.phone AS provider_phone FROM users rq, users pv WHERE rq.id = ? AND pv.id = ?`,
      [booking.requester_id, booking.provider_id]
    );
    Object.assign(booking, contacts);
  }

  const [reviews] = await db.query("SELECT reviewer_id, rating, comment, created_at FROM reviews WHERE booking_id = ?", [booking.id]);
  booking.reviews = reviews;
  booking.can_review = booking.status === "completed" && isParty && !reviews.some((r) => r.reviewer_id === req.user.id);
  send(req, res, { data: booking });
}

async function checkOverlap(conn, booking) {
  const column = booking.machinery_id
    ? "machinery_id"
    : booking.transport_vehicle_id
      ? "transport_vehicle_id"
      : "provider_id";
  const value = booking.machinery_id || booking.transport_vehicle_id || booking.provider_id;
  const typeClause = column === "provider_id" ? "AND booking_type = 'labour'" : "";

  const [rows] = await conn.query(
    `SELECT id, start_date, end_date FROM bookings
     WHERE ${column} = ? ${typeClause} AND id <> ? AND status IN ('accepted', 'in_progress')
       AND start_date <= ? AND end_date >= ? LIMIT 1`,
    [value, booking.id, booking.end_date, booking.start_date]
  );
  if (rows[0]) {
    throw ApiError.conflict(
      `এই সময়ে (${rows[0].start_date} থেকে ${rows[0].end_date}) আরেকটি বুকিং গ্রহণ করা আছে।`,
      `Another accepted booking already covers ${rows[0].start_date} to ${rows[0].end_date}.`
    );
  }
}

const RULES = {
  accept: { who: "provider", from: ["pending"], to: "accepted" },
  reject: { who: "provider", from: ["pending"], to: "rejected" },
  start: { who: "provider", from: ["accepted"], to: "in_progress" },
  complete: { who: "both", from: ["accepted", "in_progress"], to: "completed" },
  cancel: { who: "both", from: ["pending", "accepted"], to: "cancelled" }
};

const TITLES = {
  accepted: ["আপনার বুকিং গৃহীত হয়েছে", "Your booking was accepted"],
  rejected: ["আপনার বুকিং গ্রহণ করা হয়নি", "Your booking was rejected"],
  in_progress: ["কাজ শুরু হয়েছে", "Work has started"],
  completed: ["বুকিং সম্পন্ন হয়েছে", "Booking completed"],
  cancelled: ["বুকিং বাতিল করা হয়েছে", "Booking cancelled"]
};

async function act(req, res) {
  const { action, note } = req.body;
  const rule = RULES[action];

  await withTransaction(async (conn) => {
    const [rows] = await conn.query("SELECT * FROM bookings WHERE id = ? FOR UPDATE", [req.params.id]);
    const booking = rows[0];
    if (!booking) throw ApiError.notFound("বুকিংটি পাওয়া যায়নি।", "Booking not found.");

    const isProvider = booking.provider_id === req.user.id;
    const isRequester = booking.requester_id === req.user.id;
    if (!isProvider && !isRequester) throw ApiError.forbidden();
    if (rule.who === "provider" && !isProvider) throw ApiError.forbidden();
    // A provider may only cancel after accepting (to reject, use "reject").
    if (action === "cancel" && isProvider && !isRequester && booking.status === "pending") throw ApiError.forbidden();

    if (!rule.from.includes(booking.status)) {
      throw ApiError.badRequest("বুকিংয়ের এই ধাপে এই কাজটি করা যাবে না।", "This action is not allowed at this step.");
    }
    if ((action === "reject" || action === "cancel") && !note) {
      const message = { bn: "কারণ লিখুন।", en: "Please write the reason." };
      throw ApiError.badRequest(message.bn, message.en, { note: message });
    }
    if (action === "accept") await checkOverlap(conn, booking);

    const extra = {
      accepted: ", responded_at = NOW(), provider_note = ?",
      rejected: ", responded_at = NOW(), provider_note = ?",
      in_progress: "",
      completed: ", completed_at = NOW()",
      cancelled: ", cancelled_at = NOW(), cancelled_by = ?, provider_note = COALESCE(?, provider_note)"
    }[rule.to];
    const extraParams = {
      accepted: [note],
      rejected: [note],
      in_progress: [],
      completed: [],
      cancelled: [req.user.id, note]
    }[rule.to];

    await conn.query(`UPDATE bookings SET status = ? ${extra} WHERE id = ?`, [rule.to, ...extraParams, booking.id]);

    const otherId = isProvider ? booking.requester_id : booking.provider_id;
    await notify(conn, otherId, {
      type: "booking_status",
      title: TITLES[rule.to],
      body: note ? [note, note] : null,
      link: `/bookings/${booking.id}`,
      entityType: "booking",
      entityId: booking.id
    });
  });

  await logActivity(req, `booking.${action}`, "booking", req.params.id);
  send(req, res, { message: ["বুকিং হালনাগাদ হয়েছে।", "Booking updated."], data: await loadBooking(req.params.id) });
}

module.exports = { schemas, create, list, show, act, loadBooking, BOOKING_SELECT, BOOKING_FROM, TYPES, STATUSES, PROVIDER_ROLE };
