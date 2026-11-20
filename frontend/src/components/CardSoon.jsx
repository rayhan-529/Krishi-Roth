/**
 * Visa / Mastercard / Amex shown as "coming soon" next to bKash, Nagad and Rocket.
 * Purely informational: card payments are not live yet, so nothing here is clickable.
 */
import { useLang } from '../context/LanguageContext'
import Icon from './Icon'

export const CARD_BRANDS = [
  ['visa', 'VISA'],
  ['mastercard', 'Mastercard'],
  ['amex', 'AMEX'],
]

export function CardMarks() {
  return (
    <span className="card-marks">
      {CARD_BRANDS.map(([key, name]) => (
        <span key={key} className={`card-mark card-${key}`}>{name}</span>
      ))}
    </span>
  )
}

/** A disabled, full-width option row for payment pickers. */
export default function CardSoon() {
  const { tr } = useLang()
  return (
    <div className="card-soon" aria-disabled="true">
      <Icon name="wallet" size={18} />
      <span className="card-soon-text">
        <strong>{tr('কার্ডে পেমেন্ট', 'Pay by card')}</strong>
        <CardMarks />
      </span>
      <span className="soon-tag">{tr('শীঘ্রই আসছে', 'Coming soon')}</span>
    </div>
  )
}
