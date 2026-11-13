/** One trade: progress steps, the next action for this user, history, contacts and review. */
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useFetch, useForm } from '../../hooks/useFetch'
import { get, patch } from '../../services/api'
import { label, options } from '../../utils/labels'
import { date, dateTime, money, num, pick } from '../../utils/format'
import ReviewModal from '../../components/ReviewModal'
import { Alert, Avatar, Card, ConfirmButton, ErrorBox, Input, Loader, PageHeader, Select, Stars, StatusBadge, SubmitButton, VerifiedBadge } from '../../components/ui'

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

export default function TradeDetails() {
  const { id } = useParams()
  const { user } = useAuth()
  const { lang, tr } = useLang()
  const toast = useToast()
  const { data: t, loading, error, reload, setData } = useFetch(() => get(`/trades/${id}`), [id])
  const [busy, setBusy] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const pay = useForm({ payment_method: 'bkash', payment_reference: '' })
  const ship = useForm({ delivery_method: 'farmer_delivery', delivery_address: '', expected_delivery_date: '' })

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
      <Alert tone="info">
        {tr('কৃষি রথ নিজে কোনো টাকা লেনদেন করে না। মূল্য সরাসরি কৃষককে দিন (নগদ, বিকাশ, নগদ, রকেট বা ব্যাংক) এবং এখানে তথ্য দিন।', 'Krishi Roth does not handle money. Pay the farmer directly (cash, bKash, Nagad, Rocket or bank) and record it here.')}
      </Alert>
      {!['cancelled', 'disputed'].includes(t.status) && <Progress status={t.status} />}

      <div className="two-col">
        <div>
          <Card title={tr('পরবর্তী ধাপ', 'Next step')}>
            {t.status === 'payment_pending' && isBuyer && (
              <form
                className="form"
                onSubmit={(e) => {
                  e.preventDefault()
                  act('mark_paid', pay.values).catch(() => {})
                }}
              >
                {t.payment_marked_at && <Alert tone="success">{tr('আপনি মূল্য পরিশোধের তথ্য দিয়েছেন। কৃষকের নিশ্চিতকরণের অপেক্ষায়।', 'You reported the payment. Waiting for the farmer to confirm.')}</Alert>}
                <p>{tr('কৃষককে মূল্য পরিশোধ করে নিচে তথ্য দিন।', 'Pay the farmer, then record it below.')} <strong>{money(t.total_amount, lang)}</strong></p>
                <div className="grid-2">
                  <Select label={tr('কীভাবে দিলেন', 'Paid by')} options={options('paymentMethod', lang)} {...pay.bind('payment_method')} />
                  <Input label={tr('ট্রানজেকশন আইডি (ঐচ্ছিক)', 'Transaction ID (optional)')} maxLength={100} {...pay.bind('payment_reference')} />
                </div>
                <SubmitButton busy={busy}>{t.payment_marked_at ? tr('তথ্য হালনাগাদ করুন', 'Update payment info') : tr('মূল্য পরিশোধ করেছি', 'I have paid')}</SubmitButton>
              </form>
            )}
            {t.status === 'payment_pending' && isFarmer && (
              <>
                {t.payment_marked_at ? (
                  <Alert tone="success">
                    {tr('ক্রেতা জানিয়েছেন মূল্য পরিশোধ করেছেন', 'The buyer reported payment')}: {label('paymentMethod', t.payment_method, lang)} {t.payment_reference && `(${t.payment_reference})`}
                  </Alert>
                ) : (
                  <p className="muted">{tr('ক্রেতার মূল্য পরিশোধের অপেক্ষায়। নগদে নিলে টাকা পেয়ে নিশ্চিত করুন।', 'Waiting for the buyer to pay. If paid in cash, confirm once you receive it.')}</p>
                )}
                <ConfirmButton className="btn btn-primary" danger={false} message={tr(`আপনি কি ${money(t.total_amount, lang)} পেয়েছেন?`, `Did you receive ${money(t.total_amount, lang)}?`)} onConfirm={() => act('confirm_payment', { payment_method: t.payment_method || 'cash' })}>
                  {tr('মূল্য পেয়েছি', 'I received the payment')}
                </ConfirmButton>
              </>
            )}
            {t.status === 'payment_confirmed' && isFarmer && (
              <form className="form" onSubmit={(e) => { e.preventDefault(); act('start_delivery', ship.values).catch(() => {}) }}>
                <p>{tr('ফসল পাঠানোর তথ্য দিন।', 'Enter the delivery details.')}</p>
                <div className="grid-2">
                  <Select label={tr('ডেলিভারি পদ্ধতি', 'Delivery method')} options={options('deliveryMethod', lang)} {...ship.bind('delivery_method')} />
                  <Input type="date" label={tr('সম্ভাব্য তারিখ', 'Expected date')} {...ship.bind('expected_delivery_date')} />
                </div>
                <Input label={tr('ডেলিভারির ঠিকানা', 'Delivery address')} maxLength={255} {...ship.bind('delivery_address')} />
                <SubmitButton busy={busy}>{tr('ফসল পাঠানো শুরু', 'Start delivery')}</SubmitButton>
                {ship.values.delivery_method === 'transport_service' && <p className="small"><Link to="/services/transport">{tr('পরিবহন বুক করুন', 'Book transport')} →</Link></p>}
              </form>
            )}
            {t.status === 'payment_confirmed' && isBuyer && <p className="muted">{tr('কৃষক ফসল পাঠানোর প্রস্তুতি নিচ্ছেন।', 'The farmer is preparing the delivery.')}</p>}
            {t.status === 'delivery_pending' && isBuyer && (
              <ConfirmButton className="btn btn-primary" danger={false} message={tr('আপনি কি ফসল ঠিকঠাক পেয়েছেন? নিশ্চিত করলে লেনদেন সম্পন্ন হবে।', 'Did you receive the crop in good order? Confirming completes the trade.')} onConfirm={() => act('confirm_receipt')}>
                {tr('ফসল পেয়েছি', 'I received the crop')}
              </ConfirmButton>
            )}
            {t.status === 'delivery_pending' && isFarmer && <p className="muted">{tr('ক্রেতার প্রাপ্তি নিশ্চিতকরণের অপেক্ষায়।', 'Waiting for the buyer to confirm receipt.')}</p>}
            {t.status === 'completed' && (
              <>
                <Alert tone="success">{tr('লেনদেন সম্পন্ন হয়েছে।', 'This trade is complete.')}</Alert>
                {t.can_review && <button type="button" className="btn btn-primary" onClick={() => setReviewing(true)}>⭐ {tr(`${other.name}-কে রেটিং দিন`, `Rate ${other.name}`)}</button>}
              </>
            )}
            {t.status === 'cancelled' && <Alert tone="warning">{tr('লেনদেনটি বাতিল হয়েছে', 'This trade was cancelled')}: {t.cancel_reason}</Alert>}
            {t.status === 'disputed' && <Alert tone="warning">{tr('এই লেনদেনে অভিযোগ চলছে। অ্যাডমিন সিদ্ধান্ত দেবেন।', 'This trade is under dispute. An administrator will decide.')}</Alert>}

            {(isBuyer || isFarmer) && (
              <div className="form-actions start">
                {t.status === 'payment_pending' && (
                  <ConfirmButton className="btn btn-sm btn-danger-outline" title={tr('লেনদেন বাতিল', 'Cancel trade')} message={tr('লেনদেন বাতিল করবেন? ফসলের পরিমাণ আবার বিজ্ঞাপনে ফিরে যাবে।', 'Cancel this trade? The quantity goes back to the listing.')} reasonLabel={tr('কারণ', 'Reason')} onConfirm={(reason) => act('cancel', { reason })}>
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
              <p className="mt">📞 <a href={`tel:${other.phone}`}>{other.phone || '—'}</a>{other.email && <><br />✉️ {other.email}</>}</p>
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
