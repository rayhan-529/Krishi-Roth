
import { useEffect, useState } from 'react'
import './App.css'

const API_URL = 'http://localhost:5000/api/auth'
const ADMIN_API = 'http://localhost:5000/api/admin'

const services = [
  { icon: '📊', title: 'ফসলের বাজারদর', desc: 'সঠিক দাম জেনে সিদ্ধান্ত নিন', color: 'green', target: 'market' },
  { icon: '🤝', title: 'ক্রেতা ও বিক্রেতা', desc: 'সরাসরি যোগাযোগ করুন', color: 'yellow', target: 'market' },
  { icon: '🧮', title: 'খরচের খাতা', desc: 'খরচ, লাভ-ক্ষতি হিসাব রাখুন', color: 'blue', target: 'ledger' },
  { icon: '🚜', title: 'কৃষিযন্ত্র ও পরিবহন', desc: 'ট্রাক্টর, হারভেস্টার, পরিবহন', color: 'orange', target: 'services' },
  { icon: '👨‍🌾', title: 'শ্রমিক খুঁজুন', desc: 'কৃষিশ্রমিকদের সঙ্গে যোগাযোগ', color: 'purple', target: 'services' },
]

const fieldStyle = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  padding: '12px',
  marginTop: '6px',
  border: '1px solid #cbd5cf',
  borderRadius: '8px',
  fontSize: '16px',
}

function App() {
  const [authMode, setAuthMode] = useState('')
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('krishiUser') || 'null')
    } catch {
      return null
    }
  })

  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [showAdmin, setShowAdmin] = useState(
    window.location.pathname === '/admin'
  )
  const [adminStats, setAdminStats] = useState(null)
  const [adminUsers, setAdminUsers] = useState([])
  const [adminLoading, setAdminLoading] = useState(false)
  const [adminError, setAdminError] = useState('')

  function openAuth(mode) {
    setAuthMode(mode)
    setMessage('')
    setError('')
    setForm({ name: '', email: '', password: '' })
  }

  async function handleAuth(event) {
    event.preventDefault()
    setMessage('')
    setError('')
    setLoading(true)

    try {
      const endpoint = authMode === 'admin-login' ? 'login' : authMode

      const response = await fetch(`${API_URL}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'অনুরোধটি সম্পন্ন হয়নি।')
      }

      if (authMode === 'register') {
        setMessage('নিবন্ধন সফল হয়েছে! এখন লগইন করুন।')
        setAuthMode('login')
        setForm({ name: '', email: form.email, password: '' })
        return
      }

      if (!data.token || !data.user) {
        throw new Error('Backend থেকে Login Token অথবা User তথ্য পাওয়া যায়নি।')
      }

      if (authMode === 'admin-login' && data.user.role !== 'admin') {
        throw new Error('এই অ্যাকাউন্টটি Admin নয়।')
      }

      localStorage.setItem('krishiToken', data.token)
      localStorage.setItem('krishiUser', JSON.stringify(data.user))

      setUser(data.user)
      setAuthMode('')
      setForm({ name: '', email: '', password: '' })
      setMessage('আপনি সফলভাবে লগইন করেছেন।')

      if (data.user.role === 'admin') {
        window.history.pushState({}, '', '/admin')
        setShowAdmin(true)
      } else {
        window.history.pushState({}, '', '/')
        setShowAdmin(false)
      }
    } catch (err) {
      setError(
        err.message === 'Failed to fetch'
          ? 'Backend চালু আছে কি না দেখুন। সংযোগ করা যাচ্ছে না।'
          : err.message
      )
    } finally {
      setLoading(false)
    }
  }

  function handleLogout() {
    localStorage.removeItem('krishiToken')
    localStorage.removeItem('krishiUser')
    setUser(null)
    setShowAdmin(false)
    setAdminStats(null)
    setAdminUsers([])
    setAdminError('')

    if (window.location.pathname === '/admin') {
      window.history.pushState({}, '', '/')
    }

    setMessage('আপনি সফলভাবে লগআউট করেছেন।')
    setError('')
  }

  async function openAdminDashboard() {
    const token = localStorage.getItem('krishiToken')

    if (!token) {
      setError('প্রথমে লগইন করুন।')
      return
    }

    setAdminLoading(true)
    setAdminError('')

    try {
      const response = await fetch(`${ADMIN_API}/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        throw new Error(
          response.status === 401 || response.status === 403
            ? 'Admin অনুমতি নেই অথবা Login Session শেষ হয়েছে।'
            : 'Admin API পাওয়া যাচ্ছে না। Backend Route পরীক্ষা করুন।'
        )
      }

      const result = await response.json()

      if (result.user?.role !== 'admin') {
        throw new Error('শুধুমাত্র Admin এই পেজে প্রবেশ করতে পারবেন।')
      }

      window.history.pushState({}, '', '/admin')
      setShowAdmin(true)
      setError('')
    } catch (err) {
      setAdminError(
        err.message === 'Failed to fetch'
          ? 'Backend-এর সঙ্গে সংযোগ করা যাচ্ছে না।'
          : err.message
      )
    } finally {
      setAdminLoading(false)
    }
  }

  function returnHome() {
    window.history.pushState({}, '', '/')
    setShowAdmin(false)
    setAdminError('')
  }

  useEffect(() => {
    function handlePopState() {
      setShowAdmin(window.location.pathname === '/admin')
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (!showAdmin) return

    const token = localStorage.getItem('krishiToken')

    if (!token || user?.role !== 'admin') {
      setShowAdmin(false)
      window.history.replaceState({}, '', '/')
      setAdminError('শুধুমাত্র Admin এই পেজে প্রবেশ করতে পারবেন।')
      return
    }

    const controller = new AbortController()

    async function loadAdminData() {
      setAdminLoading(true)
      setAdminError('')

      try {
        const headers = { Authorization: `Bearer ${token}` }

        const [statsResponse, usersResponse] = await Promise.all([
          fetch(`${ADMIN_API}/stats`, {
            headers,
            signal: controller.signal,
          }),
          fetch(`${ADMIN_API}/users`, {
            headers,
            signal: controller.signal,
          }),
        ])

        if (
          [401, 403].includes(statsResponse.status) ||
          [401, 403].includes(usersResponse.status)
        ) {
          localStorage.removeItem('krishiToken')
          localStorage.removeItem('krishiUser')
          setUser(null)
          setShowAdmin(false)
          window.history.replaceState({}, '', '/')
          setAdminError('Admin অনুমতি নেই। আবার Admin হিসেবে লগইন করুন।')
          return
        }

        if (!statsResponse.ok || !usersResponse.ok) {
          throw new Error(
            'Dashboard তথ্য পাওয়া যায়নি। Backend API এবং Database পরীক্ষা করুন।'
          )
        }

        const statsData = await statsResponse.json()
        const usersData = await usersResponse.json()

        setAdminStats(statsData)
        setAdminUsers(usersData.users || [])
      } catch (err) {
        if (err.name !== 'AbortError') {
          setAdminError(err.message || 'Dashboard লোড করা যায়নি।')
        }
      } finally {
        if (!controller.signal.aborted) setAdminLoading(false)
      }
    }

    loadAdminData()
    return () => controller.abort()
  }, [showAdmin, user])

  if (showAdmin) {
    return (
      <div className="admin-page">
        <header className="admin-header">
          <div>
            <h1>🌱 Krishi Roth Admin Dashboard</h1>
            <p>স্বাগতম, {user?.name || 'Admin'}</p>
          </div>

          <div className="admin-actions">
            <button onClick={returnHome}>হোম পেজ</button>
            <button onClick={handleLogout}>লগআউট</button>
          </div>
        </header>

        {adminError && (
          <p className="admin-error" role="alert">{adminError}</p>
        )}

        {adminLoading && <p>Dashboard-এর তথ্য লোড হচ্ছে...</p>}

        <section className="admin-stats">
          <article className="admin-card">
            <h3>মোট ব্যবহারকারী</h3>
            <p>{adminStats?.totalUsers ?? '—'}</p>
          </article>
          <article className="admin-card">
            <h3>মোট কৃষক</h3>
            <p>{adminStats?.totalFarmers ?? '—'}</p>
          </article>
          <article className="admin-card">
            <h3>মোট Admin</h3>
            <p>{adminStats?.totalAdmins ?? '—'}</p>
          </article>
        </section>

        <section className="admin-users">
          <h2>ব্যবহারকারীর তালিকা</h2>
          <div className="admin-table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>নাম</th>
                  <th>ইমেইল</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {adminUsers.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.name}</td>
                    <td>{item.email}</td>
                    <td>{item.role}</td>
                  </tr>
                ))}
                {!adminLoading && adminUsers.length === 0 && (
                  <tr>
                    <td colSpan="4">কোনো ব্যবহারকারী পাওয়া যায়নি।</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="top-strip">
        🌱 কৃষকের পাশে, বাংলার কৃষির উন্নয়নে
        <span>সহজ বাংলা • সহজ কৃষিসেবা</span>
      </div>

      <header className="navbar">
        <a href="#home" className="brand">
          <span className="brand-icon">🌾</span>
          <span>
            <strong>কৃষি <b>রথ</b></strong>
            <small>কৃষকের পাশে, সবসময়</small>
          </span>
        </a>

        <nav className="nav-links">
          <a className="active" href="#home">⌂ হোম</a>
          <a href="#market">বাজারদর</a>
          <a href="#services">কৃষিসেবা</a>
          <a href="#market">ফসল বিক্রি</a>
          <a href="#ledger">খরচের খাতা</a>
          <a href="#about">আমাদের সম্পর্কে</a>
        </nav>

        <div className="nav-actions">
          {user ? (
            <>
              <span>স্বাগতম, {user.name}</span>
              {user.role === 'admin' && (
                <button
                  className="login-btn"
                  onClick={openAdminDashboard}
                  disabled={adminLoading}
                >
                  Admin Dashboard
                </button>
              )}
              <button className="login-btn" onClick={handleLogout}>
                লগআউট
              </button>
            </>
          ) : (
            <>
              <button className="login-btn" onClick={() => openAuth('login')}>
                লগইন
              </button>
              <button
                className="login-btn"
                onClick={() => openAuth('admin-login')}
              >
                Admin Login
              </button>
              <button
                className="register-btn"
                onClick={() => openAuth('register')}
              >
                নিবন্ধন করুন
              </button>
            </>
          )}
        </div>
      </header>

      {message && (
        <div
          role="status"
          style={{
            margin: '16px auto',
            maxWidth: 1100,
            padding: 12,
            color: '#176534',
            background: '#e8f7ec',
            borderRadius: 8,
          }}
        >
          {message}
        </div>
      )}

      {error && !authMode && (
        <div
          role="alert"
          style={{
            margin: '16px auto',
            maxWidth: 1100,
            padding: 12,
            color: '#b42318',
            background: '#fff0ee',
            borderRadius: 8,
          }}
        >
          {error}
        </div>
      )}

      {authMode && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.55)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#fff',
              color: '#183b27',
              width: '100%',
              maxWidth: 430,
              padding: 28,
              borderRadius: 16,
              boxSizing: 'border-box',
            }}
          >
            <button
              type="button"
              onClick={() => setAuthMode('')}
              aria-label="বন্ধ করুন"
              style={{
                float: 'right',
                border: 0,
                background: 'transparent',
                fontSize: 24,
                cursor: 'pointer',
              }}
            >
              ×
            </button>

            <h2 id="auth-title">
              {authMode === 'register'
                ? 'কৃষক নিবন্ধন'
                : authMode === 'admin-login'
                  ? 'Admin Login'
                  : 'কৃষি রথে লগইন'}
            </h2>

            <p>
              {authMode === 'register'
                ? 'আপনার তথ্য দিয়ে নতুন অ্যাকাউন্ট তৈরি করুন।'
                : authMode === 'admin-login'
                  ? 'Admin ইমেইল ও পাসওয়ার্ড দিয়ে প্রবেশ করুন।'
                  : 'আপনার ইমেইল ও পাসওয়ার্ড দিয়ে প্রবেশ করুন।'}
            </p>

            <form onSubmit={handleAuth}>
              {authMode === 'register' && (
                <label style={{ display: 'block', marginBottom: 14 }}>
                  আপনার নাম
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="সম্পূর্ণ নাম লিখুন"
                    autoComplete="name"
                    style={fieldStyle}
                  />
                </label>
              )}

              <label style={{ display: 'block', marginBottom: 14 }}>
                ইমেইল
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="আপনার ইমেইল"
                  autoComplete="email"
                  style={fieldStyle}
                />
              </label>

              <label style={{ display: 'block', marginBottom: 14 }}>
                পাসওয়ার্ড
                <input
                  required
                  minLength={8}
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="কমপক্ষে ৮ অক্ষর"
                  autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                  style={fieldStyle}
                />
              </label>

              {error && (
                <p
                  role="alert"
                  style={{
                    color: '#b42318',
                    background: '#fff0ee',
                    padding: 10,
                    borderRadius: 8,
                  }}
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="register-btn"
                style={{
                  width: '100%',
                  marginTop: 8,
                  padding: 12,
                  cursor: loading ? 'wait' : 'pointer',
                }}
              >
                {loading
                  ? 'অপেক্ষা করুন...'
                  : authMode === 'register'
                    ? 'নিবন্ধন সম্পন্ন করুন'
                    : authMode === 'admin-login'
                      ? 'Admin হিসেবে লগইন'
                      : 'লগইন করুন'}
              </button>
            </form>

            <p style={{ marginTop: 18, textAlign: 'center' }}>
              {authMode === 'register'
                ? 'আগে অ্যাকাউন্ট আছে? '
                : 'নতুন ব্যবহারকারী? '}
              <button
                type="button"
                onClick={() => openAuth(authMode === 'register' ? 'login' : 'register')}
                style={{
                  color: '#08733b',
                  border: 0,
                  background: 'none',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                {authMode === 'register' ? 'লগইন করুন' : 'নিবন্ধন করুন'}
              </button>
            </p>
          </div>
        </div>
      )}

      <main>
        <section className="hero" id="home">
          <div className="hero-copy">
            <div className="eyebrow">
              🌱 কৃষকের পাশে, বাংলাদেশের কৃষির উন্নয়নে
            </div>
            <h1>
              কৃষকের পরিশ্রমের
              <span>ন্যায্য মূল্য নিশ্চিত করি</span>
            </h1>
            <p className="hero-description">
              ফসলের সঠিক বাজারদর জানুন, সরাসরি ক্রেতার কাছে ফসল
              বিক্রি করুন, কৃষিসেবা খুঁজে নিন এবং নিজের খরচ ও
              লাভ-ক্ষতির হিসাব রাখুন—সবকিছু একটি প্ল্যাটফর্মে।
            </p>
            <div className="hero-buttons">
              <a className="btn-primary" href="#market">
                <span>▥</span> আজকের বাজারদর দেখুন <span>→</span>
              </a>
              <button className="btn-outline" onClick={() => openAuth('register')}>
                🛒 ফসল বিক্রির বিজ্ঞাপন দিন
              </button>
            </div>
            <div className="trust-points">
              <span>✓ সহজ বাংলা</span>
              <span>♟ কৃষকের জন্য সহজ ব্যবহার</span>
              <span>✓ নিরাপদ ব্যবহারের লক্ষ্য</span>
            </div>
          </div>

          <div className="hero-photo-wrap">
            <img
              className="hero-photo"
              src="https://commons.wikimedia.org/wiki/Special:FilePath/Rice%20harvesting%20by%20farmers%20in%20a%20wetland%20field%2C%20Bangladesh%202026%2002.jpg"
              alt="বাংলাদেশের হাওর অঞ্চলে কৃষকদের ধান কাটার বাস্তব ছবি"
            />
            <div className="photo-label">
              <span className="label-icon">🌾</span>
              <div>
                <strong>আপনার ফসল, আপনার সিদ্ধান্ত</strong>
                <p>জেনে-বুঝে ন্যায্য দামে বিক্রি করুন</p>
              </div>
            </div>
            <span className="photo-credit">
              ছবি: A S M Jobaer / Wikimedia Commons, CC BY-SA 4.0
            </span>
          </div>
        </section>

        <section className="service-shortcuts" id="services">
          {services.map((service) => (
            <a
              href={`#${service.target}`}
              className={`shortcut-card ${service.color}`}
              key={service.title}
            >
              <span className="shortcut-icon">{service.icon}</span>
              <span className="shortcut-content">
                <strong>{service.title}</strong>
                <small>{service.desc}</small>
              </span>
              <span className="shortcut-arrow">↗</span>
            </a>
          ))}
        </section>

        <section className="dashboard-grid">
          <div className="content-panel" id="market">
            <div className="panel-heading">
              <div>
                <span className="heading-icon">▥</span>
                <h2>আজকের বাজারদর</h2>
              </div>
              <span className="demo-label">তথ্য আসবে</span>
            </div>
            <p className="panel-description">
              আপনার এলাকার ফসলের দাম জেনে বিক্রির সিদ্ধান্ত নিন।
            </p>
            <div className="market-empty">
              <span>🌾</span>
              <strong>বাজারদরের তথ্য এখনো যুক্ত করা হয়নি</strong>
              <p>পরবর্তী ধাপে নির্ভরযোগ্য বাজারদরের তথ্য যুক্ত করা হবে।</p>
            </div>
          </div>

          <div className="content-panel" id="ledger">
            <div className="panel-heading">
              <div>
                <span className="heading-icon">▦</span>
                <h2>জনপ্রিয় কৃষিসেবা</h2>
              </div>
              <a className="view-link" href="#services">সব দেখুন →</a>
            </div>
            <div className="popular-service">
              <span>🚜</span>
              <div>
                <strong>ট্রাক্টর ও হারভেস্টার</strong>
                <p>জমির কাজের জন্য কৃষিযন্ত্র খুঁজুন।</p>
              </div>
            </div>
            <div className="popular-service">
              <span>🚚</span>
              <div>
                <strong>ফসল পরিবহন</strong>
                <p>ফসল বাজারে নেওয়ার পরিবহনসেবা খুঁজুন।</p>
              </div>
            </div>
            <div className="popular-service">
              <span>🧮</span>
              <div>
                <strong>কৃষকের হিসাবের খাতা</strong>
                <p>খরচ ও লাভের হিসাব রাখার সুবিধা আসছে।</p>
              </div>
            </div>
          </div>
        </section>

        <section className="about-section" id="about">
          <span className="eyebrow">আমাদের লক্ষ্য</span>
          <h2>প্রযুক্তি হোক কৃষকের শক্তি</h2>
          <p>
            কৃষি রথের লক্ষ্য হলো কৃষকদের বাজারের তথ্য, ফসল বিক্রি,
            কৃষিসেবা এবং হিসাব রাখার সুবিধা সহজ বাংলায় এক জায়গায় দেওয়া।
          </p>
          <a className="btn-primary" href="#services">সেবাগুলো দেখুন →</a>
        </section>
      </main>

      <footer className="footer">
        <a href="#home" className="brand footer-brand">
          <span className="brand-icon">🌾</span>
          <span>
            <strong>কৃষি <b>রথ</b></strong>
            <small>কৃষকের পাশে, সবসময়</small>
          </span>
        </a>
        <p>বাংলার কৃষক, বাংলার শক্তি।</p>
        <small>© 2026 কৃষি রথ। সর্বস্বত্ব সংরক্ষিত।</small>
      </footer>
    </div>
  )
}

export default App
