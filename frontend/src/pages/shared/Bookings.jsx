/** Booking history: requests I sent and requests I received. */
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import { useFetch } from '../../hooks/useFetch'
import { get } from '../../services/api'
import { label, options } from '../../utils/labels'
import { date, money, num, pick } from '../../utils/format'
import { PROVIDER_ROLES } from '../../utils/nav'
import { EmptyState, ErrorBox, Loader, PageHeader, Pagination, Select, StatusBadge, Tabs } from '../../components/ui'
import { Glyph } from '../../components/Icon'

export default function Bookings() {
  const { user } = useAuth()
  const { lang, tr } = useLang()
  const isProvider = PROVIDER_ROLES.includes(user.role)
  const [params, setParams] = useSearchParams()
  const [page, setPage] = useState(1)
  const as = params.get('as') || (isProvider ? 'provider' : 'requester')
  const status = params.get('status') || ''
  const type = params.get('type') || ''
  const { data, meta, loading, error, reload } = useFetch(() => get('/bookings', { as, status, booking_type: type, page }), [as, status, type, page])

  function update(changes) {
    const next = { as, status, type, ...changes }
    setParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v)))
    setPage(1)
  }

  return (
    <div className="page">
      <PageHeader title={isProvider ? tr('বুকিং অনুরোধ', 'Booking requests') : tr('আমার বুকিং', 'My bookings')} />
      <Tabs active={status} onChange={(s) => update({ status: s })} tabs={[{ key: '', label: tr('সব', 'All') }, ...options('bookingStatus', lang).map((o) => ({ key: o.value, label: o.label }))]} />
      {!isProvider && (
        <div className="filters filters-3">
          <Select label={tr('সেবার ধরন', 'Service type')} value={type} onChange={(e) => update({ type: e.target.value })} options={options('bookingType', lang)} placeholder={tr('সব', 'All')} />
        </div>
      )}
      {loading ? <Loader /> : error ? <ErrorBox error={error} onRetry={reload} /> : data.length === 0 ? (
        <EmptyState icon="📅" title={tr('কোনো বুকিং নেই', 'No bookings')} action={!isProvider && <Link to="/services/labour" className="btn btn-primary">{tr('সেবা খুঁজুন', 'Find services')}</Link>} />
      ) : (
        <div className="manage-list">
          {data.map((b) => {
            const mine = b.requester_id === user.id
            return (
              <Link key={b.id} to={`/bookings/${b.id}`} className="manage-item link-item">
                <div className="manage-thumb"><Glyph value={{ labour: '👨‍🌾', harvester: '🌾', tractor: '🚜', transport: '🚚' }[b.booking_type]} size={26} /></div>
                <div className="manage-body">
                  <h3>
                    {label('bookingType', b.booking_type, lang)}{b.machine_name ? `: ${b.machine_name}` : ''}{b.vehicle_name ? `: ${b.vehicle_name}` : ''}{' '}
                    <StatusBadge group="bookingStatus" value={b.status} />
                  </h3>
                  <p className="small">{date(b.start_date, lang)} – {date(b.end_date, lang)} ({tr(`${num(b.days, lang)} দিন`, `${num(b.days, lang)} days`)}) · {pick(b, 'work_district', lang)}</p>
                  <p className="muted small">
                    {mine ? `${tr('সেবাদাতা', 'Provider')}: ${b.provider_name}` : `${tr('অনুরোধকারী', 'Requested by')}: ${b.requester_name}`}
                    {b.estimated_total ? ` · ${tr('আনুমানিক', 'Est.')} ${money(b.estimated_total, lang)}` : ''}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
      <Pagination meta={meta} onPage={setPage} />
    </div>
  )
}
