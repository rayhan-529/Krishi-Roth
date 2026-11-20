/**
 * Admin: the chatbot's knowledge base (RAG).
 * Upload documents (.txt .md .docx .pdf or pasted text); the chatbot answers
 * site and farming questions from them and names the source.
 */
import { useState } from 'react'
import { useLang } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useFetch } from '../../hooks/useFetch'
import { del, get, post } from '../../services/api'
import { dateTime, num } from '../../utils/format'
import Icon from '../../components/Icon'
import { Alert, Card, ConfirmButton, EmptyState, ErrorBox, Input, Loader, Modal, PageHeader, StatCard, SubmitButton, TextArea } from '../../components/ui'

function AddDocument({ onAdded }) {
  const { tr } = useLang()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [source, setSource] = useState('')
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('title', title.trim())
      if (source.trim()) form.append('source', source.trim())
      if (file) form.append('file', file)
      else form.append('text', text)
      const body = await post('/admin/knowledge', form, { timeout: 180000 })
      toast.success(body.message)
      setTitle('')
      setSource('')
      setText('')
      setFile(null)
      event.target.reset()
      onAdded()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="form" noValidate>
      <div className="grid-2">
        <Input label={tr('শিরোনাম', 'Title')} required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tr('যেমন: বোরো ধান চাষ নির্দেশিকা', 'e.g. Boro rice growing guide')} />
        <Input label={tr('উৎস (ঐচ্ছিক)', 'Source (optional)')} maxLength={300} value={source} onChange={(e) => setSource(e.target.value)} placeholder={tr('যেমন: BRRI, 2024', 'e.g. BRRI, 2024')} />
      </div>
      <label className="kb-file">
        <Icon name="upload" size={20} />
        <span>
          <strong>{file ? file.name : tr('ফাইল বেছে নিন', 'Choose a file')}</strong>
          <small>{tr('.docx, .pdf, .txt বা .md · সর্বোচ্চ 10 MB', '.docx, .pdf, .txt or .md · up to 10 MB')}</small>
        </span>
        <input type="file" accept=".txt,.md,.docx,.pdf" onChange={(e) => setFile(e.target.files[0] || null)} />
      </label>
      {!file && (
        <TextArea label={tr('অথবা লেখা পেস্ট করুন', 'Or paste text')} rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder={tr('প্রশ্ন-উত্তর, নির্দেশিকা বা যেকোনো তথ্য...', 'Questions and answers, a guide, or any information...')} />
      )}
      <p className="muted small">
        <Icon name="info" size={13} /> {tr('বাংলা PDF থেকে অনেক সময় লেখা ঠিকমতো পড়া যায় না; সেক্ষেত্রে .docx বা লেখা পেস্ট করুন। "#" দিয়ে শিরোনাম দিলে (যেমন "# ধানের ব্লাস্ট রোগ") উত্তর আরও নির্ভুল হয়।', 'Bangla PDFs often extract badly; use .docx or pasted text then. Headings starting with "#" (e.g. "# Rice blast") make answers more accurate.')}
      </p>
      <ErrorBox error={error} />
      <SubmitButton busy={busy} disabled={busy || title.trim().length < 3 || (!file && text.trim().length < 50)}>
        {busy ? tr('প্রসেস হচ্ছে... (বড় ফাইলে 1-2 মিনিট)', 'Processing... (1-2 min for big files)') : tr('জ্ঞানভান্ডারে যোগ করুন', 'Add to knowledge base')}
      </SubmitButton>
    </form>
  )
}

function TrySearch() {
  const { tr } = useLang()
  const [question, setQuestion] = useState('')
  const [hits, setHits] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      setHits((await post('/admin/knowledge/search', { question })).data)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <form onSubmit={submit} className="kb-try">
        <input className="input" value={question} maxLength={500} onChange={(e) => setQuestion(e.target.value)} placeholder={tr('একটা প্রশ্ন লিখে দেখুন কোন অংশ পাওয়া যায়', 'Type a question to see which passages are found')} />
        <SubmitButton busy={busy} disabled={busy || question.trim().length < 2}><Icon name="search" size={16} /></SubmitButton>
      </form>
      <ErrorBox error={error} />
      {hits && (hits.length === 0 ? <p className="muted">{tr('কিছু পাওয়া যায়নি।', 'Nothing found.')}</p> : (
        <ol className="kb-hits">
          {hits.map((h, i) => (
            <li key={i} className={h.used ? 'used' : ''}>
              <div className="kb-hit-head">
                <strong>{h.title}</strong>
                <span className={`badge ${h.used ? 'badge-green' : 'badge-grey'}`}>
                  {tr('মিল', 'Match')} {Math.round(h.score * 100)}% · {h.used ? tr('উত্তরে ব্যবহার হবে', 'will be used') : tr('ব্যবহার হবে না', 'not used')}
                </span>
              </div>
              <p className="pre-line">{h.content}</p>
            </li>
          ))}
        </ol>
      ))}
    </>
  )
}

function Chunks({ doc, onClose }) {
  const { tr } = useLang()
  const { data, loading, error } = useFetch(() => get(`/admin/knowledge/${doc.id}`), [doc.id])
  return (
    <Modal open title={doc.title} onClose={onClose}>
      {loading ? <Loader inline /> : error ? <ErrorBox error={error} /> : (
        <ol className="kb-hits">
          {data.map((c) => <li key={c.chunk_index}><small className="muted">{tr('অংশ', 'Passage')} {c.chunk_index + 1}</small><p className="pre-line">{c.content}</p></li>)}
        </ol>
      )}
    </Modal>
  )
}

export default function AdminKnowledge() {
  const { lang, tr } = useLang()
  const toast = useToast()
  const { data, loading, error, reload } = useFetch(() => get('/admin/knowledge'), [])
  const [viewing, setViewing] = useState(null)

  async function remove(doc) {
    try {
      const body = await del(`/admin/knowledge/${doc.id}`)
      toast.success(body.message)
      reload()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const docs = data ? data.documents : []
  const passages = docs.reduce((sum, d) => sum + d.chunk_count, 0)

  return (
    <div className="page">
      <PageHeader title={tr('চ্যাটবটের জ্ঞানভান্ডার', 'Chatbot knowledge base')} />
      <p className="muted">
        {tr('এখানে যে ডকুমেন্ট যোগ করবেন, রথ সহায়ক সেগুলো থেকে খুঁজে উত্তর দেবে এবং উৎস দেখাবে (RAG)। আজকের বাজারদর, আবহাওয়া, ওয়ালেট আর লেনদেন সে নিজেই ডেটাবেস থেকে দেখে নেয়।', 'Documents added here are searched by Roth Sahayak to answer questions, with the source shown (RAG). Today’s prices, weather, wallet and trades it reads from the database by itself.')}
      </p>
      {loading && !data ? <Loader /> : error ? <ErrorBox error={error} onRetry={reload} /> : (
        <>
          {!data.configured && <Alert tone="warning">{tr('AI_API_KEY দেওয়া নেই, তাই নতুন ডকুমেন্ট যোগ বা খোঁজা যাবে না।', 'AI_API_KEY is not set, so documents cannot be added or searched.')}</Alert>}
          <div className="stats-grid">
            <StatCard icon="book" tone="green" label={tr('ডকুমেন্ট', 'Documents')} value={num(docs.length, lang)} />
            <StatCard icon="file" tone="blue" label={tr('মোট অংশ', 'Passages')} value={num(passages, lang)} />
          </div>
          <div className="grid-2 kb-grid">
            <Card title={tr('নতুন ডকুমেন্ট যোগ করুন', 'Add a document')}>
              <AddDocument onAdded={reload} />
            </Card>
            <Card title={tr('খুঁজে পরীক্ষা করুন', 'Test a search')}>
              <TrySearch />
            </Card>
          </div>
          <Card title={tr('সব ডকুমেন্ট', 'All documents')}>
            {docs.length === 0 ? <EmptyState icon="book" title={tr('এখনো কোনো ডকুমেন্ট নেই', 'No documents yet')} /> : (
              <ul className="kb-docs">
                {docs.map((d) => (
                  <li key={d.id}>
                    <span className="stat-icon tone-green"><Icon name={d.is_builtin ? 'shield' : 'file'} size={18} /></span>
                    <span className="kb-doc-main">
                      <strong>{d.title}</strong>
                      <small>
                        {d.is_builtin ? tr('বিল্ট-ইন সাইট নির্দেশিকা', 'Built-in site guide') : [d.source, d.file_name, d.created_by_name].filter(Boolean).join(' · ')}
                        {' · '}{num(d.chunk_count, lang)} {tr('অংশ', 'passages')} · {dateTime(d.created_at, lang)}
                      </small>
                    </span>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setViewing(d)}><Icon name="eye" size={15} /></button>
                    {!d.is_builtin && (
                      <ConfirmButton className="btn btn-outline btn-sm" title={tr('ডকুমেন্ট মুছবেন?', 'Delete document?')} message={d.title} confirmText={tr('মুছুন', 'Delete')} onConfirm={() => remove(d)}>
                        <Icon name="trash" size={15} />
                      </ConfirmButton>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
      {viewing && <Chunks doc={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}
