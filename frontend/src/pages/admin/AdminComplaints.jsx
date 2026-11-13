import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLang } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useFetch } from '../../hooks/useFetch'
import { get, patch } from '../../services/api'
import { label, options } from '../../utils/labels'
import { dateTime } from '../../utils/format'
import { Card, EmptyState, ErrorBox, Loader, Modal, PageHeader, Pagination, Select, StatusBadge, SubmitButton, Tabs, TextArea } from '../../components/ui'

function HandleComplaint({ complaint, onClose, onSaved }) {
  const { lang, tr } = useLang()
  const toast = useToast()
  const [status, setStatus] = useState(complaint.status === 'open' ? 'in_review' : complaint.status)
  const [note, setNote] = useState(complaint.admin_note || '')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const body = await patch(`/admin/complaints/${complaint.id}`, { status, admin_note: note })
      toast.success(body.message)
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open wide title={complaint.subject} onClose={onClose}>
      <p className="muted small">{complaint.complainant_name} ({label('role', complaint.complainant_role, lang)}) · {label('complaintCategory', complaint.category, lang)} · {dateTime(complaint.created_at, lang)}</p>
      {complaint.against_name && <p>{tr('যার বিরুদ্ধে', 'Against')}: <strong>{complaint.against_name}</strong></p>}
      <p className="pre-line quote">{complaint.description}</p>
      <p className="small">
        {complaint.trade_id && <Link to={`/trades/${complaint.trade_id}`}>{tr('লেনদেন', 'Trade')} #{complaint.trade_id}</Link>}{' '}
        {complaint.booking_id && <Link to={`/bookings/${complaint.booking_id}`}>{tr('বুকিং', 'Booking')} #{complaint.booking_id}</Link>}
      </p>
      <form onSubmit={submit} className="form">
        <Select label={tr('অবস্থা', 'Status')} value={status} onChange={(e) => setStatus(e.target.value)} options={options('complaintStatus', lang)} />
        <TextArea label={tr('উত্তর / নোট (অভিযোগকারী দেখবেন)', 'Reply / note (visible to the complainant)')} value={note} onChange={(e) => setNote(e.target.value)} rows={4} maxLength={3000} />
        <div className="form-actions"><button type="button" className="btn btn-ghost" onClick={onClose}>{tr('বাতিল', 'Cancel')}</button><SubmitButton busy={busy}>{tr('সংরক্ষণ', 'Save')}</SubmitButton></div>
      </form>
    </Modal>
  )
}

export default function AdminComplaints() {
  const { lang, tr } = useLang()
  const [status, setStatus] = useState('open')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(null)
  const { data, meta, loading, error, reload } = useFetch(() => get('/admin/complaints', { status, page }), [status, page])

  return (
    <div className="page">
      <PageHeader title={tr('অভিযোগ ব্যবস্থাপনা', 'Complaint management')} />
      <Tabs active={status} onChange={(s) => (setStatus(s), setPage(1))} tabs={[...options('complaintStatus', lang).map((o) => ({ key: o.value, label: o.label })), { key: '', label: tr('সব', 'All') }]} />
      <Card padded={false}>
        {loading ? <Loader /> : error ? <div className="card-pad"><ErrorBox error={error} onRetry={reload} /></div> : data.length === 0 ? <EmptyState icon="📨" title={tr('কোনো অভিযোগ নেই', 'No complaints')} /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>#</th><th>{tr('বিষয়', 'Subject')}</th><th>{tr('ধরন', 'Type')}</th><th>{tr('অভিযোগকারী', 'From')}</th><th>{tr('যার বিরুদ্ধে', 'Against')}</th><th>{tr('তারিখ', 'Date')}</th><th>{tr('অবস্থা', 'Status')}</th><th /></tr></thead>
              <tbody>
                {data.map((c) => (
                  <tr key={c.id}>
                    <td>{c.id}</td>
                    <td><strong>{c.subject}</strong></td>
                    <td>{label('complaintCategory', c.category, lang)}</td>
                    <td>{c.complainant_name}</td>
                    <td>{c.against_name || '—'}</td>
                    <td className="nowrap">{dateTime(c.created_at, lang)}</td>
                    <td><StatusBadge group="complaintStatus" value={c.status} /></td>
                    <td><button type="button" className="btn btn-sm btn-outline" onClick={() => setOpen(c)}>{tr('দেখুন', 'Open')}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Pagination meta={meta} onPage={setPage} />
      {open && <HandleComplaint complaint={open} onClose={() => setOpen(null)} onSaved={reload} />}
    </div>
  )
}
