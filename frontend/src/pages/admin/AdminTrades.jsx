import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLang } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useFetch } from '../../hooks/useFetch'
import { get, patch } from '../../services/api'
import { label, options } from '../../utils/labels'
import { date, money, num, pick } from '../../utils/format'
import { Card, ConfirmButton, EmptyState, ErrorBox, Loader, PageHeader, Pagination, StatusBadge, Tabs } from '../../components/ui'

export default function AdminTrades() {
  const { lang, tr } = useLang()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const status = params.get('status') || ''
  const [page, setPage] = useState(1)
  const { data, meta, loading, error, reload } = useFetch(() => get('/admin/trades', { status, page }), [status, page])

  async function resolve(id, toStatus, note) {
    const body = await patch(`/admin/trades/${id}/resolve`, { to_status: toStatus, note })
    toast.success(body.message)
    reload()
  }

  return (
    <div className="page">
      <PageHeader title={tr('লেনদেন পর্যবেক্ষণ', 'Transaction monitoring')} subtitle={tr('কোনো টাকা প্ল্যাটফর্মের মাধ্যমে যায় না; এখানে শুধু লেনদেনের রেকর্ড', 'No money passes through the platform; these are trade records')} />
      {meta && meta.summary && (
        <div className="chip-list">
          {meta.summary.map((s) => <span key={s.status} className="chip">{label('tradeStatus', s.status, lang)}: {num(s.total, lang)} · {money(s.value, lang)}</span>)}
        </div>
      )}
      <Tabs active={status} onChange={(s) => (setParams(s ? { status: s } : {}), setPage(1))} tabs={[{ key: '', label: tr('সব', 'All') }, ...options('tradeStatus', lang).map((o) => ({ key: o.value, label: o.label }))]} />
      <Card padded={false}>
        {loading ? <Loader /> : error ? <div className="card-pad"><ErrorBox error={error} onRetry={reload} /></div> : data.length === 0 ? <EmptyState icon="🤝" title={tr('কোনো লেনদেন নেই', 'No transactions')} /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>#</th><th>{tr('ফসল', 'Crop')}</th><th>{tr('কৃষক', 'Farmer')}</th><th>{tr('ক্রেতা', 'Buyer')}</th><th>{tr('মোট', 'Total')}</th><th>{tr('অবস্থা', 'Status')}</th><th>{tr('হালনাগাদ', 'Updated')}</th><th /></tr></thead>
              <tbody>
                {data.map((t) => (
                  <tr key={t.id}>
                    <td><Link to={`/trades/${t.id}`}>{t.id}</Link></td>
                    <td>{pick(t, 'crop', lang)}<br /><small className="muted">{num(t.quantity, lang)} {label('unit', t.unit, lang)}</small></td>
                    <td>{t.farmer_name}</td>
                    <td>{t.buyer_name}</td>
                    <td className="nowrap">{money(t.total_amount, lang)}{t.payment_method && <><br /><small className="muted">{label('paymentMethod', t.payment_method, lang)}</small></>}</td>
                    <td><StatusBadge group="tradeStatus" value={t.status} /></td>
                    <td className="nowrap">{date(t.updated_at, lang)}</td>
                    <td className="actions">
                      <Link to={`/trades/${t.id}`} className="btn btn-sm btn-outline">{tr('দেখুন', 'View')}</Link>
                      {t.status === 'disputed' && (
                        <>
                          <ConfirmButton className="btn btn-sm btn-primary" danger={false} title={tr('সম্পন্ন ঘোষণা', 'Mark completed')} message={tr('দুই পক্ষের কথা শুনে লেনদেনটি সম্পন্ন ঘোষণা করবেন?', 'After hearing both sides, mark this trade completed?')} reasonLabel={tr('সিদ্ধান্তের কারণ', 'Reason for the decision')} onConfirm={(r) => resolve(t.id, 'completed', r)}>{tr('সম্পন্ন', 'Complete')}</ConfirmButton>
                          <ConfirmButton className="btn btn-sm btn-danger-outline" title={tr('বাতিল ঘোষণা', 'Cancel trade')} message={tr('লেনদেনটি বাতিল করবেন? ফসলের পরিমাণ বিজ্ঞাপনে ফিরে যাবে।', 'Cancel this trade? The quantity returns to the listing.')} reasonLabel={tr('সিদ্ধান্তের কারণ', 'Reason for the decision')} onConfirm={(r) => resolve(t.id, 'cancelled', r)}>{tr('বাতিল', 'Cancel')}</ConfirmButton>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Pagination meta={meta} onPage={setPage} />
    </div>
  )
}
