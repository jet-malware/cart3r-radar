// Dependency-free SVG charts matching the dark / lime theme.
import { useI18n } from '../i18n/index.jsx';
const W = 520, H = 220, PAD = { l: 38, r: 10, t: 10, b: 24 };

function scale(values) {
  const m = Math.max(1, ...values);
  const pow = 10 ** Math.floor(Math.log10(m));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * pow).find((k) => k * 4 >= m);
  return { max: step * 4, ticks: [0, 0.25, 0.5, 0.75, 1] };
}

function Axes({ max, ticks, labels }) {
  const ih = H - PAD.t - PAD.b;
  return (
    <>
      {ticks.map((t) => {
        const y = PAD.t + ih * (1 - t);
        return (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} className="grid" />
            <text x={PAD.l - 6} y={y + 3} textAnchor="end" className="tick">{Math.round(max * t)}</text>
          </g>
        );
      })}
      {labels.map(([x, text]) => (
        <text key={text + x} x={x} y={H - 6} textAnchor="middle" className="tick">{text}</text>
      ))}
    </>
  );
}

export function AreaChart({ series, label }) {
  const { t } = useI18n();
  const values = series.map((p) => p.value);
  const { max, ticks } = scale(values);
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const x = (i) => PAD.l + (iw * i) / Math.max(1, series.length - 1);
  const y = (v) => PAD.t + ih * (1 - v / max);
  const line = series.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' ');
  const area = `${line} L${x(series.length - 1)},${PAD.t + ih} L${x(0)},${PAD.t + ih} Z`;
  const pick = [0, Math.floor(series.length / 2), series.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label ?? t('ov.daily')}>
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--lime)" stopOpacity="0.45" />
          <stop offset="1" stopColor="var(--lime)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <Axes max={max} ticks={ticks} labels={pick.map((i) => [x(i), series[i].label.slice(5)])} />
      <path d={area} fill="url(#areaFill)" />
      <path d={line} className="line" />
      {series.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.value)} r="6" fill="transparent"><title>{`${p.label}: ${p.value}`}</title></circle>)}
    </svg>
  );
}

export function BarChart({ series, label }) {
  const { t } = useI18n();
  const { max, ticks } = scale(series.map((p) => p.value));
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const slot = iw / series.length, bw = slot * 0.55;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label ?? t('ov.monthly')}>
      <Axes max={max} ticks={ticks} labels={series.map((p, i) => [PAD.l + slot * i + slot / 2, p.label])} />
      {series.map((p, i) => {
        const h = (ih * p.value) / max;
        return (
          <rect key={p.label} x={PAD.l + slot * i + (slot - bw) / 2} y={PAD.t + ih - h} width={bw} height={h} rx="3" className="bar">
            <title>{`${p.label}: ${p.value}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}
