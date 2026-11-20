/**
 * Floating "Roth Sahayak" button in the corner of every page (logged-in users).
 * Opens a small chat panel that uses the same chatbot API as the full page,
 * so a conversation started here also appears on /chatbot.
 */
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import { get, post } from '../services/api'
import Icon from './Icon'
import { Spinner } from './ui'
import { ChatMessage, MicButton, useVoiceInput } from './ChatParts'

const STORE_KEY = 'kr_widget_chat'

const QUICK = [
  ['আজ আলুর দাম কত?', 'Potato price today?'],
  ['কাল কি বৃষ্টি হবে?', 'Will it rain tomorrow?'],
  ['ব্যালেন্স কীভাবে যোগ করব?', 'How do I add balance?'],
]

function readStore() {
  try {
    return JSON.parse(sessionStorage.getItem(STORE_KEY)) || null
  } catch {
    return null
  }
}

export default function ChatWidget() {
  const { user } = useAuth()
  const { lang, tr } = useLang()
  const { pathname } = useLocation()
  const [configured, setConfigured] = useState(false)
  const [open, setOpen] = useState(false)
  const [conversationId, setConversationId] = useState(() => readStore()?.id || null)
  const [messages, setMessages] = useState(() => readStore()?.messages || [])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const end = useRef(null)
  const voice = useVoiceInput(setText)

  useEffect(() => {
    if (user) get('/chatbot/status').then((b) => setConfigured(Boolean(b.data.configured))).catch(() => {})
  }, [user])

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify({ id: conversationId, messages: messages.slice(-20) }))
    } catch {
      // private mode: the chat just is not remembered
    }
  }, [conversationId, messages])

  useEffect(() => {
    if (open && end.current) end.current.scrollIntoView({ block: 'end' })
  }, [open, messages, sending])

  if (!user || !configured || pathname.startsWith('/chatbot')) return null

  async function send(question) {
    const message = (question ?? text).trim()
    if (message.length < 2 || sending) return
    if (voice.listening) voice.stop()
    setText('')
    setError(null)
    setMessages((list) => [...list, { id: `tmp-${Date.now()}`, role: 'user', content: message }])
    setSending(true)
    try {
      const body = await post('/chatbot/messages', { conversation_id: conversationId || undefined, message, language: lang })
      setConversationId(body.data.conversation_id)
      setMessages((list) => [...list, body.data.reply])
    } catch (err) {
      setError(err.message)
      setText(message)
      setMessages((list) => list.slice(0, -1))
    } finally {
      setSending(false)
    }
  }

  function reset() {
    setConversationId(null)
    setMessages([])
    setError(null)
  }

  return (
    <>
      {open && (
        <section className="chat-widget" aria-label={tr('রথ সহায়ক', 'Roth Sahayak')}>
          <header>
            <span className="chat-widget-avatar"><Icon name="bot" size={20} /></span>
            <span className="chat-widget-title">
              <strong>{tr('রথ সহায়ক', 'Roth Sahayak')}</strong>
              <small>{tr('কৃষি ও কৃষি রথ বিষয়ে জিজ্ঞেস করুন', 'Ask about farming and Krishi Roth')}</small>
            </span>
            <button type="button" className="icon-btn" onClick={reset} title={tr('নতুন প্রশ্ন', 'New chat')} aria-label={tr('নতুন প্রশ্ন', 'New chat')}><Icon name="plus" size={18} /></button>
            <Link to={conversationId ? `/chatbot?c=${conversationId}` : '/chatbot'} className="icon-btn" onClick={() => setOpen(false)} title={tr('পুরো পেজে খুলুন', 'Open full page')} aria-label={tr('পুরো পেজে খুলুন', 'Open full page')}><Icon name="arrowRight" size={18} /></Link>
            <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label={tr('বন্ধ করুন', 'Close')}><Icon name="close" size={18} /></button>
          </header>
          <div className="chat-widget-body" aria-live="polite">
            {messages.length === 0 && (
              <div className="chat-welcome">
                <p>{tr(`আসসালামু আলাইকুম, ${user.name}! আমি রথ সহায়ক। কী জানতে চান?`, `Hello ${user.name}! I am Roth Sahayak. How can I help?`)}</p>
                <div className="example-list">
                  {QUICK.map(([bn, en]) => <button type="button" key={bn} onClick={() => send(tr(bn, en))}>{tr(bn, en)}</button>)}
                </div>
              </div>
            )}
            {messages.map((m) => <ChatMessage key={m.id} message={m} />)}
            {sending && <div className="bubble bot typing"><Spinner small /> {tr('উত্তর লেখা হচ্ছে...', 'Writing an answer...')}</div>}
            {error && <p className="chat-widget-error">{error}</p>}
            <div ref={end} />
          </div>
          <form className="chat-widget-form" onSubmit={(e) => (e.preventDefault(), send())}>
            <MicButton voice={voice} />
            <input
              className="input"
              value={text}
              maxLength={2000}
              onChange={(e) => setText(e.target.value)}
              placeholder={voice.listening ? tr('বলুন, শুনছি...', 'Listening...') : tr('প্রশ্ন লিখুন...', 'Type a question...')}
            />
            <button type="submit" className="btn btn-primary" disabled={sending || text.trim().length < 2} aria-label={tr('পাঠান', 'Send')}><Icon name="send" size={18} /></button>
          </form>
        </section>
      )}
      <button type="button" className={`chat-fab ${open ? 'open' : ''}`} onClick={() => setOpen((v) => !v)} aria-label={tr('রথ সহায়ক', 'Roth Sahayak')} aria-expanded={open}>
        <Icon name={open ? 'close' : 'bot'} size={26} />
        {!open && <span className="chat-fab-label">{tr('সহায়ক', 'Help')}</span>}
      </button>
    </>
  )
}
