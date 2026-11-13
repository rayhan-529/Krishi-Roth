import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import { useFetch } from '../../hooks/useFetch'
import { get } from '../../services/api'
import { label } from '../../utils/labels'
import { date, money, num, pick } from '../../utils/format'
import { HOME_BY_ROLE } from '../../utils/nav'
import { ListingCard } from '../market/Marketplace'
import { EmptyState, Loader, PriceSourceNote } from '../../components/ui'

const HERO_PHOTO =
  'https://commons.wikimedia.org/wiki/Special:FilePath/Rice%20harvesting%20by%20farmers%20in%20a%20wetland%20field%2C%20Bangladesh%202026%2002.jpg?width=1200'

const SERVICES = [
  ['📊', '/market-prices', 'ফসলের বাজারদর', 'Market prices', 'সঠিক দাম জেনে সিদ্ধান্ত নিন', 'Know the price before you sell'],
  ['🤝', '/marketplace', 'সরাসরি ক্রেতা', 'Sell to buyers', 'মধ্যস্বত্বভোগী ছাড়া ন্যায্য দামে বিক্রি', 'Fair prices without middlemen'],
  ['🧮', '/farmer/notebooks', 'খরচের খাতা', 'Expense notebook', 'উৎপাদন খরচ ও লাভের হিসাব', 'Track costs and profit'],
  ['👨‍🌾', '/services/labour', 'শ্রমিক খুঁজুন', 'Find labour', 'এলাকার কৃষি শ্রমিক', 'Farm workers near you'],
  ['🚜', '/services/harvester', 'হারভেস্টার ও ট্রাক্টর', 'Harvester & tractor', 'যন্ত্র ভাড়া ও বুকিং', 'Rent and book machinery'],
  ['🚚', '/services/transport', 'ফসল পরিবহন', 'Crop transport', 'ট্রাক, পিকআপ, নৌকা', 'Trucks, pickups, boats'],
  ['🤖', '/chatbot', 'এআই কৃষি সহায়ক', 'AI farm assistant', 'বাংলায় প্রশ্ন করুন', 'Ask in Bengali'],
  ['🌱', '/farmer/harvests', 'ফসল ব্যবস্থাপনা', 'Harvest planner', 'রোপণ থেকে কাটা পর্যন্ত', 'From planting to harvest'],
]

export default function Home() {
  const { lang, tr } = useLang()
  const { user } = useAuth()
  const stats = useFetch(() => get('/meta/stats'), [])
  const prices = useFetch(() => get('/market-prices', { limit: 6 }), [])
  const listings = useFetch(() => get('/listings', { limit: 4 }), [])
  const s = stats.data

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">🌱 {tr('কৃষকের পাশে, বাংলাদেশের কৃষির উন্নয়নে', 'Standing with the farmers of Bangladesh')}</span>
          <h1>
            {tr('কৃষকের পরিশ্রমের', 'A fair price for')}
            <span>{tr('ন্যায্য মূল্য নিশ্চিত করি', "every farmer's hard work")}</span>
          </h1>
          <p>
            {tr(
              'ফসলের বাজারদর জানুন, সরাসরি ক্রেতার কাছে ফসল বিক্রি করুন, শ্রমিক-যন্ত্র-পরিবহন বুক করুন এবং নিজের খরচ ও লাভের হিসাব রাখুন—সবকিছু এক জায়গায়, সহজ বাংলায়।',
              'Check market prices, sell directly to buyers, book labour, machinery and transport, and keep track of your costs — all in one place.',
            )}
          </p>
          <div className="hero-buttons">
            {user ? (
              <Link to={HOME_BY_ROLE[user.role]} className="btn btn-primary">{tr('আমার ড্যাশবোর্ড', 'My dashboard')} →</Link>
            ) : (
              <Link to="/register" className="btn btn-primary">{tr('বিনামূল্যে নিবন্ধন করুন', 'Register for free')} →</Link>
            )}
            <Link to="/market-prices" className="btn btn-outline">📊 {tr('আজকের বাজারদর', "Today's prices")}</Link>
          </div>
          <ul className="trust">
            <li>✓ {tr('সহজ বাংলা', 'Simple Bengali')}</li>
            <li>✓ {tr('যাচাইকৃত ব্যবহারকারী', 'Verified users')}</li>
            <li>✓ {tr('নিরাপদ লেনদেন ধাপ', 'Step-by-step safe trade')}</li>
          </ul>
        </div>
        <figure className="hero-photo">
          <img src={HERO_PHOTO} alt={tr('বাংলাদেশের হাওর অঞ্চলে কৃষকেরা ধান কাটছেন', 'Farmers harvesting rice in a wetland field in Bangladesh')} loading="eager" />
          <figcaption>
            {tr('ছবি', 'Photo')}:{' '}
            <a href="https://commons.wikimedia.org/wiki/File:Rice_harvesting_by_farmers_in_a_wetland_field,_Bangladesh_2026_02.jpg" target="_blank" rel="noreferrer">
              A S M Jobaer / Wikimedia Commons
            </a>
            , CC BY-SA 4.0
          </figcaption>
        </figure>
      </section>

      <div className="page">
        {s && (
          <section className="home-stats" aria-label={tr('প্ল্যাটফর্মের তথ্য', 'Platform numbers')}>
            <div><strong>{num(s.farmers, lang)}</strong><span>{tr('নিবন্ধিত কৃষক', 'Farmers')}</span></div>
            <div><strong>{num(s.buyers, lang)}</strong><span>{tr('ক্রেতা', 'Buyers')}</span></div>
            <div><strong>{num(s.active_listings, lang)}</strong><span>{tr('বিক্রির ফসল', 'Crops for sale')}</span></div>
            <div><strong>{num(s.service_providers, lang)}</strong><span>{tr('সেবাদাতা', 'Service providers')}</span></div>
          </section>
        )}

        <section className="section">
          <h2 className="section-title">{tr('আমাদের সেবা', 'Our services')}</h2>
          <div className="service-grid">
            {SERVICES.map(([icon, to, bn, en, dbn, den]) => (
              <Link key={to} to={to} className="service-tile">
                <span aria-hidden="true">{icon}</span>
                <strong>{tr(bn, en)}</strong>
                <small>{tr(dbn, den)}</small>
              </Link>
            ))}
          </div>
        </section>

        <section className="section two-col even">
          <div className="card">
            <div className="card-head">
              <h2>📊 {tr('সর্বশেষ বাজারদর', 'Latest market prices')}</h2>
              <Link to="/market-prices">{tr('সব দেখুন', 'View all')} →</Link>
            </div>
            {prices.loading ? (
              <Loader inline />
            ) : !prices.data || prices.data.length === 0 ? (
              <EmptyState icon="📊" title={tr('এখনো বাজারদর যোগ করা হয়নি', 'No market prices yet')} text={tr('অ্যাডমিন বাজারদর যোগ করলে এখানে দেখা যাবে।', 'Prices will appear here once an administrator adds them.')} />
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
              <h2>🌾 {tr('নতুন ফসল বিক্রির জন্য', 'New crops for sale')}</h2>
              <Link to="/marketplace">{tr('বাজারে যান', 'Open marketplace')} →</Link>
            </div>
            {listings.loading ? (
              <Loader inline />
            ) : !listings.data || listings.data.length === 0 ? (
              <EmptyState title={tr('এখনো কোনো ফসলের বিজ্ঞাপন নেই', 'No crops listed yet')} text={tr('কৃষক হিসেবে নিবন্ধন করে প্রথম বিজ্ঞাপন দিন।', 'Register as a farmer and post the first listing.')} />
            ) : (
              <div className="mini-listings">
                {listings.data.map((l) => <ListingCard key={l.id} listing={l} compact />)}
              </div>
            )}
          </div>
        </section>

        <section className="section steps">
          <h2 className="section-title">{tr('কীভাবে নিরাপদে বিক্রি করবেন', 'How safe selling works')}</h2>
          <ol>
            <li><strong>{tr('বিজ্ঞাপন দিন', 'List your crop')}</strong><span>{tr('ফসল, পরিমাণ, দাম ও ছবি দিন।', 'Add crop, quantity, price and photos.')}</span></li>
            <li><strong>{tr('প্রস্তাব পান', 'Get offers')}</strong><span>{tr('ক্রেতারা দাম প্রস্তাব করবেন, আপনি গ্রহণ বা বাতিল করবেন।', 'Buyers make offers; you accept or reject.')}</span></li>
            <li><strong>{tr('মূল্য ও ডেলিভারি', 'Payment & delivery')}</strong><span>{tr('প্রতিটি ধাপ রেকর্ড থাকে—মূল্য পাওয়া, ফসল পাঠানো, ফসল পাওয়া।', 'Every step is recorded: payment, dispatch, receipt.')}</span></li>
            <li><strong>{tr('রেটিং দিন', 'Rate each other')}</strong><span>{tr('লেনদেন শেষে একে অপরকে রেটিং দিন।', 'Both sides rate each other after completion.')}</span></li>
          </ol>
        </section>
      </div>
    </div>
  )
}
