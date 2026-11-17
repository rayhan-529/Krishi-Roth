/**
 * Trade records with Safe Trade escrow.
 * Only the buyer and the farmer of a trade can see or change it.
 *
 *   payment_pending   --pay_escrow (buyer)-->       payment_confirmed  money locked in escrow
 *   payment_confirmed --start_delivery (farmer)-->  delivery_pending   auto-release timer starts
 *   delivery_pending  --confirm_receipt (buyer)-->  completed          escrow paid to the farmer
 *   payment_pending   --cancel (either)-->          cancelled          no money involved
 *   payment_confirmed --cancel (farmer)-->          cancelled          escrow refunded to the buyer
 *   open              --dispute (either)-->         disputed           an admin releases or refunds
 */
const db = require("../config/db");
const v = require("../utils/validator");
const ApiError = require("../utils/ApiError");
const { send } = require("../utils/response");
const { getPagination, paginate } = require("../utils/pagination");
const { sqlFilter } = require("../utils/sqlFilter");
const { withTransaction } = require("../services/transaction");
const trades = require("../services/tradeService");
const wallet = require("../services/walletService");
const { notifyMany } = require("../services/notificationService");
const { logActivity } = require("../services/activityService");
const { releaseDueEscrows } = require("../services/escrowService");

const TRADE_STATUSES = ["payment_pending", "payment_confirmed", "delivery_pending", "completed", "cancelled", "disputed"];

const schemas = {
  list: { status: v.enum(TRADE_STATUSES), page: v.integer(), limit: v.integer() },
  action: {
    action: v.enum(["pay_escrow", "start_delivery", "confirm_receipt", "cancel", "dispute"]).required(),
    delivery_method: v.enum(["buyer_pickup", "farmer_delivery", "transport_service"]),
    delivery_address: v.string().max(255),
    expected_delivery_date: v.date(),
    reason: v.string().max(500)
  }
};

const TRADE_SELECT = `
  SELECT t.*, c.name_bn AS crop_bn, c.name_en AS crop_en, l.variety,
         (SELECT image_path FROM crop_listing_images i WHERE i.listing_id = l.id ORDER BY i.sort_order, i.id LIMIT 1) AS cover_image,
         b.name AS buyer_name, b.profile_photo AS buyer_photo, b.verification_status AS buyer_verification,
         f.name AS farmer_name, f.profile_photo AS farmer_photo, f.verification_status AS farmer_verification`;

const TRADE_FROM = `
  FROM trade_records t
  JOIN crop_listings l ON l.id = t.listing_id
  JOIN crops c ON c.id = l.crop_id
  JOIN users b ON b.id = t.buyer_id
  JOIN users f ON f.id = t.farmer_id`;

async function list(req, res) {
  await releaseDueEscrows(req.user.id);
  const filter = sqlFilter("(t.buyer_id = ? OR t.farmer_id = ?)");
  filter.params.push(req.user.id, req.user.id);
  if (req.q.status) filter.add("t.status = ?", req.q.status);

  const { rows, meta } = await paginate(db, {
    selectSql: TRADE_SELECT,
    fromSql: `${TRADE_FROM} ${filter.where}`,
    params: filter.params,
    orderSql: "ORDER BY t.updated_at DESC",
    paging: getPagination(req.query, 10)
  });

  send(req, res, { data: rows, meta });
}

/** Full trade details. Contact details are shared because the trade is agreed. */
async function loadTradeDetails(id) {
  const [rows] = await db.query(
    `${TRADE_SELECT}, b.phone AS buyer_phone, b.email AS buyer_email, f.phone AS farmer_phone, f.email AS farmer_email,
            l.district_id, d.name_bn AS district_bn, d.name_en AS district_en, l.upazila
     ${TRADE_FROM} JOIN districts d ON d.id = l.district_id
     WHERE t.id = ?`,
    [id]
  );
  const trade = rows[0];
  if (!trade) return null;

  const [history] = await db.query(
    `SELECT h.id, h.from_status, h.to_status, h.note, h.created_at, u.name AS changed_by_name, u.role AS changed_by_role
     FROM trade_status_history h LEFT JOIN users u ON u.id = h.changed_by
     WHERE h.trade_id = ? ORDER BY h.created_at, h.id`,
    [id]
  );
  trade.history = history;
  return trade;
}

async function show(req, res) {
  if (req.user.role !== "admin") await releaseDueEscrows(req.user.id);
  const trade = await loadTradeDetails(req.params.id);
  const isParty = trade && (trade.buyer_id === req.user.id || trade.farmer_id === req.user.id);
  if (!trade || (!isParty && req.user.role !== "admin")) {
    throw ApiError.notFound("লেনদেনটি পাওয়া যায়নি।", "Trade not found.");
  }

  const [reviews] = await db.query("SELECT reviewer_id, rating, comment, created_at FROM reviews WHERE trade_id = ?", [trade.id]);
  trade.reviews = reviews;
  trade.can_review = trade.status === "completed" && isParty && !reviews.some((r) => r.reviewer_id === req.user.id);

  send(req, res, { data: trade });
}

function wrongStep() {
  return ApiError.badRequest("লেনদেনের এই ধাপে এই কাজটি করা যাবে না।", "This action is not allowed at this step of the trade.");
}

function requireReason(reason) {
  if (!reason) {
    const message = { bn: "কারণ লিখুন।", en: "Please write the reason." };
    throw ApiError.badRequest(message.bn, message.en, { reason: message });
  }
}

async function act(req, res) {
  const data = req.body;

  await withTransaction(async (conn) => {
    const trade = await trades.lockTrade(conn, req.params.id);
    if (!trade) throw ApiError.notFound("লেনদেনটি পাওয়া যায়নি।", "Trade not found.");

    const isBuyer = trade.buyer_id === req.user.id;
    const isFarmer = trade.farmer_id === req.user.id;
    if (!isBuyer && !isFarmer) throw ApiError.forbidden();

    switch (data.action) {
      // Buyer pays from the wallet. The money is held by Krishi Roth, not sent to the farmer yet.
      case "pay_escrow": {
        if (!isBuyer || trade.status !== "payment_pending") throw wrongStep();
        await wallet.holdEscrow(conn, trade, req.user.id);
        await trades.changeStatus(conn, trade, "payment_confirmed", req.user.id, "Paid into Safe Trade escrow",
          ", payment_method = 'wallet', payment_marked_at = NOW(), payment_confirmed_at = NOW()");
        await trades.notifyParties(conn, trade, req.user.id,
          ["ক্রেতা টাকা জমা দিয়েছেন (সেফ ট্রেড)", "The buyer paid into Safe Trade escrow"],
          ["টাকা কৃষি রথে নিরাপদে রাখা আছে। এখন ফসল পাঠান।", "The money is held safely by Krishi Roth. Send the crop now."]);
        break;
      }

      case "start_delivery": {
        if (!isFarmer || trade.status !== "payment_confirmed") throw wrongStep();
        await trades.changeStatus(conn, trade, "delivery_pending", req.user.id, null,
          ", delivery_method = ?, delivery_address = ?, expected_delivery_date = ?, auto_release_at = IF(escrow_status = 'held', DATE_ADD(NOW(), INTERVAL ? DAY), NULL)",
          [data.delivery_method, data.delivery_address, data.expected_delivery_date, wallet.AUTO_RELEASE_DAYS]);
        await trades.notifyParties(conn, trade, req.user.id,
          ["ফসল পাঠানো শুরু হয়েছে", "Your crop is on the way"],
          [
            `ফসল হাতে পেলে প্রাপ্তি নিশ্চিত করুন। সমস্যা না জানালে ${wallet.AUTO_RELEASE_DAYS} দিন পর টাকা কৃষকের কাছে চলে যাবে।`,
            `Confirm receipt when it arrives. If you report no problem, the money goes to the farmer after ${wallet.AUTO_RELEASE_DAYS} days.`
          ]);
        break;
      }

      case "confirm_receipt": {
        if (!isBuyer || trade.status !== "delivery_pending") throw wrongStep();
        await trades.changeStatus(conn, trade, "completed", req.user.id, null,
          ", delivered_at = COALESCE(delivered_at, NOW()), buyer_confirmed_at = NOW(), completed_at = NOW(), auto_release_at = NULL");
        await wallet.releaseEscrow(conn, trade, req.user.id);
        await trades.markListingSoldIfFinished(conn, trade);
        await trades.notifyParties(conn, trade, req.user.id,
          ["লেনদেন সম্পন্ন হয়েছে, টাকা আপনার ওয়ালেটে", "Trade completed, money is in your wallet"],
          ["এখন ক্রেতাকে রেটিং দিতে পারেন।", "You can now rate the buyer."]);
        break;
      }

      // Before payment either side may cancel. After payment only the farmer may
      // (e.g. cannot deliver); the buyer gets the escrow back. The buyer must open a dispute instead.
      case "cancel": {
        const allowed = trade.status === "payment_pending" || (trade.status === "payment_confirmed" && isFarmer);
        if (!allowed) throw wrongStep();
        requireReason(data.reason);
        await trades.changeStatus(conn, trade, "cancelled", req.user.id, data.reason,
          ", cancelled_at = NOW(), cancelled_by = ?, cancel_reason = ?", [req.user.id, data.reason]);
        await wallet.refundEscrow(conn, trade, req.user.id);
        await trades.restoreListingQuantity(conn, trade);
        await trades.notifyParties(conn, trade, req.user.id,
          ["লেনদেনটি বাতিল করা হয়েছে", "The trade was cancelled"], [data.reason, data.reason]);
        break;
      }

      // After payment, problems go to the admin as a dispute.
      case "dispute": {
        if (!["payment_pending", "payment_confirmed", "delivery_pending"].includes(trade.status)) throw wrongStep();
        requireReason(data.reason);
        // The escrow stays locked (and auto-release stops) until an admin decides.
        await trades.changeStatus(conn, trade, "disputed", req.user.id, data.reason, ", auto_release_at = NULL");
        await conn.query(
          `INSERT INTO complaints (complainant_id, against_user_id, trade_id, category, subject, description)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [req.user.id, isBuyer ? trade.farmer_id : trade.buyer_id, trade.id,
            trade.status === "delivery_pending" ? "delivery" : "payment",
            `Trade #${trade.id} dispute`, data.reason]
        );
        await trades.notifyParties(conn, trade, req.user.id,
          ["লেনদেনে অভিযোগ করা হয়েছে", "A dispute was opened on your trade"], [data.reason, data.reason]);
        const [admins] = await conn.query("SELECT id FROM users WHERE role = 'admin' AND is_blocked = 0");
        await notifyMany(conn, admins.map((a) => a.id), {
          type: "trade_update",
          title: ["নতুন লেনদেন অভিযোগ", "New trade dispute"],
          body: [data.reason, data.reason],
          link: `/admin/trades?status=disputed`,
          entityType: "trade",
          entityId: trade.id
        });
        break;
      }

      default:
        throw wrongStep();
    }
  });

  await logActivity(req, `trade.${data.action}`, "trade", req.params.id);
  send(req, res, {
    message: ["লেনদেন হালনাগাদ হয়েছে।", "Trade updated."],
    data: await loadTradeDetails(req.params.id)
  });
}

module.exports = { schemas, list, show, act, loadTradeDetails, TRADE_STATUSES };
