/**
 * Live notifications for the logged-in user.
 *
 *   const n = useNotifications()
 *   n.unread            // unread count for the bell
 *   n.recent            // latest notifications for the dropdown (null until loaded)
 *   n.loadRecent()      // (re)load the dropdown list
 *   n.markRead(item)    n.markAllRead()    n.remove(id)
 *   n.onNew(fn)         // subscribe to new notifications; returns an unsubscribe function
 *   n.onEvent('trade_map', fn)  // other live events (delivery map); 'ready' fires on every (re)connect
 *
 * How "live" works: the backend keeps a Server-Sent Events stream open
 * (/api/notifications/stream). EventSource cannot send the login header, so
 * a one-time ticket is fetched first. If the stream drops it reconnects with
 * a fresh ticket (backing off up to 30 s) and reloads the count, so nothing
 * is missed. While it is disconnected the count is polled every minute.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'
import { API_URL, del, get, patch, post } from '../services/api'

const NotificationContext = createContext(null)
const RECENT_LIMIT = 12
const POLL_MS = 60000

export function NotificationProvider({ children }) {
  const { user } = useAuth()
  const toast = useToast()
  const location = useLocation()
  const [unread, setUnread] = useState(0)
  const [recent, setRecent] = useState(null)
  const [live, setLive] = useState(false)
  const listeners = useRef(new Set())
  const eventListeners = useRef(new Map()) // event name -> Set<fn>
  const pathRef = useRef(location.pathname)
  const recentLoaded = useRef(false)

  useEffect(() => {
    pathRef.current = location.pathname
  }, [location.pathname])
  const userId = user ? user.id : null

  const refreshUnread = useCallback(() => {
    get('/notifications/unread-count')
      .then((b) => setUnread(b.data.unread))
      .catch(() => {})
  }, [])

  const loadRecent = useCallback(() => {
    return get('/notifications', { limit: RECENT_LIMIT })
      .then((b) => {
        recentLoaded.current = true
        setRecent(b.data)
        if (b.meta) setUnread(b.meta.unread)
      })
      .catch(() => setRecent((list) => list || []))
  }, [])

  // ---- live stream -----------------------------------------------------
  useEffect(() => {
    setUnread(0)
    setRecent(null)
    recentLoaded.current = false
    if (!userId) return undefined

    let source = null
    let retryTimer = null
    let stopped = false
    let attempt = 0
    let isLive = false

    const markLive = (value) => {
      isLive = value
      setLive(value)
    }

    function scheduleReconnect() {
      if (stopped || retryTimer) return
      const delay = Math.min(30000, 2000 * 2 ** attempt) + Math.random() * 1000
      attempt += 1
      retryTimer = setTimeout(() => {
        retryTimer = null
        connect()
      }, delay)
    }

    async function connect() {
      if (stopped || typeof EventSource === 'undefined') return
      let ticket
      try {
        ticket = (await post('/notifications/stream-ticket')).data.ticket
      } catch {
        scheduleReconnect()
        return
      }
      if (stopped) return

      source = new EventSource(`${API_URL}/api/notifications/stream?ticket=${encodeURIComponent(ticket)}`)

      const emit = (name, data) => (eventListeners.current.get(name) || []).forEach((fn) => fn(data))

      source.addEventListener('ready', (event) => {
        attempt = 0
        markLive(true)
        setUnread(JSON.parse(event.data).unread)
        // Anything that arrived while we were offline shows up in the dropdown.
        if (recentLoaded.current) loadRecent()
        emit('ready', null)
      })

      source.addEventListener('trade_map', (event) => emit('trade_map', JSON.parse(event.data)))

      source.addEventListener('notification', (event) => {
        const { notification, unread: count } = JSON.parse(event.data)
        setUnread(count)
        setRecent((list) => (list ? [notification, ...list.filter((n) => n.id !== notification.id)].slice(0, RECENT_LIMIT) : list))
        listeners.current.forEach((fn) => fn(notification))
        // No pop-up when the person is already looking at that page (e.g. the open chat).
        if (notification.link !== pathRef.current) toast.info(notification.title)
      })

      source.addEventListener('unread', (event) => setUnread(JSON.parse(event.data).unread))

      // Logged out / blocked elsewhere: the next normal API call gets 401 and logs this tab out.
      source.addEventListener('session_end', () => refreshUnread())

      source.onerror = () => {
        // A one-time ticket cannot be reused, so close and reconnect with a new one.
        source.close()
        source = null
        markLive(false)
        scheduleReconnect()
      }
    }

    refreshUnread()
    connect()

    const poll = setInterval(() => {
      if (!isLive) refreshUnread()
    }, POLL_MS)

    const reconnectNow = () => {
      if (isLive || stopped || document.visibilityState === 'hidden') return
      clearTimeout(retryTimer)
      retryTimer = null
      attempt = 0
      if (!source) connect()
    }
    window.addEventListener('online', reconnectNow)
    document.addEventListener('visibilitychange', reconnectNow)

    return () => {
      stopped = true
      clearTimeout(retryTimer)
      clearInterval(poll)
      window.removeEventListener('online', reconnectNow)
      document.removeEventListener('visibilitychange', reconnectNow)
      if (source) source.close()
      setLive(false)
    }
  }, [userId, loadRecent, refreshUnread, toast])

  // ---- tab title shows the unread count, like "(3) Krishi Roth" ----------
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\+?\)\s*/, '')
    document.title = unread > 0 ? `(${unread > 99 ? '99+' : unread}) ${base}` : base
  }, [unread])

  // ---- actions -----------------------------------------------------------
  const markRead = useCallback(async (item) => {
    if (!item || item.is_read) return
    setRecent((list) => list && list.map((n) => (n.id === item.id ? { ...n, is_read: 1 } : n)))
    setUnread((count) => Math.max(0, count - 1))
    await patch(`/notifications/${item.id}/read`).catch(() => {})
  }, [])

  const markAllRead = useCallback(async () => {
    setRecent((list) => list && list.map((n) => ({ ...n, is_read: 1 })))
    setUnread(0)
    return patch('/notifications/read-all')
  }, [])

  const remove = useCallback(
    async (id) => {
      setRecent((list) => list && list.filter((n) => n.id !== id))
      await del(`/notifications/${id}`)
      refreshUnread()
    },
    [refreshUnread],
  )

  const onNew = useCallback((fn) => {
    listeners.current.add(fn)
    return () => listeners.current.delete(fn)
  }, [])

  const onEvent = useCallback((name, fn) => {
    if (!eventListeners.current.has(name)) eventListeners.current.set(name, new Set())
    eventListeners.current.get(name).add(fn)
    return () => eventListeners.current.get(name).delete(fn)
  }, [])

  const value = useMemo(
    () => ({ unread, recent, live, loadRecent, refreshUnread, markRead, markAllRead, remove, onNew, onEvent }),
    [unread, recent, live, loadRecent, refreshUnread, markRead, markAllRead, remove, onNew, onEvent],
  )

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotifications() {
  return useContext(NotificationContext)
}
