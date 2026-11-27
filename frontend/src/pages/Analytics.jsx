import { useState } from 'react';
import { api } from '../api.js';
import { useAsync } from '../hooks.js';
import { useI18n } from '../i18n/index.jsx';
import { AreaChart, BarChart } from '../components/Charts.jsx';
import { Card, Delta, ErrorBox } from '../components/ui.jsx';

const CATEGORIES = ['Phishing', 'Identity Theft', 'Card Fraud', 'Account Takeover'];
const STATUSES = ['open', 'investigating', 'resolved', 'false_positive'];
const iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => iso(new Date(Date.now() - n * 86_400_000));
const MIN_DECIDED = 5;   // below this many decided alerts a rule's precision is not meaningful

function Checks({ all, selected, onChange, label }) {
  const toggle = (v) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  return (
    <div className="filter-group">
      {all.map((v) => (
        <label key={v} className="check">
          <input type="checkbox" checked={selected.includes(v)} onChange={() => toggle(v)} />
          <span>{label(v)}</span>
        </label>
      ))}
    </div>
  );
}

export default function Analytics() {
  const { t, fmt, lang } = useI18n();
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(daysAgo(0));
  const [cats, setCats] = useState([]);       // empty = no filter
  const [statuses, setStatuses] = useState([]);
  const [rule, setRule] = useState('');
  const [country, setCountry] = useState('');
  const [channel, setChannel] = useState('');

  const params = { from, to, categories: cats.join(','), statuses: statuses.join(','), rules: rule, countries: country, channels: channel };
  const { data, error, loading } = useAsync(() => api.analytics(params), [from, to, cats, statuses, rule, country, channel]);

  const preset = (n) => { setFrom(daysAgo(n - 1)); setTo(daysAgo(0)); };
  const reset = () => { preset(30); setCats([]); setStatuses([]); setRule(''); setCountry(''); setChannel(''); };

  const locale = lang === 'ru' ? 'ru-RU' : 'en-GB';
  const weekdays = data?.weekdays.map((w) => ({
    ...w,
    label: new Date(Date.UTC(2024, 0, w.key === 0 ? 7 : w.key)).toLocaleString(locale, { weekday: 'short', timeZone: 'UTC' }),
  }));
  const T = data?.totals;
  const usd = (n) => `$${fmt(Math.round(n))}`;
  const hint = (r) => {
    if (r.false_positive + r.confirmed < MIN_DECIDED) return <span className="muted">{t('an.hint.few')}</span>;
    if (r.precision < 30) return <span className="bad-text">{t('an.hint.loose')}</span>;
    if (r.precision >= 70) return <span className="good-text">{t('an.hint.good')}</span>;
    return <span className="muted">{t('an.hint.ok')}</span>;
  };

  return (
    <div>
      <h1>{t('an.title')}</h1>
      <p className="muted">{t('an.subtitle')}</p>

      <Card title={t('an.filters')} right={<button className="btn ghost" onClick={reset}>{t('an.reset')}</button>}>
        <div className="filter-row">
          <button className="btn ghost" onClick={() => preset(7)}>{t('an.p7')}</button>
          <button className="btn ghost" onClick={() => preset(30)}>{t('an.p30')}</button>
          <button className="btn ghost" onClick={() => preset(90)}>{t('an.p90')}</button>
          <label>{t('an.from')} <input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} /></label>
          <label>{t('an.to')} <input type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} /></label>
        </div>
        <div className="filter-row">
          <select value={rule} onChange={(e) => setRule(e.target.value)}>
            <option value="">{t('an.allRules')}</option>
            {data?.options.rules.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
          </select>
          <select value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">{t('an.allCountries')}</option>
            {data?.options.countries.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="">{t('an.allChannels')}</option>
            {data?.options.channels.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="filter-row">
          <strong className="muted">{t('an.categories')}</strong>
          <Checks all={CATEGORIES} selected={cats} onChange={setCats} label={(c) => t(`cat.${c}`)} />
        </div>
        <div className="filter-row">
          <strong className="muted">{t('an.statuses')}</strong>
          <Checks all={STATUSES} selected={statuses} onChange={setStatuses} label={(s) => t(`status.${s}`)} />
        </div>
        <p className="muted">{t('an.filterNote')}</p>
      </Card>

      <ErrorBox error={error} />
      {loading && !data && <p className="muted">{t('common.loading')}</p>}

      {data && (
        <>
          <div className="kpis">
            <Card title={t('an.kpi.alerts')}>
              <div className="kpi">{fmt(T.alerts)}</div><Delta value={data.changes.alerts} goodWhen="down" />
            </Card>
            <Card title={t('an.kpi.confirmed')}>
              <div className="kpi">{fmt(T.confirmed)}</div><Delta value={data.changes.confirmed} goodWhen="up" />
            </Card>
            <Card title={t('an.kpi.false')}>
              <div className="kpi">{fmt(T.false_positive)}</div><Delta value={data.changes.false_positive} goodWhen="down" />
            </Card>
            <Card title={t('an.kpi.precision')}>
              <div className="kpi">{T.precision == null ? '—' : `${T.precision}%`}</div>
              <span className="muted">{t('an.kpi.precisionHint')}</span>
            </Card>
            <Card title={t('an.kpi.flagged')}><div className="kpi">{usd(T.amount_flagged)}</div></Card>
            <Card title={t('an.kpi.fraudAmount')}><div className="kpi">{usd(T.amount_confirmed)}</div></Card>
            <Card title={t('an.kpi.time')}>
              <div className="kpi">{T.avg_resolve_hours == null ? '—' : t('an.hours', { n: fmt(T.avg_resolve_hours) })}</div>
            </Card>
            <Card title={t('an.kpi.pending')}><div className="kpi">{fmt(T.pending)}</div></Card>
          </div>
          <p className="muted">{t('an.compare', { from: data.range.from, to: data.range.to, days: data.range.days })}</p>

          <h2>{t('an.rulesTitle')}</h2>
          <Card>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('an.col.rule')}</th><th>{t('al.col.category')}</th><th>{t('an.col.alerts')}</th>
                    <th>{t('an.col.confirmed')}</th><th>{t('an.col.false')}</th><th>{t('an.col.pending')}</th>
                    <th>{t('an.col.precision')}</th><th>{t('an.col.hint')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rules.map((r) => (
                    <tr key={r.key}>
                      <td>{r.name}</td><td>{t(`cat.${r.category}`)}</td><td>{fmt(r.alerts)}</td>
                      <td>{fmt(r.confirmed)}</td><td>{fmt(r.false_positive)}</td><td>{fmt(r.pending)}</td>
                      <td>{r.precision == null ? '—' : `${r.precision}%`}</td><td>{hint(r)}</td>
                    </tr>
                  ))}
                  {!data.rules.length && <tr><td colSpan="8" className="muted">{t('an.none')}</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>

          <h2>{t('an.trends')}</h2>
          <div className="charts">
            <Card title={t('an.chart.daily')}><AreaChart series={data.daily} label={t('an.chart.daily')} /></Card>
            <Card title={t('an.chart.hours')}><BarChart series={data.hours} label={t('an.chart.hours')} /></Card>
            <Card title={t('an.chart.weekdays')}><BarChart series={weekdays} label={t('an.chart.weekdays')} /></Card>
          </div>

          <h2>{t('an.where')}</h2>
          <div className="two-col">
            {[['an.countries', data.countries], ['an.channels', data.channels]].map(([key, rows]) => (
              <Card key={key} title={t(key)}>
                {!rows.length && <p className="muted">{t('an.none')}</p>}
                {rows.map((r) => (
                  <div key={r.k} className="fp">
                    <strong>{r.k}</strong>
                    <span className="muted">{t('an.fpShort', { n: fmt(r.false_positive) })} · {t('an.confShort', { n: fmt(r.confirmed) })}</span>
                    <span className="count">{fmt(r.alerts)}</span>
                  </div>
                ))}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
