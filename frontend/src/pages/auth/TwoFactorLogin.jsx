/** Second step of signing in on a new device: enter the code that was sent. */
import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { post } from '../../services/api'
import { HOME_BY_ROLE } from '../../utils/nav'
import Icon from '../../components/Icon'
import { Checkbox, ErrorBox, Input, SubmitButton } from '../../components/ui'

const RESEND_SECONDS = 45

export default function TwoFactorLogin() {
  const { tr } = useLang()
  const { user, verifyTwoFactor } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state || {}
  const [info, setInfo] = useState(state.twoFactor || null)
  const [code, setCode] = useState('')
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [wait, setWait] = useState(RESEND_SECONDS)

  useEffect(() => {
    if (wait <= 0) return undefined
    const timer = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait])

  if (user) return <Navigate to={HOME_BY_ROLE[user.role]} replace />
  if (!info) return <Navigate to="/login" replace />

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const loggedIn = await verifyTwoFactor(info.challenge, code, remember)
      toast.success(tr(`স্বাগতম, ${loggedIn.name}!`, `Welcome, ${loggedIn.name}!`))
      const from = state.from
      navigate(from && loggedIn.role !== 'admin' ? from : HOME_BY_ROLE[loggedIn.role], { replace: true })
    } catch (err) {
      setError(err)
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  async function resend() {
    setError(null)
    try {
      const body = await post('/auth/login/resend', { challenge: info.challenge })
      setInfo((i) => ({ ...i, ...body.data }))
      setWait(RESEND_SECONDS)
      toast.success(body.message)
    } catch (err) {
      setError(err)
    }
  }

  const where = info.method === 'sms'
    ? tr(`আপনার মোবাইলে (${info.destination}) SMS-এ`, `by SMS to ${info.destination}`)
    : tr(`আপনার ইমেইলে (${info.destination})`, `to your email ${info.destination}`)

  return (
    <div className="auth-page">
      <div className="auth-card">
        <span className="auth-icon-badge"><Icon name="shield" size={24} /></span>
        <h1 className="auth-title">{tr('নতুন ডিভাইস যাচাই', 'Verify this device')}</h1>
        <p className="muted">{tr(`${where} একটি 6 সংখ্যার কোড পাঠানো হয়েছে।`, `We sent a 6-digit code ${where}.`)}</p>
        <ErrorBox error={error} />
        <form onSubmit={submit} className="form" noValidate>
          <Input
            label={tr('যাচাই কোড', 'Verification code')}
            className="code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            placeholder="••••••"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            required
          />
          <Checkbox
            label={tr(`এই ডিভাইস মনে রাখুন (${90} দিন আর কোড লাগবে না)`, 'Remember this device (no code for 90 days)')}
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <SubmitButton busy={busy} className="btn btn-primary btn-block btn-pill" disabled={busy || code.length !== 6}>
            {tr('যাচাই করে লগইন', 'Verify and log in')}
          </SubmitButton>
          <div className="code-actions">
            <button type="button" className="link-btn" disabled={wait > 0} onClick={resend}>
              {wait > 0 ? tr(`আবার কোড পাঠান (${wait})`, `Resend code (${wait}s)`) : tr('আবার কোড পাঠান', 'Resend code')}
            </button>
            <Link to="/login">{tr('অন্য অ্যাকাউন্টে লগইন', 'Use another account')}</Link>
          </div>
        </form>
        <p className="small muted mt">
          {tr('পাবলিক বা অন্যের কম্পিউটারে "মনে রাখুন" টিক দেবেন না।', 'Do not tick "Remember" on a shared or public computer.')}
        </p>
      </div>
    </div>
  )
}
