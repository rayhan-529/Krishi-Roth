/** Purchase offers: farmers see offers received, buyers see offers sent. */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useFetch } from '../../hooks/useFetch'
import { get, patch } from '../../services/api'
import { label, options } from '../../utils/labels'
import { money, num, pick, timeAgo } from '../../utils/format'
import { ConfirmButton, EmptyState, ErrorBox, Loader, PageHeader, Pagination, StatusBadge, Tabs, VerifiedBadge } from '../../components/ui'

export default function Offers() {
  const { user } = useAuth()
  const { lang, tr } = useLang()
  const toast = useToast()
  const isFarmer = user.role === 'farmer'
  const [status, setStatus] = useState('pending')
  const [page, setPage] = useState(1)
  const { data, meta, loading, error, reload } = useFetch(() => get('/offers', { status, page }), [status, page])

  async function act(offer, action, note) {
    const body = await patch(`/offers/${offer.id}/${action}`, note ? { farmer_note: note } : {})
    toast.success(body.message)
    reload()
  }

  return (
    <div className="page">
      <PageHeader
        title={isFarmer ? tr('ক্রয় প্রস্তাব', 'Purchase offers') : tr('আমার প্রস্তাব', 'My offers')}
      />
      <Tabs active={status} onChange={(s) => (setStatus(s), setPage(1))} tabs={[...options('offerStatus', lang).map((o) => ({ key: o.value, label: o.label })), { key: '', label: tr('সব', 'All') }]} />
      {loading ? <Loader /> : error ? <ErrorBox error={error} onRetry={reload} /> : data.length === 0 ? (
        <EmptyState icon="📩" title={tr('কোনো প্রস্তাব নেই', 'No offers')} action={!isFarmer && <Link to="/marketplace" className="btn btn-primary">{tr('ফসল খুঁজুন', 'Browse crops')}</Link>} />
      ) : (
        <div className="manage-list">
          {data.map((o) => {
            const diff = Number(o.offered_price_per_unit) - Number(o.listing_price)
            return (
              <article key={o.id} className="manage-item">
                <div className="manage-body">
                  <h3>
                    <Link to={`/listings/${o.listing_id}`}>{pick(o, 'crop', lang)}</Link> {o.variety && <small className="muted">({o.variety})</small>} <StatusBadge group="offerStatus" value={o.status} />
                  </h3>
                  <p>
                    <strong>{num(o.quantity, lang)} {label('unit', o.unit, lang)}</strong> × {money(o.offered_price_per_unit, lang)} = <strong>{money(o.total_amount, lang)}</strong>{' '}
                    {diff !== 0 && <small className={diff < 0 ? 'text-red' : 'text-green'}>({tr('বিজ্ঞাপনের দাম', 'listed')} {money(o.listing_price, lang)})</small>}
                  </p>
                  <p className="muted small">
                    {isFarmer ? <>{tr('ক্রেতা', 'Buyer')}: <Link to={`/users/${o.buyer_id}`}>{o.buyer_name}</Link> <VerifiedBadge status={o.buyer_verification} /></> : <>{tr('কৃষক', 'Farmer')}: <Link to={`/users/${o.farmer_id}`}>{o.farmer_name}</Link> <VerifiedBadge status={o.farmer_verification} /></>}
                    {' · '}{timeAgo(o.created_at, lang)}
                  </p>
                  {o.message && <p className="quote">“{o.message}”</p>}
                  {o.farmer_note && <p className="quote">{tr('কৃষকের উত্তর', "Farmer's note")}: {o.farmer_note}</p>}
                </div>
                <div className="manage-actions">
                  {o.trade_id && <Link to={`/trades/${o.trade_id}`} className="btn btn-sm btn-primary">{tr('লেনদেন দেখুন', 'Open trade')}</Link>}
                  {isFarmer && o.status === 'pending' && (
                    <>
                      <ConfirmButton className="btn btn-sm btn-primary" danger={false} title={tr('প্রস্তাব গ্রহণ', 'Accept offer')} message={tr(`${num(o.quantity, lang)} ${label('unit', o.unit, lang)} ${money(o.total_amount, lang)}-এ বিক্রি করতে রাজি? গ্রহণ করলে লেনদেন শুরু হবে।`, `Sell ${num(o.quantity, lang)} ${label('unit', o.unit, lang)} for ${money(o.total_amount, lang)}? Accepting starts the trade.`)} onConfirm={() => act(o, 'accept')}>
                        {tr('গ্রহণ করুন', 'Accept')}
                      </ConfirmButton>
                      <ConfirmButton className="btn btn-sm btn-danger-outline" title={tr('প্রস্তাব বাতিল', 'Reject offer')} message={tr('এই প্রস্তাবটি বাতিল করবেন?', 'Reject this offer?')} reasonLabel={tr('ক্রেতাকে কারণ জানান', 'Tell the buyer why')} onConfirm={(reason) => act(o, 'reject', reason)}>
                        {tr('বাতিল', 'Reject')}
                      </ConfirmButton>
                    </>
                  )}
                  {!isFarmer && o.status === 'pending' && (
                    <ConfirmButton className="btn btn-sm btn-outline" message={tr('প্রস্তাবটি প্রত্যাহার করবেন?', 'Withdraw this offer?')} onConfirm={() => act(o, 'withdraw')}>
                      {tr('প্রত্যাহার', 'Withdraw')}
                    </ConfirmButton>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
      <Pagination meta={meta} onPage={setPage} />
    </div>
  )
}
