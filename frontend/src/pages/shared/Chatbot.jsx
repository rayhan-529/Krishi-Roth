/** AI agricultural assistant with saved conversations. */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useFetch } from '../../hooks/useFetch'
import { del, get, post } from '../../services/api'
import { timeAgo } from '../../utils/format'
import Icon from '../../components/Icon'
import { Alert, Loader, PageHeader, Spinner } from '../../components/ui'

const EXAMPLES = [
  ['ধানের পাতায় হলুদ দাগ কেন হচ্ছে?', 'Why are there yellow spots on rice leaves?'],
  ['ধানে কোন সার ব্যবহার করা উচিত?', 'Which fertilizer should I use for rice?'],
  ['ধান কখন কাটতে হবে?', 'When should I harvest rice?'],
  ['উৎপাদন খরচ কীভাবে কমানো যায়?', 'How can I reduce production costs?'],
  ['1 বিঘা জমিতে কত কেজি ধানের বীজ লাগে?', 'How much rice seed do I need for 1 bigha?'],
]

export default function Chatbot() {
  const { user } = useAuth()
  const { lang, tr } = useLang()
  const toast = useToast()
  const status = useFetch(() => get('/chatbot/status'), [])
  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingThread, setLoadingThread] = useState(false)
  const [error, setError] = useState(null)
  const end = useRef(null)

  const configured = status.data && status.data.configured

  useEffect(() => {
    if (user && configured) get('/chatbot/conversations').then((b) => setConversations(b.data)).catch(() => {})
  }, [user, configured])

  useEffect(() => {
    if (end.current) end.current.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [messages, sending])

  async function open(id) {
    setActiveId(id)
    setError(null)
    setLoadingThread(true)
    try {
      const body = await get(`/chatbot/conversations/${id}`)
      setMessages(body.data.messages)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoadingThread(false)
    }
  }

  function newChat() {
    setActiveId(null)
    setMessages([])
    setError(null)
  }

  async function send(question) {
    const message = (question ?? text).trim()
    if (message.length < 2 || sending) return
    setText('')
    setError(null)
    setMessages((list) => [...list, { id: `tmp-${Date.now()}`, role: 'user', content: message, created_at: new Date().toISOString() }])
    setSending(true)
    try {
      const body = await post('/chatbot/messages', { conversation_id: activeId || undefined, message, language: lang })
      setMessages((list) => [...list, body.data.reply])
      if (!activeId) {
        setActiveId(body.data.conversation_id)
        setConversations((list) => [{ id: body.data.conversation_id, title: body.data.title, updated_at: new Date().toISOString() }, ...list])
      }
    } catch (err) {
      setError(err.message)
      setText(message)
      setMessages((list) => list.slice(0, -1))
    } finally {
      setSending(false)
    }
  }

  async function remove(id) {
    try {
      await del(`/chatbot/conversations/${id}`)
      setConversations((list) => list.filter((c) => c.id !== id))
      if (activeId === id) newChat()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="page">
      <PageHeader title={tr('এআই কৃষি সহায়ক', 'AI farming assistant')} />
      {status.loading ? <Loader /> : !configured ? (
        <Alert tone="warning">
          <strong>{tr('এআই চ্যাটবট এখনো চালু করা হয়নি।', 'The AI chatbot is not configured yet.')}</strong>{' '}
          {tr('সার্ভারে AI_API_KEY দেওয়া নেই। অ্যাডমিন backend/.env ফাইলে key দিলে এটি কাজ করবে।', 'No AI_API_KEY is set on the server. It will work once an administrator adds the key to backend/.env.')}
        </Alert>
      ) : !user ? (
        <Alert tone="info">{tr('এআই সহায়ক ব্যবহার করতে লগইন করুন।', 'Please log in to use the AI assistant.')} <Link to="/login" state={{ from: '/chatbot' }}>{tr('লগইন', 'Log in')} →</Link></Alert>
      ) : (
        <div className="chat-layout">
          <aside className="chat-history">
            <button type="button" className="btn btn-primary btn-block" onClick={newChat}><Icon name="plus" size={16} /> {tr('নতুন প্রশ্ন', 'New chat')}</button>
            <ul>
              {conversations.map((c) => (
                <li key={c.id} className={c.id === activeId ? 'active' : ''}>
                  <button type="button" onClick={() => open(c.id)}>
                    <span>{c.title}</span>
                    <small>{timeAgo(c.updated_at, lang)}</small>
                  </button>
                  <button type="button" className="icon-btn" onClick={() => remove(c.id)} aria-label={tr('মুছুন', 'Delete')}><Icon name="trash" size={15} /></button>
                </li>
              ))}
            </ul>
          </aside>
          <section className="chat-main">
            <div className="chat-body" aria-live="polite">
              {loadingThread ? <Loader inline /> : messages.length === 0 ? (
                <div className="chat-welcome">
                  <p>{tr('নিচের যেকোনো প্রশ্নে চাপ দিন অথবা নিজের প্রশ্ন লিখুন:', 'Tap an example or type your own question:')}</p>
                  <div className="example-list">
                    {EXAMPLES.map(([bn, en]) => (
                      <button type="button" key={bn} onClick={() => send(tr(bn, en))}>{tr(bn, en)}</button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`bubble ${m.role === 'user' ? 'mine' : 'bot'}`}>
                    <p className="pre-line">{m.content}</p>
                  </div>
                ))
              )}
              {sending && <div className="bubble bot typing"><Spinner small /> {tr('উত্তর লেখা হচ্ছে...', 'Writing an answer...')}</div>}
              <div ref={end} />
            </div>
            {error && <Alert tone="error">{error}</Alert>}
            <form className="thread-form" onSubmit={(e) => (e.preventDefault(), send())}>
              <textarea className="input" rows={2} value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())} placeholder={tr('আপনার প্রশ্ন লিখুন...', 'Type your question...')} />
              <button type="submit" className="btn btn-primary" disabled={sending || text.trim().length < 2} aria-label={tr('পাঠান', 'Send')}><Icon name="send" size={18} /></button>
            </form>
            <p className="source-note"><Icon name="info" size={14} /> {tr('এআই-এর উত্তর সাধারণ পরামর্শ। সার/কীটনাশকের মাত্রা উপজেলা কৃষি কর্মকর্তা বা কৃষি কল সেন্টার (16123)-এ মিলিয়ে নিন।', 'AI answers are general advice. Confirm fertilizer or pesticide doses with your Upazila Agriculture Officer or the agriculture call centre (16123).')}</p>
          </section>
        </div>
      )}
    </div>
  )
}
