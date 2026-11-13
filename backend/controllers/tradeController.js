/**
 * Trade records (steps 5-10 of the safe trade workflow).
 * Only the buyer and the farmer of a trade can see or change it.
 */
const db = require("../config/db");
const v = require("../utils/validator");
const ApiError = require("../utils/ApiError");
const { send } = require("../utils/response");
const { getPagination, paginate } = require("../utils/pagination");
const { sqlFilter } = require("../utils/sqlFilter");
const { withTransaction } = require("../services/transaction");
const trades = require("../services/tradeService");
const { notifyMany } = require("../services/notificationService");
const { logActivity } = require("../services/activityService");

const TRADE_STATUSES = ["payment_pending", "payment_confirmed", "delivery_pending", "completed", "cancelled", "disputed"];

const schemas = {
  list: { status: v.enum(TRADE_STATUSES), page: v.integer(), limit: v.integer() },
  action: {
    action: v.enum(["mark_paid", "confirm_payment", "start_delivery", "confirm_receipt", "cancel", "dispute"]).required(),
    payment_method: v.enum(["cash", "bkash", "nagad", "rocket", "bank_transfer", "other"]),
    payment_reference: v.string().max(100),
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
      // Buyer reports how they paid. Status stays "payment_pending" until the farmer confirms.
      case "mark_paid": {
        if (!isBuyer || trade.status !== "payment_pending") throw wrongStep();
        if (!data.payment_method) {
          const message = { bn: "কীভাবে মূল্য দিয়েছেন তা বেছে নিন।", en: "Choose how you paid." };
          throw ApiError.badRequest(message.bn, message.en, { payment_method: message });
        }
        await conn.query(
          "UPDATE trade_records SET payment_method = ?, payment_reference = ?, payment_marked_at = NOW() WHERE id = ?",
          [data.payment_method, data.payment_reference, trade.id]
        );
        await conn.query(
          `INSERT INTO trade_status_history (trade_id, from_status, to_status, changed_by, note)
           VALUES (?, 'payment_pending', 'payment_pending', ?, ?)`,
          [trade.id, req.user.id, `Buyer reported payment (${data.payment_method}${data.payment_reference ? `: ${data.payment_reference}` : ""})`]
        );
        await trades.notifyParties(conn, trade, req.user.id,
          ["ক্রেতা মূল্য পরিশোধের তথ্য দিয়েছেন", "The buyer reported a payment"],
          ["টাকা পেয়েছেন কি না যাচাই করে নিশ্চিত করুন।", "Check that you received it, then confirm."]);
        break;
      }

      case "confirm_payment": {
        if (!isFarmer || trade.status !== "payment_pending") throw wrongStep();
        await trades.changeStatus(conn, trade, "payment_confirmed", req.user.id, null,
          ", payment_confirmed_at = NOW(), payment_method = COALESCE(payment_method, ?)", [data.payment_method || "cash"]);
        await trades.notifyParties(conn, trade, req.user.id,
          ["কৃষক মূল্য পাওয়া নিশ্চিত করেছেন", "The farmer confirmed your payment"]);
        break;
      }

      case "start_delivery": {
        if (!isFarmer || trade.status !== "payment_confirmed") throw wrongStep();
        await trades.changeStatus(conn, trade, "delivery_pending", req.user.id, null,
          ", delivery_method = ?, delivery_address = ?, expected_delivery_date = ?",
          [data.delivery_method, data.delivery_address, data.expected_delivery_date]);
        await trades.notifyParties(conn, trade, req.user.id,
          ["ফসল পাঠানো শুরু হয়েছে", "Your crop is on the way"],
          ["ফসল হাতে পেলে প্রাপ্তি নিশ্চিত করুন।", "Confirm receipt when it arrives."]);
        break;
      }

      case "confirm_receipt": {
        if (!isBuyer || trade.status !== "delivery_pending") throw wrongStep();
        await trades.changeStatus(conn, trade, "completed", req.user.id, null,
          ", delivered_at = COALESCE(delivered_at, NOW()), buyer_confirmed_at = NOW(), completed_at = NOW()");
        await trades.markListingSoldIfFinished(conn, trade);
        await trades.notifyParties(conn, trade, req.user.id,
          ["লেনদেন সম্পন্ন হয়েছে", "The trade is completed"],
          ["এখন ক্রেতাকে রেটিং দিতে পারেন।", "You can now rate the buyer."]);
        break;
      }

      // Either side may cancel only before the payment is confirmed.
      case "cancel": {
        if (trade.status !== "payment_pending") throw wrongStep();
        requireReason(data.reason);
        await trades.changeStatus(conn, trade, "cancelled", req.user.id, data.reason,
          ", cancelled_at = NOW(), cancelled_by = ?, cancel_reason = ?", [req.user.id, data.reason]);
        await trades.restoreListingQuantity(conn, trade);
        await trades.notifyParties(conn, trade, req.user.id,
          ["লেনদেনটি বাতিল করা হয়েছে", "The trade was cancelled"], [data.reason, data.reason]);
        break;
      }

      // After payment, problems go to the admin as a dispute.
      case "dispute": {
        if (!["payment_pending", "payment_confirmed", "delivery_pending"].includes(trade.status)) throw wrongStep();
        requireReason(data.reason);
        await trades.changeStatus(conn, trade, "disputed", req.user.id, data.reason);
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
