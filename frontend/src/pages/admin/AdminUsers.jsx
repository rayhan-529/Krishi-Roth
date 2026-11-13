import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLang } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useFetch } from '../../hooks/useFetch'
import { get, patch } from '../../services/api'
import { label, options } from '../../utils/labels'
import { date, dateTime, num, pick } from '../../utils/format'
import Icon from '../../components/Icon'
import { Avatar, Badge, Card, ConfirmButton, EmptyState, ErrorBox, Loader, Modal, PageHeader, Pagination, Select, Stars, StatusBadge } from '../../components/ui'

function UserDetail({ id, onClose, onChanged }) {
  const { lang, tr } = useLang()
  const toast = useToast()
  const { data: u, loading, error, reload } = useFetch(() => get(`/admin/users/${id}`), [id])
  const [role, setRole] = useState('')

  async function run(promise) {
    const body = await promise
    toast.success(body.message)
    reload()
    onChanged()
  }

  return (
    <Modal open wide title={tr('ব্যবহারকারীর বিবরণ', 'User details')} onClose={onClose}>
      {loading ? <Loader inline /> : error ? <ErrorBox error={error} /> : (
        <>
          <div className="profile-head">
            <Avatar src={u.profile_photo} name={u.name} size={64} />
            <div>
              <h2>{u.name} {u.is_blocked ? <Badge tone="red">{tr('বন্ধ', 'Blocked')}</Badge> : null}</h2>
              <p className="muted">{label('role', u.role, lang)} · <StatusBadge group="verification" value={u.verification_status} /></p>
              <Stars value={u.average_rating} count={u.review_count} />
            </div>
          </div>
          <dl className="details">
            <dt>{tr('মোবাইল', 'Mobile')}</dt><dd>{u.phone || '—'}</dd>
            <dt>{tr('ইমেইল', 'Email')}</dt><dd>{u.email || '—'}</dd>
            <dt>{tr('এলাকা', 'Area')}</dt><dd>{[u.address, u.upazila, pick(u, 'district', lang)].filter(Boolean).join(', ') || '—'}</dd>
            <dt>{tr('নিবন্ধন', 'Registered')}</dt><dd>{dateTime(u.created_at, lang)}</dd>
            <dt>{tr('শেষ লগইন', 'Last login')}</dt><dd>{dateTime(u.last_login_at, lang)}</dd>
            <dt>{tr('কার্যক্রম', 'Activity')}</dt><dd>{tr('বিজ্ঞাপন', 'Listings')} {num(u.counts.listings, lang)} · {tr('লেনদেন', 'Trades')} {num(u.counts.trades, lang)} · {tr('বুকিং', 'Bookings')} {num(u.counts.bookings, lang)} · {tr('অভিযোগ', 'Complaints')} {num(u.counts.complaints_against, lang)}</dd>
            <dt>{tr('সক্রিয় লগইন', 'Active sessions')}</dt><dd>{num(u.counts.active_sessions, lang)}</dd>
            {u.is_blocked ? <><dt>{tr('বন্ধের কারণ', 'Block reason')}</dt><dd>{u.blocked_reason}</dd></> : null}
          </dl>
          {u.role !== 'admin' && (
            <div className="form-actions start">
              {u.is_blocked ? (
                <ConfirmButton className="btn btn-primary" danger={false} message={tr('অ্যাকাউন্টটি আবার চালু করবেন?', 'Unblock this account?')} onConfirm={() => run(patch(`/admin/users/${u.id}/unblock`))}>{tr('আবার চালু', 'Unblock')}</ConfirmButton>
              ) : (
                <ConfirmButton className="btn btn-danger" message={tr('অ্যাকাউন্টটি বন্ধ করবেন? ব্যবহারকারী সঙ্গে সঙ্গে লগআউট হয়ে যাবেন।', 'Block this account? The user is logged out immediately.')} reasonLabel={tr('কারণ', 'Reason')} onConfirm={(reason) => run(patch(`/admin/users/${u.id}/block`, { reason }))}>{tr('অ্যাকাউন্ট বন্ধ', 'Block account')}</ConfirmButton>
              )}
              <div className="inline-role">
                <select className="input input-sm" value={role} onChange={(e) => setRole(e.target.value)} aria-label={tr('নতুন ভূমিকা', 'New role')}>
                  <option value="">{tr('ভূমিকা বদলান...', 'Change role...')}</option>
                  {options('role', lang).filter((o) => o.value !== 'admin' && o.value !== u.role).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <ConfirmButton className="btn btn-outline" danger={false} disabled={!role} message={tr(`ভূমিকা ${label('role', role, lang)} করবেন?`, `Change role to ${label('role', role, lang)}?`)} onConfirm={() => run(patch(`/admin/users/${u.id}/role`, { role })).then(() => setRole(''))}>{tr('বদলান', 'Change')}</ConfirmButton>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  )
}

export default function AdminUsers() {
  const { lang, tr } = useLang()
  const [params, setParams] = useSearchParams()
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState(null)
  const f = { q: params.get('q') || '', role: params.get('role') || '', status: params.get('status') || '', verification: params.get('verification') || '' }
  const { data, meta, loading, error, reload } = useFetch(() => get('/admin/users', { ...f, page }), [JSON.stringify(f), page])
  const update = (c) => (setParams(Object.fromEntries(Object.entries({ ...f, ...c }).filter(([, v]) => v))), setPage(1))

  return (
    <div className="page">
      <PageHeader title={tr('ব্যবহারকারী ব্যবস্থাপনা', 'User management')} subtitle={meta ? tr(`মোট ${num(meta.total, lang)} জন`, `${num(meta.total, lang)} users`) : null} />
      <div className="filters">
        <div className="field"><label htmlFor="u-q">{tr('খুঁজুন', 'Search')}</label><div className="search-box"><Icon name="search" size={18} /><input id="u-q" className="input" defaultValue={f.q} placeholder={tr('নাম, মোবাইল, ইমেইল', 'Name, mobile, email')} onKeyDown={(e) => e.key === 'Enter' && update({ q: e.target.value.trim() })} /></div></div>
        <Select label={tr('ভূমিকা', 'Role')} value={f.role} onChange={(e) => update({ role: e.target.value })} options={options('role', lang)} placeholder={tr('সব', 'All')} />
        <Select label={tr('অবস্থা', 'Status')} value={f.status} onChange={(e) => update({ status: e.target.value })} options={[{ value: 'active', label: tr('সক্রিয়', 'Active') }, { value: 'blocked', label: tr('বন্ধ', 'Blocked') }]} placeholder={tr('সব', 'All')} />
        <Select label={tr('যাচাই', 'Verification')} value={f.verification} onChange={(e) => update({ verification: e.target.value })} options={options('verification', lang, ['unverified', 'pending', 'verified', 'rejected'])} placeholder={tr('সব', 'All')} />
      </div>
      <Card padded={false}>
        {loading ? <Loader /> : error ? <div className="card-pad"><ErrorBox error={error} onRetry={reload} /></div> : data.length === 0 ? <EmptyState icon="👥" title={tr('কেউ পাওয়া যায়নি', 'No users found')} /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>#</th><th>{tr('নাম', 'Name')}</th><th>{tr('যোগাযোগ', 'Contact')}</th><th>{tr('ভূমিকা', 'Role')}</th><th>{tr('জেলা', 'District')}</th><th>{tr('যাচাই', 'Verified')}</th><th>{tr('অবস্থা', 'Status')}</th><th>{tr('নিবন্ধন', 'Joined')}</th><th /></tr></thead>
              <tbody>
                {data.map((u) => (
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td><strong>{u.name}</strong></td>
                    <td className="small">{u.phone}<br />{u.email}</td>
                    <td>{label('role', u.role, lang)}</td>
                    <td>{pick(u, 'district', lang)}</td>
                    <td><StatusBadge group="verification" value={u.verification_status} /></td>
                    <td>{u.is_blocked ? <Badge tone="red">{tr('বন্ধ', 'Blocked')}</Badge> : <Badge tone="green">{tr('সক্রিয়', 'Active')}</Badge>}</td>
                    <td className="nowrap">{date(u.created_at, lang)}</td>
                    <td><button type="button" className="btn btn-sm btn-outline" onClick={() => setOpenId(u.id)}>{tr('বিস্তারিত', 'Details')}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Pagination meta={meta} onPage={setPage} />
      {openId && <UserDetail id={openId} onClose={() => setOpenId(null)} onChanged={reload} />}
      <p className="small muted mt"><Link to="/admin/verifications">{tr('যাচাইয়ের আবেদন দেখুন', 'Review verification requests')} →</Link></p>
    </div>
  )
}
