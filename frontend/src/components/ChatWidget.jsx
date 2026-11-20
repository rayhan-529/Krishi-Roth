/**
 * Roth Sahayak: the site's one chatbot, a floating button in the corner of
 * every page. It answers farming and site questions from the knowledge base
 * (RAG) and live data, keeps past conversations, and takes voice input.
 *
 * Anything can open it with openChat(); the old /chatbot address does too.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import { del, get, post } from '../services/api'
import { timeAgo } from '../utils/format'
import Icon from './Icon'
import { Spinner } from './ui'
import { ChatMessage, MicButton, useVoiceInput } from './ChatParts'

const STORE_KEY = 'kr_widget_chat'
const OPEN_EVENT = 'kr:open-chat'

/** Opens the chat panel from anywhere (a button, a link handler, a route). */
export function openChat() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

const QUICK = [
  ['আজ আলুর দাম কত?', 'Potato price today?'],
  ['কাল কি বৃষ্টি হবে?', 'Will it rain tomorrow?'],
  ['বোরো ধানে বিঘায় কত ইউরিয়া দেব?', 'How much urea per bigha for boro rice?'],
  ['ব্যালেন্স কীভাবে যোগ করব?', 'How do I add balance?'],
]

function readStore() {
  try {
    return JSON.parse(sessionStorage.getItem(STORE_KEY)) || null
  } catch {
    return null
  }
}

/** Past conversations, newest first; tap one to continue it. */
function History({ activeId, onOpen, onClose }) {
  const { lang, tr } = useLang()
  const [list, setList] = useState(null)

  useEffect(() => {
    get('/chatbot/conversations').then((b) => setList(b.data)).catch(() => setList([]))
  }, [])

  async function remove(id) {
    try {
      await del(`/chatbot/conversations/${id}`)
      setList((l) => l.filter((c) => c.id !== id))
      if (id === activeId) onOpen(null)
    } catch {
      // stays in the list; the user can try again
    }
  }

  return (
    <div className="chat-widget-history">
      <button type="button" className="chat-history-back" onClick={onClose}><Icon name="chevronLeft" size={16} /> {tr('চ্যাটে ফিরুন', 'Back to chat')}</button>
      {list === null ? <Spinner /> : list.length === 0 ? <p className="muted">{tr('এখনো কোনো আগের প্রশ্ন নেই।', 'No earlier chats yet.')}</p> : (
        <ul>
          {list.map((c) => (
            <li key={c.id} className={c.id === activeId ? 'active' : ''}>
              <button type="button" onClick={() => onOpen(c.id)}>
                <span>{c.title}</span>
                <small>{timeAgo(c.updated_at, lang)}</small>
              </button>
              <button type="button" className="icon-btn" onClick={() => remove(c.id)} aria-label={tr('মুছুন', 'Delete')}><Icon name="trash" size={15} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function ChatWidget() {
  const { user } = useAuth()
  const { lang, tr } = useLang()
  const { pathname } = useLocation()
  const [configured, setConfigured] = useState(false)
  const [open, setOpen] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [conversationId, setConversationId] = useState(() => readStore()?.id || null)
  const [messages, setMessages] = useState(() => readStore()?.messages || [])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingThread, setLoadingThread] = useState(false)
  const [error, setError] = useState(null)
  const end = useRef(null)
  const voice = useVoiceInput(setText)

  useEffect(() => {
    get('/chatbot/status').then((b) => setConfigured(Boolean(b.data.configured))).catch(() => {})
  }, [])

  useEffect(() => {
    const show = () => setOpen(true)
    window.addEventListener(OPEN_EVENT, show)
    return () => window.removeEventListener(OPEN_EVENT, show)
  }, [])

  // A different person logging in on this browser must not see the last chat.
  const userId = user ? user.id : null
  const lastUser = useRef(userId)
  useEffect(() => {
    if (lastUser.current !== userId) {
      setConversationId(null)
      setMessages([])
      lastUser.current = userId
    }
  }, [userId])

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify({ id: conversationId, messages: messages.slice(-20) }))
    } catch {
      // private mode: the chat just is not remembered
    }
  }, [conversationId, messages])

  useEffect(() => {
    if (open && !showHistory && end.current) end.current.scrollIntoView({ block: 'end' })
  }, [open, showHistory, messages, sending])

  const openConversation = useCallback(async (id) => {
    setShowHistory(false)
    setError(null)
    if (!id) {
      setConversationId(null)
      setMessages([])
      return
    }
    setLoadingThread(true)
    try {
      const body = await get(`/chatbot/conversations/${id}`)
      setConversationId(id)
      setMessages(body.data.messages)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingThread(false)
    }
  }, [])

  // The admin login page and the auth screens stay uncluttered.
  if (!configured || /^\/(login|register|forgot-password)/.test(pathname)) return null

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

  return (
    <>
      {open && (
        <section className="chat-widget" aria-label={tr('রথ সহায়ক', 'Roth Sahayak')}>
          <header>
            <span className="chat-widget-avatar"><Icon name="bot" size={20} /></span>
            <span className="chat-widget-title">
              <strong>{tr('রথ সহায়ক', 'Roth Sahayak')}</strong>
              <small>{tr('কৃষি, বাজারদর, আবহাওয়া ও কৃষি রথ বিষয়ে জিজ্ঞেস করুন', 'Ask about farming, prices, weather and Krishi Roth')}</small>
            </span>
            {user && (
              <>
                <button type="button" className="icon-btn" onClick={() => setShowHistory((v) => !v)} title={tr('আগের প্রশ্ন', 'Earlier chats')} aria-label={tr('আগের প্রশ্ন', 'Earlier chats')}><Icon name="clock" size={18} /></button>
                <button type="button" className="icon-btn" onClick={() => openConversation(null)} title={tr('নতুন প্রশ্ন', 'New chat')} aria-label={tr('নতুন প্রশ্ন', 'New chat')}><Icon name="plus" size={18} /></button>
              </>
            )}
            <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label={tr('বন্ধ করুন', 'Close')}><Icon name="close" size={18} /></button>
          </header>

          {!user ? (
            <div className="chat-widget-body">
              <div className="chat-welcome">
                <p>{tr('রথ সহায়ক কৃষি প্রশ্নের উত্তর দেয়, আজকের বাজারদর আর আপনার জেলার আবহাওয়া বলে দেয়। ব্যবহার করতে লগইন করুন।', 'Roth Sahayak answers farming questions and tells you today’s prices and your district’s weather. Please log in to use it.')}</p>
                <div className="chat-guest-actions">
                  <Link to="/login" state={{ from: pathname }} className="btn btn-primary" onClick={() => setOpen(false)}>{tr('লগইন', 'Log in')}</Link>
                  <Link to="/register" className="btn btn-outline" onClick={() => setOpen(false)}>{tr('নিবন্ধন', 'Register')}</Link>
                </div>
              </div>
            </div>
          ) : showHistory ? (
            <div className="chat-widget-body">
              <History activeId={conversationId} onOpen={openConversation} onClose={() => setShowHistory(false)} />
            </div>
          ) : (
            <>
              <div className="chat-widget-body" aria-live="polite">
                {loadingThread ? <Spinner /> : messages.length === 0 && (
                  <div className="chat-welcome">
                    <p>{tr(`আসসালামু আলাইকুম, ${user.name}! কী জানতে চান? লিখুন অথবা 🎤 চেপে বলুন।`, `Hello ${user.name}! What would you like to know? Type, or tap 🎤 and speak.`)}</p>
                    <div className="example-list">
                      {QUICK.map(([bn, en]) => <button type="button" key={bn} onClick={() => send(tr(bn, en))}>{tr(bn, en)}</button>)}
                    </div>
                  </div>
                )}
                {!loadingThread && messages.map((m) => <ChatMessage key={m.id} message={m} />)}
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
              <p className="chat-widget-note">{tr('এআই-এর পরামর্শ সাধারণ তথ্য; ওষুধের মাত্রা 16123-এ মিলিয়ে নিন।', 'AI advice is general; confirm doses at 16123.')}</p>
            </>
          )}
        </section>
      )}
      <button type="button" className={`chat-fab ${open ? 'open' : ''}`} onClick={() => setOpen((v) => !v)} aria-label={tr('রথ সহায়ক', 'Roth Sahayak')} aria-expanded={open}>
        <Icon name={open ? 'close' : 'bot'} size={26} />
        {!open && <span className="chat-fab-label">{tr('সহায়ক', 'Help')}</span>}
      </button>
    </>
  )
}
