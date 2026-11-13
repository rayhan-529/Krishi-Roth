/**
 * Shared photo handling for crop listings, machinery and vehicles.
 * Each photo table has the same shape: id, <parent>_id, image_path, sort_order.
 */
const { storePublicFile, removePublicFile } = require("./storageService");
const ApiError = require("../utils/ApiError");

const TABLES = {
  listing: { table: "crop_listing_images", fk: "listing_id", folder: "listings" },
  machinery: { table: "machinery_images", fk: "machinery_id", folder: "machinery" },
  vehicle: { table: "transport_vehicle_images", fk: "vehicle_id", folder: "vehicles" }
};

const MAX_IMAGES = 5;

async function listImages(conn, kind, parentId) {
  const { table, fk } = TABLES[kind];
  const [rows] = await conn.query(
    `SELECT id, image_path, sort_order FROM ${table} WHERE ${fk} = ? ORDER BY sort_order, id`,
    [parentId]
  );
  return rows;
}

/**
 * Removes the photos the user un-ticked, then saves newly uploaded photos.
 * @param {object} conn            db or transaction connection
 * @param {"listing"|"machinery"|"vehicle"} kind
 * @param {number} parentId
 * @param {Array} files            req.files from multer
 * @param {number[]} removeIds     ids of photos to delete
 */
async function syncImages(conn, kind, parentId, files = [], removeIds = []) {
  const { table, fk, folder } = TABLES[kind];
  const removedPaths = [];

  if (removeIds && removeIds.length > 0) {
    const [rows] = await conn.query(`SELECT id, image_path FROM ${table} WHERE ${fk} = ? AND id IN (?)`, [
      parentId,
      removeIds
    ]);
    if (rows.length > 0) {
      await conn.query(`DELETE FROM ${table} WHERE ${fk} = ? AND id IN (?)`, [parentId, rows.map((r) => r.id)]);
      removedPaths.push(...rows.map((r) => r.image_path));
    }
  }

  const [[{ count, maxOrder }]] = await conn.query(
    `SELECT COUNT(*) AS count, COALESCE(MAX(sort_order), -1) AS maxOrder FROM ${table} WHERE ${fk} = ?`,
    [parentId]
  );

  if (Number(count) + files.length > MAX_IMAGES) {
    throw ApiError.badRequest(`সর্বোচ্চ ${MAX_IMAGES}টি ছবি রাখা যাবে।`, `You can keep at most ${MAX_IMAGES} photos.`);
  }

  let order = Number(maxOrder);
  for (const file of files) {
    order += 1;
    const stored = await storePublicFile(folder, file);
    await conn.query(`INSERT INTO ${table} (${fk}, image_path, sort_order) VALUES (?, ?, ?)`, [
      parentId,
      stored,
      order
    ]);
  }

  // Delete old photos only after the database work succeeded.
  return () => removedPaths.forEach((stored) => removePublicFile(stored));
}

/** Deletes all photo files of a parent record (call before deleting the record). */
async function deleteAllImageFiles(conn, kind, parentId) {
  const images = await listImages(conn, kind, parentId);
  return () => images.forEach((image) => removePublicFile(image.image_path));
}

module.exports = { listImages, syncImages, deleteAllImageFiles, MAX_IMAGES };
