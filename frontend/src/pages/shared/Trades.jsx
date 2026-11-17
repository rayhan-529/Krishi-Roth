/** Transaction history for farmers and buyers. */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import { useFetch } from '../../hooks/useFetch'
import { get, mediaUrl } from '../../services/api'
import { label, options } from '../../utils/labels'
import { date, money, num, pick } from '../../utils/format'
import { EmptyState, ErrorBox, Loader, PageHeader, Pagination, StatusBadge, Tabs } from '../../components/ui'
import Icon from '../../components/Icon'

export default function Trades() {
  const { user } = useAuth()
  const { lang, tr } = useLang()
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const { data, meta, loading, error, reload } = useFetch(() => get('/trades', { status, page }), [status, page])

  return (
    <div className="page">
      <PageHeader title={tr('লেনদেনের ইতিহাস', 'Transaction history')} />
      <Tabs active={status} onChange={(s) => (setStatus(s), setPage(1))} tabs={[{ key: '', label: tr('সব', 'All') }, ...options('tradeStatus', lang).map((o) => ({ key: o.value, label: o.label }))]} />
      {loading ? <Loader /> : error ? <ErrorBox error={error} onRetry={reload} /> : data.length === 0 ? (
        <EmptyState icon="🤝" title={tr('কোনো লেনদেন নেই', 'No transactions')} text={tr('প্রস্তাব গৃহীত হলে লেনদেন এখানে দেখা যাবে।', 'Trades appear here when an offer is accepted.')} />
      ) : (
        <div className="manage-list">
          {data.map((t) => {
            const other = user.id === t.buyer_id ? t.farmer_name : t.buyer_name
            return (
              <Link key={t.id} to={`/trades/${t.id}`} className="manage-item link-item">
                <div className="manage-thumb">{t.cover_image ? <img src={mediaUrl(t.cover_image)} alt="" /> : <Icon name="wheat" size={26} />}</div>
                <div className="manage-body">
                  <h3>{pick(t, 'crop', lang)} <small className="muted">#{num(t.id, lang, 0)}</small> <StatusBadge group="tradeStatus" value={t.status} /></h3>
                  <p className="small">
                    {num(t.quantity, lang)} {label('unit', t.unit, lang)} × {money(t.price_per_unit, lang)} = <strong>{money(t.total_amount, lang)}</strong>
                  </p>
                  <p className="muted small">{user.id === t.buyer_id ? tr('কৃষক', 'Farmer') : tr('ক্রেতা', 'Buyer')}: {other} · {date(t.updated_at, lang)}</p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
      <Pagination meta={meta} onPage={setPage} />
    </div>
  )
}
