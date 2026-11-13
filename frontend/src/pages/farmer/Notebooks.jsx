/** All expense notebooks plus the production-cost summary. */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLang } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useFetch, useForm } from '../../hooks/useFetch'
import { del, get, post, put } from '../../services/api'
import { label, options } from '../../utils/labels'
import { date, money, num, pick } from '../../utils/format'
import { HBarList } from '../../components/BarChart'
import CropSelect from '../../components/CropSelect'
import Icon from '../../components/Icon'
import { Card, ConfirmButton, EmptyState, ErrorBox, Input, Loader, Modal, PageHeader, Select, StatCard, SubmitButton, TextArea } from '../../components/ui'

export function NotebookForm({ notebook, onClose, onSaved }) {
  const { lang, tr } = useLang()
  const toast = useToast()
  const harvests = useFetch(() => get('/harvests', { limit: 50 }), [])
  const [busy, setBusy] = useState(false)
  const { values, bind, set, errors, setErrors } = useForm({
    title: notebook ? notebook.title : '',
    harvest_id: notebook ? notebook.harvest_id || '' : '',
    crop_id: notebook ? notebook.crop_id || '' : '',
    season: notebook ? notebook.season || '' : '',
    year: notebook ? notebook.year || '' : new Date().getFullYear(),
    notes: notebook ? notebook.notes || '' : '',
  })

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const body = notebook ? await put(`/notebooks/${notebook.id}`, values) : await post('/notebooks', values)
      toast.success(body.message)
      onSaved(body.data)
    } catch (err) {
      setErrors(err.errors)
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open title={notebook ? tr('খাতার তথ্য', 'Notebook details') : tr('নতুন খরচের খাতা', 'New expense notebook')} onClose={onClose}>
      <form onSubmit={submit} className="form" noValidate>
        <Input label={tr('খাতার নাম', 'Notebook title')} placeholder={tr('যেমন: বোরো ধান ২০২৬', 'e.g. Boro rice 2026')} required maxLength={150} {...bind('title')} />
        <Select
          label={tr('কোন ফসলের রেকর্ডের সঙ্গে যুক্ত (ঐচ্ছিক)', 'Linked harvest record (optional)')}
          value={values.harvest_id}
          onChange={(e) => set('harvest_id', e.target.value ? Number(e.target.value) : '')}
          options={(harvests.data || []).map((h) => ({ value: h.id, label: `${pick(h, 'crop', lang)}${h.field_name ? ` — ${h.field_name}` : ''} (${label('harvestStatus', h.status, lang)})` }))}
          placeholder={tr('কোনোটির সঙ্গে নয়', 'None')}
          error={errors.harvest_id}
        />
        {!values.harvest_id && <CropSelect value={values.crop_id} onChange={(v) => set('crop_id', v)} label={tr('ফসল (ঐচ্ছিক)', 'Crop (optional)')} placeholder={tr('বেছে নিন', 'Choose')} />}
        <div className="grid-2">
          <Select label={tr('মৌসুম', 'Season')} options={options('season', lang)} placeholder={tr('বেছে নিন', 'Choose')} {...bind('season')} />
          <Input type="number" label={tr('বছর', 'Year')} min="2000" max="2100" {...bind('year')} />
        </div>
        <TextArea label={tr('নোট', 'Notes')} rows={2} maxLength={2000} {...bind('notes')} />
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{tr('বাতিল', 'Cancel')}</button>
          <SubmitButton busy={busy}>{tr('সংরক্ষণ', 'Save')}</SubmitButton>
        </div>
      </form>
    </Modal>
  )
}

export default function Notebooks() {
  const { lang, tr } = useLang()
  const toast = useToast()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const list = useFetch(() => get('/notebooks'), [])
  const summary = useFetch(() => get('/notebooks/summary'), [])

  return (
    <div className="page">
      <PageHeader
        title={tr('ডিজিটাল খরচের খাতা', 'Digital expense notebook')}
        subtitle={tr('বীজ, সার, শ্রমিক—সব খরচ লিখে রাখুন, মোট উৎপাদন খরচ নিজে থেকেই হিসাব হবে।', 'Write down every cost; the total production cost is calculated for you.')}
        actions={<button type="button" className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={18} /> {tr('নতুন খাতা', 'New notebook')}</button>}
      />

      {summary.data && (
        <div className="stats-grid">
          <StatCard icon="🧮" tone="red" label={tr('মোট উৎপাদন খরচ', 'Total production cost')} value={money(summary.data.totals.total_cost, lang)} />
          <StatCard icon="📒" label={tr('খাতা', 'Notebooks')} value={num(summary.data.totals.notebooks, lang)} />
          <StatCard icon="✍️" tone="grey" label={tr('খরচের সারি', 'Expense rows')} value={num(summary.data.totals.rows_count, lang)} />
        </div>
      )}

      <div className="two-col">
        <Card title={tr('আমার খাতাগুলো', 'My notebooks')} padded={false}>
          {list.loading ? (
            <Loader />
          ) : list.error ? (
            <div className="card-pad"><ErrorBox error={list.error} onRetry={list.reload} /></div>
          ) : list.data.length === 0 ? (
            <EmptyState icon="📒" title={tr('কোনো খাতা নেই', 'No notebooks yet')} text={tr('প্রতিটি ফসল বা মৌসুমের জন্য আলাদা খাতা খুলুন।', 'Open a notebook for each crop or season.')} action={<button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>{tr('খাতা খুলুন', 'Open notebook')}</button>} />
          ) : (
            <ul className="notebook-list">
              {list.data.map((n) => (
                <li key={n.id}>
                  <Link to={`/farmer/notebooks/${n.id}`} className="notebook-link">
                    <span className="notebook-icon" aria-hidden="true">📒</span>
                    <span>
                      <strong>{n.title}</strong>
                      <small>
                        {[pick(n, 'harvest_crop', lang) || pick(n, 'crop', lang), n.season && label('season', n.season, lang), n.year && num(n.year, lang, 0)].filter(Boolean).join(' · ')}
                        {' · '}{tr(`${num(n.rows_count, lang)}টি সারি`, `${num(n.rows_count, lang)} rows`)} · {date(n.updated_at, lang)}
                      </small>
                    </span>
                    <strong className="notebook-total">{money(n.total_cost, lang)}</strong>
                  </Link>
                  <ConfirmButton className="icon-btn" message={tr(`"${n.title}" খাতা ও এর সব খরচ মুছে ফেলবেন? এটি ফেরানো যাবে না।`, `Delete "${n.title}" and all its expenses? This cannot be undone.`)} onConfirm={async () => { const b = await del(`/notebooks/${n.id}`); toast.success(b.message); list.reload(); summary.reload() }}>
                    <Icon name="trash" size={18} />
                  </ConfirmButton>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div>
          <Card title={tr('ফসল অনুযায়ী উৎপাদন খরচ', 'Production cost by crop')}>
            <HBarList items={(summary.data ? summary.data.by_crop : []).map((r) => ({ label: pick(r, 'crop', lang) || tr('ফসল উল্লেখ নেই', 'No crop'), value: r.total }))} format={(v) => money(v, lang)} emptyText={tr('এখনো কোনো খরচ নেই।', 'No expenses yet.')} />
          </Card>
          <Card title={tr('খাত অনুযায়ী খরচ', 'Cost by category')}>
            <HBarList items={(summary.data ? summary.data.by_category : []).map((r) => ({ label: pick(r, 'category', lang), value: r.total }))} format={(v) => money(v, lang)} emptyText={tr('এখনো কোনো খরচ নেই।', 'No expenses yet.')} />
          </Card>
          {summary.data && summary.data.by_harvest.length > 0 && (
            <Card title={tr('প্রতি ফসলের উৎপাদন খরচ', 'Cost per harvest')}>
              <ul className="row-list">
                {summary.data.by_harvest.map((h) => (
                  <li key={h.harvest_id}>
                    <div><strong>{pick(h, 'crop', lang)}</strong><small>{h.field_name} · {num(h.land_size, lang)} {label('landUnit', h.land_unit, lang)}</small></div>
                    <span>
                      {money(h.total, lang)}
                      {h.cost_per_unit && <small className="muted"><br />{money(h.cost_per_unit, lang)}/{label('unit', h.quantity_unit, lang)}</small>}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      {creating && <NotebookForm onClose={() => setCreating(false)} onSaved={(nb) => navigate(`/farmer/notebooks/${nb.id}`)} />}
    </div>
  )
}
