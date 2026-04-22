import { useMemo, memo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { fmtDate, getDayColor, downsample } from '../utils/dataLoader';
import ChartWrapper from './ChartWrapper';

function fmtK(v) {
  if (v == null) return '';
  return v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'k' : String(v);
}

function TooltipComp({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="tt-time">{label}</p>
      {payload.filter(p => p.value != null).slice(0, 6).map((p, i) => (
        <p key={i} className="tt-val" style={{ color: p.color, fontSize: '0.75rem' }}>
          <span className="tt-unit">{fmtDate(p.dataKey)}: </span>{fmtK(p.value)}
        </p>
      ))}
    </div>
  );
}

const ComparativeLineChart = memo(function ComparativeLineChart({ allDays }) {
  // Memoize the heavy merged dataset — 100 pts per day
  const { data, ticks } = useMemo(() => {
    if (!allDays?.length) return { data: [], ticks: [] };

    const allTimes = new Set();
    const dayMap   = {};
    allDays.forEach(day => {
      dayMap[day.date] = {};
      downsample(day.series, 100).forEach(p => {
        allTimes.add(p.time);
        dayMap[day.date][p.time] = p.value;
      });
    });

    const rows = [...allTimes].sort().map(time => {
      const row = { time };
      allDays.forEach(day => { row[day.date] = dayMap[day.date][time] ?? null; });
      return row;
    });

    const n    = Math.min(8, rows.length);
    const step = Math.max(1, Math.floor((rows.length - 1) / Math.max(n - 1, 1)));
    const tks  = rows.filter((_, i) => i % step === 0).map(r => r.time);

    return { data: rows, ticks: tks };
  }, [allDays]);

  if (!allDays?.length) return null;

  return (
    <ChartWrapper minHeight={340} delay={300}>
      <div className="chart-card">
        <h3 className="chart-title">
          Comparación de todos los días — ¿Cuál fue el mejor y el peor?
          <span className="chart-meta">100 pts/día · {allDays.length} días</span>
        </h3>
        <p className="chart-subtitle">Cada línea es un día distinto. Las líneas que caen bruscamente indican incidentes graves. Compara la altura final de cada línea para ver qué días tuvieron mejor disponibilidad.</p>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 8, right: 24, bottom: 0, left: 12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="time" ticks={ticks} tick={{ fill: '#888', fontSize: 10 }} />
            <YAxis tick={{ fill: '#888', fontSize: 10 }} tickFormatter={fmtK} width={46} />
            <Tooltip content={<TooltipComp />} />
            <Legend
              iconType="line" iconSize={12}
              formatter={v => <span style={{ fontSize: 10, color: '#aaa' }}>{fmtDate(v)}</span>}
            />
            {allDays.map((day, i) => (
              <Line key={day.date} type="monotone" dataKey={day.date}
                stroke={getDayColor(i)} strokeWidth={1.5} dot={false}
                connectNulls strokeOpacity={0.85} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartWrapper>
  );
});

export default ComparativeLineChart;
