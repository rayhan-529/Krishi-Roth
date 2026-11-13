import { useParams } from 'react-router-dom'
import { useLang } from '../../context/LanguageContext'
import { useFetch } from '../../hooks/useFetch'
import { get } from '../../services/api'
import { label } from '../../utils/labels'
import { date, money, num, pick, timeAgo } from '../../utils/format'
import { Avatar, Badge, Card, EmptyState, ErrorBox, Loader, PageHeader, Stars, VerifiedBadge } from '../../components/ui'

export default function PublicProfile() {
  const { id } = useParams()
  const { lang, tr } = useLang()
  const { data: u, loading, error, reload } = useFetch(() => get(`/users/${id}`), [id])

  if (loading) return <Loader />
  if (error) return <div className="page"><ErrorBox error={error} onRetry={reload} /></div>

  return (
    <div className="page">
      <PageHeader title={tr('প্রোফাইল', 'Profile')} />
      <div className="two-col">
        <div>
          <Card>
            <div className="profile-head">
              <Avatar src={u.profile_photo} name={u.name} size={80} />
              <div>
                <h2>{u.name} <VerifiedBadge status={u.verification_status} /></h2>
                <p className="muted">{pick(u, 'role', lang)} · {u.upazila ? `${u.upazila}, ` : ''}{pick(u, 'district', lang)}</p>
                <Stars value={u.average_rating} count={u.review_count} />
                <p className="small muted">{tr('সদস্য', 'Member since')} {date(u.created_at, lang)}</p>
              </div>
            </div>
            {u.bio && <p className="pre-line">{u.bio}</p>}
            <div className="chip-list">
              {u.completed_trades !== undefined && <Badge tone="green">{tr(`${num(u.completed_trades, lang)}টি সম্পন্ন লেনদেন`, `${num(u.completed_trades, lang)} completed trades`)}</Badge>}
              {u.active_listings !== undefined && <Badge tone="blue">{tr(`${num(u.active_listings, lang)}টি সক্রিয় বিজ্ঞাপন`, `${num(u.active_listings, lang)} active listings`)}</Badge>}
            </div>
          </Card>
          {u.labour_profile && (
            <Card title={tr('কাজের তথ্য', 'Work details')}>
              <dl className="details">
                <dt>{tr('দক্ষতা', 'Skills')}</dt><dd>{u.labour_profile.skills}</dd>
                <dt>{tr('দৈনিক মজুরি', 'Daily wage')}</dt><dd>{money(u.labour_profile.daily_wage, lang)}</dd>
                <dt>{tr('অভিজ্ঞতা', 'Experience')}</dt><dd>{num(u.labour_profile.experience_years, lang)} {tr('বছর', 'years')}</dd>
                <dt>{tr('অবস্থা', 'Status')}</dt><dd>{u.labour_profile.is_available ? tr('কাজের জন্য প্রস্তুত', 'Available') : tr('এখন ব্যস্ত', 'Busy')}</dd>
              </dl>
              {u.labour_profile.experience_details && <p>{u.labour_profile.experience_details}</p>}
            </Card>
          )}
          {u.machinery && u.machinery.length > 0 && (
            <Card title={tr('যন্ত্র', 'Machines')}>
              <ul className="row-list">{u.machinery.map((m) => <li key={m.id}><div><strong>{m.name}</strong><small>{label('bookingType', m.machine_type, lang)}</small></div><span>{money(m.rental_price, lang)} <small>{label('machinePrice', m.price_unit, lang)}</small></span></li>)}</ul>
            </Card>
          )}
          {u.vehicles && u.vehicles.length > 0 && (
            <Card title={tr('যানবাহন', 'Vehicles')}>
              <ul className="row-list">{u.vehicles.map((v) => <li key={v.id}><div><strong>{v.name}</strong><small>{label('vehicleType', v.vehicle_type, lang)} · {num(v.capacity, lang)} {label('unit', v.capacity_unit, lang)}</small></div><span>{money(v.price, lang)} <small>{label('machinePrice', v.price_unit, lang)}</small></span></li>)}</ul>
            </Card>
          )}
          {u.service_areas && u.service_areas.length > 0 && (
            <Card title={tr('সেবার এলাকা', 'Service areas')}>
              <div className="chip-list">{u.service_areas.map((a, i) => <span key={i} className="chip">{pick(a, 'district', lang)}{a.upazila ? ` — ${a.upazila}` : ''}</span>)}</div>
            </Card>
          )}
        </div>
        <Card title={tr('রিভিউ', 'Reviews')}>
          {u.reviews.length === 0 ? <EmptyState icon="⭐" title={tr('এখনো কোনো রিভিউ নেই', 'No reviews yet')} /> : (
            <ul className="review-list">
              {u.reviews.map((r) => (
                <li key={r.id}>
                  <Stars value={r.rating} />
                  {r.comment && <p>{r.comment}</p>}
                  <small className="muted">{r.reviewer_name} ({label('role', r.reviewer_role, lang)}) · {timeAgo(r.created_at, lang)}</small>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
