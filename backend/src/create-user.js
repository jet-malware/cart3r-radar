// Usage: node src/create-user.js <email> <password> [role=admin] [name]
import { openDb } from './db.js';
import { makeAuth } from './auth.js';

const [email, password, role = 'admin', name = ''] = process.argv.slice(2);
if (!email || !password) { console.error('Usage / Использование: node src/create-user.js <email> <password> [viewer|analyst|admin] [name]'); process.exit(1); }
try {
  const id = makeAuth(openDb()).createUser({ email, password, role, name });
  console.log(`Created / Создан (${role}) #${id}: ${email}`);
} catch (e) { console.error('Error / Ошибка:', e.message); process.exit(1); }
