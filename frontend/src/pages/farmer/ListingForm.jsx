/** Create or edit a crop listing (with up to 5 photos). */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import { useLookups } from '../../context/LookupsContext'
import { useToast } from '../../context/ToastContext'
import { useForm } from '../../hooks/useFetch'
import { get, post, put, toFormData } from '../../services/api'
import { options } from '../../utils/labels'
import CropSelect from '../../components/CropSelect'
import ImagePicker from '../../components/ImagePicker'
import LocationFields from '../../components/LocationFields'
import { Card, Checkbox, ErrorBox, Input, Loader, PageHeader, Select, SubmitButton, TextArea } from '../../components/ui'

export default function ListingForm() {
  const { id } = useParams()
  const editing = Boolean(id)
  const { user } = useAuth()
  const { lang, tr } = useLang()
  const lk = useLookups()
  const toast = useToast()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(editing)
  const [loadError, setLoadError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [files, setFiles] = useState([])
  const [existing, setExisting] = useState([])
  const [removeIds, setRemoveIds] = useState([])
  const { values, setValues, bind, set, errors, setErrors } = useForm({
    crop_id: '',
    variety: '',
    quantity: '',
    unit: 'kg',
    price_per_unit: '',
    min_order_quantity: '',
    is_negotiable: true,
    district_id: user.district_id || '',
    upazila: user.upazila || '',
    harvest_date: '',
    description: '',
  })

  useEffect(() => {
    if (!editing) return
    get(`/listings/${id}`)
      .then((body) => {
        const l = body.data
        setValues({
          crop_id: l.crop_id, variety: l.variety || '', quantity: l.quantity, unit: l.unit, price_per_unit: l.price_per_unit,
          min_order_quantity: l.min_order_quantity || '', is_negotiable: Boolean(l.is_negotiable), district_id: l.district_id,
          upazila: l.upazila || '', harvest_date: l.harvest_date || '', description: l.description || '',
        })
        setExisting(l.images || [])
      })
      .catch(setLoadError)
      .finally(() => setLoading(false))
  }, [editing, id, setValues])

  function chooseCrop(cropId) {
    set('crop_id', cropId)
    const crop = lk.cropById[cropId]
    if (crop && !editing) set('unit', crop.default_unit)
  }

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const payload = editing ? { ...values, remove_image_ids: removeIds } : values
      const form = toFormData(payload, files)
      const body = editing ? await put(`/listings/${id}`, form) : await post('/listings', form)
      toast.success(body.message)
      navigate(`/listings/${body.data.id}`)
    } catch (err) {
      setErrors(err.errors)
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loader />
  if (loadError) return <div className="page"><ErrorBox error={loadError} /></div>

  return (
    <div className="page narrow">
      <PageHeader back="/farmer/listings" title={editing ? tr('বিজ্ঞাপন সম্পাদনা', 'Edit listing') : tr('ফসল বিক্রির বিজ্ঞাপন', 'Sell a crop')} />
      <form onSubmit={submit} className="form" noValidate>
        <Card title={tr('ফসলের তথ্য', 'Crop details')}>
          <div className="grid-2">
            <CropSelect value={values.crop_id} onChange={chooseCrop} error={errors.crop_id} required />
            <Input label={tr('জাত (ঐচ্ছিক)', 'Variety (optional)')} placeholder={tr('যেমন: ব্রি ধান 28', 'e.g. BRRI dhan28')} maxLength={100} {...bind('variety')} />
          </div>
          <div className="grid-3">
            <Input type="number" min="0" step="0.01" label={tr('মোট পরিমাণ', 'Total quantity')} required {...bind('quantity')} />
            <Select label={tr('একক', 'Unit')} options={options('unit', lang)} required {...bind('unit')} />
            <Input type="number" min="0" step="0.01" label={tr('প্রতি এককের দাম (৳)', 'Price per unit (৳)')} required {...bind('price_per_unit')} />
          </div>
          <div className="grid-2">
            <Input type="number" min="0" step="0.01" label={tr('সর্বনিম্ন অর্ডার (ঐচ্ছিক)', 'Minimum order (optional)')} {...bind('min_order_quantity')} />
            <Input type="date" label={tr('ফসল কাটার তারিখ', 'Harvest date')} {...bind('harvest_date')} />
          </div>
          <Checkbox label={tr('দাম আলোচনাযোগ্য (ক্রেতা অন্য দাম প্রস্তাব করতে পারবেন)', 'Price is negotiable (buyers may offer a different price)')} checked={values.is_negotiable} onChange={(e) => set('is_negotiable', e.target.checked)} />
          <TextArea label={tr('বিবরণ', 'Description')} placeholder={tr('ফসলের মান, শুকানো কি না, কোথা থেকে নিতে হবে ইত্যাদি', 'Quality, dryness, pickup point, etc.')} maxLength={3000} {...bind('description')} />
        </Card>
        <Card title={tr('কোথায় আছে', 'Location')}>
          <LocationFields districtId={values.district_id} upazila={values.upazila} onDistrict={(v) => set('district_id', v)} onUpazila={(v) => set('upazila', v)} errors={errors} required />
        </Card>
        <Card title={tr('ছবি (সর্বোচ্চ 5টি)', 'Photos (up to 5)')}>
          <ImagePicker
            files={files}
            onFiles={setFiles}
            existing={existing}
            removeIds={removeIds}
            onToggleRemove={(imgId) => setRemoveIds((ids) => (ids.includes(imgId) ? ids.filter((x) => x !== imgId) : [...ids, imgId]))}
            onError={toast.error}
          />
        </Card>
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>{tr('বাতিল', 'Cancel')}</button>
          <SubmitButton busy={busy}>{editing ? tr('সংরক্ষণ করুন', 'Save changes') : tr('বিজ্ঞাপন প্রকাশ করুন', 'Publish listing')}</SubmitButton>
        </div>
      </form>
    </div>
  )
}
