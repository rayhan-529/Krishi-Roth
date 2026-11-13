/** Buyer <-> farmer messages. Left: conversations. Right: the open conversation. */
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useFetch } from '../../hooks/useFetch'
import { get, post } from '../../services/api'
import { pick, timeAgo } from '../../utils/format'
import Icon from '../../components/Icon'
import { Avatar, EmptyState, ErrorBox, Loader, PageHeader } from '../../components/ui'

function Thread({ id, onSent }) {
  const { user } = useAuth()
  const { lang, tr } = useLang()
  const toast = useToast()
  const { data, loading, error, reload, setData } = useFetch(() => get(`/conversations/${id}`), [id])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef(null)

  useEffect(() => {
    const timer = setInterval(reload, 20000) // check for replies
    return () => clearInterval(timer)
  }, [reload])

  useEffect(() => {
    if (end.current) end.current.scrollIntoView({ block: 'end' })
  }, [data])

  async function send(event) {
    event.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    try {
      const body = await post(`/conversations/${id}/messages`, { body: text.trim() })
      setData((d) => ({ ...d, messages: [...d.messages, body.data] }))
      setText('')
      onSent()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading && !data) return <Loader />
  if (error) return <ErrorBox error={error} onRetry={reload} />
  const c = data.conversation
  const otherName = c.farmer_id === user.id ? c.buyer_name : c.farmer_name

  return (
    <div className="thread">
      <div className="thread-head">
        <strong>{otherName}</strong>
        {c.listing_id && <Link to={`/listings/${c.listing_id}`} className="small">🌾 {pick(c, 'crop', lang)}</Link>}
      </div>
      <div className="thread-body">
        {data.messages.map((m) => (
          <div key={m.id} className={`bubble ${m.sender_id === user.id ? 'mine' : ''}`}>
            <p>{m.body}</p>
            <small>{timeAgo(m.created_at, lang)}</small>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="thread-form">
        <textarea className="input" rows={2} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder={tr('বার্তা লিখুন...', 'Write a message...')} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send(e)} />
        <button type="submit" className="btn btn-primary" disabled={busy || !text.trim()} aria-label={tr('পাঠান', 'Send')}><Icon name="send" size={18} /></button>
      </form>
    </div>
  )
}

export default function Messages() {
  const { id } = useParams()
  const { lang, tr } = useLang()
  const navigate = useNavigate()
  const list = useFetch(() => get('/conversations'), [id])

  return (
    <div className="page">
      <PageHeader title={tr('বার্তা', 'Messages')} subtitle={tr('ক্রেতা ও কৃষকের মধ্যে সরাসরি কথা', 'Direct conversations between buyers and farmers')} />
      <div className={`messenger ${id ? 'has-thread' : ''}`}>
        <aside className="conversations">
          {list.loading && !list.data ? <Loader inline /> : list.error ? <ErrorBox error={list.error} /> : list.data.length === 0 ? (
            <EmptyState icon="💬" title={tr('কোনো বার্তা নেই', 'No messages')} text={tr('ফসলের বিজ্ঞাপন থেকে কৃষককে বার্তা পাঠানো যায়।', 'You can message a farmer from a crop listing.')} />
          ) : (
            <ul>
              {list.data.map((c) => (
                <li key={c.id}>
                  <button type="button" className={String(c.id) === id ? 'active' : ''} onClick={() => navigate(`/messages/${c.id}`)}>
                    <Avatar src={c.other_photo} name={c.other_name} size={40} />
                    <span>
                      <strong>{c.other_name}</strong>
                      <small>{pick(c, 'crop', lang)} · {timeAgo(c.last_message_at, lang)}</small>
                      <em>{c.last_message}</em>
                    </span>
                    {c.unread > 0 && <span className="dot-count static">{c.unread}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <section className="thread-pane">
          {id ? (
            <>
              <button type="button" className="btn btn-ghost btn-sm back-mobile" onClick={() => navigate('/messages')}><Icon name="chevronLeft" size={16} /> {tr('সব বার্তা', 'All messages')}</button>
              <Thread id={id} onSent={list.reload} />
            </>
          ) : (
            <EmptyState icon="💬" title={tr('একটি কথোপকথন বেছে নিন', 'Choose a conversation')} />
          )}
        </section>
      </div>
    </div>
  )
}
