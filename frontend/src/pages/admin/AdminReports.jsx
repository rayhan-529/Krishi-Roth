/** Reports and statistics: trades, listings, bookings, users, harvests, expenses and the activity log. */
import { useState } from 'react'
import { useLang } from '../../context/LanguageContext'
import { useFetch } from '../../hooks/useFetch'
import { get } from '../../services/api'
import { label } from '../../utils/labels'
import { dateTime, money, monthLabel, num, pick } from '../../utils/format'
import BarChart, { HBarList } from '../../components/BarChart'
import Icon from '../../components/Icon'
import { Card, ErrorBox, Loader, PageHeader, Pagination, StatCard, Tabs } from '../../components/ui'

function Overview() {
  const { lang, tr } = useLang()
  const { data: d, loading, error, reload } = useFetch(() => get('/admin/reports'), [])
  if (loading) return <Loader />
  if (error) return <ErrorBox error={error} onRetry={reload} />

  const bookingTotals = {}
  d.bookings_by_type.forEach((b) => (bookingTotals[b.booking_type] = (bookingTotals[b.booking_type] || 0) + Number(b.total)))

  return (
    <>
      <div className="two-col even">
        <Card title={tr('মাসিক লেনদেন (সংখ্যা)', 'Trades per month')}>
          <BarChart data={d.trades_by_month.map((m) => ({ label: monthLabel(m.month, lang), value: m.trades }))} format={(v) => num(v, lang)} emptyText={tr('কোনো তথ্য নেই', 'No data')} />
        </Card>
        <Card title={tr('মাসিক সম্পন্ন লেনদেনের মূল্য', 'Completed trade value per month')}>
          <BarChart data={d.trades_by_month.map((m) => ({ label: monthLabel(m.month, lang), value: m.completed_value }))} format={(v) => money(v, lang)} emptyText={tr('কোনো তথ্য নেই', 'No data')} />
        </Card>
        <Card title={tr('ধরন অনুযায়ী বিজ্ঞাপন', 'Listings by category')}>
          <HBarList items={d.listings_by_category.map((c) => ({ label: pick(c, 'category', lang), value: c.total }))} format={(v) => num(v, lang)} emptyText={tr('কোনো তথ্য নেই', 'No data')} />
        </Card>
        <Card title={tr('শীর্ষ ফসল', 'Top crops')}>
          <HBarList items={d.top_crops.map((c) => ({ label: `${pick(c, 'crop', lang)} (${money(c.traded_value, lang)})`, value: c.listings }))} format={(v) => tr(`${num(v, lang)}টি`, `${num(v, lang)}`)} emptyText={tr('কোনো তথ্য নেই', 'No data')} />
        </Card>
        <Card title={tr('সেবা অনুযায়ী বুকিং', 'Bookings by service')}>
          <HBarList items={Object.entries(bookingTotals).map(([k, v]) => ({ label: label('bookingType', k, lang), value: v }))} format={(v) => num(v, lang)} emptyText={tr('কোনো তথ্য নেই', 'No data')} />
        </Card>
        <Card title={tr('জেলা অনুযায়ী ব্যবহারকারী (শীর্ষ ১০)', 'Users by district (top 10)')}>
          <HBarList items={d.users_by_district.map((u) => ({ label: pick(u, 'district', lang), value: u.total }))} format={(v) => num(v, lang)} emptyText={tr('কোনো তথ্য নেই', 'No data')} />
        </Card>
      </div>
    </>
  )
}

function Farming() {
  const { lang, tr } = useLang()
  const h = useFetch(() => get('/admin/harvests/overview'), [])
  const e = useFetch(() => get('/admin/expenses/overview'), [])
  if (h.loading || e.loading) return <Loader />
  if (h.error || e.error) return <ErrorBox error={h.error || e.error} />
  return (
    <>
      <div className="stats-grid">
        <StatCard icon="🌱" label={tr('আগামী ১৪ দিনে ফসল কাটা', 'Harvests due in 14 days')} value={num(h.data.upcoming_14_days, lang)} />
        <StatCard icon="📒" label={tr('খরচের খাতা', 'Expense notebooks')} value={num(e.data.totals.notebooks, lang)} hint={tr(`${num(e.data.totals.farmers, lang)} জন কৃষক`, `${num(e.data.totals.farmers, lang)} farmers`)} />
        <StatCard icon="🧮" tone="red" label={tr('মোট লিপিবদ্ধ খরচ', 'Total recorded cost')} value={money(e.data.totals.total_cost, lang)} />
      </div>
      <div className="two-col even">
        <Card title={tr('অবস্থা অনুযায়ী ফসলের রেকর্ড', 'Harvest records by status')}>
          <HBarList items={h.data.by_status.map((s) => ({ label: label('harvestStatus', s.status, lang), value: s.total }))} format={(v) => num(v, lang)} emptyText="—" />
        </Card>
        <Card title={tr('ফসল অনুযায়ী রেকর্ড', 'Records by crop')}>
          <HBarList items={h.data.by_crop.map((c) => ({ label: `${pick(c, 'crop', lang)} (${tr(`${num(c.farmers, lang)} কৃষক`, `${num(c.farmers, lang)} farmers`)})`, value: c.total }))} format={(v) => num(v, lang)} emptyText="—" />
        </Card>
        <Card title={tr('খাত অনুযায়ী খরচ (সব কৃষক)', 'Cost by category (all farmers)')}>
          <HBarList items={e.data.by_category.map((c) => ({ label: pick(c, 'category', lang), value: c.total }))} format={(v) => money(v, lang)} emptyText="—" />
        </Card>
        <Card title={tr('প্রতি খাতায় গড় খরচ (ফসল অনুযায়ী)', 'Average cost per notebook by crop')}>
          <HBarList items={e.data.by_crop.map((c) => ({ label: pick(c, 'crop', lang), value: c.average_per_notebook }))} format={(v) => money(v, lang)} emptyText="—" />
        </Card>
      </div>
      <p className="muted small">{tr('গোপনীয়তার জন্য এখানে শুধু মোট হিসাব দেখানো হয়; কোনো কৃষকের ব্যক্তিগত খাতা দেখা যায় না।', 'For privacy, only totals are shown here; individual farmers’ notebooks are not visible.')}</p>
    </>
  )
}

function Activity() {
  const { lang, tr } = useLang()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const { data, meta, loading, error, reload } = useFetch(() => get('/admin/activity', { q, page }), [q, page])
  return (
    <>
      <div className="filters filters-3">
        <div className="field"><label htmlFor="act-q">{tr('খুঁজুন', 'Search')}</label><div className="search-box"><Icon name="search" size={18} /><input id="act-q" className="input" placeholder="listing.create, admin..." onKeyDown={(e) => e.key === 'Enter' && (setQ(e.target.value.trim()), setPage(1))} /></div></div>
      </div>
      <Card padded={false}>
        {loading ? <Loader /> : error ? <div className="card-pad"><ErrorBox error={error} onRetry={reload} /></div> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{tr('সময়', 'Time')}</th><th>{tr('কে', 'Who')}</th><th>{tr('কাজ', 'Action')}</th><th>{tr('বিষয়', 'Item')}</th><th>{tr('বিস্তারিত', 'Details')}</th><th>IP</th></tr></thead>
              <tbody>
                {data.map((a) => (
                  <tr key={a.id}>
                    <td className="nowrap small">{dateTime(a.created_at, lang)}</td>
                    <td>{a.actor_name || '—'}{a.actor_role && <><br /><small className="muted">{label('role', a.actor_role, lang)}</small></>}</td>
                    <td><code>{a.action}</code></td>
                    <td>{a.entity_type ? `${a.entity_type} #${a.entity_id ?? ''}` : ''}</td>
                    <td className="small">{a.details}</td>
                    <td className="small muted">{a.ip_address}</td>
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

export default function AdminReports() {
  const { tr } = useLang()
  const [tab, setTab] = useState('overview')
  return (
    <div className="page">
      <PageHeader title={tr('রিপোর্ট ও পরিসংখ্যান', 'Reports & statistics')} actions={<button type="button" className="btn btn-outline" onClick={() => window.print()}>🖨️ {tr('প্রিন্ট', 'Print')}</button>} />
      <Tabs active={tab} onChange={setTab} tabs={[{ key: 'overview', label: tr('বাজার ও সেবা', 'Market & services') }, { key: 'farming', label: tr('ফসল ও খরচ', 'Harvests & costs') }, { key: 'activity', label: tr('কার্যক্রমের লগ', 'Activity log') }]} />
      {tab === 'overview' && <Overview />}
      {tab === 'farming' && <Farming />}
      {tab === 'activity' && <Activity />}
    </div>
  )
}
