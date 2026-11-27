import { useState } from 'react';
import { api } from '../api.js';
import { useI18n, LangSwitch } from '../i18n/index.jsx';

export default function Login({ onLogin }) {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { onLogin((await api.login(email, password)).user); }
    catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <div className="login-wrap">
      <div className="login-lang"><LangSwitch /></div>
      <form className="card login" onSubmit={submit}>
        <div className="brand">CART3R<span>: radar</span></div>
        <p className="muted">{t('login.title')}</p>
        <label>{t('login.email')}
          <input type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>{t('login.password')}
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <div className="error">⚠ {error}</div>}
        <button className="btn" disabled={busy}>{busy ? t('login.busy') : t('login.submit')}</button>
        <p className="muted">{t('login.noAccount')}</p>
      </form>
    </div>
  );
}
