/**
 * Safe file uploads.
 *
 *   uploads/public/<folder>/...   photos (crops, machinery, vehicles, profile)
 *                                 served at /uploads/<folder>/<file>
 *   uploads/private/verifications identity documents — NEVER served
 *                                 publicly; only admins can open them
 *                                 through an authenticated API route.
 *
 * Checks: allowed MIME type + matching extension, size limit
 * (UPLOAD_MAX_MB in .env), file count, and the real file signature
 * ("magic bytes") so a renamed .exe cannot pass as a .jpg.
 * File names are random, never the user's original name.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const ApiError = require("../utils/ApiError");

const UPLOAD_ROOT = path.join(__dirname, "..", "uploads");
const PUBLIC_DIR = path.join(UPLOAD_ROOT, "public");
const PRIVATE_DIR = path.join(UPLOAD_ROOT, "private");
const MAX_BYTES = (Number(process.env.UPLOAD_MAX_MB) || 3) * 1024 * 1024;

const IMAGE_TYPES = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"]
};
const DOCUMENT_TYPES = { ...IMAGE_TYPES, "application/pdf": [".pdf"] };

/** First bytes of each allowed file type. */
function hasValidSignature(buffer, mimetype) {
  const hex = buffer.toString("hex");
  switch (mimetype) {
    case "image/jpeg":
      return hex.startsWith("ffd8ff");
    case "image/png":
      return hex.startsWith("89504e470d0a1a0a");
    case "image/webp":
      return buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
    case "application/pdf":
      return buffer.toString("ascii", 0, 5) === "%PDF-";
    default:
      return false;
  }
}

function makeUploader(directory, types, { maxFiles }) {
  const storage = multer.diskStorage({
    destination(req, file, cb) {
      fs.mkdirSync(directory, { recursive: true });
      cb(null, directory);
    },
    filename(req, file, cb) {
      const ext = types[file.mimetype][0];
      cb(null, `${Date.now()}-${crypto.randomBytes(10).toString("hex")}${ext}`);
    }
  });

  return multer({
    storage,
    limits: { fileSize: MAX_BYTES, files: maxFiles, fields: 40 },
    fileFilter(req, file, cb) {
      const ext = path.extname(file.originalname || "").toLowerCase();
      if (types[file.mimetype] && types[file.mimetype].includes(ext)) return cb(null, true);
      const allowed = Object.values(types).flat().join(", ");
      return cb(
        ApiError.badRequest(
          `এই ধরনের ফাইল গ্রহণযোগ্য নয়। অনুমোদিত: ${allowed}`,
          `This file type is not allowed. Allowed: ${allowed}`
        )
      );
    }
  });
}

/** After multer saves the files, confirm their real content type. */
function checkSignatures(req, res, next) {
  const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : [];
  if (req.file) files.push(req.file);

  for (const file of files) {
    const buffer = Buffer.alloc(12);
    const fd = fs.openSync(file.path, "r");
    fs.readSync(fd, buffer, 0, 12, 0);
    fs.closeSync(fd);

    if (!hasValidSignature(buffer, file.mimetype)) {
      throw ApiError.badRequest(
        "ফাইলটি নষ্ট অথবা আসল ছবি/ডকুমেন্ট নয়।",
        "The file is damaged or is not a real image/document."
      );
    }
  }
  next();
}

/** Up to `maxFiles` photos in the "images" field, saved to uploads/public/<folder>. */
function imageUpload(folder, maxFiles = 5) {
  const uploader = makeUploader(path.join(PUBLIC_DIR, folder), IMAGE_TYPES, { maxFiles });
  return [uploader.array("images", maxFiles), checkSignatures];
}

/** One photo in the given field, saved to uploads/public/<folder>. */
function singleImage(folder, field = "photo") {
  const uploader = makeUploader(path.join(PUBLIC_DIR, folder), IMAGE_TYPES, { maxFiles: 1 });
  return [uploader.single(field), checkSignatures];
}

/** One identity document (image or PDF) in the "document" field — PRIVATE. */
function privateDocument() {
  const uploader = makeUploader(path.join(PRIVATE_DIR, "verifications"), DOCUMENT_TYPES, {
    maxFiles: 1
  });
  return [uploader.single("document"), checkSignatures];
}

/** Path stored in the database for a public file, e.g. /uploads/listings/abc.jpg */
function publicUrl(folder, file) {
  return `/uploads/${folder}/${file.filename}`;
}

/** Deletes a public file by its stored /uploads/... path. Never leaves PUBLIC_DIR. */
function deletePublicFile(storedPath) {
  if (!storedPath || !storedPath.startsWith("/uploads/")) return;
  const full = path.resolve(PUBLIC_DIR, storedPath.slice("/uploads/".length));
  if (!full.startsWith(PUBLIC_DIR + path.sep)) return;
  fs.promises.unlink(full).catch(() => {});
}

/** Absolute path of a private verification document, or null if invalid. */
function privateDocumentPath(fileName) {
  if (!/^[\w.-]+$/.test(fileName || "")) return null;
  const full = path.join(PRIVATE_DIR, "verifications", fileName);
  return fs.existsSync(full) ? full : null;
}

/** Removes files uploaded during a request that then failed. */
function removeUploadedFiles(req) {
  const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : [];
  if (req.file) files.push(req.file);
  for (const file of files) fs.promises.unlink(file.path).catch(() => {});
}

module.exports = {
  PUBLIC_DIR,
  MAX_BYTES,
  imageUpload,
  singleImage,
  privateDocument,
  publicUrl,
  deletePublicFile,
  privateDocumentPath,
  removeUploadedFiles
};
