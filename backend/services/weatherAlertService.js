/**
 * Weather alerts for farmers.
 *
 * Checks tomorrow's forecast for every district that has farmers. Heavy rain,
 * a storm or extreme heat sends one notification to those farmers. The
 * weather_alerts table makes sure each district gets each alert only once a day.
 * Runs from the background scheduler (services/reminderService.js).
 */
const db = require("../config/db");
const weather = require("./weatherService");
const { notifyMany } = require("./notificationService");

const HEAVY_RAIN_MM = 20;
const STORM_WIND_KMH = 50;
const HEAT_C = 38;

/** What is worrying about one day's forecast, most serious first. */
function alertsFor(day) {
  const alerts = [];
  if (day.icon === "storm" || day.wind_max >= STORM_WIND_KMH) {
    alerts.push({
      kind: "storm",
      title: ["আগামীকাল ঝড়ের সম্ভাবনা", "Storm expected tomorrow"],
      body: [
        `বাতাস ${Math.round(day.wind_max)} কিমি/ঘণ্টা পর্যন্ত হতে পারে। পাকা ফসল আগে কেটে নিন, মাচা ও ঘর শক্ত করে বাঁধুন।`,
        `Wind up to ${Math.round(day.wind_max)} km/h. Harvest ripe crops early and secure sheds and trellises.`
      ]
    });
  }
  if (day.icon === "heavy-rain" || day.rain_mm >= HEAVY_RAIN_MM) {
    alerts.push({
      kind: "heavy_rain",
      title: ["আগামীকাল ভারী বৃষ্টি", "Heavy rain tomorrow"],
      body: [
        `প্রায় ${Math.round(day.rain_mm)} মিমি বৃষ্টি হতে পারে। সার ও কীটনাশক দেবেন না, জমির নালা পরিষ্কার রাখুন, কাটা ফসল ঢেকে রাখুন।`,
        `About ${Math.round(day.rain_mm)} mm of rain. Do not spray or spread fertilizer, clear field drains and cover harvested crops.`
      ]
    });
  }
  if (day.max >= HEAT_C) {
    alerts.push({
      kind: "heat",
      title: ["আগামীকাল তীব্র গরম", "Extreme heat tomorrow"],
      body: [
        `তাপমাত্রা ${Math.round(day.max)}°C পর্যন্ত উঠতে পারে। সকাল বা বিকেলে সেচ দিন, দুপুরে মাঠে কাজ কম করুন।`,
        `Up to ${Math.round(day.max)}°C. Irrigate in the morning or evening and avoid field work at midday.`
      ]
    });
  }
  return alerts;
}

/**
 * @returns {Promise<number>} how many district alerts were sent
 */
async function sendWeatherAlerts() {
  const [districts] = await db.query(
    "SELECT DISTINCT district_id FROM users WHERE role = 'farmer' AND is_blocked = 0 AND district_id IS NOT NULL"
  );
  if (!districts.length) return 0;

  const forecasts = await weather.getForecasts(districts.map((d) => d.district_id));
  let sent = 0;
  for (const [districtId, forecast] of forecasts) {
    const tomorrow = forecast.daily[1];
    if (!tomorrow) continue;
    for (const alert of alertsFor(tomorrow)) {
      // Claim the alert first, so two parallel checks cannot send it twice.
      const [claim] = await db.query(
        "INSERT IGNORE INTO weather_alerts (district_id, alert_date, kind) VALUES (?, ?, ?)",
        [districtId, tomorrow.date, alert.kind]
      );
      if (claim.affectedRows === 0) continue;
      const [farmers] = await db.query(
        "SELECT id FROM users WHERE role = 'farmer' AND is_blocked = 0 AND district_id = ?",
        [districtId]
      );
      await notifyMany(null, farmers.map((f) => f.id), {
        type: "weather_alert",
        title: alert.title,
        body: alert.body,
        link: "/weather"
      });
      sent += 1;
    }
  }
  return sent;
}

module.exports = { sendWeatherAlerts, alertsFor };
