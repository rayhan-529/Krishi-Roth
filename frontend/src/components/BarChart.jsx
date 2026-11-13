/**
 * A simple, accessible bar chart drawn with HTML/CSS (no chart library).
 *   <BarChart data={[{ label: 'জুন', value: 1200 }]} format={(v) => money(v, lang)} />
 */
export default function BarChart({ data = [], format = (v) => v, height = 160, emptyText }) {
  const max = Math.max(0, ...data.map((d) => Number(d.value) || 0))
  if (!data.length || max === 0) return <p className="muted chart-empty">{emptyText}</p>

  return (
    <div className="bar-chart" style={{ height }} role="img" aria-label={data.map((d) => `${d.label}: ${format(d.value)}`).join(', ')}>
      {data.map((d) => {
        const value = Number(d.value) || 0
        return (
          <div className="bar-col" key={d.label} title={`${d.label}: ${format(value)}`}>
            <span className="bar-value">{value > 0 ? format(value) : ''}</span>
            <span className="bar" style={{ height: `${Math.max(value > 0 ? 4 : 0, (value / max) * 100)}%` }} />
            <span className="bar-label">{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}

/** Horizontal bars for "share of total" lists (e.g. expenses by category). */
export function HBarList({ items = [], format = (v) => v, emptyText }) {
  const max = Math.max(0, ...items.map((i) => Number(i.value) || 0))
  if (!items.length || max === 0) return <p className="muted chart-empty">{emptyText}</p>
  return (
    <ul className="hbar-list">
      {items.map((item) => (
        <li key={item.label}>
          <div className="hbar-text">
            <span>{item.label}</span>
            <strong>{format(item.value)}</strong>
          </div>
          <div className="hbar-track">
            <span style={{ width: `${(Number(item.value) / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
