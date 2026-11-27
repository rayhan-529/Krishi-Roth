/** One trade: progress steps, the next action for this user, history, contacts and review. */
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useNotifications } from '../../context/NotificationContext'
import { useFetch, useForm } from '../../hooks/useFetch'
import { get, patch } from '../../services/api'
import { label, options } from '../../utils/labels'
import { date, dateTime, money, num, pick } from '../../utils/format'
import ReviewModal from '../../components/ReviewModal'
import { Alert, Avatar, Card, ConfirmButton, ErrorBox, Input, Loader, PageHeader, Select, Stars, StatusBadge, SubmitButton, VerifiedBadge } from '../../components/ui'
import Icon from '../../components/Icon'
import CardSoon from '../../components/CardSoon'

// The map library is large, so it loads only on this page.
const DeliveryMap = lazy(() => import('../../components/DeliveryMap'))

const STEPS = ['payment_pending', 'payment_confirmed', 'delivery_pending', 'completed']

function Progress({ status }) {
  const { lang } = useLang()
  const current = STEPS.indexOf(status)
  return (
    <ol className="progress-steps">
      {[{ key: 'accepted', done: true }, ...STEPS.map((s, i) => ({ key: s, done: current >= i && current !== -1 }))].map((step) => (
        <li key={step.key} className={step.done ? 'done' : ''}>
          <span>{step.done ? '✓' : ''}</span>
          {step.key === 'accepted' ? label('offerStatus', 'accepted', lang) : label('tradeStatus', step.key, lang)}
        </li>
      ))}
    </ol>
  )
}

/** Where the money is right now, in one glance. */
function SafeTradeBox({ trade: t, isBuyer, isFarmer }) {
  const { lang, tr } = useLang()
  const amount = money(t.escrow_amount || t.total_amount, lang)
  let text
  if (t.escrow_status === 'held') {
    text = isFarmer
      ? tr(`ক্রেতার ${amount} কৃষি রথে নিরাপদে জমা আছে। ক্রেতা ফসল পেয়েছেন নিশ্চিত করলে টাকা আপনার ওয়ালেটে আসবে।`, `The buyer's ${amount} is held safely by Krishi Roth. It reaches your wallet when the buyer confirms receipt.`)
      : tr(`আপনার ${amount} কৃষি রথে নিরাপদে জমা আছে। ফসল হাতে পেয়ে নিশ্চিত করলে তবেই কৃষক টাকা পাবেন।`, `Your ${amount} is held safely by Krishi Roth. The farmer is paid only after you confirm receipt.`)
  } else if (t.escrow_status === 'released') {
    text = tr(`${amount} কৃষকের ওয়ালেটে দেওয়া হয়েছে।`, `${amount} was paid to the farmer's wallet.`)
  } else if (t.escrow_status === 'refunded') {
    text = tr(`${amount} ক্রেতার ওয়ালেটে ফেরত দেওয়া হয়েছে।`, `${amount} was refunded to the buyer's wallet.`)
  } else if (t.status === 'payment_pending') {
    text = isBuyer
      ? tr('ওয়ালেট থেকে টাকা দিন। টাকা কৃষি রথে জমা থাকবে, ফসল পেলে তবেই কৃষক পাবেন।', 'Pay from your wallet. Krishi Roth holds the money and pays the farmer only after you receive the crop.')
      : tr('ক্রেতার টাকা জমা দেওয়ার অপেক্ষায়।', 'Waiting for the buyer to pay into Safe Trade.')
  } else {
    return null // older trade paid outside Krishi Roth
  }
  return (
    <div className={`safe-trade-box escrow-${t.escrow_status}`}>
      <span className="safe-trade-icon"><Icon name="shield" size={22} /></span>
      <div>
        <strong>{tr('সেফ ট্রেড', 'Safe Trade')} · {label('escrowStatus', t.escrow_status, lang)}</strong>
        <p>{text}</p>
      </div>
    </div>
  )
}

/** Buyer's payment step: shows the wallet balance and pays the trade into escrow. */
function PayFromWallet({ trade: t, busy, onPay }) {
  const { lang, tr } = useLang()
  const { data, loading } = useFetch(() => get('/wallet'), [])
  if (loading || !data) return <Loader inline />
  const available = data.wallet.available
  const total = Number(t.total_amount)
  const enough = available >= total
  return (
    <div className="pay-wallet">
      <div className="pay-wallet-row">
        <span>{tr('দিতে হবে', 'To pay')}</span><strong>{money(total, lang)}</strong>
      </div>
      <div className="pay-wallet-row">
        <span>{tr('ওয়ালেটে আছে', 'Wallet balance')}</span><strong className={enough ? 'text-green' : 'text-red'}>{money(available, lang)}</strong>
      </div>
      {enough ? (
        <ConfirmButton
          className="btn btn-primary btn-block"
          danger={false}
          disabled={busy}
          title={tr('সেফ ট্রেডে টাকা দিন', 'Pay into Safe Trade')}
          message={tr(`${money(total, lang)} আপনার ওয়ালেট থেকে কেটে কৃষি রথে জমা থাকবে। ফসল পেয়ে নিশ্চিত করলে কৃষক পাবেন।`, `${money(total, lang)} will be taken from your wallet and held by Krishi Roth. The farmer gets it after you confirm receipt.`)}
          confirmText={tr('হ্যাঁ, টাকা দিন', 'Yes, pay')}
          onConfirm={onPay}
        >
          <Icon name="shield" size={18} /> {tr(`${money(total, lang)} সেফ ট্রেডে দিন`, `Pay ${money(total, lang)} with Safe Trade`)}
        </ConfirmButton>
      ) : (
        <>
          <Alert tone="warning">{tr(`আরও ${money(total - available, lang)} দরকার।`, `You need ${money(total - available, lang)} more.`)}</Alert>
          <Link to="/wallet" className="btn btn-primary btn-block"><Icon name="plus" size={18} /> {tr('ব্যালেন্স যোগ করুন', 'Add balance')}</Link>
        </>
      )}
      <CardSoon />
    </div>
  )
}

export default function TradeDetails() {
  const { id } = useParams()
  const { user } = useAuth()
  const { lang, tr } = useLang()
  const toast = useToast()
  const { data: t, loading, error, reload, setData } = useFetch(() => get(`/trades/${id}`), [id])
  const [busy, setBusy] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const ship = useForm({ delivery_method: 'farmer_delivery', delivery_address: '', expected_delivery_date: '' })
  const live = useNotifications()
  const quietReload = useCallback(() => reload(), [reload])

  // The other person acted on this trade (paid, started delivery, ...): refresh without a page reload.
  useEffect(
    () => live.onNew((n) => n.entity_type === 'trade' && String(n.entity_id) === String(id) && reload()),
    [live, id, reload],
  )

  async function act(action, extra = {}) {
    setBusy(true)
    try {
      const body = await patch(`/trades/${id}`, { action, ...extra })
      toast.success(body.message)
      setData({ ...body.data, reviews: t.reviews, can_review: body.data.status === 'completed' })
      reload()
    } catch (err) {
      toast.error(err.message)
      throw err
    } finally {
      setBusy(false)
    }
  }

  if (loading && !t) return <Loader />
  if (error) return <div className="page"><ErrorBox error={error} onRetry={reload} /></div>

  const isBuyer = user.id === t.buyer_id
  const isFarmer = user.id === t.farmer_id
  const other = isBuyer
    ? { id: t.farmer_id, name: t.farmer_name, photo: t.farmer_photo, verification: t.farmer_verification, phone: t.farmer_phone, email: t.farmer_email, role: tr('কৃষক', 'Farmer') }
    : { id: t.buyer_id, name: t.buyer_name, photo: t.buyer_photo, verification: t.buyer_verification, phone: t.buyer_phone, email: t.buyer_email, role: tr('ক্রেতা', 'Buyer') }

  return (
    <div className="page">
      <PageHeader back={user.role === 'admin' ? '/admin/trades' : '/trades'} title={`${tr('লেনদেন', 'Trade')} #${num(t.id, lang, 0)}: ${pick(t, 'crop', lang)}`} subtitle={<StatusBadge group="tradeStatus" value={t.status} />} />
      <SafeTradeBox trade={t} isBuyer={isBuyer} isFarmer={isFarmer} />
      {!['cancelled', 'disputed'].includes(t.status) && <Progress status={t.status} />}

      <div className="two-col">
        <div>
          <Card title={tr('পরবর্তী ধাপ', 'Next step')}>
            {t.status === 'payment_pending' && isBuyer && <PayFromWallet trade={t} busy={busy} onPay={() => act('pay_escrow')} />}
            {t.status === 'payment_pending' && isFarmer && (
              <p className="muted">{tr('ক্রেতা সেফ ট্রেডে টাকা জমা দিলে আপনাকে জানানো হবে। টাকা জমা হওয়ার আগে ফসল পাঠাবেন না।', 'You will be notified when the buyer pays into Safe Trade. Do not send the crop before that.')}</p>
            )}
            {t.status === 'payment_confirmed' && isFarmer && (
              <form className="form" onSubmit={(e) => { e.preventDefault(); act('start_delivery', ship.values).catch(() => {}) }}>
                <p>{tr('ফসল পাঠানোর তথ্য দিন।', 'Enter the delivery details.')}</p>
                <div className="grid-2">
                  <Select label={tr('গাড়ির ব্যবস্থা কে করবেন', 'Who brings the vehicle')} options={options('deliveryMethod', lang)} {...ship.bind('delivery_method')} />
                  <Input type="date" label={tr('সম্ভাব্য তারিখ', 'Expected date')} {...ship.bind('expected_delivery_date')} />
                </div>
                <Input label={tr('ডেলিভারির ঠিকানা', 'Delivery address')} maxLength={255} {...ship.bind('delivery_address')} />
                <p className="small muted">
                  {ship.values.delivery_method === 'buyer_pickup'
                    ? tr('ক্রেতা গাড়ি নিয়ে আসবেন। রওনা হলে ক্রেতার লাইভ লোকেশন আপনি ম্যাপে দেখবেন।', 'The buyer brings the vehicle. You will see the buyer\'s live location on the map.')
                    : tr('আপনি (বা আপনার ভাড়া করা গাড়ি) ফসল পৌঁছে দেবেন। রওনা হয়ে ম্যাপ থেকে লাইভ লোকেশন চালু করবেন, ক্রেতা দেখতে পাবেন।', 'You (or a vehicle you hire) deliver the crop. Turn on live location from the map when you leave so the buyer can follow.')}
                </p>
                <SubmitButton busy={busy}>{tr('ফসল পাঠানো শুরু', 'Start delivery')}</SubmitButton>
                {ship.values.delivery_method === 'transport_service' && <p className="small"><Link to="/services/transport">{tr('পরিবহন বুক করুন', 'Book transport')} →</Link></p>}
              </form>
            )}
            {t.status === 'payment_confirmed' && isBuyer && <p className="muted">{tr('কৃষক ফসল পাঠানোর প্রস্তুতি নিচ্ছেন।', 'The farmer is preparing the delivery.')}</p>}
            {t.status === 'delivery_pending' && isBuyer && (
              <ConfirmButton className="btn btn-primary" danger={false} message={tr(`আপনি কি ফসল ঠিকঠাক পেয়েছেন? নিশ্চিত করলে সেফ ট্রেডের ${money(t.escrow_amount || t.total_amount, lang)} কৃষককে দেওয়া হবে। এটা আর ফেরানো যাবে না।`, `Did you receive the crop in good order? Confirming pays ${money(t.escrow_amount || t.total_amount, lang)} from Safe Trade to the farmer. This cannot be undone.`)} onConfirm={() => act('confirm_receipt')}>
                {tr('ফসল পেয়েছি, টাকা ছেড়ে দিন', 'I received the crop, release payment')}
              </ConfirmButton>
            )}
            {t.status === 'delivery_pending' && isBuyer && t.auto_release_at && (
              <p className="small muted mt">{tr(`সমস্যা থাকলে ${dateTime(t.auto_release_at, lang)}-এর আগে অভিযোগ করুন। তা না হলে টাকা স্বয়ংক্রিয়ভাবে কৃষকের কাছে যাবে।`, `If something is wrong, report it before ${dateTime(t.auto_release_at, lang)}. Otherwise the money is released to the farmer automatically.`)}</p>
            )}
            {t.status === 'delivery_pending' && isFarmer && <p className="muted">{tr('ক্রেতার প্রাপ্তি নিশ্চিতকরণের অপেক্ষায়।', 'Waiting for the buyer to confirm receipt.')}</p>}
            {t.status === 'completed' && (
              <>
                <Alert tone="success">{tr('লেনদেন সম্পন্ন হয়েছে।', 'This trade is complete.')}</Alert>
                {t.can_review && <button type="button" className="btn btn-primary" onClick={() => setReviewing(true)}><Icon name="star" size={16} /> {tr(`${other.name}-কে রেটিং দিন`, `Rate ${other.name}`)}</button>}
              </>
            )}
            {t.status === 'cancelled' && <Alert tone="warning">{tr('লেনদেনটি বাতিল হয়েছে', 'This trade was cancelled')}: {t.cancel_reason}</Alert>}
            {t.status === 'disputed' && <Alert tone="warning">{tr('এই লেনদেনে অভিযোগ চলছে। অ্যাডমিন সিদ্ধান্ত দেবেন।', 'This trade is under dispute. An administrator will decide.')}</Alert>}

            {(isBuyer || isFarmer) && (
              <div className="form-actions start">
                {(t.status === 'payment_pending' || (t.status === 'payment_confirmed' && isFarmer)) && (
                  <ConfirmButton className="btn btn-sm btn-danger-outline" title={tr('লেনদেন বাতিল', 'Cancel trade')} message={t.escrow_status === 'held' ? tr('লেনদেন বাতিল করবেন? ক্রেতার জমা দেওয়া টাকা তাঁর ওয়ালেটে ফেরত যাবে।', "Cancel this trade? The buyer's money goes back to their wallet.") : tr('লেনদেন বাতিল করবেন? ফসলের পরিমাণ আবার বিজ্ঞাপনে ফিরে যাবে।', 'Cancel this trade? The quantity goes back to the listing.')} reasonLabel={tr('কারণ', 'Reason')} onConfirm={(reason) => act('cancel', { reason })}>
                    {tr('লেনদেন বাতিল', 'Cancel trade')}
                  </ConfirmButton>
                )}
                {['payment_pending', 'payment_confirmed', 'delivery_pending'].includes(t.status) && (
                  <ConfirmButton className="btn btn-sm btn-outline" title={tr('অভিযোগ করুন', 'Open a dispute')} message={tr('সমস্যা হলে অভিযোগ করুন। অ্যাডমিন দুই পক্ষের কথা শুনে সিদ্ধান্ত দেবেন।', 'If there is a problem, open a dispute. An administrator will decide.')} reasonLabel={tr('কী সমস্যা হয়েছে', 'What went wrong')} onConfirm={(reason) => act('dispute', { reason })}>
                    {tr('অভিযোগ করুন', 'Report a problem')}
                  </ConfirmButton>
                )}
              </div>
            )}
          </Card>

          {t.status !== 'cancelled' && (
            <Suspense fallback={<Card title={tr('ম্যাপ ও ডেলিভারি', 'Map & delivery')}><Loader inline /></Card>}>
              <DeliveryMap trade={t} userId={user.id} onStatusChange={quietReload} />
            </Suspense>
          )}

          <Card title={tr('ইতিহাস', 'History')}>
            <ul className="timeline">
              {t.history.map((h) => (
                <li key={h.id}>
                  <strong>{label('tradeStatus', h.to_status, lang)}</strong>
                  <small>{dateTime(h.created_at, lang)} · {h.changed_by_name}</small>
                  {h.note && <p>{h.note}</p>}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div>
          <Card title={tr('লেনদেনের বিবরণ', 'Trade details')}>
            <dl className="details">
              <dt>{tr('ফসল', 'Crop')}</dt><dd><Link to={`/listings/${t.listing_id}`}>{pick(t, 'crop', lang)}</Link> {t.variety && `(${t.variety})`}</dd>
              <dt>{tr('পরিমাণ', 'Quantity')}</dt><dd>{num(t.quantity, lang)} {label('unit', t.unit, lang)}</dd>
              <dt>{tr('দর', 'Rate')}</dt><dd>{money(t.price_per_unit, lang)}/{label('unit', t.unit, lang)}</dd>
              <dt>{tr('মোট', 'Total')}</dt><dd><strong className="big-price">{money(t.total_amount, lang)}</strong></dd>
              <dt>{tr('ফসলের এলাকা', 'Crop location')}</dt><dd>{t.upazila ? `${t.upazila}, ` : ''}{pick(t, 'district', lang)}</dd>
              {t.payment_method && <><dt>{tr('মূল্য পরিশোধ', 'Payment')}</dt><dd>{label('paymentMethod', t.payment_method, lang)} {t.payment_reference && `(${t.payment_reference})`}</dd></>}
              {t.delivery_method && <><dt>{tr('ডেলিভারি', 'Delivery')}</dt><dd>{label('deliveryMethod', t.delivery_method, lang)} {t.expected_delivery_date && `· ${date(t.expected_delivery_date, lang)}`}</dd></>}
              {t.delivery_address && <><dt>{tr('ঠিকানা', 'Address')}</dt><dd>{t.delivery_address}</dd></>}
              <dt>{tr('শুরু', 'Started')}</dt><dd>{dateTime(t.created_at, lang)}</dd>
            </dl>
          </Card>
          {user.role !== 'admin' && (
            <Card title={other.role}>
              <Link to={`/users/${other.id}`} className="person">
                <Avatar src={other.photo} name={other.name} size={48} />
                <span><strong>{other.name}</strong> <VerifiedBadge status={other.verification} /></span>
              </Link>
              <p className="mt"><Icon name="phone" size={15} /> <a href={`tel:${other.phone}`}>{other.phone || '—'}</a>{other.email && <><br /><Icon name="mail" size={15} /> {other.email}</>}</p>
            </Card>
          )}
          {t.reviews.length > 0 && (
            <Card title={tr('রিভিউ', 'Reviews')}>
              {t.reviews.map((r) => (
                <div key={r.reviewer_id} className="review">
                  <Stars value={r.rating} /> <small className="muted">{r.reviewer_id === user.id ? tr('আপনার রিভিউ', 'Your review') : other.name}</small>
                  {r.comment && <p>{r.comment}</p>}
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
      {reviewing && <ReviewModal tradeId={t.id} otherName={other.name} onClose={() => setReviewing(false)} onDone={reload} />}
    </div>
  )
}
