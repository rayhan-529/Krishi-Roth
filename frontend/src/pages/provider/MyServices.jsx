/**
 * Providers manage what they offer:
 *   labour            -> work profile (skills, wage, area, availability)
 *   harvester/tractor -> machines with photos and rent
 *   transport         -> vehicles with photos and charges
 * Everyone can add extra service areas.
 */
import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useFetch, useForm } from '../../hooks/useFetch'
import { del, get, mediaUrl, patch, post, put, toFormData } from '../../services/api'
import { label, options } from '../../utils/labels'
import { money, num, pick } from '../../utils/format'
import Icon, { Glyph } from '../../components/Icon'
import ImagePicker from '../../components/ImagePicker'
import LocationFields from '../../components/LocationFields'
import ServiceAreasEditor from '../../components/ServiceAreasEditor'
import { Badge, Card, Checkbox, ConfirmButton, EmptyState, ErrorBox, Input, Loader, Modal, PageHeader, Select, SubmitButton, TextArea } from '../../components/ui'

function LabourProfile() {
  const { user } = useAuth()
  const { tr } = useLang()
  const toast = useToast()
  const { data, loading, error, reload } = useFetch(() => get('/labour/me'), [])
  const [busy, setBusy] = useState(false)
  const { values, setValues, bind, set, errors, setErrors } = useForm({
    skills: '', experience_years: '', experience_details: '', daily_wage: '', district_id: user.district_id || '',
    upazila: user.upazila || '', is_available: true, available_from: '',
  })

  useEffect(() => {
    if (data) {
      setValues({
        skills: data.skills || '', experience_years: data.experience_years ?? '', experience_details: data.experience_details || '',
        daily_wage: data.daily_wage, district_id: data.district_id, upazila: data.upazila || '',
        is_available: Boolean(data.is_available), available_from: data.available_from || '',
      })
    }
  }, [data, setValues])

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const body = await put('/labour/me', values)
      toast.success(body.message)
      reload()
    } catch (err) {
      setErrors(err.errors)
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loader />
  return (
    <Card title={tr('আমার কাজের প্রোফাইল', 'My work profile')}>
      <ErrorBox error={error} />
      {!data && <p className="muted">{tr('প্রোফাইল তৈরি করলে কৃষকেরা আপনাকে খুঁজে বুকিং অনুরোধ পাঠাতে পারবেন।', 'Once you create your profile, farmers can find you and send booking requests.')}</p>}
      <form onSubmit={submit} className="form" noValidate>
        <Input label={tr('দক্ষতা', 'Skills')} placeholder={tr('যেমন: ধান রোপণ, ধান কাটা, আগাছা পরিষ্কার', 'e.g. rice planting, harvesting, weeding')} required maxLength={255} {...bind('skills')} />
        <div className="grid-3">
          <Input type="number" min="0" label={tr('দৈনিক মজুরি (৳)', 'Daily wage (৳)')} required {...bind('daily_wage')} />
          <Input type="number" min="0" max="80" label={tr('অভিজ্ঞতা (বছর)', 'Experience (years)')} {...bind('experience_years')} />
          <Input type="date" label={tr('কবে থেকে কাজে প্রস্তুত', 'Available from')} {...bind('available_from')} />
        </div>
        <TextArea label={tr('অভিজ্ঞতার বিবরণ', 'Experience details')} rows={3} maxLength={3000} {...bind('experience_details')} />
        <LocationFields districtId={values.district_id} upazila={values.upazila} onDistrict={(v) => set('district_id', v)} onUpazila={(v) => set('upazila', v)} errors={errors} required />
        <Checkbox label={tr('আমি এখন কাজের জন্য প্রস্তুত', 'I am available for work now')} checked={values.is_available} onChange={(e) => set('is_available', e.target.checked)} />
        <div className="form-actions"><SubmitButton busy={busy}>{tr('প্রোফাইল সংরক্ষণ', 'Save profile')}</SubmitButton></div>
      </form>
    </Card>
  )
}

const MACHINE_UNITS = ['per_hour', 'per_day', 'per_acre', 'per_bigha', 'per_decimal']
const VEHICLE_UNITS = ['per_km', 'per_trip', 'per_day', 'per_ton']

function ServiceForm({ kind, item, onClose, onSaved }) {
  const { user } = useAuth()
  const { lang, tr } = useLang()
  const toast = useToast()
  const isVehicle = kind === 'vehicle'
  const [busy, setBusy] = useState(false)
  const [files, setFiles] = useState([])
  const [removeIds, setRemoveIds] = useState([])
  const [existing, setExisting] = useState([])
  const base = isVehicle
    ? { vehicle_type: 'truck', name: '', registration_number: '', capacity: '', capacity_unit: 'ton', price: '', price_unit: 'per_trip', description: '' }
    : { name: '', brand: '', model: '', model_year: '', horsepower: '', description: '', rental_price: '', price_unit: 'per_bigha' }
  const { values, setValues, bind, set, errors, setErrors } = useForm({ ...base, district_id: user.district_id || '', upazila: user.upazila || '', is_available: true })

  useEffect(() => {
    if (!item) return
    const path = isVehicle ? `/transport/${item.id}` : `/machinery/${item.id}`
    get(path).then((body) => {
      const d = body.data
      setValues(Object.fromEntries(Object.keys({ ...base, district_id: 0, upazila: 0, is_available: 0 }).map((k) => [k, k === 'is_available' ? Boolean(d[k]) : d[k] ?? ''])))
      setExisting(d.images || [])
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item])

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const root = isVehicle ? '/transport' : '/machinery'
      const form = toFormData(item ? { ...values, remove_image_ids: removeIds } : values, files)
      const body = item ? await put(`${root}/${item.id}`, form) : await post(root, form)
      toast.success(body.message)
      onSaved()
      onClose()
    } catch (err) {
      setErrors(err.errors)
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const machineName = user.role === 'harvester_owner' ? tr('হারভেস্টার', 'Harvester') : tr('ট্রাক্টর', 'Tractor')
  return (
    <Modal open wide title={item ? tr('তথ্য সম্পাদনা', 'Edit details') : isVehicle ? tr('নতুন যানবাহন', 'New vehicle') : `${tr('নতুন', 'New')} ${machineName}`} onClose={onClose}>
      <form onSubmit={submit} className="form" noValidate>
        {isVehicle ? (
          <>
            <div className="grid-2">
              <Select label={tr('যানবাহনের ধরন', 'Vehicle type')} options={options('vehicleType', lang)} required {...bind('vehicle_type')} />
              <Input label={tr('নাম/বিবরণ', 'Name')} placeholder={tr('যেমন: ৫ টনের ট্রাক', 'e.g. 5-ton truck')} required maxLength={120} {...bind('name')} />
            </div>
            <div className="grid-3">
              <Input type="number" min="0" step="0.01" label={tr('ধারণক্ষমতা', 'Capacity')} required {...bind('capacity')} />
              <Select label={tr('একক', 'Unit')} options={options('unit', lang, ['kg', 'maund', 'ton'])} {...bind('capacity_unit')} />
              <Input label={tr('রেজিস্ট্রেশন নম্বর (গোপন)', 'Registration no. (private)')} maxLength={40} hint={tr('শুধু আপনি ও অ্যাডমিন দেখবেন', 'Only you and admins see it')} {...bind('registration_number')} />
            </div>
            <div className="grid-2">
              <Input type="number" min="0" label={tr('ভাড়া (৳)', 'Charge (৳)')} required {...bind('price')} />
              <Select label={tr('ভাড়ার হিসাব', 'Charged')} options={options('machinePrice', lang, VEHICLE_UNITS)} {...bind('price_unit')} />
            </div>
          </>
        ) : (
          <>
            <div className="grid-3">
              <Input label={tr('নাম', 'Name')} placeholder={machineName} required maxLength={120} {...bind('name')} />
              <Input label={tr('ব্র্যান্ড', 'Brand')} maxLength={80} {...bind('brand')} />
              <Input label={tr('মডেল', 'Model')} maxLength={80} {...bind('model')} />
            </div>
            <div className="grid-2">
              <Input type="number" min="1950" max="2100" label={tr('তৈরির বছর', 'Model year')} {...bind('model_year')} />
              <Input type="number" min="1" label={tr('হর্সপাওয়ার', 'Horsepower')} {...bind('horsepower')} />
            </div>
            <div className="grid-2">
              <Input type="number" min="0" label={tr('ভাড়া (৳)', 'Rent (৳)')} required {...bind('rental_price')} />
              <Select label={tr('ভাড়ার হিসাব', 'Charged')} options={options('machinePrice', lang, MACHINE_UNITS)} {...bind('price_unit')} />
            </div>
          </>
        )}
        <TextArea label={tr('বিবরণ', 'Description')} rows={3} maxLength={3000} {...bind('description')} />
        <LocationFields districtId={values.district_id} upazila={values.upazila} onDistrict={(v) => set('district_id', v)} onUpazila={(v) => set('upazila', v)} errors={errors} required />
        <Checkbox label={tr('এখন ভাড়ার জন্য উপলব্ধ', 'Available for booking now')} checked={values.is_available} onChange={(e) => set('is_available', e.target.checked)} />
        <ImagePicker files={files} onFiles={setFiles} existing={existing} removeIds={removeIds} onToggleRemove={(id) => setRemoveIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))} onError={toast.error} />
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{tr('বাতিল', 'Cancel')}</button>
          <SubmitButton busy={busy}>{tr('সংরক্ষণ', 'Save')}</SubmitButton>
        </div>
      </form>
    </Modal>
  )
}

function ServiceList({ kind }) {
  const { lang, tr } = useLang()
  const toast = useToast()
  const isVehicle = kind === 'vehicle'
  const root = isVehicle ? '/transport' : '/machinery'
  const { data, loading, error, reload } = useFetch(() => get(`${root}/mine`), [root])
  const [editing, setEditing] = useState(null)

  async function toggle(item) {
    try {
      const body = await patch(`${root}/${item.id}/availability`, { is_available: !item.is_available })
      toast.success(body.message)
      reload()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <Card
      title={isVehicle ? tr('আমার যানবাহন', 'My vehicles') : tr('আমার যন্ত্র', 'My machines')}
      actions={<button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')}><Icon name="plus" size={16} /> {tr('যোগ করুন', 'Add')}</button>}
    >
      {loading ? <Loader inline /> : error ? <ErrorBox error={error} onRetry={reload} /> : data.length === 0 ? (
        <EmptyState icon={isVehicle ? '🚚' : '🚜'} title={tr('এখনো কিছু যোগ করা হয়নি', 'Nothing added yet')} action={<button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>{tr('যোগ করুন', 'Add now')}</button>} />
      ) : (
        <div className="manage-list">
          {data.map((m) => (
            <article key={m.id} className="manage-item">
              <div className="manage-thumb">{m.cover_image ? <img src={mediaUrl(m.cover_image)} alt="" /> : <Glyph value={isVehicle ? '🚚' : '🚜'} size={26} />}</div>
              <div className="manage-body">
                <h3>
                  {m.name} {isVehicle && <small className="muted">({label('vehicleType', m.vehicle_type, lang)})</small>}{' '}
                  <Badge tone={m.is_available ? 'green' : 'grey'}>{m.is_available ? tr('উপলব্ধ', 'Available') : tr('উপলব্ধ নয়', 'Unavailable')}</Badge>
                  {m.pending_bookings > 0 && <Badge tone="amber">{tr(`${num(m.pending_bookings, lang)}টি নতুন অনুরোধ`, `${num(m.pending_bookings, lang)} new requests`)}</Badge>}
                </h3>
                <p className="muted small">
                  {money(isVehicle ? m.price : m.rental_price, lang)} {label('machinePrice', m.price_unit, lang)}
                  {isVehicle && ` · ${num(m.capacity, lang)} ${label('unit', m.capacity_unit, lang)}`} · {pick(m, 'district', lang)}
                  {isVehicle && m.registration_number && ` · ${m.registration_number}`}
                </p>
              </div>
              <div className="manage-actions">
                <button type="button" className="btn btn-sm btn-outline" onClick={() => toggle(m)}>{m.is_available ? tr('বন্ধ রাখুন', 'Pause') : tr('চালু করুন', 'Make available')}</button>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => setEditing(m)}><Icon name="edit" size={15} /></button>
                <ConfirmButton className="btn btn-sm btn-danger-outline" message={tr('এটি মুছে ফেলবেন?', 'Remove this?')} onConfirm={async () => { const b = await del(`${root}/${m.id}`); toast.success(b.message); reload() }}>
                  <Icon name="trash" size={15} />
                </ConfirmButton>
              </div>
            </article>
          ))}
        </div>
      )}
      {editing && <ServiceForm kind={kind} item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={reload} />}
    </Card>
  )
}

export default function MyServices() {
  const { user } = useAuth()
  const { tr } = useLang()
  return (
    <div className="page">
      <PageHeader title={tr('আমার সেবা', 'My services')} />
      {user.role === 'labour' && <LabourProfile />}
      {(user.role === 'harvester_owner' || user.role === 'tractor_owner') && <ServiceList kind="machine" />}
      {user.role === 'transport_owner' && <ServiceList kind="vehicle" />}
      <ServiceAreasEditor />
    </div>
  )
}
