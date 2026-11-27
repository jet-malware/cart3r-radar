import { randomBytes } from 'node:crypto';
import { openDb } from './db.js';
import { createApp } from './app.js';
import { makeAuth } from './auth.js';
import { seed } from './seed.js';

const db = openDb();

// First run: fill the database with synthetic demo data (disable with CART3R_SEED=off).
if (process.env.CART3R_SEED !== 'off' && db.prepare('SELECT COUNT(*) n FROM accounts').get().n === 0) {
  console.log('Empty database, creating synthetic demo data / База пуста, создаю демо-данные…', seed(db));
}

// First run: create the initial admin.
if (db.prepare('SELECT COUNT(*) n FROM users').get().n === 0) {
  const email = process.env.CART3R_ADMIN_EMAIL || 'admin@example.com';
  const generated = !process.env.CART3R_ADMIN_PASSWORD;
  const password = process.env.CART3R_ADMIN_PASSWORD || randomBytes(9).toString('base64url');
  makeAuth(db).createUser({ email, password, role: 'admin', name: 'Administrator' });
  console.log('\n===== FIRST ADMIN CREATED / СОЗДАН ПЕРВЫЙ АДМИНИСТРАТОР =====');
  console.log(` login / логин:    ${email}`);
  if (generated) console.log(` password / пароль: ${password}   (shown once / показан один раз)`);
  console.log('============================================================\n');
}

const port = Number(process.env.PORT) || 4000;
createApp(db).listen(port, () => console.log(`CART3R: radar listening / запущен: http://localhost:${port}`));
