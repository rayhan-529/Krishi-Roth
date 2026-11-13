/** Admin-managed market prices: add, edit, delete. */
import { useState } from 'react'
import { useLang } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useFetch, useForm } from '../../hooks/useFetch'
import { del, get, post, put } from '../../services/api'
import { label, options } from '../../utils/labels'
import { date, money, pick, todayBD } from '../../utils/format'
import CropSelect from '../../components/CropSelect'
import Icon from '../../components/Icon'
import LocationFields from '../../components/LocationFields'
import { Card, ConfirmButton, EmptyState, ErrorBox, Input, Loader, Modal, PageHeader, Pagination, Select, SubmitButton } from '../../components/ui'

function PriceForm({ price, onClose, onSaved }) {
  const { lang, tr } = useLang()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const { values, bind, set, errors, setErrors } = useForm(
    price
      ? { crop_id: price.crop_id, market_name: price.market_name, district_id: price.district_id, unit: price.unit, min_price: price.min_price, max_price: price.max_price, price_date: price.price_date, source_note: price.source_note || '' }
      : { crop_id: '', market_name: '', district_id: '', unit: 'kg', min_price: '', max_price: '', price_date: todayBD(), source_note: '' },
  )

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const body = price ? await put(`/market-prices/${price.id}`, values) : await post('/market-prices', values)
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
    <Modal open wide title={price ? tr('বাজারদর সম্পাদনা', 'Edit price') : tr('নতুন বাজারদর', 'New market price')} onClose={onClose}>
      <form onSubmit={submit} className="form" noValidate>
        <div className="grid-2">
          <CropSelect value={values.crop_id} onChange={(v) => set('crop_id', v)} error={errors.crop_id} required />
          <Input label={tr('বাজারের নাম', 'Market name')} placeholder={tr('যেমন: কারওয়ান বাজার', 'e.g. Karwan Bazar')} required maxLength={120} {...bind('market_name')} />
        </div>
        <LocationFields districtId={values.district_id} onDistrict={(v) => set('district_id', v)} showUpazila={false} errors={errors} required />
        <div className="grid-4">
          <Select label={tr('একক', 'Unit')} options={options('unit', lang)} {...bind('unit')} />
          <Input type="number" min="0" step="0.01" label={tr('সর্বনিম্ন দাম (৳)', 'Min price (৳)')} required {...bind('min_price')} />
          <Input type="number" min="0" step="0.01" label={tr('সর্বোচ্চ দাম (৳)', 'Max price (৳)')} required {...bind('max_price')} />
          <Input type="date" label={tr('তারিখ', 'Date')} required {...bind('price_date')} />
        </div>
        <Input label={tr('তথ্যের উৎস (ঐচ্ছিক)', 'Source note (optional)')} placeholder={tr('যেমন: বাজার পরিদর্শন, কৃষি বিপণন অধিদপ্তর', 'e.g. market visit, DAM bulletin')} maxLength={255} {...bind('source_note')} />
        <div className="form-actions"><button type="button" className="btn btn-ghost" onClick={onClose}>{tr('বাতিল', 'Cancel')}</button><SubmitButton busy={busy}>{tr('সংরক্ষণ', 'Save')}</SubmitButton></div>
      </form>
    </Modal>
  )
}

export default function AdminMarketPrices() {
  const { lang, tr } = useLang()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [history, setHistory] = useState(true)
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState(null)
  const { data, meta, loading, error, reload } = useFetch(() => get('/market-prices', { q, history, page, limit: 30 }), [q, history, page])

  return (
    <div className="page">
      <PageHeader
        title={tr('বাজারদর ব্যবস্থাপনা', 'Market price management')}
        subtitle={tr('যোগ করা দাম "অ্যাডমিন প্রদত্ত" হিসেবে দেখানো হয়। নতুন দাম যোগ করলে সংশ্লিষ্ট কৃষকেরা নোটিফিকেশন পান।', 'Prices are shown as admin-entered. Farmers growing or selling the crop are notified of new prices.')}
        actions={<button type="button" className="btn btn-primary" onClick={() => setEditing('new')}><Icon name="plus" size={18} /> {tr('নতুন দাম', 'Add price')}</button>}
      />
      <div className="filters filters-3">
        <div className="field"><label htmlFor="mp-q">{tr('খুঁজুন', 'Search')}</label><div className="search-box"><Icon name="search" size={18} /><input id="mp-q" className="input" placeholder={tr('ফসল বা বাজার', 'Crop or market')} onKeyDown={(e) => e.key === 'Enter' && (setQ(e.target.value.trim()), setPage(1))} /></div></div>
        <Select label={tr('দেখান', 'Show')} value={history ? 'all' : 'latest'} onChange={(e) => (setHistory(e.target.value === 'all'), setPage(1))} options={[{ value: 'all', label: tr('সব তারিখের দাম', 'All dates') }, { value: 'latest', label: tr('শুধু সর্বশেষ', 'Latest only') }]} />
      </div>
      <Card padded={false}>
        {loading ? <Loader /> : error ? <div className="card-pad"><ErrorBox error={error} onRetry={reload} /></div> : data.length === 0 ? (
          <EmptyState icon="📊" title={tr('এখনো কোনো দাম নেই', 'No prices yet')} action={<button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>{tr('প্রথম দাম যোগ করুন', 'Add the first price')}</button>} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{tr('ফসল', 'Crop')}</th><th>{tr('বাজার', 'Market')}</th><th>{tr('জেলা', 'District')}</th><th>{tr('দাম', 'Price')}</th><th>{tr('তারিখ', 'Date')}</th><th>{tr('উৎস', 'Source')}</th><th /></tr></thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.id}>
                    <td>{pick(p, 'crop', lang)}</td>
                    <td>{p.market_name}</td>
                    <td>{pick(p, 'district', lang)}</td>
                    <td className="nowrap">{money(p.min_price, lang)} – {money(p.max_price, lang)} /{label('unit', p.unit, lang)}</td>
                    <td className="nowrap">{date(p.price_date, lang)}</td>
                    <td className="small">{p.source_note}</td>
                    <td className="actions">
                      <button type="button" className="btn btn-sm btn-outline" onClick={() => setEditing(p)}><Icon name="edit" size={15} /></button>
                      <ConfirmButton className="btn btn-sm btn-danger-outline" message={tr('এই দামটি মুছে ফেলবেন?', 'Delete this price?')} onConfirm={async () => { const b = await del(`/market-prices/${p.id}`); toast.success(b.message); reload() }}><Icon name="trash" size={15} /></ConfirmButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Pagination meta={meta} onPage={setPage} />
      {editing && <PriceForm price={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={reload} />}
    </div>
  )
}
