import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { fmtDate, getDayColor } from '../utils/dataLoader';

function fmtK(v) { return v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1e3 ? (v/1e3).toFixed(0)+'k' : String(v); }

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="chart-tooltip">
      <p className="tt-time">⏰ {d.time}</p>
      <p className="tt-val" style={{ color: '#FF1744' }}>
        −{fmtK(Math.abs(d.magnitude))} <span className="tt-unit">checks caída</span>
      </p>
      {d.date && <p className="tt-sub">{fmtDate(d.date)}</p>}
    </div>
  );
}

export default function IncidentScatter({ days }) {
  if (!days?.length) return null;

  const multiDay = days.length > 1;

  // Build scatter data per day
  const scatterSets = days.map((day, i) => {
    const incidents = day.filteredIncidents ?? day.incidents ?? [];
    return {
      date: day.date,
      color: getDayColor(i),
      data: incidents.map(inc => ({
        time: inc.time,
        hour: inc.hour + (inc.mins % 60) / 60,
        magnitude: Math.abs(inc.delta),
        date: day.date,
      })),
    };
  });

  const allMagnitudes = scatterSets.flatMap(s => s.data.map(d => d.magnitude));
  const maxMag = Math.max(...allMagnitudes, 1);

  // ZAxis: map magnitude to bubble size 20-400
  const zRange = [20, 400];

  return (
    <div className="chart-card">
      <h3 className="chart-title">
        ¿Qué tan graves fueron los incidentes y a qué hora ocurrieron?
        <span className="chart-meta">tamaño = magnitud de caída</span>
      </h3>
      <p className="chart-subtitle">Cada círculo es un incidente. Mientras más grande y más arriba esté, más grave fue la caída. El eje horizontal muestra la hora del día en que ocurrió.</p>
      <ResponsiveContainer width="100%" height={260}>
        <ScatterChart margin={{ top: 8, right: 24, bottom: 0, left: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="hour"
            type="number"
            domain={[6, 24]}
            tickFormatter={v => `${String(Math.floor(v)).padStart(2,'0')}:00`}
            tick={{ fill: '#888', fontSize: 10 }}
            name="Hora"
          />
          <YAxis
            dataKey="magnitude"
            tick={{ fill: '#888', fontSize: 10 }}
            tickFormatter={fmtK}
            width={46}
            name="Magnitud"
          />
          <ZAxis dataKey="magnitude" range={zRange} />
          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
          {multiDay && (
            <Legend
              formatter={v => <span style={{ fontSize: 10, color: '#aaa' }}>{fmtDate(v)}</span>}
            />
          )}
          <ReferenceLine x={12} stroke="rgba(255,255,255,0.1)" />
          {scatterSets.map(s => (
            <Scatter
              key={s.date}
              name={s.date}
              data={s.data}
              fill={s.color}
              fillOpacity={0.7}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
      {scatterSets.every(s => s.data.length === 0) && (
        <p className="chart-empty">Sin incidentes en el rango seleccionado</p>
      )}
    </div>
  );
}
