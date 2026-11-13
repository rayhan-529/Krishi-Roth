/** Crop listing moderation and the crop catalogue. */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLang } from '../../context/LanguageContext'
import { useLookups } from '../../context/LookupsContext'
import { useToast } from '../../context/ToastContext'
import { useFetch, useForm } from '../../hooks/useFetch'
import { get, patch, post, put } from '../../services/api'
import { label, options } from '../../utils/labels'
import { date, money, num, pick } from '../../utils/format'
import Icon from '../../components/Icon'
import { Badge, Card, Checkbox, ConfirmButton, EmptyState, ErrorBox, Input, Loader, Modal, PageHeader, Pagination, Select, StatusBadge, SubmitButton, Tabs } from '../../components/ui'

function Listings() {
  const { lang, tr } = useLang()
  const toast = useToast()
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const { data, meta, loading, error, reload } = useFetch(() => get('/admin/listings', { status, q, page }), [status, q, page])

  async function setListingStatus(id, next, note) {
    const body = await patch(`/admin/listings/${id}/status`, { status: next, admin_note: note || undefined })
    toast.success(body.message)
    reload()
  }

  return (
    <>
      <div className="filters">
        <div className="field"><label htmlFor="l-q">{tr('খুঁজুন', 'Search')}</label><div className="search-box"><Icon name="search" size={18} /><input id="l-q" className="input" placeholder={tr('ফসল বা কৃষকের নাম', 'Crop or farmer')} onKeyDown={(e) => e.key === 'Enter' && (setQ(e.target.value.trim()), setPage(1))} /></div></div>
        <Select label={tr('অবস্থা', 'Status')} value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))} options={options('listingStatus', lang)} placeholder={tr('সব', 'All')} />
      </div>
      <Card padded={false}>
        {loading ? <Loader /> : error ? <div className="card-pad"><ErrorBox error={error} onRetry={reload} /></div> : data.length === 0 ? <EmptyState title={tr('কোনো বিজ্ঞাপন নেই', 'No listings')} /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>#</th><th>{tr('ফসল', 'Crop')}</th><th>{tr('কৃষক', 'Farmer')}</th><th>{tr('দাম', 'Price')}</th><th>{tr('পরিমাণ', 'Qty')}</th><th>{tr('প্রস্তাব', 'Offers')}</th><th>{tr('অবস্থা', 'Status')}</th><th>{tr('তারিখ', 'Date')}</th><th /></tr></thead>
              <tbody>
                {data.map((l) => (
                  <tr key={l.id}>
                    <td>{l.id}</td>
                    <td><Link to={`/listings/${l.id}`}>{pick(l, 'crop', lang)}</Link>{l.variety && <small className="muted"> ({l.variety})</small>}<br /><small className="muted">{pick(l, 'district', lang)}</small></td>
                    <td>{l.farmer_name}</td>
                    <td className="nowrap">{money(l.price_per_unit, lang)}/{label('unit', l.unit, lang)}</td>
                    <td className="nowrap">{num(l.quantity_available, lang)}/{num(l.quantity, lang)}</td>
                    <td>{num(l.offers, lang)}</td>
                    <td><StatusBadge group="listingStatus" value={l.status} />{l.admin_note && <><br /><small className="muted">{l.admin_note}</small></>}</td>
                    <td className="nowrap">{date(l.created_at, lang)}</td>
                    <td>
                      {l.status === 'removed' ? (
                        <ConfirmButton className="btn btn-sm btn-outline" danger={false} message={tr('বিজ্ঞাপনটি আবার চালু করবেন?', 'Restore this listing?')} onConfirm={() => setListingStatus(l.id, 'active')}>{tr('ফিরিয়ে আনুন', 'Restore')}</ConfirmButton>
                      ) : (
                        <ConfirmButton className="btn btn-sm btn-danger-outline" message={tr('বিজ্ঞাপনটি সরিয়ে দেবেন? কৃষককে জানানো হবে।', 'Remove this listing? The farmer will be notified.')} reasonLabel={tr('কারণ', 'Reason')} onConfirm={(r) => setListingStatus(l.id, 'removed', r)}>{tr('সরান', 'Remove')}</ConfirmButton>
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
    </>
  )
}

function CropForm({ crop, onClose, onSaved }) {
  const { lang, tr } = useLang()
  const lk = useLookups()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const { values, bind, set, setErrors } = useForm(
    crop
      ? { category_id: crop.category_id, slug: crop.slug, name_en: crop.name_en, name_bn: crop.name_bn, default_unit: crop.default_unit, is_active: Boolean(crop.is_active) }
      : { category_id: '', slug: '', name_en: '', name_bn: '', default_unit: 'kg', is_active: true },
  )

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const body = crop ? await put(`/admin/crops/${crop.id}`, values) : await post('/admin/crops', values)
      toast.success(body.message)
      lk.retry()
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
    <Modal open title={crop ? tr('ফসল সম্পাদনা', 'Edit crop') : tr('নতুন ফসল', 'New crop')} onClose={onClose}>
      <form onSubmit={submit} className="form" noValidate>
        <Select label={tr('ধরন', 'Category')} required options={lk.crop_categories.map((c) => ({ value: c.id, label: lang === 'en' ? c.name_en : c.name_bn }))} placeholder={tr('বেছে নিন', 'Choose')} {...bind('category_id')} />
        <div className="grid-2">
          <Input label={tr('বাংলা নাম', 'Bengali name')} required maxLength={80} {...bind('name_bn')} />
          <Input label={tr('ইংরেজি নাম', 'English name')} required maxLength={80} {...bind('name_en')} />
        </div>
        <div className="grid-2">
          <Input label={tr('স্লাগ (ইংরেজি, ছোট হাতের)', 'Slug (lowercase English)')} placeholder="bitter-gourd" required {...bind('slug')} />
          <Select label={tr('সাধারণ একক', 'Default unit')} options={options('unit', lang)} {...bind('default_unit')} />
        </div>
        <Checkbox label={tr('তালিকায় দেখাবে', 'Show in lists')} checked={values.is_active} onChange={(e) => set('is_active', e.target.checked)} />
        <div className="form-actions"><button type="button" className="btn btn-ghost" onClick={onClose}>{tr('বাতিল', 'Cancel')}</button><SubmitButton busy={busy}>{tr('সংরক্ষণ', 'Save')}</SubmitButton></div>
      </form>
    </Modal>
  )
}

function Catalogue() {
  const { lang, tr } = useLang()
  const { data, loading, error, reload } = useFetch(() => get('/admin/crops'), [])
  const [editing, setEditing] = useState(null)
  return (
    <Card padded={false} title={tr('ফসলের তালিকা', 'Crop catalogue')} actions={<button type="button" className="btn btn-sm btn-primary" onClick={() => setEditing('new')}><Icon name="plus" size={16} /> {tr('নতুন ফসল', 'New crop')}</button>}>
      {loading ? <Loader /> : error ? <div className="card-pad"><ErrorBox error={error} onRetry={reload} /></div> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>{tr('ফসল', 'Crop')}</th><th>{tr('ধরন', 'Category')}</th><th>{tr('একক', 'Unit')}</th><th>{tr('বিজ্ঞাপন', 'Listings')}</th><th>{tr('বাজারদর', 'Prices')}</th><th>{tr('অবস্থা', 'Status')}</th><th /></tr></thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.name_bn}</strong> <small className="muted">{c.name_en}</small></td>
                  <td>{pick(c, 'category', lang)}</td>
                  <td>{label('unit', c.default_unit, lang)}</td>
                  <td>{num(c.listings, lang)}</td>
                  <td>{num(c.prices, lang)}</td>
                  <td>{c.is_active ? <Badge tone="green">{tr('সক্রিয়', 'Active')}</Badge> : <Badge>{tr('লুকানো', 'Hidden')}</Badge>}</td>
                  <td><button type="button" className="btn btn-sm btn-outline" onClick={() => setEditing(c)}><Icon name="edit" size={15} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <CropForm crop={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={reload} />}
    </Card>
  )
}

export default function AdminCrops() {
  const { tr } = useLang()
  const [tab, setTab] = useState('listings')
  return (
    <div className="page">
      <PageHeader title={tr('ফসল ও বিজ্ঞাপন ব্যবস্থাপনা', 'Crop & listing management')} />
      <Tabs active={tab} onChange={setTab} tabs={[{ key: 'listings', label: tr('ফসলের বিজ্ঞাপন', 'Crop listings') }, { key: 'catalogue', label: tr('ফসলের তালিকা', 'Crop catalogue') }]} />
      {tab === 'listings' ? <Listings /> : <Catalogue />}
    </div>
  )
}
