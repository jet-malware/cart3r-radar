import { useState } from 'react';
import { api } from '../api.js';
import { useAsync } from '../hooks.js';
import { useI18n } from '../i18n/index.jsx';
import { Card, ErrorBox } from '../components/ui.jsx';

const COUNTRIES = ['US', 'GB', 'DE', 'FR', 'PL', 'UA', 'CA', 'NL', 'ES', 'IT'];
const CHANNELS = ['web', 'mobile', 'pos', 'transfer'];
const TX_STATUSES = ['approved', 'declined'];

export default function Simulator() {
  const { t, fmtDate } = useI18n();
  const accounts = useAsync(() => api.accounts(), []);
  const recent = useAsync(() => api.transactions(15), []);
  const [count, setCount] = useState(25);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ account_id: '', amount: 100, country: 'US', ip_country: 'US', channel: 'web', payee_new: false, status: 'approved' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const run = async (fn) => {
    setError(null); setMsg(null);
    try { setMsg(await fn()); recent.reload(); } catch (e) { setError(e.message); }
  };

  return (
    <div className="two-col">
      <Card title={t('lab.gen.title')}>
        <p className="muted">{t('lab.gen.desc')}</p>
        <label>{t('lab.gen.count')} <input type="number" min="1" max="500" value={count} onChange={(e) => setCount(e.target.value)} /></label>
        <button className="btn" onClick={() => run(async () => {
          const r = await api.simulate(Number(count));
          return t('lab.gen.done', { tx: r.transactions, alerts: r.alerts });
        })}>{t('lab.gen.btn')}</button>
        {msg && <p className="ok">{msg}</p>}
        <ErrorBox error={error} />
      </Card>

      <Card title={t('lab.eval.title')}>
        <p className="muted">{t('lab.eval.desc')}</p>
        <div className="form">
          <label>{t('lab.account')}
            <select value={form.account_id} onChange={set('account_id')}>
              <option value="">{t('lab.select')}</option>
              {accounts.data?.map((a) => <option key={a.id} value={a.id}>{a.email} ({a.home_country})</option>)}
            </select>
          </label>
          <label>{t('lab.amount')} <input type="number" min="0.01" step="0.01" value={form.amount} onChange={set('amount')} /></label>
          <label>{t('lab.country')} <select value={form.country} onChange={set('country')}>{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label>{t('lab.ip')} <select value={form.ip_country} onChange={set('ip_country')}>{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label>{t('lab.channel')} <select value={form.channel} onChange={set('channel')}>{CHANNELS.map((c) => <option key={c} value={c}>{t(`channel.${c}`)}</option>)}</select></label>
          <label>{t('lab.status')} <select value={form.status} onChange={set('status')}>{TX_STATUSES.map((s) => <option key={s} value={s}>{t(`txs.${s}`)}</option>)}</select></label>
          <label className="check"><input type="checkbox" checked={form.payee_new} onChange={set('payee_new')} /> {t('lab.newPayee')}</label>
        </div>
        <button className="btn" disabled={!form.account_id} onClick={() => run(async () => {
          const j = await api.evaluate({ ...form, account_id: Number(form.account_id), amount: Number(form.amount) });
          return t('lab.eval.result', { score: j.risk_score, decision: t(`decision.${j.decision}`), rules: j.alerts.map((a) => a.rule_key).join(', ') || t('lab.none') });
        })}>{t('lab.evaluate')}</button>
      </Card>

      <Card title={t('lab.recent')} className="wide">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('al.col.time')}</th><th>{t('al.col.account')}</th><th>{t('al.col.amount')}</th><th>{t('lab.col.countryIp')}</th>
                <th>{t('lab.channel')}</th><th>{t('lab.status')}</th><th>{t('al.col.risk')}</th><th>{t('lab.col.decision')}</th>
              </tr>
            </thead>
            <tbody>
              {recent.data?.map((x) => (
                <tr key={x.id}>
                  <td>{fmtDate(x.created_at)}</td><td>{x.email}</td><td>{x.amount.toFixed(2)}</td>
                  <td>{x.country} / {x.ip_country}</td><td>{t(`channel.${x.channel}`)}</td><td>{t(`txs.${x.status}`)}</td>
                  <td>{x.risk_score}</td><td>{t(`decision.${x.decision}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
