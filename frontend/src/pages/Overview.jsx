import { useState } from 'react';
import { api } from '../api.js';
import { useAsync } from '../hooks.js';
import { useI18n } from '../i18n/index.jsx';
import { AreaChart, BarChart } from '../components/Charts.jsx';
import { Card, Delta, ErrorBox } from '../components/ui.jsx';

const CATEGORIES = ['Phishing', 'Identity Theft', 'Card Fraud', 'Account Takeover'];

export default function Overview() {
  const { t, fmt, monthLabel } = useI18n();
  const [selected, setSelected] = useState(CATEGORIES);
  // All four categories = no filter.
  const filter = selected.length === CATEGORIES.length ? undefined : selected;
  const ov = useAsync(() => api.overview(filter), [selected]);
  const fp = useAsync(() => api.falsePositives(filter), [selected]);

  const toggle = (c) => setSelected((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));

  const k = ov.data?.kpis;
  const tiles = k && [
    ['ov.kpi.alerts', k.fraud_alerts, 'down'],
    ['ov.kpi.tx', k.transactions, 'up'],
    ['ov.kpi.accounts', k.suspicious_accounts, 'down'],
    ['ov.kpi.resolved', k.resolved_cases, 'up'],
  ];
  const months = ov.data?.monthly_alerts.series.map((p) => ({ ...p, label: monthLabel(p.label) }));

  return (
    <div className="layout">
      <div>
        <h1>{t('ov.title')}</h1>
        <p className="muted">{t('ov.subtitle')}</p>
        <ErrorBox error={ov.error} />
        <div className="kpis">
          {tiles?.map(([key, m, good]) => (
            <Card key={key} title={t(key)}>
              <div className="kpi">{fmt(m.value)}</div>
              <Delta value={m.change} goodWhen={good} />
            </Card>
          ))}
        </div>

        <h2>{t('ov.analysis')}</h2>
        {ov.data && (
          <div className="charts">
            <Card title={t('ov.daily')}>
              <div className="kpi">{fmt(ov.data.daily_transactions.total)} <Delta value={ov.data.daily_transactions.change} goodWhen="up" /></div>
              <AreaChart series={ov.data.daily_transactions.series} />
            </Card>
            <Card title={t('ov.monthly')}>
              <div className="kpi">{fmt(ov.data.monthly_alerts.total)} <Delta value={ov.data.monthly_alerts.change} goodWhen="down" /></div>
              <BarChart series={months} />
            </Card>
          </div>
        )}
      </div>

      <aside>
        <Card title={t('ov.categories')}>
          {CATEGORIES.map((c) => (
            <label key={c} className="check">
              <input type="checkbox" checked={selected.includes(c)} onChange={() => toggle(c)} />
              <span>{t(`cat.${c}`)}</span>
            </label>
          ))}
        </Card>
        <Card title={t('ov.fp')}>
          <ErrorBox error={fp.error} />
          {fp.data?.length === 0 && <p className="muted">{t('ov.fpNone')}</p>}
          {fp.data?.map((r) => (
            <div key={r.key} className="fp">
              <strong>{r.name}</strong>
              <span className="muted">{t(`cat.${r.category}`)}</span>
              <span className="count">{r.count}</span>
            </div>
          ))}
        </Card>
      </aside>
    </div>
  );
}
