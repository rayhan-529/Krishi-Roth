/**
 * Simple farming advice from the forecast (rule based, no AI needed).
 * Returns at most MAX_TIPS tips, most important first.
 *   adviceFor(forecast) -> [{ kind, tone: "warn"|"good"|"info", bn, en }]
 */
const MAX_TIPS = 3;

function adviceFor(forecast) {
  const days = forecast.daily || [];
  const [today, tomorrow] = days;
  if (!today) return [];
  const next2 = days.slice(0, 2);
  const next3 = days.slice(0, 3);
  const tips = [];

  const rainSoon = next2.some((d) => (d.rain_chance ?? 0) >= 70 || (d.rain_mm ?? 0) >= 5);
  const dryAhead = next3.every((d) => (d.rain_chance ?? 0) < 30 && (d.rain_mm ?? 0) < 1);
  const windy = next2.some((d) => (d.wind_max ?? 0) >= 30);
  const humid = (forecast.current && forecast.current.humidity >= 85) && today.max >= 20 && today.max <= 32;

  if (rainSoon) {
    tips.push({
      kind: "no_spray_rain",
      tone: "warn",
      bn: "আগামী 2 দিনে বৃষ্টির সম্ভাবনা বেশি। এখন সার বা কীটনাশক দেবেন না, বৃষ্টিতে ধুয়ে যাবে।",
      en: "Rain is likely in the next 2 days. Do not apply fertilizer or pesticide now; rain will wash it off."
    });
  }
  if (windy) {
    tips.push({
      kind: "no_spray_wind",
      tone: "warn",
      bn: "বাতাস বেশি থাকবে। স্প্রে করবেন না, ওষুধ উড়ে অন্য দিকে চলে যাবে।",
      en: "It will be windy. Avoid spraying; the chemical will drift away."
    });
  }
  if (humid) {
    tips.push({
      kind: "fungus",
      tone: "warn",
      bn: "বাতাসে আর্দ্রতা অনেক বেশি। ধানের ব্লাস্ট ও ছত্রাক রোগের ঝুঁকি আছে, পাতায় দাগ আছে কিনা দেখুন।",
      en: "Humidity is very high. Risk of blast and fungal disease; check leaves for spots."
    });
  }
  if (dryAhead && today.max >= 32) {
    tips.push({
      kind: "irrigate",
      tone: "info",
      bn: "কয়েক দিন বৃষ্টি নেই, গরমও বেশি। সকাল বা বিকেলে সেচ দিন।",
      en: "No rain for a few days and it is hot. Irrigate in the morning or evening."
    });
  }
  if (dryAhead) {
    tips.push({
      kind: "harvest_dry",
      tone: "good",
      bn: "আগামী 3 দিন শুকনো থাকবে। পাকা ফসল কাটা ও শুকানোর ভালো সময়।",
      en: "The next 3 days look dry. A good time to harvest and dry ripe crops."
    });
  }
  if (today.min <= 12 || (tomorrow && tomorrow.min <= 12)) {
    tips.push({
      kind: "cold",
      tone: "warn",
      bn: "রাতে বেশ ঠান্ডা পড়বে। বীজতলা পলিথিনে ঢেকে রাখুন, সকালে শিশির ঝেড়ে দিন।",
      en: "Cold nights ahead. Cover seedbeds with polythene and shake off morning dew."
    });
  }
  if (!tips.length) {
    tips.push({
      kind: "normal",
      tone: "good",
      bn: "আবহাওয়া স্বাভাবিক। জমির নিয়মিত কাজ চালিয়ে যান।",
      en: "Normal weather. Carry on with regular field work."
    });
  }
  return tips.slice(0, MAX_TIPS);
}

module.exports = { adviceFor };
