# CART3R: radar by jet-malware

[🇷🇺 Русский](README.ru.md) · 🇬🇧 English

[![CI](https://github.com/jet-malware/cart3r-radar/actions/workflows/ci.yml/badge.svg)](https://github.com/jet-malware/cart3r-radar/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

An open-source, **defensive** fraud-monitoring dashboard. It ingests transactions, scores them with a tunable
rule engine, raises alerts, and gives analysts a workflow to investigate cases and track false positives.
Small shops, non-profits, students and researchers can use it to learn about — and experiment with — fraud detection.

> ⚠️ **Status: prototype.** Built for learning, demos and experimentation. Review, test and harden it before using it
> with real payments. **Never send card numbers or CVV to this service** — it only needs amount, country, channel
> and an opaque customer ID. Defensive use only (see [CONTRIBUTING](CONTRIBUTING.md)). Provided "as is", without warranty.

## Features
- **Overview dashboard** — KPIs, daily transactions, alerts per month, category filter, false-positive tracking.
- **Analytics** — pick a period and filter by rule, category, country, channel and status; see rule precision (confirmed fraud vs false positives), trends by day/hour/weekday, top countries and channels.
- **Rule engine** — 6 transparent rules (high amount, velocity, card-testing *detection*, geo mismatch, new-account
  large payment, large transfer to a new payee). Enable/disable and tune thresholds and weights in the UI.
- **Alerts and cases** — triage alerts, open investigation cases, add notes, close as confirmed or false positive.
- **Accounts and roles** — invite-only registration; `viewer` / `analyst` / `admin`; scrypt password hashing,
  HttpOnly session cookies, login throttling, cross-origin write protection, audit log.
- **Ingest API** — your own systems post accounts and transactions and get a risk score and decision back.
- **Test lab** — generate **synthetic** traffic and evaluate hand-made transactions to tune rules safely.
- **Bilingual interface (English / Russian)** with a language switch (top right). The choice is remembered; by default it follows the browser language. Server messages, rule names and alert reasons are translated too.

## Tech stack
Node.js ≥ 22.5 (zero npm dependencies on the backend: `node:http` + built-in `node:sqlite`) · SQLite · React 18 + Vite 5.

## Quick start
```bash
node -v                # must be >= 22.5
npm run install:all
npm run dev:backend    # terminal 1 → http://localhost:4000 (seeds synthetic demo data on first run)
npm run dev:frontend   # terminal 2 → http://localhost:5173
```
Open http://localhost:5173. On the first start the backend creates an admin and **prints the generated password
once** in the terminal. To choose your own:
`CART3R_ADMIN_EMAIL=you@example.com CART3R_ADMIN_PASSWORD=a-long-password npm run dev:backend`.

Tests: `npm test` (API tests run against an in-memory database).

## Deployment
`docker compose up -d --build` with the included `Dockerfile`, `docker-compose.yml` and `Caddyfile`
(automatic HTTPS). Copy `.env.example` to `.env` first. A step-by-step beginner guide (in Russian) lives in
[README.ru.md](README.ru.md#публикация-для-команды-docker--https).
The UI has **no built-in SSO/2FA** — put it behind your own access controls for anything beyond a demo.

## Sending your own data
Set `CART3R_API_KEY`, then:
```bash
curl -X POST https://YOUR_HOST/api/accounts -H 'Content-Type: application/json' -H "X-API-Key: $KEY" \
  -d '{"email":"customer@shop.com","home_country":"US"}'
curl -X POST https://YOUR_HOST/api/transactions -H 'Content-Type: application/json' -H "X-API-Key: $KEY" \
  -d '{"account_id":1,"amount":2500,"country":"US","ip_country":"DE","channel":"web"}'
# → {"transaction_id":…,"risk_score":30,"decision":"allow|flag|review","alerts":[…]}
```
Full API tables and environment variables: see [README.ru.md](README.ru.md) (the tables are language-neutral).

## Project layout
```
backend/   src/{schema.sql,db.js,auth.js,engine.js,synthetic.js,seed.js,app.js,server.js}  test/
frontend/  src/{App.jsx,api.js,i18n.js,auth.jsx,pages/,components/}
Dockerfile · docker-compose.yml · Caddyfile · .env.example
```

## Analyst guide
How to investigate alerts step by step: [docs/ANALYST_GUIDE.md](docs/ANALYST_GUIDE.md) · [Русский](docs/ANALYST_GUIDE.ru.md)

## Roadmap ideas (contributions welcome)
Two-factor auth · deny-lists (cards/IPs/emails) · Telegram/email notifications · PostgreSQL adapter ·
more rules and device signals · more languages (e.g. Ukrainian — see CONTRIBUTING) · CSV export · screenshots/docs.

## Contributing, security, license
[CONTRIBUTING.md](CONTRIBUTING.md) · [SECURITY.md](SECURITY.md) · [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) · [MIT License](LICENSE)
