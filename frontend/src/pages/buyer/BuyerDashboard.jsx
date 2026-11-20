import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import { useFetch } from '../../hooks/useFetch'
import { get } from '../../services/api'
import { label } from '../../utils/labels'
import { money, monthLabel, num, pick } from '../../utils/format'
import BarChart from '../../components/BarChart'
import { Card, ErrorBox, Loader, PageHeader, StatCard, StatusBadge } from '../../components/ui'
import { QuickLinks, RecentNotifications } from '../farmer/FarmerDashboard'
import { ListingCard } from '../market/Marketplace'
import { PaymentMethods } from '../../components/CardSoon'

export default function BuyerDashboard() {
  const { user } = useAuth()
  const { lang, tr } = useLang()
  const { data: d, loading, error, reload } = useFetch(() => get('/dashboard'), [])

  if (loading) return <Loader />
  if (error) return <div className="page"><ErrorBox error={error} onRetry={reload} /></div>
  const c = d.counts

  return (
    <div className="page">
      <PageHeader banner title={tr(`স্বাগতম, ${user.name}`, `Welcome, ${user.name}`)} />
      <QuickLinks
        links={[
          ['/marketplace', '🛒', 'ফসল খুঁজুন', 'Browse crops'],
          ['/offers', '📩', 'আমার প্রস্তাব', 'My offers'],
          ['/trades', '🤝', 'লেনদেন', 'Transactions'],
          ['/services/transport', '🚚', 'পরিবহন বুক করুন', 'Book transport'],
          ['/market-prices', '📊', 'বাজারদর', 'Market prices'],
        ]}
      />
      <div className="stats-grid">
        <StatCard icon="📩" tone="amber" label={tr('অপেক্ষমাণ প্রস্তাব', 'Pending offers')} value={num(c.pending_offers, lang)} to="/offers" />
        <StatCard icon="🤝" tone="blue" label={tr('চলমান লেনদেন', 'Active trades')} value={num(c.active_trades, lang)} to="/trades" />
        <StatCard icon="✅" label={tr('সম্পন্ন কেনাকাটা', 'Completed purchases')} value={num(c.completed_trades, lang)} hint={money(c.total_purchases, lang)} to="/trades" />
        <StatCard icon="🚚" tone="grey" label={tr('চলমান বুকিং', 'Active bookings')} value={num(c.active_bookings, lang)} to="/bookings" />
      </div>
      <div className="two-col">
        <div>
          <Card title={tr('নতুন ফসল', 'New crops')} actions={<Link to="/marketplace">{tr('সব', 'All')} →</Link>}>
            {d.new_listings.length === 0 ? <p className="muted">{tr('এখন কোনো ফসল নেই।', 'No crops right now.')}</p> : (
              <div className="listing-grid small">{d.new_listings.map((l) => <ListingCard key={l.id} listing={l} compact />)}</div>
            )}
          </Card>
          <Card title={tr('মাসিক কেনাকাটা', 'Monthly purchases')}>
            <BarChart data={d.monthly_purchases.map((m) => ({ label: monthLabel(m.month, lang), value: m.value }))} format={(v) => money(v, lang)} emptyText={tr('এখনো কোনো সম্পন্ন কেনাকাটা নেই।', 'No completed purchases yet.')} />
          </Card>
        </div>
        <div>
          <Card title={tr('সাম্প্রতিক লেনদেন', 'Recent transactions')} actions={<Link to="/trades">{tr('সব', 'All')} →</Link>}>
            {d.recent_trades.length === 0 ? <p className="muted">{tr('কোনো লেনদেন নেই।', 'No transactions.')}</p> : (
              <ul className="row-list">
                {d.recent_trades.map((t) => (
                  <li key={t.id}>
                    <div><Link to={`/trades/${t.id}`}><strong>{pick(t, 'crop', lang)}</strong></Link><small>{t.farmer_name} · {num(t.quantity, lang)} {label('unit', t.unit, lang)}</small></div>
                    <span><StatusBadge group="tradeStatus" value={t.status} /><br /><small>{money(t.total_amount, lang)}</small></span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <RecentNotifications items={d.recent_notifications} />
        </div>
      </div>
      <PaymentMethods />
    </div>
  )
}
