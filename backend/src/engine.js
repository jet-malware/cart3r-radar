import { reasonJson } from './i18n.js';

// Rule engine: scores an incoming transaction and raises alerts.
// Purely defensive — it only *detects* suspicious patterns in data you feed it.

const MIN = 60_000;
const DAY = 86_400_000;

export class ValidationError extends Error {
  constructor(code, params) { super(code); this.code = code; this.params = params; }
}

export function makeEngine(db) {
  const q = {
    rules: db.prepare('SELECT * FROM rules WHERE enabled = 1'),
    account: db.prepare('SELECT * FROM accounts WHERE id = ?'),
    countRecent: db.prepare(
      'SELECT COUNT(*) AS n FROM transactions WHERE account_id = ? AND created_at BETWEEN ? AND ?'),
    countSmallDeclined: db.prepare(
      `SELECT COUNT(*) AS n FROM transactions
       WHERE account_id = ? AND status = 'declined' AND amount <= 5 AND created_at BETWEEN ? AND ?`),
    insertTx: db.prepare(
      `INSERT INTO transactions
       (account_id,amount,currency,country,ip_country,channel,payee_new,status,risk_score,decision,synthetic,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`),
    insertAlert: db.prepare(
      `INSERT INTO alerts (transaction_id,account_id,rule_key,category,severity,reason,status,created_at)
       VALUES (?,?,?,?,?,?, 'open', ?)`),
  };

  // Each check returns a human-readable reason when the rule fires, otherwise null.
  const checks = {
    high_amount: (tx, _acc, r) =>
      tx.amount >= r.threshold ? reasonJson('high_amount', { amount: tx.amount.toFixed(2), threshold: r.threshold }) : null,

    velocity: (tx, acc, r) => {
      const n = q.countRecent.get(acc.id, tx.created_at - 10 * MIN, tx.created_at).n + 1;
      return n >= r.threshold ? reasonJson('velocity', { n }) : null;
    },

    card_testing: (tx, acc, r) => {
      const prior = q.countSmallDeclined.get(acc.id, tx.created_at - 15 * MIN, tx.created_at).n;
      const self = tx.status === 'declined' && tx.amount <= 5 ? 1 : 0;
      const n = prior + self;
      return self && n >= r.threshold ? reasonJson('card_testing', { n }) : null;
    },

    geo_mismatch: (tx, acc) =>
      tx.ip_country !== acc.home_country && tx.ip_country !== tx.country
        ? reasonJson('geo_mismatch', { ip: tx.ip_country, home: acc.home_country, country: tx.country }) : null,

    new_account_large: (tx, acc, r) =>
      tx.created_at - acc.created_at < 7 * DAY && tx.amount >= r.threshold
        ? reasonJson('new_account_large', { days: Math.floor((tx.created_at - acc.created_at) / DAY), amount: tx.amount.toFixed(2) }) : null,

    new_payee_transfer: (tx, _acc, r) =>
      tx.channel === 'transfer' && tx.payee_new && tx.amount >= r.threshold
        ? reasonJson('new_payee_transfer', { amount: tx.amount.toFixed(2) }) : null,
  };

  function validate(input) {
    const tx = {
      account_id: Number(input.account_id),
      amount: Number(input.amount),
      currency: String(input.currency ?? 'USD').toUpperCase().slice(0, 3),
      country: String(input.country ?? '').toUpperCase(),
      ip_country: String(input.ip_country ?? input.country ?? '').toUpperCase(),
      channel: input.channel ?? 'web',
      payee_new: input.payee_new ? 1 : 0,
      status: input.status ?? 'approved',
      created_at: input.created_at ? Number(input.created_at) : Date.now(),
    };
    if (!Number.isInteger(tx.account_id)) throw new ValidationError('account_id_int');
    if (!(tx.amount > 0 && tx.amount <= 10_000_000)) throw new ValidationError('amount_range');
    if (!/^[A-Z]{2}$/.test(tx.country)) throw new ValidationError('country_code');
    if (!/^[A-Z]{2}$/.test(tx.ip_country)) throw new ValidationError('ip_country_code');
    if (!['web', 'mobile', 'pos', 'transfer'].includes(tx.channel)) throw new ValidationError('bad_channel');
    if (!['approved', 'declined'].includes(tx.status)) throw new ValidationError('bad_status');
    if (!Number.isFinite(tx.created_at)) throw new ValidationError('bad_created_at');
    return tx;
  }

  function ingest(input, { synthetic = false } = {}) {
    const tx = validate(input);
    const acc = q.account.get(tx.account_id);
    if (!acc) throw new ValidationError('account_missing', { id: tx.account_id });

    const hits = [];
    for (const rule of q.rules.all()) {
      const reason = checks[rule.key]?.(tx, acc, rule);
      if (reason) hits.push({ rule, reason });
    }
    const score = Math.min(100, hits.reduce((s, h) => s + h.rule.weight, 0));
    const decision = score >= 70 ? 'review' : score >= 35 ? 'flag' : 'allow';

    const { lastInsertRowid } = q.insertTx.run(
      tx.account_id, tx.amount, tx.currency, tx.country, tx.ip_country, tx.channel,
      tx.payee_new, tx.status, score, decision, synthetic ? 1 : 0, tx.created_at);
    const transactionId = Number(lastInsertRowid);

    const alerts = hits.map(({ rule, reason }) => {
      const r = q.insertAlert.run(transactionId, acc.id, rule.key, rule.category, rule.severity, reason, tx.created_at);
      return { id: Number(r.lastInsertRowid), rule_key: rule.key, category: rule.category, severity: rule.severity, reason };
    });

    return { transaction_id: transactionId, risk_score: score, decision, alerts };
  }

  return { ingest };
}
