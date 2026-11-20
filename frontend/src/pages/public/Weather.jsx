/** Weather forecast page: any district, defaults to the user's own district. */
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import { useLookups } from '../../context/LookupsContext'
import WeatherCard from '../../components/WeatherCard'
import { PageHeader, Select } from '../../components/ui'

export default function Weather() {
  const { lang, tr } = useLang()
  const { user } = useAuth()
  const lookups = useLookups()
  const [districtId, setDistrictId] = useState(user && user.district_id ? String(user.district_id) : '18')

  const districts = [...lookups.districts]
    .sort((a, b) => (lang === 'en' ? a.name_en : a.name_bn).localeCompare(lang === 'en' ? b.name_en : b.name_bn))
    .map((d) => ({ value: String(d.id), label: lang === 'en' ? d.name_en : d.name_bn }))

  return (
    <div className="page narrow">
      <PageHeader
        title={tr('আবহাওয়ার পূর্বাভাস', 'Weather forecast')}
        actions={
          <div className="weather-picker">
            <Select label={tr('জেলা', 'District')} options={districts} value={districtId} onChange={(e) => setDistrictId(e.target.value)} />
          </div>
        }
      />
      <WeatherCard districtId={districtId} />
    </div>
  )
}
