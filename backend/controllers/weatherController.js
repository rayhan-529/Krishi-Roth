/**
 * GET /api/weather?district_id=18
 * Without district_id, a logged-in user gets their own district (else Dhaka).
 */
const db = require("../config/db");
const v = require("../utils/validator");
const ApiError = require("../utils/ApiError");
const { send } = require("../utils/response");
const weather = require("../services/weatherService");
const { adviceFor } = require("../services/weatherAdvice");

const DEFAULT_DISTRICT = 18; // Dhaka

const schemas = { forecast: { district_id: v.id() } };

async function forecast(req, res) {
  const districtId = req.q.district_id || (req.user && req.user.district_id) || DEFAULT_DISTRICT;
  if (!weather.hasDistrict(districtId)) throw ApiError.notFound("জেলাটি পাওয়া যায়নি।", "District not found.");

  const [[district]] = await db.query("SELECT id, name_bn, name_en FROM districts WHERE id = ?", [districtId]);
  if (!district) throw ApiError.notFound("জেলাটি পাওয়া যায়নি।", "District not found.");

  let data;
  try {
    data = await weather.getForecast(districtId);
  } catch (err) {
    console.error("[weather]", err.message);
    throw ApiError.unavailable("এখন আবহাওয়ার তথ্য পাওয়া যাচ্ছে না। একটু পরে চেষ্টা করুন।", "Weather data is not available right now. Please try again shortly.");
  }

  send(req, res, { data: { district, ...data, advice: adviceFor(data), source: "Open-Meteo" } });
}

module.exports = { schemas, forecast };
