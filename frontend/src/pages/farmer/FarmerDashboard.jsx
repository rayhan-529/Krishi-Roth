import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import { useFetch } from '../../hooks/useFetch'
import { get } from '../../services/api'
import { label } from '../../utils/labels'
import { date, money, monthLabel, num, pick, timeAgo } from '../../utils/format'
import BarChart, { HBarList } from '../../components/BarChart'
import { Card, EmptyState, ErrorBox, Loader, PageHeader, PriceSourceNote, StatCard, StatusBadge } from '../../components/ui'

export function RecentNotifications({ items }) {
  const { lang, tr } = useLang()
  return (
    <Card title={tr('সাম্প্রতিক নোটিফিকেশন', 'Recent notifications')} actions={<Link to="/notifications">{tr('সব', 'All')} →</Link>}>
      {items.length === 0 ? (
        <p className="muted">{tr('কোনো নোটিফিকেশন নেই।', 'No notifications.')}</p>
      ) : (
        <ul className="notif-mini">
          {items.map((n) => (
            <li key={n.id} className={n.is_read ? '' : 'unread'}>
              <Link to={n.link || '/notifications'}>{n.title}</Link>
              <small>{timeAgo(n.created_at, lang)}</small>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export function QuickLinks({ links }) {
  const { tr } = useLang()
  return (
    <div className="quick-links">
      {links.map(([to, icon, bn, en]) => (
        <Link key={to} to={to}>
          <span aria-hidden="true">{icon}</span>
          {tr(bn, en)}
        </Link>
      ))}
    </div>
  )
}

export default function FarmerDashboard() {
  const { user } = useAuth()
  const { lang, tr } = useLang()
  const { data: d, loading, error, reload } = useFetch(() => get('/dashboard'), [])

  if (loading) return <Loader />
  if (error) return <div className="page"><ErrorBox error={error} onRetry={reload} /></div>
  const c = d.counts

  return (
    <div className="page">
      <PageHeader title={tr(`স্বাগতম, ${user.name}`, `Welcome, ${user.name}`)} subtitle={tr('আপনার খামারের এক নজরে হিসাব', 'Your farm at a glance')} />
      <QuickLinks
        links={[
          ['/farmer/listings/new', '➕', 'ফসল বিক্রির বিজ্ঞাপন', 'Sell a crop'],
          ['/farmer/notebooks', '🧮', 'খরচ লিখুন', 'Add expenses'],
          ['/farmer/harvests', '🌱', 'ফসলের রেকর্ড', 'Harvest records'],
          ['/services/labour', '👨‍🌾', 'শ্রমিক খুঁজুন', 'Find labour'],
          ['/services/harvester', '🚜', 'যন্ত্র ভাড়া', 'Rent machinery'],
          ['/chatbot', '🤖', 'এআই সহায়ক', 'AI assistant'],
        ]}
      />
      <div className="stats-grid">
        <StatCard icon="🌾" label={tr('ফসলের বিজ্ঞাপন', 'Crop listings')} value={num(c.total_listings, lang)} hint={tr(`${num(c.active_listings, lang)}টি সক্রিয়`, `${num(c.active_listings, lang)} active`)} to="/farmer/listings" />
        <StatCard icon="📩" tone="amber" label={tr('অপেক্ষমাণ প্রস্তাব', 'Pending offers')} value={num(c.pending_offers, lang)} to="/offers" />
        <StatCard icon="🤝" tone="blue" label={tr('চলমান লেনদেন', 'Active trades')} value={num(c.active_trades, lang)} hint={`${tr('মোট বিক্রি', 'Total sales')}: ${money(c.total_sales, lang)}`} to="/trades" />
        <StatCard icon="🗓️" tone="grey" label={tr('চলমান বুকিং', 'Active bookings')} value={num(c.active_bookings, lang)} to="/bookings" />
        <StatCard icon="🌱" label={tr('ফসলের রেকর্ড', 'Harvest records')} value={num(c.total_harvests, lang)} hint={tr(`${num(c.ongoing_harvests, lang)}টি চলমান`, `${num(c.ongoing_harvests, lang)} ongoing`)} to="/farmer/harvests" />
        <StatCard icon="🧮" tone="red" label={tr('মোট উৎপাদন খরচ', 'Total production cost')} value={money(c.total_expenses, lang)} to="/farmer/notebooks" />
      </div>

      <div className="two-col">
        <div>
          <Card title={tr('মাসিক খরচ (শেষ ৬ মাস)', 'Monthly expenses (last 6 months)')}>
            <BarChart data={d.monthly_expenses.map((m) => ({ label: monthLabel(m.month, lang), value: m.value }))} format={(v) => money(v, lang)} emptyText={tr('এখনো কোনো খরচ লেখা হয়নি।', 'No expenses recorded yet.')} />
          </Card>
          <Card title={tr('অপেক্ষমাণ ক্রয় প্রস্তাব', 'Pending purchase offers')} actions={<Link to="/offers">{tr('সব', 'All')} →</Link>}>
            {d.pending_offers.length === 0 ? (
              <p className="muted">{tr('এখন কোনো প্রস্তাব অপেক্ষায় নেই।', 'No offers waiting right now.')}</p>
            ) : (
              <ul className="row-list">
                {d.pending_offers.map((o) => (
                  <li key={o.id}>
                    <div><strong>{pick(o, 'crop', lang)}</strong><small>{o.buyer_name} · {timeAgo(o.created_at, lang)}</small></div>
                    <span>{num(o.quantity, lang)} {label('unit', o.unit, lang)} × {money(o.offered_price_per_unit, lang)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title={tr('সর্বশেষ বাজারদর', 'Latest market prices')} actions={<Link to="/market-prices">{tr('সব', 'All')} →</Link>}>
            {d.market_prices.length === 0 ? (
              <EmptyState icon="📊" title={tr('এখনো বাজারদর নেই', 'No prices yet')} />
            ) : (
              <ul className="price-list">
                {d.market_prices.map((p) => (
                  <li key={p.id}>
                    <div><strong>{pick(p, 'crop', lang)}</strong><small>{p.market_name}, {pick(p, 'district', lang)} · {date(p.price_date, lang)}</small></div>
                    <span>{money(p.min_price, lang)} – {money(p.max_price, lang)} <small>/{label('unit', p.unit, lang)}</small></span>
                  </li>
                ))}
              </ul>
            )}
            <PriceSourceNote />
          </Card>
        </div>
        <div>
          <Card title={tr('আসন্ন ফসল কাটা', 'Upcoming harvests')} actions={<Link to="/farmer/harvests">{tr('সব', 'All')} →</Link>}>
            {d.upcoming_harvests.length === 0 ? (
              <p className="muted">{tr('কোনো আসন্ন ফসল নেই।', 'No upcoming harvests.')}</p>
            ) : (
              <ul className="row-list">
                {d.upcoming_harvests.map((h) => (
                  <li key={h.id}>
                    <div><strong>{pick(h, 'crop', lang)}</strong><small>{h.field_name || ''} · {date(h.expected_harvest_date, lang)}</small></div>
                    <span>
                      {h.days_to_harvest < 0 ? <StatusBadge group="harvestStatus" value={h.status} /> : tr(`${num(h.days_to_harvest, lang)} দিন বাকি`, `${num(h.days_to_harvest, lang)} days left`)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title={tr('খরচের খাত', 'Expenses by category')}>
            <HBarList items={d.expense_by_category.map((e) => ({ label: pick(e, 'category', lang), value: e.total }))} format={(v) => money(v, lang)} emptyText={tr('এখনো কোনো খরচ নেই।', 'No expenses yet.')} />
          </Card>
          <RecentNotifications items={d.recent_notifications} />
        </div>
      </div>
    </div>
  )
}
