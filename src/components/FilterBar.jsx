import { memo, useCallback } from 'react';
import { fmtDate } from '../utils/dataLoader';

const DAY_COLORS = ['#FF441F','#2979FF','#00C853','#FFD600','#E040FB','#00BCD4','#FF6D00','#69F0AE','#FF1744','#40C4FF','#FF6E40'];
function getDayColor(i) { return DAY_COLORS[i % DAY_COLORS.length]; }

const FilterBar = memo(function FilterBar({
  allDays,
  selectedDates,
  onDatesChange,
  startTime,
  endTime,
  onTimeChange,
  compareMode,
  onCompareModeChange,
}) {
  const toggleDate = useCallback((date) => {
    if (selectedDates.includes(date)) {
      if (selectedDates.length === 1) return;
      onDatesChange(selectedDates.filter(d => d !== date));
    } else {
      onDatesChange([...selectedDates, date]);
    }
  }, [selectedDates, onDatesChange]);

  const selectAll  = useCallback(() => onDatesChange(allDays.map(d => d.date)), [allDays, onDatesChange]);
  const selectNone = useCallback(() => onDatesChange([allDays[0].date]),        [allDays, onDatesChange]);
  const resetTime  = useCallback(() => onTimeChange('06:00', '23:59'),          [onTimeChange]);

  return (
    <div className="filter-bar">
      {/* DATE CHIPS */}
      <div className="filter-group">
        <span className="filter-label">Fechas</span>
        <div className="date-chips">
          {allDays.map((day, i) => (
            <button
              key={day.date}
              className={`date-chip ${selectedDates.includes(day.date) ? 'active' : ''}`}
              style={selectedDates.includes(day.date) ? { '--chip-color': getDayColor(i) } : undefined}
              onClick={() => toggleDate(day.date)}
              title={day.date}
            >
              {fmtDate(day.date)}
            </button>
          ))}
        </div>
        <div className="filter-quick">
          <button className="btn-filter-sm" onClick={selectAll}>Todos</button>
          <button className="btn-filter-sm" onClick={selectNone}>Limpiar</button>
        </div>
      </div>

      {/* TIME RANGE */}
      <div className="filter-group">
        <span className="filter-label">Rango horario</span>
        <div className="time-range-row">
          <input type="time" className="time-input" value={startTime} min="00:00" max={endTime}
            onChange={e => onTimeChange(e.target.value, endTime)} />
          <span className="time-sep">—</span>
          <input type="time" className="time-input" value={endTime} min={startTime} max="23:59"
            onChange={e => onTimeChange(startTime, e.target.value)} />
          <button className="btn-filter-sm" onClick={resetTime}>Reset</button>
        </div>
      </div>

      {/* COMPARE TOGGLE */}
      <div className="filter-group">
        <span className="filter-label">Modo</span>
        <button
          className={`btn-compare ${compareMode ? 'active' : ''}`}
          onClick={() => onCompareModeChange(!compareMode)}
        >
          {compareMode ? '✓ Comparando' : 'Comparar días'}
        </button>
      </div>
    </div>
  );
});

export default FilterBar;
