import { useState } from 'react'
import { useLang } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useFetch } from '../../hooks/useFetch'
import { get, patch } from '../../services/api'
import { dateTime } from '../../utils/format'
import { Badge, Card, ConfirmButton, EmptyState, ErrorBox, Loader, PageHeader, Pagination, Stars, Tabs } from '../../components/ui'

export default function AdminReviews() {
  const { lang, tr } = useLang()
  const toast = useToast()
  const [tab, setTab] = useState('visible')
  const [page, setPage] = useState(1)
  const params = tab === 'hidden' ? { hidden: true } : tab === 'low' ? { hidden: false, max_rating: 2 } : { hidden: false }
  const { data, meta, loading, error, reload } = useFetch(() => get('/admin/reviews', { ...params, page }), [tab, page])

  async function run(promise) {
    const body = await promise
    toast.success(body.message)
    reload()
  }

  return (
    <div className="page">
      <PageHeader title={tr('রিভিউ মডারেশন', 'Review moderation')} />
      <Tabs active={tab} onChange={(t) => (setTab(t), setPage(1))} tabs={[{ key: 'visible', label: tr('দৃশ্যমান', 'Visible') }, { key: 'low', label: tr('কম রেটিং (1-2)', 'Low ratings (1-2)') }, { key: 'hidden', label: tr('লুকানো', 'Hidden') }]} />
      <Card>
        {loading ? <Loader /> : error ? <ErrorBox error={error} onRetry={reload} /> : data.length === 0 ? <EmptyState icon="⭐" title={tr('কোনো রিভিউ নেই', 'No reviews')} /> : (
          <ul className="review-list">
            {data.map((r) => (
              <li key={r.id}>
                <Stars value={r.rating} /> <strong>{r.reviewer_name}</strong> → <strong>{r.reviewee_name}</strong>{' '}
                <small className="muted">{r.trade_id ? `${tr('লেনদেন', 'Trade')} #${r.trade_id}` : `${tr('বুকিং', 'Booking')} #${r.booking_id}`} · {dateTime(r.created_at, lang)}</small>
                {r.comment && <p>{r.comment}</p>}
                {r.is_hidden ? (
                  <p>
                    <Badge tone="red">{tr('লুকানো', 'Hidden')}</Badge> <small>{r.hidden_reason}</small>{' '}
                    <ConfirmButton className="btn btn-sm btn-outline" danger={false} message={tr('রিভিউটি আবার দেখাবেন?', 'Show this review again?')} onConfirm={() => run(patch(`/admin/reviews/${r.id}/unhide`))}>{tr('দেখান', 'Unhide')}</ConfirmButton>
                  </p>
                ) : (
                  <ConfirmButton className="btn btn-sm btn-danger-outline" message={tr('রিভিউটি লুকাবেন?', 'Hide this review?')} reasonLabel={tr('কারণ', 'Reason')} onConfirm={(reason) => run(patch(`/admin/reviews/${r.id}/hide`, { reason }))}>{tr('লুকান', 'Hide')}</ConfirmButton>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Pagination meta={meta} onPage={setPage} />
    </div>
  )
}
