import { pathToFileURL } from 'node:url';
import { openDb } from './db.js';
import { makeEngine } from './engine.js';
import { COUNTRIES, mulberry32, pick, genTransaction } from './synthetic.js';

const DAY = 86_400_000;

export function seed(db, { days = 180, accounts = 60, perDay = 14, seedValue = 42 } = {}) {
  const rnd = mulberry32(seedValue);
  const engine = makeEngine(db);
  const now = Date.now();

  db.exec('BEGIN');
  try {
    for (const t of ['audit_log', 'cases', 'alerts', 'transactions', 'accounts']) db.exec(`DELETE FROM ${t}`);

    const insAcc = db.prepare('INSERT INTO accounts (email,home_country,status,created_at) VALUES (?,?,?,?)');
    const accs = [];
    for (let i = 1; i <= accounts; i++) {
      const home = pick(rnd, COUNTRIES);
      const created = now - Math.floor(rnd() * (days + 120)) * DAY;
      const id = Number(insAcc.run(`user${i}@example.test`, home, 'active', created).lastInsertRowid);
      accs.push({ id, home_country: home, created_at: created });
    }

    for (let d = days; d >= 0; d--) {
      const n = Math.round(perDay * (0.7 + rnd() * 0.8) * (1 + (days - d) / days * 0.5)); // gentle growth
      for (let k = 0; k < n; k++) {
        const ts = now - d * DAY + Math.floor(rnd() * DAY * 0.95) - DAY * 0.5 * 0; // within the day
        const when = Math.min(ts, now - 1000);
        const acc = pick(rnd, accs.filter(a => a.created_at <= when));
        for (const tx of genTransaction(rnd, acc, when)) engine.ingest(tx, { synthetic: true });
      }
    }

    // Simulate analyst workflow on older alerts: cases, resolutions, false positives.
    const old = db.prepare('SELECT id, created_at FROM alerts WHERE created_at < ? ORDER BY id').all(now - 3 * DAY);
    const insCase = db.prepare(
      'INSERT INTO cases (alert_id,status,assignee,notes,created_at,resolved_at) VALUES (?,?,?,?,?,?)');
    const setAlert = db.prepare('UPDATE alerts SET status = ? WHERE id = ?');
    for (const a of old) {
      const r = rnd();
      if (r < 0.35) {
        const fp = rnd() < 0.3;
        insCase.run(a.id, 'resolved', pick(rnd, ['alice', 'bob', 'dana']),
          fp ? 'Customer confirmed the transaction. / Клиент подтвердил операцию.' : 'Fraud confirmed; customer notified. / Мошенничество подтверждено; клиент уведомлён.',
          a.created_at + 3600_000, a.created_at + Math.floor(rnd() * 2 * DAY) + 7200_000);
        setAlert.run(fp ? 'false_positive' : 'resolved', a.id);
      } else if (r < 0.42) {
        insCase.run(a.id, 'investigating', 'alice', '', a.created_at + 3600_000, null);
        setAlert.run('investigating', a.id);
      }
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  const count = t => db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n;
  return { accounts: count('accounts'), transactions: count('transactions'), alerts: count('alerts'), cases: count('cases') };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const db = openDb();
  console.log('Seeded:', seed(db));
}
