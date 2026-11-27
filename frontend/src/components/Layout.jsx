/**
 * Page frame: header (brand, language switch, notifications, account menu),
 * a role-based menu (sidebar for logged-in users, top links for visitors)
 * and the footer.
 */
import { Suspense, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import { patch } from '../services/api'
import { useNotifications } from '../context/NotificationContext'
import { label } from '../utils/labels'
import { dateTime, num, timeAgo } from '../utils/format'
import { notificationIcon } from '../utils/notifications'
import { GUEST_TOP, HOME_BY_ROLE, NAV_ICON, menuFor } from '../utils/nav'
import Icon, { Glyph } from './Icon'
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

/**
 * Bell with a live unread count. Clicking it opens a dropdown panel
 * with the latest notifications; new ones arrive without a page refresh.
 */
function NotificationBell() {
  const { lang, tr } = useLang()
  const location = useLocation()
  const navigate = useNavigate()
  const n = useNotifications()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('all')
  const ref = useRef(null)
  const { loadRecent } = n

  useEffect(() => {
    if (!open) return undefined
    loadRecent()
    const outside = (event) => ref.current && !ref.current.contains(event.target) && setOpen(false)
    const escape = (event) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open, loadRecent])

  useEffect(() => setOpen(false), [location.pathname])

  function openItem(item) {
    n.markRead(item)
    setOpen(false)
    if (item.link) navigate(item.link)
  }

  const items = n.recent ? (tab === 'unread' ? n.recent.filter((x) => !x.is_read) : n.recent) : null

  return (
    <div className="notif-bell" ref={ref}>
      <button
        type="button"
        className={`icon-btn bell ${open ? 'active' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label={tr('নোটিফিকেশন', 'Notifications')}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Icon name="bell" />
        {n.unread > 0 && <span className="dot-count">{n.unread > 99 ? `${num(99, lang)}+` : num(n.unread, lang)}</span>}
      </button>

      {open && (
        <div className="notif-panel" role="dialog" aria-label={tr('নোটিফিকেশন', 'Notifications')}>
          <div className="notif-panel-head">
            <strong>{tr('নোটিফিকেশন', 'Notifications')}</strong>
            <span className={`live-dot ${n.live ? 'on' : ''}`} title={n.live ? tr('লাইভ', 'Live') : tr('সংযোগ হচ্ছে…', 'Connecting…')} />
            {n.unread > 0 && (
              <button type="button" className="link-btn" onClick={() => n.markAllRead().catch(() => {})}>
                {tr('সব পড়া হয়েছে', 'Mark all read')}
              </button>
            )}
          </div>
          <div className="notif-panel-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'all'} className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>{tr('সব', 'All')}</button>
            <button type="button" role="tab" aria-selected={tab === 'unread'} className={tab === 'unread' ? 'active' : ''} onClick={() => setTab('unread')}>{tr('অপঠিত', 'Unread')}</button>
          </div>

          <div className="notif-panel-body">
            {!items ? (
              <div className="notif-panel-empty">{tr('লোড হচ্ছে…', 'Loading…')}</div>
            ) : items.length === 0 ? (
              <div className="notif-panel-empty">
                <span aria-hidden="true">🔔</span>
                {tab === 'unread' ? tr('কোনো অপঠিত নোটিফিকেশন নেই', 'No unread notifications') : tr('কোনো নোটিফিকেশন নেই', 'No notifications yet')}
              </div>
            ) : (
              <ul className="notif-panel-list">
                {items.map((item) => (
                  <li key={item.id}>
                    <button type="button" className={item.is_read ? '' : 'unread'} onClick={() => openItem(item)}>
                      <span className="notif-panel-icon" aria-hidden="true"><Glyph value={notificationIcon(item.type)} /></span>
                      <span className="notif-panel-text">
                        <strong>{item.title}</strong>
                        {item.body && <span>{item.body}</span>}
                        <small title={dateTime(item.created_at, lang)}>{timeAgo(item.created_at, lang)}</small>
                      </span>
                      {!item.is_read && <span className="unread-dot" aria-label={tr('অপঠিত', 'Unread')} />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Link to="/notifications" className="notif-panel-foot">{tr('সব নোটিফিকেশন দেখুন', 'See all notifications')}</Link>
        </div>
      )}
    </div>
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
