/** Crop dropdown grouped by category. */
import { useId } from 'react'
import { useLang } from '../context/LanguageContext'
import { useLookups } from '../context/LookupsContext'
import { Field } from './ui'

export default function CropSelect({ label, value, onChange, error, required, placeholder, name = 'crop_id' }) {
  const { lang, tr } = useLang()
  const lk = useLookups()
  const id = useId()
  return (
    <Field label={label ?? tr('ফসল', 'Crop')} error={error} required={required} id={id}>
      <select id={id} name={name} className="input" value={value || ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')} required={required}>
        <option value="">{placeholder ?? tr('ফসল বেছে নিন', 'Choose a crop')}</option>
        {lk.crop_categories.map((cat) => (
          <optgroup key={cat.id} label={lang === 'en' ? cat.name_en : cat.name_bn}>
            {lk.crops
              .filter((c) => c.category_id === cat.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {lang === 'en' ? c.name_en : `${c.name_bn} (${c.name_en})`}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </Field>
  )
}
