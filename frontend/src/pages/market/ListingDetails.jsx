/** One crop listing: photos, seller, recent market prices, offer form and contact. */
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useFetch, useForm } from '../../hooks/useFetch'
import { get, mediaUrl, patch, post } from '../../services/api'
import { label } from '../../utils/labels'
import { date, money, num, pick } from '../../utils/format'
import Icon from '../../components/Icon'
import { Alert, Avatar, Card, ErrorBox, Input, Loader, Modal, PageHeader, PriceSourceNote, Stars, StatusBadge, SubmitButton, TextArea, VerifiedBadge } from '../../components/ui'

function OfferForm({ listing, onDone }) {
  const { lang, tr } = useLang()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const { values, bind, setErrors } = useForm({
    quantity: listing.min_order_quantity || '',
    offered_price_per_unit: listing.price_per_unit,
    message: '',
  })
  const total = Number(values.quantity || 0) * Number(values.offered_price_per_unit || 0)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const body = await post(`/listings/${listing.id}/offers`, values)
      toast.success(body.message)
      onDone()
    } catch (err) {
      setErrors(err.errors)
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="form" noValidate>
      <div className="grid-2">
        <Input
          type="number" min="0" step="0.01" required
          label={`${tr('পরিমাণ', 'Quantity')} (${label('unit', listing.unit, lang)})`}
          hint={`${tr('সর্বোচ্চ', 'Max')}: ${num(listing.quantity_available, lang)}${listing.min_order_quantity ? ` · ${tr('সর্বনিম্ন', 'Min')}: ${num(listing.min_order_quantity, lang)}` : ''}`}
          {...bind('quantity')}
        />
        <Input
          type="number" min="0" step="0.01" required
          label={`${tr('প্রস্তাবিত দাম', 'Your price')} (৳/${label('unit', listing.unit, lang)})`}
          disabled={!listing.is_negotiable}
          hint={listing.is_negotiable ? tr('দাম আলোচনাযোগ্য', 'Price is negotiable') : tr('নির্ধারিত দাম', 'Fixed price')}
          {...bind('offered_price_per_unit')}
        />
      </div>
      <TextArea label={tr('কৃষকের জন্য বার্তা (ঐচ্ছিক)', 'Message to the farmer (optional)')} rows={3} maxLength={1000} {...bind('message')} />
      <p className="price-line">{tr('মোট', 'Total')}: <strong>{money(total, lang)}</strong></p>
      <SubmitButton busy={busy} className="btn btn-primary btn-block">{tr('প্রস্তাব পাঠান', 'Send offer')}</SubmitButton>
    </form>
  )
}

function ContactForm({ listing, onClose }) {
  const { tr } = useLang()
  const toast = useToast()
  const navigate = useNavigate()
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const res = await post('/conversations', { listing_id: listing.id, body })
      toast.success(res.message)
      navigate(`/messages/${res.data.conversation_id}`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open title={tr('কৃষককে বার্তা পাঠান', 'Message the farmer')} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <TextArea label={tr('আপনার বার্তা', 'Your message')} value={body} onChange={(e) => setBody(e.target.value)} required maxLength={2000} placeholder={tr('যেমন: ফসল কবে নেওয়া যাবে?', 'e.g. When can I collect the crop?')} />
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{tr('বাতিল', 'Cancel')}</button>
          <SubmitButton busy={busy}>{tr('পাঠান', 'Send')}</SubmitButton>
        </div>
      </form>
    </Modal>
  )
}

export default function ListingDetails() {
  const { id } = useParams()
  const { lang, tr } = useLang()
  const { user } = useAuth()
  const toast = useToast()
  const { data: l, loading, error, reload } = useFetch(() => get(`/listings/${id}`), [id])
  const [photo, setPhoto] = useState(0)
  const [contact, setContact] = useState(false)

  if (loading) return <Loader />
  if (error) return <div className="page"><ErrorBox error={error} onRetry={reload} /></div>

  const isOwner = user && user.id === l.farmer_id
  const isBuyer = user && user.role === 'buyer'
  const pendingOffer = l.my_offers && l.my_offers.find((o) => o.status === 'pending')
  const images = l.images || []

  return (
    <div className="page">
      <PageHeader
        back="/marketplace"
        title={<>{pick(l, 'crop', lang)} {l.variety && <small className="muted">({l.variety})</small>}</>}
        subtitle={`${pick(l, 'category', lang)} · ${l.upazila ? `${l.upazila}, ` : ''}${pick(l, 'district', lang)}`}
        actions={isOwner && <Link to={`/farmer/listings/${l.id}/edit`} className="btn btn-outline"><Icon name="edit" size={16} /> {tr('সম্পাদনা', 'Edit')}</Link>}
      />
      <div className="two-col">
        <div>
          <Card padded={false}>
            <div className="gallery">
              {images.length ? <img src={mediaUrl(images[photo].image_path)} alt={pick(l, 'crop', lang)} /> : <div className="gallery-empty">🌾</div>}
            </div>
            {images.length > 1 && (
              <div className="thumbs">
                {images.map((img, i) => (
                  <button type="button" key={img.id} className={i === photo ? 'active' : ''} onClick={() => setPhoto(i)}>
                    <img src={mediaUrl(img.image_path)} alt="" />
                  </button>
                ))}
              </div>
            )}
          </Card>
          <Card title={tr('বিস্তারিত', 'Details')}>
            <dl className="details">
              <dt>{tr('দাম', 'Price')}</dt><dd><strong className="big-price">{money(l.price_per_unit, lang)}</strong> / {label('unit', l.unit, lang)} {l.is_negotiable ? `(${tr('আলোচনাযোগ্য', 'negotiable')})` : ''}</dd>
              <dt>{tr('বিক্রির জন্য আছে', 'Available')}</dt><dd>{num(l.quantity_available, lang)} / {num(l.quantity, lang)} {label('unit', l.unit, lang)}</dd>
              {l.min_order_quantity && <><dt>{tr('সর্বনিম্ন অর্ডার', 'Minimum order')}</dt><dd>{num(l.min_order_quantity, lang)} {label('unit', l.unit, lang)}</dd></>}
              <dt>{tr('ফসল কাটার তারিখ', 'Harvest date')}</dt><dd>{date(l.harvest_date, lang)}</dd>
              <dt>{tr('অবস্থা', 'Status')}</dt><dd><StatusBadge group="listingStatus" value={l.status} /></dd>
            </dl>
            {l.description && <p className="pre-line">{l.description}</p>}
          </Card>
          <Card title={tr('এই ফসলের সাম্প্রতিক বাজারদর', 'Recent market prices for this crop')}>
            {l.market_prices.length === 0 ? (
              <p className="muted">{tr('এই ফসলের কোনো বাজারদর যোগ করা হয়নি।', 'No market prices added for this crop.')}</p>
            ) : (
              <ul className="price-list">
                {l.market_prices.map((p) => (
                  <li key={p.id}>
                    <div><strong>{p.market_name}</strong><small>{pick(p, 'district', lang)} · {date(p.price_date, lang)}</small></div>
                    <span>{money(p.min_price, lang)} – {money(p.max_price, lang)} <small>/{label('unit', p.unit, lang)}</small></span>
                  </li>
                ))}
              </ul>
            )}
            <PriceSourceNote />
          </Card>
        </div>

        <div>
          <Card title={tr('বিক্রেতা', 'Seller')}>
            <Link to={`/users/${l.farmer_id}`} className="person">
              <Avatar src={l.farmer_photo} name={l.farmer_name} size={52} />
              <span>
                <strong>{l.farmer_name}</strong> <VerifiedBadge status={l.farmer_verification} />
                <Stars value={l.farmer_rating} count={l.farmer_review_count} />
              </span>
            </Link>
            {isBuyer && l.status === 'active' && (
              <button type="button" className="btn btn-outline btn-block mt" onClick={() => setContact(true)}>
                <Icon name="message" size={18} /> {tr('কৃষককে বার্তা পাঠান', 'Message the farmer')}
              </button>
            )}
          </Card>

          <Card title={tr('ক্রয় প্রস্তাব', 'Purchase offer')}>
            {isOwner ? (
              <>
                <p>{tr(`এই বিজ্ঞাপনে ${num(l.pending_offers || 0, lang)}টি প্রস্তাব অপেক্ষায় আছে।`, `${num(l.pending_offers || 0, lang)} offer(s) waiting on this listing.`)}</p>
                <Link to="/offers" className="btn btn-primary btn-block">{tr('প্রস্তাবগুলো দেখুন', 'View offers')}</Link>
              </>
            ) : !user ? (
              <>
                <p>{tr('প্রস্তাব দিতে ক্রেতা হিসেবে লগইন করুন।', 'Log in as a buyer to make an offer.')}</p>
                <Link to="/login" state={{ from: `/listings/${l.id}` }} className="btn btn-primary btn-block">{tr('লগইন', 'Log in')}</Link>
              </>
            ) : !isBuyer ? (
              <Alert tone="info">{tr('শুধু ক্রেতা অ্যাকাউন্ট থেকে প্রস্তাব দেওয়া যায়।', 'Only buyer accounts can make offers.')}</Alert>
            ) : l.status !== 'active' ? (
              <Alert tone="warning">{tr('এই ফসলটি এখন বিক্রির জন্য নেই।', 'This crop is not available for sale now.')}</Alert>
            ) : pendingOffer ? (
              <>
                <Alert tone="info">
                  {tr('আপনার প্রস্তাব অপেক্ষায় আছে', 'Your offer is waiting')}: {num(pendingOffer.quantity, lang)} × {money(pendingOffer.offered_price_per_unit, lang)} = <strong>{money(pendingOffer.total_amount, lang)}</strong>
                </Alert>
                <button
                  type="button"
                  className="btn btn-outline btn-block"
                  onClick={async () => {
                    try {
                      const b = await patch(`/offers/${pendingOffer.id}/withdraw`)
                      toast.success(b.message)
                      reload()
                    } catch (err) {
                      toast.error(err.message)
                    }
                  }}
                >
                  {tr('প্রস্তাব প্রত্যাহার করুন', 'Withdraw offer')}
                </button>
              </>
            ) : (
              <OfferForm listing={l} onDone={reload} />
            )}
            {l.my_offers && l.my_offers.length > 0 && (
              <ul className="offer-history">
                {l.my_offers.map((o) => (
                  <li key={o.id}>
                    {num(o.quantity, lang)} × {money(o.offered_price_per_unit, lang)} <StatusBadge group="offerStatus" value={o.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
      {contact && <ContactForm listing={l} onClose={() => setContact(false)} />}
    </div>
  )
}
