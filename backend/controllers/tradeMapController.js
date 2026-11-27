/**
 * Delivery map for a trade.
 *
 *   PATCH  /trades/:id/place      { lat, lng }   farmer -> pickup point, buyer -> drop point
 *   POST   /trades/:id/tracking   { lat, lng, accuracy?, speed?, heading?, vehicle_info? }
 *   DELETE /trades/:id/tracking   stop sharing
 *
 * Who shares the live location: whoever brings the vehicle.
 *   delivery_method = buyer_pickup                       -> the buyer (comes to the farm)
 *   delivery_method = farmer_delivery / transport_service -> the farmer (goes to the buyer)
 *
 * Locations are only visible to the two people in the trade (and admins),
 * and live sharing is only possible while the trade is "delivery_pending".
 * Every change is pushed live to both people over the notification stream
 * (event "trade_map").
 */
const db = require("../config/db");
const v = require("../utils/validator");
const ApiError = require("../utils/ApiError");
const { send } = require("../utils/response");
const live = require("../services/liveService");
const { notify } = require("../services/notificationService");

// Bangladesh with a margin; also catches swapped latitude/longitude.
const BOUNDS = { latMin: 19.5, latMax: 27.5, lngMin: 87.5, lngMax: 93.5 };
const MIN_UPDATE_MS = 3000; // a phone may send faster; extra updates are ignored
const lastUpdate = new Map(); // tradeId -> time of the last saved live position

const outside = { bn: "এই জায়গাটি বাংলাদেশের মধ্যে নয়।", en: "This place is not inside Bangladesh." };
const lat = () => v.number().required().custom((n) => (n < BOUNDS.latMin || n > BOUNDS.latMax ? outside : null));
const lng = () => v.number().required().custom((n) => (n < BOUNDS.lngMin || n > BOUNDS.lngMax ? outside : null));

const schemas = {
  place: { lat: lat(), lng: lng() },
  tracking: {
    lat: lat(),
    lng: lng(),
    accuracy: v.number().min(0).max(100000),
    speed: v.number().min(0).max(100), // metres per second
    heading: v.number().min(0).max(360),
    vehicle_info: v.string().max(200)
  }
};

const MAP_COLUMNS = `id, buyer_id, farmer_id, status, delivery_method, pickup_lat, pickup_lng, drop_lat, drop_lng,
  tracking_active, tracking_by, vehicle_info, live_lat, live_lng, live_accuracy, live_speed, live_heading, live_updated_at`;

/** The user who should share the live location for this trade (null before delivery starts). */
function trackerId(trade) {
  if (!trade.delivery_method) return null;
  return trade.delivery_method === "buyer_pickup" ? trade.buyer_id : trade.farmer_id;
}

async function loadTrade(id, user) {
  const [[trade]] = await db.query(`SELECT ${MAP_COLUMNS} FROM trade_records WHERE id = ?`, [id]);
  if (!trade || (trade.buyer_id !== user.id && trade.farmer_id !== user.id)) {
    throw ApiError.notFound("লেনদেনটি পাওয়া যায়নি।", "Trade not found.");
  }
  return trade;
}

/** The map fields sent to the page (and pushed live). */
function mapData(trade) {
  return {
    trade_id: trade.id,
    status: trade.status,
    delivery_method: trade.delivery_method,
    tracker_id: trackerId(trade),
    pickup_lat: trade.pickup_lat,
    pickup_lng: trade.pickup_lng,
    drop_lat: trade.drop_lat,
    drop_lng: trade.drop_lng,
    tracking_active: Boolean(trade.tracking_active),
    tracking_by: trade.tracking_by,
    vehicle_info: trade.vehicle_info,
    live_lat: trade.live_lat,
    live_lng: trade.live_lng,
    live_accuracy: trade.live_accuracy,
    live_speed: trade.live_speed,
    live_heading: trade.live_heading,
    live_updated_at: trade.live_updated_at
  };
}

async function publishMap(tradeId) {
  const [[trade]] = await db.query(`SELECT ${MAP_COLUMNS} FROM trade_records WHERE id = ?`, [tradeId]);
  if (!trade) return null;
  const data = mapData(trade);
  live.publish(trade.buyer_id, "trade_map", data);
  live.publish(trade.farmer_id, "trade_map", data);
  return data;
}

const CLOSED = ["completed", "cancelled"];

/** Farmer sets the pickup point, buyer sets the drop point. */
async function place(req, res) {
  const trade = await loadTrade(req.params.id, req.user);
  if (CLOSED.includes(trade.status)) {
    throw ApiError.badRequest("শেষ হয়ে যাওয়া লেনদেনের অবস্থান বদলানো যাবে না।", "A finished trade's locations cannot be changed.");
  }
  const isFarmer = trade.farmer_id === req.user.id;
  const column = isFarmer ? "pickup" : "drop";
  await db.query(`UPDATE trade_records SET ${column}_lat = ?, ${column}_lng = ? WHERE id = ?`, [req.body.lat, req.body.lng, trade.id]);

  const data = await publishMap(trade.id);
  send(req, res, {
    message: isFarmer
      ? ["ফসল নেওয়ার জায়গা সংরক্ষণ হয়েছে।", "Pickup location saved."]
      : ["ডেলিভারির জায়গা সংরক্ষণ হয়েছে।", "Delivery location saved."],
    data
  });
}

/** One live position from the phone of the person bringing the vehicle. */
async function track(req, res) {
  const trade = await loadTrade(req.params.id, req.user);
  if (trade.status !== "delivery_pending") {
    throw ApiError.badRequest("ডেলিভারি চলার সময়ই শুধু লাইভ লোকেশন শেয়ার করা যায়।", "Live location can only be shared while the delivery is on the way.");
  }
  if (trackerId(trade) !== req.user.id) {
    throw ApiError.forbidden("যিনি গাড়ি নিয়ে যাচ্ছেন, শুধু তিনিই লাইভ লোকেশন শেয়ার করবেন।", "Only the person bringing the vehicle shares the live location.");
  }

  const now = Date.now();
  const starting = !trade.tracking_active;
  if (!starting && now - (lastUpdate.get(trade.id) || 0) < MIN_UPDATE_MS) {
    return send(req, res, { data: { skipped: true } });
  }
  lastUpdate.set(trade.id, now);

  const b = req.body;
  await db.query(
    `UPDATE trade_records
     SET tracking_active = 1, tracking_by = ?, live_lat = ?, live_lng = ?, live_accuracy = ?, live_speed = ?, live_heading = ?,
         live_updated_at = NOW(), vehicle_info = COALESCE(?, vehicle_info)
     WHERE id = ?`,
    [req.user.id, b.lat, b.lng, b.accuracy == null ? null : Math.round(b.accuracy), b.speed, b.heading == null ? null : Math.round(b.heading), b.vehicle_info, trade.id]
  );

  if (starting) {
    const otherId = req.user.id === trade.buyer_id ? trade.farmer_id : trade.buyer_id;
    const comingToFarm = trade.delivery_method === "buyer_pickup";
    await notify(null, otherId, {
      type: "trade_update",
      title: comingToFarm
        ? [`${req.user.name} ফসল নিতে রওনা হয়েছেন`, `${req.user.name} is on the way to pick up the crop`]
        : [`${req.user.name} ফসল নিয়ে রওনা হয়েছেন`, `${req.user.name} is on the way with your crop`],
      body: ["ম্যাপে গাড়ির লাইভ অবস্থান দেখুন।", "See the vehicle's live location on the map."],
      link: `/trades/${trade.id}`,
      entityType: "trade",
      entityId: trade.id
    });
  }

  send(req, res, { data: await publishMap(trade.id) });
}

async function stopTracking(req, res) {
  const trade = await loadTrade(req.params.id, req.user);
  if (trackerId(trade) !== req.user.id) throw ApiError.forbidden();
  await db.query("UPDATE trade_records SET tracking_active = 0 WHERE id = ?", [trade.id]);
  lastUpdate.delete(trade.id);
  send(req, res, { message: ["লাইভ লোকেশন শেয়ার বন্ধ হয়েছে।", "Live location sharing stopped."], data: await publishMap(trade.id) });
}

module.exports = { schemas, place, track, stopTracking, publishMap, trackerId };
