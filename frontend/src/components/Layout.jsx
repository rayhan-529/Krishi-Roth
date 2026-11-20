/**
 * Page frame: header (brand, language switch, notifications, account menu),
 * a role-based menu (sidebar for logged-in users, top links for visitors)
 * and the footer.
 */
import { Suspense, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import { get, patch } from '../services/api'
import { label } from '../utils/labels'
import { num } from '../utils/format'
import { GUEST_TOP, HOME_BY_ROLE, NAV_ICON, menuFor } from '../utils/nav'
import Icon from './Icon'
import { Avatar, Loader } from './ui'
import Footer from './Footer'
import ChatWidget from './ChatWidget'

export function BrandMark({ size = 34 }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size }} aria-hidden="true">
      <Icon name="wheat" size={Math.round(size * 0.58)} />
    </span>
  )
}

function Brand() {
  const { tr } = useLang()
  return (
    <Link to="/" className="brand" aria-label="Krishi Roth">
      <BrandMark />
      <strong>{tr('কৃষি রথ', 'Krishi Roth')}</strong>
    </Link>
  )
}

function LanguageSwitch() {
  const { lang, setLang } = useLang()
  const { user } = useAuth()
  function change(next) {
    setLang(next)
    if (user) patch('/profile/language', { preferred_language: next }).catch(() => {})
  }
  return (
    <div className="lang-switch" role="group" aria-label="Language">
      <button type="button" className={lang === 'bn' ? 'active' : ''} onClick={() => change('bn')}>বাং</button>
      <button type="button" className={lang === 'en' ? 'active' : ''} onClick={() => change('en')}>EN</button>
    </div>
  )
}

/** Bell with the unread count, refreshed every minute. */
function NotificationBell() {
  const { lang, tr } = useLang()
  const location = useLocation()
  const [counts, setCounts] = useState({ unread: 0, unread_messages: 0 })

  useEffect(() => {
    let alive = true
    const load = () => get('/notifications/unread-count').then((b) => alive && setCounts(b.data)).catch(() => {})
    load()
    const timer = setInterval(load, 60000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [location.pathname])

  return (
    <Link to="/notifications" className="icon-btn bell" aria-label={tr('নোটিফিকেশন', 'Notifications')}>
      <Icon name="bell" />
      {counts.unread > 0 && <span className="dot-count">{num(Math.min(counts.unread, 99), lang)}</span>}
    </Link>
  )
}

function AccountMenu() {
  const { user, logout } = useAuth()
  const { lang, tr } = useLang()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const close = (event) => ref.current && !ref.current.contains(event.target) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <div className="account" ref={ref}>
      <button type="button" className="account-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Avatar src={user.profile_photo} name={user.name} size={34} />
        <span className="account-name">
          <strong>{user.name}</strong>
          <small>{label('role', user.role, lang)}</small>
        </span>
      </button>
      {open && (
        <div className="account-menu" onClick={() => setOpen(false)}>
          <Link to={HOME_BY_ROLE[user.role]}><Icon name="chart" size={18} /> {tr('ড্যাশবোর্ড', 'Dashboard')}</Link>
          <Link to="/profile"><Icon name="user" size={18} /> {tr('আমার প্রোফাইল', 'My profile')}</Link>
          <Link to="/notifications"><Icon name="bell" size={18} /> {tr('নোটিফিকেশন', 'Notifications')}</Link>
          {user.role !== 'admin' && <Link to="/complaints"><Icon name="info" size={18} /> {tr('অভিযোগ ও সহায়তা', 'Complaints & help')}</Link>}
          <button
            type="button"
            onClick={async () => {
              await logout()
              navigate('/login')
            }}
          >
            <Icon name="logout" size={18} /> {tr('লগআউট', 'Log out')}
          </button>
        </div>
      )}
    </div>
  )
}

function MenuLinks({ onNavigate, top }) {
  const { user } = useAuth()
  const { tr } = useLang()
  const roots = ['/', '/farmer', '/buyer', '/provider', '/admin']
  const items = top ? menuFor(user).filter(([path]) => GUEST_TOP.includes(path)) : menuFor(user)
  return items.map(([path, bn, en]) => (
    <NavLink key={path} to={path} end={roots.includes(path)} onClick={onNavigate}>
      {!top && <Icon name={NAV_ICON[path] || 'chevronRight'} size={18} />}
      <span>{tr(bn, en)}</span>
    </NavLink>
  ))
}

export default function Layout() {
  const { user } = useAuth()
  const { tr } = useLang()
  const location = useLocation()
  const [drawer, setDrawer] = useState(false)

  useEffect(() => {
    setDrawer(false)
  }, [location.pathname])
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <div className={`app-shell ${user ? 'with-sidebar' : ''}`}>
      <a href="#main" className="skip-link">{tr('মূল অংশে যান', 'Skip to content')}</a>
      <header className="topbar">
        <div className="topbar-inner">
          <button type="button" className="icon-btn menu-btn" onClick={() => setDrawer(true)} aria-label={tr('মেনু', 'Menu')}>
            <Icon name="menu" />
          </button>
          <Brand />
          {!user && (
            <nav className="top-nav" aria-label={tr('প্রধান মেনু', 'Main menu')}>
              <MenuLinks top />
            </nav>
          )}
          <div className="topbar-actions">
            <LanguageSwitch />
            {user ? (
              <>
                <NotificationBell />
                <AccountMenu />
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost btn-sm">{tr('লগইন', 'Log in')}</Link>
                <Link to="/register" className="btn btn-primary btn-sm">{tr('নিবন্ধন', 'Register')}</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {drawer && <div className="drawer-backdrop" onClick={() => setDrawer(false)} />}
      <aside className={`sidebar ${drawer ? 'open' : ''}`} aria-label={tr('মেনু', 'Menu')}>
        <div className="sidebar-head">
          <Brand />
          <button type="button" className="icon-btn" onClick={() => setDrawer(false)} aria-label={tr('বন্ধ করুন', 'Close')}>
            <Icon name="close" />
          </button>
        </div>
        <nav className="side-nav">
          <MenuLinks onNavigate={() => setDrawer(false)} />
        </nav>
      </aside>

      <main id="main" className="main">
        <Suspense fallback={<Loader />}>
          <Outlet />
        </Suspense>
      </main>

      <Footer />
      <ChatWidget />
    </div>
  )
}
