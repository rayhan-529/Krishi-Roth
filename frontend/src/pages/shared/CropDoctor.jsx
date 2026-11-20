/**
 * Crop doctor: take or choose a photo of a sick plant, get a diagnosis.
 * The photo is shrunk in the browser before upload (fast on slow mobile data)
 * and is never stored on the server.
 */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import { useLookups } from '../../context/LookupsContext'
import { post } from '../../services/api'
import CropSelect from '../../components/CropSelect'
import Icon from '../../components/Icon'
import DiagnosisResult from '../../components/DiagnosisResult'
import { Alert, ErrorBox, Input, PageHeader, SubmitButton } from '../../components/ui'

const MAX_SIDE = 1280

/** Resizes a photo to at most MAX_SIDE px and re-encodes it as JPEG. */
function shrink(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', 0.85)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file) // let the server decide
    }
    img.src = url
  })
}

export default function CropDoctor() {
  const { lang, tr } = useLang()
  const { user } = useAuth()
  const lookups = useLookups()
  const cameraRef = useRef(null)
  const galleryRef = useRef(null)
  const [photo, setPhoto] = useState(null) // { blob, preview }
  const [cropId, setCropId] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  useEffect(() => () => photo && URL.revokeObjectURL(photo.preview), [photo])

  async function pick(event) {
    const file = event.target.files && event.target.files[0]
    event.target.value = ''
    if (!file) return
    setError(null)
    setResult(null)
    const blob = await shrink(file)
    setPhoto({ blob, preview: URL.createObjectURL(blob) })
  }

  async function submit(event) {
    event.preventDefault()
    if (!photo) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const crop = lookups.crops.find((c) => c.id === Number(cropId))
      const form = new FormData()
      form.append('photo', photo.blob, 'photo.jpg')
      if (crop) form.append('crop', `${crop.name_en} (${crop.name_bn})`)
      if (note.trim()) form.append('note', note.trim())
      const body = await post('/crop-doctor/diagnose', form)
      setResult(body.data)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page narrow">
      <PageHeader title={tr('ফসলের ডাক্তার', 'Crop doctor')} />
      {!user ? (
        <Alert tone="info">
          {tr('ছবি দিয়ে রোগ চিনতে লগইন করুন।', 'Please log in to check a crop photo.')} <Link to="/login" state={{ from: '/crop-doctor' }}>{tr('লগইন', 'Log in')}</Link>
        </Alert>
      ) : (
        <div className="card">
          <p className="muted">
            {tr('আক্রান্ত পাতা, কাণ্ড বা ফলের কাছ থেকে পরিষ্কার একটা ছবি তুলুন। এআই রোগ, কারণ আর প্রতিকার বলে দেবে।', 'Take a clear close-up photo of the affected leaf, stem or fruit. The AI will suggest the problem, cause and treatment.')}
          </p>
          <form onSubmit={submit} className="form" noValidate>
            <div className={`doctor-photo ${photo ? 'has-photo' : ''}`}>
              {photo ? (
                <img src={photo.preview} alt={tr('নির্বাচিত ছবি', 'Selected photo')} />
              ) : (
                <div className="doctor-photo-empty">
                  <Icon name="image" size={40} />
                  <span>{tr('এখনো কোনো ছবি নেই', 'No photo yet')}</span>
                </div>
              )}
            </div>
            <div className="doctor-photo-actions">
              <button type="button" className="btn btn-primary" onClick={() => cameraRef.current.click()}>
                <Icon name="image" size={18} /> {tr('ছবি তুলুন', 'Take photo')}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => galleryRef.current.click()}>
                <Icon name="upload" size={18} /> {tr('গ্যালারি থেকে', 'From gallery')}
              </button>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
              <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pick} />
            </div>

            <div className="grid-2">
              <CropSelect label={tr('কোন ফসল? (ঐচ্ছিক)', 'Which crop? (optional)')} value={cropId} onChange={setCropId} placeholder={tr('জানা না থাকলে খালি রাখুন', 'Leave empty if unsure')} />
              <Input label={tr('কী সমস্যা দেখছেন? (ঐচ্ছিক)', 'What do you see? (optional)')} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr('যেমন: পাতা হলুদ হয়ে যাচ্ছে', 'e.g. leaves turning yellow')} />
            </div>

            <ErrorBox error={error} />
            <SubmitButton busy={busy} className="btn btn-primary btn-block btn-pill" disabled={busy || !photo}>
              {busy ? tr('বিশ্লেষণ চলছে... (10–20 সেকেন্ড)', 'Analysing... (10–20 seconds)') : tr('রোগ পরীক্ষা করুন', 'Check the crop')}
            </SubmitButton>
          </form>
        </div>
      )}

      {result && <DiagnosisResult result={result} lang={lang} />}

      <p className="source-note">
        <Icon name="info" size={13} />{' '}
        {tr('এআই-এর পরামর্শ সাধারণ তথ্য। ওষুধ দেওয়ার আগে উপজেলা কৃষি অফিসারের সাথে কথা বলুন বা 16123 নম্বরে কল করুন। ছবি সংরক্ষণ করা হয় না।', 'AI advice is general guidance. Before using any chemical, talk to your Upazila Agriculture Officer or call 16123. Photos are not stored.')}
      </p>
    </div>
  )
}
