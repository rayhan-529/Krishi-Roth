/**
 * The logged-in user's own profile, and public profiles of other users.
 */
const db = require("../config/db");
const v = require("../utils/validator");
const ApiError = require("../utils/ApiError");
const { send } = require("../utils/response");
const { storePublicFile, removePublicFile } = require("../services/storageService");
const { logActivity } = require("../services/activityService");

const schemas = {
  update: {
    name: v.string().required().min(2).max(100),
    phone: v.phone(),
    email: v.email(),
    district_id: v.id(),
    upazila: v.string().max(80),
    address: v.string().max(255),
    bio: v.string().max(500),
    preferred_language: v.enum(["bn", "en"]).default("bn")
  },
  language: {
    preferred_language: v.enum(["bn", "en"]).required()
  }
};

const PROFILE_SELECT = `
  SELECT u.id, u.name, u.email, u.phone, u.role, r.name_bn AS role_bn, r.name_en AS role_en,
         u.profile_photo, u.district_id, d.name_bn AS district_bn, d.name_en AS district_en,
         dv.name_bn AS division_bn, dv.name_en AS division_en, u.upazila, u.address, u.bio,
         u.preferred_language, u.verification_status, u.created_at, u.last_login_at,
         COALESCE(rs.review_count, 0) AS review_count, rs.average_rating
  FROM users u
  JOIN roles r ON r.code = u.role
  LEFT JOIN districts d ON d.id = u.district_id
  LEFT JOIN divisions dv ON dv.id = d.division_id
  LEFT JOIN user_rating_summary rs ON rs.user_id = u.id`;

async function getOwnProfile(userId) {
  const [rows] = await db.query(`${PROFILE_SELECT} WHERE u.id = ?`, [userId]);
  return rows[0];
}

async function show(req, res) {
  send(req, res, { data: await getOwnProfile(req.user.id) });
}

async function update(req, res) {
  const data = req.body;

  if (!data.phone && !data.email) {
    const message = { bn: "মোবাইল নম্বর অথবা ইমেইল যেকোনো একটি দিতে হবে।", en: "Enter a mobile number or an email." };
    throw ApiError.badRequest(message.bn, message.en, { phone: message });
  }

  const [taken] = await db.query(
    `SELECT phone, email FROM users
     WHERE id <> ? AND ((? IS NOT NULL AND phone = ?) OR (? IS NOT NULL AND email = ?))`,
    [req.user.id, data.phone, data.phone, data.email, data.email]
  );
  if (taken.length > 0) {
    const errors = {};
    if (data.phone && taken.some((u) => u.phone === data.phone)) {
      errors.phone = { bn: "এই মোবাইল নম্বরটি অন্য অ্যাকাউন্টে আছে।", en: "This mobile number belongs to another account." };
    }
    if (data.email && taken.some((u) => u.email === data.email)) {
      errors.email = { bn: "এই ইমেইলটি অন্য অ্যাকাউন্টে আছে।", en: "This email belongs to another account." };
    }
    throw new ApiError(409, "তথ্যটি অন্য অ্যাকাউন্টে ব্যবহৃত হচ্ছে।", "This information is used by another account.", errors);
  }

  await db.query(
    `UPDATE users SET name = ?, phone = ?, email = ?, district_id = ?, upazila = ?, address = ?, bio = ?,
            preferred_language = ?
     WHERE id = ?`,
    [data.name, data.phone, data.email, data.district_id, data.upazila, data.address, data.bio, data.preferred_language, req.user.id]
  );
  await logActivity(req, "profile.update", "user", req.user.id);

  send(req, res, {
    message: ["প্রোফাইল হালনাগাদ হয়েছে।", "Profile updated."],
    data: await getOwnProfile(req.user.id)
  });
}

/** Saves the language the user picked in the language switch. */
async function setLanguage(req, res) {
  await db.query("UPDATE users SET preferred_language = ? WHERE id = ?", [req.body.preferred_language, req.user.id]);
  send(req, res, { data: { preferred_language: req.body.preferred_language } });
}

async function uploadPhoto(req, res) {
  if (!req.file) throw ApiError.badRequest("একটি ছবি বেছে নিন।", "Choose a photo.");

  const path = await storePublicFile("avatars", req.file);
  await db.query("UPDATE users SET profile_photo = ? WHERE id = ?", [path, req.user.id]);
  removePublicFile(req.user.profile_photo);

  send(req, res, { message: ["ছবি হালনাগাদ হয়েছে।", "Photo updated."], data: { profile_photo: path } });
}

/**
 * Public profile of any active user: no email, phone or address.
 * Contact details are shared only inside an accepted trade or booking.
 */
async function publicProfile(req, res) {
  const [rows] = await db.query(
    `SELECT u.id, u.name, u.role, r.name_bn AS role_bn, r.name_en AS role_en, u.profile_photo,
            d.name_bn AS district_bn, d.name_en AS district_en, u.upazila, u.bio,
            u.verification_status, u.created_at, u.is_blocked,
            COALESCE(rs.review_count, 0) AS review_count, rs.average_rating
     FROM users u
     JOIN roles r ON r.code = u.role
     LEFT JOIN districts d ON d.id = u.district_id
     LEFT JOIN user_rating_summary rs ON rs.user_id = u.id
     WHERE u.id = ? AND u.role <> 'admin'`,
    [req.params.id]
  );
  const user = rows[0];
  const isAdmin = req.user && req.user.role === "admin";
  if (!user || (user.is_blocked && !isAdmin)) throw ApiError.notFound("ব্যবহারকারী পাওয়া যায়নি।", "User not found.");
  delete user.is_blocked;

  const [reviews] = await db.query(
    `SELECT rv.id, rv.rating, rv.comment, rv.created_at, rv.trade_id, rv.booking_id,
            u.id AS reviewer_id, u.name AS reviewer_name, u.role AS reviewer_role
     FROM reviews rv JOIN users u ON u.id = rv.reviewer_id
     WHERE rv.reviewee_id = ? AND rv.is_hidden = 0
     ORDER BY rv.created_at DESC LIMIT 10`,
    [user.id]
  );

  const extra = {};
  if (user.role === "farmer") {
    const [[counts]] = await db.query(
      `SELECT COUNT(*) AS active_listings FROM crop_listings WHERE farmer_id = ? AND status = 'active'`,
      [user.id]
    );
    const [[trades]] = await db.query(
      `SELECT COUNT(*) AS completed_trades FROM trade_records WHERE farmer_id = ? AND status = 'completed'`,
      [user.id]
    );
    Object.assign(extra, counts, trades);
  } else if (user.role === "buyer") {
    const [[trades]] = await db.query(
      `SELECT COUNT(*) AS completed_trades FROM trade_records WHERE buyer_id = ? AND status = 'completed'`,
      [user.id]
    );
    Object.assign(extra, trades);
  } else if (user.role === "labour") {
    const [profile] = await db.query(
      `SELECT lp.skills, lp.experience_years, lp.experience_details, lp.daily_wage, lp.is_available,
              lp.available_from, d.name_bn AS district_bn, d.name_en AS district_en, lp.upazila
       FROM labour_profiles lp JOIN districts d ON d.id = lp.district_id WHERE lp.user_id = ?`,
      [user.id]
    );
    extra.labour_profile = profile[0] || null;
  } else if (user.role === "harvester_owner" || user.role === "tractor_owner") {
    const [machines] = await db.query(
      `SELECT id, machine_type, name, rental_price, price_unit, is_available FROM machinery
       WHERE owner_id = ? AND status = 'active' ORDER BY id DESC`,
      [user.id]
    );
    extra.machinery = machines;
  } else if (user.role === "transport_owner") {
    const [vehicles] = await db.query(
      `SELECT id, vehicle_type, name, capacity, capacity_unit, price, price_unit, is_available
       FROM transport_vehicles WHERE owner_id = ? AND status = 'active' ORDER BY id DESC`,
      [user.id]
    );
    extra.vehicles = vehicles;
  }

  if (["labour", "harvester_owner", "tractor_owner", "transport_owner"].includes(user.role)) {
    const [areas] = await db.query(
      `SELECT d.name_bn AS district_bn, d.name_en AS district_en, sa.upazila
       FROM provider_service_areas sa JOIN districts d ON d.id = sa.district_id WHERE sa.user_id = ?`,
      [user.id]
    );
    extra.service_areas = areas;
  }

  send(req, res, { data: { ...user, ...extra, reviews } });
}

module.exports = { schemas, show, update, setLanguage, uploadPhoto, publicProfile, getOwnProfile };
