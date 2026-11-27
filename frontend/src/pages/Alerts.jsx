import { useState } from 'react';
import { api } from '../api.js';
import { useAsync } from '../hooks.js';
import { useUser, can } from '../auth.jsx';
import { useI18n } from '../i18n/index.jsx';
import { Card, ErrorBox, Severity, Status } from '../components/ui.jsx';

const STATUSES = ['', 'open', 'investigating', 'resolved', 'false_positive'];

export default function Alerts() {
  const { t, fmt, fmtDate } = useI18n();
  const [status, setStatus] = useState('');
  const [offset, setOffset] = useState(0);
  const canEdit = can(useUser(), 'analyst');
  const limit = 25;
  const { data, error, loading, reload } = useAsync(() => api.alerts({ status, limit, offset }), [status, offset]);
  const [actionError, setActionError] = useState(null);
  const [notice, setNotice] = useState(null);       // { text, toCases }

  const act = async (fn, makeNotice) => {
    setActionError(null); setNotice(null);
    try { const r = await fn(); setNotice(makeNotice(r)); reload(); } catch (e) { setActionError(e.message); }
  };

  return (
    <Card
      title={`${t('al.title')}${data ? ` (${fmt(data.total)})` : ''}`}
      right={
        <select value={status} onChange={(e) => { setStatus(e.target.value); setOffset(0); }}>
          {STATUSES.map((s) => <option key={s} value={s}>{s ? t(`status.${s}`) : t('al.allStatuses')}</option>)}
        </select>
      }
    >
      <details className="help">
        <summary>{t('al.help.title')}</summary>
        <ol>
          <li>{t('al.help.1')}</li><li>{t('al.help.2')}</li><li>{t('al.help.3')}</li>
          <li>{t('al.help.4')}</li><li>{t('al.help.5')}</li>
        </ol>
        <p className="muted">{t('al.help.note')}</p>
        <p className="muted">{t('al.help.doc')}</p>
      </details>
      <ErrorBox error={error || actionError} />
      {notice && (
        <p className="ok">
          {notice.text}{' '}
          {notice.toCases && <button className="btn" onClick={() => { window.location.hash = 'cases'; }}>{t('al.goCases')}</button>}
        </p>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t('al.col.time')}</th><th>{t('al.col.account')}</th><th>{t('al.col.category')}</th><th>{t('al.col.reason')}</th>
              <th>{t('al.col.amount')}</th><th>{t('al.col.risk')}</th><th>{t('al.col.severity')}</th><th>{t('al.col.status')}</th><th />
            </tr>
          </thead>
          <tbody>
            {data?.items.map((a) => (
              <tr key={a.id}>
                <td>{fmtDate(a.created_at)}</td>
                <td>{a.email}</td>
                <td>{t(`cat.${a.category}`)}</td>
                <td>{a.reason}</td>
                <td>{a.amount.toFixed(2)} {a.currency}</td>
                <td>{a.risk_score}</td>
                <td><Severity level={a.severity} /></td>
                <td><Status value={a.status} /></td>
                <td className="actions">
                  {canEdit && !a.case_id && <button className="btn" onClick={() => act(() => api.openCase(a.id), (r) => ({ text: t('al.caseOpened', { id: r.id }), toCases: true }))}>{t('al.openCase')}</button>}
                  {canEdit && a.status !== 'false_positive' && <button className="btn ghost" onClick={() => act(() => api.setAlertStatus(a.id, 'false_positive'), () => ({ text: t('al.markedFalse') }))}>{t('al.falsePos')}</button>}
                </td>
              </tr>
            ))}
            {data && !data.items.length && <tr><td colSpan="9" className="muted">{t('al.none')}</td></tr>}
          </tbody>
        </table>
      </div>
      {loading && <p className="muted">{t('common.loading')}</p>}
      <div className="pager">
        <button className="btn ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>{t('al.prev')}</button>
        <button className="btn ghost" disabled={!data || offset + limit >= data.total} onClick={() => setOffset(offset + limit)}>{t('al.next')}</button>
      </div>
    </Card>
  );
}
