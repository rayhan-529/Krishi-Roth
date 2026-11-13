/** One login page for every role — farmers, buyers, providers and admins. */
import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useForm } from '../../hooks/useFetch'
import { HOME_BY_ROLE } from '../../utils/nav'
import Icon from '../../components/Icon'
import { ErrorBox, Input, SubmitButton } from '../../components/ui'

export function PasswordInput(props) {
  const { tr } = useLang()
  const [show, setShow] = useState(false)
  return (
    <div className="password-wrap">
      <Input type={show ? 'text' : 'password'} {...props} />
      <button type="button" className="icon-btn password-toggle" onClick={() => setShow((s) => !s)} aria-label={show ? tr('পাসওয়ার্ড লুকান', 'Hide password') : tr('পাসওয়ার্ড দেখুন', 'Show password')}>
        <Icon name={show ? 'eyeOff' : 'eye'} size={18} />
      </button>
    </div>
  )
}

export default function Login() {
  const { tr } = useLang()
  const { user, login } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const { values, bind, setErrors } = useForm({ identifier: '', password: '' })

  if (user) return <Navigate to={HOME_BY_ROLE[user.role]} replace />

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const loggedIn = await login(values.identifier.trim(), values.password)
      toast.success(tr(`স্বাগতম, ${loggedIn.name}!`, `Welcome, ${loggedIn.name}!`))
      const from = location.state && location.state.from
      navigate(from && loggedIn.role !== 'admin' ? from : HOME_BY_ROLE[loggedIn.role], { replace: true })
    } catch (err) {
      setErrors(err.errors)
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const features = [
    ['chart', tr('প্রতিদিনের বাজারদর', 'Daily market prices'), tr('৬৪ জেলার হালনাগাদ দাম দেখে বিক্রি করুন', 'Sell with up-to-date prices from 64 districts')],
    ['shield', tr('নিরাপদ লেনদেন', 'Safe trading'), tr('অফার থেকে ডেলিভারি পর্যন্ত প্রতিটি ধাপ রেকর্ড', 'Every step recorded, from offer to delivery')],
    ['leaf', tr('কৃষিসেবা এক জায়গায়', 'All farm services'), tr('শ্রমিক, হারভেস্টার, ট্রাক্টর ও পরিবহন বুকিং', 'Book labour, harvesters, tractors and transport')]
  ]

  return (
    <div className="login-page">
      <div className="login-shell">
        <aside className="login-brand" aria-hidden="true">
          <div className="login-brand-top">
            <span className="login-logo">🌾</span>
            <span className="login-brand-name">{tr('কৃষি রথ', 'Krishi Roth')}</span>
          </div>
          <h2>{tr('কৃষকের পাশে, বাংলার কৃষির উন্নয়নে', 'Beside every farmer, growing Bangladesh')}</h2>
          <p className="login-brand-lead">
            {tr('ফসল বিক্রি, বাজারদর আর কৃষিসেবা — সব এক অ্যাকাউন্টে।', 'Sell crops, track prices and book services, all from one account.')}
          </p>
          <ul className="login-features">
            {features.map(([icon, title, text]) => (
              <li key={icon}>
                <span className="login-feature-icon"><Icon name={icon} size={18} /></span>
                <span>
                  <strong>{title}</strong>
                  <small>{text}</small>
                </span>
              </li>
            ))}
          </ul>
        </aside>

        <section className="login-form-panel">
          <div className="login-form-head">
            <span className="login-badge"><Icon name="user" size={14} /> {tr('সবার জন্য একটি লগইন', 'One login for everyone')}</span>
            <h1>{tr('আবার স্বাগতম', 'Welcome back')}</h1>
            <p className="muted">{tr('আপনার মোবাইল নম্বর বা ইমেইল দিয়ে লগইন করুন।', 'Log in with your mobile number or email.')}</p>
          </div>
          <ErrorBox error={error} />
          <form onSubmit={submit} className="form login-form" noValidate>
            <Input label={tr('মোবাইল নম্বর বা ইমেইল', 'Mobile number or email')} autoComplete="username" placeholder="01XXXXXXXXX" required {...bind('identifier')} />
            <PasswordInput label={tr('পাসওয়ার্ড', 'Password')} autoComplete="current-password" required {...bind('password')} />
            <SubmitButton busy={busy} className="btn btn-primary btn-block login-submit">{tr('লগইন করুন', 'Log in')}</SubmitButton>
          </form>
          <div className="login-roles" aria-label={tr('যারা লগইন করতে পারেন', 'Who can log in')}>
            {[tr('কৃষক', 'Farmer'), tr('ক্রেতা', 'Buyer'), tr('সেবাদাতা', 'Provider'), tr('অ্যাডমিন', 'Admin')].map((r) => (
              <span key={r}>{r}</span>
            ))}
          </div>
          <p className="auth-switch login-switch">
            {tr('অ্যাকাউন্ট নেই?', "Don't have an account?")} <Link to="/register">{tr('বিনামূল্যে নিবন্ধন করুন', 'Register for free')}</Link>
          </p>
        </section>
      </div>
    </div>
  )
}
