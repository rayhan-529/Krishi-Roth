import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLang } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useFetch } from '../../hooks/useFetch'
import { get, patch } from '../../services/api'
import { label, options } from '../../utils/labels'
import { date, money, pick } from '../../utils/format'
import { Card, ConfirmButton, EmptyState, ErrorBox, Loader, PageHeader, Pagination, Select, StatusBadge } from '../../components/ui'

export default function AdminBookings() {
  const { lang, tr } = useLang()
  const toast = useToast()
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')
  const [page, setPage] = useState(1)
  const { data, meta, loading, error, reload } = useFetch(() => get('/admin/bookings', { status, booking_type: type, page }), [status, type, page])

  return (
    <div className="page">
      <PageHeader title={tr('বুকিং ব্যবস্থাপনা', 'Booking management')} />
      <div className="filters filters-3">
        <Select label={tr('ধরন', 'Type')} value={type} onChange={(e) => (setType(e.target.value), setPage(1))} options={options('bookingType', lang)} placeholder={tr('সব', 'All')} />
        <Select label={tr('অবস্থা', 'Status')} value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))} options={options('bookingStatus', lang)} placeholder={tr('সব', 'All')} />
      </div>
      <Card padded={false}>
        {loading ? <Loader /> : error ? <div className="card-pad"><ErrorBox error={error} onRetry={reload} /></div> : data.length === 0 ? <EmptyState icon="📅" title={tr('কোনো বুকিং নেই', 'No bookings')} /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>#</th><th>{tr('ধরন', 'Type')}</th><th>{tr('অনুরোধকারী', 'Requester')}</th><th>{tr('সেবাদাতা', 'Provider')}</th><th>{tr('তারিখ', 'Dates')}</th><th>{tr('এলাকা', 'Area')}</th><th>{tr('আনুমানিক', 'Estimate')}</th><th>{tr('অবস্থা', 'Status')}</th><th /></tr></thead>
              <tbody>
                {data.map((b) => (
                  <tr key={b.id}>
                    <td><Link to={`/bookings/${b.id}`}>{b.id}</Link></td>
                    <td>{label('bookingType', b.booking_type, lang)}<br /><small className="muted">{b.machine_name || b.vehicle_name}</small></td>
                    <td>{b.requester_name}</td>
                    <td>{b.provider_name}</td>
                    <td className="nowrap">{date(b.start_date, lang)} – {date(b.end_date, lang)}</td>
                    <td>{pick(b, 'work_district', lang)}</td>
                    <td className="nowrap">{money(b.estimated_total, lang)}</td>
                    <td><StatusBadge group="bookingStatus" value={b.status} /></td>
                    <td>
                      {['pending', 'accepted', 'in_progress'].includes(b.status) && (
                        <ConfirmButton className="btn btn-sm btn-danger-outline" message={tr('বুকিংটি বাতিল করবেন? দুই পক্ষকেই জানানো হবে।', 'Cancel this booking? Both sides will be notified.')} reasonLabel={tr('কারণ', 'Reason')} onConfirm={async (note) => { const body = await patch(`/admin/bookings/${b.id}/cancel`, { note }); toast.success(body.message); reload() }}>{tr('বাতিল', 'Cancel')}</ConfirmButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Pagination meta={meta} onPage={setPage} />
    </div>
  )
}
