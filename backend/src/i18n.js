// Server-side translations (English / Russian).
// The client sends its language in the `X-Lang` header (or the browser's Accept-Language).
// To add a language: add it to LANGS and to every dictionary below.

export const LANGS = ['en', 'ru'];

export function pickLang(req) {
  const explicit = String(req.headers['x-lang'] ?? '').toLowerCase();
  if (LANGS.includes(explicit)) return explicit;
  for (const part of String(req.headers['accept-language'] ?? '').toLowerCase().split(',')) {
    const code = part.trim().slice(0, 2);
    if (LANGS.includes(code)) return code;
  }
  return 'en';
}

const fill = (tpl, params = {}) => tpl.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '');

// ---------- error messages (by code) ----------
const MESSAGES = {
  en: {
    invalid_status: 'Invalid status',
    invalid_range: 'Invalid date range',
    range_too_long: 'Date range is too long (max 365 days)',
    alert_not_found: 'Alert not found',
    case_exists: 'A case already exists for this alert',
    case_not_found: 'Case not found',
    rule_not_found: 'Rule not found',
    threshold_positive: 'Threshold must be greater than 0',
    weight_range: 'Weight must be between 1 and 100',
    bad_api_key: 'Invalid or missing X-API-Key',
    ingest_disabled: 'Ingest is disabled: set CART3R_API_KEY on the server',
    simulator_disabled: 'Simulator is disabled',
    no_accounts: 'No accounts yet: run npm run seed first',
    body_too_large: 'Request body is too large',
    bad_json: 'Invalid JSON',
    not_found: 'Not found',
    internal_error: 'Internal server error',
    auth_required: 'Sign-in required',
    forbidden_role: 'Insufficient permissions',
    cross_origin: 'Cross-origin request blocked',
    wrong_current_password: 'Current password is incorrect',
    user_not_found: 'User not found',
    invalid_role: 'Invalid role',
    cannot_self_demote: 'You cannot demote or deactivate yourself',
    invalid_email: 'Invalid email address',
    bad_home_country: 'home_country must be a 2-letter code',
    account_id_int: 'account_id must be an integer',
    amount_range: 'amount must be in the range (0, 10,000,000]',
    country_code: 'country must be a 2-letter code',
    ip_country_code: 'ip_country must be a 2-letter code',
    bad_channel: 'Invalid channel',
    bad_status: 'Invalid status',
    bad_created_at: 'Invalid created_at',
    account_missing: 'Account {id} not found',
    password_short: 'Password must be at least 10 characters',
    password_long: 'Password is too long',
    too_many_attempts: 'Too many attempts, try again in 15 minutes',
    bad_credentials: 'Invalid email or password',
    email_taken: 'This email is already registered',
  },
  ru: {
    invalid_status: 'Недопустимый статус',
    invalid_range: 'Неверный период',
    range_too_long: 'Период слишком большой (максимум 365 дней)',
    alert_not_found: 'Алерт не найден',
    case_exists: 'Кейс по этому алерту уже создан',
    case_not_found: 'Кейс не найден',
    rule_not_found: 'Правило не найдено',
    threshold_positive: 'Порог должен быть больше 0',
    weight_range: 'Вес должен быть от 1 до 100',
    bad_api_key: 'Неверный или отсутствующий X-API-Key',
    ingest_disabled: 'Приём данных отключён: задайте CART3R_API_KEY на сервере',
    simulator_disabled: 'Симулятор отключён',
    no_accounts: 'Пока нет аккаунтов: сначала выполните npm run seed',
    body_too_large: 'Тело запроса слишком большое',
    bad_json: 'Некорректный JSON',
    not_found: 'Не найдено',
    internal_error: 'Внутренняя ошибка сервера',
    auth_required: 'Требуется вход в систему',
    forbidden_role: 'Недостаточно прав',
    cross_origin: 'Межсайтовый запрос заблокирован',
    wrong_current_password: 'Текущий пароль указан неверно',
    user_not_found: 'Пользователь не найден',
    invalid_role: 'Недопустимая роль',
    cannot_self_demote: 'Нельзя понизить или отключить самого себя',
    invalid_email: 'Некорректный email',
    bad_home_country: 'home_country должен быть двухбуквенным кодом',
    account_id_int: 'account_id должен быть целым числом',
    amount_range: 'amount должен быть в диапазоне (0, 10 000 000]',
    country_code: 'country должен быть двухбуквенным кодом',
    ip_country_code: 'ip_country должен быть двухбуквенным кодом',
    bad_channel: 'Недопустимый channel',
    bad_status: 'Недопустимый status',
    bad_created_at: 'Недопустимый created_at',
    account_missing: 'Аккаунт {id} не найден',
    password_short: 'Пароль должен содержать не менее 10 символов',
    password_long: 'Пароль слишком длинный',
    too_many_attempts: 'Слишком много попыток, повторите через 15 минут',
    bad_credentials: 'Неверный email или пароль',
    email_taken: 'Этот email уже зарегистрирован',
  },
};

export function msg(lang, code, params) {
  const tpl = MESSAGES[lang]?.[code] ?? MESSAGES.en[code] ?? code;
  return fill(tpl, params);
}

// ---------- detection rules: names and descriptions ----------
const RULE_TEXT = {
  high_amount: {
    en: { name: 'High amount', description: 'A single transaction at or above the amount threshold (USD).' },
    ru: { name: 'Крупная сумма', description: 'Одна транзакция на сумму не меньше порога (USD).' },
  },
  velocity: {
    en: { name: 'Transaction velocity', description: 'The number of transactions from one account within 10 minutes reaches the threshold.' },
    ru: { name: 'Частота транзакций', description: 'Число транзакций одного аккаунта за 10 минут достигло порога.' },
  },
  card_testing: {
    en: { name: 'Card-testing pattern', description: 'Several small (up to $5) declined attempts from one account within 15 minutes. Detection only.' },
    ru: { name: 'Паттерн проверки карт', description: 'Несколько мелких (до $5) отклонённых попыток одного аккаунта за 15 минут. Только обнаружение.' },
  },
  geo_mismatch: {
    en: { name: 'Geo mismatch', description: 'The IP country differs from both the account home country and the transaction country.' },
    ru: { name: 'Несовпадение геолокации', description: 'Страна по IP отличается и от страны аккаунта, и от страны транзакции.' },
  },
  new_account_large: {
    en: { name: 'New account, large payment', description: 'The account is younger than 7 days and the payment is at or above the threshold (USD).' },
    ru: { name: 'Новый аккаунт, крупный платёж', description: 'Аккаунту меньше 7 дней, а платёж не меньше порога (USD).' },
  },
  new_payee_transfer: {
    en: { name: 'Large transfer to a new payee', description: 'A first-time transfer to a payee at or above the threshold: a typical sign of social engineering.' },
    ru: { name: 'Крупный перевод новому получателю', description: 'Перевод получателю впервые на сумму не меньше порога — типичный признак социальной инженерии.' },
  },
};

export const RULE_KEYS = Object.keys(RULE_TEXT);

export function ruleText(key, lang, fallback = {}) {
  const t = RULE_TEXT[key]?.[lang] ?? RULE_TEXT[key]?.en;
  return t ?? { name: fallback.name ?? key, description: fallback.description ?? '' };
}

// ---------- alert reasons ----------
// Stored in the database as JSON {k, p} so they can be shown in any language later.
const REASONS = {
  en: {
    high_amount: 'Amount {amount} ≥ {threshold}',
    velocity: '{n} transactions within 10 minutes',
    card_testing: '{n} small declined attempts within 15 minutes',
    geo_mismatch: 'IP: {ip}, account country: {home}, merchant country: {country}',
    new_account_large: 'Account is {days} d old, amount {amount}',
    new_payee_transfer: 'First transfer to a new payee, amount {amount}',
  },
  ru: {
    high_amount: 'Сумма {amount} ≥ {threshold}',
    velocity: '{n} транзакций за 10 минут',
    card_testing: '{n} мелких отклонённых попыток за 15 минут',
    geo_mismatch: 'IP: {ip}, страна аккаунта: {home}, страна торговца: {country}',
    new_account_large: 'Аккаунту {days} дн., сумма {amount}',
    new_payee_transfer: 'Первый перевод новому получателю, сумма {amount}',
  },
};

export const reasonJson = (k, p) => JSON.stringify({ k, p });

/** Turns a stored reason into text. Old plain-text reasons are returned unchanged. */
export function renderReason(raw, lang) {
  if (typeof raw === 'string' && raw.startsWith('{')) {
    try {
      const { k, p } = JSON.parse(raw);
      const tpl = REASONS[lang]?.[k] ?? REASONS.en[k];
      if (tpl) return fill(tpl, p);
    } catch { /* fall through */ }
  }
  return raw;
}
