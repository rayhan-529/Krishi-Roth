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

      <Card>
        <div className="founder-head">
          <span className="founder-avatar" aria-hidden="true">AR</span>
          <div>
            <small>{tr('প্রতিষ্ঠাতা ও ডেভেলপার', 'Founder & developer')}</small>
            <h2>{tr('মো. আবু রায়হান', 'MD. Abu Rayhan')}</h2>
            <span className="muted small">{tr('সফটওয়্যার ইঞ্জিনিয়ারিং, ড্যাফোডিল ইন্টারন্যাশনাল ইউনিভার্সিটি', 'Software Engineering, Daffodil International University')}</span>
          </div>
        </div>
        <h3>{tr('কৃষকের সন্তানের হাতে কৃষকের জন্য', 'Built by a farmer’s son, for farmers')}</h3>
        <p>
          {tr(
            'আমি মো. আবু রায়হান, বয়স 22। ড্যাফোডিল ইন্টারন্যাশনাল ইউনিভার্সিটির (DIU) সফটওয়্যার ইঞ্জিনিয়ারিং বিভাগের 42তম ব্যাচের (ইনটেক 241) একজন নিয়মিত শিক্ষার্থী। আমার বাড়ি জামালপুর সদর উপজেলার তিতপল্লা ইউনিয়নের কাষ্টসিংগা গ্রামে।',
            'I am MD. Abu Rayhan, 22, a current student of Software Engineering (batch 42, intake 241) at Daffodil International University (DIU). My home is in Kastoshinga village, Titpolla Union, Jamalpur Sadar, Bangladesh.',
          )}
        </p>
        <p>
          {tr(
            'আমার বাবা মো. আমজাদ আলী একজন কৃষক, মা রোকসানা আক্তার। ছোটবেলা থেকে দেখেছি, বাবা মাথার ঘাম পায়ে ফেলে ফসল ফলান, কিন্তু সঠিক বাজারদর না জানায় আর মধ্যস্বত্বভোগীর কারণে ন্যায্য দাম পান না। শ্রমিক, হারভেস্টার বা ট্রাক খুঁজতেও অনেক কষ্ট হয়।',
            'My father, Amzad Ali, is a farmer and my mother is Roksana Akter. Growing up, I watched my father work hard on the land but often miss a fair price because he did not know the real market rate and had to sell through middlemen. Finding workers, harvesters or trucks was hard too.',
          )}
        </p>
        <p>
          {tr(
            'একজন কৃষকের সন্তান হিসেবে কৃষকদের জন্য ভালো কিছু করার ইচ্ছা থেকেই কৃষি রথ বানিয়েছি। এখানে কৃষক বাজারদর দেখতে পারেন, সরাসরি ক্রেতার কাছে ফসল বিক্রি করতে পারেন, আবহাওয়ার পূর্বাভাস পান, ছবি তুলে ফসলের রোগ চিনতে পারেন, আর সেফ ট্রেডে নিরাপদে টাকা পান।',
            'As a farmer’s son, I built Krishi Roth to do something good for farmers. Here farmers can check market prices, sell directly to buyers, get weather forecasts, identify crop diseases from a photo, and get paid safely through Safe Trade.',
          )}
        </p>
        <p className="muted">
          {tr('যোগাযোগ: ', 'Contact: ')}<a href="mailto:krishiroth@gmail.com">krishiroth@gmail.com</a>
        </p>
      </Card>
    </div>
  )
}
