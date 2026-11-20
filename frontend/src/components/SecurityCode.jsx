/**
 * Two-step verification helpers for forms.
 *
 *   const twoFactor = useTwoFactorStatus()            // { enabled, method, ... } or null while loading
 *   <SecurityCodeField purpose="withdraw" value={code} onChange={setCode} />
 */
import { useEffect, useState } from 'react'
import { useLang } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { useFetch } from '../hooks/useFetch'
import { get, post } from '../services/api'
import { Input } from './ui'

export function useTwoFactorStatus() {
  const { data } = useFetch(() => get('/auth/2fa'), [])
  return data
}

const RESEND_SECONDS = 45

export function SecurityCodeField({ purpose, value, onChange, error, method }) {
  const { tr } = useLang()
  const toast = useToast()
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState(null)
  const [wait, setWait] = useState(0)

  useEffect(() => {
    if (wait <= 0) return undefined
    const timer = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait])

  async function sendCode() {
    setSending(true)
    try {
      const body = await post('/auth/2fa/code', { purpose, method })
      setSentTo(body.data.destination)
      setWait(RESEND_SECONDS)
      toast.success(body.message)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="security-code">
      <div className="security-code-row">
        <Input
          label={tr('যাচাই কোড', 'Verification code')}
          className="code-input code-input-sm"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="••••••"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
          error={error}
          hint={sentTo ? tr(`কোড পাঠানো হয়েছে: ${sentTo}`, `Code sent to ${sentTo}`) : tr('আগে "কোড পাঠান" চাপুন', 'Press "Send code" first')}
          required
        />
        <button type="button" className="btn btn-outline" onClick={sendCode} disabled={sending || wait > 0}>
          {wait > 0 ? `${wait}s` : sentTo ? tr('আবার পাঠান', 'Resend') : tr('কোড পাঠান', 'Send code')}
        </button>
      </div>
    </div>
  )
}
