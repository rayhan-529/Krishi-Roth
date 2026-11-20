/** Forgot password: email a 6-digit code, then set a new password with it. */
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { post } from '../../services/api'
import { HOME_BY_ROLE } from '../../utils/nav'
import { num } from '../../utils/format'
import Icon from '../../components/Icon'
import { Alert, ErrorBox, Input, SubmitButton } from '../../components/ui'
import { PasswordInput } from './Login'
import PasswordChecklist from '../../components/PasswordChecklist'
import { isStrongPassword } from '../../utils/password'

const RESEND_SECONDS = 60

export default function ForgotPassword() {
  const { lang, tr } = useLang()
  const { startSession } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [notice, setNotice] = useState('')
  const [wait, setWait] = useState(0)

  useEffect(() => {
    if (wait <= 0) return undefined
    const timer = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait])

  const fe = (key) => {
    const e = fieldErrors[key]
    return e ? (typeof e === 'string' ? e : tr(e.bn, e.en)) : undefined
  }

  async function sendCode(event) {
    if (event) event.preventDefault()
    setBusy(true)
    setError(null)
    setFieldErrors({})
    try {
      const body = await post('/auth/forgot-password', { email: email.trim() })
      setNotice(body.message)
      setStep('code')
      setWait(RESEND_SECONDS)
    } catch (err) {
      setFieldErrors(err.errors || {})
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  async function reset(event) {
    event.preventDefault()
    setError(null)
    if (!isStrongPassword(password)) {
      setFieldErrors({ new_password: tr('পাসওয়ার্ডে কমপক্ষে 6 অক্ষর, একটি অক্ষর, একটি সংখ্যা ও একটি চিহ্ন (@ # $ !) দিন।', 'Use at least 6 characters with a letter, a number and a symbol (@ # $ !).') })
      return
    }
    if (password !== confirm) {
      setFieldErrors({ confirm: tr('দুটি পাসওয়ার্ড মিলছে না।', 'The passwords do not match.') })
      return
    }
    setBusy(true)
    setFieldErrors({})
    try {
      const body = await post('/auth/reset-password', { email: email.trim(), code, new_password: password })
      const user = startSession(body.data)
      toast.success(body.message)
      navigate(HOME_BY_ROLE[user.role], { replace: true })
    } catch (err) {
      setFieldErrors(err.errors || {})
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <span className="auth-icon-badge"><Icon name={step === 'email' ? 'mail' : 'shield'} size={24} /></span>
        <h1 className="auth-title">{step === 'email' ? tr('পাসওয়ার্ড রিসেট', 'Reset password') : tr('কোড দিন', 'Enter the code')}</h1>
        <p className="muted">
          {step === 'email'
            ? tr('আপনার ইমেইলে একটি 6 সংখ্যার কোড পাঠানো হবে।', "We'll email you a 6-digit code.")
            : tr(`${email} ঠিকানায় পাঠানো কোড ও নতুন পাসওয়ার্ড দিন।`, `Enter the code sent to ${email} and a new password.`)}
        </p>
        <ErrorBox error={error} />

        {step === 'email' ? (
          <form onSubmit={sendCode} className="form" noValidate>
            <Input label={tr('ইমেইল', 'Email')} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={fe('email')} required />
            <SubmitButton busy={busy} className="btn btn-primary btn-block btn-pill">{tr('কোড পাঠান', 'Send code')}</SubmitButton>
          </form>
        ) : (
          <form onSubmit={reset} className="form" noValidate>
            {notice && <Alert tone="success">{notice}</Alert>}
            <Input
              label={tr('6 সংখ্যার কোড', '6-digit code')}
              className="code-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              error={fe('code')}
              required
            />
            <PasswordInput label={tr('নতুন পাসওয়ার্ড', 'New password')} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={fe('new_password')} required />
            <PasswordChecklist password={password} />
            <PasswordInput label={tr('পাসওয়ার্ড আবার লিখুন', 'Confirm password')} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={fe('confirm')} required />
            <SubmitButton busy={busy} className="btn btn-primary btn-block btn-pill" disabled={busy || code.length !== 6}>{tr('পাসওয়ার্ড পরিবর্তন করুন', 'Reset password')}</SubmitButton>
            <div className="code-actions">
              <button type="button" className="link-btn" disabled={wait > 0 || busy} onClick={() => sendCode()}>
                {wait > 0 ? tr(`আবার পাঠান (${num(wait, lang)})`, `Resend code (${wait}s)`) : tr('আবার কোড পাঠান', 'Resend code')}
              </button>
              <button type="button" className="link-btn" onClick={() => { setStep('email'); setCode(''); setError(null) }}>{tr('ইমেইল বদলান', 'Change email')}</button>
            </div>
          </form>
        )}

        <p className="auth-switch">
          <Link to="/login">{tr('লগইনে ফিরে যান', 'Back to login')}</Link>
        </p>
      </div>
    </div>
  )
}
