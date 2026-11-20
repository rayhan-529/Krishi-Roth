/**
 * Wallet: balance, "Add balance" (bKash/Nagad/Rocket + TrxID, approved by an
 * admin), "Withdraw", request status and the full ledger.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useFetch, useForm } from '../../hooks/useFetch'
import { get, post } from '../../services/api'
import { label } from '../../utils/labels'
import { dateTime, money, num } from '../../utils/format'
import Icon from '../../components/Icon'
import CardSoon from '../../components/CardSoon'
import { SecurityCodeField, useTwoFactorStatus } from '../../components/SecurityCode'
import { Alert, EmptyState, ErrorBox, Input, Loader, Modal, PageHeader, Pagination, Select, StatusBadge, SubmitButton, Tabs } from '../../components/ui'

const TX_ICON = {
  deposit: 'plus', withdrawal: 'upload', withdrawal_refund: 'refresh', escrow_hold: 'shield',
  escrow_release: 'handshake', escrow_receive: 'wallet', escrow_refund: 'refresh', adjustment: 'edit',
}

function CopyNumber({ number }) {
  const { tr } = useLang()
  const toast = useToast()
  return (
    <button
      type="button"
      className="copy-number"
      onClick={() => navigator.clipboard?.writeText(number).then(() => toast.success(tr('নম্বর কপি হয়েছে', 'Number copied')), () => {})}
    >
      <strong>{number}</strong> <span>{tr('কপি', 'Copy')}</span>
    </button>
  )
}

function DepositForm({ info, onDone }) {
  const { lang, tr } = useLang()
  const toast = useToast()
  const methods = info.payment_numbers
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const { values, bind, set, setErrors } = useForm({ method: methods[0]?.method || 'bkash', amount: '', sender_number: '', trx_id: '' })
  const platform = methods.find((m) => m.method === values.method)

  if (methods.length === 0) {
    return <Alert tone="warning">{tr('অ্যাডমিন এখনো টাকা পাঠানোর নম্বর যোগ করেননি। পরে চেষ্টা করুন।', 'The administrator has not set a payment number yet. Please try later.')}</Alert>
  }

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const body = await post('/wallet/deposits', { ...values, amount: Number(values.amount) })
      toast.success(body.message)
      onDone()
    } catch (err) {
      setErrors(err.errors)
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="form" noValidate>
      <div className="method-picker" role="radiogroup">
        {methods.map((m) => (
          <button type="button" key={m.method} role="radio" aria-checked={values.method === m.method} className={`method-${m.method} ${values.method === m.method ? 'selected' : ''}`} onClick={() => set('method', m.method)}>
            {label('walletMethod', m.method, lang)}
          </button>
        ))}
      </div>
      <CardSoon />
      <ol className="deposit-steps">
        <li>
          {tr(`${label('walletMethod', values.method, lang)} অ্যাপ থেকে এই নম্বরে "Send Money" করুন:`, `In your ${label('walletMethod', values.method, lang)} app, "Send Money" to:`)}
          {platform && <CopyNumber number={platform.number} />}
        </li>
        <li>{tr('পাঠানোর পর SMS-এ যে TrxID আসবে, সেটা নিচে দিন।', 'Enter the TrxID from the confirmation SMS below.')}</li>
        <li>{tr('অ্যাডমিন যাচাই করলে ব্যালেন্স যোগ হবে (সাধারণত কয়েক ঘণ্টার মধ্যে)।', 'Your balance is added once an admin verifies it (usually within a few hours).')}</li>
      </ol>
      <ErrorBox error={error} />
      <Input label={tr('টাকার পরিমাণ (৳)', 'Amount (৳)')} type="number" inputMode="decimal" min={info.limits.min_deposit} max={info.limits.max_deposit} hint={tr(`৳${num(info.limits.min_deposit, lang)} – ৳${num(info.limits.max_deposit, lang)}`, `৳${info.limits.min_deposit} – ৳${info.limits.max_deposit}`)} required {...bind('amount')} />
      <div className="grid-2">
        <Input label={tr('যে নম্বর থেকে পাঠিয়েছেন', 'Your sending number')} type="tel" inputMode="tel" placeholder="01XXXXXXXXX" required {...bind('sender_number')} />
        <Input label="TrxID" placeholder="9ABC1D2E3F" autoCapitalize="characters" maxLength={40} required {...bind('trx_id')} />
      </div>
      <SubmitButton busy={busy} className="btn btn-primary btn-block btn-pill">{tr('অনুরোধ পাঠান', 'Submit request')}</SubmitButton>
    </form>
  )
}

function WithdrawForm({ info, onDone }) {
  const { lang, tr } = useLang()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const { values, bind, set, errors, setErrors } = useForm({ method: 'bkash', account_number: '', amount: '', code: '' })
  const available = info.wallet.available
  const twoFactor = useTwoFactorStatus()
  const needsCode = Boolean(twoFactor && twoFactor.enabled)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const body = await post('/wallet/withdrawals', { ...values, amount: Number(values.amount), code: needsCode ? values.code : undefined })
      toast.success(body.message)
      onDone()
    } catch (err) {
      setErrors(err.errors)
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="form" noValidate>
      <p className="muted">{tr('তোলা যাবে', 'Available to withdraw')}: <strong className="text-green">{money(available, lang)}</strong></p>
      <ErrorBox error={error} />
      <div className="grid-2">
        <Select label={tr('কোথায় নেবেন', 'Receive by')} options={['bkash', 'nagad', 'rocket'].map((m) => ({ value: m, label: label('walletMethod', m, lang) }))} {...bind('method')} />
        <Input label={tr('আপনার নম্বর', 'Your number')} type="tel" inputMode="tel" placeholder="01XXXXXXXXX" required {...bind('account_number')} />
      </div>
      <Input
        label={tr('টাকার পরিমাণ (৳)', 'Amount (৳)')}
        type="number"
        inputMode="decimal"
        min={info.limits.min_withdrawal}
        max={available}
        hint={<button type="button" className="link-btn" onClick={() => set('amount', String(available))}>{tr('সব টাকা তুলুন', 'Withdraw all')}</button>}
        required
        {...bind('amount')}
      />
      {needsCode && <SecurityCodeField purpose="withdraw" value={values.code} onChange={(v) => set('code', v)} error={errors.code && (typeof errors.code === 'string' ? errors.code : tr(errors.code.bn, errors.code.en))} />}
      <SubmitButton busy={busy} className="btn btn-primary btn-block btn-pill" disabled={busy || available < info.limits.min_withdrawal || (needsCode && values.code.length !== 6)}>{tr('টাকা তোলার অনুরোধ', 'Request withdrawal')}</SubmitButton>
      {available < info.limits.min_withdrawal && <p className="small muted">{tr(`কমপক্ষে ৳${num(info.limits.min_withdrawal, lang)} থাকলে তুলতে পারবেন।`, `You can withdraw once you have at least ৳${info.limits.min_withdrawal}.`)}</p>}
    </form>
  )
}

function History() {
  const { lang, tr } = useLang()
  const [page, setPage] = useState(1)
  const { data, meta, loading, error, reload } = useFetch(() => get('/wallet/transactions', { page }), [page])
  if (loading && !data) return <Loader inline />
  if (error) return <ErrorBox error={error} onRetry={reload} />
  if (!data.length) return <EmptyState icon="wallet" title={tr('এখনো কোনো লেনদেন নেই', 'No transactions yet')} />
  return (
    <>
      <ul className="tx-list">
        {data.map((t) => {
          const amount = Number(t.amount)
          return (
            <li key={t.id}>
              <span className={`tx-icon tx-${t.type}`}><Icon name={TX_ICON[t.type] || 'wallet'} size={18} /></span>
              <span className="tx-body">
                <strong>{label('walletTx', t.type, lang)}</strong>
                <small>
                  {dateTime(t.created_at, lang)}
                  {t.trade_id && <> · <Link to={`/trades/${t.trade_id}`}>{tr('লেনদেন', 'Trade')} #{num(t.trade_id, lang, 0)}</Link></>}
                </small>
              </span>
              <span className="tx-amount">
                <strong className={amount >= 0 ? 'text-green' : ''}>{amount >= 0 ? '+' : '−'}{money(Math.abs(amount), lang)}</strong>
                <small>{tr('ব্যালেন্স', 'Bal.')} {money(t.available_after, lang)}</small>
              </span>
            </li>
          )
        })}
      </ul>
      <Pagination meta={meta} onPage={setPage} />
    </>
  )
}

function Requests({ kind }) {
  const { lang, tr } = useLang()
  const { data, loading, error, reload } = useFetch(() => get(`/wallet/${kind}`), [kind])
  if (loading && !data) return <Loader inline />
  if (error) return <ErrorBox error={error} onRetry={reload} />
  if (!data.length) return <EmptyState icon={kind === 'deposits' ? 'plus' : 'upload'} title={tr('কোনো অনুরোধ নেই', 'No requests')} />
  return (
    <ul className="tx-list">
      {data.map((r) => (
        <li key={r.id}>
          <span className={`tx-icon tx-${kind === 'deposits' ? 'deposit' : 'withdrawal'}`}><Icon name={kind === 'deposits' ? 'plus' : 'upload'} size={18} /></span>
          <span className="tx-body">
            <strong>{label('walletMethod', r.method, lang)} · {kind === 'deposits' ? `TrxID ${r.trx_id}` : r.account_number}</strong>
            <small>{dateTime(r.created_at, lang)}{r.admin_note && ` · ${r.admin_note}`}{r.payout_reference && ` · TrxID ${r.payout_reference}`}</small>
          </span>
          <span className="tx-amount">
            <strong>{money(r.amount, lang)}</strong>
            <StatusBadge group={kind === 'deposits' ? 'depositStatus' : 'withdrawalStatus'} value={r.status} />
          </span>
        </li>
      ))}
    </ul>
  )
}

export default function Wallet() {
  const { user } = useAuth()
  const { lang, tr } = useLang()
  const { data: info, loading, error, reload } = useFetch(() => get('/wallet'), [])
  const [modal, setModal] = useState(null)
  const [tab, setTab] = useState('history')
  const [refreshKey, setRefreshKey] = useState(0)

  if (loading && !info) return <Loader />
  if (error) return <div className="page"><ErrorBox error={error} onRetry={reload} /></div>
  const w = info.wallet
  const done = () => {
    setModal(null)
    reload()
    setRefreshKey((k) => k + 1)
  }

  return (
    <div className="page">
      <PageHeader
        title={tr('আমার ওয়ালেট', 'My wallet')}
        actions={
          <>
            <button type="button" className="btn btn-primary" onClick={() => setModal('deposit')}><Icon name="plus" size={18} /> {tr('ব্যালেন্স যোগ', 'Add balance')}</button>
            <button type="button" className="btn btn-outline" onClick={() => setModal('withdraw')}><Icon name="upload" size={18} /> {tr('টাকা তুলুন', 'Withdraw')}</button>
          </>
        }
      />

      <div className="wallet-hero">
        <div className="wallet-main">
          <small>{tr('ব্যবহারযোগ্য ব্যালেন্স', 'Available balance')}</small>
          <strong>{money(w.available, lang)}</strong>
          <span className="wallet-shield"><Icon name="shield" size={16} /> {tr('সেফ ট্রেড দিয়ে সুরক্ষিত', 'Protected by Safe Trade')}</span>
        </div>
        <div className="wallet-side">
          <div><small>{tr('সেফ ট্রেডে জমা', 'In Safe Trade')}</small><strong>{money(w.escrow, lang)}</strong></div>
          <div><small>{tr('তোলার অপেক্ষায়', 'Withdrawing')}</small><strong>{money(w.pending_withdrawal, lang)}</strong></div>
          <div><small>{tr('যাচাইয়ের অপেক্ষায়', 'Being verified')}</small><strong>{money(info.pending_deposits.amount, lang)}</strong></div>
        </div>
      </div>

      <div className="safe-trade-how">
        {[
          ['plus', tr('ব্যালেন্স যোগ', 'Add balance'), tr('বিকাশ/নগদে টাকা পাঠিয়ে TrxID দিন', 'Send by bKash/Nagad, enter TrxID')],
          ['shield', tr('সেফ ট্রেডে দিন', 'Pay safely'), tr('টাকা কৃষি রথে জমা থাকে', 'Krishi Roth holds the money')],
          ['truck', tr('ফসল বুঝে নিন', 'Receive crop'), tr('পেয়ে নিশ্চিত করুন', 'Confirm when it arrives')],
          ['wallet', tr('কৃষক টাকা পান', 'Farmer is paid'), tr(`না জানালে ${num(info.auto_release_days, lang)} দিনে স্বয়ংক্রিয়`, `Auto after ${info.auto_release_days} days`)],
        ].map(([icon, title, text]) => (
          <div key={icon}><span><Icon name={icon} size={18} /></span><strong>{title}</strong><small>{text}</small></div>
        ))}
      </div>

      <div className="card">
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'history', label: tr('লেনদেনের ইতিহাস', 'History') },
            { key: 'deposits', label: tr('ব্যালেন্স যোগের অনুরোধ', 'Add requests'), count: info.pending_deposits.count || null },
            { key: 'withdrawals', label: tr('টাকা তোলার অনুরোধ', 'Withdrawals') },
          ]}
        />
        <div key={refreshKey}>
          {tab === 'history' && <History />}
          {tab === 'deposits' && <Requests kind="deposits" />}
          {tab === 'withdrawals' && <Requests kind="withdrawals" />}
        </div>
      </div>

      <Modal open={modal === 'deposit'} title={tr('ব্যালেন্স যোগ করুন', 'Add balance')} onClose={() => setModal(null)}>
        <DepositForm info={info} onDone={() => { done(); setTab('deposits') }} />
      </Modal>
      <Modal open={modal === 'withdraw'} title={tr('টাকা তুলুন', 'Withdraw')} onClose={() => setModal(null)}>
        <WithdrawForm info={info} onDone={() => { done(); setTab('withdrawals') }} />
      </Modal>
      {user.role === 'buyer' && w.available === 0 && info.pending_deposits.count === 0 && (
        <p className="small muted mt">{tr('ফসল কিনতে আগে ব্যালেন্স যোগ করুন। সব কেনাকাটা সেফ ট্রেডে সুরক্ষিত।', 'Add balance before buying. Every purchase is protected by Safe Trade.')}</p>
      )}
    </div>
  )
}
