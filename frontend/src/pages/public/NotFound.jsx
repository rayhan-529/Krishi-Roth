import { Link } from 'react-router-dom'
import { useLang } from '../../context/LanguageContext'
import { EmptyState } from '../../components/ui'

export default function NotFound() {
  const { tr } = useLang()
  return (
    <div className="page">
      <EmptyState
        icon="🧭"
        title={tr('পাতাটি পাওয়া যায়নি', 'Page not found')}
        text={tr('ঠিকানাটি ভুল হতে পারে অথবা পাতাটি সরানো হয়েছে।', 'The address may be wrong or the page was moved.')}
        action={<Link to="/" className="btn btn-primary">{tr('হোম পেজে যান', 'Go to home')}</Link>}
      />
    </div>
  )
}
