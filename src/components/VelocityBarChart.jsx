import { memo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';

function fmtK(v) { return v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1e3 ? (v/1e3).toFixed(0)+'k' : String(v); }

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div className="chart-tooltip">
      <p className="tt-time">{label}h</p>
      <p className="tt-val" style={{ color: v < 0 ? '#FF1744' : '#FF441F' }}>
        {v > 0 ? '+' : ''}{fmtK(v)} <span className="tt-unit">checks neto/hora</span>
      </p>
      {payload[0].payload.hasIncident && (
        <p className="tt-incident">⚠ Incidentes en esta hora</p>
      )}
    </div>
  );
}

const VelocityBarChart = memo(function VelocityBarChart({ hourlyVelocity }) {
  if (!hourlyVelocity?.length) return null;

  return (
    <div className="chart-card">
      <h3 className="chart-title">¿En qué horas del día hubo más problemas?</h3>
      <p className="chart-subtitle">Barras naranjas = la disponibilidad subió esa hora. Amarillas = subió pero hubo incidentes. Rojas = hubo más caídas que subidas — hora problemática.</p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={hourlyVelocity} margin={{ top: 8, right: 16, bottom: 0, left: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="label" tick={{ fill: '#888', fontSize: 10 }} />
          <YAxis tick={{ fill: '#888', fontSize: 10 }} tickFormatter={fmtK} width={46} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
          <Bar dataKey="netDelta" radius={[3, 3, 0, 0]}>
            {hourlyVelocity.map((entry, i) => (
              <Cell
                key={i}
                fill={
                  entry.netDelta < 0
                    ? '#FF1744'
                    : entry.hasIncident
                    ? '#FFD600'
                    : 'rgba(255,68,31,0.7)'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="chart-legend-row">
        <span><span className="leg-dot" style={{ background: 'rgba(255,68,31,0.7)' }} />Normal</span>
        <span><span className="leg-dot" style={{ background: '#FFD600' }} />Con incidentes</span>
        <span><span className="leg-dot" style={{ background: '#FF1744' }} />Caída neta</span>
      </div>
    </div>
  );
});

export default VelocityBarChart;
