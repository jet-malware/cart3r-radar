PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS accounts (
  id           INTEGER PRIMARY KEY,
  email        TEXT NOT NULL UNIQUE,
  home_country TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active',      -- active | suspended
  created_at   INTEGER NOT NULL                     -- unix ms
);

CREATE TABLE IF NOT EXISTS transactions (
  id          INTEGER PRIMARY KEY,
  account_id  INTEGER NOT NULL REFERENCES accounts(id),
  amount      REAL    NOT NULL CHECK (amount > 0),
  currency    TEXT    NOT NULL DEFAULT 'USD',
  country     TEXT    NOT NULL,                     -- merchant / card country
  ip_country  TEXT    NOT NULL,                     -- country resolved from client IP
  channel     TEXT    NOT NULL DEFAULT 'web',       -- web | mobile | pos | transfer
  payee_new   INTEGER NOT NULL DEFAULT 0,           -- 1 = first payment to this payee
  status      TEXT    NOT NULL DEFAULT 'approved',  -- approved | declined
  risk_score  INTEGER NOT NULL DEFAULT 0,           -- 0..100
  decision    TEXT    NOT NULL DEFAULT 'allow',     -- allow | flag | review
  synthetic   INTEGER NOT NULL DEFAULT 0,           -- 1 = generated test data
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tx_account_time ON transactions(account_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tx_time ON transactions(created_at);

CREATE TABLE IF NOT EXISTS rules (
  id          INTEGER PRIMARY KEY,
  key         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,   -- Phishing | Identity Theft | Card Fraud | Account Takeover
  description TEXT NOT NULL,
  enabled     INTEGER NOT NULL DEFAULT 1,
  threshold   REAL NOT NULL,
  weight      INTEGER NOT NULL CHECK (weight BETWEEN 1 AND 100),
  severity    TEXT NOT NULL DEFAULT 'medium'          -- low | medium | high
);

CREATE TABLE IF NOT EXISTS alerts (
  id             INTEGER PRIMARY KEY,
  transaction_id INTEGER NOT NULL REFERENCES transactions(id),
  account_id     INTEGER NOT NULL REFERENCES accounts(id),
  rule_key       TEXT NOT NULL REFERENCES rules(key),
  category       TEXT NOT NULL,
  severity       TEXT NOT NULL,
  reason         TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'open',        -- open | investigating | resolved | false_positive
  created_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_alerts_time ON alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);

CREATE TABLE IF NOT EXISTS cases (
  id          INTEGER PRIMARY KEY,
  alert_id    INTEGER NOT NULL UNIQUE REFERENCES alerts(id),
  status      TEXT NOT NULL DEFAULT 'open',           -- open | investigating | resolved
  assignee    TEXT,
  notes       TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL,
  resolved_at INTEGER
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY,
  actor      TEXT NOT NULL DEFAULT 'system',
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  INTEGER,
  detail     TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer','analyst','admin')),
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL,
  last_login    INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,                 -- sha256 of the cookie token
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
