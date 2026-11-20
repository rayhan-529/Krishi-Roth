/**
 * Payment method logos (official marks in /public/payments) and the
 * "coming soon" list for methods that are not live yet.
 *
 *   <PayLogo method="bkash" />     one logo tile
 *   <PayLogos />                   every method, for the footer
 *   <CardSoon />                   upcoming methods, for top-up / payment boxes
 */
import { useLang } from '../context/LanguageContext'

/** live: usable today. Everything else shows as "coming soon". */
export const PAY_METHODS = [
  { key: 'bkash', name: 'bKash', file: 'bkash.svg', live: true },
  { key: 'nagad', name: 'Nagad', file: 'nagad.png', live: true },
  { key: 'rocket', name: 'Rocket', file: 'rocket.png', live: true },
  { key: 'upay', name: 'Upay', file: 'upay.png', live: false },
  { key: 'visa', name: 'Visa', file: 'visa.svg', live: false },
  { key: 'mastercard', name: 'Mastercard', file: 'mastercard.svg', live: false },
  { key: 'amex', name: 'American Express', file: 'amex.svg', live: false },
]

const BY_KEY = Object.fromEntries(PAY_METHODS.map((m) => [m.key, m]))

export function PayLogo({ method, name }) {
  const m = BY_KEY[method]
  if (!m) return null
  return (
    <span className={`pay-logo pay-logo-${method}`} title={name || m.name}>
      <img src={`/payments/${m.file}`} alt={name || m.name} loading="lazy" />
    </span>
  )
}

/** Every method as a row of logo tiles (footer). */
export function PayLogos() {
  return (
    <div className="pay-logos">
      {PAY_METHODS.map((m) => <PayLogo key={m.key} method={m.key} />)}
    </div>
  )
}

/** Methods that are not live yet, greyed out with a "coming soon" tag. */
export default function CardSoon() {
  const { tr } = useLang()
  return (
    <div className="pay-upcoming" aria-disabled="true">
      <span className="pay-upcoming-title">
        {tr('আরও পেমেন্ট মাধ্যম', 'More payment methods')}
        <span className="soon-tag">{tr('শীঘ্রই আসছে', 'Coming soon')}</span>
      </span>
      <div className="pay-logos">
        {PAY_METHODS.filter((m) => !m.live).map((m) => <PayLogo key={m.key} method={m.key} />)}
      </div>
    </div>
  )
}
