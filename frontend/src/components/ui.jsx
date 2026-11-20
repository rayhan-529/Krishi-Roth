/**
 * Small reusable building blocks used by every page.
 */
import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useLang } from '../context/LanguageContext'
import { mediaUrl } from '../services/api'
import { label, statusTone } from '../utils/labels'
import { num } from '../utils/format'
import Icon, { Glyph } from './Icon'

export function Spinner({ small }) {
  return <span className={`spinner ${small ? 'spinner-sm' : ''}`} aria-hidden="true" />
}

/** Loading state. After a few seconds explains that a sleeping free server is waking up. */
export function Loader({ text, inline }) {
  const { tr } = useLang()
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 6000)
    return () => clearTimeout(timer)
  }, [])
  return (
    <div className={inline ? 'loader-inline' : 'loader'} role="status">
      <Spinner />
      <span>{text || tr('লোড হচ্ছে...', 'Loading...')}</span>
      {slow && !inline && (
        <small>{tr('সার্ভার চালু হচ্ছে, এক মিনিট পর্যন্ত লাগতে পারে।', 'The server is waking up; this can take up to a minute.')}</small>
      )}
    </div>
  )
}

export function ErrorBox({ error, onRetry }) {
  const { tr } = useLang()
  if (!error) return null
  return (
    <div className="alert alert-error" role="alert">
      <Icon name="info" />
      <div>
        <p>{error.message || String(error)}</p>
        {onRetry && (
          <button type="button" className="btn btn-sm btn-outline" onClick={onRetry}>
            <Icon name="refresh" size={16} /> {tr('আবার চেষ্টা করুন', 'Try again')}
          </button>
        )}
      </div>
    </div>
  )
}

export function Alert({ tone = 'info', children }) {
  return (
    <div className={`alert alert-${tone}`}>
      <Icon name={tone === 'success' ? 'check' : 'info'} />
      <div>{children}</div>
    </div>
  )
}

export function EmptyState({ icon = 'wheat', title, text, action }) {
  return (
    <div className="empty">
      <span className="empty-icon" aria-hidden="true"><Glyph value={icon} size={26} /></span>
      <strong>{title}</strong>
      {text && <p>{text}</p>}
      {action}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions, back, banner }) {
  return (
    <div className={`page-header ${banner ? 'banner' : ''}`}>
      <div>
        {back && (
          <Link to={back} className="back-link">
            <Icon name="chevronLeft" size={16} />
          </Link>
        )}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  )
}

export function Card({ title, actions, children, className = '', padded = true }) {
  return (
    <section className={`card ${padded ? '' : 'card-flush'} ${className}`}>
      {(title || actions) && (
        <div className="card-head">
          {title && <h2>{title}</h2>}
          {actions && <div className="card-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

export function StatCard({ icon, label: text, value, tone = 'green', to, hint }) {
  const body = (
    <>
      <span className={`stat-icon tone-${tone}`} aria-hidden="true"><Glyph value={icon} size={20} /></span>
      <span className="stat-body">
        <small>{text}</small>
        <strong>{value}</strong>
        {hint && <em>{hint}</em>}
      </span>
    </>
  )
  return to ? <Link to={to} className={`stat-card stat-${tone}`}>{body}</Link> : <div className={`stat-card stat-${tone}`}>{body}</div>
}

export function Badge({ tone = 'grey', children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function StatusBadge({ group, value }) {
  const { lang } = useLang()
  return <Badge tone={statusTone(value)}>{label(group, value, lang)}</Badge>
}

export function VerifiedBadge({ status }) {
  const { tr } = useLang()
  if (status !== 'verified') return null
  return (
    <span className="verified" title={tr('যাচাইকৃত অ্যাকাউন্ট', 'Verified account')}>
      <Icon name="shield" size={14} /> {tr('যাচাইকৃত', 'Verified')}
    </span>
  )
}

export function Stars({ value, count, size = 16 }) {
  const { lang, tr } = useLang()
  const rating = Number(value) || 0
  return (
    <span className="stars" title={rating ? `${num(rating, lang, 1)} / 5` : tr('এখনো রেটিং নেই', 'No ratings yet')}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon key={n} name="star" size={size} className={n <= Math.round(rating) ? 'star-on' : 'star-off'} />
      ))}
      {count !== undefined && (
        <small>{rating ? `${num(rating, lang, 1)} (${num(count, lang)})` : tr('নতুন', 'New')}</small>
      )}
    </span>
  )
}

export function StarInput({ value, onChange }) {
  const { tr } = useLang()
  return (
    <div className="star-input" role="radiogroup" aria-label={tr('রেটিং', 'Rating')}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          type="button"
          key={n}
          role="radio"
          aria-checked={value === n}
          aria-label={`${n}`}
          className={n <= value ? 'star-on' : 'star-off'}
          onClick={() => onChange(n)}
        >
          <Icon name="star" size={30} />
        </button>
      ))}
    </div>
  )
}

export function Avatar({ src, name, size = 40 }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase()
  return src ? (
    <img className="avatar" src={mediaUrl(src)} alt="" width={size} height={size} style={{ width: size, height: size }} />
  ) : (
    <span className="avatar avatar-text" style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden="true">
      {initial}
    </span>
  )
}

export function Pagination({ meta, onPage }) {
  const { lang, tr } = useLang()
  if (!meta || meta.totalPages <= 1) return null
  return (
    <nav className="pagination" aria-label={tr('পাতা', 'Pages')}>
      <button type="button" className="btn btn-sm btn-outline" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>
        <Icon name="chevronLeft" size={16} /> {tr('আগের', 'Previous')}
      </button>
      <span>
        {tr('পাতা', 'Page')} {num(meta.page, lang)} / {num(meta.totalPages, lang)}
      </span>
      <button
        type="button"
        className="btn btn-sm btn-outline"
        disabled={meta.page >= meta.totalPages}
        onClick={() => onPage(meta.page + 1)}
      >
        {tr('পরের', 'Next')} <Icon name="chevronRight" size={16} />
      </button>
    </nav>
  )
}

export function Modal({ open, title, onClose, children, footer, wide }) {
  const titleId = useId()
  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => event.key === 'Escape' && onClose && onClose()
    document.addEventListener('keydown', onKey)
    document.body.classList.add('modal-open')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('modal-open')
    }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          {onClose && (
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <Icon name="close" />
            </button>
          )}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    // Rendered at the end of <body> so no card, banner or sidebar can ever cover it.
    document.body,
  )
}

/**
 * A button that asks for confirmation before running a destructive action.
 * With `reasonLabel`, the person must also type a reason (passed to onConfirm).
 */
export function ConfirmButton({ children, title, message, onConfirm, className = 'btn btn-outline', reasonLabel, confirmText, danger = true, disabled }) {
  const { tr } = useLang()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState(null)

  async function confirm() {
    if (reasonLabel && reason.trim().length < 3) {
      setError(tr('কারণ লিখুন (কমপক্ষে ৩ অক্ষর)।', 'Write a reason (at least 3 characters).'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onConfirm(reason.trim())
      setOpen(false)
      setReason('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} disabled={disabled}>
        {children}
      </button>
      <Modal
        open={open}
        title={title || tr('নিশ্চিত করুন', 'Please confirm')}
        onClose={() => !busy && setOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={busy}>
              {tr('না, ফিরে যান', 'No, go back')}
            </button>
            <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={confirm} disabled={busy}>
              {busy ? <Spinner small /> : null} {confirmText || tr('হ্যাঁ, নিশ্চিত', 'Yes, confirm')}
            </button>
          </>
        }
      >
        <p>{message}</p>
        {reasonLabel && <TextArea label={reasonLabel} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} required />}
        {error && <p className="field-error">{error}</p>}
      </Modal>
    </>
  )
}

export function Field({ label: text, error, hint, required, children, id }) {
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      {text && (
        <label htmlFor={id}>
          {text} {required && <span className="req" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <small className="hint">{hint}</small>}
      {error && <small className="field-error">{error}</small>}
    </div>
  )
}

export function Input({ label: text, error, hint, required, className = '', ...rest }) {
  const id = useId()
  return (
    <Field label={text} error={error} hint={hint} required={required} id={id}>
      <input id={id} className={`input ${className}`} required={required} aria-invalid={Boolean(error)} {...rest} />
    </Field>
  )
}

export function Select({ label: text, error, hint, required, options = [], placeholder, ...rest }) {
  const id = useId()
  return (
    <Field label={text} error={error} hint={hint} required={required} id={id}>
      <select id={id} className="input" required={required} aria-invalid={Boolean(error)} {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  )
}

export function TextArea({ label: text, error, hint, required, ...rest }) {
  const id = useId()
  return (
    <Field label={text} error={error} hint={hint} required={required} id={id}>
      <textarea id={id} className="input" required={required} aria-invalid={Boolean(error)} rows={4} {...rest} />
    </Field>
  )
}

export function Checkbox({ label: text, ...rest }) {
  return (
    <label className="checkbox">
      <input type="checkbox" {...rest} />
      <span>{text}</span>
    </label>
  )
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          className={active === tab.key ? 'active' : ''}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
          {tab.count ? <span className="tab-count">{tab.count}</span> : null}
        </button>
      ))}
    </div>
  )
}

export function SubmitButton({ busy, children, className = 'btn btn-primary', ...rest }) {
  return (
    <button type="submit" className={className} disabled={busy} {...rest}>
      {busy && <Spinner small />} {children}
    </button>
  )
}

/** Shows a "sample/admin data" note wherever market prices appear. */
export function PriceSourceNote() {
  const { tr } = useLang()
  return (
    <p className="source-note">
      <Icon name="info" size={14} />{' '}
      {tr(
        'দাম অ্যাডমিন প্রদত্ত; বিক্রির আগে স্থানীয় বাজারে মিলিয়ে নিন।',
        'Admin-entered prices; confirm at your local market before selling.',
      )}
    </p>
  )
}
