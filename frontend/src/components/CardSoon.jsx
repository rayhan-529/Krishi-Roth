/**
 * Payment method logos (simple drawn marks, no external images) and the
 * "coming soon" list for methods that are not live yet.
 *
 *   <PayLogo method="bkash" />     one logo tile
 *   <PayLogos />                   every method, for the footer
 *   <CardSoon />                   upcoming methods, for top-up / payment boxes
 */
import { useLang } from '../context/LanguageContext'

/** live: usable today. Everything else shows as "coming soon". */
export const PAY_METHODS = [
  { key: 'bkash', name: 'bKash', live: true },
  { key: 'nagad', name: 'Nagad', live: true },
  { key: 'rocket', name: 'Rocket', live: true },
  { key: 'upay', name: 'Upay', live: false },
  { key: 'visa', name: 'Visa', live: false },
  { key: 'mastercard', name: 'Mastercard', live: false },
  { key: 'amex', name: 'American Express', live: false },
]

const MARKS = {
  bkash: (
    <>
      <path d="M14 9l9 7-11 3z" fill="#e2136e" />
      <path d="M12 19l11-3-4 10z" fill="#c4105f" />
      <path d="M23 16l-4 10 7-6z" fill="#f05a9b" />
      <text x="32" y="36" textAnchor="middle" fontSize="9" fontWeight="700" fill="#e2136e" fontFamily="Arial, sans-serif">bKash</text>
    </>
  ),
  nagad: (
    <>
      <circle cx="32" cy="15" r="9" fill="none" stroke="#ec1c24" strokeWidth="2.5" />
      <circle cx="32" cy="15" r="4" fill="#f7941d" />
      <text x="32" y="36" textAnchor="middle" fontSize="10" fontWeight="700" fill="#ec1c24" fontFamily="'Hind Siliguri', sans-serif">নগদ</text>
    </>
  ),
  rocket: (
    <>
      <path d="M32 5c5 4 6 10 4 17h-8c-2-7-1-13 4-17z" fill="#8c3494" />
      <circle cx="32" cy="13" r="2.2" fill="#fff" />
      <path d="M28 22l-3 4h4zM36 22l3 4h-4z" fill="#f7941d" />
      <text x="32" y="37" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#8c3494" fontFamily="Arial, sans-serif">Rocket</text>
    </>
  ),
  upay: (
    <>
      <path d="M24 7v9a8 8 0 0 0 16 0V7" fill="none" stroke="#0054a6" strokeWidth="4" strokeLinecap="round" />
      <circle cx="40" cy="7" r="3" fill="#ffd400" />
      <text x="32" y="37" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#0054a6" fontFamily="'Hind Siliguri', sans-serif">উপায়</text>
    </>
  ),
  visa: <text x="32" y="27" textAnchor="middle" fontSize="17" fontWeight="900" fontStyle="italic" fill="#1a1f71" fontFamily="Arial, sans-serif" letterSpacing="0.5">VISA</text>,
  mastercard: (
    <>
      <circle cx="26" cy="17" r="10" fill="#eb001b" />
      <circle cx="38" cy="17" r="10" fill="#f79e1b" />
      <path d="M32 9a10 10 0 0 1 0 16 10 10 0 0 1 0-16z" fill="#ff5f00" />
      <text x="32" y="37" textAnchor="middle" fontSize="7" fontWeight="700" fill="#222" fontFamily="Arial, sans-serif">mastercard</text>
    </>
  ),
  amex: (
    <>
      <rect x="6" y="5" width="52" height="30" rx="3" fill="#2e77bc" />
      <text x="32" y="18" textAnchor="middle" fontSize="7.5" fontWeight="900" fill="#fff" fontFamily="Arial, sans-serif">AMERICAN</text>
      <text x="32" y="28" textAnchor="middle" fontSize="7.5" fontWeight="900" fill="#fff" fontFamily="Arial, sans-serif">EXPRESS</text>
    </>
  ),
}

export function PayLogo({ method, name }) {
  return (
    <span className="pay-logo" title={name} role="img" aria-label={name}>
      <svg viewBox="0 0 64 40" aria-hidden="true">{MARKS[method]}</svg>
    </span>
  )
}

/** Every method as a row of logo tiles (footer). */
export function PayLogos() {
  return (
    <div className="pay-logos">
      {PAY_METHODS.map((m) => <PayLogo key={m.key} method={m.key} name={m.name} />)}
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
        {PAY_METHODS.filter((m) => !m.live).map((m) => <PayLogo key={m.key} method={m.key} name={m.name} />)}
      </div>
    </div>
  )
}
