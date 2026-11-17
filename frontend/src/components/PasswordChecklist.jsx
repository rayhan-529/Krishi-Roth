/** Live list of password rules; each turns green when satisfied. */
import { useLang } from '../context/LanguageContext'
import { PASSWORD_RULES } from '../utils/password'
import Icon from './Icon'

export default function PasswordChecklist({ password }) {
  const { tr } = useLang()
  const value = password || ''
  return (
    <ul className="pw-checklist" aria-label={tr('পাসওয়ার্ডের নিয়ম', 'Password rules')}>
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(value)
        return (
          <li key={rule.key} className={ok ? 'ok' : ''}>
            <Icon name={ok ? 'checkCircle' : 'info'} size={15} />
            {tr(rule.bn, rule.en)}
          </li>
        )
      })}
    </ul>
  )
}
