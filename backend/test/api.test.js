import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { seed } from '../src/seed.js';

import { makeAuth } from '../src/auth.js';

const db = openDb(':memory:');
seed(db, { days: 60, accounts: 20, perDay: 8 });
const auth = makeAuth(db);
auth.createUser({ email: 'admin@x.test', password: 'adminpassword1', role: 'admin' });
auth.createUser({ email: 'analyst@x.test', password: 'analystpass12', role: 'analyst' });
auth.createUser({ email: 'viewer@x.test', password: 'viewerpass123', role: 'viewer' });
const server = createApp(db, { apiKey: 'secret' });
await new Promise(r => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

// Each "client" keeps its own cookie, like a browser.
function client(cookie = '') {
  const c = async (path, opts = {}) => {
    const res = await fetch(base + path, { ...opts,
      headers: { 'Content-Type': 'application/json', ...(cookie && { Cookie: cookie }), ...opts.headers },
      body: opts.body ? JSON.stringify(opts.body) : undefined });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, json: await res.json(), headers: res.headers };
  };
  return c;
}
async function loginAs(email, password) {
  const c = client();
  const r = await c('/api/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(r.status, 200, `login ${email}`);
  return c;
}
const call = await loginAs('admin@x.test', 'adminpassword1');   // default client = admin
test.after(() => server.close());

test('API requires authentication', async () => {
  const anon = client();
  assert.equal((await anon('/api/overview')).status, 401);
  assert.equal((await anon('/api/alerts')).status, 401);
  assert.equal((await anon('/api/health')).status, 200);
});

test('login: wrong password rejected, cookie is HttpOnly + SameSite', async () => {
  const anon = client();
  assert.equal((await anon('/api/auth/login', { method: 'POST', body: { email: 'admin@x.test', password: 'nope' } })).status, 401);
  assert.equal((await anon('/api/auth/login', { method: 'POST', body: { email: 'ghost@x.test', password: 'nope' } })).status, 401);
  const ok = await anon('/api/auth/login', { method: 'POST', body: { email: 'ADMIN@x.test', password: 'adminpassword1' } });
  const cookie = ok.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/);
  assert.equal((await anon('/api/auth/me')).json.user.role, 'admin');
});

test('brute force is throttled', async () => {
  const anon = client();
  let last;
  for (let i = 0; i < 6; i++) last = await anon('/api/auth/login', { method: 'POST', body: { email: 'victim@x.test', password: 'wrong' + i } });
  assert.equal(last.status, 429);
});

test('roles: viewer read-only, analyst cannot edit rules, admin can', async () => {
  const viewer = await loginAs('viewer@x.test', 'viewerpass123');
  const analyst = await loginAs('analyst@x.test', 'analystpass12');
  assert.equal((await viewer('/api/alerts')).status, 200);
  assert.equal((await viewer('/api/alerts/1', { method: 'PATCH', body: { status: 'resolved' } })).status, 403);
  assert.equal((await viewer('/api/simulate', { method: 'POST', body: {} })).status, 403);
  assert.equal((await analyst('/api/alerts/1', { method: 'PATCH', body: { status: 'investigating' } })).status, 200);
  const rule = (await analyst('/api/rules')).json[0];
  assert.equal((await analyst(`/api/rules/${rule.id}`, { method: 'PATCH', body: { enabled: true } })).status, 403);
  assert.equal((await analyst('/api/users')).status, 403);
  assert.equal((await call(`/api/rules/${rule.id}`, { method: 'PATCH', body: { enabled: true } })).status, 200);
});

test('dev origin (Vite :5173) is allowed, unknown origins are not', async () => {
  const ok = await call('/api/alerts/1', { method: 'PATCH', body: { status: 'open' }, headers: { Origin: 'http://localhost:5173' } });
  assert.equal(ok.status, 200);
});

test('cross-origin writes are blocked', async () => {
  const r = await call('/api/alerts/1', { method: 'PATCH', body: { status: 'open' }, headers: { Origin: 'https://evil.example' } });
  assert.equal(r.status, 403);
});

test('admin manages users; deactivation kills sessions; password change', async () => {
  const created = await call('/api/users', { method: 'POST', body: { email: 'new@x.test', password: 'short', role: 'viewer' } });
  assert.equal(created.status, 400);
  const ok = await call('/api/users', { method: 'POST', body: { email: 'new@x.test', password: 'longenough123', role: 'analyst' } });
  assert.equal(ok.status, 200);
  assert.equal((await call('/api/users', { method: 'POST', body: { email: 'new@x.test', password: 'longenough123' } })).status, 409);

  const newbie = await loginAs('new@x.test', 'longenough123');
  assert.equal((await newbie('/api/auth/password', { method: 'POST', body: { current: 'bad', next: 'anotherpass123' } })).status, 403);
  assert.equal((await newbie('/api/auth/password', { method: 'POST', body: { current: 'longenough123', next: 'anotherpass123' } })).status, 200);
  await loginAs('new@x.test', 'anotherpass123');

  await call(`/api/users/${ok.json.id}`, { method: 'PATCH', body: { active: false } });
  assert.equal((await newbie('/api/auth/me')).status, 401);
  assert.equal((await client()('/api/auth/login', { method: 'POST', body: { email: 'new@x.test', password: 'anotherpass123' } })).status, 401);

  const me = (await call('/api/auth/me')).json.user;
  assert.equal((await call(`/api/users/${me.id}`, { method: 'PATCH', body: { role: 'viewer' } })).status, 400);
});

test('logout invalidates the session', async () => {
  const c = await loginAs('viewer@x.test', 'viewerpass123');
  assert.equal((await c('/api/auth/me')).status, 200);
  await c('/api/auth/logout', { method: 'POST' });
  assert.equal((await c('/api/auth/me')).status, 401);
});

test('health + overview shape', async () => {
  assert.equal((await call('/api/health')).json.ok, true);
  const { json } = await call('/api/overview');
  assert.equal(json.daily_transactions.series.length, 30);
  assert.equal(json.monthly_alerts.series.length, 6);
  assert.ok(json.kpis.transactions.value > 0);
});

test('ingest requires API key and validates input', async () => {
  const tx = { account_id: 1, amount: 50, country: 'US' };
  assert.equal((await call('/api/transactions', { method: 'POST', body: tx })).status, 401);
  const key = { 'X-API-Key': 'secret' };
  assert.equal((await call('/api/transactions', { method: 'POST', headers: key, body: { ...tx, amount: -1 } })).status, 400);
  assert.equal((await call('/api/transactions', { method: 'POST', headers: key, body: { ...tx, account_id: 9999 } })).status, 400);
  assert.equal((await call('/api/transactions', { method: 'POST', headers: key, body: tx })).status, 200);
});

test('high amount + geo mismatch raise alerts', async () => {
  const acc = db.prepare('SELECT id, home_country FROM accounts LIMIT 1').get();
  const other = acc.home_country === 'FR' ? 'DE' : 'FR';
  const { json } = await call('/api/transactions', {
    method: 'POST', headers: { 'X-API-Key': 'secret' },
    body: { account_id: acc.id, amount: 5000, country: acc.home_country, ip_country: other },
  });
  const keys = json.alerts.map(a => a.rule_key);
  assert.ok(keys.includes('high_amount') && keys.includes('geo_mismatch'));
  assert.ok(json.risk_score >= 35);
});

test('card-testing pattern detected after repeated tiny declines', async () => {
  const acc = db.prepare('SELECT id, home_country FROM accounts LIMIT 1').get();
  const t0 = Date.now();
  let last;
  for (let i = 0; i < 3; i++) {
    last = await call('/api/transactions', { method: 'POST', headers: { 'X-API-Key': 'secret' },
      body: { account_id: acc.id, amount: 1, country: acc.home_country, status: 'declined', created_at: t0 + i * 1000 } });
  }
  assert.ok(last.json.alerts.some(a => a.rule_key === 'card_testing'));
});

test('alert → case → resolve as false positive', async () => {
  const { json: list } = await call('/api/alerts?status=open&limit=1');
  const alert = list.items[0];
  const c = await call(`/api/alerts/${alert.id}/case`, { method: 'POST', body: {} });
  assert.equal(c.status, 200);
  assert.equal((await call(`/api/alerts/${alert.id}/case`, { method: 'POST', body: {} })).status, 409);
  await call(`/api/cases/${c.json.id}`, { method: 'PATCH', body: { status: 'resolved', false_positive: true, notes: 'ok' } });
  const after = (await call('/api/alerts?status=false_positive&limit=200')).json.items.find(a => a.id === alert.id);
  assert.ok(after);
});

test('rules can be tuned and disabled', async () => {
  const rules = (await call('/api/rules')).json;
  const r = rules.find(x => x.key === 'high_amount');
  assert.equal((await call(`/api/rules/${r.id}`, { method: 'PATCH', body: { weight: 500 } })).status, 400);
  const upd = await call(`/api/rules/${r.id}`, { method: 'PATCH', body: { enabled: false, threshold: 3000 } });
  assert.equal(upd.json.enabled, 0);
  await call(`/api/rules/${r.id}`, { method: 'PATCH', body: { enabled: true, threshold: 2000 } });
});

test('simulator generates labelled synthetic traffic', async () => {
  const { json } = await call('/api/simulate', { method: 'POST', body: { count: 10 } });
  assert.ok(json.transactions >= 10);
});

test('evaluate endpoint (UI test lab) needs no API key', async () => {
  const acc = db.prepare('SELECT id, home_country FROM accounts LIMIT 1').get();
  const { status, json } = await call('/api/evaluate', { method: 'POST', body: { account_id: acc.id, amount: 3000, country: acc.home_country } });
  assert.equal(status, 200);
  assert.ok(json.alerts.some(a => a.rule_key === 'high_amount'));
});

test('accounts can be registered via API key, then transactions ingested', async () => {
  const key = { 'X-API-Key': 'secret' };
  assert.equal((await client()('/api/accounts', { method: 'POST', body: { email: 'real@shop.test', home_country: 'US' } })).status, 401);
  const acc = await client()('/api/accounts', { method: 'POST', headers: key, body: { email: 'Real@shop.test', home_country: 'us' } });
  assert.equal(acc.status, 200);
  const again = await client()('/api/accounts', { method: 'POST', headers: key, body: { email: 'real@shop.test', home_country: 'GB' } });
  assert.equal(again.json.id, acc.json.id);
  const tx = await client()('/api/transactions', { method: 'POST', headers: key, body: { account_id: acc.json.id, amount: 20, country: 'GB' } });
  assert.equal(tx.status, 200);
});

test('language: errors, rule names and alert reasons follow X-Lang / Accept-Language', async () => {
  // errors
  const en = await client()('/api/auth/login', { method: 'POST', body: { email: 'x@x.test', password: 'nope' }, headers: { 'X-Lang': 'en' } });
  const ru = await client()('/api/auth/login', { method: 'POST', body: { email: 'x@x.test', password: 'nope' }, headers: { 'X-Lang': 'ru' } });
  assert.equal(en.json.error, 'Invalid email or password');
  assert.equal(ru.json.error, 'Неверный email или пароль');
  assert.equal(en.json.code, 'bad_credentials');
  assert.equal(ru.json.code, 'bad_credentials');
  const viaHeader = await client()('/api/auth/login', { method: 'POST', body: { email: 'x@x.test', password: 'nope' }, headers: { 'Accept-Language': 'ru-RU,ru;q=0.9' } });
  assert.equal(viaHeader.json.error, 'Неверный email или пароль');
  const dflt = await client()('/api/auth/login', { method: 'POST', body: { email: 'x@x.test', password: 'nope' }, headers: { 'Accept-Language': 'fr' } });
  assert.equal(dflt.json.error, 'Invalid email or password');

  // rule names
  const rEn = (await call('/api/rules', { headers: { 'X-Lang': 'en' } })).json.find(r => r.key === 'high_amount');
  const rRu = (await call('/api/rules', { headers: { 'X-Lang': 'ru' } })).json.find(r => r.key === 'high_amount');
  assert.equal(rEn.name, 'High amount');
  assert.equal(rRu.name, 'Крупная сумма');

  // alert reasons (same stored alert rendered in both languages)
  const acc = db.prepare('SELECT id, home_country FROM accounts LIMIT 1').get();
  const tx = { account_id: acc.id, amount: 7777, country: acc.home_country };
  const a = await call('/api/evaluate', { method: 'POST', body: tx, headers: { 'X-Lang': 'en' } });
  const b = await call('/api/evaluate', { method: 'POST', body: tx, headers: { 'X-Lang': 'ru' } });
  assert.match(a.json.alerts.find(x => x.rule_key === 'high_amount').reason, /^Amount 7777\.00/);
  assert.match(b.json.alerts.find(x => x.rule_key === 'high_amount').reason, /^Сумма 7777\.00/);
  const listRu = (await call('/api/alerts?limit=5', { headers: { 'X-Lang': 'ru' } })).json.items;
  const listEn = (await call('/api/alerts?limit=5', { headers: { 'X-Lang': 'en' } })).json.items;
  assert.ok(listRu.length && listEn.length);
  assert.ok(!listEn.some(i => i.reason.startsWith('{')) && !listRu.some(i => i.reason.startsWith('{')));
  assert.ok(!listEn.some(i => /[А-Яа-я]/.test(i.reason)));
});

test('monthly series labels are ISO months (formatted by the client)', async () => {
  const { json } = await call('/api/overview');
  assert.match(json.monthly_alerts.series[0].label, /^\d{4}-\d{2}$/);
});

test('analytics: totals, rule precision, filters, validation', async () => {
  const day = (d) => new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10);
  const r = await call(`/api/analytics?from=${day(59)}&to=${day(0)}`);
  assert.equal(r.status, 200);
  const a = r.json;
  assert.equal(a.range.days, 60);
  assert.equal(a.daily.length, 60);
  assert.equal(a.hours.length, 24);
  assert.equal(a.weekdays.length, 7);
  assert.equal(a.daily.reduce((s, p) => s + p.value, 0), a.totals.alerts);
  assert.equal(a.hours.reduce((s, p) => s + p.value, 0), a.totals.alerts);
  assert.equal(a.rules.reduce((s, x) => s + x.alerts, 0), a.totals.alerts);
  assert.equal(a.totals.alerts, a.totals.false_positive + a.totals.confirmed + a.totals.pending);
  assert.ok(a.options.rules.length >= 6);
  // filter by one rule narrows the result to that rule
  const key = a.rules[0].key;
  const f = (await call(`/api/analytics?from=${day(59)}&to=${day(0)}&rules=${key}`)).json;
  assert.equal(f.rules.length, 1);
  assert.equal(f.totals.alerts, a.rules[0].alerts);
  // bad ranges
  assert.equal((await call(`/api/analytics?from=${day(0)}&to=${day(5)}`)).status, 400);
  assert.equal((await call('/api/analytics?from=2020-01-01&to=2022-01-01')).status, 400);
  // viewers may read it, anonymous may not
  assert.equal((await client()('/api/analytics')).status, 401);
});
