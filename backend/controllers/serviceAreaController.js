/**
 * Extra working/service areas for labour, machinery and transport owners
 * (in addition to the district on their profile or machine/vehicle).
 */
const db = require("../config/db");
const v = require("../utils/validator");
const ApiError = require("../utils/ApiError");
const { send } = require("../utils/response");
const { withTransaction } = require("../services/transaction");

const MAX_AREAS = 20;
const PROVIDER_ROLES = ["labour", "harvester_owner", "tractor_owner", "transport_owner"];

const areaRule = { district_id: v.id().required(), upazila: v.string().max(80).default("") };

async function load(userId) {
  const [rows] = await db.query(
    `SELECT sa.id, sa.district_id, d.name_bn AS district_bn, d.name_en AS district_en, sa.upazila
     FROM provider_service_areas sa JOIN districts d ON d.id = sa.district_id
     WHERE sa.user_id = ? ORDER BY d.name_en, sa.upazila`,
    [userId]
  );
  return rows;
}

async function list(req, res) {
  send(req, res, { data: await load(req.user.id) });
}

/** Replaces the whole list of areas. Body: { areas: [{ district_id, upazila }] } */
async function replace(req, res) {
  const raw = Array.isArray(req.body.areas) ? req.body.areas : null;
  if (!raw) throw ApiError.badRequest("এলাকার তালিকা পড়া যায়নি।", "The list of areas could not be read.");
  if (raw.length > MAX_AREAS) {
    throw ApiError.badRequest(`সর্বোচ্চ ${MAX_AREAS}টি এলাকা যোগ করা যাবে।`, `You can add at most ${MAX_AREAS} areas.`);
  }

  const areas = [];
  const seen = new Set();
  for (const item of raw) {
    const { value, errors } = v.validate(areaRule, item || {});
    if (errors) throw ApiError.badRequest("একটি এলাকার তথ্য ঠিক নেই।", "One of the areas is not valid.");
    const key = `${value.district_id}|${value.upazila || ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      areas.push(value);
    }
  }

  await withTransaction(async (conn) => {
    await conn.query("DELETE FROM provider_service_areas WHERE user_id = ?", [req.user.id]);
    for (const area of areas) {
      await conn.query("INSERT INTO provider_service_areas (user_id, district_id, upazila) VALUES (?, ?, ?)", [
        req.user.id,
        area.district_id,
        area.upazila || ""
      ]);
    }
  });

  send(req, res, { message: ["সেবার এলাকা সংরক্ষণ হয়েছে।", "Service areas saved."], data: await load(req.user.id) });
}

module.exports = { list, replace, PROVIDER_ROLES };
