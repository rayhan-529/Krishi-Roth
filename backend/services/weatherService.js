/**
 * Weather forecasts for Bangladesh districts from Open-Meteo (free, no API key).
 * https://open-meteo.com — data is cached for CACHE_MINUTES per district.
 */

/** Approximate centre (district headquarters) of each district, by districts.id. */
const DISTRICT_COORDS = {
  1: [22.15, 90.12], 2: [22.70, 90.37], 3: [22.69, 90.65], 4: [22.64, 90.20], 5: [22.36, 90.33], 6: [22.58, 89.97],
  7: [22.19, 92.22], 8: [23.96, 91.11], 9: [23.23, 90.67], 10: [22.36, 91.78], 11: [21.43, 92.01], 12: [23.46, 91.18],
  13: [23.02, 91.40], 14: [23.12, 91.98], 15: [22.94, 90.84], 16: [22.87, 91.10], 17: [22.65, 92.18], 18: [23.81, 90.41],
  19: [23.61, 89.84], 20: [24.00, 90.42], 21: [23.01, 89.83], 22: [24.43, 90.78], 23: [23.17, 90.20], 24: [23.86, 90.00],
  25: [23.55, 90.53], 26: [23.62, 90.50], 27: [23.92, 90.72], 28: [23.76, 89.64], 29: [23.21, 90.35], 30: [24.25, 89.92],
  31: [22.65, 89.79], 32: [23.64, 88.84], 33: [23.17, 89.21], 34: [23.54, 89.17], 35: [22.82, 89.55], 36: [23.90, 89.12],
  37: [23.49, 89.42], 38: [23.76, 88.63], 39: [23.17, 89.50], 40: [22.72, 89.07], 41: [24.92, 89.95], 42: [24.75, 90.41],
  43: [24.88, 90.73], 44: [25.02, 90.02], 45: [24.85, 89.37], 46: [24.60, 88.27], 47: [25.10, 89.02], 48: [24.81, 88.94],
  49: [24.42, 88.98], 50: [24.01, 89.24], 51: [24.37, 88.60], 52: [24.45, 89.70], 53: [25.63, 88.64], 54: [25.33, 89.53],
  55: [25.81, 89.64], 56: [25.92, 89.45], 57: [25.93, 88.86], 58: [26.33, 88.55], 59: [25.75, 89.25], 60: [26.03, 88.46],
  61: [24.37, 91.42], 62: [24.48, 91.77], 63: [25.07, 91.40], 64: [24.89, 91.87]
};

const CACHE_MINUTES = 30;
const cache = new Map(); // districtId -> { at, data }

/** WMO weather codes -> [icon key, bengali, english]. */
const WMO = [
  [[0], "sun", "পরিষ্কার আকাশ", "Clear sky"],
  [[1, 2], "partly", "আংশিক মেঘলা", "Partly cloudy"],
  [[3], "cloud", "মেঘলা", "Overcast"],
  [[45, 48], "fog", "কুয়াশা", "Fog"],
  [[51, 53, 55, 56, 57], "drizzle", "গুঁড়ি গুঁড়ি বৃষ্টি", "Drizzle"],
  [[61, 63, 66, 80, 81], "rain", "বৃষ্টি", "Rain"],
  [[65, 67, 82], "heavy-rain", "ভারী বৃষ্টি", "Heavy rain"],
  [[71, 73, 75, 77, 85, 86], "snow", "তুষারপাত", "Snow"],
  [[95, 96, 99], "storm", "বজ্রঝড়", "Thunderstorm"]
];

function describe(code) {
  const row = WMO.find(([codes]) => codes.includes(Number(code)));
  return row ? { icon: row[1], bn: row[2], en: row[3] } : { icon: "cloud", bn: "অজানা", en: "Unknown" };
}

function hasDistrict(districtId) {
  return Boolean(DISTRICT_COORDS[Number(districtId)]);
}

function buildUrl(coords) {
  const params = new URLSearchParams({
    latitude: coords.map((c) => c[0]).join(","),
    longitude: coords.map((c) => c[1]).join(","),
    current: "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max",
    timezone: "Asia/Dhaka",
    forecast_days: "7"
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

/** Turns one Open-Meteo location result into our shape. */
function shape(raw) {
  const d = raw.daily;
  return {
    current: {
      temperature: raw.current.temperature_2m,
      humidity: raw.current.relative_humidity_2m,
      wind: raw.current.wind_speed_10m,
      ...describe(raw.current.weather_code)
    },
    daily: d.time.map((date, i) => ({
      date,
      max: d.temperature_2m_max[i],
      min: d.temperature_2m_min[i],
      rain_mm: d.precipitation_sum[i],
      rain_chance: d.precipitation_probability_max[i],
      wind_max: d.wind_speed_10m_max[i],
      ...describe(d.weather_code[i])
    }))
  };
}

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`);
  return response.json();
}

/**
 * 7-day forecast and current weather for one district.
 * @returns {Promise<{ current, daily: Array }>}
 */
async function getForecast(districtId) {
  const id = Number(districtId);
  const coords = DISTRICT_COORDS[id];
  if (!coords) throw new Error("Unknown district");
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < CACHE_MINUTES * 60 * 1000) return hit.data;

  const data = shape(await fetchJson(buildUrl([coords])));
  cache.set(id, { at: Date.now(), data });
  return data;
}

/**
 * Forecasts for many districts in ONE request (used by the alert job).
 * @returns {Promise<Map<number, { current, daily }>>}
 */
async function getForecasts(districtIds) {
  const ids = [...new Set(districtIds.map(Number))].filter(hasDistrict);
  const result = new Map();
  if (!ids.length) return result;
  const json = await fetchJson(buildUrl(ids.map((id) => DISTRICT_COORDS[id])));
  const list = Array.isArray(json) ? json : [json];
  ids.forEach((id, i) => {
    const data = shape(list[i]);
    cache.set(id, { at: Date.now(), data });
    result.set(id, data);
  });
  return result;
}

module.exports = { getForecast, getForecasts, hasDistrict, describe, DISTRICT_COORDS };
