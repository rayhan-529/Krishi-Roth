import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useFetch } from '../../hooks/useFetch'
import { get, patch } from '../../services/api'
import { label } from '../../utils/labels'
import { date, dateTime, money, num, pick } from '../../utils/format'
import ReviewModal from '../../components/ReviewModal'
import { Alert, Avatar, Card, ConfirmButton, ErrorBox, Loader, PageHeader, Stars, StatusBadge, VerifiedBadge } from '../../components/ui'

export default function BookingDetails() {
  const { id } = useParams()
  const { user } = useAuth()
  const { lang, tr } = useLang()
  const toast = useToast()
  const { data: b, loading, error, reload } = useFetch(() => get(`/bookings/${id}`), [id])
  const [reviewing, setReviewing] = useState(false)

  async function act(action, note) {
    const body = await patch(`/bookings/${id}`, { action, note: note || undefined })
    toast.success(body.message)
    reload()
  }

  if (loading && !b) return <Loader />
  if (error) return <div className="page"><ErrorBox error={error} onRetry={reload} /></div>

  const isProvider = b.provider_id === user.id
  const isRequester = b.requester_id === user.id
  const other = isProvider
    ? { id: b.requester_id, name: b.requester_name, photo: b.requester_photo, verification: b.requester_verification, phone: b.requester_phone, role: tr('অনুরোধকারী', 'Requested by') }
    : { id: b.provider_id, name: b.provider_name, photo: b.provider_photo, verification: b.provider_verification, phone: b.provider_phone, role: tr('সেবাদাতা', 'Provider') }

  return (
    <div className="page">
      <PageHeader back={user.role === 'admin' ? '/admin/bookings' : '/bookings'} title={`${tr('বুকিং', 'Booking')} #${num(b.id, lang, 0)} — ${label('bookingType', b.booking_type, lang)}`} subtitle={<StatusBadge group="bookingStatus" value={b.status} />} />
      <div className="two-col">
        <div>
          <Card title={tr('বিবরণ', 'Details')}>
            <dl className="details">
              {b.machine_name && <><dt>{tr('যন্ত্র', 'Machine')}</dt><dd>{b.machine_name}</dd></>}
              {b.vehicle_name && <><dt>{tr('যানবাহন', 'Vehicle')}</dt><dd>{b.vehicle_name} ({label('vehicleType', b.vehicle_type, lang)})</dd></>}
              <dt>{tr('তারিখ', 'Dates')}</dt><dd>{date(b.start_date, lang)} – {date(b.end_date, lang)} ({tr(`${num(b.days, lang)} দিন`, `${num(b.days, lang)} days`)})</dd>
              <dt>{tr('কাজের এলাকা', 'Work area')}</dt><dd>{[b.work_address, b.work_upazila, pick(b, 'work_district', lang)].filter(Boolean).join(', ')}</dd>
              {b.destination && <><dt>{tr('গন্তব্য', 'Destination')}</dt><dd>{b.destination}</dd></>}
              {b.work_size && <><dt>{tr('কাজের পরিমাণ', 'Work size')}</dt><dd>{num(b.work_size, lang)} {b.work_size_unit}</dd></>}
              <dt>{tr('দর', 'Rate')}</dt><dd>{money(b.quoted_price, lang)} {label('machinePrice', b.price_unit, lang)}</dd>
              {b.estimated_total && <><dt>{tr('আনুমানিক মোট', 'Estimated total')}</dt><dd><strong>{money(b.estimated_total, lang)}</strong></dd></>}
              <dt>{tr('অনুরোধের সময়', 'Requested')}</dt><dd>{dateTime(b.created_at, lang)}</dd>
            </dl>
            {b.requester_note && <p className="quote">“{b.requester_note}”</p>}
            {b.provider_note && <p className="quote">{tr('সেবাদাতার নোট', 'Provider note')}: {b.provider_note}</p>}
            <p className="muted small">{tr('দাম আনুমানিক; চূড়ান্ত দাম দুই পক্ষ মিলে ঠিক করবেন। কৃষি রথ টাকা লেনদেন করে না।', 'The price is an estimate; both sides agree the final amount. Krishi Roth does not handle money.')}</p>
          </Card>

          <Card title={tr('কাজ', 'Actions')}>
            {b.status === 'completed' && <Alert tone="success">{tr('বুকিং সম্পন্ন হয়েছে।', 'This booking is complete.')}</Alert>}
            <div className="form-actions start">
              {isProvider && b.status === 'pending' && (
                <>
                  <ConfirmButton className="btn btn-primary" danger={false} message={tr('এই তারিখে কাজটি নেবেন?', 'Accept this job for these dates?')} onConfirm={() => act('accept')}>{tr('গ্রহণ করুন', 'Accept')}</ConfirmButton>
                  <ConfirmButton className="btn btn-danger-outline" message={tr('অনুরোধটি বাতিল করবেন?', 'Reject this request?')} reasonLabel={tr('কারণ', 'Reason')} onConfirm={(r) => act('reject', r)}>{tr('প্রত্যাখ্যান', 'Reject')}</ConfirmButton>
                </>
              )}
              {isProvider && b.status === 'accepted' && <ConfirmButton className="btn btn-primary" danger={false} message={tr('কাজ শুরু হয়েছে?', 'Has the work started?')} onConfirm={() => act('start')}>{tr('কাজ শুরু', 'Start work')}</ConfirmButton>}
              {(isProvider || isRequester) && ['accepted', 'in_progress'].includes(b.status) && (
                <ConfirmButton className="btn btn-primary" danger={false} message={tr('কাজটি শেষ হয়েছে?', 'Is the work finished?')} onConfirm={() => act('complete')}>{tr('কাজ সম্পন্ন', 'Mark completed')}</ConfirmButton>
              )}
              {((isRequester && ['pending', 'accepted'].includes(b.status)) || (isProvider && b.status === 'accepted')) && (
                <ConfirmButton className="btn btn-danger-outline" message={tr('বুকিং বাতিল করবেন?', 'Cancel this booking?')} reasonLabel={tr('কারণ', 'Reason')} onConfirm={(r) => act('cancel', r)}>{tr('বাতিল করুন', 'Cancel booking')}</ConfirmButton>
              )}
              {b.can_review && <button type="button" className="btn btn-primary" onClick={() => setReviewing(true)}>⭐ {tr('রেটিং দিন', 'Rate')}</button>}
            </div>
          </Card>
        </div>
        <div>
          {user.role !== 'admin' && (
            <Card title={other.role}>
              <Link to={`/users/${other.id}`} className="person">
                <Avatar src={other.photo} name={other.name} size={48} />
                <span><strong>{other.name}</strong> <VerifiedBadge status={other.verification} /></span>
              </Link>
              {other.phone ? <p className="mt">📞 <a href={`tel:${other.phone}`}>{other.phone}</a></p> : <p className="muted small mt">{tr('বুকিং গৃহীত হলে ফোন নম্বর দেখা যাবে।', 'The phone number is shown once the booking is accepted.')}</p>}
            </Card>
          )}
          {b.reviews.length > 0 && (
            <Card title={tr('রিভিউ', 'Reviews')}>
              {b.reviews.map((r) => (
                <div key={r.reviewer_id} className="review"><Stars value={r.rating} /> {r.comment && <p>{r.comment}</p>}</div>
              ))}
            </Card>
          )}
        </div>
      </div>
      {reviewing && <ReviewModal bookingId={b.id} otherName={other.name} onClose={() => setReviewing(false)} onDone={reload} />}
    </div>
  )
}
