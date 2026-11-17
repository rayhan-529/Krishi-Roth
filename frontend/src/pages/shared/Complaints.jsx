import { useState } from 'react'
import { useLang } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useFetch, useForm } from '../../hooks/useFetch'
import { get, post } from '../../services/api'
import { options } from '../../utils/labels'
import { dateTime } from '../../utils/format'
import { Card, EmptyState, ErrorBox, Input, Loader, PageHeader, Select, StatusBadge, SubmitButton, TextArea } from '../../components/ui'

export default function Complaints() {
  const { lang, tr } = useLang()
  const toast = useToast()
  const { data, loading, error, reload } = useFetch(() => get('/complaints/mine'), [])
  const [busy, setBusy] = useState(false)
  const { values, setValues, bind, setErrors } = useForm({ category: 'other', subject: '', description: '', trade_id: '', booking_id: '' })

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const body = await post('/complaints', values)
      toast.success(body.message)
      setValues({ category: 'other', subject: '', description: '', trade_id: '', booking_id: '' })
      reload()
    } catch (err) {
      setErrors(err.errors)
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <PageHeader title={tr('অভিযোগ ও সহায়তা', 'Complaints & help')} />
      <div className="two-col even">
        <Card title={tr('নতুন অভিযোগ', 'New complaint')}>
          <form onSubmit={submit} className="form" noValidate>
            <Select label={tr('বিষয়ের ধরন', 'Type')} options={options('complaintCategory', lang)} {...bind('category')} />
            <Input label={tr('শিরোনাম', 'Subject')} required maxLength={200} {...bind('subject')} />
            <TextArea label={tr('বিস্তারিত লিখুন', 'Describe the problem')} required rows={5} maxLength={5000} hint={tr('কমপক্ষে ১০ অক্ষর', 'At least 10 characters')} {...bind('description')} />
            <div className="grid-2">
              <Input type="number" min="1" label={tr('লেনদেন নম্বর (থাকলে)', 'Trade no. (if any)')} {...bind('trade_id')} />
              <Input type="number" min="1" label={tr('বুকিং নম্বর (থাকলে)', 'Booking no. (if any)')} {...bind('booking_id')} />
            </div>
            <div className="form-actions"><SubmitButton busy={busy}>{tr('পাঠান', 'Send')}</SubmitButton></div>
          </form>
        </Card>
        <Card title={tr('আমার অভিযোগ', 'My complaints')}>
          {loading ? <Loader inline /> : error ? <ErrorBox error={error} onRetry={reload} /> : data.length === 0 ? <EmptyState icon="📨" title={tr('কোনো অভিযোগ নেই', 'No complaints')} /> : (
            <ul className="review-list">
              {data.map((c) => (
                <li key={c.id}>
                  <strong>{c.subject}</strong> <StatusBadge group="complaintStatus" value={c.status} />
                  <p className="small">{c.description}</p>
                  {c.admin_note && <p className="quote">{tr('অ্যাডমিনের উত্তর', 'Admin reply')}: {c.admin_note}</p>}
                  <small className="muted">{dateTime(c.created_at, lang)}</small>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
