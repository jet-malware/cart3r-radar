// Checks that both languages have identical keys and that every t('key') used in the code exists.
// Run: node check-i18n.mjs   (also part of CI)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { dict } from './src/i18n/dict.js';

const problems = [];
const en = Object.keys(dict.en), ru = Object.keys(dict.ru);
for (const k of en) if (!(k in dict.ru)) problems.push(`missing in ru: ${k}`);
for (const k of ru) if (!(k in dict.en)) problems.push(`missing in en: ${k}`);
for (const [lang, d] of Object.entries(dict)) {
  for (const [k, v] of Object.entries(d)) {
    const ph = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
    if (dict.en[k] && ph(dict.en[k]) !== ph(v)) problems.push(`placeholder mismatch in ${lang}: ${k}`);
  }
}

const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(jsx?|mjs)$/.test(f) && !p.includes('dict.js')) files.push(p);
  }
})('src');

// enumerations used in dynamic keys like t(`cat.${c}`)
const dynamic = {
  'cat.': ['Phishing', 'Identity Theft', 'Card Fraud', 'Account Takeover'],
  'status.': ['open', 'investigating', 'resolved', 'false_positive'],
  'sev.': ['low', 'medium', 'high'],
  'role.': ['viewer', 'analyst', 'admin'],
  'channel.': ['web', 'mobile', 'pos', 'transfer'],
  'txs.': ['approved', 'declined'],
  'decision.': ['allow', 'flag', 'review'],
};
let used = 0;
for (const f of files) {
  const src = readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '');
  for (const m of src.matchAll(/\bt\(\s*(['"`])([^'"`]+)\1/g)) {
    used++;
    const key = m[2];
    if (key.includes('${')) {
      const prefix = key.slice(0, key.indexOf('${'));
      if (!dynamic[prefix]) problems.push(`${f}: unknown dynamic key prefix ${prefix}`);
      else for (const v of dynamic[prefix]) if (!dict.en[prefix + v]) problems.push(`${f}: missing ${prefix}${v}`);
    } else if (!dict.en[key]) problems.push(`${f}: missing key ${key}`);
  }
  // hard-coded Cyrillic outside the dictionary = untranslated text
  if (/[А-Яа-яЁё]/.test(src)) problems.push(`${f}: contains hard-coded Cyrillic text`);
}
// translation keys used via the nav table (['nav.x', ...]) and others passed as data
for (const f of files) {
  for (const m of readFileSync(f, 'utf8').matchAll(/['"]((?:nav|ov|al|cs|rl|lab|ac|login|common)\.[\w.]+)['"]/g)) {
    if (!dict.en[m[1]]) problems.push(`${f}: missing key ${m[1]}`);
  }
}
console.log(`keys: en=${en.length} ru=${ru.length}, t() calls checked: ${used}`);
if (problems.length) { console.error('PROBLEMS:\n' + problems.join('\n')); process.exit(1); }
console.log('i18n OK');
