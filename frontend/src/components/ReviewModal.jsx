/** Rating (1-5 stars) and review for a completed trade or booking. */
import { useState } from 'react'
import { useLang } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { post } from '../services/api'
import { Modal, StarInput, SubmitButton, TextArea } from './ui'

export default function ReviewModal({ tradeId, bookingId, otherName, onClose, onDone }) {
  const { tr } = useLang()
  const toast = useToast()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    if (!rating) {
      setError(tr('তারকা বেছে নিন।', 'Choose a star rating.'))
      return
    }
    setBusy(true)
    try {
      const body = await post('/reviews', { trade_id: tradeId, booking_id: bookingId, rating, comment })
      toast.success(body.message)
      onDone && onDone()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open title={tr('রেটিং ও রিভিউ দিন', 'Rate and review')} onClose={onClose}>
      <form onSubmit={submit} className="form">
        {otherName && <p>{tr(`${otherName}-এর সঙ্গে আপনার অভিজ্ঞতা কেমন ছিল?`, `How was your experience with ${otherName}?`)}</p>}
        <StarInput value={rating} onChange={(n) => (setRating(n), setError(''))} />
        <TextArea label={tr('মন্তব্য (ঐচ্ছিক)', 'Comment (optional)')} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} rows={3} />
        {error && <p className="field-error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{tr('বাতিল', 'Cancel')}</button>
          <SubmitButton busy={busy}>{tr('জমা দিন', 'Submit')}</SubmitButton>
        </div>
      </form>
    </Modal>
  )
}
