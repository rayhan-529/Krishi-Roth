import { Link } from 'react-router-dom'
import { useLang } from '../../context/LanguageContext'
import { Card, PageHeader } from '../../components/ui'

export default function About() {
  const { tr } = useLang()
  return (
    <div className="page narrow">
      <PageHeader title={tr('কৃষি রথ সম্পর্কে', 'About Krishi Roth')} subtitle={tr('প্রযুক্তি হোক কৃষকের শক্তি', 'Technology in the hands of farmers')} />
      <Card>
        <p>
          {tr(
            'কৃষি রথ বাংলাদেশের কৃষকদের জন্য তৈরি একটি ডিজিটাল প্ল্যাটফর্ম। এখানে কৃষক সরাসরি ক্রেতার কাছে ন্যায্য দামে ফসল বিক্রি করতে পারেন, বাজারদর দেখতে পারেন, ফসল ও উৎপাদন খরচের হিসাব রাখতে পারেন এবং শ্রমিক, হারভেস্টার, ট্রাক্টর ও পরিবহন সেবা খুঁজে বুক করতে পারেন।',
            'Krishi Roth is a digital platform for farmers in Bangladesh. Farmers can sell crops directly to buyers at fair prices, check market prices, keep harvest and production-cost records, and find and book labour, harvesters, tractors and transport.',
          )}
        </p>
        <h2>{tr('কাদের জন্য', 'Who it is for')}</h2>
        <ul className="plain-list">
          <li>👨‍🌾 {tr('কৃষক — ফসল বিক্রি, ফসল ও খরচের হিসাব, সেবা বুকিং', 'Farmers — selling, harvest and cost records, booking services')}</li>
          <li>🛒 {tr('ক্রেতা — সরাসরি কৃষকের কাছ থেকে ফসল কেনা', 'Buyers — buying directly from farmers')}</li>
          <li>🧑‍🔧 {tr('কৃষি শ্রমিক — কাজের অনুরোধ পাওয়া', 'Farm workers — receiving work requests')}</li>
          <li>🚜 {tr('হারভেস্টার ও ট্রাক্টর মালিক — যন্ত্র ভাড়া দেওয়া', 'Harvester and tractor owners — renting out machines')}</li>
          <li>🚚 {tr('পরিবহন মালিক — ফসল পরিবহন সেবা', 'Transport owners — crop transport')}</li>
        </ul>
        <h2>{tr('নিরাপত্তা ও স্বচ্ছতা', 'Safety and transparency')}</h2>
        <p>
          {tr(
            'প্রতিটি লেনদেনের ধাপ (প্রস্তাব, মূল্য পরিশোধ, ডেলিভারি, প্রাপ্তি) রেকর্ড থাকে। কৃষি রথ নিজে কোনো টাকা লেনদেন করে না; ক্রেতা ও কৃষক নিজেরা নগদ, বিকাশ, নগদ বা ব্যাংকে মূল্য পরিশোধ করেন এবং প্ল্যাটফর্মে তা নিশ্চিত করেন। সমস্যা হলে অভিযোগ করুন, অ্যাডমিন বিষয়টি দেখবেন।',
            'Every step of a trade (offer, payment, delivery, receipt) is recorded. Krishi Roth does not handle money itself; buyers and farmers pay each other by cash, bKash, Nagad or bank and confirm it on the platform. If something goes wrong, open a complaint and an administrator will review it.',
          )}
        </p>
        <p>
          {tr(
            'বাজারদর অ্যাডমিনরা হাতে যোগ করেন; এটি সরকারি লাইভ তথ্য নয়। এআই সহায়কের পরামর্শ সাধারণ তথ্য—সার বা কীটনাশকের মাত্রা উপজেলা কৃষি কর্মকর্তার সঙ্গে মিলিয়ে নিন।',
            'Market prices are entered by administrators; they are not a live government feed. AI assistant advice is general — confirm fertilizer or pesticide doses with your Upazila Agriculture Officer.',
          )}
        </p>
        <div className="form-actions">
          <Link to="/register" className="btn btn-primary">{tr('এখনই যোগ দিন', 'Join now')}</Link>
        </div>
      </Card>
    </div>
  )
}
