import { useRef, useMemo, memo } from 'react';
import { fmtDate } from '../utils/dataLoader';

function lerp(a, b, t) { return Math.round(a + (b - a) * t); }
function valueToColor(t) {
  if (t < 0.5) {
    const tt = t * 2;
    return `rgb(255,${lerp(23, 214, tt)},${lerp(68, 0, tt)})`;
  }
  const tt = (t - 0.5) * 2;
  return `rgb(${lerp(255, 0, tt)},${lerp(214, 200, tt)},${lerp(0, 83, tt)})`;
}

const ALL_HOURS = Array.from({ length: 24 }, (_, i) => i);

const HeatmapPanel = memo(function HeatmapPanel({ allDays, onDaySelect }) {
  const tooltipRef = useRef(null);

  const { days, matrix, activeHours, globalMin, globalMax } = useMemo(() => {
    if (!allDays?.length) return { days: [], matrix: [], activeHours: [], globalMin: 0, globalMax: 1 };

    const days = allDays;

    // matrix[h][di] = { avg, count }
    const matrix = ALL_HOURS.map(h =>
      days.map(day => {
        const pts = (day.series ?? []).filter(p => parseInt(p.time.split(':')[0], 10) === h);
        if (!pts.length) return { avg: null, count: 0 };
        const avg = pts.reduce((s, p) => s + p.value, 0) / pts.length;
        return { avg, count: pts.length };
      })
    );

    const activeHours = ALL_HOURS.filter(h => matrix[h].some(cell => cell.avg != null));

    let globalMin = Infinity;
    let globalMax = -Infinity;
    matrix.forEach(row => row.forEach(cell => {
      if (cell.avg != null) {
        if (cell.avg < globalMin) globalMin = cell.avg;
        if (cell.avg > globalMax) globalMax = cell.avg;
      }
    }));
    if (globalMin === Infinity) { globalMin = 0; globalMax = 1; }
    if (globalMin === globalMax) globalMax = globalMin + 1;

    return { days, matrix, activeHours, globalMin, globalMax };
  }, [allDays]);

  if (!days.length) return null;

  const range = globalMax - globalMin;
  const nRows = activeHours.length;

  function handleMouseMove(e) {
    const tip = tooltipRef.current;
    if (!tip) return;
    const cell = e.target.closest('[data-hasdata]');
    if (!cell || cell.dataset.hasdata !== 'true') {
      tip.style.display = 'none';
      return;
    }
    const { day, hour, avg, count } = cell.dataset;
    tip.innerHTML =
      `<span class="hm-minute">${fmtDate(day)} · ${String(hour).padStart(2, '0')}:00</span>` +
      `<span class="hm-avg">${Number(avg).toLocaleString('es-CO')} prom · ${count} registros</span>`;
    const rect = tip.parentElement.getBoundingClientRect();
    tip.style.left = `${e.clientX - rect.left + 14}px`;
    tip.style.top  = `${e.clientY - rect.top  - 10}px`;
    tip.style.display = 'flex';
  }

  function handleMouseLeave() {
    if (tooltipRef.current) tooltipRef.current.style.display = 'none';
  }

  return (
    <div className="chart-card" style={{ position: 'relative' }}>
      <h3 className="chart-title">
        ¿En qué días y horarios hubo mejor o peor disponibilidad?
        <span className="chart-legend heatmap-scale">
          <span style={{ background: valueToColor(0) }} className="hm-scale-dot" /> bajo
          <span style={{ background: valueToColor(0.5) }} className="hm-scale-dot" /> medio
          <span style={{ background: valueToColor(1) }} className="hm-scale-dot" /> alto
        </span>
      </h3>
      <p className="chart-subtitle">Verde = muchas tiendas disponibles. Rojo = pocas tiendas disponibles. Haz clic en una celda para filtrar el dashboard a ese día.</p>

      {/* Tooltip — controlado directamente por DOM, sin setState */}
      <div ref={tooltipRef} className="hm-tooltip" style={{ display: 'none' }} />

      <div
        className="hm2d-outer"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Y-axis labels — only active hours */}
        <div className="hm2d-ylabel" style={{ gridTemplateRows: `repeat(${nRows}, 13px)` }}>
          {activeHours.map(h => (
            <span key={h} className="hm2d-hlabel">
              {h % 3 === 0 ? `${String(h).padStart(2, '0')}h` : ''}
            </span>
          ))}
        </div>

        {/* Cell grid */}
        <div
          className="hm2d-grid"
          style={{
            gridTemplateColumns: `repeat(${days.length}, 1fr)`,
            gridTemplateRows: `repeat(${nRows}, 13px)`,
          }}
        >
          {activeHours.map(h =>
            days.map((day, di) => {
              const cell = matrix[h][di];
              const hasData = cell.avg != null;
              const t = hasData ? (cell.avg - globalMin) / range : null;
              return (
                <div
                  key={`${h}-${di}`}
                  className="hm2d-cell"
                  data-hasdata={hasData ? 'true' : 'false'}
                  data-day={day.date}
                  data-hour={h}
                  data-avg={hasData ? Math.round(cell.avg) : ''}
                  data-count={cell.count}
                  style={{
                    background: hasData ? valueToColor(t) : '#1a1a1a',
                    opacity: hasData ? 1 : 0.4,
                    cursor: hasData ? 'pointer' : 'default',
                  }}
                  onClick={() => hasData && onDaySelect && onDaySelect(day.date)}
                />
              );
            })
          )}
        </div>

        {/* X-axis labels */}
        <div
          className="hm2d-xlabel"
          style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
        >
          {days.map(day => (
            <span key={day.date} className="hm2d-dlabel">{fmtDate(day.date)}</span>
          ))}
        </div>
      </div>

      <p className="chart-subtitle" style={{ marginTop: 8 }}>
        Solo se muestran las horas con datos registrados ({activeHours[0] != null ? `${String(activeHours[0]).padStart(2, '0')}h` : ''}–{activeHours[activeHours.length - 1] != null ? `${String(activeHours[activeHours.length - 1]).padStart(2, '0')}h` : ''}).
      </p>
    </div>
  );
});

export default HeatmapPanel;
