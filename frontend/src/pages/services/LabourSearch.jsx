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

export default function LabourSearch() {
  const { lang, tr } = useLang()
  const [filters, setFilters] = useState({ q: '', division_id: '', district_id: '', max_wage: '', available_only: true, sort: 'rating' })
  const [page, setPage] = useState(1)
  const [booking, setBooking] = useState(null)
  const { data, meta, loading, error, reload } = useFetch(() => get('/labour', { ...filters, page }), [JSON.stringify(filters), page])
  const update = (c) => (setFilters((f) => ({ ...f, ...c })), setPage(1))

  return (
    <div className="page">
      <PageHeader title={tr('কৃষি শ্রমিক খুঁজুন', 'Find farm workers')} />
      <div className="filters">
        <div className="field field-wide">
          <label htmlFor="labour-q">{tr('দক্ষতা বা নাম', 'Skill or name')}</label>
          <div className="search-box"><Icon name="search" size={18} /><input id="labour-q" className="input" defaultValue={filters.q} placeholder={tr('যেমন: ধান কাটা', 'e.g. rice harvesting')} onKeyDown={(e) => e.key === 'Enter' && update({ q: e.target.value.trim() })} onBlur={(e) => e.target.value.trim() !== filters.q && update({ q: e.target.value.trim() })} /></div>
        </div>
        <AreaFilter divisionId={filters.division_id} districtId={filters.district_id} onChange={update} />
        <Input type="number" min="0" label={tr('সর্বোচ্চ দৈনিক মজুরি (৳)', 'Max daily wage (৳)')} defaultValue={filters.max_wage} onBlur={(e) => e.target.value !== filters.max_wage && update({ max_wage: e.target.value })} />
        <Select label={tr('সাজান', 'Sort by')} value={filters.sort} onChange={(e) => update({ sort: e.target.value })} options={[
          { value: 'rating', label: tr('রেটিং', 'Rating') }, { value: 'wage_asc', label: tr('কম মজুরি আগে', 'Lowest wage') },
          { value: 'wage_desc', label: tr('বেশি মজুরি আগে', 'Highest wage') }, { value: 'experience', label: tr('অভিজ্ঞতা', 'Experience') },
        ]} />
        <Checkbox label={tr('শুধু এখন প্রস্তুত শ্রমিক', 'Available workers only')} checked={filters.available_only} onChange={(e) => update({ available_only: e.target.checked })} />
      </div>
      {loading ? <Loader /> : error ? <ErrorBox error={error} onRetry={reload} /> : data.length === 0 ? (
        <EmptyState icon="👨‍🌾" title={tr('কোনো শ্রমিক পাওয়া যায়নি', 'No workers found')} text={tr('অন্য জেলা বা ফিল্টার দিয়ে খুঁজুন।', 'Try another district or filter.')} />
      ) : (
        <div className="cards-grid">
          {data.map((w) => (
            <ServiceCard
              key={w.user_id}
              emoji="👨‍🌾"
              photo={w.profile_photo}
              title={w.name}
              subtitle={w.skills}
              price={w.daily_wage}
              priceUnit="per_day"
              ownerId={w.user_id}
              ownerName={w.name}
              ownerPhoto={w.profile_photo}
              verification={w.verification_status}
              rating={w.average_rating}
              reviewCount={w.review_count}
              completedJobs={w.completed_jobs}
              row={w}
              available={Boolean(w.is_available)}
              details={<p className="small">{tr('অভিজ্ঞতা', 'Experience')}: {num(w.experience_years, lang)} {tr('বছর', 'years')}</p>}
              onBook={() => setBooking(w)}
            />
          ))}
        </div>
      )}
      <Pagination meta={meta} onPage={setPage} />
      {booking && <BookingModal type="labour" target={booking} onClose={() => setBooking(null)} />}
    </div>
  )
}
