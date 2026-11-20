/**
 * Site footer: brand, link columns, contact, payment methods and a bottom bar.
 * Social links show only when a URL is filled in below.
 */
import { Link } from 'react-router-dom'
import { useLang } from '../context/LanguageContext'
import Icon from './Icon'
import { BrandMark } from './Layout'
import { PayLogos } from './CardSoon'

const CONTACT_EMAIL = 'krishiroth@gmail.com'

/** Fill in the page URLs to show the icons, e.g. facebook: 'https://facebook.com/krishiroth'. */
const SOCIAL = {
  facebook: '',
  youtube: '',
  whatsapp: '',
}

const COLUMNS = [
  {
    title: ['সেবাসমূহ', 'Services'],
    links: [
      ['/market-prices', 'বাজারদর', 'Market prices'],
      ['/marketplace', 'ফসলের বাজার', 'Marketplace'],
      ['/services/labour', 'কৃষি শ্রমিক', 'Farm labour'],
      ['/services/harvester', 'হারভেস্টার', 'Harvesters'],
      ['/services/tractor', 'ট্রাক্টর', 'Tractors'],
      ['/services/transport', 'পরিবহন', 'Transport'],
    ],
  },
  {
    title: ['কৃষকের টুল', 'Farmer tools'],
    links: [
      ['/weather', 'আবহাওয়া', 'Weather'],
      ['/crop-doctor', 'ফসলের ডাক্তার', 'Crop doctor'],
      ['/chatbot', 'এআই সহায়ক', 'AI assistant'],
      ['/farmer/notebooks', 'খরচের খাতা', 'Expense notebook'],
      ['/farmer/harvests', 'ফসল ব্যবস্থাপনা', 'Harvest planner'],
    ],
  },
  {
    title: ['সাহায্য', 'Help'],
    links: [
      ['/about', 'আমাদের সম্পর্কে', 'About us'],
      ['/complaints', 'অভিযোগ ও সহায়তা', 'Complaints & help'],
      ['/wallet', 'ওয়ালেট ও সেফ ট্রেড', 'Wallet & Safe Trade'],
      ['/privacy', 'গোপনীয়তা নীতি', 'Privacy policy'],
      ['/terms', 'ব্যবহারের শর্তাবলি', 'Terms of service'],
    ],
  },
]

function SocialIcon({ name }) {
  // Simple filled brand-neutral marks drawn inline (no external images).
  const paths = {
    facebook: <path d="M14 8h3V4h-3c-2.8 0-4 1.9-4 4.5V11H7v4h3v9h4v-9h3l1-4h-4V8.7c0-.5.3-.7 1-.7z" />,
    youtube: <path d="M22 8.5c-.2-1.6-1-2.5-2.6-2.7C17 5.5 12 5.5 12 5.5s-5 0-7.4.3C3 6 2.2 6.9 2 8.5 1.8 10 1.8 12 1.8 12s0 2 .2 3.5c.2 1.6 1 2.5 2.6 2.7 2.4.3 7.4.3 7.4.3s5 0 7.4-.3c1.6-.2 2.4-1.1 2.6-2.7.2-1.5.2-3.5.2-3.5s0-2-.2-3.5zM10 15V9l5 3-5 3z" />,
    whatsapp: <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.2 14c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.9s.7-2.1 1-2.4c.2-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.7-.1l1.9.9c.3.1.4.2.5.3 0 .2 0 .8-.2 1.3z" />,
  }
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{paths[name]}</svg>
}

export default function Footer() {
  const { tr } = useLang()
  const socials = Object.entries(SOCIAL)

  return (
    <footer className="footer site-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <Link to="/" className="footer-logo">
            <BrandMark size={40} />
            <strong>{tr('কৃষি রথ', 'Krishi Roth')}</strong>
          </Link>
          <p>{tr('কৃষকের পাশে, ন্যায্য দামে। বাজারদর, সরাসরি বিক্রি আর কৃষিসেবা এক জায়গায়।', 'Beside every farmer. Prices, direct sales and farm services in one place.')}</p>
          <ul className="footer-contact">
            <li><Icon name="mail" size={16} /> <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></li>
            <li><Icon name="phone" size={16} /> {tr('কৃষি কল সেন্টার', 'Agriculture call centre')}: <a href="tel:16123">16123</a></li>
            <li><Icon name="pin" size={16} /> {tr('বাংলাদেশ', 'Bangladesh')}</li>
          </ul>
          {/* Icons always show; an icon becomes a link once its URL is filled in SOCIAL above. */}
          <div className="footer-social">
            {socials.map(([name, url]) =>
              url ? (
                <a key={name} href={url} target="_blank" rel="noreferrer" aria-label={name}><SocialIcon name={name} /></a>
              ) : (
                <span key={name} aria-label={name} title={name}><SocialIcon name={name} /></span>
              ),
            )}
          </div>
        </div>

        {COLUMNS.map((col) => (
          <nav key={col.title[1]} className="footer-col" aria-label={tr(col.title[0], col.title[1])}>
            <h3>{tr(col.title[0], col.title[1])}</h3>
            <ul>
              {col.links.map(([to, bn, en]) => (
                <li key={to}><Link to={to}>{tr(bn, en)}</Link></li>
              ))}
            </ul>
          </nav>
        ))}

        <div className="footer-col footer-pay">
          <h3>{tr('পেমেন্ট মাধ্যম', 'Payments accepted')}</h3>
          <PayLogos />
          <p className="footer-safe"><Icon name="shield" size={16} /> {tr('সব কেনাকাটা সেফ ট্রেডে সুরক্ষিত', 'Every purchase protected by Safe Trade')}</p>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} {tr('কৃষি রথ। সর্বস্বত্ব সংরক্ষিত।', 'Krishi Roth. All rights reserved.')}</span>
        <nav>
          <Link to="/privacy">{tr('গোপনীয়তা', 'Privacy')}</Link>
          <Link to="/terms">{tr('শর্তাবলি', 'Terms')}</Link>
          <Link to="/about">{tr('আমাদের সম্পর্কে', 'About')}</Link>
        </nav>
        <button type="button" className="to-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label={tr('উপরে যান', 'Back to top')}>
          <Icon name="chevronRight" size={18} />
        </button>
      </div>
    </footer>
  )
}
