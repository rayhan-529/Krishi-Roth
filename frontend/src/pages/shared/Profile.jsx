import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useFetch, useForm } from '../../hooks/useFetch'
import { del, get, post, put, setDeviceToken, setToken, toFormData } from '../../services/api'
import { label, options } from '../../utils/labels'
import { date, dateTime } from '../../utils/format'
import LocationFields from '../../components/LocationFields'
import ReviewModal from '../../components/ReviewModal'
import { Alert, Avatar, Card, ErrorBox, Input, Loader, PageHeader, Select, Stars, StatusBadge, SubmitButton, TextArea } from '../../components/ui'
import { PasswordInput } from '../auth/Login'
import Icon from '../../components/Icon'
import PasswordChecklist from '../../components/PasswordChecklist'
import { isStrongPassword } from '../../utils/password'
import { SecurityCodeField } from '../../components/SecurityCode'

function ProfileForm({ profile, onSaved }) {
  const { tr, setLang } = useLang()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const { values, bind, set, errors, setErrors } = useForm({
    name: profile.name, phone: profile.phone || '', email: profile.email || '', district_id: profile.district_id || '',
    upazila: profile.upazila || '', address: profile.address || '', bio: profile.bio || '', preferred_language: profile.preferred_language,
  })

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const body = await put('/profile', values)
      toast.success(body.message)
      setLang(values.preferred_language)
      onSaved(body.data)
    } catch (err) {
      setErrors(err.errors)
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title={tr('ব্যক্তিগত তথ্য', 'Personal information')}>
      <form onSubmit={submit} className="form" noValidate>
        <Input label={tr('পুরো নাম', 'Full name')} required maxLength={100} {...bind('name')} />
        <div className="grid-2">
          <Input label={tr('মোবাইল নম্বর', 'Mobile number')} type="tel" {...bind('phone')} />
          <Input label={tr('ইমেইল', 'Email')} type="email" required {...bind('email')} />
        </div>
        <LocationFields districtId={values.district_id} upazila={values.upazila} onDistrict={(v) => set('district_id', v)} onUpazila={(v) => set('upazila', v)} errors={errors} />
        <Input label={tr('ঠিকানা', 'Address')} maxLength={255} {...bind('address')} />
        <TextArea label={tr('নিজের সম্পর্কে', 'About you')} rows={3} maxLength={500} {...bind('bio')} />
        <Select label={tr('ভাষা', 'Language')} options={[{ value: 'bn', label: 'বাংলা' }, { value: 'en', label: 'English' }]} {...bind('preferred_language')} />
        <div className="form-actions"><SubmitButton busy={busy}>{tr('সংরক্ষণ করুন', 'Save')}</SubmitButton></div>
      </form>
    </Card>
  )
}

function PasswordForm({ twoFactorOn }) {
  const { tr } = useLang()
  const { startSession } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const { values, setValues, bind, set, errors, setErrors } = useForm({ current_password: '', new_password: '', confirm: '', code: '' })

  async function submit(event) {
    event.preventDefault()
    if (!isStrongPassword(values.new_password)) {
      setErrors({ new_password: tr('পাসওয়ার্ডে কমপক্ষে 6 অক্ষর, একটি অক্ষর, একটি সংখ্যা ও একটি চিহ্ন (@ # $ !) দিন।', 'Use at least 6 characters with a letter, a number and a symbol (@ # $ !).') })
      return
    }
    if (values.new_password !== values.confirm) {
      setErrors({ confirm: tr('দুটি পাসওয়ার্ড মিলছে না।', 'The passwords do not match.') })
      return
    }
    setBusy(true)
    try {
      const body = await post('/auth/change-password', { current_password: values.current_password, new_password: values.new_password, code: twoFactorOn ? values.code : undefined })
      startSession(body.data) // a fresh token for this device; other devices are logged out
      toast.success(body.message)
      setValues({ current_password: '', new_password: '', confirm: '', code: '' })
    } catch (err) {
      setErrors(err.errors)
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title={tr('পাসওয়ার্ড পরিবর্তন', 'Change password')}>
      <form onSubmit={submit} className="form" noValidate>
        <PasswordInput label={tr('বর্তমান পাসওয়ার্ড', 'Current password')} autoComplete="current-password" required {...bind('current_password')} />
        <PasswordInput label={tr('নতুন পাসওয়ার্ড', 'New password')} autoComplete="new-password" required {...bind('new_password')} />
        <PasswordChecklist password={values.new_password} />
        <PasswordInput label={tr('নতুন পাসওয়ার্ড আবার', 'Confirm new password')} autoComplete="new-password" required {...bind('confirm')} />
        {twoFactorOn && <SecurityCodeField purpose="password_change" value={values.code} onChange={(v) => set('code', v)} error={errors.code && (typeof errors.code === 'string' ? errors.code : tr(errors.code.bn, errors.code.en))} />}
        <div className="form-actions"><SubmitButton busy={busy}>{tr('পাসওয়ার্ড বদলান', 'Change password')}</SubmitButton></div>
      </form>
      <LogoutEverywhere />
    </Card>
  )
}

/** Two-step verification: turn on/off, choose email or SMS, trusted devices. */
function TwoFactorCard({ status, onChanged }) {
  const { lang, tr } = useLang()
  const toast = useToast()
  const [method, setMethod] = useState('email')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [setup, setSetup] = useState(false)
  if (!status) return <Card title={tr('টু-স্টেপ ভেরিফিকেশন', 'Two-step verification')}><Loader inline /></Card>

  async function run(path, payload, after) {
    setBusy(true)
    try {
      const body = await post(path, payload)
      toast.success(body.message)
      if (after) after(body)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const methodLabel = (m) => (m === 'sms' ? `SMS (${status.phone || '—'})` : tr(`ইমেইল (${status.email || '—'})`, `Email (${status.email || '—'})`))
  const cancel = () => {
    setSetup(false)
    setCode('')
  }

  return (
    <Card
      title={tr('টু-স্টেপ ভেরিফিকেশন', 'Two-step verification')}
      actions={<span className={`badge ${status.enabled ? 'badge-green' : 'badge-grey'}`}>{status.enabled ? tr('চালু', 'On') : tr('বন্ধ', 'Off')}</span>}
    >
      <p className="small muted">
        {tr(
          'চালু থাকলে নতুন ফোন/কম্পিউটার থেকে লগইন, টাকা তোলা আর পাসওয়ার্ড বদলানোর সময় একটি কোড লাগবে। কেউ পাসওয়ার্ড জেনে গেলেও আপনার অ্যাকাউন্টে ঢুকতে পারবে না।',
          'When on, a code is needed to log in from a new phone or computer, to withdraw money and to change your password. Even someone who knows your password cannot get in.',
        )}
      </p>

      {status.enabled ? (
        <>
          <p className="tf-method">
            <Icon name={status.method === 'sms' ? 'phone' : 'mail'} size={16} /> {tr('কোড যায়', 'Codes go to')}: <strong>{methodLabel(status.method)}</strong>
          </p>
          {status.devices.length > 0 && (
            <>
              <h3 className="tf-sub">{tr('মনে রাখা ডিভাইস', 'Remembered devices')}</h3>
              <ul className="tf-devices">
                {status.devices.map((d) => (
                  <li key={d.id}>
                    <Icon name="globe" size={16} />
                    <span>
                      <strong>{d.label || tr('ব্রাউজার', 'Browser')}</strong>
                      <small>{tr('শেষ ব্যবহার', 'Last used')}: {dateTime(d.last_used_at || d.created_at, lang)}</small>
                    </span>
                    <button
                      type="button"
                      className="link-btn"
                      onClick={async () => {
                        await del(`/auth/2fa/devices/${d.id}`).catch(() => {})
                        onChanged()
                      }}
                    >
                      {tr('সরান', 'Remove')}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {status.forced ? (
            <p className="small muted mt">{tr('অ্যাডমিন অ্যাকাউন্টে নিরাপত্তার জন্য এটা সবসময় চালু থাকে।', 'For safety this is always on for admin accounts.')}</p>
          ) : setup ? (
            <div className="tf-setup">
              <SecurityCodeField purpose="disable_2fa" value={code} onChange={setCode} />
              <div className="form-actions start">
                <button
                  type="button"
                  className="btn btn-danger-outline"
                  disabled={busy || code.length !== 6}
                  onClick={() => run('/auth/2fa/disable', { code }, () => {
                    setDeviceToken(null)
                    cancel()
                    onChanged()
                  })}
                >
                  {tr('বন্ধ করুন', 'Turn off')}
                </button>
                <button type="button" className="btn btn-ghost" onClick={cancel}>{tr('বাতিল', 'Cancel')}</button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn btn-sm btn-outline mt" onClick={() => setSetup(true)}>{tr('টু-স্টেপ বন্ধ করুন', 'Turn off two-step')}</button>
          )}
        </>
      ) : setup ? (
        <div className="tf-setup">
          <p className="small"><strong>{tr('কোথায় কোড পাবেন?', 'Where should codes go?')}</strong></p>
          <div className="method-picker">
            <button type="button" className={method === 'email' ? 'selected' : ''} onClick={() => { setMethod('email'); setCode('') }}>
              {tr('ইমেইল', 'Email')}
            </button>
            <button
              type="button"
              className={method === 'sms' ? 'selected' : ''}
              disabled={!status.sms_available}
              title={status.sms_available ? undefined : tr('SMS এখনো চালু নেই', 'SMS is not set up yet')}
              onClick={() => { setMethod('sms'); setCode('') }}
            >
              SMS {!status.sms_available && <small>({tr('শীঘ্রই', 'soon')})</small>}
            </button>
          </div>
          <p className="small muted">{tr('চালু করার আগে যাচাই করুন যে কোডটা আপনার কাছে পৌঁছায়:', 'First check that the code reaches you:')} {methodLabel(method)}</p>
          <SecurityCodeField key={method} purpose="enable_2fa" method={method} value={code} onChange={setCode} />
          <div className="form-actions start">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || code.length !== 6}
              onClick={() => run('/auth/2fa/enable', { method, code }, (body) => {
                setDeviceToken(body.data.device_token)
                cancel()
                onChanged()
              })}
            >
              <Icon name="shield" size={16} /> {tr('চালু করুন', 'Turn on')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={cancel}>{tr('বাতিল', 'Cancel')}</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-primary" onClick={() => setSetup(true)}>
          <Icon name="shield" size={16} /> {tr('টু-স্টেপ চালু করুন', 'Turn on two-step')}
        </button>
      )}
    </Card>
  )
}

function LogoutEverywhere() {
  const { tr } = useLang()
  const { setUser } = useAuth()
  return (
    <p className="small muted mt">
      {tr('অন্য কোনো ফোন/কম্পিউটারে লগইন থাকলে', 'Logged in on another phone or computer?')}{' '}
      <button
        type="button"
        className="link-btn"
        onClick={async () => {
          await post('/auth/logout-all').catch(() => {})
          setToken(null)
          setUser(null)
        }}
      >
        {tr('সব জায়গা থেকে লগআউট করুন', 'Log out everywhere')}
      </button>
    </p>
  )
}

function Verification({ profile, onChanged }) {
  const { lang, tr } = useLang()
  const toast = useToast()
  const { data: requests, reload } = useFetch(() => get('/verifications/mine'), [])
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const fileInput = useRef(null)
  const { values, bind, errors, setErrors } = useForm({ document_type: 'nid', document_number_last4: '', note: '' })

  async function submit(event) {
    event.preventDefault()
    if (!file) {
      setErrors({ document: tr('একটি ছবি বা PDF বেছে নিন।', 'Choose an image or PDF.') })
      return
    }
    setBusy(true)
    try {
      const body = await post('/verifications', toFormData(values, [file], 'document'))
      toast.success(body.message)
      setFile(null)
      if (fileInput.current) fileInput.current.value = ''
      reload()
      onChanged()
    } catch (err) {
      setErrors(err.errors)
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title={tr('অ্যাকাউন্ট যাচাই', 'Account verification')} actions={<StatusBadge group="verification" value={profile.verification_status} />}>
      {profile.verification_status === 'verified' ? (
        <Alert tone="success">{tr('আপনার অ্যাকাউন্ট যাচাইকৃত। ক্রেতা ও কৃষকেরা আপনার নামের পাশে যাচাই চিহ্ন দেখবেন।', 'Your account is verified. Others see a verified mark next to your name.')}</Alert>
      ) : profile.verification_status === 'pending' ? (
        <Alert tone="info">{tr('আপনার আবেদন অ্যাডমিন দেখছেন।', 'An administrator is reviewing your request.')}</Alert>
      ) : (
        <form onSubmit={submit} className="form" noValidate>
          <p className="muted small">{tr('পরিচয়পত্রের ছবি বা PDF দিন। ডকুমেন্টটি গোপন থাকে, শুধু অ্যাডমিন দেখতে পারেন।', 'Upload a photo or PDF of your ID. It stays private and only administrators can see it.')}</p>
          <div className="grid-2">
            <Select label={tr('ডকুমেন্টের ধরন', 'Document type')} options={options('documentType', lang)} {...bind('document_type')} />
            <Input label={tr('নম্বরের শেষ 4 অক্ষর', 'Last 4 characters of the number')} maxLength={4} {...bind('document_number_last4')} />
          </div>
          <div className={`field ${errors.document ? 'has-error' : ''}`}>
            <label htmlFor="doc-file">{tr('ডকুমেন্ট (JPG, PNG, WEBP বা PDF, 3 MB পর্যন্ত)', 'Document (JPG, PNG, WEBP or PDF, up to 3 MB)')}</label>
            <input id="doc-file" ref={fileInput} type="file" className="input" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => (setFile(e.target.files[0] || null), setErrors({}))} />
            {errors.document && <small className="field-error">{errors.document}</small>}
          </div>
          <TextArea label={tr('নোট (ঐচ্ছিক)', 'Note (optional)')} rows={2} maxLength={500} {...bind('note')} />
          <div className="form-actions"><SubmitButton busy={busy}>{tr('যাচাইয়ের আবেদন পাঠান', 'Request verification')}</SubmitButton></div>
        </form>
      )}
      {requests && requests.length > 0 && (
        <ul className="row-list mt">
          {requests.map((r) => (
            <li key={r.id}>
              <div><strong>{label('documentType', r.document_type, lang)}</strong><small>{dateTime(r.created_at, lang)}{r.admin_note ? ` · ${r.admin_note}` : ''}</small></div>
              <StatusBadge group="verification" value={r.status} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function PendingReviews() {
  const { lang, tr } = useLang()
  const { data, reload } = useFetch(() => get('/reviews/pending'), [])
  const [target, setTarget] = useState(null)
  if (!data || data.length === 0) return null
  return (
    <Card title={tr('রেটিং দেওয়া বাকি', 'Waiting for your rating')}>
      <ul className="row-list">
        {data.map((item) => (
          <li key={`${item.kind}-${item.id}`}>
            <div>
              <strong>{item.other_name}</strong>
              <small>{item.kind === 'trade' ? `${tr('লেনদেন', 'Trade')}: ${lang === 'en' ? item.title_en : item.title_bn}` : `${tr('বুকিং', 'Booking')}: ${label('bookingType', item.title_en, lang)}`} · {date(item.finished_at, lang)}</small>
            </div>
            <button type="button" className="btn btn-sm btn-outline" onClick={() => setTarget(item)}><Icon name="star" size={16} /> {tr('রেটিং দিন', 'Rate')}</button>
          </li>
        ))}
      </ul>
      {target && (
        <ReviewModal
          tradeId={target.kind === 'trade' ? target.id : undefined}
          bookingId={target.kind === 'booking' ? target.id : undefined}
          otherName={target.other_name}
          onClose={() => setTarget(null)}
          onDone={reload}
        />
      )}
    </Card>
  )
}

export default function Profile() {
  const { lang, tr } = useLang()
  const { setUser } = useAuth()
  const toast = useToast()
  const { data: profile, loading, error, reload, setData } = useFetch(() => get('/profile'), [])
  const twoFactor = useFetch(() => get('/auth/2fa'), [])
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (profile) setUser((u) => (u ? { ...u, name: profile.name, profile_photo: profile.profile_photo, verification_status: profile.verification_status, district_id: profile.district_id, upazila: profile.upazila } : u))
  }, [profile, setUser])

  async function uploadPhoto(event) {
    const file = event.target.files[0]
    event.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const body = await post('/profile/photo', toFormData({}, [file], 'photo'))
      setData((p) => ({ ...p, profile_photo: body.data.profile_photo }))
      toast.success(body.message)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setUploading(false)
    }
  }

  if (loading && !profile) return <Loader />
  if (error) return <div className="page"><ErrorBox error={error} onRetry={reload} /></div>

  return (
    <div className="page">
      <PageHeader title={tr('আমার প্রোফাইল', 'My profile')} />
      <div className="two-col">
        <div>
          <ProfileForm profile={profile} onSaved={setData} />
          {profile.role !== 'admin' && <Verification profile={profile} onChanged={reload} />}
        </div>
        <div>
          <Card>
            <div className="profile-card">
              <Avatar src={profile.profile_photo} name={profile.name} size={96} />
              <label className="btn btn-sm btn-outline">
                {uploading ? tr('আপলোড হচ্ছে...', 'Uploading...') : tr('ছবি বদলান', 'Change photo')}
                <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={uploadPhoto} disabled={uploading} />
              </label>
              <h2>{profile.name}</h2>
              <p className="muted">{label('role', profile.role, lang)} · {profile.district_bn ? (lang === 'en' ? profile.district_en : profile.district_bn) : ''}</p>
              <Stars value={profile.average_rating} count={profile.review_count} />
              <p className="small muted">{tr('সদস্য হয়েছেন', 'Member since')} {date(profile.created_at, lang)}</p>
              {profile.role !== 'admin' && <Link to={`/users/${profile.id}`}>{tr('অন্যরা যেভাবে দেখে', 'View public profile')} →</Link>}
            </div>
          </Card>
          <PendingReviews />
          <TwoFactorCard status={twoFactor.data} onChanged={twoFactor.reload} />
          <PasswordForm twoFactorOn={Boolean(twoFactor.data && twoFactor.data.enabled)} />
        </div>
      </div>
    </div>
  )
}
