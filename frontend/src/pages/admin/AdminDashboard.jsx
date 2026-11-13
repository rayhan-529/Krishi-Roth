import { Link } from 'react-router-dom'
import { useLang } from '../../context/LanguageContext'
import { useFetch } from '../../hooks/useFetch'
import { get } from '../../services/api'
import { money, monthLabel, num, pick, timeAgo } from '../../utils/format'
import BarChart, { HBarList } from '../../components/BarChart'
import { Card, ErrorBox, Loader, PageHeader, StatCard } from '../../components/ui'

export default function AdminDashboard() {
  const { lang, tr } = useLang()
  const { data: d, loading, error, reload } = useFetch(() => get('/admin/stats'), [])
  if (loading) return <Loader />
  if (error) return <div className="page"><ErrorBox error={error} onRetry={reload} /></div>
  const c = d.counts

  return (
    <div className="page">
      <PageHeader title={tr('অ্যাডমিন ড্যাশবোর্ড', 'Admin dashboard')} subtitle={tr('পুরো প্ল্যাটফর্মের এক নজরে অবস্থা', 'The whole platform at a glance')} />
      <div className="stats-grid">
        <StatCard icon="👥" label={tr('মোট ব্যবহারকারী', 'Total users')} value={num(c.total_users, lang)} hint={tr(`${num(c.blocked_users, lang)}টি বন্ধ`, `${num(c.blocked_users, lang)} blocked`)} to="/admin/users" />
        <StatCard icon="👨‍🌾" label={tr('কৃষক', 'Farmers')} value={num(c.farmers, lang)} to="/admin/users?role=farmer" />
        <StatCard icon="🛒" tone="blue" label={tr('ক্রেতা', 'Buyers')} value={num(c.buyers, lang)} to="/admin/users?role=buyer" />
        <StatCard icon="🚜" tone="grey" label={tr('সেবাদাতা', 'Service providers')} value={num(c.service_providers, lang)} />
        <StatCard icon="🌾" label={tr('ফসলের বিজ্ঞাপন', 'Crop listings')} value={num(c.total_listings, lang)} hint={tr(`${num(c.active_listings, lang)}টি সক্রিয়`, `${num(c.active_listings, lang)} active`)} to="/admin/crops" />
        <StatCard icon="🤝" tone="blue" label={tr('লেনদেন', 'Transactions')} value={num(c.total_trades, lang)} hint={`${tr('সম্পন্ন মূল্য', 'Completed value')}: ${money(c.completed_trade_value, lang)}`} to="/admin/trades" />
        <StatCard icon="📅" tone="grey" label={tr('বুকিং', 'Bookings')} value={num(c.total_bookings, lang)} hint={tr(`${num(c.open_bookings, lang)}টি চলমান`, `${num(c.open_bookings, lang)} open`)} to="/admin/bookings" />
        <StatCard icon="🛡️" tone="amber" label={tr('যাচাইয়ের অপেক্ষায়', 'Pending verifications')} value={num(c.pending_verifications, lang)} to="/admin/verifications" />
        <StatCard icon="⚠️" tone="red" label={tr('খোলা অভিযোগ', 'Open complaints')} value={num(c.open_complaints, lang)} hint={tr(`${num(c.disputed_trades, lang)}টি লেনদেন বিরোধ`, `${num(c.disputed_trades, lang)} trade disputes`)} to="/admin/complaints" />
        <StatCard icon="📊" label={tr('বাজারদর', 'Market prices')} value={num(c.market_prices, lang)} to="/admin/market-prices" />
        <StatCard icon="🌱" label={tr('ফসলের রেকর্ড', 'Harvest records')} value={num(c.harvests, lang)} to="/admin/reports" />
      </div>
      <div className="two-col">
        <div>
          <Card title={tr('নতুন নিবন্ধন (শেষ ৬ মাস)', 'New registrations (last 6 months)')}>
            <BarChart data={d.monthly_registrations.map((m) => ({ label: monthLabel(m.month, lang), value: m.value }))} format={(v) => num(v, lang)} emptyText={tr('কোনো তথ্য নেই।', 'No data.')} />
          </Card>
          <Card title={tr('সাম্প্রতিক কার্যক্রম', 'Recent activity')} actions={<Link to="/admin/reports">{tr('সব', 'All')} →</Link>}>
            <ul className="activity-list">
              {d.recent_activity.map((a) => (
                <li key={a.id}>
                  <code>{a.action}</code> <span>{a.actor_name || tr('সিস্টেম', 'System')}</span>
                  {a.entity_type && <small className="muted"> · {a.entity_type} #{a.entity_id}</small>}
                  <small className="muted"> · {timeAgo(a.created_at, lang)}</small>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <Card title={tr('ভূমিকা অনুযায়ী ব্যবহারকারী', 'Users by role')}>
          <HBarList items={d.users_by_role.map((r) => ({ label: pick(r, 'name', lang), value: r.total }))} format={(v) => num(v, lang)} emptyText="—" />
        </Card>
      </div>
    </div>
  )
}
