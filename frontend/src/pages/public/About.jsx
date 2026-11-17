import { Link } from 'react-router-dom'
import { useLang } from '../../context/LanguageContext'
import Icon from '../../components/Icon'
import { Card, PageHeader } from '../../components/ui'

export default function About() {
  const { tr } = useLang()
  const roles = [
    ['sprout', tr('কৃষক', 'Farmers'), tr('বিক্রি, হিসাব ও বুকিং', 'Sell, track, book')],
    ['cart', tr('ক্রেতা', 'Buyers'), tr('সরাসরি কৃষকের কাছ থেকে', 'Direct from farms')],
    ['users', tr('কৃষি শ্রমিক', 'Farm workers'), tr('কাজের অনুরোধ', 'Work requests')],
    ['tractor', tr('যন্ত্র মালিক', 'Machine owners'), tr('হারভেস্টার ও ট্রাক্টর ভাড়া', 'Rent harvesters & tractors')],
    ['truck', tr('পরিবহন মালিক', 'Transport owners'), tr('ফসল পরিবহন', 'Crop transport')],
  ]
  return (
    <div className="page narrow">
      <PageHeader title={tr('কৃষি রথ সম্পর্কে', 'About Krishi Roth')} />
      <Card>
        <p className="lead">
          {tr(
            'বাংলাদেশের কৃষকের জন্য ডিজিটাল প্ল্যাটফর্ম — ন্যায্য দামে বিক্রি, বাজারদর, খরচের হিসাব এবং কৃষিসেবা বুকিং।',
            'A digital platform for Bangladeshi farmers — fair sales, market prices, cost tracking and farm-service booking.',
          )}
        </p>
        <div className="role-grid">
          {roles.map(([icon, title, text]) => (
            <div key={icon} className="role-item">
              <span className="stat-icon tone-green"><Icon name={icon} size={20} /></span>
              <span><strong>{title}</strong><small>{text}</small></span>
            </div>
          ))}
        </div>
        <h2>{tr('নিরাপত্তা', 'Trust & safety')}</h2>
        <p className="muted">
          {tr(
            'প্রতিটি লেনদেনের ধাপ রেকর্ড থাকে। সেফ ট্রেডে ক্রেতার টাকা কৃষি রথে জমা থাকে, ফসল পেয়ে নিশ্চিত করলে তবেই কৃষক পান। বাজারদর অ্যাডমিন প্রদত্ত; এআই পরামর্শ সাধারণ তথ্য।',
            'Every trade step is recorded. With Safe Trade the buyer’s money is held by Krishi Roth and paid to the farmer only after delivery is confirmed. Prices are admin-entered; AI advice is general guidance.',
          )}
        </p>
        <div className="form-actions">
          <Link to="/register" className="btn btn-primary">{tr('এখনই যোগ দিন', 'Join now')}</Link>
        </div>
      </Card>
    </div>
  )
}
