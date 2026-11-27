# Changelog

## 0.3.0
- New **Analytics** tab and `GET /api/analytics`: choose a period (presets or dates) and filter by rule, category, country, channel and status
- Rule quality table (confirmed fraud vs false positives, precision, hints), trends by day / hour / weekday, top countries and channels, amounts and time to resolve
- Analyst guide in `docs/` (EN/RU) and an in-app help block on the Alerts tab

## 0.2.0
- Bilingual UI (English / Russian) with a language switch; server messages, rule names and alert reasons are translated
- Alert reasons are stored as structured data and rendered in the viewer's language
- `npm run check:i18n` verifies translations (also runs in CI)
- Dev-server origin allowed for write requests (fixes sign-in through the Vite proxy)

## 0.1.0 — initial public release
- Rule-based fraud scoring (6 rules), alerts, cases, false-positive tracking
- Invite-only accounts with roles (viewer / analyst / admin)
- Ingest API (`/api/accounts`, `/api/transactions`), synthetic test lab
- Russian UI; Docker + Caddy deployment
