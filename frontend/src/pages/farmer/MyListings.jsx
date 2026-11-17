import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLang } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useFetch } from '../../hooks/useFetch'
import { del, get, mediaUrl, patch } from '../../services/api'
import { label } from '../../utils/labels'
import { date, money, num, pick } from '../../utils/format'
import Icon from '../../components/Icon'
import { Badge, ConfirmButton, EmptyState, ErrorBox, Loader, PageHeader, Pagination, StatusBadge, Tabs } from '../../components/ui'

export default function MyListings() {
  const { lang, tr } = useLang()
  const toast = useToast()
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const { data, meta, loading, error, reload } = useFetch(() => get('/listings/mine', { status, page }), [status, page])

  async function changeStatus(listing, next) {
    try {
      const body = await patch(`/listings/${listing.id}/status`, { status: next })
      toast.success(body.message)
      reload()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="page">
      <PageHeader
        title={tr('আমার ফসলের বিজ্ঞাপন', 'My crop listings')}
        actions={<Link to="/farmer/listings/new" className="btn btn-primary"><Icon name="plus" size={18} /> {tr('নতুন বিজ্ঞাপন', 'New listing')}</Link>}
      />
      <Tabs
        active={status}
        onChange={(s) => (setStatus(s), setPage(1))}
        tabs={[
          { key: '', label: tr('সব', 'All') },
          { key: 'active', label: label('listingStatus', 'active', lang) },
          { key: 'reserved', label: label('listingStatus', 'reserved', lang) },
          { key: 'sold', label: label('listingStatus', 'sold', lang) },
          { key: 'expired', label: label('listingStatus', 'expired', lang) },
        ]}
      />
      {loading ? (
        <Loader />
      ) : error ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : data.length === 0 ? (
        <EmptyState
          title={tr('কোনো বিজ্ঞাপন নেই', 'No listings')}
          text={tr('আপনার ফসলের প্রথম বিজ্ঞাপন দিন, ক্রেতারা সরাসরি প্রস্তাব পাঠাবেন।', 'Post your first crop and buyers will send offers directly.')}
          action={<Link to="/farmer/listings/new" className="btn btn-primary">{tr('বিজ্ঞাপন দিন', 'Create listing')}</Link>}
        />
      ) : (
        <div className="manage-list">
          {data.map((l) => (
            <article key={l.id} className="manage-item">
              <div className="manage-thumb">{l.cover_image ? <img src={mediaUrl(l.cover_image)} alt="" /> : <Icon name="wheat" size={26} />}</div>
              <div className="manage-body">
                <h3>
                  <Link to={`/listings/${l.id}`}>{pick(l, 'crop', lang)}</Link> {l.variety && <small className="muted">({l.variety})</small>}{' '}
                  <StatusBadge group="listingStatus" value={l.status} />
                  {l.pending_offers > 0 && <Badge tone="amber">{tr(`${num(l.pending_offers, lang)}টি নতুন প্রস্তাব`, `${num(l.pending_offers, lang)} new offers`)}</Badge>}
                </h3>
                <p className="muted small">
                  {money(l.price_per_unit, lang)}/{label('unit', l.unit, lang)} · {tr('বাকি', 'Left')}: {num(l.quantity_available, lang)}/{num(l.quantity, lang)} {label('unit', l.unit, lang)} · {pick(l, 'district', lang)} · {date(l.created_at, lang)}
                </p>
              </div>
              <div className="manage-actions">
                {['active', 'reserved', 'expired'].includes(l.status) && (
                  <Link to={`/farmer/listings/${l.id}/edit`} className="btn btn-sm btn-outline"><Icon name="edit" size={15} /> {tr('সম্পাদনা', 'Edit')}</Link>
                )}
                {l.status === 'active' && (
                  <ConfirmButton className="btn btn-sm btn-outline" danger={false} message={tr('ফসলটি বিক্রি হয়েছে হিসেবে চিহ্নিত করবেন? অপেক্ষমাণ প্রস্তাবগুলো বন্ধ হয়ে যাবে।', 'Mark this crop as sold? Pending offers will be closed.')} onConfirm={() => changeStatus(l, 'sold')}>
                    <Icon name="check" size={15} /> {tr('বিক্রি হয়েছে', 'Mark sold')}
                  </ConfirmButton>
                )}
                {l.status === 'expired' && Number(l.quantity_available) > 0 && (
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => changeStatus(l, 'active')}>{tr('আবার চালু', 'Re-open')}</button>
                )}
                <ConfirmButton
                  className="btn btn-sm btn-danger-outline"
                  message={tr('বিজ্ঞাপনটি মুছে ফেলবেন? এটি আর বাজারে দেখা যাবে না।', 'Delete this listing? It will no longer appear in the marketplace.')}
                  onConfirm={async () => {
                    const body = await del(`/listings/${l.id}`)
                    toast.success(body.message)
                    reload()
                  }}
                >
                  <Icon name="trash" size={15} />
                </ConfirmButton>
              </div>
            </article>
          ))}
        </div>
      )}
      <Pagination meta={meta} onPage={setPage} />
    </div>
  )
}
