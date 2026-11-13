/**
 * Bengali / English switch.
 *   const { lang, tr, setLang } = useLang()
 *   tr('ফসল যোগ করুন', 'Add crop')   -> text in the chosen language
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { setApiLanguage } from '../services/api'

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => (localStorage.getItem('kr_lang') === 'en' ? 'en' : 'bn'))

  useEffect(() => {
    localStorage.setItem('kr_lang', lang)
    setApiLanguage(lang)
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((value) => setLangState(value === 'en' ? 'en' : 'bn'), [])
  const tr = useCallback((bn, en) => (lang === 'en' ? (en ?? bn) : bn), [lang])

  const value = useMemo(() => ({ lang, setLang, tr }), [lang, setLang, tr])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLang() {
  return useContext(LanguageContext)
}
