import { useState } from 'react';
import { api } from '../api.js';
import { useAsync } from '../hooks.js';
import { useUser, can } from '../auth.jsx';
import { useI18n } from '../i18n/index.jsx';
import { Card, ErrorBox } from '../components/ui.jsx';

const ROLES = ['viewer', 'analyst', 'admin'];

function RoleOptions() {
  const { t } = useI18n();
  return ROLES.map((r) => <option key={r} value={r}>{t(`role.${r}`)}</option>);
}

function ChangePassword() {
  const { t } = useI18n();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null); setError(null);
    try { await api.changePassword(current, next); setMsg(t('ac.pw.done')); setCurrent(''); setNext(''); }
    catch (err) { setError(err.message); }
  };

  return (
    <Card title={t('ac.pw.title')}>
      <form className="form" onSubmit={submit}>
        <label>{t('ac.pw.current')} <input type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} /></label>
        <label>{t('ac.pw.new')} <input type="password" autoComplete="new-password" required minLength="10" value={next} onChange={(e) => setNext(e.target.value)} /></label>
        <button className="btn">{t('ac.pw.btn')}</button>
      </form>
      {msg && <p className="ok">{msg}</p>}
      <ErrorBox error={error} />
    </Card>
  );
}

function UserRow({ u, me, onChange }) {
  const { t, fmtDate } = useI18n();
  const [error, setError] = useState(null);
  const patch = async (body) => {
    setError(null);
    try { await api.updateUser(u.id, body); onChange(); } catch (e) { setError(e.message); }
  };
  const reset = () => {
    const password = window.prompt(t('ac.resetPrompt', { email: u.email }));
    if (password) patch({ password });
  };
  const self = u.id === me.id;
  return (
    <tr className={u.active ? '' : 'disabled'}>
      <td>{u.email}{self && <span className="muted">{t('ac.you')}</span>}<ErrorBox error={error} /></td>
      <td><select value={u.role} disabled={self} onChange={(e) => patch({ role: e.target.value })}><RoleOptions /></select></td>
      <td>{u.last_login ? fmtDate(u.last_login) : t('ac.never')}</td>
      <td className="actions">
        <button className="btn ghost" onClick={reset}>{t('ac.reset')}</button>
        {!self && <button className="btn ghost" onClick={() => patch({ active: !u.active })}>{u.active ? t('ac.deactivate') : t('ac.activate')}</button>}
      </td>
    </tr>
  );
}

function Users({ me }) {
  const { t } = useI18n();
  const { data, error, reload } = useAsync(() => api.users(), []);
  const empty = { email: '', name: '', password: '', role: 'analyst' };
  const [form, setForm] = useState(empty);
  const [formError, setFormError] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const create = async (e) => {
    e.preventDefault();
    setFormError(null);
    try { await api.createUser(form); setForm(empty); reload(); }
    catch (err) { setFormError(err.message); }
  };

  return (
    <Card title={t('ac.users.title')}>
      <p className="muted">{t('ac.users.intro')}</p>
      <ErrorBox error={error} />
      <div className="table-wrap">
        <table>
          <thead><tr><th>{t('ac.col.email')}</th><th>{t('ac.col.role')}</th><th>{t('ac.col.lastLogin')}</th><th /></tr></thead>
          <tbody>{data?.map((u) => <UserRow key={`${u.id}-${u.role}-${u.active}`} u={u} me={me} onChange={reload} />)}</tbody>
        </table>
      </div>
      <h3 style={{ marginTop: 18 }}>{t('ac.invite')}</h3>
      <form className="form" onSubmit={create}>
        <label>{t('ac.inv.email')} <input type="email" required value={form.email} onChange={set('email')} /></label>
        <label>{t('ac.inv.name')} <input value={form.name} onChange={set('name')} /></label>
        <label>{t('ac.inv.pw')} <input type="text" required minLength="10" value={form.password} onChange={set('password')} /></label>
        <label>{t('ac.inv.role')} <select value={form.role} onChange={set('role')}><RoleOptions /></select></label>
        <button className="btn">{t('ac.inv.btn')}</button>
      </form>
      <ErrorBox error={formError} />
    </Card>
  );
}

export default function Account() {
  const { t } = useI18n();
  const me = useUser();
  return (
    <div className="two-col">
      <Card title={t('ac.title')}>
        <p><b>{me.email}</b></p>
        <p className="muted">{t('ac.role', { role: t(`role.${me.role}`) })}</p>
      </Card>
      <ChangePassword />
      {can(me, 'admin') && <div className="wide"><Users me={me} /></div>}
    </div>
  );
}
