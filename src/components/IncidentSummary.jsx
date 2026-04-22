import { useMemo, memo } from 'react';
import { fmtDate } from '../utils/dataLoader';

const IncidentSummary = memo(function IncidentSummary({ selectedDays }) {
  const summary = useMemo(() => {
    if (!selectedDays?.length) return null;

    // Gather all incidents
    const total = selectedDays.flatMap(day =>
      day.filteredIncidents ?? day.incidents ?? []
    );

    if (!total.length) return { empty: true };

    // Worst hour (most incidents)
    const hourCounts = {};
    total.forEach(inc => {
      const h = String(Math.floor(inc.mins / 60)).padStart(2, '0');
      const label = `${h}:00`;
      hourCounts[label] = (hourCounts[label] ?? 0) + 1;
    });
    const worstHourEntry = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
    const worstHour = worstHourEntry
      ? { label: worstHourEntry[0], count: worstHourEntry[1] }
      : null;

    // Worst recovery day (highest max durationMins)
    let worstRecovery = null;
    selectedDays.forEach(day => {
      const incs = day.filteredIncidents ?? day.incidents ?? [];
      const durations = incs.map(i => i.durationMins).filter(d => d != null);
      if (!durations.length) return;
      const maxDur = Math.max(...durations);
      if (!worstRecovery || maxDur > worstRecovery.maxDur) {
        worstRecovery = { date: day.date, maxDur };
      }
    });

    // Trend — only if >= 3 days
    let trend = null;
    if (selectedDays.length >= 3) {
      const counts = selectedDays.map(day =>
        (day.filteredIncidents ?? day.incidents ?? []).length
      );
      const mid = Math.floor(counts.length / 2);
      const firstHalf  = counts.slice(0, mid);
      const secondHalf = counts.slice(counts.length - mid);
      const firstAvg  = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;
      if (secondAvg < firstAvg * 0.8)       trend = 'mejorando';
      else if (secondAvg > firstAvg * 1.2)  trend = 'empeorando';
      else                                   trend = 'estable';
    }

    return { empty: false, total, worstHour, worstRecovery, trend };
  }, [selectedDays]);

  if (!summary) return null;

  const trendColor = {
    mejorando:  'var(--green)',
    empeorando: 'var(--red)',
    estable:    'var(--yellow)',
  };

  return (
    <div className="summary-card">
      <h3 className="chart-title" style={{ marginBottom: 14 }}>
        Resumen del período seleccionado
      </h3>

      {summary.empty ? (
        <p className="summary-empty">Sin incidentes en el período seleccionado</p>
      ) : (
        <div className="summary-items">

          {/* Total incidents */}
          <div className="summary-item">
            <span className="summary-icon">⚡</span>
            <div>
              <div className="summary-label">Total de incidentes</div>
              <div className="summary-value">{summary.total.length.toLocaleString('es-CO')}</div>
              <div className="summary-sub">en {selectedDays.length} día{selectedDays.length !== 1 ? 's' : ''}</div>
            </div>
          </div>

          {/* Worst hour */}
          {summary.worstHour && (
            <div className="summary-item">
              <span className="summary-icon">🕐</span>
              <div>
                <div className="summary-label">Hora con más incidentes</div>
                <div className="summary-value">{summary.worstHour.label}</div>
                <div className="summary-sub">{summary.worstHour.count} incidente{summary.worstHour.count !== 1 ? 's' : ''}</div>
              </div>
            </div>
          )}

          {/* Worst recovery */}
          {summary.worstRecovery && (
            <div className="summary-item">
              <span className="summary-icon">🔁</span>
              <div>
                <div className="summary-label">Recuperación más lenta</div>
                <div className="summary-value">{fmtDate(summary.worstRecovery.date)}</div>
                <div className="summary-sub">{summary.worstRecovery.maxDur} min máx.</div>
              </div>
            </div>
          )}

          {/* Trend */}
          {summary.trend && (
            <div className="summary-item">
              <span className="summary-icon">📈</span>
              <div>
                <div className="summary-label">Tendencia del período</div>
                <div className="summary-value" style={{ color: trendColor[summary.trend] }}>
                  {summary.trend.charAt(0).toUpperCase() + summary.trend.slice(1)}
                </div>
                <div className="summary-sub">primera vs. segunda mitad</div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
});

export default IncidentSummary;
