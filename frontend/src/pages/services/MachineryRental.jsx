import { useState } from 'react'
import { useLang } from '../../context/LanguageContext'
import { useFetch } from '../../hooks/useFetch'
import { get } from '../../services/api'
import { num } from '../../utils/format'
import BookingModal from '../../components/BookingModal'
import Icon from '../../components/Icon'
import { AreaFilter } from '../../components/LocationFields'
import { Checkbox, EmptyState, ErrorBox, Input, Loader, PageHeader, Pagination, Select } from '../../components/ui'
import ServiceCard from './ServiceCard'

export default function MachineryRental({ type }) {
  const { lang, tr } = useLang()
  const isHarvester = type === 'harvester'
  const [filters, setFilters] = useState({ q: '', division_id: '', district_id: '', max_price: '', available_only: true, sort: 'rating' })
  const [page, setPage] = useState(1)
  const [booking, setBooking] = useState(null)
  const { data, meta, loading, error, reload } = useFetch(() => get('/machinery', { ...filters, type, page }), [JSON.stringify(filters), type, page])
  const update = (c) => (setFilters((f) => ({ ...f, ...c })), setPage(1))

  return (
    <div className="page">
      <PageHeader
        title={isHarvester ? tr('হারভেস্টার ভাড়া', 'Harvester rental') : tr('ট্রাক্টর ভাড়া', 'Tractor rental')}
        subtitle={isHarvester ? tr('ধান-গম কাটা ও মাড়াইয়ের যন্ত্র বুক করুন', 'Book machines for cutting and threshing') : tr('জমি চাষের জন্য ট্রাক্টর বুক করুন', 'Book tractors for land preparation')}
      />
      <div className="filters">
        <div className="field field-wide">
          <label htmlFor="mach-q">{tr('খুঁজুন', 'Search')}</label>
          <div className="search-box"><Icon name="search" size={18} /><input id="mach-q" className="input" defaultValue={filters.q} placeholder={tr('নাম, ব্র্যান্ড বা মালিক', 'Name, brand or owner')} onKeyDown={(e) => e.key === 'Enter' && update({ q: e.target.value.trim() })} onBlur={(e) => e.target.value.trim() !== filters.q && update({ q: e.target.value.trim() })} /></div>
        </div>
        <AreaFilter divisionId={filters.division_id} districtId={filters.district_id} onChange={update} />
        <Input type="number" min="0" label={tr('সর্বোচ্চ ভাড়া (৳)', 'Max rent (৳)')} defaultValue={filters.max_price} onBlur={(e) => e.target.value !== filters.max_price && update({ max_price: e.target.value })} />
        <Select label={tr('সাজান', 'Sort by')} value={filters.sort} onChange={(e) => update({ sort: e.target.value })} options={[
          { value: 'rating', label: tr('রেটিং', 'Rating') }, { value: 'price_asc', label: tr('কম ভাড়া আগে', 'Lowest rent') },
          { value: 'price_desc', label: tr('বেশি ভাড়া আগে', 'Highest rent') }, { value: 'newest', label: tr('নতুন আগে', 'Newest') },
        ]} />
        <Checkbox label={tr('শুধু এখন উপলব্ধ', 'Available only')} checked={filters.available_only} onChange={(e) => update({ available_only: e.target.checked })} />
      </div>
      {loading ? <Loader /> : error ? <ErrorBox error={error} onRetry={reload} /> : data.length === 0 ? (
        <EmptyState icon={isHarvester ? '🌾' : '🚜'} title={tr('কোনো যন্ত্র পাওয়া যায়নি', 'No machines found')} text={tr('অন্য জেলা বা ফিল্টার দিয়ে খুঁজুন।', 'Try another district or filter.')} />
      ) : (
        <div className="cards-grid">
          {data.map((m) => (
            <ServiceCard
              key={m.id}
              emoji={isHarvester ? '🌾' : '🚜'}
              photo={m.cover_image}
              title={m.name}
              subtitle={[m.brand, m.model, m.model_year && num(m.model_year, lang, 0), m.horsepower && `${num(m.horsepower, lang)} HP`].filter(Boolean).join(' · ')}
              price={m.rental_price}
              priceUnit={m.price_unit}
              ownerId={m.owner_id}
              ownerName={m.owner_name}
              ownerPhoto={m.owner_photo}
              verification={m.owner_verification}
              rating={m.average_rating}
              reviewCount={m.review_count}
              completedJobs={m.completed_jobs}
              row={m}
              available={Boolean(m.is_available)}
              details={m.description && <p className="small clamp-2">{m.description}</p>}
              onBook={() => setBooking(m)}
            />
          ))}
        </div>
      )}
      <Pagination meta={meta} onPage={setPage} />
      {booking && <BookingModal type={type} target={booking} onClose={() => setBooking(null)} />}
    </div>
  )
}
