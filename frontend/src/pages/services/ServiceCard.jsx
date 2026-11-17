/** Card used by the labour, machinery and transport search pages. */
import { Link } from 'react-router-dom'
import { useLang } from '../../context/LanguageContext'
import { mediaUrl } from '../../services/api'
import { label } from '../../utils/labels'
import { money, num, pick } from '../../utils/format'
import Icon, { Glyph } from '../../components/Icon'
import { Avatar, Badge, Stars, VerifiedBadge } from '../../components/ui'

export default function ServiceCard({ photo, emoji, title, subtitle, price, priceUnit, ownerId, ownerName, ownerPhoto, verification, rating, reviewCount, completedJobs, row, available, details, onBook }) {
  const { lang, tr } = useLang()
  return (
    <article className="service-card">
      <div className="service-photo">
        {photo ? <img src={mediaUrl(photo)} alt="" loading="lazy" /> : <Glyph value={emoji} size={40} />}
        {!available && <Badge tone="grey">{tr('এখন ব্যস্ত', 'Busy now')}</Badge>}
      </div>
      <div className="service-body">
        <h3>{title}</h3>
        {subtitle && <p className="muted small">{subtitle}</p>}
        <p className="listing-price">{money(price, lang)} <small>{label('machinePrice', priceUnit, lang)}</small></p>
        <p className="muted small"><Icon name="pin" size={14} /> {row.upazila ? `${row.upazila}, ` : ''}{pick(row, 'district', lang)}</p>
        {details}
        <Link to={`/users/${ownerId}`} className="person small-person">
          <Avatar src={ownerPhoto} name={ownerName} size={32} />
          <span>
            <strong>{ownerName}</strong> <VerifiedBadge status={verification} />
            <Stars value={rating} count={reviewCount} size={12} />
          </span>
        </Link>
        <small className="muted">{tr(`${num(completedJobs || 0, lang)}টি কাজ সম্পন্ন`, `${num(completedJobs || 0, lang)} jobs completed`)}</small>
      </div>
      <div className="service-foot">
        <button type="button" className="btn btn-primary btn-block" onClick={onBook} disabled={!available}>{tr('বুক করুন', 'Book now')}</button>
      </div>
    </article>
  )
}
