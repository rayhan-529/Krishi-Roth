/** Crop market prices: latest price per crop and market, with search, filters and a comparison view. */
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLang } from '../../context/LanguageContext'
import { useLookups } from '../../context/LookupsContext'
import { useFetch } from '../../hooks/useFetch'
import { get } from '../../services/api'
import { label } from '../../utils/labels'
import { date, dateTime, money, pick } from '../../utils/format'
import BarChart from '../../components/BarChart'
import CropSelect from '../../components/CropSelect'
import Icon from '../../components/Icon'
import { AreaFilter } from '../../components/LocationFields'
import { Badge, Card, EmptyState, ErrorBox, Loader, PageHeader, Pagination, PriceSourceNote, Select } from '../../components/ui'

function Compare({ cropId }) {
  const { lang, tr } = useLang()
  const { data, loading, error } = useFetch(() => get('/market-prices/compare', { crop_id: cropId }), [cropId])
  if (loading) return <Loader inline />
  if (error) return <ErrorBox error={error} />
  if (!data || data.markets.length === 0) return <p className="muted">{tr('এই ফসলের কোনো দাম নেই।', 'No prices for this crop.')}</p>
  const unit = label('unit', data.unit, lang)
  return (
    <div className="compare">
      {data.summary && (
        <div className="stats-grid">
          <div className="mini-stat"><small>{tr('সর্বনিম্ন গড়', 'Lowest average')}</small><strong>{money(data.summary.lowest, lang)}</strong></div>
          <div className="mini-stat"><small>{tr('সর্বোচ্চ গড়', 'Highest average')}</small><strong>{money(data.summary.highest, lang)}</strong></div>
          <div className="mini-stat"><small>{tr('সব বাজারের গড়', 'Average of markets')}</small><strong>{money(data.summary.average, lang)}</strong></div>
          <div className="mini-stat"><small>{tr('একক', 'Unit')}</small><strong>{unit}</strong></div>
        </div>
      )}
      <h3>{tr('বাজার অনুযায়ী গড় দাম', 'Average price by market')}</h3>
      <BarChart data={data.markets.map((m) => ({ label: m.market_name, value: m.avg_price }))} format={(v) => money(v, lang)} />
      {data.trend.length > 1 && (
        <>
          <h3 className="mt">{tr('দামের প্রবণতা (তারিখ অনুযায়ী গড়)', 'Price trend (average by date)')}</h3>
          <BarChart data={data.trend.map((t) => ({ label: date(t.price_date, lang), value: t.avg_price }))} format={(v) => money(v, lang)} />
        </>
      )}
    </div>
  )
}

/** All crops × divisions (or × districts of the chosen division): latest average price in each cell. */
function PriceMatrix({ q, categoryId, divisionId, onPickCrop }) {
  const { lang, tr } = useLang()
  const lk = useLookups()
  const { data, loading, error, reload } = useFetch(
    () => get('/market-prices/matrix', { q, category_id: categoryId, division_id: divisionId }),
    [q, categoryId, divisionId],
  )
  const name = (x) => (lang === 'en' ? x.name_en : x.name_bn)
  const columns = divisionId
    ? lk.districts.filter((d) => d.division_id === Number(divisionId)).sort((a, b) => name(a).localeCompare(name(b), lang === 'en' ? 'en' : 'bn'))
    : lk.divisions

  if (loading) return <Loader />
  if (error) return <div className="card-pad"><ErrorBox error={error} onRetry={reload} /></div>
  if (!data || data.rows.length === 0) {
    return <EmptyState icon="📊" title={tr('কোনো দাম পাওয়া যায়নি', 'No prices found')} text={tr('অন্য নাম দিয়ে খুঁজুন।', 'Try another search.')} />
  }

  return (
    <div className="table-wrap">
      <table className="table price-matrix">
        <thead>
          <tr>
            <th>{tr('ফসল', 'Crop')}</th>
            <th>{divisionId ? tr('বিভাগের গড়', 'Division avg') : tr('দেশের গড়', 'National avg')}</th>
            {columns.map((c) => <th key={c.id}>{name(c)}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => {
            const values = Object.values(r.cells).map((c) => Number(c.avg_price))
            const lo = Math.min(...values)
            const hi = Math.max(...values)
            return (
              <tr key={`${r.crop_id}-${r.unit}`}>
                <td>
                  <button type="button" className="link-btn" onClick={() => onPickCrop(r.crop_id)}>{pick(r, 'crop', lang)}</button>
                  {r.is_sample && <> <Badge tone="amber">{tr('নমুনা', 'Sample')}</Badge></>}
                  <br /><small className="muted">{pick(r, 'category', lang)} · /{label('unit', r.unit, lang)}</small>
                </td>
                <td className="nowrap"><strong>{money(r.avg_price, lang)}</strong></td>
                {columns.map((c) => {
                  const cell = r.cells[c.id]
                  if (!cell) return <td key={c.id} className="muted">—</td>
                  const v = Number(cell.avg_price)
                  const cls = values.length > 1 && v === lo ? 'cell-low' : values.length > 1 && v === hi ? 'cell-high' : ''
                  return (
                    <td key={c.id} className={`nowrap ${cls}`} title={`${money(cell.min_price, lang)} – ${money(cell.max_price, lang)}`}>
                      {money(cell.avg_price, lang)}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="source-note card-pad">
        <span className="cell-low">{tr('সবুজ', 'Green')}</span> = {tr('সবচেয়ে কম দাম', 'lowest price')},{' '}
        <span className="cell-high">{tr('লাল', 'Red')}</span> = {tr('সবচেয়ে বেশি দাম', 'highest price')}।{' '}
        {tr('ঘরের উপর মাউস রাখলে সর্বনিম্ন–সর্বোচ্চ দাম দেখা যাবে।', 'Hover a cell to see the min–max range.')}
      </p>
    </div>
  )
}

export default function MarketPrices() {
  const { lang, tr } = useLang()
  const lk = useLookups()
  const [params, setParams] = useSearchParams()
  const [page, setPage] = useState(1)
  const filters = {
    q: params.get('q') || '',
    category_id: params.get('category_id') || '',
    crop_id: params.get('crop_id') || '',
    division_id: params.get('division_id') || '',
    district_id: params.get('district_id') || '',
  }
  const key = JSON.stringify(filters)
  const { data, meta, loading, error, reload } = useFetch(() => get('/market-prices', { ...filters, page }), [key, page])
  const [view, setView] = useState('matrix')
  const [searchText, setSearchText] = useState(filters.q)

  function update(changes) {
    const next = { ...filters, ...changes }
    setParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v)), { replace: true })
    setPage(1)
  }

  // Search while typing (waits 400 ms after the last key press).
  useEffect(() => {
    const text = searchText.trim()
    if (text === filters.q) return undefined
    const t = setTimeout(() => update({ q: text }), 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText])

  return (
    <div className="page">
      <PageHeader
        title={tr('ফসলের বাজারদর', 'Crop market prices')}
        subtitle={meta && meta.last_updated ? `${tr('সর্বশেষ হালনাগাদ', 'Last updated')}: ${dateTime(meta.last_updated, lang)}` : null}
      />
      <div className="filters">
        <div className="field field-wide search-box">
          <label htmlFor="price-search">{tr('খুঁজুন', 'Search')}</label>
          <div className="search-box">
            <Icon name="search" size={18} />
            <input id="price-search" type="search" className="input" value={searchText} placeholder={tr('ফসল, জেলা বা বাজারের নাম (যেমন: আলু, রাজশাহী)', 'Crop, district or market (e.g. potato, Rajshahi)')} onChange={(e) => setSearchText(e.target.value)} />
          </div>
        </div>
        <Select
          label={tr('ধরন', 'Category')}
          value={filters.category_id}
          onChange={(e) => update({ category_id: e.target.value, crop_id: '' })}
          options={lk.crop_categories.map((c) => ({ value: c.id, label: lang === 'en' ? c.name_en : c.name_bn }))}
          placeholder={tr('সব ধরন', 'All categories')}
        />
        <CropSelect value={filters.crop_id} onChange={(v) => update({ crop_id: v })} placeholder={tr('সব ফসল', 'All crops')} />
        <AreaFilter divisionId={filters.division_id} districtId={filters.district_id} onChange={update} />
      </div>

      {filters.crop_id && (
        <Card title={`${tr('দাম তুলনা', 'Price comparison')}: ${lang === 'en' ? lk.cropById[filters.crop_id]?.name_en : lk.cropById[filters.crop_id]?.name_bn}`}>
          <Compare cropId={filters.crop_id} />
        </Card>
      )}

      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={view === 'matrix'} className={`btn btn-sm ${view === 'matrix' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('matrix')}>
          {filters.division_id ? tr('জেলা অনুযায়ী দাম', 'Prices by district') : tr('বিভাগ অনুযায়ী দাম', 'Prices by division')}
        </button>{' '}
        <button type="button" role="tab" aria-selected={view === 'list'} className={`btn btn-sm ${view === 'list' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('list')}>
          {tr('বাজার অনুযায়ী তালিকা', 'List by market')}
        </button>
      </div>

      {view === 'matrix' ? (
        <Card padded={false} title={filters.division_id ? tr('সব ফসল × জেলা (সর্বশেষ গড় দাম)', 'All crops × districts (latest average)') : tr('সব ফসল × বিভাগ (সর্বশেষ গড় দাম)', 'All crops × divisions (latest average)')}>
          <PriceMatrix q={filters.q} categoryId={filters.category_id} divisionId={filters.division_id} onPickCrop={(id) => update({ crop_id: id })} />
        </Card>
      ) : (
      <>
      <Card padded={false} title={tr('সর্বশেষ দাম', 'Latest prices')}>
        {loading ? (
          <Loader />
        ) : error ? (
          <div className="card-pad"><ErrorBox error={error} onRetry={reload} /></div>
        ) : data.length === 0 ? (
          <EmptyState icon="📊" title={tr('কোনো দাম পাওয়া যায়নি', 'No prices found')} text={tr('অন্য ফিল্টার দিয়ে খুঁজুন। অ্যাডমিন দাম যোগ করলে এখানে দেখা যাবে।', 'Try other filters. Prices appear here once an administrator adds them.')} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{tr('ফসল', 'Crop')}</th>
                  <th>{tr('বাজার', 'Market')}</th>
                  <th>{tr('এলাকা', 'Location')}</th>
                  <th>{tr('দাম (সর্বনিম্ন – সর্বোচ্চ)', 'Price (min – max)')}</th>
                  <th>{tr('গড়', 'Average')}</th>
                  <th>{tr('তারিখ', 'Date')}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <button type="button" className="link-btn" onClick={() => update({ crop_id: p.crop_id })}>{pick(p, 'crop', lang)}</button>
                      <br /><small className="muted">{pick(p, 'category', lang)}</small>
                    </td>
                    <td>{p.market_name}</td>
                    <td>{pick(p, 'district', lang)}, {pick(p, 'division', lang)}</td>
                    <td className="nowrap">{money(p.min_price, lang)} – {money(p.max_price, lang)} <small className="muted">/{label('unit', p.unit, lang)}</small></td>
                    <td className="nowrap"><strong>{money(p.avg_price, lang)}</strong></td>
                    <td className="nowrap">{date(p.price_date, lang)} {p.source === 'admin' && <Badge tone="blue">{tr('অ্যাডমিন', 'Admin')}</Badge>}{p.source === 'sample' && <Badge tone="amber">{tr('নমুনা', 'Sample')}</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Pagination meta={meta} onPage={setPage} />
      </>
      )}
      <PriceSourceNote />
    </div>
  )
}
