import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { getLang, setLang as saveLang, LANGS } from '../lang.js';
import { dict } from './dict.js';

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(getLang());

  const setLang = useCallback((l) => { saveLang(l); setLangState(l); }, []);

  const value = useMemo(() => {
    const locale = lang === 'ru' ? 'ru-RU' : 'en-GB';
    const numLocale = lang === 'ru' ? 'ru-RU' : 'en-US';
    return {
      lang,
      setLang,
      // t('key', { name: 'x' }) — falls back to English, then to the key itself
      t: (key, params = {}) =>
        (dict[lang][key] ?? dict.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => params[k] ?? ''),
      fmt: (n) => Number(n).toLocaleString(numLocale),
      fmtDate: (ms) => new Date(ms).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' }),
      // '2026-11' → 'Nov' / 'нояб.'
      monthLabel: (iso) => new Date(`${iso}-01T00:00:00Z`).toLocaleString(locale, { month: 'short', timeZone: 'UTC' }),
    };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);

const LABELS = { en: 'EN', ru: 'RU' };
export function LangSwitch() {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="lang" role="group" aria-label={t('common.language')}>
      {LANGS.map((l) => (
        <button key={l} className={l === lang ? 'lang-btn active' : 'lang-btn'} onClick={() => setLang(l)}>{LABELS[l]}</button>
      ))}
    </div>
  );
}
