/**
 * Weather for one district: today's conditions and the 7-day forecast.
 *   <WeatherCard districtId={18} />        full card
 *   <WeatherCard compact />                 today only (dashboards)
 */
import { Link } from 'react-router-dom'
import { useLang } from '../context/LanguageContext'
import { useFetch } from '../hooks/useFetch'
import { get } from '../services/api'
import { num, parseDate } from '../utils/format'
import Icon from './Icon'
import { Card, Loader } from './ui'

const TONE = { sun: 'sunny', partly: 'sunny', storm: 'stormy', 'heavy-rain': 'rainy', rain: 'rainy', drizzle: 'rainy' }

function dayName(date, lang, index) {
  if (index === 0) return lang === 'en' ? 'Today' : 'আজ'
  if (index === 1) return lang === 'en' ? 'Tomorrow' : 'আগামীকাল'
  const d = parseDate(date)
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'bn-BD-u-nu-latn', { weekday: 'short', timeZone: 'Asia/Dhaka' }).format(d)
}

export function useWeather(districtId) {
  return useFetch(() => get('/weather', { district_id: districtId }), [districtId])
}

export function WeatherToday({ data, lang, tr }) {
  const c = data.current
  return (
    <div className={`weather-today tone-${TONE[c.icon] || 'cloudy'}`}>
      <span className="weather-big-icon"><Icon name={c.icon} size={52} /></span>
      <div className="weather-now">
        <strong>{num(Math.round(c.temperature), lang)}°C</strong>
        <span>{lang === 'en' ? c.en : c.bn}</span>
        <small><Icon name="pin" size={13} /> {lang === 'en' ? data.district.name_en : data.district.name_bn}</small>
      </div>
      <div className="weather-facts">
        <span><Icon name="droplet" size={15} /> {tr('আর্দ্রতা', 'Humidity')} {num(c.humidity, lang)}%</span>
        <span><Icon name="wind" size={15} /> {tr('বাতাস', 'Wind')} {num(Math.round(c.wind), lang)} {tr('কিমি/ঘ', 'km/h')}</span>
        <span><Icon name="rain" size={15} /> {tr('বৃষ্টির সম্ভাবনা', 'Rain chance')} {num(data.daily[0].rain_chance ?? 0, lang)}%</span>
      </div>
    </div>
  )
}

export default function WeatherCard({ districtId, compact = false }) {
  const { lang, tr } = useLang()
  const { data, loading, error } = useWeather(districtId)

  const title = tr('আবহাওয়া', 'Weather')
  if (loading && !data) return <Card title={title}><Loader inline /></Card>
  if (error || !data) {
    return <Card title={title}><p className="muted small">{tr('এখন আবহাওয়ার তথ্য পাওয়া যাচ্ছে না।', 'Weather is not available right now.')}</p></Card>
  }

  return (
    <Card title={title} actions={compact ? <Link to="/weather">{tr('7 দিনের পূর্বাভাস', '7-day forecast')}</Link> : null}>
      <WeatherToday data={data} lang={lang} tr={tr} />
      {data.advice && data.advice.length > 0 && (
        <ul className="weather-advice">
          {data.advice.map((a) => (
            <li key={a.kind} className={`advice-${a.tone}`}>
              <Icon name={a.tone === 'warn' ? 'alert' : a.tone === 'good' ? 'checkCircle' : 'info'} size={16} />
              <span>{lang === 'en' ? a.en : a.bn}</span>
            </li>
          ))}
        </ul>
      )}
      {!compact && (
        <ul className="weather-week">
          {data.daily.map((d, i) => (
            <li key={d.date} className={i === 0 ? 'today' : ''}>
              <span className="weather-day">{dayName(d.date, lang, i)}</span>
              <span className={`weather-day-icon icon-${d.icon}`}><Icon name={d.icon} size={26} /></span>
              <span className="weather-desc">{lang === 'en' ? d.en : d.bn}</span>
              <span className="weather-temp"><strong>{num(Math.round(d.max), lang)}°</strong> <small>{num(Math.round(d.min), lang)}°</small></span>
              <span className="weather-rain"><Icon name="droplet" size={13} /> {num(d.rain_chance ?? 0, lang)}%</span>
            </li>
          ))}
        </ul>
      )}
      <p className="source-note"><Icon name="info" size={13} /> {tr('তথ্যসূত্র: Open-Meteo, প্রতি 30 মিনিটে হালনাগাদ', 'Source: Open-Meteo, updated every 30 minutes')}</p>
    </Card>
  )
}
