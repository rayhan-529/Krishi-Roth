/** Landing page for the emailed one-time sign-in link: /login/link?token=... */
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { post } from '../../services/api'
import { HOME_BY_ROLE } from '../../utils/nav'
import { ErrorBox, Loader } from '../../components/ui'

export default function LoginLink() {
  const { tr } = useLang()
  const { startSession } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token')
  const [failure, setError] = useState(null)
  const error = token ? failure : new Error(tr('লিংকটি সঠিক নয়।', 'This link is not valid.'))
  const started = useRef(false)

  useEffect(() => {
    // The link works once, so make sure it is only sent one time (StrictMode runs effects twice).
    if (started.current || !token) return
    started.current = true
    post('/auth/login-link/verify', { token })
      .then((body) => {
        const user = startSession(body.data)
        toast.success(tr(`স্বাগতম, ${user.name}!`, `Welcome, ${user.name}!`))
        navigate(HOME_BY_ROLE[user.role], { replace: true })
      })
      .catch(setError)
  }, [token, startSession, toast, navigate, tr])

  return (
    <div className="auth-page">
      <div className="auth-card">
        {error ? (
          <>
            <h1 className="auth-title">{tr('লগইন হয়নি', 'Sign-in failed')}</h1>
            <ErrorBox error={error} />
            <Link to="/login" className="btn btn-primary btn-block btn-pill">{tr('লগইন পাতায় যান', 'Go to login')}</Link>
          </>
        ) : (
          <Loader text={tr('লগইন করা হচ্ছে...', 'Signing you in...')} />
        )}
      </div>
    </div>
  )
}
