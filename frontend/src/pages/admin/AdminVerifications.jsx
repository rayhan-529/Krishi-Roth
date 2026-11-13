import { useState } from 'react'
import { useLang } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useFetch } from '../../hooks/useFetch'
import { get, getBlobUrl, patch } from '../../services/api'
import { label, options } from '../../utils/labels'
import { dateTime, num } from '../../utils/format'
import { Card, ConfirmButton, EmptyState, ErrorBox, Loader, PageHeader, Pagination, StatusBadge, Tabs } from '../../components/ui'

export default function AdminVerifications() {
  const { lang, tr } = useLang()
  const toast = useToast()
  const [status, setStatus] = useState('pending')
  const [page, setPage] = useState(1)
  const { data, meta, loading, error, reload } = useFetch(() => get('/admin/verifications', { status, page }), [status, page])

  async function openDocument(id) {
    try {
      const url = await getBlobUrl(`/admin/verifications/${id}/document`)
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function review(id, decision, note) {
    const body = await patch(`/admin/verifications/${id}`, { status: decision, admin_note: note || undefined })
    toast.success(body.message)
    reload()
  }

  return (
    <div className="page">
      <PageHeader title={tr('যাচাই ব্যবস্থাপনা', 'Verification management')} subtitle={tr('ডকুমেন্টগুলো গোপন; শুধু অ্যাডমিন দেখতে পারেন', 'Documents are private and visible only to admins')} />
      <Tabs active={status} onChange={(s) => (setStatus(s), setPage(1))} tabs={[...options('verification', lang, ['pending', 'approved', 'rejected']).map((o) => ({ key: o.value, label: o.label })), { key: '', label: tr('সব', 'All') }]} />
      <Card padded={false}>
        {loading ? <Loader /> : error ? <div className="card-pad"><ErrorBox error={error} onRetry={reload} /></div> : data.length === 0 ? <EmptyState icon="🛡️" title={tr('কোনো আবেদন নেই', 'No requests')} /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{tr('ব্যবহারকারী', 'User')}</th><th>{tr('ডকুমেন্ট', 'Document')}</th><th>{tr('নোট', 'Note')}</th><th>{tr('তারিখ', 'Date')}</th><th>{tr('অবস্থা', 'Status')}</th><th /></tr></thead>
              <tbody>
                {data.map((v) => (
                  <tr key={v.id}>
                    <td><strong>{v.user_name}</strong><br /><small className="muted">{label('role', v.user_role, lang)} · {v.user_phone || v.user_email}</small></td>
                    <td>{label('documentType', v.document_type, lang)}{v.document_number_last4 && <><br /><small className="muted">…{v.document_number_last4}</small></>}<br /><button type="button" className="link-btn" onClick={() => openDocument(v.id)}>{tr('ডকুমেন্ট দেখুন', 'View document')} ({num(Math.round(v.document_size / 1024), lang)} KB)</button></td>
                    <td className="small">{v.note}{v.admin_note && <><br /><em>{tr('অ্যাডমিন', 'Admin')}: {v.admin_note}</em></>}</td>
                    <td className="nowrap small">{dateTime(v.created_at, lang)}{v.reviewer_name && <><br />{v.reviewer_name}</>}</td>
                    <td><StatusBadge group="verification" value={v.status} /></td>
                    <td className="actions">
                      {v.status === 'pending' && (
                        <>
                          <ConfirmButton className="btn btn-sm btn-primary" danger={false} message={tr(`${v.user_name}-এর অ্যাকাউন্ট যাচাই করবেন?`, `Verify ${v.user_name}'s account?`)} onConfirm={() => review(v.id, 'approved')}>{tr('অনুমোদন', 'Approve')}</ConfirmButton>
                          <ConfirmButton className="btn btn-sm btn-danger-outline" message={tr('আবেদন বাতিল করবেন?', 'Reject this request?')} reasonLabel={tr('কারণ (ব্যবহারকারী দেখবেন)', 'Reason (shown to the user)')} onConfirm={(r) => review(v.id, 'rejected', r)}>{tr('বাতিল', 'Reject')}</ConfirmButton>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Pagination meta={meta} onPage={setPage} />
    </div>
  )
}
