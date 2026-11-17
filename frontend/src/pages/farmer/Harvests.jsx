/** Harvest management: records from planning to harvest, with reminders. */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLang } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useFetch, useForm } from '../../hooks/useFetch'
import { del, get, patch, post, put } from '../../services/api'
import { label, options } from '../../utils/labels'
import { date, money, num, pick } from '../../utils/format'
import CropSelect from '../../components/CropSelect'
import Icon from '../../components/Icon'
import { Badge, ConfirmButton, EmptyState, ErrorBox, Input, Loader, Modal, PageHeader, Pagination, Select, StatusBadge, SubmitButton, Tabs, TextArea } from '../../components/ui'

const EMPTY = {
  crop_id: '', variety: '', field_name: '', land_size: '', land_unit: 'decimal', expected_quantity: '', actual_quantity: '',
  quantity_unit: 'maund', planting_date: '', expected_harvest_date: '', actual_harvest_date: '', status: 'planned', notes: '',
}

function HarvestForm({ harvest, onClose, onSaved }) {
  const { lang, tr } = useLang()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const initial = harvest ? Object.fromEntries(Object.keys(EMPTY).map((k) => [k, harvest[k] ?? ''])) : EMPTY
  const { values, bind, set, errors, setErrors } = useForm(initial)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const body = harvest ? await put(`/harvests/${harvest.id}`, values) : await post('/harvests', values)
      toast.success(body.message)
      onSaved()
      onClose()
    } catch (err) {
      setErrors(err.errors)
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open wide title={harvest ? tr('ফসলের রেকর্ড সম্পাদনা', 'Edit harvest record') : tr('নতুন ফসলের রেকর্ড', 'New harvest record')} onClose={onClose}>
      <form onSubmit={submit} className="form" noValidate>
        <div className="grid-3">
          <CropSelect value={values.crop_id} onChange={(v) => set('crop_id', v)} error={errors.crop_id} required />
          <Input label={tr('জাত', 'Variety')} maxLength={100} {...bind('variety')} />
          <Input label={tr('জমির নাম', 'Field name')} placeholder={tr('যেমন: বাড়ির পাশের জমি', 'e.g. Field near home')} maxLength={100} {...bind('field_name')} />
        </div>
        <div className="grid-3">
          <Input type="number" min="0" step="0.01" label={tr('জমির পরিমাণ', 'Land size')} required {...bind('land_size')} />
          <Select label={tr('জমির একক', 'Land unit')} options={options('landUnit', lang)} {...bind('land_unit')} />
          <Select label={tr('অবস্থা', 'Status')} options={options('harvestStatus', lang)} {...bind('status')} />
        </div>
        <div className="grid-3">
          <Input type="date" label={tr('রোপণের তারিখ', 'Planting date')} {...bind('planting_date')} />
          <Input type="date" label={tr('সম্ভাব্য কাটার তারিখ', 'Expected harvest date')} {...bind('expected_harvest_date')} hint={tr('৩ দিন আগে মনে করিয়ে দেওয়া হবে', 'You will be reminded 3 days before')} />
          <Input type="date" label={tr('আসল কাটার তারিখ', 'Actual harvest date')} required={values.status === 'completed'} {...bind('actual_harvest_date')} />
        </div>
        <div className="grid-3">
          <Input type="number" min="0" step="0.01" label={tr('সম্ভাব্য ফলন', 'Expected yield')} {...bind('expected_quantity')} />
          <Input type="number" min="0" step="0.01" label={tr('আসল ফলন', 'Actual yield')} {...bind('actual_quantity')} />
          <Select label={tr('ফলনের একক', 'Yield unit')} options={options('unit', lang)} {...bind('quantity_unit')} />
        </div>
        <TextArea label={tr('নোট', 'Notes')} rows={3} maxLength={3000} {...bind('notes')} />
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{tr('বাতিল', 'Cancel')}</button>
          <SubmitButton busy={busy}>{tr('সংরক্ষণ করুন', 'Save')}</SubmitButton>
        </div>
      </form>
    </Modal>
  )
}

export default function Harvests() {
  const { lang, tr } = useLang()
  const toast = useToast()
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState(null) // null | 'new' | harvest
  const { data, meta, loading, error, reload } = useFetch(() => get('/harvests', { status, page }), [status, page])

  async function quickStatus(h, next) {
    try {
      const payload = { status: next }
      if (next === 'completed' && !h.actual_harvest_date) payload.actual_harvest_date = new Date().toISOString().slice(0, 10)
      const body = await patch(`/harvests/${h.id}/status`, payload)
      toast.success(body.message)
      reload()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="page">
      <PageHeader
        title={tr('ফসল ব্যবস্থাপনা', 'Harvest management')}
        actions={<button type="button" className="btn btn-primary" onClick={() => setEditing('new')}><Icon name="plus" size={18} /> {tr('নতুন রেকর্ড', 'New record')}</button>}
      />
      <Tabs active={status} onChange={(s) => (setStatus(s), setPage(1))} tabs={[{ key: '', label: tr('সব', 'All') }, ...options('harvestStatus', lang).map((o) => ({ key: o.value, label: o.label }))]} />
      {loading ? (
        <Loader />
      ) : error ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : data.length === 0 ? (
        <EmptyState icon="🌱" title={tr('কোনো রেকর্ড নেই', 'No records')} text={tr('নতুন ফসলের রেকর্ড যোগ করুন, কাটার সময় হলে আমরা মনে করিয়ে দেব।', 'Add a crop record and we will remind you when it is time to harvest.')} action={<button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>{tr('রেকর্ড যোগ করুন', 'Add record')}</button>} />
      ) : (
        <div className="cards-grid">
          {data.map((h) => {
            const soon = h.status !== 'completed' && h.days_to_harvest !== null && h.days_to_harvest <= 3
            return (
              <article key={h.id} className={`harvest-card ${soon ? 'due' : ''}`}>
                <header>
                  <h3>{pick(h, 'crop', lang)} {h.variety && <small className="muted">({h.variety})</small>}</h3>
                  <StatusBadge group="harvestStatus" value={h.status} />
                </header>
                {h.field_name && <p className="muted small">{h.field_name}</p>}
                <dl className="details compact">
                  <dt>{tr('জমি', 'Land')}</dt><dd>{num(h.land_size, lang)} {label('landUnit', h.land_unit, lang)}</dd>
                  <dt>{tr('রোপণ', 'Planted')}</dt><dd>{date(h.planting_date, lang)}</dd>
                  <dt>{tr('কাটার তারিখ', 'Harvest')}</dt>
                  <dd>
                    {h.status === 'completed' ? date(h.actual_harvest_date, lang) : date(h.expected_harvest_date, lang)}
                    {h.status !== 'completed' && h.days_to_harvest !== null && (
                      <Badge tone={soon ? 'amber' : 'grey'}>
                        {h.days_to_harvest < 0 ? tr('সময় পেরিয়ে গেছে', 'overdue') : tr(`${num(h.days_to_harvest, lang)} দিন বাকি`, `${num(h.days_to_harvest, lang)} days left`)}
                      </Badge>
                    )}
                  </dd>
                  <dt>{tr('ফলন', 'Yield')}</dt>
                  <dd>{h.actual_quantity ? num(h.actual_quantity, lang) : h.expected_quantity ? `~${num(h.expected_quantity, lang)}` : '—'} {label('unit', h.quantity_unit, lang)}</dd>
                  <dt>{tr('মোট খরচ', 'Total cost')}</dt><dd>{money(h.total_expense, lang)}</dd>
                </dl>
                <footer>
                  <select className="input input-sm" value={h.status} onChange={(e) => quickStatus(h, e.target.value)} aria-label={tr('অবস্থা বদলান', 'Change status')}>
                    {options('harvestStatus', lang).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => setEditing(h)}><Icon name="edit" size={15} /></button>
                  <Link to="/farmer/notebooks" className="btn btn-sm btn-outline" title={tr('খরচের খাতা', 'Expense notebook')}><Icon name="calculator" size={16} /></Link>
                  <ConfirmButton className="btn btn-sm btn-danger-outline" message={tr('এই রেকর্ডটি মুছে ফেলবেন? এর খরচের খাতা থাকবে।', 'Delete this record? Its expense notebooks are kept.')} onConfirm={async () => { const b = await del(`/harvests/${h.id}`); toast.success(b.message); reload() }}>
                    <Icon name="trash" size={15} />
                  </ConfirmButton>
                </footer>
              </article>
            )
          })}
        </div>
      )}
      <Pagination meta={meta} onPage={setPage} />
      {editing && <HarvestForm harvest={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={reload} />}
    </div>
  )
}
