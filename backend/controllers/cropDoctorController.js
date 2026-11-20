/**
 * Crop doctor: POST /api/crop-doctor/diagnose (multipart, field "photo").
 * The photo is kept in memory only: it is sent to the AI and never saved.
 */
const multer = require("multer");
const v = require("../utils/validator");
const ApiError = require("../utils/ApiError");
const { send } = require("../utils/response");
const ai = require("../services/aiService");
const { MAX_BYTES } = require("../middleware/upload");
const { logActivity } = require("../services/activityService");

const schemas = { diagnose: { crop: v.string().max(80), note: v.string().max(300) } };

const TYPES = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" };

/** Real file type from the first bytes (the browser's mimetype can be faked). */
function sniff(buffer) {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.slice(0, 4).toString("latin1") === "RIFF" && buffer.slice(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1, fields: 5 },
  fileFilter(req, file, cb) {
    if (TYPES[file.mimetype]) return cb(null, true);
    return cb(ApiError.badRequest("শুধু JPG, PNG বা WEBP ছবি দিন।", "Please upload a JPG, PNG or WEBP photo."));
  }
}).single("photo");

/** Wraps multer so its errors (e.g. file too large) become friendly messages. */
function receivePhoto(req, res, next) {
  photoUpload(req, res, (err) => {
    if (!err) return next();
    if (err instanceof ApiError) return next(err);
    if (err.code === "LIMIT_FILE_SIZE") {
      const mb = Math.round(MAX_BYTES / (1024 * 1024));
      return next(ApiError.badRequest(`ছবিটি ${mb} MB-এর বেশি বড়।`, `The photo is larger than ${mb} MB.`));
    }
    return next(ApiError.badRequest("ছবিটি পড়া যায়নি।", "The photo could not be read."));
  });
}

const AI_ERRORS = {
  not_configured: [503, "এআই সেবা এখনো চালু করা হয়নি। অ্যাডমিনকে জানান।", "The AI service is not configured yet. Please tell the administrator."],
  rate_limited: [503, "এআই সেবা এখন ব্যস্ত। এক মিনিট পর আবার চেষ্টা করুন।", "The AI service is busy. Please try again in a minute."],
  auth: [503, "এআই সেবার key সঠিক নয়। অ্যাডমিনকে জানান।", "The AI service key is not valid. Please tell the administrator."],
  blocked: [422, "এই ছবিটি বিশ্লেষণ করা যায়নি। অন্য একটি ছবি দিন।", "This photo could not be analysed. Please try another photo."],
  failed: [502, "ছবি বিশ্লেষণ করা যায়নি। আবার চেষ্টা করুন।", "The photo could not be analysed. Please try again."]
};

async function diagnose(req, res) {
  if (!req.file) {
    const message = { bn: "একটি ছবি দিন।", en: "Please add a photo." };
    throw ApiError.badRequest(message.bn, message.en, { photo: message });
  }
  const mimeType = sniff(req.file.buffer);
  if (!mimeType) throw ApiError.badRequest("ফাইলটি আসল ছবি নয়।", "The file is not a real image.");

  let result;
  try {
    result = await ai.diagnoseCropImage({ buffer: req.file.buffer, mimeType }, req.body, req.lang === "en" ? "en" : "bn");
  } catch (error) {
    if (!(error instanceof ai.AiError)) throw error;
    console.error(`Crop doctor AI ${error.kind}: ${error.message}`);
    const [status, bn, en] = AI_ERRORS[error.kind] || AI_ERRORS.failed;
    throw new ApiError(status, bn, en);
  }

  await logActivity(req, "crop_doctor.diagnose", "user", req.user.id, result.problem || (result.healthy ? "healthy" : ""));
  send(req, res, { data: result });
}

module.exports = { schemas, receivePhoto, diagnose };
