/** Registration for every role except admin. Logs the user in immediately. */
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useForm } from '../../hooks/useFetch'
import { HOME_BY_ROLE } from '../../utils/nav'
import LocationFields from '../../components/LocationFields'
import { ErrorBox, Input, SubmitButton } from '../../components/ui'
import { PasswordInput } from './Login'

const ROLES = [
  ['farmer', '👨‍🌾', 'কৃষক', 'Farmer', 'ফসল বিক্রি ও হিসাব', 'Sell crops, keep records'],
  ['buyer', '🛒', 'ক্রেতা', 'Buyer', 'সরাসরি ফসল কিনুন', 'Buy directly'],
  ['labour', '🧑‍🔧', 'কৃষি শ্রমিক', 'Farm worker', 'কাজের অনুরোধ পান', 'Get work requests'],
  ['harvester_owner', '🌾', 'হারভেস্টার মালিক', 'Harvester owner', 'হারভেস্টার ভাড়া দিন', 'Rent out harvesters'],
  ['tractor_owner', '🚜', 'ট্রাক্টর মালিক', 'Tractor owner', 'ট্রাক্টর ভাড়া দিন', 'Rent out tractors'],
  ['transport_owner', '🚚', 'পরিবহন মালিক', 'Transport owner', 'ফসল পরিবহন করুন', 'Carry crops'],
]

export default function Register() {
  const { lang, tr } = useLang()
  const { user, register } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const { values, bind, set, errors, setErrors } = useForm({
    role: 'farmer',
    name: '',
    phone: '',
    email: '',
    password: '',
    confirm: '',
    district_id: '',
    upazila: '',
  })

  if (user) return <Navigate to={HOME_BY_ROLE[user.role]} replace />

  async function submit(event) {
    event.preventDefault()
    setError(null)
    if (values.password.length < 8) {
      setErrors({ password: tr('পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।', 'Password must be at least 8 characters.') })
      return
    }
    if (values.password !== values.confirm) {
      setErrors({ confirm: tr('দুটি পাসওয়ার্ড মিলছে না।', 'The passwords do not match.') })
      return
    }
    setBusy(true)
    try {
      const { confirm: _confirm, ...payload } = values
      const created = await register({ ...payload, preferred_language: lang })
      toast.success(tr('নিবন্ধন সফল হয়েছে। স্বাগতম!', 'Registration successful. Welcome!'))
      navigate(HOME_BY_ROLE[created.role], { replace: true })
    } catch (err) {
      setErrors(err.errors)
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card auth-wide">
        <h1>{tr('নতুন অ্যাকাউন্ট খুলুন', 'Create an account')}</h1>
        <p className="muted">{tr('আপনি কী হিসেবে কৃষি রথ ব্যবহার করবেন?', 'How will you use Krishi Roth?')}</p>
        <ErrorBox error={error} />
        <form onSubmit={submit} className="form" noValidate>
          <div className="role-picker" role="radiogroup" aria-label={tr('অ্যাকাউন্টের ধরন', 'Account type')}>
            {ROLES.map(([code, icon, bn, en, dbn, den]) => (
              <button
                type="button"
                key={code}
                role="radio"
                aria-checked={values.role === code}
                className={values.role === code ? 'selected' : ''}
                onClick={() => set('role', code)}
              >
                <span aria-hidden="true">{icon}</span>
                <strong>{tr(bn, en)}</strong>
                <small>{tr(dbn, den)}</small>
              </button>
            ))}
          </div>
          <Input label={tr('পুরো নাম', 'Full name')} autoComplete="name" required maxLength={100} {...bind('name')} />
          <div className="grid-2">
            <Input label={tr('মোবাইল নম্বর', 'Mobile number')} type="tel" inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" required {...bind('phone')} />
            <Input label={tr('ইমেইল (ঐচ্ছিক)', 'Email (optional)')} type="email" autoComplete="email" {...bind('email')} />
          </div>
          <LocationFields
            districtId={values.district_id}
            upazila={values.upazila}
            onDistrict={(v) => set('district_id', v)}
            onUpazila={(v) => set('upazila', v)}
            errors={errors}
            required
          />
          <div className="grid-2">
            <PasswordInput label={tr('পাসওয়ার্ড', 'Password')} autoComplete="new-password" hint={tr('কমপক্ষে ৮ অক্ষর', 'At least 8 characters')} required {...bind('password')} />
            <PasswordInput label={tr('পাসওয়ার্ড আবার লিখুন', 'Confirm password')} autoComplete="new-password" required {...bind('confirm')} />
          </div>
          <SubmitButton busy={busy} className="btn btn-primary btn-block">{tr('নিবন্ধন করুন', 'Register')}</SubmitButton>
        </form>
        <p className="auth-switch">
          {tr('আগেই অ্যাকাউন্ট আছে?', 'Already registered?')} <Link to="/login">{tr('লগইন করুন', 'Log in')}</Link>
        </p>
      </div>
    </div>
  )
}
