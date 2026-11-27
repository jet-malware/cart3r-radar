import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'node:crypto';

export const ROLES = ['viewer', 'analyst', 'admin'];
export const roleLevel = (r) => ROLES.indexOf(r);
export const COOKIE = 'cart3r_session';
const SESSION_MS = 7 * 86_400_000;

export class AuthError extends Error {
  constructor(status, code, params) { super(code); this.status = status; this.code = code; this.params = params; }
}

export function hashPassword(pw) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${scryptSync(pw, salt, 64).toString('hex')}`;
}

export function verifyPassword(pw, stored) {
  const [alg, salt, hash] = String(stored).split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(pw, Buffer.from(salt, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}

export function checkPasswordPolicy(pw) {
  if (typeof pw !== 'string' || pw.length < 10) throw new AuthError(400, 'password_short');
  if (pw.length > 200) throw new AuthError(400, 'password_long');
}

const sha = (t) => createHash('sha256').update(t).digest('hex');
const DUMMY_HASH = hashPassword('dummy-password-for-timing');   // equalises timing for unknown emails

export function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((c) => c.trim().split('=')).filter((p) => p[0]).map(([k, ...v]) => [k, v.join('=')]));
}

export function makeAuth(db, { secureCookies = false } = {}) {
  const q = {
    byEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
    byId: db.prepare('SELECT * FROM users WHERE id = ?'),
    insertSession: db.prepare('INSERT INTO sessions (token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)'),
    sessionUser: db.prepare(
      `SELECT u.id, u.email, u.name, u.role FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1`),
  };

  // ----- login throttling (in memory): 5 failures / 15 min per ip+email, 30 per ip -----
  const fails = new Map();
  const WINDOW = 15 * 60_000;
  const bump = (key) => {
    const now = Date.now();
    const e = fails.get(key);
    if (!e || e.reset < now) fails.set(key, { n: 1, reset: now + WINDOW });
    else e.n++;
  };
  const blocked = (key, max) => { const e = fails.get(key); return e && e.reset > Date.now() && e.n >= max; };

  function login(email, password, ip) {
    email = String(email ?? '').trim().toLowerCase();
    const kUser = `u|${ip}|${email}`, kIp = `i|${ip}`;
    if (blocked(kUser, 5) || blocked(kIp, 30)) throw new AuthError(429, 'too_many_attempts');
    const user = q.byEmail.get(email);
    const ok = verifyPassword(String(password ?? ''), user?.password_hash ?? DUMMY_HASH) && user?.active;
    if (!ok) { bump(kUser); bump(kIp); throw new AuthError(401, 'bad_credentials'); }
    fails.delete(kUser);
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
    const token = randomBytes(32).toString('hex');
    const now = Date.now();
    q.insertSession.run(sha(token), user.id, now, now + SESSION_MS);
    db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(now, user.id);
    return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
  }

  const cookieFlags = () => `Path=/; HttpOnly; SameSite=Strict${secureCookies ? '; Secure' : ''}`;
  return {
    login,
    sessionCookie: (token) => `${COOKIE}=${token}; ${cookieFlags()}; Max-Age=${SESSION_MS / 1000}`,
    clearCookie: () => `${COOKIE}=; ${cookieFlags()}; Max-Age=0`,
    userFromReq(req) {
      const token = parseCookies(req.headers.cookie)[COOKIE];
      return token ? q.sessionUser.get(sha(token), Date.now()) ?? null : null;
    },
    logout(req) {
      const token = parseCookies(req.headers.cookie)[COOKIE];
      if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(token));
    },
    revokeUserSessions(userId, exceptReq) {
      const token = exceptReq && parseCookies(exceptReq.headers.cookie)[COOKIE];
      db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash IS NOT ?').run(userId, token ? sha(token) : null);
    },
    createUser({ email, name = '', password, role = 'viewer' }) {
      email = String(email ?? '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AuthError(400, 'invalid_email');
      if (!ROLES.includes(role)) throw new AuthError(400, 'invalid_role');
      checkPasswordPolicy(password);
      if (q.byEmail.get(email)) throw new AuthError(409, 'email_taken');
      const r = db.prepare('INSERT INTO users (email,name,password_hash,role,created_at) VALUES (?,?,?,?,?)')
        .run(email, String(name).slice(0, 100), hashPassword(password), role, Date.now());
      return Number(r.lastInsertRowid);
    },
    verifyUserPassword: (userId, pw) => verifyPassword(pw, q.byId.get(userId)?.password_hash),
    setPassword(userId, pw) {
      checkPasswordPolicy(pw);
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(pw), userId);
    },
  };
}
