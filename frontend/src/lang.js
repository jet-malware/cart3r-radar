// Current UI language: saved in the browser, otherwise taken from the browser language.
const KEY = 'cart3r_lang';
export const LANGS = ['en', 'ru'];

function detect() {
  try {
    const saved = localStorage.getItem(KEY);
    if (LANGS.includes(saved)) return saved;
  } catch { /* storage may be unavailable */ }
  const nav = (navigator.languages?.[0] || navigator.language || 'en').toLowerCase();
  return nav.startsWith('ru') ? 'ru' : 'en';
}

let current = detect();
if (typeof document !== 'undefined') document.documentElement.lang = current;

export const getLang = () => current;

export function setLang(lang) {
  if (!LANGS.includes(lang)) return;
  current = lang;
  try { localStorage.setItem(KEY, lang); } catch { /* ignore */ }
  document.documentElement.lang = lang;
}
