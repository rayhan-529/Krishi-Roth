/**
 * Purchase offers (step 1-4 of the safe trade workflow).
 *   Buyer:  send an offer on a listing, withdraw a pending offer
 *   Farmer: accept (creates a trade record) or reject an offer
 */
const db = require("../config/db");
const v = require("../utils/validator");
const ApiError = require("../utils/ApiError");
const { send } = require("../utils/response");
const { getPagination, paginate } = require("../utils/pagination");
const { sqlFilter } = require("../utils/sqlFilter");
const { withTransaction } = require("../services/transaction");
const { notify, notifyMany } = require("../services/notificationService");
const { logActivity } = require("../services/activityService");

const schemas = {
  create: {
    quantity: v.number().required().min(0.01).max(9999999),
    offered_price_per_unit: v.number().required().min(0.01).max(99999999),
    message: v.string().max(1000)
  },
  respond: { farmer_note: v.string().max(500) },
  list: {
    status: v.enum(["pending", "accepted", "rejected", "withdrawn", "expired"]),
    page: v.integer(),
    limit: v.integer()
  }
};

const OFFER_SELECT = `
  SELECT po.id, po.listing_id, po.buyer_id, po.farmer_id, po.quantity, po.unit, po.offered_price_per_unit,
         po.total_amount, po.message, po.status, po.farmer_note, po.responded_at, po.created_at,
         l.price_per_unit AS listing_price, l.quantity_available, l.status AS listing_status,
         c.name_bn AS crop_bn, c.name_en AS crop_en, l.variety,
         b.name AS buyer_name, b.verification_status AS buyer_verification,
         f.name AS farmer_name, f.verification_status AS farmer_verification,
         tr.id AS trade_id`;

const OFFER_FROM = `
  FROM purchase_offers po
  JOIN crop_listings l ON l.id = po.listing_id
  JOIN crops c ON c.id = l.crop_id
  JOIN users b ON b.id = po.buyer_id
  JOIN users f ON f.id = po.farmer_id
  LEFT JOIN trade_records tr ON tr.offer_id = po.id`;

async function create(req, res) {
  const data = req.body;

  const offerId = await withTransaction(async (conn) => {
    const [rows] = await conn.query(
      `SELECT l.*, u.is_blocked AS farmer_blocked FROM crop_listings l JOIN users u ON u.id = l.farmer_id
       WHERE l.id = ? FOR UPDATE`,
      [req.params.id]
    );
    const listing = rows[0];

    if (!listing || listing.status !== "active" || listing.farmer_blocked) {
      throw ApiError.badRequest("এই বিজ্ঞাপনে এখন প্রস্তাব দেওয়া যাবে না।", "This listing is not open for offers.");
    }
    if (listing.farmer_id === req.user.id) throw ApiError.forbidden();

    if (data.quantity > Number(listing.quantity_available)) {
      const message = {
        bn: `সর্বোচ্চ ${listing.quantity_available} পরিমাণের প্রস্তাব দেওয়া যাবে।`,
        en: `You can offer for at most ${listing.quantity_available}.`
      };
      throw ApiError.badRequest(message.bn, message.en, { quantity: message });
    }
    if (listing.min_order_quantity && data.quantity < Number(listing.min_order_quantity)) {
      const message = {
        bn: `সর্বনিম্ন অর্ডার ${listing.min_order_quantity}।`,
        en: `The minimum order is ${listing.min_order_quantity}.`
      };
      throw ApiError.badRequest(message.bn, message.en, { quantity: message });
    }
    if (!listing.is_negotiable && data.offered_price_per_unit !== Number(listing.price_per_unit)) {
      const message = {
        bn: "এই ফসলের দাম আলোচনাযোগ্য নয়। নির্ধারিত দামেই প্রস্তাব দিন।",
        en: "This price is fixed. Offer the listed price."
      };
      throw ApiError.badRequest(message.bn, message.en, { offered_price_per_unit: message });
    }

    const [pending] = await conn.query(
      "SELECT id FROM purchase_offers WHERE listing_id = ? AND buyer_id = ? AND status = 'pending'",
      [listing.id, req.user.id]
    );
    if (pending.length > 0) {
      throw ApiError.conflict(
        "এই বিজ্ঞাপনে আপনার একটি প্রস্তাব অপেক্ষমাণ আছে। নতুন প্রস্তাব দিতে আগেরটি প্রত্যাহার করুন।",
        "You already have a pending offer on this listing. Withdraw it to send a new one."
      );
    }

    const [result] = await conn.query(
      `INSERT INTO purchase_offers (listing_id, buyer_id, farmer_id, quantity, unit, offered_price_per_unit, message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [listing.id, req.user.id, listing.farmer_id, data.quantity, listing.unit, data.offered_price_per_unit, data.message]
    );

    await notify(conn, listing.farmer_id, {
      type: "offer_new",
      title: ["নতুন ক্রয় প্রস্তাব এসেছে", "You received a new purchase offer"],
      body: [
        `${req.user.name} ${data.quantity} পরিমাণ কিনতে চান।`,
        `${req.user.name} wants to buy ${data.quantity}.`
      ],
      link: "/offers",
      entityType: "offer",
      entityId: result.insertId
    });

    return result.insertId;
  });

  await logActivity(req, "offer.create", "offer", offerId);
  const [rows] = await db.query(`${OFFER_SELECT} ${OFFER_FROM} WHERE po.id = ?`, [offerId]);
  send(req, res, { status: 201, message: ["প্রস্তাব পাঠানো হয়েছে।", "Offer sent."], data: rows[0] });
}

/** Buyers see offers they sent; farmers see offers they received. */
async function list(req, res) {
  const column = req.user.role === "farmer" ? "po.farmer_id" : "po.buyer_id";
  const filter = sqlFilter(`${column} = ?`);
  filter.params.push(req.user.id);
  if (req.q.status) filter.add("po.status = ?", req.q.status);

  const { rows, meta } = await paginate(db, {
    selectSql: OFFER_SELECT,
    fromSql: `${OFFER_FROM} ${filter.where}`,
    params: filter.params,
    orderSql: "ORDER BY FIELD(po.status, 'pending') DESC, po.created_at DESC",
    paging: getPagination(req.query, 10)
  });

  send(req, res, { data: rows, meta });
}

async function lockOffer(conn, id) {
  const [rows] = await conn.query("SELECT * FROM purchase_offers WHERE id = ? FOR UPDATE", [id]);
  if (!rows[0]) throw ApiError.notFound("প্রস্তাবটি পাওয়া যায়নি।", "Offer not found.");
  return rows[0];
}

function requirePending(offer) {
  if (offer.status !== "pending") {
    throw ApiError.badRequest("এই প্রস্তাবটির উত্তর আগেই দেওয়া হয়েছে।", "This offer has already been answered.");
  }
}

/** Farmer accepts: reserves the quantity and creates the trade record. */
async function accept(req, res) {
  const tradeId = await withTransaction(async (conn) => {
    const offer = await lockOffer(conn, req.params.id);
    if (offer.farmer_id !== req.user.id) throw ApiError.forbidden();
    requirePending(offer);

    const [[listing]] = await conn.query("SELECT * FROM crop_listings WHERE id = ? FOR UPDATE", [offer.listing_id]);
    if (listing.status !== "active") {
      throw ApiError.badRequest("বিজ্ঞাপনটি এখন সক্রিয় নয়।", "The listing is not active.");
    }
    if (Number(offer.quantity) > Number(listing.quantity_available)) {
      throw ApiError.badRequest(
        `এত পরিমাণ আর বাকি নেই (বাকি: ${listing.quantity_available})।`,
        `Not enough quantity left (available: ${listing.quantity_available}).`
      );
    }

    const remaining = Number((Number(listing.quantity_available) - Number(offer.quantity)).toFixed(2));
    await conn.query("UPDATE crop_listings SET quantity_available = ?, status = ? WHERE id = ?", [
      remaining,
      remaining > 0 ? "active" : "reserved",
      listing.id
    ]);

    await conn.query(
      "UPDATE purchase_offers SET status = 'accepted', farmer_note = ?, responded_at = NOW() WHERE id = ?",
      [req.body.farmer_note, offer.id]
    );

    const [trade] = await conn.query(
      `INSERT INTO trade_records (offer_id, listing_id, buyer_id, farmer_id, quantity, unit, price_per_unit, total_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [offer.id, listing.id, offer.buyer_id, offer.farmer_id, offer.quantity, offer.unit,
        offer.offered_price_per_unit, offer.total_amount]
    );
    await conn.query(
      `INSERT INTO trade_status_history (trade_id, from_status, to_status, changed_by, note)
       VALUES (?, NULL, 'payment_pending', ?, 'Offer accepted')`,
      [trade.insertId, req.user.id]
    );

    await notify(conn, offer.buyer_id, {
      type: "offer_accepted",
      title: ["আপনার প্রস্তাব গৃহীত হয়েছে", "Your offer was accepted"],
      body: ["লেনদেনের বিস্তারিত দেখে মূল্য পরিশোধের তথ্য দিন।", "Open the trade to record your payment."],
      link: `/trades/${trade.insertId}`,
      entityType: "trade",
      entityId: trade.insertId
    });

    // If nothing is left, other pending offers can no longer be filled.
    if (remaining <= 0) {
      const [others] = await conn.query(
        "SELECT id, buyer_id FROM purchase_offers WHERE listing_id = ? AND status = 'pending'",
        [listing.id]
      );
      if (others.length > 0) {
        await conn.query(
          "UPDATE purchase_offers SET status = 'expired', responded_at = NOW() WHERE listing_id = ? AND status = 'pending'",
          [listing.id]
        );
        await notifyMany(conn, others.map((o) => o.buyer_id), {
          type: "offer_rejected",
          title: ["ফসলটি অন্য ক্রেতার কাছে বিক্রি হয়েছে", "The crop was sold to another buyer"],
          link: "/offers",
          entityType: "listing",
          entityId: listing.id
        });
      }
    }

    return trade.insertId;
  });

  await logActivity(req, "offer.accept", "trade", tradeId);
  send(req, res, {
    message: ["প্রস্তাব গ্রহণ করা হয়েছে। লেনদেন শুরু হয়েছে।", "Offer accepted. The trade has started."],
    data: { trade_id: tradeId }
  });
}

async function reject(req, res) {
  await withTransaction(async (conn) => {
    const offer = await lockOffer(conn, req.params.id);
    if (offer.farmer_id !== req.user.id) throw ApiError.forbidden();
    requirePending(offer);

    await conn.query(
      "UPDATE purchase_offers SET status = 'rejected', farmer_note = ?, responded_at = NOW() WHERE id = ?",
      [req.body.farmer_note, offer.id]
    );
    await notify(conn, offer.buyer_id, {
      type: "offer_rejected",
      title: ["আপনার প্রস্তাব গ্রহণ করা হয়নি", "Your offer was rejected"],
      body: req.body.farmer_note ? [req.body.farmer_note, req.body.farmer_note] : null,
      link: "/offers",
      entityType: "offer",
      entityId: offer.id
    });
  });

  await logActivity(req, "offer.reject", "offer", req.params.id);
  send(req, res, { message: ["প্রস্তাব বাতিল করা হয়েছে।", "Offer rejected."] });
}

async function withdraw(req, res) {
  await withTransaction(async (conn) => {
    const offer = await lockOffer(conn, req.params.id);
    if (offer.buyer_id !== req.user.id) throw ApiError.forbidden();
    requirePending(offer);

    await conn.query("UPDATE purchase_offers SET status = 'withdrawn', responded_at = NOW() WHERE id = ?", [offer.id]);
    await notify(conn, offer.farmer_id, {
      type: "offer_rejected",
      title: ["একজন ক্রেতা তার প্রস্তাব প্রত্যাহার করেছেন", "A buyer withdrew an offer"],
      link: "/offers",
      entityType: "offer",
      entityId: offer.id
    });
  });

  await logActivity(req, "offer.withdraw", "offer", req.params.id);
  send(req, res, { message: ["প্রস্তাব প্রত্যাহার করা হয়েছে।", "Offer withdrawn."] });
}

module.exports = { schemas, create, list, accept, reject, withdraw };
