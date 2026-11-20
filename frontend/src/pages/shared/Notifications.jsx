import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLang } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useFetch } from '../../hooks/useFetch'
import { del, get, patch } from '../../services/api'
import { dateTime, num, timeAgo } from '../../utils/format'
import Icon, { Glyph } from '../../components/Icon'
import { EmptyState, ErrorBox, Loader, PageHeader, Pagination, Tabs } from '../../components/ui'

const ICONS = {
  offer_new: '📩', offer_accepted: '✅', offer_rejected: '❌', booking_new: '📥', booking_status: '📅', harvest_reminder: '⏰',
  market_price: '📊', trade_update: '🤝', announcement: '📢', verification: '🛡️', message: '💬', review: '⭐', weather_alert: '⚠️',
}

export default function Notifications() {
  const { lang, tr } = useLang()
  const toast = useToast()
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [page, setPage] = useState(1)
  const { data, meta, loading, error, reload, setData } = useFetch(() => get('/notifications', { unread_only: unreadOnly, page }), [unreadOnly, page])

  async function read(n) {
    if (n.is_read) return
    await patch(`/notifications/${n.id}/read`).catch(() => {})
    setData((list) => list.map((x) => (x.id === n.id ? { ...x, is_read: 1 } : x)))
  }

  return (
    <div className="page narrow">
      <PageHeader
        title={tr('নোটিফিকেশন', 'Notifications')}
        subtitle={meta ? tr(`${num(meta.unread, lang)}টি অপঠিত`, `${num(meta.unread, lang)} unread`) : null}
        actions={<button type="button" className="btn btn-outline" onClick={async () => { const b = await patch('/notifications/read-all'); toast.success(b.message); reload() }}><Icon name="check" size={16} /> {tr('সব পড়া হয়েছে', 'Mark all read')}</button>}
      />
      <Tabs active={unreadOnly ? 'unread' : 'all'} onChange={(k) => (setUnreadOnly(k === 'unread'), setPage(1))} tabs={[{ key: 'all', label: tr('সব', 'All') }, { key: 'unread', label: tr('অপঠিত', 'Unread') }]} />
      {loading ? <Loader /> : error ? <ErrorBox error={error} onRetry={reload} /> : data.length === 0 ? (
        <EmptyState icon="🔔" title={tr('কোনো নোটিফিকেশন নেই', 'No notifications')} />
      ) : (
        <ul className="notif-list">
          {data.map((n) => (
            <li key={n.id} className={n.is_read ? '' : 'unread'}>
              <span className="notif-icon" aria-hidden="true"><Glyph value={ICONS[n.type] || '🔔'} /></span>
              <div>
                {n.link ? <Link to={n.link} onClick={() => read(n)}><strong>{n.title}</strong></Link> : <strong onClick={() => read(n)}>{n.title}</strong>}
                {n.body && <p>{n.body}</p>}
                <small title={dateTime(n.created_at, lang)}>{timeAgo(n.created_at, lang)}</small>
              </div>
              <div className="notif-actions">
                {!n.is_read && <button type="button" className="icon-btn" onClick={() => read(n)} aria-label={tr('পড়া হয়েছে', 'Mark read')}><Icon name="check" size={18} /></button>}
                <button type="button" className="icon-btn" aria-label={tr('মুছুন', 'Delete')} onClick={async () => { await del(`/notifications/${n.id}`); setData((list) => list.filter((x) => x.id !== n.id)) }}><Icon name="trash" size={18} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pagination meta={meta} onPage={setPage} />
    </div>
  )
}
