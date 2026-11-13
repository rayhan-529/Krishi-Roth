/**
 * Logged-in user state. One login for every role, including admin.
 *   const { user, login, register, logout, refreshUser } = useAuth()
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { get, getToken, onUnauthorized, post, setToken } from '../services/api'
import { useLang } from './LanguageContext'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const { setLang } = useLang()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(Boolean(getToken()))

  const clearSession = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  // When any request answers 401, the session is over.
  useEffect(() => {
    onUnauthorized(clearSession)
  }, [clearSession])

  // Restore the session after a page reload.
  useEffect(() => {
    if (!getToken()) return
    get('/auth/me')
      .then((body) => setUser(body.data.user))
      .catch(() => clearSession())
      .finally(() => setLoading(false))
  }, [clearSession])

  const startSession = useCallback(
    (data) => {
      setToken(data.token)
      setUser(data.user)
      if (data.user.preferred_language) setLang(data.user.preferred_language)
      return data.user
    },
    [setLang],
  )

  const login = useCallback(async (identifier, password) => {
    const body = await post('/auth/login', { identifier, password })
    return startSession(body.data)
  }, [startSession])

  const register = useCallback(async (values) => {
    const body = await post('/auth/register', values)
    return startSession(body.data)
  }, [startSession])

  const logout = useCallback(async () => {
    try {
      await post('/auth/logout')
    } catch {
      // The session is cleared locally even if the server cannot be reached.
    }
    clearSession()
  }, [clearSession])

  const refreshUser = useCallback(async () => {
    const body = await get('/auth/me')
    setUser(body.data.user)
    return body.data.user
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshUser, startSession, setUser }),
    [user, loading, login, register, logout, refreshUser, startSession],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
