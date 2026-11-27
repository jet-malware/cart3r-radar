import { useState } from 'react';
import { api } from '../api.js';
import { useAsync } from '../hooks.js';
import { useUser, can } from '../auth.jsx';
import { useI18n } from '../i18n/index.jsx';
import { Card, ErrorBox, Severity } from '../components/ui.jsx';

function RuleRow({ rule, onChange }) {
  const { t } = useI18n();
  const [threshold, setThreshold] = useState(rule.threshold);
  const [weight, setWeight] = useState(rule.weight);
  const [error, setError] = useState(null);
  const canEdit = can(useUser(), 'admin');

  const save = async (patch) => {
    setError(null);
    try { await api.updateRule(rule.id, patch); onChange(); } catch (e) { setError(e.message); }
  };

  return (
    <tr className={rule.enabled ? '' : 'disabled'}>
      <td><input type="checkbox" checked={!!rule.enabled} disabled={!canEdit} onChange={(e) => save({ enabled: e.target.checked })} aria-label={t('rl.enable', { name: rule.name })} /></td>
      <td><strong>{rule.name}</strong><div className="muted">{rule.description}</div><ErrorBox error={error} /></td>
      <td>{t(`cat.${rule.category}`)}</td>
      <td><Severity level={rule.severity} /></td>
      <td><input type="number" min="1" value={threshold} disabled={!canEdit} onChange={(e) => setThreshold(e.target.value)} /></td>
      <td><input type="number" min="1" max="100" value={weight} disabled={!canEdit} onChange={(e) => setWeight(e.target.value)} /></td>
      <td>{canEdit && <button className="btn" onClick={() => save({ threshold: Number(threshold), weight: Number(weight) })}>{t('rl.save')}</button>}</td>
    </tr>
  );
}

export default function Rules() {
  const { t } = useI18n();
  const { data, error, reload } = useAsync(() => api.rules(), []);
  return (
    <Card title={t('rl.title')}>
      <p className="muted">{t('rl.intro')}</p>
      <ErrorBox error={error} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t('rl.col.on')}</th><th>{t('rl.col.rule')}</th><th>{t('rl.col.category')}</th><th>{t('rl.col.severity')}</th>
              <th>{t('rl.col.threshold')}</th><th>{t('rl.col.weight')}</th><th />
            </tr>
          </thead>
          <tbody>{data?.map((r) => <RuleRow key={`${r.id}-${r.threshold}-${r.weight}-${r.enabled}`} rule={r} onChange={reload} />)}</tbody>
        </table>
      </div>
    </Card>
  );
}
