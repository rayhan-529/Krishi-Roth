/** Registration for every role except admin. Logs the user in immediately. */
import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useForm } from '../../hooks/useFetch'
import { HOME_BY_ROLE } from '../../utils/nav'
import LocationFields from '../../components/LocationFields'
import { ErrorBox, Input, SubmitButton } from '../../components/ui'
import { PasswordInput, useSocialSignIn } from './Login'
import SocialButtons, { OrDivider } from '../../components/SocialAuth'
import Icon from '../../components/Icon'
import PasswordChecklist from '../../components/PasswordChecklist'
import { isStrongPassword } from '../../utils/password'

const ROLES = [
  ['farmer', 'sprout', 'কৃষক', 'Farmer'],
  ['buyer', 'cart', 'ক্রেতা', 'Buyer'],
  ['labour', 'users', 'কৃষি শ্রমিক', 'Farm worker'],
  ['harvester_owner', 'wheat', 'হারভেস্টার মালিক', 'Harvester owner'],
  ['tractor_owner', 'tractor', 'ট্রাক্টর মালিক', 'Tractor owner'],
  ['transport_owner', 'truck', 'পরিবহন মালিক', 'Transport owner'],
]

/** Re-mounts the form when a Google/Apple account arrives, so it is pre-filled. */
export default function RegisterPage() {
  const location = useLocation()
  const social = (location.state && location.state.social) || null
  return <Register key={social ? social.id_token : 'plain'} social={social} />
}

function Register({ social }) {
  const { lang, tr } = useLang()
  const { user, register } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const onSocial = useSocialSignIn()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const { values, bind, set, errors, setErrors } = useForm({
    role: 'farmer',
    name: social ? social.name || '' : '',
    phone: '',
    email: social ? social.email || '' : '',
    password: '',
    confirm: '',
    district_id: '',
    upazila: '',
  })

  if (user) return <Navigate to={HOME_BY_ROLE[user.role]} replace />

  async function submit(event) {
    event.preventDefault()
    setError(null)
    if (!social && !isStrongPassword(values.password)) {
      setErrors({ password: tr('পাসওয়ার্ডে কমপক্ষে 6 অক্ষর, একটি অক্ষর, একটি সংখ্যা ও একটি চিহ্ন (@ # $ !) দিন।', 'Use at least 6 characters with a letter, a number and a symbol (@ # $ !).') })
      return
    }
    if (!social && values.password !== values.confirm) {
      setErrors({ confirm: tr('দুটি পাসওয়ার্ড মিলছে না।', 'The passwords do not match.') })
      return
    }
    setBusy(true)
    try {
      const { confirm: _confirm, ...payload } = values
      if (social) {
        delete payload.password
        Object.assign(payload, { provider: social.provider, id_token: social.id_token })
      }
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
        <h1 className="auth-title">{tr('নিবন্ধন', 'Sign up')}</h1>
        {social ? (
          <div className="social-linked">
            <Icon name="checkCircle" size={20} />
            <span>
              {social.provider === 'google' ? 'Google' : 'Apple'} {tr('অ্যাকাউন্ট যুক্ত হয়েছে', 'account connected')}
              {social.email && <small>{social.email}</small>}
            </span>
          </div>
        ) : (
          <>
            <SocialButtons signup onToken={onSocial} />
            <OrDivider />
          </>
        )}
        <p className="muted">{tr('আপনার ভূমিকা বেছে নিন', 'Choose your role')}</p>
        <ErrorBox error={error} />
        <form onSubmit={submit} className="form" noValidate>
          <div className="role-picker" role="radiogroup" aria-label={tr('অ্যাকাউন্টের ধরন', 'Account type')}>
            {ROLES.map(([code, icon, bn, en]) => (
              <button
                type="button"
                key={code}
                role="radio"
                aria-checked={values.role === code}
                className={values.role === code ? 'selected' : ''}
                onClick={() => set('role', code)}
              >
                <span aria-hidden="true"><Icon name={icon} size={22} /></span>
                <strong>{tr(bn, en)}</strong>
              </button>
            ))}
          </div>
          <Input label={tr('পুরো নাম', 'Full name')} autoComplete="name" required maxLength={100} {...bind('name')} />
          <div className="grid-2">
            <Input label={tr('মোবাইল নম্বর', 'Mobile number')} type="tel" inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" required {...bind('phone')} />
            <Input label={tr('ইমেইল', 'Email')} type="email" autoComplete="email" required readOnly={Boolean(social && social.email)} {...bind('email')} />
          </div>
          <LocationFields
            districtId={values.district_id}
            upazila={values.upazila}
            onDistrict={(v) => set('district_id', v)}
            onUpazila={(v) => set('upazila', v)}
            errors={errors}
            required
          />
          {!social && <div className="grid-2">
            <div>
              <PasswordInput label={tr('পাসওয়ার্ড', 'Password')} autoComplete="new-password" required {...bind('password')} />
              <PasswordChecklist password={values.password} />
            </div>
            <PasswordInput label={tr('পাসওয়ার্ড আবার লিখুন', 'Confirm password')} autoComplete="new-password" required {...bind('confirm')} />
          </div>}
          <SubmitButton busy={busy} className="btn btn-primary btn-block btn-pill">{tr('নিবন্ধন করুন', 'Register')}</SubmitButton>
        </form>
        <p className="auth-switch">
          {tr('আগেই অ্যাকাউন্ট আছে?', 'Already registered?')} <Link to="/login">{tr('লগইন করুন', 'Log in')}</Link>
        </p>
      </div>
    </div>
  )
}
