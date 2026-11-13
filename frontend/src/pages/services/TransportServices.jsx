import { useState } from 'react'
import { useLang } from '../../context/LanguageContext'
import { useFetch } from '../../hooks/useFetch'
import { get } from '../../services/api'
import { label, options } from '../../utils/labels'
import { num } from '../../utils/format'
import BookingModal from '../../components/BookingModal'
import { AreaFilter } from '../../components/LocationFields'
import { Checkbox, EmptyState, ErrorBox, Input, Loader, PageHeader, Pagination, Select } from '../../components/ui'
import ServiceCard from './ServiceCard'

export default function TransportServices() {
  const { lang, tr } = useLang()
  const [filters, setFilters] = useState({ vehicle_type: '', division_id: '', district_id: '', max_price: '', min_capacity_kg: '', available_only: true, sort: 'rating' })
  const [page, setPage] = useState(1)
  const [booking, setBooking] = useState(null)
  const { data, meta, loading, error, reload } = useFetch(() => get('/transport', { ...filters, page }), [JSON.stringify(filters), page])
  const update = (c) => (setFilters((f) => ({ ...f, ...c })), setPage(1))

  return (
    <div className="page">
      <PageHeader title={tr('ফসল পরিবহন সেবা', 'Crop transport services')} subtitle={tr('ট্রাক, পিকআপ, নসিমন বা নৌকা বুক করুন', 'Book a truck, pickup, nosimon or boat')} />
      <div className="filters">
        <Select label={tr('যানবাহনের ধরন', 'Vehicle type')} value={filters.vehicle_type} onChange={(e) => update({ vehicle_type: e.target.value })} options={options('vehicleType', lang)} placeholder={tr('সব ধরন', 'All types')} />
        <AreaFilter divisionId={filters.division_id} districtId={filters.district_id} onChange={update} />
        <Input type="number" min="0" label={tr('কমপক্ষে বহন ক্ষমতা (কেজি)', 'Min capacity (kg)')} defaultValue={filters.min_capacity_kg} onBlur={(e) => e.target.value !== filters.min_capacity_kg && update({ min_capacity_kg: e.target.value })} />
        <Input type="number" min="0" label={tr('সর্বোচ্চ ভাড়া (৳)', 'Max charge (৳)')} defaultValue={filters.max_price} onBlur={(e) => e.target.value !== filters.max_price && update({ max_price: e.target.value })} />
        <Select label={tr('সাজান', 'Sort by')} value={filters.sort} onChange={(e) => update({ sort: e.target.value })} options={[
          { value: 'rating', label: tr('রেটিং', 'Rating') }, { value: 'price_asc', label: tr('কম ভাড়া আগে', 'Lowest charge') },
          { value: 'capacity_desc', label: tr('বেশি ধারণক্ষমতা', 'Largest capacity') }, { value: 'newest', label: tr('নতুন আগে', 'Newest') },
        ]} />
        <Checkbox label={tr('শুধু এখন উপলব্ধ', 'Available only')} checked={filters.available_only} onChange={(e) => update({ available_only: e.target.checked })} />
      </div>
      {loading ? <Loader /> : error ? <ErrorBox error={error} onRetry={reload} /> : data.length === 0 ? (
        <EmptyState icon="🚚" title={tr('কোনো যানবাহন পাওয়া যায়নি', 'No vehicles found')} text={tr('অন্য জেলা বা ফিল্টার দিয়ে খুঁজুন।', 'Try another district or filter.')} />
      ) : (
        <div className="cards-grid">
          {data.map((t) => (
            <ServiceCard
              key={t.id}
              emoji="🚚"
              photo={t.cover_image}
              title={t.name}
              subtitle={`${label('vehicleType', t.vehicle_type, lang)} · ${tr('ধারণক্ষমতা', 'Capacity')} ${num(t.capacity, lang)} ${label('unit', t.capacity_unit, lang)}`}
              price={t.price}
              priceUnit={t.price_unit}
              ownerId={t.owner_id}
              ownerName={t.owner_name}
              ownerPhoto={t.owner_photo}
              verification={t.owner_verification}
              rating={t.average_rating}
              reviewCount={t.review_count}
              completedJobs={t.completed_jobs}
              row={t}
              available={Boolean(t.is_available)}
              details={t.description && <p className="small clamp-2">{t.description}</p>}
              onBook={() => setBooking(t)}
            />
          ))}
        </div>
      )}
      <Pagination meta={meta} onPage={setPage} />
      {booking && <BookingModal type="transport" target={booking} onClose={() => setBooking(null)} />}
    </div>
  )
}
