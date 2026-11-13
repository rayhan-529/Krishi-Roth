/**
 * Trade status rules shared by users (tradeController) and admins
 * (adminController). All functions expect a transaction connection.
 *
 * Status flow:
 *   payment_pending -> payment_confirmed -> delivery_pending -> completed
 *   payment_pending -> cancelled           (before payment is confirmed)
 *   any open status -> disputed -> completed | cancelled (admin decides)
 *
 * No real money moves through Krishi Roth. "Payment" steps only record
 * what the buyer and the farmer report (e.g. a bKash transaction ID).
 */
const { notify } = require("./notificationService");

const OPEN_STATUSES = ["payment_pending", "payment_confirmed", "delivery_pending", "disputed"];

async function lockTrade(conn, id) {
  const [rows] = await conn.query("SELECT * FROM trade_records WHERE id = ? FOR UPDATE", [id]);
  return rows[0] || null;
}

/** Changes the status and writes the history row. */
async function changeStatus(conn, trade, toStatus, userId, note = null, extraSql = "", extraParams = []) {
  await conn.query(`UPDATE trade_records SET status = ? ${extraSql} WHERE id = ?`, [toStatus, ...extraParams, trade.id]);
  await conn.query(
    `INSERT INTO trade_status_history (trade_id, from_status, to_status, changed_by, note) VALUES (?, ?, ?, ?, ?)`,
    [trade.id, trade.status, toStatus, userId, note]
  );
}

/** A cancelled trade gives its quantity back to the listing. */
async function restoreListingQuantity(conn, trade) {
  const [[listing]] = await conn.query("SELECT * FROM crop_listings WHERE id = ? FOR UPDATE", [trade.listing_id]);
  if (!listing) return;

  const available = Math.min(
    Number(listing.quantity),
    Number((Number(listing.quantity_available) + Number(trade.quantity)).toFixed(2))
  );
  const status = ["reserved", "sold"].includes(listing.status) ? "active" : listing.status;
  await conn.query("UPDATE crop_listings SET quantity_available = ?, status = ? WHERE id = ?", [
    available,
    status,
    listing.id
  ]);
}

/** When a trade completes and nothing is left to sell, the listing becomes "sold". */
async function markListingSoldIfFinished(conn, trade) {
  const [[listing]] = await conn.query("SELECT * FROM crop_listings WHERE id = ? FOR UPDATE", [trade.listing_id]);
  if (!listing || Number(listing.quantity_available) > 0) return;

  const [[{ open }]] = await conn.query(
    `SELECT COUNT(*) AS open FROM trade_records WHERE listing_id = ? AND id <> ? AND status IN (?)`,
    [listing.id, trade.id, OPEN_STATUSES]
  );
  if (Number(open) === 0 && listing.status !== "removed") {
    await conn.query("UPDATE crop_listings SET status = 'sold' WHERE id = ?", [listing.id]);
  }
}

/** Notifies the other party (or both parties when actorId is an admin). */
async function notifyParties(conn, trade, actorId, title, body = null) {
  const targets = [trade.buyer_id, trade.farmer_id].filter((id) => id !== actorId);
  for (const userId of targets) {
    await notify(conn, userId, {
      type: "trade_update",
      title,
      body,
      link: `/trades/${trade.id}`,
      entityType: "trade",
      entityId: trade.id
    });
  }
}

module.exports = {
  OPEN_STATUSES,
  lockTrade,
  changeStatus,
  restoreListingQuantity,
  markListingSoldIfFinished,
  notifyParties
};
