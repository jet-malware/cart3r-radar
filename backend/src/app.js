import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { audit } from './db.js';
import { makeAuth, AuthError, roleLevel, ROLES } from './auth.js';
import { makeEngine, ValidationError } from './engine.js';
import { pickLang, msg, ruleText, renderReason } from './i18n.js';
import { COUNTRIES, mulberry32, pick, genTransaction } from './synthetic.js';

const DAY = 86_400_000;
const CATEGORIES = ['Phishing', 'Identity Theft', 'Card Fraud', 'Account Takeover'];
const ALERT_STATUSES = ['open', 'investigating', 'resolved', 'false_positive'];
const CASE_STATUSES = ['open', 'investigating', 'resolved'];
const here = dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = resolve(here, '../../frontend/dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png' };

class HttpError extends Error {
  constructor(status, code, params) { super(code); this.status = status; this.code = code; this.params = params; }
}

const pct = (cur, prev) => (prev ? Math.round(((cur - prev) / prev) * 100) : cur ? 100 : 0);

export function createApp(db, {
  apiKey = process.env.CART3R_API_KEY,
  simulator = process.env.CART3R_SIMULATOR !== 'off',
  secureCookies = process.env.CART3R_SECURE_COOKIES ? process.env.CART3R_SECURE_COOKIES === '1' : process.env.NODE_ENV === 'production',
  trustProxy = process.env.CART3R_TRUST_PROXY === '1',
} = {}) {
  const engine = makeEngine(db);
  const localize = (r, lang) => ({ ...r, alerts: r.alerts.map((a) => ({ ...a, reason: renderReason(a.reason, lang) })) });
  const auth = makeAuth(db, { secureCookies });

  // Access control table: "METHOD /path" -> minimum role. Everything not listed needs 'viewer'.
  const PUBLIC = new Set(['GET /api/health', 'POST /api/auth/login']);
  const APIKEY = new Set(['POST /api/transactions', 'POST /api/accounts']);          // machine-to-machine, uses X-API-Key
  const NEEDS = {
    'PATCH /api/alerts/:id': 'analyst', 'POST /api/alerts/:id/case': 'analyst', 'PATCH /api/cases/:id': 'analyst',
    'POST /api/evaluate': 'analyst', 'POST /api/simulate': 'analyst',
    'PATCH /api/rules/:id': 'admin',
    'GET /api/users': 'admin', 'POST /api/users': 'admin', 'PATCH /api/users/:id': 'admin',
  };
  // Origins that may send write requests besides the server's own host.
  // In development the Vite dev server (port 5173) proxies to this API, so allow it; set CART3R_ALLOWED_ORIGINS to add more.
  const allowedOrigins = [
    ...(process.env.CART3R_ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean),
    ...(process.env.NODE_ENV === 'production' ? [] : ['http://localhost:5173', 'http://127.0.0.1:5173']),
  ];
  const clientIp = (req) => (trustProxy && req.headers['x-forwarded-for']?.split(',')[0].trim()) || req.socket.remoteAddress || 'unknown';
  const routes = [];
  const route = (method, path, handler) => {
    const keys = [];
    const re = new RegExp('^' + path.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '/?$');
    routes.push({ method, re, keys, handler, key: `${method} ${path}` });
  };

  // Parse "?categories=A,B" into a SQL fragment + params.
  const categoryFilter = (url, col = 'category') => {
    const list = (url.searchParams.get('categories') ?? '').split(',').filter(c => CATEGORIES.includes(c));
    return list.length ? { sql: ` AND ${col} IN (${list.map(() => '?').join(',')})`, params: list } : { sql: '', params: [] };
  };

  // ---------- health ----------
  route('GET', '/api/health', () => ({ ok: true, time: Date.now() }));

  // ---------- overview ----------
  route('GET', '/api/overview', ({ url }) => {
    const now = Date.now();
    const cf = categoryFilter(url);
    const cnt = (sql, ...p) => db.prepare(sql).get(...p);
    const period = (from, to) => ({
      alerts: cnt(`SELECT COUNT(*) n FROM alerts WHERE created_at >= ? AND created_at < ?${cf.sql}`, from, to, ...cf.params).n,
      transactions: cnt('SELECT COUNT(*) n FROM transactions WHERE created_at >= ? AND created_at < ?', from, to).n,
      accounts: cnt(`SELECT COUNT(DISTINCT account_id) n FROM alerts WHERE created_at >= ? AND created_at < ?${cf.sql}`, from, to, ...cf.params).n,
      resolved: cnt("SELECT COUNT(*) n FROM cases WHERE status = 'resolved' AND resolved_at >= ? AND resolved_at < ?", from, to).n,
    });
    const cur = period(now - 30 * DAY, now + 1);
    const prev = period(now - 60 * DAY, now - 30 * DAY);

    // daily transactions, last 30 days (zero-filled)
    const rows = db.prepare(
      `SELECT strftime('%Y-%m-%d', created_at/1000, 'unixepoch') d, COUNT(*) n
       FROM transactions WHERE created_at >= ? GROUP BY d`).all(now - 30 * DAY);
    const byDay = Object.fromEntries(rows.map(r => [r.d, r.n]));
    const daily = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now - (29 - i) * DAY).toISOString().slice(0, 10);
      return { label: d, value: byDay[d] ?? 0 };
    });

    // alerts per month, last 6 months (zero-filled)
    const monthStart = new Date(Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth() - 5, 1)).getTime();
    const mrows = db.prepare(
      `SELECT strftime('%Y-%m', created_at/1000, 'unixepoch') m, COUNT(*) n
       FROM alerts WHERE created_at >= ?${cf.sql} GROUP BY m`).all(monthStart, ...cf.params);
    const byMonth = Object.fromEntries(mrows.map(r => [r.m, r.n]));
    const monthly = Array.from({ length: 6 }, (_, i) => {
      const dt = new Date(Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth() - 5 + i, 1));
      const key = dt.toISOString().slice(0, 7);
      return { label: key, value: byMonth[key] ?? 0 };
    });

    return {
      kpis: {
        fraud_alerts: { value: cur.alerts, change: pct(cur.alerts, prev.alerts) },
        transactions: { value: cur.transactions, change: pct(cur.transactions, prev.transactions) },
        suspicious_accounts: { value: cur.accounts, change: pct(cur.accounts, prev.accounts) },
        resolved_cases: { value: cur.resolved, change: pct(cur.resolved, prev.resolved) },
      },
      daily_transactions: { total: daily.at(-1).value, change: pct(daily.at(-1).value, daily.at(-2).value), series: daily },
      monthly_alerts: { total: monthly.at(-1).value, change: pct(monthly.at(-1).value, monthly.at(-2).value), series: monthly },
    };
  });

  route('GET', '/api/false-positives', ({ url, lang }) => {
    const cf = categoryFilter(url, 'a.category');
    return db.prepare(
      `SELECT r.key, r.name, a.category, COUNT(*) AS count
       FROM alerts a JOIN rules r ON r.key = a.rule_key
       WHERE a.status = 'false_positive'${cf.sql}
       GROUP BY r.key ORDER BY count DESC LIMIT 10`).all(...cf.params)
      .map((r) => ({ ...r, name: ruleText(r.key, lang, r).name }));
  });

  // ---------- analytics ----------
  // Deeper statistics for a chosen period and filters (rule, category, country, channel, status).
  // "Precision" of a rule = confirmed fraud / (confirmed fraud + false positives), among alerts already decided.
  route('GET', '/api/analytics', ({ url, lang }) => {
    const q = url.searchParams;
    const day = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v ?? '') ? Date.parse(`${v}T00:00:00Z`) : NaN);
    const today = Math.floor(Date.now() / DAY) * DAY;
    let from = day(q.get('from')), to = day(q.get('to'));            // `to` is inclusive (a whole day)
    if (Number.isNaN(to)) to = today;
    if (Number.isNaN(from)) from = to - 29 * DAY;
    if (from > to) throw new HttpError(400, 'invalid_range');
    if (to - from > 365 * DAY) throw new HttpError(400, 'range_too_long');
    const end = to + DAY;                                              // exclusive
    const span = end - from;

    const list = (name, allowed) => (q.get(name) ?? '').split(',').filter((v) => (allowed ? allowed.includes(v) : /^[A-Za-z0-9 _-]{1,40}$/.test(v)));
    const filters = [];
    const fparams = [];
    const addIn = (col, vals) => { if (vals.length) { filters.push(`${col} IN (${vals.map(() => '?').join(',')})`); fparams.push(...vals); } };
    addIn('a.category', list('categories', CATEGORIES));
    addIn('a.status', list('statuses', ALERT_STATUSES));
    addIn('a.rule_key', list('rules'));
    addIn('t.country', list('countries'));
    addIn('t.channel', list('channels'));
    const fsql = filters.length ? ` AND ${filters.join(' AND ')}` : '';
    const base = `FROM alerts a JOIN transactions t ON t.id = a.transaction_id WHERE a.created_at >= ? AND a.created_at < ?${fsql}`;
    const get = (sql, f, e) => db.prepare(sql).all(f, e, ...fparams);

    const totalsFor = (f, e) => {
      const r = db.prepare(
        `SELECT COUNT(*) alerts,
                SUM(a.status = 'false_positive') false_positive,
                SUM(a.status = 'resolved') confirmed,
                SUM(a.status IN ('open','investigating')) pending,
                COUNT(DISTINCT a.account_id) accounts,
                COALESCE(SUM(t.amount), 0) amount_flagged
         ${base}`).get(f, e, ...fparams);
      const confirmedAmount = db.prepare(`SELECT COALESCE(SUM(t.amount), 0) v ${base} AND a.status = 'resolved'`).get(f, e, ...fparams).v;
      const solve = db.prepare(
        `SELECT AVG(c.resolved_at - c.created_at) ms FROM cases c
         JOIN alerts a ON a.id = c.alert_id JOIN transactions t ON t.id = a.transaction_id
         WHERE c.resolved_at IS NOT NULL AND a.created_at >= ? AND a.created_at < ?${fsql}`).get(f, e, ...fparams).ms;
      const decided = (r.false_positive ?? 0) + (r.confirmed ?? 0);
      return {
        alerts: r.alerts, false_positive: r.false_positive ?? 0, confirmed: r.confirmed ?? 0, pending: r.pending ?? 0,
        accounts: r.accounts, amount_flagged: Math.round(r.amount_flagged * 100) / 100,
        amount_confirmed: Math.round(confirmedAmount * 100) / 100,
        precision: decided ? Math.round(((r.confirmed ?? 0) / decided) * 100) : null,
        avg_resolve_hours: solve == null ? null : Math.round((solve / 3_600_000) * 10) / 10,
      };
    };
    const cur = totalsFor(from, end);
    const prev = totalsFor(from - span, from);

    const rules = get(
      `SELECT r.key, r.name, a.category,
              COUNT(*) alerts, SUM(a.status = 'false_positive') false_positive, SUM(a.status = 'resolved') confirmed,
              SUM(a.status IN ('open','investigating')) pending
       FROM alerts a JOIN transactions t ON t.id = a.transaction_id JOIN rules r ON r.key = a.rule_key
       WHERE a.created_at >= ? AND a.created_at < ?${fsql} GROUP BY r.key ORDER BY alerts DESC`, from, end)
      .map((r) => {
        const decided = r.false_positive + r.confirmed;
        return { ...r, name: ruleText(r.key, lang, r).name, precision: decided ? Math.round((r.confirmed / decided) * 100) : null };
      });

    const dayRows = Object.fromEntries(get(
      `SELECT strftime('%Y-%m-%d', a.created_at/1000, 'unixepoch') k, COUNT(*) n ${base} GROUP BY k`, from, end).map((r) => [r.k, r.n]));
    const days = Math.round(span / DAY);
    const daily = Array.from({ length: days }, (_, i) => {
      const k = new Date(from + i * DAY).toISOString().slice(0, 10);
      return { label: k, value: dayRows[k] ?? 0 };
    });
    const hourRows = Object.fromEntries(get(
      `SELECT CAST(strftime('%H', a.created_at/1000, 'unixepoch') AS INTEGER) k, COUNT(*) n ${base} GROUP BY k`, from, end).map((r) => [r.k, r.n]));
    const hours = Array.from({ length: 24 }, (_, h) => ({ label: String(h).padStart(2, '0'), value: hourRows[h] ?? 0 }));
    const wdRows = Object.fromEntries(get(
      `SELECT CAST(strftime('%w', a.created_at/1000, 'unixepoch') AS INTEGER) k, COUNT(*) n ${base} GROUP BY k`, from, end).map((r) => [r.k, r.n]));
    const weekdays = [1, 2, 3, 4, 5, 6, 0].map((w) => ({ key: w, value: wdRows[w] ?? 0 }));   // Monday first

    const group = (col) => get(
      `SELECT ${col} k, COUNT(*) alerts, SUM(a.status = 'false_positive') false_positive, SUM(a.status = 'resolved') confirmed
       ${base} GROUP BY k ORDER BY alerts DESC LIMIT 8`, from, end);

    return {
      range: { from: new Date(from).toISOString().slice(0, 10), to: new Date(to).toISOString().slice(0, 10), days },
      totals: cur, previous: prev,
      changes: { alerts: pct(cur.alerts, prev.alerts), false_positive: pct(cur.false_positive, prev.false_positive), confirmed: pct(cur.confirmed, prev.confirmed) },
      rules, daily, hours, weekdays,
      countries: group('t.country'), channels: group('t.channel'),
      options: {
        rules: db.prepare('SELECT key, name FROM rules ORDER BY id').all().map((r) => ({ key: r.key, name: ruleText(r.key, lang, r).name })),
        countries: db.prepare('SELECT DISTINCT country k FROM transactions ORDER BY k').all().map((r) => r.k),
        channels: ['web', 'mobile', 'pos', 'transfer'],
      },
    };
  });

  // ---------- alerts ----------
  route('GET', '/api/alerts', ({ url, lang }) => {
    const cf = categoryFilter(url, 'a.category');
    const status = url.searchParams.get('status');
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
    const offset = Number(url.searchParams.get('offset')) || 0;
    const where = ['1=1'];
    const params = [];
    if (status && ALERT_STATUSES.includes(status)) { where.push('a.status = ?'); params.push(status); }
    const sql = `FROM alerts a
      JOIN transactions t ON t.id = a.transaction_id
      JOIN accounts ac ON ac.id = a.account_id
      LEFT JOIN cases c ON c.alert_id = a.id
      WHERE ${where.join(' AND ')}${cf.sql}`;
    const total = db.prepare(`SELECT COUNT(*) n ${sql}`).get(...params, ...cf.params).n;
    const items = db.prepare(
      `SELECT a.id, a.rule_key, a.category, a.severity, a.reason, a.status, a.created_at,
              t.amount, t.currency, t.country, t.ip_country, t.channel, t.risk_score, t.synthetic,
              ac.email, c.id AS case_id
       ${sql} ORDER BY a.created_at DESC, a.id DESC LIMIT ? OFFSET ?`).all(...params, ...cf.params, limit, offset);
    return { total, items: items.map((i) => ({ ...i, reason: renderReason(i.reason, lang) })) };
  });

  route('PATCH', '/api/alerts/:id', ({ params, body, user }) => {
    if (!ALERT_STATUSES.includes(body.status)) throw new HttpError(400, 'invalid_status');
    const r = db.prepare('UPDATE alerts SET status = ? WHERE id = ?').run(body.status, params.id);
    if (!r.changes) throw new HttpError(404, 'alert_not_found');
    audit(db, user.email, 'alert.status', 'alert', Number(params.id), { status: body.status });
    return { id: Number(params.id), status: body.status };
  });

  route('POST', '/api/alerts/:id/case', ({ params, body, user }) => {
    const alert = db.prepare('SELECT id FROM alerts WHERE id = ?').get(params.id);
    if (!alert) throw new HttpError(404, 'alert_not_found');
    if (db.prepare('SELECT 1 FROM cases WHERE alert_id = ?').get(alert.id)) throw new HttpError(409, 'case_exists');
    const r = db.prepare('INSERT INTO cases (alert_id,status,assignee,notes,created_at) VALUES (?,?,?,?,?)')
      .run(alert.id, 'investigating', body.assignee ?? null, '', Date.now());
    db.prepare("UPDATE alerts SET status = 'investigating' WHERE id = ?").run(alert.id);
    audit(db, user.email, 'case.create', 'case', Number(r.lastInsertRowid), { alert_id: alert.id });
    return { id: Number(r.lastInsertRowid) };
  });

  // ---------- cases ----------
  route('GET', '/api/cases', ({ url, lang }) => {
    const status = url.searchParams.get('status');
    const where = status && CASE_STATUSES.includes(status) ? 'WHERE c.status = ?' : '';
    return db.prepare(
      `SELECT c.*, a.category, a.severity, a.reason, a.rule_key, ac.email, t.amount
       FROM cases c JOIN alerts a ON a.id = c.alert_id
       JOIN accounts ac ON ac.id = a.account_id JOIN transactions t ON t.id = a.transaction_id
       ${where} ORDER BY c.created_at DESC LIMIT 200`).all(...(where ? [status] : []))
      .map((c) => ({ ...c, reason: renderReason(c.reason, lang) }));
  });

  route('PATCH', '/api/cases/:id', ({ params, body, user }) => {
    const c = db.prepare('SELECT * FROM cases WHERE id = ?').get(params.id);
    if (!c) throw new HttpError(404, 'case_not_found');
    const status = body.status ?? c.status;
    if (!CASE_STATUSES.includes(status)) throw new HttpError(400, 'invalid_status');
    const notes = typeof body.notes === 'string' ? body.notes.slice(0, 5000) : c.notes;
    const assignee = typeof body.assignee === 'string' ? body.assignee.slice(0, 100) : c.assignee;
    const resolvedAt = status === 'resolved' ? (c.resolved_at ?? Date.now()) : null;
    db.prepare('UPDATE cases SET status=?, notes=?, assignee=?, resolved_at=? WHERE id=?')
      .run(status, notes, assignee, resolvedAt, c.id);
    const alertStatus = status === 'resolved' ? (body.false_positive ? 'false_positive' : 'resolved') : status;
    db.prepare('UPDATE alerts SET status = ? WHERE id = ?').run(alertStatus, c.alert_id);
    audit(db, user.email, 'case.update', 'case', c.id, { status, false_positive: !!body.false_positive });
    return { id: c.id, status };
  });

  // ---------- rules ----------
  route('GET', '/api/rules', ({ lang }) =>
    db.prepare('SELECT * FROM rules ORDER BY category, id').all().map((r) => ({ ...r, ...ruleText(r.key, lang, r) })));

  route('PATCH', '/api/rules/:id', ({ params, body, user }) => {
    const r = db.prepare('SELECT * FROM rules WHERE id = ?').get(params.id);
    if (!r) throw new HttpError(404, 'rule_not_found');
    const enabled = body.enabled === undefined ? r.enabled : body.enabled ? 1 : 0;
    const threshold = body.threshold === undefined ? r.threshold : Number(body.threshold);
    const weight = body.weight === undefined ? r.weight : Number(body.weight);
    if (!(threshold > 0) || !Number.isFinite(threshold)) throw new HttpError(400, 'threshold_positive');
    if (!Number.isInteger(weight) || weight < 1 || weight > 100) throw new HttpError(400, 'weight_range');
    db.prepare('UPDATE rules SET enabled=?, threshold=?, weight=? WHERE id=?').run(enabled, threshold, weight, r.id);
    audit(db, user.email, 'rule.update', 'rule', r.id, { enabled, threshold, weight });
    return db.prepare('SELECT * FROM rules WHERE id = ?').get(r.id);
  });

  // ---------- auth ----------
  route('POST', '/api/auth/login', ({ req, res, body }) => {
    const { token, user } = auth.login(body.email, body.password, clientIp(req));
    res.setHeader('Set-Cookie', auth.sessionCookie(token));
    return { user };
  });
  route('POST', '/api/auth/logout', ({ req, res }) => {
    auth.logout(req);
    res.setHeader('Set-Cookie', auth.clearCookie());
    return { ok: true };
  });
  route('GET', '/api/auth/me', ({ user }) => ({ user }));
  route('POST', '/api/auth/password', ({ req, body, user }) => {
    if (!auth.verifyUserPassword(user.id, String(body.current ?? ''))) throw new HttpError(403, 'wrong_current_password');
    auth.setPassword(user.id, body.next);
    auth.revokeUserSessions(user.id, req);          // log out every other device
    audit(db, user.email, 'password.change', 'user', user.id);
    return { ok: true };
  });

  // ---------- users (admin) ----------
  route('GET', '/api/users', () =>
    db.prepare('SELECT id, email, name, role, active, created_at, last_login FROM users ORDER BY id').all());
  route('POST', '/api/users', ({ body, user }) => {
    const id = auth.createUser(body);
    audit(db, user.email, 'user.create', 'user', id, { role: body.role ?? 'viewer' });
    return { id };
  });
  route('PATCH', '/api/users/:id', ({ params, body, user }) => {
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(params.id);
    if (!target) throw new HttpError(404, 'user_not_found');
    const role = body.role ?? target.role;
    const active = body.active === undefined ? target.active : body.active ? 1 : 0;
    if (!ROLES.includes(role)) throw new HttpError(400, 'invalid_role');
    if (target.id === user.id && (role !== 'admin' || !active)) throw new HttpError(400, 'cannot_self_demote');
    db.prepare('UPDATE users SET role = ?, active = ? WHERE id = ?').run(role, active, target.id);
    if (body.password) { auth.setPassword(target.id, body.password); }
    if (!active || body.password) auth.revokeUserSessions(target.id);
    audit(db, user.email, 'user.update', 'user', target.id, { role, active, password_reset: !!body.password });
    return { id: target.id, role, active };
  });

  // ---------- transactions / ingestion ----------
  route('GET', '/api/accounts', () =>
    db.prepare("SELECT id, email, home_country FROM accounts WHERE status = 'active' ORDER BY id LIMIT 500").all());

  route('GET', '/api/transactions', ({ url }) => {
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
    return db.prepare(
      `SELECT t.*, a.email FROM transactions t JOIN accounts a ON a.id = t.account_id
       ORDER BY t.created_at DESC, t.id DESC LIMIT ?`).all(limit);
  });

  // External systems register / update the accounts they report transactions for (X-API-Key).
  route('POST', '/api/accounts', ({ body, req }) => {
    if (!apiKey) throw new HttpError(403, 'ingest_disabled');
    if (req.headers['x-api-key'] !== apiKey) throw new HttpError(401, 'bad_api_key');
    const email = String(body.email ?? '').trim().toLowerCase();
    const home = String(body.home_country ?? '').toUpperCase();
    if (!/^[^\s@]+@[^\s@]+$/.test(email)) throw new HttpError(400, 'invalid_email');
    if (!/^[A-Z]{2}$/.test(home)) throw new HttpError(400, 'bad_home_country');
    const createdAt = Number(body.created_at) || Date.now();
    db.prepare(`INSERT INTO accounts (email,home_country,created_at) VALUES (?,?,?)
                ON CONFLICT(email) DO UPDATE SET home_country = excluded.home_country`).run(email, home, createdAt);
    return db.prepare('SELECT id, email, home_country FROM accounts WHERE email = ?').get(email);
  });

  // External systems push their own transactions here (protected by X-API-Key if CART3R_API_KEY is set).
  route('POST', '/api/transactions', ({ body, req, lang }) => {
    if (!apiKey) throw new HttpError(403, 'ingest_disabled');
    if (req.headers['x-api-key'] !== apiKey) throw new HttpError(401, 'bad_api_key');
    const result = engine.ingest(body);
    audit(db, 'api', 'transaction.ingest', 'transaction', result.transaction_id, { decision: result.decision });
    return localize(result, lang);
  });

  // Used by the UI "Test lab": evaluates one hand-made test transaction (stored as synthetic).
  route('POST', '/api/evaluate', ({ body, user, lang }) => {
    if (!simulator) throw new HttpError(403, 'simulator_disabled');
    const result = engine.ingest(body, { synthetic: true });
    audit(db, user.email, 'transaction.evaluate', 'transaction', result.transaction_id, { decision: result.decision });
    return localize(result, lang);
  });

  // Generates fake test traffic so you can tune rules. Disable with CART3R_SIMULATOR=off.
  route('POST', '/api/simulate', ({ body, user }) => {
    if (!simulator) throw new HttpError(403, 'simulator_disabled');
    const count = Math.min(Math.max(Number(body.count) || 25, 1), 500);
    const accs = db.prepare("SELECT id, home_country, created_at FROM accounts WHERE status = 'active'").all();
    if (!accs.length) throw new HttpError(409, 'no_accounts');
    const rnd = mulberry32(Date.now() & 0xffffffff);
    let transactions = 0, alerts = 0;
    for (let i = 0; i < count; i++) {
      for (const tx of genTransaction(rnd, pick(rnd, accs), Date.now() - Math.floor(rnd() * 3600_000))) {
        alerts += engine.ingest(tx, { synthetic: true }).alerts.length;
        transactions++;
      }
    }
    audit(db, user.email, 'simulate', 'transaction', null, { transactions, alerts });
    return { transactions, alerts, countries: COUNTRIES.length };
  });

  // ---------- server ----------
  async function serveStatic(req, res, pathname) {
    let file = normalize(join(STATIC_DIR, pathname === '/' ? 'index.html' : pathname));
    if (!file.startsWith(STATIC_DIR)) return false;
    try { if (!(await stat(file)).isFile()) throw 0; } catch { file = join(STATIC_DIR, 'index.html'); }
    try {
      const data = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
      res.end(data);
      return true;
    } catch { return false; }
  }

  const send = (res, status, payload) => {
    const data = JSON.stringify(payload);
    res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) });
    res.end(data);
  };

  const readBody = req => new Promise((resolveBody, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > 100_000) { reject(new HttpError(413, 'body_too_large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      if (!chunks.length) return resolveBody({});
      try { resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new HttpError(400, 'bad_json')); }
    });
    req.on('error', reject);
  });

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const lang = pickLang(req);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'");
    res.setHeader('Cache-Control', 'no-store');

    try {
      if (!url.pathname.startsWith('/api/')) {
        if (req.method === 'GET' && (await serveStatic(req, res, url.pathname))) return;
        throw new HttpError(404, 'not_found');
      }
      for (const r of routes) {
        if (r.method !== req.method) continue;
        const m = r.re.exec(url.pathname);
        if (!m) continue;
        const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
        let user = null;
        if (APIKEY.has(r.key)) user = { email: 'api', role: 'api' };
        else if (!PUBLIC.has(r.key)) {
          user = auth.userFromReq(req);
          if (!user) throw new HttpError(401, 'auth_required');
          if (roleLevel(user.role) < roleLevel(NEEDS[r.key] ?? 'viewer')) throw new HttpError(403, 'forbidden_role');
        }
        if (req.method !== 'GET') {
          const origin = req.headers.origin;
          if (origin && new URL(origin).host !== req.headers.host && !allowedOrigins.includes(origin)) {
            throw new HttpError(403, 'cross_origin');
          }
        }
        const body = req.method === 'GET' ? {} : await readBody(req);
        return send(res, 200, await r.handler({ req, res, url, params, body, user, lang }));
      }
      throw new HttpError(404, 'not_found');
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, { error: msg(lang, e.code, e.params), code: e.code });
      if (e instanceof AuthError) return send(res, e.status, { error: msg(lang, e.code, e.params), code: e.code });
      if (e instanceof ValidationError) return send(res, 400, { error: msg(lang, e.code, e.params), code: e.code });
      console.error(e);
      send(res, 500, { error: msg(lang, 'internal_error'), code: 'internal_error' });
    }
  });
}
