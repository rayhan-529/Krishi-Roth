/**
 * The expense notebook itself — looks like a ruled paper খাতা.
 * Starts with 25 rows; "Add rows" adds more. Row totals and the grand total
 * update as you type. "Save" stores every filled row in MySQL at once.
 */
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useLang } from '../../context/LanguageContext'
import { useLookups } from '../../context/LookupsContext'
import { useToast } from '../../context/ToastContext'
import { useFetch } from '../../hooks/useFetch'
import { get, put } from '../../services/api'
import { label } from '../../utils/labels'
import { money, num, pick, todayBD } from '../../utils/format'
import { HBarList } from '../../components/BarChart'
import Icon from '../../components/Icon'
import { Alert, Card, ErrorBox, Loader, PageHeader, Select, Spinner } from '../../components/ui'
import { NotebookForm } from './Notebooks'

const START_ROWS = 25
let tempId = 1

function blankRow() {
  return { key: `new-${tempId++}`, id: null, expense_date: '', item_name: '', category_id: '', quantity: '', unit: '', unit_price: '', notes: '' }
}

function isFilled(row) {
  return String(row.item_name).trim() !== '' || String(row.unit_price).trim() !== ''
}

function rowTotal(row) {
  const qty = row.quantity === '' ? 1 : Number(row.quantity)
  const price = Number(row.unit_price)
  return Number.isFinite(qty) && Number.isFinite(price) ? Math.round(qty * price * 100) / 100 : 0
}

function toRows(serverRows) {
  const rows = serverRows.map((r) => ({
    key: `row-${r.id}`, id: r.id, expense_date: r.expense_date, item_name: r.item_name, category_id: r.category_id,
    quantity: r.quantity, unit: r.unit || '', unit_price: r.unit_price, notes: r.notes || '',
  }))
  while (rows.length < START_ROWS) rows.push(blankRow())
  return rows
}

export default function NotebookEditor() {
  const { id } = useParams()
  const { lang, tr } = useLang()
  const lk = useLookups()
  const toast = useToast()
  const [filter, setFilter] = useState({ from: '', to: '', category_id: '' })
  const filtering = Boolean(filter.from || filter.to || filter.category_id)
  const { data, loading, error, reload, setData } = useFetch(() => get(`/notebooks/${id}`, filter), [id, JSON.stringify(filter)])
  const [rows, setRows] = useState([])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rowErrors, setRowErrors] = useState({})
  const [editInfo, setEditInfo] = useState(false)

  useEffect(() => {
    if (data) {
      setRows(toRows(data.rows))
      setDirty(false)
      setRowErrors({})
    }
  }, [data])

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return undefined
    const warn = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const grandTotal = useMemo(() => rows.filter(isFilled).reduce((sum, r) => sum + rowTotal(r), 0), [rows])

  function update(key, field, value) {
    setRows((list) =>
      list.map((r) => {
        if (r.key !== key) return r
        const next = { ...r, [field]: value }
        // Typing an item in an empty row fills in today's date.
        if (field === 'item_name' && !r.expense_date) next.expense_date = todayBD()
        return next
      }),
    )
    setDirty(true)
  }

  function removeRow(key) {
    setRows((list) => {
      const next = list.filter((r) => r.key !== key)
      return next.length < START_ROWS ? [...next, blankRow()] : next
    })
    setDirty(true)
  }

  async function save() {
    const filled = rows.filter(isFilled)
    setSaving(true)
    setRowErrors({})
    try {
      const payload = filled.map((r) => ({
        id: r.id || undefined,
        item_name: r.item_name,
        category_id: r.category_id,
        quantity: r.quantity === '' ? 1 : r.quantity,
        unit: r.unit,
        unit_price: r.unit_price,
        expense_date: r.expense_date,
        notes: r.notes,
      }))
      const body = await put(`/notebooks/${id}/rows`, { rows: payload })
      setData(body.data)
      toast.success(tr('খাতা সংরক্ষণ হয়েছে।', 'Notebook saved.'))
    } catch (err) {
      // Map "rows.3.unit_price" back to the grid row keys.
      const mapped = {}
      for (const [field, message] of Object.entries(err.errors || {})) {
        const match = field.match(/^rows\.(\d+)\.(\w+)$/)
        if (match && filled[Number(match[1])]) {
          const key = filled[Number(match[1])].key
          mapped[key] = { ...(mapped[key] || {}), [match[2]]: message }
        }
      }
      setRowErrors(mapped)
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading && !data) return <Loader />
  if (error) return <div className="page"><ErrorBox error={error} onRetry={reload} /></div>
  const nb = data.notebook
  const categories = lk.expense_categories.map((c) => ({ value: c.id, label: lang === 'en' ? c.name_en : c.name_bn }))

  return (
    <div className="page">
      <PageHeader
        back="/farmer/notebooks"
        title={nb.title}
        subtitle={[pick(nb, 'harvest_crop', lang) || pick(nb, 'crop', lang), nb.season && label('season', nb.season, lang), nb.year && num(nb.year, lang, 0)].filter(Boolean).join(' · ')}
        actions={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setEditInfo(true)}><Icon name="edit" size={16} /> {tr('খাতার তথ্য', 'Details')}</button>
            <button type="button" className="btn btn-outline" onClick={() => window.print()}><Icon name="printer" size={16} /> {tr('প্রিন্ট', 'Print')}</button>
          </>
        }
      />

      <div className="filters filters-3">
        <div className="field"><label htmlFor="nb-from">{tr('তারিখ থেকে', 'From date')}</label><input id="nb-from" type="date" className="input" value={filter.from} onChange={(e) => setFilter((f) => ({ ...f, from: e.target.value }))} /></div>
        <div className="field"><label htmlFor="nb-to">{tr('তারিখ পর্যন্ত', 'To date')}</label><input id="nb-to" type="date" className="input" value={filter.to} onChange={(e) => setFilter((f) => ({ ...f, to: e.target.value }))} /></div>
        <Select label={tr('খাত', 'Category')} value={filter.category_id} onChange={(e) => setFilter((f) => ({ ...f, category_id: e.target.value }))} options={categories} placeholder={tr('সব খাত', 'All categories')} />
      </div>

      {filtering ? (
        <>
          <Alert tone="info">
            {tr('ফিল্টার করা তালিকা দেখছেন। সম্পাদনা করতে ফিল্টার মুছুন।', 'You are viewing a filtered list. Clear the filters to edit.')}{' '}
            <button type="button" className="link-btn" onClick={() => setFilter({ from: '', to: '', category_id: '' })}>{tr('ফিল্টার মুছুন', 'Clear filters')}</button>
          </Alert>
          <Card padded={false}>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>{tr('তারিখ', 'Date')}</th><th>{tr('বিবরণ', 'Item')}</th><th>{tr('খাত', 'Category')}</th><th className="right">{tr('মোট', 'Total')}</th></tr></thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.id}><td>{r.expense_date}</td><td>{r.item_name}</td><td>{pick(r, 'category', lang)}</td><td className="right">{money(r.total_cost, lang)}</td></tr>
                  ))}
                </tbody>
                <tfoot><tr><th colSpan={3}>{tr('মোট', 'Total')}</th><th className="right">{money(data.filtered_total, lang)}</th></tr></tfoot>
              </table>
            </div>
          </Card>
        </>
      ) : (
        <div className="ledger-wrap">
          <div className="ledger" role="table" aria-label={tr('খরচের খাতা', 'Expense notebook')}>
            <div className="ledger-row ledger-head" role="row">
              <span>{tr('ক্রম', 'No.')}</span>
              <span>{tr('তারিখ', 'Date')}</span>
              <span>{tr('বিবরণ (কী কিনলেন)', 'Item')}</span>
              <span>{tr('খাত', 'Category')}</span>
              <span>{tr('পরিমাণ', 'Qty')}</span>
              <span>{tr('একক', 'Unit')}</span>
              <span>{tr('দর (৳)', 'Rate (৳)')}</span>
              <span>{tr('মোট (৳)', 'Total (৳)')}</span>
              <span>{tr('নোট', 'Note')}</span>
              <span aria-hidden="true" />
            </div>
            {rows.map((r, index) => {
              const errs = rowErrors[r.key] || {}
              const filled = isFilled(r)
              return (
                <div className={`ledger-row ${Object.keys(errs).length ? 'row-error' : ''}`} role="row" key={r.key}>
                  <span className="ledger-no">{num(index + 1, lang)}</span>
                  <input type="date" className={errs.expense_date ? 'bad' : ''} value={r.expense_date} onChange={(e) => update(r.key, 'expense_date', e.target.value)} aria-label={tr('তারিখ', 'Date')} />
                  <input className={errs.item_name ? 'bad' : ''} value={r.item_name} maxLength={150} onChange={(e) => update(r.key, 'item_name', e.target.value)} placeholder={index === 0 && !filled ? tr('যেমন: ধানের বীজ', 'e.g. Rice seeds') : ''} aria-label={tr('বিবরণ', 'Item')} />
                  <select className={errs.category_id ? 'bad' : ''} value={r.category_id} onChange={(e) => update(r.key, 'category_id', e.target.value ? Number(e.target.value) : '')} aria-label={tr('খাত', 'Category')}>
                    <option value="">—</option>
                    {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  <input type="number" min="0" step="0.01" className={errs.quantity ? 'bad' : ''} value={r.quantity} placeholder={filled ? '1' : ''} onChange={(e) => update(r.key, 'quantity', e.target.value)} aria-label={tr('পরিমাণ', 'Quantity')} />
                  <input value={r.unit} maxLength={20} onChange={(e) => update(r.key, 'unit', e.target.value)} aria-label={tr('একক', 'Unit')} />
                  <input type="number" min="0" step="0.01" className={errs.unit_price ? 'bad' : ''} value={r.unit_price} onChange={(e) => update(r.key, 'unit_price', e.target.value)} aria-label={tr('দর', 'Rate')} />
                  <output className="ledger-total">{filled ? num(rowTotal(r), lang) : ''}</output>
                  <input value={r.notes} maxLength={255} onChange={(e) => update(r.key, 'notes', e.target.value)} aria-label={tr('নোট', 'Note')} />
                  <button type="button" className="ledger-del" onClick={() => removeRow(r.key)} aria-label={tr('সারি মুছুন', 'Delete row')} disabled={!filled}>
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              )
            })}
            <div className="ledger-row ledger-foot" role="row">
              <span />
              <span className="ledger-sum-label">{tr('সর্বমোট উৎপাদন খরচ', 'Total production cost')}</span>
              <output className="ledger-grand">{money(grandTotal, lang)}</output>
            </div>
          </div>
          <div className="ledger-actions">
            <button type="button" className="btn btn-outline" onClick={() => (setRows((list) => [...list, ...Array.from({ length: 5 }, blankRow)]), setDirty(true))}>
              <Icon name="plus" size={16} /> {tr('আরও 5টি সারি', 'Add 5 rows')}
            </button>
            {dirty && <span className="muted">{tr('অসংরক্ষিত পরিবর্তন আছে', 'Unsaved changes')}</span>}
            <button type="button" className="btn btn-primary" onClick={save} disabled={saving || !dirty}>
              {saving ? <Spinner small /> : <Icon name="check" size={18} />} {tr('খাতা সংরক্ষণ করুন', 'Save notebook')}
            </button>
          </div>
          {Object.keys(rowErrors).length > 0 && <Alert tone="error">{tr('লাল দাগ দেওয়া ঘরগুলো ঠিক করুন: প্রতিটি সারিতে বিবরণ, খাত, তারিখ ও দর দরকার।', 'Fix the cells marked in red: each row needs an item, category, date and rate.')}</Alert>}
        </div>
      )}

      <Card title={tr('খাত অনুযায়ী খরচ', 'Cost by category')}>
        <HBarList items={data.by_category.map((c) => ({ label: pick(c, 'category', lang), value: c.total }))} format={(v) => money(v, lang)} emptyText={tr('সংরক্ষিত খরচ নেই।', 'No saved expenses.')} />
      </Card>

      {editInfo && <NotebookForm notebook={nb} onClose={() => setEditInfo(false)} onSaved={() => (setEditInfo(false), reload())} />}
    </div>
  )
}
