import { useState } from 'react'
import { useLang } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useFetch, useForm } from '../../hooks/useFetch'
import { get, post } from '../../services/api'
import { label, options } from '../../utils/labels'
import { dateTime, num } from '../../utils/format'
import { Card, EmptyState, ErrorBox, Input, Loader, PageHeader, Select, SubmitButton, TextArea } from '../../components/ui'

export default function AdminAnnouncements() {
  const { lang, tr } = useLang()
  const toast = useToast()
  const { data, loading, error, reload } = useFetch(() => get('/admin/announcements'), [])
  const [busy, setBusy] = useState(false)
  const { values, setValues, bind, setErrors } = useForm({ title: '', body: '', target_role: '' })

  async function submit(event) {
    event.preventDefault()
    if (!window.confirm(tr('ঘোষণাটি পাঠাবেন? সংশ্লিষ্ট সবাই নোটিফিকেশন পাবেন।', 'Send this announcement? Everyone in the audience gets a notification.'))) return
    setBusy(true)
    try {
      const body = await post('/admin/announcements', values)
      toast.success(body.message)
      setValues({ title: '', body: '', target_role: '' })
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
      <PageHeader title={tr('ঘোষণা ও নোটিফিকেশন', 'Announcements & notifications')} />
      <div className="two-col even">
        <Card title={tr('নতুন ঘোষণা', 'New announcement')}>
          <form onSubmit={submit} className="form" noValidate>
            <Select label={tr('কাদের জন্য', 'Audience')} options={options('role', lang).filter((o) => o.value !== 'admin')} placeholder={tr('সবার জন্য', 'Everyone')} {...bind('target_role')} />
            <Input label={tr('শিরোনাম', 'Title')} required maxLength={200} {...bind('title')} />
            <TextArea label={tr('বার্তা', 'Message')} required rows={6} maxLength={5000} {...bind('body')} />
            <div className="form-actions"><SubmitButton busy={busy}>{tr('পাঠান', 'Send')}</SubmitButton></div>
          </form>
        </Card>
        <Card title={tr('আগের ঘোষণা', 'Previous announcements')}>
          {loading ? <Loader inline /> : error ? <ErrorBox error={error} onRetry={reload} /> : data.length === 0 ? <EmptyState icon="📢" title={tr('কোনো ঘোষণা নেই', 'No announcements')} /> : (
            <ul className="review-list">
              {data.map((a) => (
                <li key={a.id}>
                  <strong>{a.title}</strong>
                  <p className="small pre-line">{a.body}</p>
                  <small className="muted">{a.target_role ? label('role', a.target_role, lang) : tr('সবাই', 'Everyone')} · {tr(`${num(a.recipients, lang)} জন`, `${num(a.recipients, lang)} recipients`)} · {a.created_by_name} · {dateTime(a.created_at, lang)}</small>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
