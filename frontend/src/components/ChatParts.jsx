/**
 * Pieces shared by the chatbot page and the floating chat widget:
 *   useVoiceInput  speak a question (browser speech recognition, Bangla or English)
 *   ChatMessage    one bubble with **bold**, [1] citations and its sources
 *   MicButton      start/stop voice input
 */
import { Fragment, useEffect, useRef, useState } from 'react'
import { useLang } from '../context/LanguageContext'
import Icon from './Icon'

const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null

/**
 * @param {(text: string) => void} onText  called with the words heard so far
 * @returns {{ supported, listening, start, stop }}
 */
export function useVoiceInput(onText) {
  const { lang } = useLang()
  const [listening, setListening] = useState(false)
  const rec = useRef(null)
  const callback = useRef(onText)
  callback.current = onText

  useEffect(() => () => rec.current && rec.current.abort(), [])

  function start() {
    if (!Recognition || listening) return
    const r = new Recognition()
    r.lang = lang === 'en' ? 'en-US' : 'bn-BD'
    r.interimResults = true
    r.continuous = false
    r.onresult = (event) => {
      const text = Array.from(event.results).map((res) => res[0].transcript).join(' ')
      callback.current(text)
    }
    r.onend = () => setListening(false)
    r.onerror = () => setListening(false)
    rec.current = r
    setListening(true)
    r.start()
  }

  function stop() {
    if (rec.current) rec.current.stop()
  }

  return { supported: Boolean(Recognition), listening, start, stop }
}

export function MicButton({ voice }) {
  const { tr } = useLang()
  if (!voice.supported) return null
  return (
    <button
      type="button"
      className={`btn mic-btn ${voice.listening ? 'listening' : 'btn-outline'}`}
      onClick={voice.listening ? voice.stop : voice.start}
      aria-label={voice.listening ? tr('শোনা বন্ধ করুন', 'Stop listening') : tr('কথা বলে প্রশ্ন করুন', 'Ask by voice')}
      title={voice.listening ? tr('শোনা বন্ধ করুন', 'Stop listening') : tr('কথা বলে প্রশ্ন করুন', 'Ask by voice')}
    >
      <Icon name={voice.listening ? 'stop' : 'mic'} size={18} />
    </button>
  )
}

/** Renders **bold** and [n] citation marks inside one line of text. */
function inline(line, key) {
  const parts = line.split(/(\*\*[^*]+\*\*|\[\d{1,2}\])/g)
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={`${key}-${i}`}>{part.slice(2, -2)}</strong>
    if (/^\[\d{1,2}\]$/.test(part)) return <sup key={`${key}-${i}`} className="cite">{part.slice(1, -1)}</sup>
    return <Fragment key={`${key}-${i}`}>{part}</Fragment>
  })
}

export function ChatMessage({ message: m }) {
  const { tr } = useLang()
  const sources = m.sources || []
  const docs = sources.filter((s) => s.type === 'document')
  const live = sources.filter((s) => s.type === 'live')
  return (
    <div className={`bubble ${m.role === 'user' ? 'mine' : 'bot'}`}>
      <div className="bubble-text">
        {String(m.content).split('\n').map((line, i) => (
          <Fragment key={i}>{i > 0 && <br />}{inline(line.replace(/^\s*[*-] /, '• '), i)}</Fragment>
        ))}
      </div>
      {(docs.length > 0 || live.length > 0) && (
        <div className="bubble-sources">
          <span>{tr('তথ্যসূত্র:', 'Sources:')}</span>
          {docs.map((s) => (
            <span key={`d${s.n}`} className="source-chip" title={s.source || ''}>
              {(s.ns || [s.n]).map((n) => <sup key={n} className="cite">{n}</sup>)} {s.title}
            </span>
          ))}
          {live.map((s) => (
            <span key={s.key} className="source-chip live"><Icon name="refresh" size={11} /> {tr(s.title_bn, s.title_en)}</span>
          ))}
        </div>
      )}
    </div>
  )
}
