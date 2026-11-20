/** Crop doctor result: problem, confidence and what to do. */
import Icon from './Icon'

const CONFIDENCE = {
  high: ['বেশ নিশ্চিত', 'Fairly sure', 'green'],
  medium: ['মোটামুটি নিশ্চিত', 'Somewhat sure', 'amber'],
  low: ['নিশ্চিত নয়', 'Not sure', 'grey'],
}

function Section({ icon, title, items, tone }) {
  if (!items || !items.length) return null
  return (
    <section className={`diag-section diag-${tone}`}>
      <h3><Icon name={icon} size={17} /> {title}</h3>
      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>
  )
}

export default function DiagnosisResult({ result: r, lang }) {
  const tr = (bn, en) => (lang === 'en' ? en : bn)
  const [cBn, cEn, cTone] = CONFIDENCE[r.confidence] || CONFIDENCE.low

  if (!r.is_plant) {
    return (
      <div className="card diag-card">
        <div className="diag-head diag-unknown">
          <Icon name="image" size={28} />
          <div>
            <strong>{tr('ছবিতে কোনো ফসল বা গাছ বোঝা যাচ্ছে না', 'No crop or plant found in this photo')}</strong>
            <p>{r.summary || tr('আক্রান্ত পাতা বা ফলের কাছ থেকে আরেকটা ছবি তুলুন।', 'Take another close-up photo of the affected leaf or fruit.')}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card diag-card">
      <div className={`diag-head ${r.healthy ? 'diag-healthy' : 'diag-sick'}`}>
        <Icon name={r.healthy ? 'checkCircle' : 'alert'} size={30} />
        <div>
          <small>{r.crop || tr('ফসল', 'Crop')}</small>
          <strong>{r.healthy ? tr('গাছ সুস্থ দেখাচ্ছে', 'The plant looks healthy') : r.problem || tr('সমস্যা পাওয়া গেছে', 'A problem was found')}</strong>
          <span className={`badge badge-${cTone}`}>{tr(cBn, cEn)}</span>
        </div>
      </div>

      {r.summary && <p className="diag-summary">{r.summary}</p>}

      <div className="diag-grid">
        <Section icon="eye" title={tr('যা দেখা যাচ্ছে', 'What we see')} items={r.symptoms} tone="info" />
        <Section icon="info" title={tr('সম্ভাব্য কারণ', 'Likely causes')} items={r.causes} tone="info" />
        <Section icon="wrench" title={tr('এখন যা করবেন', 'What to do now')} items={r.treatment} tone="action" />
        <Section icon="shield" title={tr('পরের বার এড়াতে', 'To prevent it next time')} items={r.prevention} tone="good" />
      </div>

      {(r.see_expert || r.confidence === 'low') && (
        <div className="diag-expert">
          <Icon name="phone" size={18} />
          <span>
            {r.see_expert
              ? tr('সমস্যাটা গুরুতর হতে পারে। দ্রুত উপজেলা কৃষি অফিসারের সাথে কথা বলুন বা কৃষি কল সেন্টারে ফোন করুন: ', 'This may be serious. Talk to your Upazila Agriculture Officer soon or call the agriculture call centre: ')
              : tr('ফলাফল নিশ্চিত নয়। কাছ থেকে আরেকটা পরিষ্কার ছবি দিন, অথবা ফোন করুন: ', 'The result is not certain. Try a clearer close-up photo, or call: ')}
            <a href="tel:16123"><strong>16123</strong></a>
          </span>
        </div>
      )}
    </div>
  )
}
