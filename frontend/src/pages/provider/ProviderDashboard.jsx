/** Dashboard for labour, harvester owners, tractor owners and transport owners. */
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import { useFetch } from '../../hooks/useFetch'
import { get } from '../../services/api'
import { label } from '../../utils/labels'
import { date, money, monthLabel, num, pick } from '../../utils/format'
import BarChart from '../../components/BarChart'
import { Alert, Card, ErrorBox, Loader, PageHeader, StatCard, Stars, StatusBadge } from '../../components/ui'
import { RecentNotifications } from '../farmer/FarmerDashboard'

export default function ProviderDashboard() {
  const { user } = useAuth()
  const { lang, tr } = useLang()
  const { data: d, loading, error, reload } = useFetch(() => get('/dashboard'), [])

  if (loading) return <Loader />
  if (error) return <div className="page"><ErrorBox error={error} onRetry={reload} /></div>
  const c = d.counts
  const s = d.services

  let setupNeeded = null
  if (user.role === 'labour' && !s.labour_profile) setupNeeded = tr('কৃষকেরা আপনাকে খুঁজে পেতে আগে কাজের প্রোফাইল (দৈনিক মজুরি, এলাকা, দক্ষতা) তৈরি করুন।', 'Create your work profile (daily wage, area, skills) so farmers can find you.')
  if (s.machinery && Number(s.machinery.total) === 0) setupNeeded = tr('আপনার যন্ত্রের তথ্য ও ভাড়া যোগ করুন, তাহলে কৃষকেরা বুক করতে পারবেন।', 'Add your machine and its rent so farmers can book it.')
  if (s.vehicles && Number(s.vehicles.total) === 0) setupNeeded = tr('আপনার যানবাহনের তথ্য ও ভাড়া যোগ করুন।', 'Add your vehicle and its charges.')

  const title = { labour: ['শ্রমিক ড্যাশবোর্ড', 'Labour dashboard'], harvester_owner: ['হারভেস্টার মালিক ড্যাশবোর্ড', 'Harvester owner dashboard'], tractor_owner: ['ট্রাক্টর মালিক ড্যাশবোর্ড', 'Tractor owner dashboard'], transport_owner: ['পরিবহন মালিক ড্যাশবোর্ড', 'Transport owner dashboard'] }[user.role]

  return (
    <div className="page">
      <PageHeader title={tr(title[0], title[1])} subtitle={tr(`স্বাগতম, ${user.name}`, `Welcome, ${user.name}`)} actions={<Link to="/provider/services" className="btn btn-primary">{tr('আমার সেবা পরিচালনা', 'Manage my services')}</Link>} />
      {setupNeeded && <Alert tone="warning">{setupNeeded} <Link to="/provider/services">{tr('এখনই করুন', 'Do it now')} →</Link></Alert>}
      <div className="stats-grid">
        <StatCard icon="📥" tone="amber" label={tr('নতুন অনুরোধ', 'New requests')} value={num(c.pending, lang)} to="/bookings?as=provider&status=pending" />
        <StatCard icon="📅" tone="blue" label={tr('গৃহীত / চলমান', 'Accepted / in progress')} value={num(c.accepted + c.in_progress, lang)} to="/bookings?as=provider" />
        <StatCard icon="✅" label={tr('সম্পন্ন কাজ', 'Completed jobs')} value={num(c.completed, lang)} hint={`${tr('আনুমানিক আয়', 'Est. earnings')}: ${money(c.completed_value, lang)}`} />
        <StatCard icon="⭐" tone="grey" label={tr('রেটিং', 'Rating')} value={<Stars value={d.rating.average_rating} count={d.rating.review_count} />} />
      </div>
      <div className="two-col">
        <div>
          <Card title={tr('চলমান অনুরোধ ও কাজ', 'Open requests and jobs')} actions={<Link to="/bookings?as=provider">{tr('সব', 'All')} →</Link>}>
            {d.open_requests.length === 0 ? <p className="muted">{tr('এখন কোনো অনুরোধ নেই।', 'No open requests right now.')}</p> : (
              <ul className="row-list">
                {d.open_requests.map((b) => (
                  <li key={b.id}>
                    <div>
                      <Link to={`/bookings/${b.id}`}><strong>{b.requester_name}</strong></Link>
                      <small>{label('bookingType', b.booking_type, lang)}{b.machine_name ? ` · ${b.machine_name}` : ''}{b.vehicle_name ? ` · ${b.vehicle_name}` : ''} · {pick(b, 'work_district', lang)} · {date(b.start_date, lang)}</small>
                    </div>
                    <StatusBadge group="bookingStatus" value={b.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title={tr('মাসিক সম্পন্ন কাজ', 'Completed jobs per month')}>
            <BarChart data={d.monthly_jobs.map((m) => ({ label: monthLabel(m.month, lang), value: m.value }))} format={(v) => num(v, lang)} emptyText={tr('এখনো কোনো সম্পন্ন কাজ নেই।', 'No completed jobs yet.')} />
          </Card>
        </div>
        <div>
          <Card title={tr('আমার সেবা', 'My services')}>
            {s.labour_profile && (
              <p>{tr('দৈনিক মজুরি', 'Daily wage')}: <strong>{money(s.labour_profile.daily_wage, lang)}</strong> · {s.labour_profile.is_available ? tr('কাজের জন্য প্রস্তুত', 'Available') : tr('এখন ব্যস্ত', 'Not available')}</p>
            )}
            {s.machinery && <p>{tr('নিবন্ধিত যন্ত্র', 'Registered machines')}: <strong>{num(s.machinery.total, lang)}</strong> ({tr('উপলব্ধ', 'available')}: {num(s.machinery.available || 0, lang)})</p>}
            {s.vehicles && <p>{tr('নিবন্ধিত যানবাহন', 'Registered vehicles')}: <strong>{num(s.vehicles.total, lang)}</strong> ({tr('উপলব্ধ', 'available')}: {num(s.vehicles.available || 0, lang)})</p>}
            <p>{tr('অতিরিক্ত সেবার এলাকা', 'Extra service areas')}: <strong>{num(d.service_area_count, lang)}</strong></p>
            <Link to="/provider/services" className="btn btn-outline btn-block">{tr('পরিচালনা করুন', 'Manage')}</Link>
          </Card>
          <RecentNotifications items={d.recent_notifications} />
        </div>
      </div>
    </div>
  )
}
