import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import { useFetch } from '../../hooks/useFetch'
import { get } from '../../services/api'
import { label } from '../../utils/labels'
import { date, money, num, pick } from '../../utils/format'
import { HOME_BY_ROLE } from '../../utils/nav'
import { ListingCard } from '../market/Marketplace'
import Icon from '../../components/Icon'
import { EmptyState, Loader, PriceSourceNote } from '../../components/ui'

const HERO_PHOTO =
  'https://commons.wikimedia.org/wiki/Special:FilePath/Rice%20harvesting%20by%20farmers%20in%20a%20wetland%20field%2C%20Bangladesh%202026%2002.jpg?width=1200'

const SERVICES = [
  ['trend', '/market-prices', 'বাজারদর', 'Market prices'],
  ['store', '/marketplace', 'ফসল বিক্রি', 'Sell crops'],
  ['book', '/farmer/notebooks', 'খরচের খাতা', 'Expense book'],
  ['sprout', '/farmer/harvests', 'ফসল ব্যবস্থাপনা', 'Harvest planner'],
  ['users', '/services/labour', 'শ্রমিক', 'Labour'],
  ['tractor', '/services/harvester', 'কৃষিযন্ত্র', 'Machinery'],
  ['truck', '/services/transport', 'পরিবহন', 'Transport'],
  ['sparkle', '/chatbot', 'এআই সহায়ক', 'AI assistant'],
]

export default function Home() {
  const { lang, tr } = useLang()
  const { user } = useAuth()
  const stats = useFetch(() => get('/meta/stats'), [])
  const prices = useFetch(() => get('/market-prices', { limit: 6 }), [])
  const listings = useFetch(() => get('/listings', { limit: 4 }), [])
  const s = stats.data

  const steps = [
    [tr('বিজ্ঞাপন দিন', 'List'), tr('ফসল, দাম ও ছবি', 'Crop, price, photos')],
    [tr('প্রস্তাব নিন', 'Get offers'), tr('গ্রহণ বা বাতিল', 'Accept or decline')],
    [tr('ডেলিভারি', 'Deliver'), tr('প্রতিটি ধাপ রেকর্ড', 'Every step tracked')],
    [tr('রেটিং', 'Rate'), tr('উভয় পক্ষের রিভিউ', 'Two-way reviews')],
  ]

  return (
    <div className="home">
      <section className="hero" style={{ '--hero-img': `url("${HERO_PHOTO}")` }}>
        <div className="hero-inner">
          <span className="eyebrow"><Icon name="sprout" size={15} /> {tr('বাংলাদেশের কৃষকের জন্য', 'Built for Bangladeshi farmers')}</span>
          <h1>{tr('ফসলের ন্যায্য দাম, এক প্ল্যাটফর্মে', 'Fair prices for every harvest')}</h1>
          <p>{tr('বাজারদর, সরাসরি বিক্রি আর কৃষিসেবা — সব এক জায়গায়।', 'Prices, direct sales and farm services in one place.')}</p>
          <div className="hero-buttons">
            {user ? (
              <Link to={HOME_BY_ROLE[user.role]} className="btn btn-gold btn-lg">{tr('ড্যাশবোর্ড', 'Dashboard')} <Icon name="arrowRight" size={18} /></Link>
            ) : (
              <Link to="/register" className="btn btn-gold btn-lg">{tr('শুরু করুন', 'Get started')} <Icon name="arrowRight" size={18} /></Link>
            )}
            <Link to="/market-prices" className="btn btn-glass btn-lg">{tr('আজকের বাজারদর', "Today's prices")}</Link>
          </div>
        </div>
        <a className="hero-credit" href="https://commons.wikimedia.org/wiki/File:Rice_harvesting_by_farmers_in_a_wetland_field,_Bangladesh_2026_02.jpg" target="_blank" rel="noreferrer">
          Photo: A S M Jobaer / Wikimedia Commons, CC BY-SA 4.0
        </a>
      </section>

      <div className="page">
        {s && (
          <section className="home-stats" aria-label={tr('প্ল্যাটফর্মের তথ্য', 'Platform numbers')}>
            <div><strong>{num(s.farmers, lang)}</strong><span>{tr('কৃষক', 'Farmers')}</span></div>
            <div><strong>{num(s.buyers, lang)}</strong><span>{tr('ক্রেতা', 'Buyers')}</span></div>
            <div><strong>{num(s.active_listings, lang)}</strong><span>{tr('বিক্রির ফসল', 'Live listings')}</span></div>
            <div><strong>{num(s.service_providers, lang)}</strong><span>{tr('সেবাদাতা', 'Providers')}</span></div>
          </section>
        )}

        <section className="section">
          <h2 className="section-title">{tr('সেবাসমূহ', 'Services')}</h2>
          <div className="service-grid">
            {SERVICES.map(([icon, to, bn, en]) => (
              <Link key={to} to={to} className="service-tile">
                <span className="service-tile-icon"><Icon name={icon} size={22} /></span>
                <strong>{tr(bn, en)}</strong>
                <Icon name="chevronRight" size={16} className="service-tile-arrow" />
              </Link>
            ))}
          </div>
        </section>

        <section className="section two-col even">
          <div className="card">
            <div className="card-head">
              <h2>{tr('সর্বশেষ বাজারদর', 'Latest prices')}</h2>
              <Link to="/market-prices" className="card-link">{tr('সব দেখুন', 'View all')}</Link>
            </div>
            {prices.loading ? (
              <Loader inline />
            ) : !prices.data || prices.data.length === 0 ? (
              <EmptyState icon="trend" title={tr('এখনো বাজারদর নেই', 'No prices yet')} />
            ) : (
              <ul className="price-list">
                {prices.data.map((p) => (
                  <li key={p.id}>
                    <div>
                      <strong>{pick(p, 'crop', lang)}</strong>
                      <small>{p.market_name}, {pick(p, 'district', lang)} · {date(p.price_date, lang)}</small>
                    </div>
                    <span>{money(p.min_price, lang)} – {money(p.max_price, lang)} <small>/{label('unit', p.unit, lang)}</small></span>
                  </li>
                ))}
              </ul>
            )}
            <PriceSourceNote />
          </div>

          <div className="card">
            <div className="card-head">
              <h2>{tr('নতুন ফসল', 'New listings')}</h2>
              <Link to="/marketplace" className="card-link">{tr('সব দেখুন', 'View all')}</Link>
            </div>
            {listings.loading ? (
              <Loader inline />
            ) : !listings.data || listings.data.length === 0 ? (
              <EmptyState title={tr('এখনো কোনো বিজ্ঞাপন নেই', 'No listings yet')} />
            ) : (
              <div className="mini-listings">
                {listings.data.map((l) => <ListingCard key={l.id} listing={l} compact />)}
              </div>
            )}
          </div>
        </section>

        <section className="section steps">
          <h2 className="section-title">{tr('কীভাবে কাজ করে', 'How it works')}</h2>
          <ol>
            {steps.map(([title, text]) => (
              <li key={title}><strong>{title}</strong><span>{text}</span></li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  )
}
