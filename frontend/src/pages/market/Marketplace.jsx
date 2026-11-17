/** Farmer-to-market: browse and search crop listings. */
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLang } from '../../context/LanguageContext'
import { useLookups } from '../../context/LookupsContext'
import { useFetch } from '../../hooks/useFetch'
import { get, mediaUrl } from '../../services/api'
import { label } from '../../utils/labels'
import { money, num, pick, timeAgo } from '../../utils/format'
import CropSelect from '../../components/CropSelect'
import Icon from '../../components/Icon'
import { AreaFilter } from '../../components/LocationFields'
import { Checkbox, EmptyState, ErrorBox, Input, Loader, PageHeader, Pagination, Select, Stars, VerifiedBadge } from '../../components/ui'

export function ListingCard({ listing: l, compact }) {
  const { lang, tr } = useLang()
  return (
    <Link to={`/listings/${l.id}`} className={`listing-card ${compact ? 'compact' : ''}`}>
      <div className="listing-photo">
        {l.cover_image ? <img src={mediaUrl(l.cover_image)} alt="" loading="lazy" /> : <Icon name="wheat" size={34} />}
      </div>
      <div className="listing-body">
        <h3>{pick(l, 'crop', lang)} {l.variety && <small>({l.variety})</small>}</h3>
        <p className="listing-price">
          {money(l.price_per_unit, lang)} <small>/ {label('unit', l.unit, lang)}</small>
        </p>
        <p className="muted small">
          <Icon name="pin" size={14} /> {l.upazila ? `${l.upazila}, ` : ''}{pick(l, 'district', lang)}
        </p>
        {!compact && (
          <>
            <p className="small">{tr('পরিমাণ', 'Available')}: <strong>{num(l.quantity_available, lang)} {label('unit', l.unit, lang)}</strong></p>
            <div className="listing-seller">
              <span>{l.farmer_name} <VerifiedBadge status={l.farmer_verification} /></span>
              <Stars value={l.farmer_rating} count={l.farmer_review_count} size={13} />
            </div>
            <small className="muted">{timeAgo(l.created_at, lang)}</small>
          </>
        )}
      </div>
    </Link>
  )
}

export default function Marketplace() {
  const { lang, tr } = useLang()
  const lk = useLookups()
  const [params, setParams] = useSearchParams()
  const [page, setPage] = useState(1)
  const filters = {
    q: params.get('q') || '',
    category_id: params.get('category_id') || '',
    crop_id: params.get('crop_id') || '',
    division_id: params.get('division_id') || '',
    district_id: params.get('district_id') || '',
    min_price: params.get('min_price') || '',
    max_price: params.get('max_price') || '',
    min_quantity: params.get('min_quantity') || '',
    verified_only: params.get('verified_only') === 'true',
    sort: params.get('sort') || 'newest',
  }
  const key = JSON.stringify(filters)
  const { data, meta, loading, error, reload } = useFetch(() => get('/listings', { ...filters, page }), [key, page])

  function update(changes) {
    const next = { ...filters, ...changes }
    setParams(Object.fromEntries(Object.entries(next).filter(([k, v]) => v && !(k === 'sort' && v === 'newest'))))
    setPage(1)
  }

  return (
    <div className="page">
      <PageHeader title={tr('ফসলের বাজার', 'Crop marketplace')} />
      <div className="filters">
        <div className="field field-wide">
          <label htmlFor="market-search">{tr('খুঁজুন', 'Search')}</label>
          <div className="search-box">
            <Icon name="search" size={18} />
            <input id="market-search" className="input" defaultValue={filters.q} placeholder={tr('ফসল বা জাতের নাম', 'Crop or variety')} onKeyDown={(e) => e.key === 'Enter' && update({ q: e.target.value.trim() })} onBlur={(e) => e.target.value.trim() !== filters.q && update({ q: e.target.value.trim() })} />
          </div>
        </div>
        <Select
          label={tr('ধরন', 'Category')}
          value={filters.category_id}
          onChange={(e) => update({ category_id: e.target.value, crop_id: '' })}
          options={lk.crop_categories.map((c) => ({ value: c.id, label: lang === 'en' ? c.name_en : c.name_bn }))}
          placeholder={tr('সব ধরন', 'All categories')}
        />
        <CropSelect value={filters.crop_id} onChange={(v) => update({ crop_id: v })} placeholder={tr('সব ফসল', 'All crops')} />
        <AreaFilter divisionId={filters.division_id} districtId={filters.district_id} onChange={update} />
        <Input type="number" min="0" label={tr('সর্বনিম্ন দাম (৳)', 'Min price (৳)')} defaultValue={filters.min_price} onBlur={(e) => e.target.value !== filters.min_price && update({ min_price: e.target.value })} />
        <Input type="number" min="0" label={tr('সর্বোচ্চ দাম (৳)', 'Max price (৳)')} defaultValue={filters.max_price} onBlur={(e) => e.target.value !== filters.max_price && update({ max_price: e.target.value })} />
        <Input type="number" min="0" label={tr('সর্বনিম্ন পরিমাণ', 'Min quantity')} defaultValue={filters.min_quantity} onBlur={(e) => e.target.value !== filters.min_quantity && update({ min_quantity: e.target.value })} />
        <Select
          label={tr('সাজান', 'Sort by')}
          value={filters.sort}
          onChange={(e) => update({ sort: e.target.value })}
          options={[
            { value: 'newest', label: tr('নতুন আগে', 'Newest') },
            { value: 'price_asc', label: tr('কম দাম আগে', 'Lowest price') },
            { value: 'price_desc', label: tr('বেশি দাম আগে', 'Highest price') },
            { value: 'quantity_desc', label: tr('বেশি পরিমাণ আগে', 'Largest quantity') },
          ]}
        />
        <Checkbox label={tr('শুধু যাচাইকৃত কৃষক', 'Verified farmers only')} checked={filters.verified_only} onChange={(e) => update({ verified_only: e.target.checked })} />
      </div>

      {loading ? (
        <Loader />
      ) : error ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : data.length === 0 ? (
        <EmptyState title={tr('কোনো ফসল পাওয়া যায়নি', 'No crops found')} text={tr('ফিল্টার বদলে আবার খুঁজুন।', 'Change the filters and search again.')} />
      ) : (
        <>
          <p className="muted">{tr(`${num(meta.total, lang)}টি বিজ্ঞাপন`, `${num(meta.total, lang)} listings`)}</p>
          <div className="listing-grid">
            {data.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        </>
      )}
      <Pagination meta={meta} onPage={setPage} />
    </div>
  )
}
