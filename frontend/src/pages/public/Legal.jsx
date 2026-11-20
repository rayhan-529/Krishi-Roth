/** Privacy policy and terms of service (required for Google sign-in). */
import { Link } from 'react-router-dom'
import { useLang } from '../../context/LanguageContext'
import { Card, PageHeader } from '../../components/ui'

const CONTACT = 'krishiroth@gmail.com'
const UPDATED = '17 November 2026'

function Section({ title, children }) {
  return (
    <section className="legal-section">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

export function Privacy() {
  const { tr } = useLang()
  return (
    <div className="page narrow">
      <PageHeader title={tr('গোপনীয়তা নীতি', 'Privacy Policy')} subtitle={`${tr('সর্বশেষ হালনাগাদ', 'Last updated')}: ${UPDATED}`} />
      <Card className="legal">
        <p>
          {tr(
            'কৃষি রথ ("আমরা") আপনার ব্যক্তিগত তথ্যের গোপনীয়তা রক্ষা করে। এই নীতিতে বলা আছে আমরা কী তথ্য নিই, কেন নিই এবং কীভাবে ব্যবহার করি।',
            'Krishi Roth ("we") respects your privacy. This policy explains what information we collect, why, and how we use it.',
          )}
        </p>

        <Section title={tr('আমরা কী তথ্য নিই', 'Information we collect')}>
          <ul>
            <li>{tr('অ্যাকাউন্টের তথ্য: নাম, ইমেইল, মোবাইল নম্বর, জেলা/উপজেলা ও ভূমিকা।', 'Account details: name, email, mobile number, district/upazila and role.')}</li>
            <li>{tr('Google বা Apple দিয়ে লগইন করলে: শুধু আপনার নাম, ইমেইল ও একটি অ্যাকাউন্ট আইডি। আমরা আপনার Google/Apple পাসওয়ার্ড বা অন্য কোনো তথ্য পাই না।', 'If you sign in with Google or Apple: only your name, email and an account id. We never receive your Google/Apple password or any other data.')}</li>
            <li>{tr('আপনার দেওয়া কনটেন্ট: ফসলের বিজ্ঞাপন, ছবি, বার্তা, রিভিউ, খরচের হিসাব ও যাচাইয়ের ডকুমেন্ট।', 'Content you add: crop listings, photos, messages, reviews, expense records and verification documents.')}</li>
            <li>{tr('প্রযুক্তিগত তথ্য: লগইনের সময় IP ঠিকানা ও ব্রাউজারের ধরন (নিরাপত্তার জন্য)।', 'Technical data: IP address and browser type at login (for security).')}</li>
          </ul>
        </Section>

        <Section title={tr('তথ্য কেন ব্যবহার করি', 'How we use it')}>
          <ul>
            <li>{tr('অ্যাকাউন্ট খোলা, লগইন ও পাসওয়ার্ড রিসেট কোড পাঠাতে।', 'To create your account, sign you in and send password-reset codes.')}</li>
            <li>{tr('ক্রেতা, কৃষক ও সেবাদাতার মধ্যে কেনাবেচা ও বুকিং চালাতে।', 'To run trades and bookings between buyers, farmers and service providers.')}</li>
            <li>{tr('নোটিফিকেশন পাঠাতে এবং প্রতারণা ও অপব্যবহার রোধ করতে।', 'To send notifications and prevent fraud and abuse.')}</li>
          </ul>
          <p>{tr('আমরা আপনার তথ্য বিক্রি করি না এবং বিজ্ঞাপনের জন্য ব্যবহার করি না।', 'We do not sell your data or use it for advertising.')}</p>
        </Section>

        <Section title={tr('কারা তথ্য দেখতে পায়', 'Who can see it')}>
          <ul>
            <li>{tr('আপনার নাম, জেলা, রেটিং ও বিজ্ঞাপন সবাই দেখতে পায়।', 'Your name, district, rating and listings are public.')}</li>
            <li>{tr('মোবাইল নম্বর শুধু তখনই দেখানো হয় যখন কোনো লেনদেন বা বুকিং গৃহীত হয়।', 'Your phone number is shown to the other party only after a trade or booking is accepted.')}</li>
            <li>{tr('যাচাইয়ের ডকুমেন্ট শুধু অ্যাডমিন দেখতে পান।', 'Verification documents are visible only to administrators.')}</li>
            <li>{tr('সেবা চালাতে আমরা বিশ্বস্ত প্রতিষ্ঠান ব্যবহার করি: ইমেইল পাঠাতে Brevo, ছবি রাখতে Cloudinary এবং লগইনে Google/Apple।', 'We use trusted providers to run the service: Brevo for email, Cloudinary for photos, and Google/Apple for sign-in.')}</li>
          </ul>
        </Section>

        <Section title={tr('নিরাপত্তা ও সংরক্ষণ', 'Security and storage')}>
          <p>
            {tr(
              'পাসওয়ার্ড শুধু এনক্রিপ্টেড (bcrypt) আকারে রাখা হয়। লগইন টোকেন আপনার ব্রাউজারে থাকে এবং লগআউট করলে বাতিল হয়। অ্যাকাউন্ট সক্রিয় থাকা পর্যন্ত তথ্য রাখা হয়।',
              'Passwords are stored only as encrypted (bcrypt) hashes. Your login token is kept in your browser and is revoked when you log out. Data is kept while your account is active.',
            )}
          </p>
        </Section>

        <Section title={tr('আপনার অধিকার', 'Your choices')}>
          <p>
            {tr(
              'প্রোফাইল পেজ থেকে আপনি নিজের তথ্য দেখতে ও বদলাতে পারেন। অ্যাকাউন্ট ও তথ্য মুছে ফেলতে চাইলে নিচের ইমেইলে লিখুন, আমরা 30 দিনের মধ্যে মুছে দেব।',
              'You can view and edit your details on your profile page. To delete your account and data, email us below and we will delete it within 30 days.',
            )}
          </p>
        </Section>

        <Section title={tr('যোগাযোগ', 'Contact')}>
          <p>{tr('প্রশ্ন থাকলে ইমেইল করুন', 'Questions? Email us at')}: <a href={`mailto:${CONTACT}`}>{CONTACT}</a></p>
        </Section>
      </Card>
    </div>
  )
}

export function Terms() {
  const { tr } = useLang()
  return (
    <div className="page narrow">
      <PageHeader title={tr('ব্যবহারের শর্তাবলি', 'Terms of Service')} subtitle={`${tr('সর্বশেষ হালনাগাদ', 'Last updated')}: ${UPDATED}`} />
      <Card className="legal">
        <p>
          {tr(
            'কৃষি রথ ব্যবহার করে আপনি এই শর্তগুলো মেনে নিচ্ছেন।',
            'By using Krishi Roth you agree to these terms.',
          )}
        </p>

        <Section title={tr('সেবা', 'The service')}>
          <p>
            {tr(
              'কৃষি রথ কৃষক, ক্রেতা ও কৃষিসেবাদাতাদের মধ্যে যোগাযোগের একটি প্ল্যাটফর্ম। আমরা নিজেরা কোনো ফসল কিনি বা বিক্রি করি না। সেফ ট্রেডে ক্রেতার টাকা কৃষি রথের ওয়ালেটে জমা থাকে এবং ক্রেতা ফসল পেয়ে নিশ্চিত করলে (বা অভিযোগ না করলে নির্দিষ্ট সময় পর) কৃষককে দেওয়া হয়। অভিযোগ হলে অ্যাডমিন সিদ্ধান্ত দেন।',
              'Krishi Roth is a platform that connects farmers, buyers and farm-service providers. We do not buy or sell crops ourselves. With Safe Trade the buyer’s money is held in the Krishi Roth wallet and paid to the farmer when the buyer confirms receipt (or automatically after a set time without a complaint). In a dispute an administrator decides.',
            )}
          </p>
        </Section>

        <Section title={tr('আপনার দায়িত্ব', 'Your responsibilities')}>
          <ul>
            <li>{tr('সঠিক তথ্য দিন এবং নিজের পাসওয়ার্ড গোপন রাখুন।', 'Give accurate information and keep your password secret.')}</li>
            <li>{tr('মিথ্যা বিজ্ঞাপন, প্রতারণা, হয়রানি বা বেআইনি কিছু করবেন না।', 'Do not post false listings, cheat, harass anyone or do anything illegal.')}</li>
            <li>{tr('লেনদেনের আগে পণ্য ও মূল্য নিজে যাচাই করে নিন।', 'Check goods and prices yourself before completing a trade.')}</li>
          </ul>
        </Section>

        <Section title={tr('তথ্য ও পরামর্শ', 'Information and advice')}>
          <p>
            {tr(
              'বাজারদর অ্যাডমিন প্রদত্ত এবং এআই সহায়কের পরামর্শ সাধারণ তথ্য। এগুলোর ভিত্তিতে নেওয়া সিদ্ধান্তের দায় ব্যবহারকারীর।',
              'Market prices are entered by administrators and AI assistant advice is general information. You are responsible for decisions you make based on them.',
            )}
          </p>
        </Section>

        <Section title={tr('অ্যাকাউন্ট বন্ধ', 'Account suspension')}>
          <p>
            {tr(
              'শর্ত ভাঙলে অ্যাডমিন অ্যাকাউন্ট বন্ধ করতে পারেন। কোনো সমস্যা হলে অভিযোগ পাতায় জানান।',
              'Administrators may block accounts that break these terms. Report problems on the complaints page.',
            )}
          </p>
        </Section>

        <Section title={tr('পরিবর্তন ও যোগাযোগ', 'Changes and contact')}>
          <p>
            {tr('আমরা প্রয়োজনে এই শর্ত বদলাতে পারি। প্রশ্ন থাকলে ইমেইল করুন', 'We may update these terms when needed. Questions? Email')}: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.{' '}
            <Link to="/privacy">{tr('গোপনীয়তা নীতি দেখুন', 'See our Privacy Policy')}</Link>
          </p>
        </Section>
      </Card>
    </div>
  )
}
