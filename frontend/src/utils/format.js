/**
 * Numbers, money and dates in the chosen language.
 * Bengali text, but always English digits 0-9 and Bangladeshi grouping (1,23,456).
 * All dates/times from the API are Bangladesh time (UTC+06:00).
 */
// Bengali text with English digits ("20 নভেম্বর 2026", "৳ 9,56,975"): Bengali digits are hard to
// read in small sizes, so numbers always use 0-9. Bangladeshi grouping is kept.
const LOCALE = { bn: 'bn-BD-u-nu-latn', en: 'en-IN' }

export function num(value, lang, maxFraction = 2) {
  if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) return '—'
  return new Intl.NumberFormat(LOCALE[lang] || LOCALE.bn, { maximumFractionDigits: maxFraction }).format(Number(value))
}

export function money(value, lang) {
  if (value === null || value === undefined || value === '') return '—'
  return `৳ ${num(value, lang, 2)}`
}

/** Parses "YYYY-MM-DD", "YYYY-MM-DD HH:MM:SS" (Bangladesh time) or an ISO string. */
export function parseDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  const text = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return new Date(`${text}T00:00:00+06:00`)
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(text)) return new Date(`${text.replace(' ', 'T')}+06:00`)
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

export function date(value, lang) {
  const d = parseDate(value)
  if (!d) return '—'
  return new Intl.DateTimeFormat(LOCALE[lang] || LOCALE.bn, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Dhaka' }).format(d)
}

export function dateTime(value, lang) {
  const d = parseDate(value)
  if (!d) return '—'
  return new Intl.DateTimeFormat(LOCALE[lang] || LOCALE.bn, {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Dhaka',
  }).format(d)
}

/** "5 minutes ago" style text. */
export function timeAgo(value, lang) {
  const d = parseDate(value)
  if (!d) return ''
  const seconds = Math.round((d.getTime() - Date.now()) / 1000)
  const rtf = new Intl.RelativeTimeFormat(LOCALE[lang] || LOCALE.bn, { numeric: 'auto' })
  const steps = [[60, 'second'], [60, 'minute'], [24, 'hour'], [30, 'day'], [12, 'month'], [Infinity, 'year']]
  let amount = seconds
  for (const [size, unit] of steps) {
    if (Math.abs(amount) < size) return rtf.format(Math.round(amount), unit)
    amount /= size
  }
  return ''
}

/** Today's date in Bangladesh as YYYY-MM-DD (for date inputs). */
export function todayBD(offsetDays = 0) {
  const now = new Date(Date.now() + 6 * 3600 * 1000 + offsetDays * 86400000)
  return now.toISOString().slice(0, 10)
}

/** Month label for charts: "2026-06" -> "জুন" / "Jun". */
export function monthLabel(month, lang) {
  const d = parseDate(`${month}-01`)
  return d ? new Intl.DateTimeFormat(LOCALE[lang] || LOCALE.bn, { month: 'short', timeZone: 'Asia/Dhaka' }).format(d) : month
}

/** Picks the Bengali or English column of a row: name(row, 'crop', lang) -> row.crop_bn / row.crop_en */
export function pick(row, prefix, lang) {
  if (!row) return ''
  return (lang === 'en' ? row[`${prefix}_en`] : row[`${prefix}_bn`]) || row[`${prefix}_bn`] || row[`${prefix}_en`] || ''
}
