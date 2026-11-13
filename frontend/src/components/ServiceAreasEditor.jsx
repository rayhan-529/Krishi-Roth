/** Labour / machinery / transport owners: extra districts where they work. */
import { useState } from 'react'
import { useLang } from '../context/LanguageContext'
import { useLookups } from '../context/LookupsContext'
import { useToast } from '../context/ToastContext'
import { useFetch } from '../hooks/useFetch'
import { get, put } from '../services/api'
import Icon from './Icon'
import { Card, ErrorBox, Input, Loader, Select } from './ui'

export default function ServiceAreasEditor() {
  const { lang, tr } = useLang()
  const lk = useLookups()
  const toast = useToast()
  const { data, loading, error, reload, setData } = useFetch(() => get('/service-areas'), [])
  const [districtId, setDistrictId] = useState('')
  const [upazila, setUpazila] = useState('')
  const [busy, setBusy] = useState(false)

  async function save(areas) {
    setBusy(true)
    try {
      const body = await put('/service-areas', { areas: areas.map((a) => ({ district_id: a.district_id, upazila: a.upazila || '' })) })
      setData(body.data)
      toast.success(body.message)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const districts = [...lk.districts]
    .map((d) => ({ value: d.id, label: lang === 'en' ? d.name_en : d.name_bn }))
    .sort((a, b) => a.label.localeCompare(b.label, lang === 'en' ? 'en' : 'bn'))

  return (
    <Card title={tr('সেবার এলাকা', 'Service areas')}>
      <p className="muted">{tr('আপনার নিজের জেলা ছাড়াও যেসব এলাকায় কাজ করেন সেগুলো যোগ করুন। কৃষকেরা খুঁজলে আপনাকে দেখতে পাবেন।', 'Add the areas you also work in besides your home district, so farmers there can find you.')}</p>
      {loading ? <Loader inline /> : <ErrorBox error={error} onRetry={reload} />}
      {data && (
        <ul className="chip-list">
          {data.length === 0 && <li className="muted">{tr('কোনো অতিরিক্ত এলাকা নেই', 'No extra areas yet')}</li>}
          {data.map((a) => (
            <li key={a.id} className="chip">
              {lang === 'en' ? a.district_en : a.district_bn}
              {a.upazila ? ` — ${a.upazila}` : ''}
              <button type="button" disabled={busy} onClick={() => save(data.filter((x) => x.id !== a.id))} aria-label={tr('সরান', 'Remove')}>
                <Icon name="close" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="inline-form">
        <Select label={tr('জেলা', 'District')} value={districtId} onChange={(e) => setDistrictId(e.target.value)} options={districts} placeholder={tr('জেলা বেছে নিন', 'Choose district')} />
        <Input label={tr('উপজেলা (ঐচ্ছিক)', 'Upazila (optional)')} value={upazila} onChange={(e) => setUpazila(e.target.value)} maxLength={80} />
        <button
          type="button"
          className="btn btn-outline"
          disabled={!districtId || busy || !data}
          onClick={() => {
            save([...(data || []), { district_id: Number(districtId), upazila: upazila.trim() }])
            setDistrictId('')
            setUpazila('')
          }}
        >
          <Icon name="plus" size={16} /> {tr('যোগ করুন', 'Add')}
        </button>
      </div>
    </Card>
  )
}
