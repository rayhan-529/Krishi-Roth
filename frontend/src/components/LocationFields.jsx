/**
 * Division -> District -> Upazila picker.
 * Controlled by districtId / upazila; the division is derived from the district.
 */
import { useMemo, useState } from 'react'
import { useLang } from '../context/LanguageContext'
import { useLookups } from '../context/LookupsContext'
import { Input, Select } from './ui'

export default function LocationFields({ districtId, upazila, onDistrict, onUpazila, errors = {}, required, showUpazila = true, compact }) {
  const { lang, tr } = useLang()
  const lk = useLookups()
  const current = lk.districtById[districtId]
  const [division, setDivision] = useState(current ? current.division_id : '')
  const divisionId = current ? current.division_id : division

  const districts = useMemo(
    () =>
      lk.districts
        .filter((d) => !divisionId || d.division_id === Number(divisionId))
        .map((d) => ({ value: d.id, label: lang === 'en' ? d.name_en : d.name_bn }))
        .sort((a, b) => a.label.localeCompare(b.label, lang === 'en' ? 'en' : 'bn')),
    [lk.districts, divisionId, lang],
  )

  return (
    <div className={compact ? 'grid-3' : 'grid-3'}>
      <Select
        label={tr('বিভাগ', 'Division')}
        value={divisionId || ''}
        onChange={(e) => {
          setDivision(e.target.value)
          onDistrict('')
        }}
        options={lk.divisions.map((d) => ({ value: d.id, label: lang === 'en' ? d.name_en : d.name_bn }))}
        placeholder={tr('সব বিভাগ', 'All divisions')}
      />
      <Select
        label={tr('জেলা', 'District')}
        value={districtId || ''}
        onChange={(e) => onDistrict(e.target.value ? Number(e.target.value) : '')}
        options={districts}
        placeholder={tr('জেলা বেছে নিন', 'Choose district')}
        required={required}
        error={errors.district_id}
      />
      {showUpazila && (
        <Input
          label={tr('উপজেলা', 'Upazila')}
          value={upazila || ''}
          onChange={(e) => onUpazila(e.target.value)}
          placeholder={tr('যেমন: শিবগঞ্জ', 'e.g. Shibganj')}
          maxLength={80}
          error={errors.upazila}
        />
      )}
    </div>
  )
}

/** Compact division + district filter for search pages. */
export function AreaFilter({ divisionId, districtId, onChange }) {
  const { lang, tr } = useLang()
  const lk = useLookups()
  const districts = lk.districts
    .filter((d) => !divisionId || d.division_id === Number(divisionId))
    .map((d) => ({ value: d.id, label: lang === 'en' ? d.name_en : d.name_bn }))
    .sort((a, b) => a.label.localeCompare(b.label, lang === 'en' ? 'en' : 'bn'))

  return (
    <>
      <Select
        label={tr('বিভাগ', 'Division')}
        value={divisionId || ''}
        onChange={(e) => onChange({ division_id: e.target.value, district_id: '' })}
        options={lk.divisions.map((d) => ({ value: d.id, label: lang === 'en' ? d.name_en : d.name_bn }))}
        placeholder={tr('সব বিভাগ', 'All divisions')}
      />
      <Select
        label={tr('জেলা', 'District')}
        value={districtId || ''}
        onChange={(e) => onChange({ district_id: e.target.value })}
        options={districts}
        placeholder={tr('সব জেলা', 'All districts')}
      />
    </>
  )
}
