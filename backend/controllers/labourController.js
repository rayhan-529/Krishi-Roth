/**
 * Agricultural labour.
 *   Public: search available workers by area, wage and skill
 *   Labour: manage own profile (skills, experience, daily wage, area, availability)
 */
const db = require("../config/db");
const v = require("../utils/validator");
const ApiError = require("../utils/ApiError");
const { send } = require("../utils/response");
const { getPagination, paginate } = require("../utils/pagination");
const { sqlFilter } = require("../utils/sqlFilter");
const { logActivity } = require("../services/activityService");

const schemas = {
  profile: {
    skills: v.string().required().min(2).max(255),
    experience_years: v.integer().min(0).max(80).default(0),
    experience_details: v.string().max(3000),
    daily_wage: v.number().required().min(0).max(100000),
    district_id: v.id().required(),
    upazila: v.string().max(80),
    is_available: v.boolean().default(true),
    available_from: v.date()
  },
  availability: { is_available: v.boolean().required(), available_from: v.date() },
  search: {
    q: v.string().max(100),
    district_id: v.id(),
    division_id: v.id(),
    max_wage: v.number().min(0),
    available_only: v.boolean().default(true),
    sort: v.enum(["rating", "wage_asc", "wage_desc", "experience"]).default("rating"),
    page: v.integer(),
    limit: v.integer()
  }
};

const SORTS = {
  rating: "ORDER BY rs.average_rating IS NULL, rs.average_rating DESC, lp.experience_years DESC",
  wage_asc: "ORDER BY lp.daily_wage ASC",
  wage_desc: "ORDER BY lp.daily_wage DESC",
  experience: "ORDER BY lp.experience_years DESC"
};

const LABOUR_SELECT = `
  SELECT u.id AS user_id, u.name, u.profile_photo, u.verification_status,
         lp.skills, lp.experience_years, lp.experience_details, lp.daily_wage, lp.district_id,
         d.name_bn AS district_bn, d.name_en AS district_en, lp.upazila, lp.is_available, lp.available_from,
         COALESCE(rs.review_count, 0) AS review_count, rs.average_rating,
         (SELECT COUNT(*) FROM bookings b WHERE b.provider_id = u.id AND b.status = 'completed') AS completed_jobs`;

const LABOUR_FROM = `
  FROM labour_profiles lp
  JOIN users u ON u.id = lp.user_id
  JOIN districts d ON d.id = lp.district_id
  LEFT JOIN user_rating_summary rs ON rs.user_id = u.id`;

/** Matches the home district or any extra service area of the provider. */
function areaFilter(filter, f, districtColumn, userColumn) {
  if (f.district_id) {
    filter.add(
      `(${districtColumn} = ? OR EXISTS (SELECT 1 FROM provider_service_areas sa
         WHERE sa.user_id = ${userColumn} AND sa.district_id = ?))`,
      f.district_id,
      f.district_id
    );
  } else if (f.division_id) {
    filter.add(
      `(${districtColumn} IN (SELECT id FROM districts WHERE division_id = ?) OR EXISTS (
         SELECT 1 FROM provider_service_areas sa JOIN districts sd ON sd.id = sa.district_id
         WHERE sa.user_id = ${userColumn} AND sd.division_id = ?))`,
      f.division_id,
      f.division_id
    );
  }
}

async function search(req, res) {
  const f = req.q;
  const filter = sqlFilter("u.is_blocked = 0", "u.role = 'labour'");
  areaFilter(filter, f, "lp.district_id", "u.id");
  if (f.max_wage !== null) filter.add("lp.daily_wage <= ?", f.max_wage);
  if (f.available_only) filter.add("lp.is_available = 1");
  filter.search(f.q, ["u.name", "lp.skills", "lp.upazila"]);

  const { rows, meta } = await paginate(db, {
    selectSql: LABOUR_SELECT,
    fromSql: `${LABOUR_FROM} ${filter.where}`,
    params: filter.params,
    orderSql: SORTS[f.sort],
    paging: getPagination(req.query, 12)
  });
  send(req, res, { data: rows, meta });
}

async function show(req, res) {
  const [rows] = await db.query(`${LABOUR_SELECT} ${LABOUR_FROM} WHERE u.id = ? AND u.is_blocked = 0`, [req.params.id]);
  if (!rows[0]) throw ApiError.notFound("শ্রমিকের প্রোফাইল পাওয়া যায়নি।", "Worker profile not found.");
  send(req, res, { data: rows[0] });
}

async function myProfile(req, res) {
  const [rows] = await db.query(`${LABOUR_SELECT} ${LABOUR_FROM} WHERE u.id = ?`, [req.user.id]);
  send(req, res, { data: rows[0] || null });
}

async function saveProfile(req, res) {
  const d = req.body;
  await db.query(
    `INSERT INTO labour_profiles (user_id, skills, experience_years, experience_details, daily_wage, district_id,
                                  upazila, is_available, available_from)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE skills = VALUES(skills), experience_years = VALUES(experience_years),
       experience_details = VALUES(experience_details), daily_wage = VALUES(daily_wage),
       district_id = VALUES(district_id), upazila = VALUES(upazila), is_available = VALUES(is_available),
       available_from = VALUES(available_from)`,
    [req.user.id, d.skills, d.experience_years, d.experience_details, d.daily_wage, d.district_id, d.upazila,
      d.is_available ? 1 : 0, d.available_from]
  );

  await logActivity(req, "labour.profile_save", "user", req.user.id);
  const [rows] = await db.query(`${LABOUR_SELECT} ${LABOUR_FROM} WHERE u.id = ?`, [req.user.id]);
  send(req, res, { message: ["প্রোফাইল সংরক্ষণ হয়েছে।", "Profile saved."], data: rows[0] });
}

async function setAvailability(req, res) {
  const [result] = await db.query("UPDATE labour_profiles SET is_available = ?, available_from = ? WHERE user_id = ?", [
    req.body.is_available ? 1 : 0,
    req.body.available_from,
    req.user.id
  ]);
  if (result.affectedRows === 0) {
    throw ApiError.badRequest("আগে আপনার কাজের প্রোফাইল তৈরি করুন।", "Create your work profile first.");
  }
  send(req, res, {
    message: ["অবস্থা হালনাগাদ হয়েছে।", "Availability updated."],
    data: { is_available: req.body.is_available }
  });
}

module.exports = { schemas, search, show, myProfile, saveProfile, setAvailability, areaFilter };
