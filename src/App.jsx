import { useEffect, useState, useMemo, useCallback } from 'react';
import { loadData, filterDayByTime } from './utils/dataLoader';
import { useStaggered } from './hooks/useStaggered';
import FilterBar           from './components/FilterBar';
import MainLineChart       from './components/MainLineChart';
import VelocityBarChart    from './components/VelocityBarChart';
import ComparativeLineChart from './components/ComparativeLineChart';
import IncidentScatter     from './components/IncidentScatter';
import IncidentsTable      from './components/IncidentsTable';
import HeatmapPanel        from './components/HeatmapPanel';
import IncidentSummary     from './components/IncidentSummary';
import ChatbotContainer    from './components/ChatbotContainer';
import ChartWrapper        from './components/ChartWrapper';
import './App.css';

// Stagger order:
//  0 = nothing  1 = KPIs  2 = MainLine  3 = VelocityBar+Scatter  4 = Heatmap  5 = Comparative  6 = Summary+Table
const STAGGER_STEPS = 7;

export default function App() {
  const [allDays,       setAllDays]       = useState(null);
  const [selectedDates, setSelectedDates] = useState([]);
  const [startTime,     setStartTime]     = useState('06:00');
  const [endTime,       setEndTime]       = useState('23:59');
  const [compareMode,   setCompareMode]   = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);

  // Stagger charts — starts ticking once data is loaded
  const chartsReady = useStaggered(STAGGER_STEPS, 120, !!allDays);

  // Initial load
  useEffect(() => {
    loadData()
      .then(days => {
        setAllDays(days);
        setSelectedDates([days[0].date]);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  // Stable callbacks to prevent FilterBar re-renders
  const handleDatesChange = useCallback(setSelectedDates, []);
  const handleTimeChange  = useCallback((s, e) => {
    if (s <= e) { setStartTime(s); setEndTime(e); }
  }, []);
  const handleCompareMode = useCallback(setCompareMode, []);
  const handleHeatmapDaySelect = useCallback(date => setSelectedDates([date]), []);

  // Derived: selected + time-filtered days — memoized
  const selectedDays = useMemo(() => {
    if (!allDays) return [];
    return allDays
      .filter(d => selectedDates.includes(d.date))
      .map(day => filterDayByTime(day, startTime, endTime));
  }, [allDays, selectedDates, startTime, endTime]);

  const primaryDay  = selectedDays[0] ?? null;
  const isFiltered  = startTime !== '06:00' || endTime !== '23:59';

  // Average series across all selected days
  const averagedSeries = useMemo(() => {
    if (!selectedDays.length) return [];
    if (selectedDays.length === 1) return selectedDays[0].series;
    const timeMap = new Map();
    selectedDays.forEach(day => {
      day.series.forEach(p => {
        const b = timeMap.get(p.time) ?? { sum: 0, count: 0 };
        b.sum += p.value; b.count++;
        timeMap.set(p.time, b);
      });
    });
    return [...timeMap.entries()]
      .sort((a, b) => a[0] < b[0] ? -1 : 1)
      .map(([time, b]) => ({ time, value: Math.round(b.sum / b.count) }));
  }, [selectedDays]);

  // Average hourly velocity across all selected days
  const hourlyVelocity = useMemo(() => {
    if (!selectedDays.length) return [];
    if (selectedDays.length === 1)
      return selectedDays[0].filteredHourlyVelocity ?? selectedDays[0].hourlyVelocity ?? [];
    const hourMap = new Map();
    selectedDays.forEach(day => {
      const hv = day.filteredHourlyVelocity ?? day.hourlyVelocity ?? [];
      hv.forEach(h => {
        const b = hourMap.get(h.hour) ?? { label: h.label, sumNet: 0, sumAvg: 0, count: 0, hasIncident: false };
        b.sumNet += h.netDelta; b.sumAvg += h.avgDelta; b.count++;
        if (h.hasIncident) b.hasIncident = true;
        hourMap.set(h.hour, b);
      });
    });
    return [...hourMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([hour, b]) => ({
        hour, label: b.label,
        netDelta: Math.round(b.sumNet / b.count),
        avgDelta: Math.round(b.sumAvg / b.count),
        hasIncident: b.hasIncident,
      }));
  }, [selectedDays]);

  return (
    <div className="app-layout">
      <main className="main-content">

        {/* ── HEADER ── */}
        <header className="dash-header">
          <div className="dash-logo">
            <span className="rappi-badge">R</span>
            <div>
              <h1>Rappi Monitoring Dashboard</h1>
              <p>Synthetic store availability · Feb 2026</p>
            </div>
          </div>
          <div className="header-pills">
            {allDays  && <span className="dash-pill">📁 {allDays.length} días</span>}
            {primaryDay && <span className="dash-pill">{primaryDay.series.length.toLocaleString()} pts</span>}
            {isFiltered && <span className="dash-pill pill-orange">⏱ {startTime}–{endTime}</span>}
            {compareMode && <span className="dash-pill pill-blue">⊞ {selectedDays.length} días</span>}
          </div>
        </header>

        {/* ── FILTER BAR ── */}
        {allDays && (
          <FilterBar
            allDays={allDays}
            selectedDates={selectedDates}
            onDatesChange={handleDatesChange}
            startTime={startTime}
            endTime={endTime}
            onTimeChange={handleTimeChange}
            compareMode={compareMode}
            onCompareModeChange={handleCompareMode}
          />
        )}

        {error && <div className="error-banner">❌ {error}</div>}

        {loading && (
          <div className="loading">
            <div className="spinner" />
            <p>Cargando datos…</p>
          </div>
        )}

        {/* ── DASHBOARD BODY ── */}
        {!loading && primaryDay && (
          <div className="dash-body">

            {/* STEP 2: Main line chart */}
            {chartsReady >= 2
              ? <MainLineChart days={selectedDays} compareMode={compareMode} averagedSeries={averagedSeries} allDays={allDays} />
              : <div className="chart-skeleton" style={{ height: 332 }} />
            }

            {/* STEP 3: Velocity bar + incident scatter */}
            {chartsReady >= 3
              ? (
                <div className="charts-row-2">
                  <VelocityBarChart hourlyVelocity={hourlyVelocity} />
                  <IncidentScatter  days={selectedDays} />
                </div>
              )
              : <div className="chart-skeleton" style={{ height: 274 }} />
            }

            {/* STEP 4: Heatmap */}
            {chartsReady >= 4 && allDays && (
              <HeatmapPanel allDays={allDays} onDaySelect={handleHeatmapDaySelect} />
            )}

            {/* STEP 5: Comparative chart — lazy + deferred */}
            {chartsReady >= 5 && (
              <ComparativeLineChart allDays={allDays} />
            )}

            {/* STEP 6: Incident summary + table */}
            {chartsReady >= 6 && (
              <ChartWrapper minHeight={250}>
                <IncidentSummary selectedDays={selectedDays} />
                <IncidentsTable days={selectedDays} />
              </ChartWrapper>
            )}

          </div>
        )}
      </main>

      {/* ── CHATBOT (completely isolated — never re-renders dashboard) ── */}
      <ChatbotContainer
        allDays={allDays}
        dashboardContext={allDays ? { selectedDates, startTime, endTime, selectedDays } : null}
      />
    </div>
  );
}
