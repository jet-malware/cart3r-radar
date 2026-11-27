import { useI18n } from '../i18n/index.jsx';

export function Delta({ value, goodWhen = 'down' }) {
  const good = goodWhen === 'down' ? value <= 0 : value >= 0;
  return <span className={`delta ${good ? 'good' : 'bad'}`}>{value > 0 ? '+' : ''}{value}%</span>;
}

export function Card({ title, right, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || right) && <div className="card-head"><h3>{title}</h3>{right}</div>}
      {children}
    </section>
  );
}

export function Severity({ level }) {
  const { t } = useI18n();
  return <span className={`pill sev-${level}`}>{t(`sev.${level}`)}</span>;
}

export function Status({ value }) {
  const { t } = useI18n();
  return <span className={`pill st-${value}`}>{t(`status.${value}`)}</span>;
}

export function ErrorBox({ error }) {
  return error ? <div className="error">⚠ {error}</div> : null;
}
