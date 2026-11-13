/**
 * Where public photos are kept.
 *
 *   Local (default)  files stay in backend/uploads/public/<folder>/ and are
 *                    served at /uploads/<folder>/<file>. Good for development
 *                    and for servers with a permanent disk.
 *
 *   Cloudinary       used automatically when CLOUDINARY_URL is set in .env
 *                    (cloudinary://API_KEY:API_SECRET@CLOUD_NAME).
 *                    Needed on hosts whose disk is wiped on restart, such as
 *                    Render's free plan. The free Cloudinary plan is enough.
 *
 * Uses Cloudinary's REST API directly (no extra npm package).
 */
const fs = require("fs");
const crypto = require("crypto");
const { publicUrl, deletePublicFile } = require("../middleware/upload");

function readCloudinaryConfig() {
  const url = (process.env.CLOUDINARY_URL || "").trim();
  const match = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  if (!match) return null;
  return { apiKey: match[1], apiSecret: match[2], cloudName: match[3] };
}

const cloudinary = readCloudinaryConfig();
const ROOT_FOLDER = "krishi-roth";

/** Cloudinary request signature: sha1 of sorted params + secret. */
function sign(params) {
  const text = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return crypto.createHash("sha1").update(text + cloudinary.apiSecret).digest("hex");
}

async function cloudinaryRequest(action, params, file) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signed = { ...params, timestamp };
  const form = new FormData();

  for (const [key, value] of Object.entries(signed)) form.append(key, String(value));
  form.append("api_key", cloudinary.apiKey);
  form.append("signature", sign(signed));
  if (file) {
    const buffer = await fs.promises.readFile(file.path);
    form.append("file", new Blob([buffer], { type: file.mimetype }), file.filename);
  }

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinary.cloudName}/image/${action}`, {
    method: "POST",
    body: form
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Cloudinary ${action} failed: ${body.error ? body.error.message : response.status}`);
  }
  return body;
}

/**
 * Stores an uploaded file (already saved by multer) and returns the URL or
 * path to keep in the database.
 * @param {string} folder  e.g. "listings"
 * @param {object} file    multer file
 */
async function storePublicFile(folder, file) {
  if (!cloudinary) return publicUrl(folder, file);

  try {
    const result = await cloudinaryRequest("upload", { folder: `${ROOT_FOLDER}/${folder}` }, file);
    return result.secure_url;
  } finally {
    fs.promises.unlink(file.path).catch(() => {});
  }
}

/** Removes a stored photo (local path or Cloudinary URL). Never throws. */
async function removePublicFile(stored) {
  if (!stored) return;

  if (stored.startsWith("/uploads/")) {
    deletePublicFile(stored);
    return;
  }

  if (cloudinary && stored.includes("res.cloudinary.com")) {
    // .../image/upload/v1712345678/krishi-roth/listings/abc.jpg -> krishi-roth/listings/abc
    const match = stored.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z0-9]+$/i);
    if (!match) return;
    try {
      await cloudinaryRequest("destroy", { public_id: match[1] });
    } catch (error) {
      console.error(error.message);
    }
  }
}

function storageDriver() {
  return cloudinary ? "cloudinary" : "local";
}

module.exports = { storePublicFile, removePublicFile, storageDriver };
