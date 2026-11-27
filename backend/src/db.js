import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ruleText } from './i18n.js';

const here = dirname(fileURLToPath(import.meta.url));

// Names/descriptions shown to users live in i18n.js (RU/EN); the DB keeps the English text as a fallback.
export const DEFAULT_RULES = [
  { key: 'high_amount', category: 'Card Fraud', severity: 'medium', threshold: 2000, weight: 35 },
  { key: 'velocity', category: 'Card Fraud', severity: 'medium', threshold: 5, weight: 40 },
  { key: 'card_testing', category: 'Card Fraud', severity: 'high', threshold: 3, weight: 50 },
  { key: 'geo_mismatch', category: 'Account Takeover', severity: 'medium', threshold: 1, weight: 30 },
  { key: 'new_account_large', category: 'Identity Theft', severity: 'high', threshold: 500, weight: 45 },
  { key: 'new_payee_transfer', category: 'Phishing', severity: 'high', threshold: 800, weight: 40 },
].map((r) => ({ ...r, ...ruleText(r.key, 'en') }));

export function openDb(path = process.env.CART3R_DB || resolve(here, '../data/radar.db')) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(readFileSync(resolve(here, 'schema.sql'), 'utf8'));
  const insert = db.prepare(
    `INSERT OR IGNORE INTO rules (key,name,category,description,threshold,weight,severity) VALUES (?,?,?,?,?,?,?)`
  );
  for (const r of DEFAULT_RULES) insert.run(r.key, r.name, r.category, r.description, r.threshold, r.weight, r.severity);
  return db;
}

export function audit(db, actor, action, entity, entityId, detail = null) {
  db.prepare('INSERT INTO audit_log (actor,action,entity,entity_id,detail,created_at) VALUES (?,?,?,?,?,?)')
    .run(actor, action, entity, entityId ?? null, detail ? JSON.stringify(detail) : null, Date.now());
}
