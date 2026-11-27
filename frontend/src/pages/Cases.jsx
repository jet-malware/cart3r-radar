import { useState } from 'react';
import { api } from '../api.js';
import { useAsync } from '../hooks.js';
import { useUser, can } from '../auth.jsx';
import { useI18n } from '../i18n/index.jsx';
import { Card, ErrorBox, Severity, Status } from '../components/ui.jsx';

function CaseRow({ c, onChange }) {
  const { t, fmtDate } = useI18n();
  const [notes, setNotes] = useState(c.notes);
  const [error, setError] = useState(null);
  const canEdit = can(useUser(), 'analyst');

  const save = async (patch) => {
    setError(null);
    try { await api.updateCase(c.id, { notes, ...patch }); onChange(); } catch (e) { setError(e.message); }
  };

  return (
    <div className="case">
      <div className="case-head">
        <strong>#{c.id} · {t(`cat.${c.category}`)}</strong>
        <Severity level={c.severity} />
        <Status value={c.status} />
        <span className="muted">{c.email} · {fmtDate(c.created_at)}</span>
      </div>
      <p className="muted">{c.reason}</p>
      <ErrorBox error={error} />
      <textarea rows="2" readOnly={!canEdit} placeholder={t('cs.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
      {canEdit && c.status !== 'resolved' && (
        <div className="actions">
          <button className="btn ghost" onClick={() => save({})}>{t('cs.saveNotes')}</button>
          <button className="btn" onClick={() => save({ status: 'resolved' })}>{t('cs.resolveConfirmed')}</button>
          <button className="btn ghost" onClick={() => save({ status: 'resolved', false_positive: true })}>{t('cs.resolveFalse')}</button>
        </div>
      )}
    </div>
  );
}

export default function Cases() {
  const { t } = useI18n();
  const [status, setStatus] = useState('investigating');
  const { data, error, reload } = useAsync(() => api.cases(status), [status]);
  return (
    <Card
      title={t('cs.title')}
      right={
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('cs.all')}</option>
          {['open', 'investigating', 'resolved'].map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
        </select>
      }
    >
      <ErrorBox error={error} />
      {data?.length === 0 && <p className="muted">{t('cs.none')}</p>}
      {data?.map((c) => <CaseRow key={`${c.id}-${c.status}`} c={c} onChange={reload} />)}
    </Card>
  );
}
