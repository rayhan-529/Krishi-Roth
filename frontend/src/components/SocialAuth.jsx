/**
 * "Continue with Google / Apple" buttons.
 *
 * Each button gets a signed ID token from the provider in the browser and
 * hands it to onToken(provider, idToken, name). The backend verifies it.
 * When a provider's client id is not set, the button still shows and
 * explains that the option is not switched on yet.
 */
import { useEffect, useRef, useState } from 'react'
import { useLang } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { Spinner } from './ui'

const GOOGLE_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const APPLE_ID = import.meta.env.VITE_APPLE_CLIENT_ID || ''
const APPLE_REDIRECT = import.meta.env.VITE_APPLE_REDIRECT_URI || `${window.location.origin}/login`

const scripts = {}
function loadScript(src) {
  if (!scripts[src]) {
    scripts[src] = new Promise((resolve, reject) => {
      const el = document.createElement('script')
      el.src = src
      el.async = true
      el.onload = resolve
      el.onerror = () => {
        delete scripts[src]
        reject(new Error('script'))
      }
      document.head.appendChild(el)
    })
  }
  return scripts[src]
}

export function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

export function AppleLogo() {
  return (
    <svg width="18" height="20" viewBox="0 0 384 470" aria-hidden="true" fill="currentColor">
      <path d="M318.7 248.6c-.6-56.4 46-83.5 48.1-84.8-26.2-38.3-67-43.6-81.5-44.2-34.7-3.5-67.7 20.4-85.3 20.4-17.6 0-44.8-19.9-73.6-19.4-37.9.6-72.8 22-92.3 55.9-39.3 68.2-10 169.2 28.3 224.6 18.7 27.1 41 57.5 70.3 56.4 28.2-1.1 38.9-18.3 73-18.3 34.1 0 43.7 18.3 73.6 17.7 30.4-.5 49.6-27.6 68.2-54.8 21.5-31.4 30.3-61.8 30.8-63.4-.7-.3-59.1-22.7-59.6-90.1zM262.6 83.1c15.5-18.8 26-44.9 23.1-70.9-22.4.9-49.5 14.9-65.6 33.7-14.4 16.6-27 43.2-23.6 68.7 25 1.9 50.5-12.7 66.1-31.5z" />
    </svg>
  )
}

/** Google's own button (renders with the official look once the script loads). */
function GoogleButton({ onToken, text }) {
  const { lang, tr } = useLang()
  const toast = useToast()
  const holder = useRef(null)
  const [ready, setReady] = useState(false)
  const callback = useRef(onToken)
  useEffect(() => {
    callback.current = onToken
  }, [onToken])

  useEffect(() => {
    if (!GOOGLE_ID) return undefined
    let alive = true
    loadScript('https://accounts.google.com/gsi/client')
      .then(() => {
        if (!alive || !holder.current || !window.google) return
        window.google.accounts.id.initialize({
          client_id: GOOGLE_ID,
          callback: (res) => res.credential && callback.current('google', res.credential),
          ux_mode: 'popup',
        })
        window.google.accounts.id.renderButton(holder.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text,
          locale: lang === 'bn' ? 'bn' : 'en',
          width: Math.min(400, holder.current.offsetWidth || 400),
        })
        setReady(true)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [lang, text])

  if (!GOOGLE_ID) {
    return (
      <button type="button" className="social-btn" onClick={() => toast.info(tr('Google লগইন এখনো চালু করা হয়নি।', 'Google sign-in is not set up yet.'))}>
        <GoogleLogo /> {text === 'signup_with' ? tr('Google দিয়ে নিবন্ধন', 'Sign up with Google') : tr('Google দিয়ে চালিয়ে যান', 'Continue with Google')}
      </button>
    )
  }
  return (
    <div className="google-holder">
      {!ready && <div className="social-btn is-loading"><GoogleLogo /> {tr('Google লোড হচ্ছে...', 'Loading Google...')}</div>}
      <div ref={holder} className="google-btn" />
    </div>
  )
}

function AppleButton({ onToken, label }) {
  const { tr } = useLang()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  async function signIn() {
    if (!APPLE_ID) {
      toast.info(tr('Apple লগইন এখনো চালু করা হয়নি।', 'Apple sign-in is not set up yet.'))
      return
    }
    setBusy(true)
    try {
      await loadScript('https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js')
      window.AppleID.auth.init({ clientId: APPLE_ID, scope: 'name email', redirectURI: APPLE_REDIRECT, usePopup: true })
      const res = await window.AppleID.auth.signIn()
      const n = res.user && res.user.name
      const name = n ? [n.firstName, n.lastName].filter(Boolean).join(' ') : null
      await onToken('apple', res.authorization.id_token, name)
    } catch (err) {
      if (!err || err.error !== 'popup_closed_by_user') toast.error(tr('Apple লগইন সম্পন্ন হয়নি।', 'Apple sign-in did not complete.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <button type="button" className="social-btn" onClick={signIn} disabled={busy}>
      {busy ? <Spinner /> : <AppleLogo />} {label}
    </button>
  )
}

/**
 * @param {{ onToken: (provider, idToken, name?) => Promise<void>, signup?: boolean, children?: any }} props
 * children are extra buttons placed after Apple (e.g. the email link button).
 */
export default function SocialButtons({ onToken, signup, children }) {
  const { tr } = useLang()
  return (
    <div className="social-stack">
      <GoogleButton onToken={onToken} text={signup ? 'signup_with' : 'continue_with'} />
      <AppleButton onToken={onToken} label={signup ? tr('Apple দিয়ে নিবন্ধন', 'Sign up with Apple') : tr('Apple দিয়ে চালিয়ে যান', 'Continue with Apple')} />
      {children}
    </div>
  )
}

export function OrDivider() {
  const { tr } = useLang()
  return <div className="or-divider"><span>{tr('অথবা', 'OR')}</span></div>
}
