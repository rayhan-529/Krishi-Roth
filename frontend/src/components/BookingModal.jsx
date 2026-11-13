/**
 * Booking request form for a worker, harvester, tractor or vehicle.
 *   <BookingModal type="harvester" target={machine} onClose={...} />
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { useForm } from '../hooks/useFetch'
import { post } from '../services/api'
import { label } from '../utils/labels'
import { money, todayBD } from '../utils/format'
import LocationFields from './LocationFields'
import { Alert, Input, Modal, SubmitButton, TextArea } from './ui'

export default function BookingModal({ type, target, onClose }) {
  const { lang, tr } = useLang()
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const form = useForm({
    start_date: todayBD(1),
    end_date: todayBD(1),
    work_district_id: user && user.district_id ? user.district_id : '',
    work_upazila: (user && user.upazila) || '',
    work_address: '',
    destination: '',
    work_size: '',
    work_size_unit: type === 'transport' ? 'kg' : 'bigha',
    requester_note: '',
  })
  const { values, bind, set, setErrors, errors } = form

  if (!target) return null

  const name = type === 'labour' ? target.name : target.name
  const price = type === 'labour' ? target.daily_wage : type === 'transport' ? target.price : target.rental_price
  const unit = type === 'labour' ? 'per_day' : target.price_unit

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const payload = { ...values, booking_type: type }
      if (type === 'labour') payload.labour_id = target.user_id
      else if (type === 'transport') payload.transport_vehicle_id = target.id
      else payload.machinery_id = target.id
      const body = await post('/bookings', payload)
      toast.success(body.message)
      onClose()
      navigate(`/bookings/${body.data.id}`)
    } catch (err) {
      setErrors(err.errors)
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const allowed = user && (user.role === 'farmer' || (type === 'transport' && user.role === 'buyer'))

  return (
    <Modal open title={`${tr('বুকিং অনুরোধ', 'Booking request')}: ${name}`} onClose={onClose} wide>
      {!allowed ? (
        <Alert tone="warning">
          {user
            ? tr('এই সেবাটি কৃষক অ্যাকাউন্ট থেকে বুক করা যায়।', 'This service can be booked from a farmer account.')
            : tr('বুক করতে আগে লগইন করুন।', 'Please log in to book.')}
        </Alert>
      ) : (
        <form onSubmit={submit} className="form" noValidate>
          <p className="price-line">
            {tr('দাম', 'Price')}: <strong>{money(price, lang)}</strong> {label('machinePrice', unit, lang)}
          </p>
          <div className="grid-2">
            <Input type="date" label={tr('শুরুর তারিখ', 'Start date')} min={todayBD()} required {...bind('start_date')} />
            <Input type="date" label={tr('শেষ তারিখ', 'End date')} min={values.start_date} required {...bind('end_date')} />
          </div>
          <LocationFields
            districtId={values.work_district_id}
            upazila={values.work_upazila}
            onDistrict={(v) => set('work_district_id', v)}
            onUpazila={(v) => set('work_upazila', v)}
            errors={{ district_id: errors.work_district_id }}
            required
          />
          <Input label={type === 'transport' ? tr('মাল তোলার ঠিকানা', 'Pickup address') : tr('কাজের ঠিকানা/গ্রাম', 'Work address / village')} maxLength={255} {...bind('work_address')} />
          {type === 'transport' && <Input label={tr('কোথায় যাবে', 'Destination')} maxLength={255} {...bind('destination')} />}
          <div className="grid-2">
            <Input
              type="number"
              min="0"
              step="0.01"
              label={type === 'transport' ? tr('মালের পরিমাণ', 'Load size') : tr('জমি/কাজের পরিমাণ', 'Land / work size')}
              {...bind('work_size')}
            />
            <Input label={tr('একক', 'Unit')} maxLength={20} {...bind('work_size_unit')} hint={tr('যেমন: বিঘা, শতাংশ, কেজি, ঘণ্টা', 'e.g. bigha, decimal, kg, hour')} />
          </div>
          <TextArea label={tr('বিস্তারিত (ঐচ্ছিক)', 'Details (optional)')} maxLength={2000} rows={3} {...bind('requester_note')} />
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>{tr('বাতিল', 'Cancel')}</button>
            <SubmitButton busy={busy}>{tr('অনুরোধ পাঠান', 'Send request')}</SubmitButton>
          </div>
        </form>
      )}
    </Modal>
  )
}
