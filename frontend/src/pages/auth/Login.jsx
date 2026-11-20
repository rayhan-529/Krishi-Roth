/** One login page for every role — farmers, buyers, providers and admins. */
import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useForm } from '../../hooks/useFetch'
import { getDeviceToken, post } from '../../services/api'
import { HOME_BY_ROLE } from '../../utils/nav'
import Icon from '../../components/Icon'
import { BrandMark } from '../../components/Layout'
import SocialButtons, { OrDivider } from '../../components/SocialAuth'
import { Alert, ErrorBox, Input, SubmitButton } from '../../components/ui'

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

/**
 * Sends a Google/Apple ID token to the server. Existing accounts are logged in;
 * new ones are sent to the registration page to finish their details.
 */
export function useSocialSignIn() {
  const { startSession } = useAuth()
  const { tr } = useLang()
  const toast = useToast()
  const navigate = useNavigate()
  return async function onToken(provider, idToken, name) {
    try {
      const body = await post('/auth/social', { provider, id_token: idToken, device_token: getDeviceToken() })
      if (body.data.two_factor_required) {
        navigate('/login/verify', { state: { twoFactor: body.data } })
        return
      }
      if (body.data.needs_registration) {
        const profile = body.data.profile || {}
        navigate('/register', { state: { social: { provider, id_token: idToken, name: profile.name || name || '', email: profile.email || '' } } })
        return
      }
      const loggedIn = startSession(body.data)
      toast.success(tr(`স্বাগতম, ${loggedIn.name}!`, `Welcome, ${loggedIn.name}!`))
      navigate(HOME_BY_ROLE[loggedIn.role], { replace: true })
    } catch (err) {
      toast.error(err.message)
    }
  }
}

/** "Email me a sign-in link" panel. */
function EmailLinkForm({ onBack }) {
  const { tr } = useLang()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(null)
  const [error, setError] = useState(null)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const body = await post('/auth/login-link', { email: email.trim() })
      setSent(body.message)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-sub">
      <button type="button" className="link-btn back-row" onClick={onBack}><Icon name="chevronLeft" size={16} /> {tr('ফিরে যান', 'Back')}</button>
      <h2>{tr('ইমেইলে লগইন লিংক', 'Email me a sign-in link')}</h2>
      {sent ? (
        <Alert tone="success">{sent}</Alert>
      ) : (
        <form onSubmit={submit} className="form" noValidate>
          <ErrorBox error={error} />
          <Input label={tr('ইমেইল', 'Email')} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <SubmitButton busy={busy} className="btn btn-primary btn-block btn-pill">{tr('লিংক পাঠান', 'Send link')}</SubmitButton>
        </form>
      )}
    </div>
  )
}

export default function Login() {
  const { tr } = useLang()
  const { user, login } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const onSocial = useSocialSignIn()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [linkMode, setLinkMode] = useState(false)
  const { values, bind, setErrors } = useForm({ identifier: '', password: '' })

  if (user) return <Navigate to={HOME_BY_ROLE[user.role]} replace />

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = await login(values.identifier.trim(), values.password)
      if (result.twoFactor) {
        navigate('/login/verify', { state: { twoFactor: result.twoFactor, from: location.state && location.state.from } })
        return
      }
      const loggedIn = result
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
    ['trend', tr('প্রতিদিনের বাজারদর', 'Daily market prices')],
    ['shield', tr('নিরাপদ লেনদেন', 'Tracked, safe trades')],
    ['tractor', tr('শ্রমিক, যন্ত্র ও পরিবহন', 'Labour, machinery & transport')],
  ]

  return (
    <div className="login-page">
      <div className="login-shell">
        <aside className="login-brand" aria-hidden="true">
          <div className="login-brand-top">
            <BrandMark size={40} />
            <span className="login-brand-name">{tr('কৃষি রথ', 'Krishi Roth')}</span>
          </div>
          <h2>{tr('কৃষকের পাশে, বাংলার কৃষির উন্নয়নে', 'Beside every farmer, growing Bangladesh')}</h2>
          <ul className="login-features">
            {features.map(([icon, title]) => (
              <li key={icon}>
                <span className="login-feature-icon"><Icon name={icon} size={18} /></span>
                <strong>{title}</strong>
              </li>
            ))}
          </ul>
        </aside>

        <section className="login-form-panel">
          {linkMode ? (
            <EmailLinkForm onBack={() => setLinkMode(false)} />
          ) : (
            <>
              <h1 className="auth-title">{tr('লগইন', 'Login')}</h1>
              <SocialButtons onToken={onSocial}>
                <button type="button" className="social-btn" onClick={() => setLinkMode(true)}>
                  <Icon name="mail" size={20} /> {tr('ইমেইলে লগইন লিংক নিন', 'Email me a sign-in link')}
                </button>
              </SocialButtons>
              <OrDivider />
              <ErrorBox error={error} />
              <form onSubmit={submit} className="form login-form" noValidate>
                <Input label={tr('মোবাইল নম্বর বা ইমেইল', 'Mobile number or email')} autoComplete="username" placeholder="01XXXXXXXXX" required {...bind('identifier')} />
                <PasswordInput label={tr('পাসওয়ার্ড', 'Password')} autoComplete="current-password" required {...bind('password')} />
                <SubmitButton busy={busy} className="btn btn-primary btn-block btn-pill login-submit">{tr('লগইন', 'Login')}</SubmitButton>
              </form>
              <p className="auth-links">
                <Link to="/forgot-password">{tr('পাসওয়ার্ড ভুলে গেছেন?', 'Forgot password?')}</Link>
              </p>
              <p className="auth-switch login-switch">
                {tr('অ্যাকাউন্ট নেই?', "Don't have an account?")} <Link to="/register">{tr('নিবন্ধন করুন', 'Sign up')}</Link>
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
