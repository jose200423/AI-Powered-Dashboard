import { useState, useMemo, memo } from 'react';
import { fmtDate } from '../utils/dataLoader';

const PAGE_SIZE = 50;

function fmtK(v) {
  const a = Math.abs(v);
  return a >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : a >= 1e3 ? (v / 1e3).toFixed(1) + 'k' : String(v);
}

function fmtDur(mins) {
  if (mins == null) return 'N/A';
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

const IncidentsTable = memo(function IncidentsTable({ days }) {
  const [sortField, setSortField] = useState('date');
  const [sortDir,   setSortDir]   = useState('asc');
  const [visible,   setVisible]   = useState(PAGE_SIZE);  // rows currently shown

  // Flatten all incidents — memoized
  const allIncidents = useMemo(() => {
    if (!days?.length) return [];
    return days.flatMap(day => {
      const inc = day.filteredIncidents ?? day.incidents ?? [];
      return inc.map(i => ({ ...i, dayDate: day.date }));
    });
  }, [days]);

  // Sort — memoized
  const sorted = useMemo(() => {
    return [...allIncidents].sort((a, b) => {
      let va, vb;
      if      (sortField === 'delta') { va = a.delta;                    vb = b.delta; }
      else if (sortField === 'time')  { va = a.time;                     vb = b.time; }
      else if (sortField === 'date')  { va = a.dayDate;                  vb = b.dayDate; }
      else if (sortField === 'dur')   { va = a.durationMins ?? 99999;    vb = b.durationMins ?? 99999; }
      else return 0;
      const primary = sortDir === 'asc' ? (va < vb ? -1 : va > vb ? 1 : 0) : (va > vb ? -1 : va < vb ? 1 : 0);
      // Secondary sort: if same day, order by time
      if (primary === 0 && sortField === 'date') return a.time < b.time ? -1 : 1;
      return primary;
    });
  }, [allIncidents, sortField, sortDir]);

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
    setVisible(PAGE_SIZE);  // reset to first page on sort change
  }

  const pageItems  = sorted.slice(0, visible);
  const hasMore    = visible < sorted.length;
  const remaining  = sorted.length - visible;

  if (!days?.length) return null;

  const Th = ({ field, children }) => (
    <th
      className={`sortable ${sortField === field ? 'active' : ''}`}
      onClick={() => toggleSort(field)}
    >
      {children}{sortField === field ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  );

  return (
    <div className="chart-card">
      <div className="table-header-row">
        <h3 className="chart-title">Registro detallado de caídas — ¿Qué pasó, cuándo y cuánto duró?</h3>
        <span className="table-count">{allIncidents.length} total</span>
      </div>
      <p className="chart-subtitle">Verde = se recuperó en menos de 30 minutos. Rojo = la caída duró más de 30 minutos. Haz clic en los encabezados para ordenar.</p>

      <div className="table-wrapper">
        <table className="anomaly-table">
          <thead>
            <tr>
              <Th field="date">Fecha</Th>
              <Th field="time">Hora</Th>
              <th>Antes</th>
              <th>Después</th>
              <Th field="delta">Caída ↑</Th>
              <Th field="dur">Duración est.</Th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((inc, i) => (
              <tr key={`${inc.dayDate}-${inc.time}-${i}`}
                className={Math.abs(inc.delta) > 100_000 ? 'worst' : ''}>
                <td>{fmtDate(inc.dayDate)}</td>
                <td>{inc.time}</td>
                <td>{fmtK(inc.prevValue)}</td>
                <td>{fmtK(inc.value)}</td>
                <td><span className="delta-badge">{fmtK(inc.delta)}</span></td>
                <td style={{
                  color: inc.durationMins == null ? '#555'
                    : inc.durationMins > 30 ? '#FF1744' : '#00C853'
                }}>
                  {fmtDur(inc.durationMins)}
                </td>
              </tr>
            ))}
            {pageItems.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: '#555', padding: '20px' }}>
                  Sin incidentes en el rango seleccionado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="table-load-more">
          <button
            className="btn-load-more"
            onClick={() => setVisible(v => v + PAGE_SIZE)}
          >
            Ver más ({Math.min(PAGE_SIZE, remaining)} de {remaining} restantes)
          </button>
        </div>
      )}
    </div>
  );
});

export default IncidentsTable;
