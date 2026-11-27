# CART3R: radar by jet-malware

🇷🇺 Русский · [🇬🇧 English](README.md)

> ⚠️ **Статус: прототип.** Проект предназначен для обучения, демонстрации и экспериментов. Перед использованием с реальными платежами его нужно доработать и проверить. **Никогда не отправляйте в сервис номера карт и CVV.** Только защитное использование.

Защитная антифрод-панель: принимает транзакции, оценивает их настраиваемыми правилами, показывает алерты,
позволяет вести расследования (кейсы) и отслеживать ложные срабатывания.

**Назначение:** только обнаружение и работа аналитика. Проект не работает с реальными платёжными данными,
по умолчанию содержит **только синтетические тестовые данные**, а правило «проверка карт» лишь *обнаруживает*
такой паттерн — выполнить его проект не может.

## Руководство аналитика
Как разбирать алерты шаг за шагом: [docs/ANALYST_GUIDE.ru.md](docs/ANALYST_GUIDE.ru.md) · [English](docs/ANALYST_GUIDE.md)

## Участие в проекте
См. [CONTRIBUTING.md](CONTRIBUTING.md) (на английском; вопросы и обсуждения на русском тоже приветствуются), [SECURITY.md](SECURITY.md) и лицензию [MIT](LICENSE).

## Языки интерфейса
Интерфейс двуязычный: **русский и английский**. Переключатель RU/EN находится справа вверху (и на странице входа). Выбор запоминается; по умолчанию язык берётся из настроек браузера. Сообщения сервера, названия правил и причины алертов тоже переводятся.

## Технологии
- **Backend:** Node.js ≥ 22.5, без npm-зависимостей (`node:http` + встроенный `node:sqlite`)
- **База данных:** файл SQLite `backend/data/radar.db` (схема: `backend/src/schema.sql`)
- **Frontend:** React 18 + Vite 5, графики на чистом SVG

## Структура
```
cart3r-radar/
├─ backend/
│  ├─ src/ schema.sql  db.js  auth.js  engine.js (правила)  synthetic.js  seed.js  app.js (API)  server.js
│  └─ test/api.test.js
├─ frontend/
│  ├─ index.html  vite.config.js
│  └─ src/ App.jsx  api.js  i18n.js  auth.jsx  hooks.js  styles.css  components/  pages/
├─ Dockerfile  docker-compose.yml  Caddyfile  .env.example
└─ README.md
```

## Запуск для разработки
```bash
node -v                # нужна версия не ниже 22.5
npm run install:all
npm run dev:backend    # терминал 1 → http://localhost:4000 (при первом запуске создаются демо-данные)
npm run dev:frontend   # терминал 2 → http://localhost:5173
```
Откройте http://localhost:5173. При первом запуске backend **создаёт первого администратора и печатает его логин
и сгенерированный пароль в терминал (один раз)**. Свои данные можно задать так:
`CART3R_ADMIN_EMAIL=you@x.com CART3R_ADMIN_PASSWORD=ваш-длинный-пароль npm run dev:backend`.
Дополнительных администраторов можно создать командой: `npm run create-user -- email пароль admin`.

## Запуск одним процессом (как в продакшене)
```bash
npm run build && npm start     # API и собранный интерфейс на http://localhost:4000
```

## Тесты и пересоздание данных
```bash
npm test           # 16 тестов API (база в памяти)
npm run seed       # стирает данные и заново создаёт синтетические демо-данные
```

## Правила обнаружения (настраиваются в интерфейсе → «Правила»)
| Правило | Категория | Срабатывает, когда |
|---|---|---|
| high_amount — Крупная сумма | Мошенничество с картами | сумма ≥ порога ($2000) |
| velocity — Частота транзакций | Мошенничество с картами | ≥ 5 транзакций за 10 минут у одного аккаунта |
| card_testing — Проверка карт | Мошенничество с картами | ≥ 3 отклонённых попыток до $5 за 15 минут |
| geo_mismatch — Несовпадение геолокации | Захват аккаунта | страна по IP ≠ стране аккаунта и ≠ стране торговца |
| new_account_large — Новый аккаунт, крупный платёж | Кража личности | аккаунту < 7 дней, сумма ≥ $500 |
| new_payee_transfer — Перевод новому получателю | Фишинг | перевод новому получателю ≥ $800 |

Риск-скор — сумма весов сработавших правил (максимум 100): от 35 — «помечена», от 70 — «на проверку».

## Аккаунты, роли и безопасность
Вход по email и паролю: пароли хешируются scrypt, сессия хранится в защищённой cookie (HttpOnly, SameSite=Strict,
7 дней), есть ограничение перебора паролей и блокировка межсайтовых запросов на запись.
**Регистрация только по приглашению:** администратор создаёт пользователей в интерфейсе (вкладка «Аккаунт»).

| Роль | Что может |
|---|---|
| Наблюдатель (viewer) | смотреть дашборд, алерты, кейсы и правила |
| Аналитик (analyst) | + работать с алертами и кейсами, пользоваться тестовой лабораторией |
| Администратор (admin) | + менять правила и управлять пользователями |

## API
Все маршруты `/api/*` требуют входа, кроме `/api/health`, `/api/auth/login` и двух машинных эндпоинтов (по `X-API-Key`).
| Метод | Путь | Роль |
|---|---|---|
| POST | /api/auth/login, /logout, /password · GET /api/auth/me | — |
| GET | /api/overview, /analytics, /alerts, /cases, /rules, /false-positives, /transactions | viewer |
| PATCH / POST | /api/alerts/:id, /api/alerts/:id/case, /api/cases/:id, /api/evaluate, /api/simulate | analyst |
| PATCH | /api/rules/:id | admin |
| GET / POST / PATCH | /api/users, /api/users/:id | admin |
| POST | /api/accounts, /api/transactions | X-API-Key |

Отправка собственных данных (нужен `CART3R_API_KEY` на сервере, иначе эти эндпоинты отключены):
```bash
curl -X POST https://ВАШ_ДОМЕН/api/accounts -H 'Content-Type: application/json' -H "X-API-Key: $KEY" \
  -d '{"email":"customer@shop.com","home_country":"US"}'            # → {"id":61,...}
curl -X POST https://ВАШ_ДОМЕН/api/transactions -H 'Content-Type: application/json' -H "X-API-Key: $KEY" \
  -d '{"account_id":61,"amount":2500,"country":"US","ip_country":"DE","channel":"web"}'
```

## Публикация для команды (Docker + HTTPS)
Понадобятся: небольшой Linux-сервер (VPS, около $5 в месяц), домен с A-записью на IP сервера, открытые порты 80 и 443.
```bash
# на сервере (должны быть установлены Docker и плагин compose)
unzip cart3r-radar.zip && cd cart3r-radar
cp .env.example .env && nano .env      # укажите DOMAIN, email и пароль администратора, API-ключ
docker compose up -d --build
```
Откройте `https://ваш-домен` и войдите. Caddy сам получает и продлевает HTTPS-сертификат.
Коллег приглашайте во вкладке **Аккаунт → Пользователи**. Делайте резервные копии тома `radar-data`
(в нём лежит база SQLite). Обновление: загрузите новые файлы и выполните `docker compose up -d --build`.

Для реальных данных поставьте `CART3R_SEED=off` **до первого запуска** (иначе создадутся демо-данные).
`CART3R_SIMULATOR=off` скрывает тестовую лабораторию.

## Переменные окружения
| Переменная | По умолчанию | Назначение |
|---|---|---|
| PORT | 4000 | порт |
| CART3R_DB | backend/data/radar.db | путь к файлу SQLite |
| CART3R_ADMIN_EMAIL / _PASSWORD | admin@example.com / генерируется | первый администратор (используется, только если пользователей ещё нет) |
| CART3R_API_KEY | не задан | включает машинные эндпоинты приёма данных |
| CART3R_SEED | on | `off` — не создавать демо-данные |
| CART3R_SIMULATOR | on | `off` отключает /api/simulate и /api/evaluate |
| CART3R_SECURE_COOKIES | on при NODE_ENV=production | флаг `Secure` для cookie (нужен HTTPS) |
| CART3R_TRUST_PROXY | off | `1` за обратным прокси (реальный IP клиента для ограничения входа) |

> Запуск с `NODE_ENV=production` по обычному `http://localhost` ломает вход (cookie с флагом Secure).
> Используйте HTTPS или задайте `CART3R_SECURE_COOKIES=0` для локальных проверок.
