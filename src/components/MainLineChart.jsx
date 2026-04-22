import { useMemo, memo, useState } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { fmtDate, getDayColor, downsample } from '../utils/dataLoader';

function fmtK(v) {
  if (v == null) return '';
  return v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'k' : String(v);
}

const BAND_KEYS = new Set(['bandHigh', 'bandLow', 'outOfBandVal']);

function Tooltip1({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  // Filter out band series — they saturate el tooltip sin aportar información útil
  const visible = payload.filter(p => p.value != null && !BAND_KEYS.has(p.dataKey));
  if (!visible.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="tt-time">{label}</p>
      {visible.map((p, i) => (
        <p key={i} className="tt-val" style={{ color: p.color }}>
          {p.dataKey !== 'value' && (
            <span className="tt-unit">
              {p.name || fmtDate(p.dataKey) || p.dataKey}:{' '}
            </span>
          )}
          {fmtK(p.value)} <span className="tt-unit">checks</span>
        </p>
      ))}
    </div>
  );
}

const MainLineChart = memo(function MainLineChart({ days, compareMode, averagedSeries, allDays }) {
  const primaryDay = days?.[0];
  const multiDay   = days?.length > 1;
  const [showBand, setShowBand] = useState(false);

  // Single/averaged data: downsample to 250 pts
  const singleData = useMemo(() => {
    if (!averagedSeries?.length) return [];
    return downsample(averagedSeries, 250);
  }, [averagedSeries]);

  const singleTicks = useMemo(() => {
    const n = Math.min(8, singleData.length);
    return Array.from({ length: n }, (_, i) =>
      singleData[Math.round(i * (singleData.length - 1) / Math.max(n - 1, 1))]?.time
    ).filter(Boolean);
  }, [singleData]);

  // Anomaly band — only for single-day non-compare mode
  const bandData = useMemo(() => {
    if (multiDay || !allDays?.length || !singleData.length) return null;

    // Build a map of time → values across ALL days
    const timeValMap = new Map();
    allDays.forEach(day => {
      (day.series ?? []).forEach(p => {
        const arr = timeValMap.get(p.time) ?? [];
        arr.push(p.value);
        timeValMap.set(p.time, arr);
      });
    });

    return singleData.map(p => {
      const vals = timeValMap.get(p.time) ?? [p.value];
      const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
      const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
      const std = Math.sqrt(variance);
      const bandLow  = Math.max(0, mean - std);
      const bandHigh = mean + std;
      const outOfBand = p.value < bandLow || p.value > bandHigh;
      return { ...p, bandLow, bandHigh, outOfBand, outOfBandVal: p.value };
    });
  }, [multiDay, allDays, singleData]);

  // Compare data: 150 pts per day merged
  const compareData = useMemo(() => {
    if (!compareMode || !days?.length) return null;
    const allTimes = new Set();
    const dayMap = {};
    days.forEach(day => {
      dayMap[day.date] = {};
      downsample(day.series, 150).forEach(p => {
        allTimes.add(p.time);
        dayMap[day.date][p.time] = p.value;
      });
    });
    return [...allTimes].sort().map(time => {
      const row = { time };
      days.forEach(day => { row[day.date] = dayMap[day.date][time] ?? null; });
      return row;
    });
  }, [days, compareMode]);

  const compareTicks = useMemo(() => {
    if (!compareData) return [];
    const n = Math.min(8, compareData.length);
    return Array.from({ length: n }, (_, i) =>
      compareData[Math.round(i * (compareData.length - 1) / Math.max(n - 1, 1))]?.time
    ).filter(Boolean);
  }, [compareData]);

  if (!days?.length) return null;

  if (!compareMode) {
    const chartData = (showBand && bandData) ? bandData : singleData;
    return (
      <div className="chart-card">
        <h3 className="chart-title">
          ¿Cómo estuvo la disponibilidad de tiendas durante el día? — {multiDay ? `promedio ${days.length} días` : fmtDate(primaryDay.date)}
          {!multiDay && (
            <button
              className={`btn-band-toggle${showBand ? ' active' : ''}`}
              onClick={() => setShowBand(v => !v)}
            >
              Mostrar zona normal
            </button>
          )}
          <span className="chart-meta">{singleData.length} registros · acumulado</span>
        </h3>
        <p className="chart-subtitle">Cada punto es una medición por minuto. La curva sube durante el día — las caídas abruptas indican incidentes. La zona azul sombreada representa el comportamiento normal histórico.</p>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 24, bottom: 0, left: 12 }}>
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#FF441F" stopOpacity={0.22} />
                <stop offset="95%" stopColor="#FF441F" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="time" ticks={singleTicks} tick={{ fill: '#888', fontSize: 11 }} />
            <YAxis tick={{ fill: '#888', fontSize: 11 }} tickFormatter={fmtK} width={46} />
            <Tooltip content={<Tooltip1 />} />
            <ReferenceLine y={primaryDay.stats.avg} stroke="#2979FF" strokeDasharray="5 3"
              label={{ value: 'Prom', fill: '#2979FF', fontSize: 10, position: 'insideTopLeft' }} />

            {/* Anomaly band — rendered BEFORE main Area (underneath) */}
            {showBand && bandData && <>
              <Area type="monotone" dataKey="bandHigh" stroke="rgba(41,121,255,0.35)" strokeWidth={1}
                strokeDasharray="4 2" fill="rgba(41,121,255,0.12)" fillOpacity={1} dot={false} activeDot={false} legendType="none" />
              <Area type="monotone" dataKey="bandLow" stroke="rgba(41,121,255,0.35)" strokeWidth={1}
                strokeDasharray="4 2" fill="#1A1A1A" fillOpacity={1} dot={false} activeDot={false} legendType="none" />
            </>}

            <Area type="monotone" dataKey="value" stroke="#FF441F" strokeWidth={2}
              fill="url(#areaGrad)" dot={false}
              activeDot={{ r: 4, fill: '#FF441F', stroke: '#fff', strokeWidth: 2 }} />

            {/* Out-of-band red dots */}
            {showBand && bandData && (
              <Line type="monotone" dataKey="outOfBandVal" stroke="none"
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  if (!payload?.outOfBand) return <g key={props.index} />;
                  return <circle key={props.index} cx={cx} cy={cy} r={3} fill="#FF1744" stroke="#FF1744" />;
                }}
                activeDot={false} legendType="none" />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="chart-card">
      <h3 className="chart-title">
        ¿Cómo estuvo la disponibilidad de tiendas durante el día? — comparación
        <span className="chart-meta">{days.length} días · 150 pts/línea</span>
      </h3>
      <p className="chart-subtitle">Cada línea de color es un día distinto. Las caídas abruptas indican incidentes. Compara la forma de las curvas para detectar patrones comunes.</p>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={compareData} margin={{ top: 8, right: 24, bottom: 0, left: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="time" ticks={compareTicks} tick={{ fill: '#888', fontSize: 11 }} />
          <YAxis tick={{ fill: '#888', fontSize: 11 }} tickFormatter={fmtK} width={46} />
          <Tooltip content={<Tooltip1 />} />
          <Legend formatter={v => <span style={{ fontSize: 11, color: '#ccc' }}>{fmtDate(v)}</span>} />
          {days.map((day, i) => (
            <Line key={day.date} type="monotone" dataKey={day.date}
              stroke={getDayColor(i)} strokeWidth={1.5} dot={false} connectNulls
              activeDot={{ r: 3 }} />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
});

export default MainLineChart;
