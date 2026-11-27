# Contributing to CART3R: radar

Thanks for helping! Bug reports, fixes, documentation, translations and new *defensive* rules are all welcome.
Вопросы и обсуждения на русском тоже приветствуются.

## Scope: defensive use only
This project **detects and helps investigate** fraud. We will not accept changes that:
- perform, automate, or facilitate fraud, card testing, account takeover, phishing or evasion of detection;
- collect or store full card numbers, CVV, or other payment secrets;
- add real personal data to the repository, tests or fixtures (use synthetic data only).

## Getting started
```bash
git clone https://github.com/jet-malware/cart3r-radar.git && cd REPO
npm run install:all
npm test                 # backend tests, must pass
npm run dev:backend      # + npm run dev:frontend in a second terminal
```
Requirements: Node.js ≥ 22.5.

## Making a change
1. Open an issue first for anything larger than a small fix, so we can agree on the approach.
2. Create a branch, make focused commits, keep the diff small.
3. Add or update tests in `backend/test/` for backend behaviour (`npm test`).
4. Frontend: make sure `npm --prefix frontend run build` succeeds.
5. Open a pull request using the template. CI must be green.

## Style
- Plain JavaScript (ES modules), 2-space indentation (see `.editorconfig`).
- Backend stays dependency-free where reasonable; justify any new dependency in the PR.
- User-visible texts live in the UI (`frontend/src/i18n.js` and pages) and API error messages; keep them clear and short.
- New detection rules: add to `DEFAULT_RULES` in `backend/src/db.js` and a check in `backend/src/engine.js`;
  document the rule and add a test.

## Translations
The UI is available in English and Russian. Texts live in two places:
- `frontend/src/i18n/dict.js` — interface texts (every key must exist in every language);
- `backend/src/i18n.js` — API error messages, rule names/descriptions and alert reasons.

To add a language (for example Ukrainian): add its code to `LANGS` in `frontend/src/lang.js` and `backend/src/i18n.js`,
translate each dictionary block, and add a label in `LangSwitch` (`frontend/src/i18n/index.jsx`).
Run `npm run check:i18n` — it fails if a key is missing or a text is hard-coded in a component.

## Reporting security issues
Please do **not** open a public issue — see [SECURITY.md](SECURITY.md).

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
