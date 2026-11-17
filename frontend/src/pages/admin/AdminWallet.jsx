/**
 * Admin: wallet money overview, approve "Add balance" requests after checking
 * the platform's bKash/Nagad/Rocket account, and send withdrawals.
 */
import { useState } from 'react'
import { useLang } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useFetch } from '../../hooks/useFetch'
import { get, patch } from '../../services/api'
import { label } from '../../utils/labels'
import { dateTime, money, num } from '../../utils/format'
import Icon from '../../components/Icon'
import { Alert, ConfirmButton, EmptyState, ErrorBox, Loader, PageHeader, Pagination, StatCard, StatusBadge, Tabs } from '../../components/ui'

function RequestTable({ kind, status, onChanged }) {
  const { lang, tr } = useLang()
  const toast = useToast()
  const [page, setPage] = useState(1)
  const { data, meta, loading, error, reload } = useFetch(() => get(`/admin/wallet/${kind}`, { status, page }), [kind, status, page])
  const isDeposit = kind === 'deposits'

  async function review(id, payload) {
    const body = await patch(`/admin/wallet/${kind}/${id}`, payload)
    toast.success(body.message)
    reload()
    onChanged()
  }

  if (loading && !data) return <Loader inline />
  if (error) return <ErrorBox error={error} onRetry={reload} />
  if (!data.length) return <EmptyState icon={isDeposit ? 'plus' : 'upload'} title={tr('কোনো অনুরোধ নেই', 'No requests')} />

  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>{tr('ব্যবহারকারী', 'User')}</th>
              <th>{tr('মাধ্যম', 'Method')}</th>
              <th className="right">{tr('টাকা', 'Amount')}</th>
              <th>{isDeposit ? tr('পাঠানো নম্বর / TrxID', 'Sender / TrxID') : tr('যে নম্বরে পাঠাবেন', 'Send to')}</th>
              <th>{tr('সময়', 'Time')}</th>
              <th>{tr('অবস্থা', 'Status')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id}>
                <td>{num(r.id, lang, 0)}</td>
                <td><strong>{r.user_name}</strong><br /><small className="muted">{r.user_phone} · {label('role', r.user_role, lang)}</small></td>
                <td>{label('walletMethod', r.method, lang)}</td>
                <td className="right nowrap"><strong>{money(r.amount, lang)}</strong></td>
                <td>
                  {isDeposit ? <>{r.sender_number}<br /><code>{r.trx_id}</code></> : <><code>{r.account_number}</code>{r.payout_reference && <><br /><small className="muted">TrxID {r.payout_reference}</small></>}</>}
                </td>
                <td className="nowrap"><small>{dateTime(r.created_at, lang)}</small></td>
                <td>
                  <StatusBadge group={isDeposit ? 'depositStatus' : 'withdrawalStatus'} value={r.status} />
                  {r.admin_note && <><br /><small className="muted">{r.admin_note}</small></>}
                </td>
                <td>
                  {r.status === 'pending' && (
                    <div className="actions">
                      {isDeposit ? (
                        <ConfirmButton
                          className="btn btn-sm btn-primary"
                          danger={false}
                          title={tr('টাকা যোগ করবেন?', 'Add this money?')}
                          message={tr(
                            `প্ল্যাটফর্মের ${label('walletMethod', r.method, lang)} অ্যাকাউন্টে ${r.sender_number} থেকে TrxID ${r.trx_id}-এ ${money(r.amount, lang)} এসেছে, নিশ্চিত তো? অনুমোদন করলে টাকা ব্যবহারকারীর ওয়ালেটে যোগ হবে।`,
                            `Have you confirmed ${money(r.amount, lang)} from ${r.sender_number} (TrxID ${r.trx_id}) arrived in the platform's ${label('walletMethod', r.method, lang)} account? Approving adds it to the user's wallet.`,
                          )}
                          confirmText={tr('হ্যাঁ, যোগ করুন', 'Yes, approve')}
                          onConfirm={() => review(r.id, { action: 'approve' })}
                        >
                          <Icon name="check" size={16} /> {tr('অনুমোদন', 'Approve')}
                        </ConfirmButton>
                      ) : (
                        <ConfirmButton
                          className="btn btn-sm btn-primary"
                          danger={false}
                          title={tr('টাকা পাঠিয়েছেন?', 'Money sent?')}
                          message={tr(
                            `${r.account_number} নম্বরে ${label('walletMethod', r.method, lang)}-এ ${money(r.amount, lang)} পাঠিয়ে যে TrxID পেয়েছেন তা লিখুন।`,
                            `Send ${money(r.amount, lang)} by ${label('walletMethod', r.method, lang)} to ${r.account_number}, then enter the TrxID you got.`,
                          )}
                          reasonLabel={tr('পাঠানোর TrxID', 'Payout TrxID')}
                          confirmText={tr('পাঠানো হয়েছে', 'Mark as sent')}
                          onConfirm={(reference) => review(r.id, { action: 'paid', payout_reference: reference })}
                        >
                          <Icon name="send" size={16} /> {tr('পাঠানো হয়েছে', 'Mark sent')}
                        </ConfirmButton>
                      )}
                      <ConfirmButton
                        className="btn btn-sm btn-danger-outline"
                        title={tr('অনুরোধ বাতিল', 'Reject request')}
                        message={isDeposit
                          ? tr('টাকা আসেনি বা TrxID ভুল হলে বাতিল করুন। কারণ ব্যবহারকারীকে জানানো হবে।', 'Reject if the money did not arrive or the TrxID is wrong. The user sees the reason.')
                          : tr('বাতিল করলে টাকা ব্যবহারকারীর ওয়ালেটে ফেরত যাবে।', 'Rejecting returns the money to the user\'s wallet.')}
                        reasonLabel={tr('কারণ', 'Reason')}
                        onConfirm={(note) => review(r.id, { action: 'reject', note })}
                      >
                        {tr('বাতিল', 'Reject')}
                      </ConfirmButton>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination meta={meta} onPage={setPage} />
    </>
  )
}

export default function AdminWallet() {
  const { lang, tr } = useLang()
  const { data, loading, error, reload } = useFetch(() => get('/admin/wallet'), [])
  const [kind, setKind] = useState('deposits')
  const [status, setStatus] = useState('pending')

  if (loading && !data) return <Loader />
  if (error) return <div className="page"><ErrorBox error={error} onRetry={reload} /></div>
  const t = data.totals

  return (
    <div className="page">
      <PageHeader title={tr('ওয়ালেট ও সেফ ট্রেড', 'Wallet & Safe Trade')} />
      {data.payment_numbers.length === 0 ? (
        <Alert tone="warning">
          {tr('টাকা গ্রহণের কোনো নম্বর সেট করা নেই। backend/.env-এ WALLET_BKASH_NUMBER (বা NAGAD/ROCKET) দিন।', 'No receiving number is set. Add WALLET_BKASH_NUMBER (or NAGAD/ROCKET) to backend/.env.')}
        </Alert>
      ) : (
        <p className="muted small">
          {tr('টাকা গ্রহণের নম্বর', 'Receiving numbers')}: {data.payment_numbers.map((p) => `${label('walletMethod', p.method, lang)} ${p.number}`).join(' · ')}
        </p>
      )}

      <div className={`sms-status ${data.sms.enabled ? 'on' : 'off'}`}>
        <Icon name={data.sms.enabled ? 'checkCircle' : 'info'} size={18} />
        <span>
          <strong>{data.sms.enabled ? tr('SMS দিয়ে অটো যাচাই চালু', 'SMS auto-verification is on') : tr('SMS দিয়ে অটো যাচাই বন্ধ', 'SMS auto-verification is off')}</strong>
          <small>
            {data.sms.enabled
              ? data.sms.last_sms_at
                ? tr(`শেষ পেমেন্ট SMS: ${dateTime(data.sms.last_sms_at, lang)} · মোট ${num(data.sms.total, lang)}টি`, `Last payment SMS: ${dateTime(data.sms.last_sms_at, lang)} · ${data.sms.total} total`)
                : tr('এখনো কোনো পেমেন্ট SMS আসেনি। ফোনের SMS Forwarder অ্যাপ চালু আছে কিনা দেখুন।', 'No payment SMS received yet. Check that the SMS forwarder app on the phone is running.')
              : tr('backend/.env-এ WALLET_SMS_SECRET দিন। ততক্ষণ সব অনুরোধ হাতে অনুমোদন করুন।', 'Set WALLET_SMS_SECRET in backend/.env. Until then, approve each request by hand.')}
          </small>
        </span>
      </div>

      <div className="stats-grid">
        <StatCard icon="wallet" label={tr('ব্যবহারকারীদের মোট টাকা', 'Held for users')} value={money(t.held_for_users, lang)} hint={tr('এই টাকা প্ল্যাটফর্মের অ্যাকাউন্টে থাকতে হবে', 'Must be in the platform accounts')} />
        <StatCard icon="shield" tone="blue" label={tr('সেফ ট্রেডে জমা', 'In escrow')} value={money(t.escrow, lang)} />
        <StatCard icon="plus" tone="amber" label={tr('যাচাই বাকি', 'Deposits to check')} value={num(data.queue.deposits, lang)} />
        <StatCard icon="upload" tone="red" label={tr('পাঠানো বাকি', 'Payouts to send')} value={num(data.queue.withdrawals, lang)} hint={money(t.pending_withdrawal, lang)} />
      </div>

      <div className="card">
        <Tabs
          active={kind}
          onChange={setKind}
          tabs={[
            { key: 'deposits', label: tr('ব্যালেন্স যোগ', 'Add balance'), count: data.queue.deposits || null },
            { key: 'withdrawals', label: tr('টাকা তোলা', 'Withdrawals'), count: data.queue.withdrawals || null },
          ]}
        />
        <div className="chip-filter">
          {['pending', kind === 'deposits' ? 'approved' : 'paid', 'rejected', ''].map((s) => (
            <button key={s || 'all'} type="button" className={status === s ? 'active' : ''} onClick={() => setStatus(s)}>
              {s ? label(kind === 'deposits' ? 'depositStatus' : 'withdrawalStatus', s, lang) : tr('সব', 'All')}
            </button>
          ))}
        </div>
        <RequestTable key={`${kind}-${status}`} kind={kind} status={status} onChanged={reload} />
      </div>
    </div>
  )
}
