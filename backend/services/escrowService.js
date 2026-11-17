/**
 * Automatic escrow release.
 *
 * When the farmer has started delivery and the buyer neither confirms
 * receipt nor opens a dispute within AUTO_RELEASE_DAYS, the trade is
 * completed and the escrow is paid to the farmer, so a silent buyer cannot
 * keep the farmer's money locked forever.
 *
 * Runs from the background scheduler and also when a user opens their
 * trades or wallet (free hosting plans put the server to sleep).
 */
const db = require("../config/db");
const { withTransaction } = require("./transaction");
const trades = require("./tradeService");
const wallet = require("./walletService");

/**
 * @param {number|null} userId  only this user's trades (buyer or farmer), or all when null
 * @returns {Promise<number>} how many trades were released
 */
async function releaseDueEscrows(userId = null) {
  const [due] = await db.query(
    `SELECT id FROM trade_records
     WHERE status = 'delivery_pending' AND escrow_status = 'held'
       AND auto_release_at IS NOT NULL AND auto_release_at <= NOW()
       ${userId ? "AND (buyer_id = ? OR farmer_id = ?)" : ""}
     LIMIT 50`,
    userId ? [userId, userId] : []
  );

  let released = 0;
  for (const { id } of due) {
    await withTransaction(async (conn) => {
      const trade = await trades.lockTrade(conn, id);
      // Re-check under the lock: the buyer may have confirmed or disputed meanwhile.
      if (!trade || trade.status !== "delivery_pending" || trade.escrow_status !== "held" || !trade.auto_release_at) return;
      if (new Date(trade.auto_release_at) > new Date()) return;

      const note = `Auto-released after ${wallet.AUTO_RELEASE_DAYS} days without buyer response`;
      await trades.changeStatus(conn, trade, "completed", null, note,
        ", delivered_at = COALESCE(delivered_at, NOW()), completed_at = NOW(), auto_release_at = NULL");
      await wallet.releaseEscrow(conn, trade, null, note);
      await trades.markListingSoldIfFinished(conn, trade);
      await trades.notifyParties(conn, trade, null,
        ["সেফ ট্রেড স্বয়ংক্রিয়ভাবে সম্পন্ন হয়েছে", "Safe Trade completed automatically"],
        [
          `ক্রেতা ${wallet.AUTO_RELEASE_DAYS} দিনে কোনো সমস্যা জানাননি, তাই টাকা কৃষকের ওয়ালেটে দেওয়া হয়েছে।`,
          `The buyer reported no problem within ${wallet.AUTO_RELEASE_DAYS} days, so the money was paid to the farmer.`
        ]);
      released += 1;
    });
  }
  return released;
}

module.exports = { releaseDueEscrows };
