// ===== HELPERS =====
export function timeToMins(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function fmtDate(d) {
  const parts = d.split('-');
  return `${parts[1]} ${parts[2]}`;
}

/**
 * Reduce a series to at most maxPoints.
 * Groups by HH:MM minute buckets first (averaging duplicates),
 * then uniform-samples the result.
 */
export function downsample(series, maxPoints = 200) {
  if (!series?.length) return [];
  if (series.length <= maxPoints) return series;

  // Minute-bucket averaging
  const map = new Map();
  for (const p of series) {
    const b = map.get(p.time);
    if (b) { b.sum += p.value; b.count++; }
    else     map.set(p.time, { time: p.time, sum: p.value, count: 1 });
  }

  const byMinute = [...map.values()]
    .sort((a, b) => a.time < b.time ? -1 : 1)
    .map(b => ({ time: b.time, value: Math.round(b.sum / b.count) }));

  if (byMinute.length <= maxPoints) return byMinute;

  // Uniform sample keeping first + last
  const step = (byMinute.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, i) =>
    byMinute[Math.min(Math.round(i * step), byMinute.length - 1)]
  );
}

// ===== ENRICH DAY =====
export function enrichDay(day) {
  const { series, stats } = day;
  if (!series?.length) return {
    ...day, deltas: [], incidents: [], hourlyVelocity: [],
    peakHour: null, growth: 0, avgSpeed: 0, incidentCount: 0,
  };

  // Deltas
  const deltas = [];
  for (let i = 1; i < series.length; i++) {
    const delta = series[i].value - series[i - 1].value;
    const mins  = timeToMins(series[i].time);
    deltas.push({ time: series[i].time, mins, hour: Math.floor(mins / 60), value: series[i].value, prevValue: series[i - 1].value, delta });
  }

  // Incidents with estimated recovery duration
  const incidents = [];
  for (let i = 0; i < deltas.length; i++) {
    const d = deltas[i];
    if (d.delta >= 0) continue;
    let recoveryTime = null;
    for (let j = i + 2; j < series.length; j++) {   // skip 1 to avoid same point
      if (series[j].value >= d.prevValue) { recoveryTime = series[j].time; break; }
    }
    const durationMins = recoveryTime ? timeToMins(recoveryTime) - d.mins : null;
    incidents.push({ ...d, recoveryTime, durationMins });
  }

  // Hourly velocity
  const hourBuckets = {};
  for (const d of deltas) {
    let b = hourBuckets[d.hour];
    if (!b) { b = { sum: 0, count: 0, hasNeg: false }; hourBuckets[d.hour] = b; }
    b.sum += d.delta; b.count++;
    if (d.delta < 0) b.hasNeg = true;
  }

  const hourlyVelocity = Object.entries(hourBuckets).map(([h, b]) => ({
    hour: Number(h), label: `${String(h).padStart(2, '0')}:00`,
    netDelta: Math.round(b.sum), avgDelta: Math.round(b.sum / b.count),
    hasIncident: b.hasNeg,
  })).sort((a, b) => a.hour - b.hour);

  const peakHour = hourlyVelocity.reduce(
    (best, h) => h.avgDelta > (best?.avgDelta ?? -Infinity) ? h : best, null
  );

  const totalMins = Math.max(timeToMins(series[series.length - 1].time) - timeToMins(series[0].time), 1);
  const growth    = stats.last - stats.first;
  const avgSpeed  = Math.round(growth / totalMins);

  return { ...day, deltas, incidents, hourlyVelocity, peakHour, totalMins, growth, avgSpeed, incidentCount: incidents.length };
}

// ===== FILTER A DAY BY TIME RANGE =====
export function filterDayByTime(day, startTime, endTime) {
  // Fast-path: no filtering needed
  if (startTime <= (day.series[0]?.time ?? '00:00') && endTime >= (day.series[day.series.length - 1]?.time ?? '23:59')) {
    return {
      ...day,
      filteredDeltas:        day.deltas,
      filteredIncidents:     day.incidents,
      filteredHourlyVelocity: day.hourlyVelocity,
      filteredPeakHour:      day.peakHour,
      filteredGrowth:        day.growth,
      filteredSpeed:         day.avgSpeed,
      filteredIncidentCount: day.incidentCount,
    };
  }

  const filteredSeries = day.series.filter(p => p.time >= startTime && p.time <= endTime);
  if (!filteredSeries.length) return {
    ...day, series: filteredSeries,
    filteredGrowth: 0, filteredSpeed: 0,
    filteredIncidents: [], filteredHourlyVelocity: [],
    filteredPeakHour: null, filteredIncidentCount: 0,
  };

  const filteredDeltas = [];
  for (let i = 1; i < filteredSeries.length; i++) {
    const delta = filteredSeries[i].value - filteredSeries[i - 1].value;
    const mins  = timeToMins(filteredSeries[i].time);
    filteredDeltas.push({ time: filteredSeries[i].time, mins, hour: Math.floor(mins / 60), value: filteredSeries[i].value, prevValue: filteredSeries[i - 1].value, delta });
  }

  const filteredIncidents = [];
  for (let i = 0; i < filteredDeltas.length; i++) {
    const d = filteredDeltas[i];
    if (d.delta >= 0) continue;
    let recoveryTime = null;
    for (let j = i + 2; j < filteredSeries.length; j++) {
      if (filteredSeries[j].value >= d.prevValue) { recoveryTime = filteredSeries[j].time; break; }
    }
    const durationMins = recoveryTime ? timeToMins(recoveryTime) - d.mins : null;
    filteredIncidents.push({ ...d, recoveryTime, durationMins });
  }

  const hourBuckets = {};
  for (const d of filteredDeltas) {
    let b = hourBuckets[d.hour];
    if (!b) { b = { sum: 0, count: 0, hasNeg: false }; hourBuckets[d.hour] = b; }
    b.sum += d.delta; b.count++;
    if (d.delta < 0) b.hasNeg = true;
  }
  const filteredHourlyVelocity = Object.entries(hourBuckets).map(([h, b]) => ({
    hour: Number(h), label: `${String(h).padStart(2, '0')}:00`,
    netDelta: Math.round(b.sum), avgDelta: Math.round(b.sum / b.count), hasIncident: b.hasNeg,
  })).sort((a, b) => a.hour - b.hour);

  const filteredPeakHour = filteredHourlyVelocity.reduce(
    (best, h) => h.avgDelta > (best?.avgDelta ?? -Infinity) ? h : best, null
  );
  const filteredTotalMins = Math.max(
    timeToMins(filteredSeries[filteredSeries.length - 1].time) - timeToMins(filteredSeries[0].time), 1
  );
  const filteredGrowth = filteredSeries[filteredSeries.length - 1].value - filteredSeries[0].value;
  const filteredSpeed  = Math.round(filteredGrowth / filteredTotalMins);

  return {
    ...day, series: filteredSeries,
    filteredDeltas, filteredIncidents, filteredHourlyVelocity,
    filteredPeakHour, filteredGrowth, filteredSpeed,
    filteredIncidentCount: filteredIncidents.length,
  };
}

// ===== LOAD =====
export async function loadData() {
  const res = await fetch('/data.json');
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  const raw = await res.json();
  return raw.map(enrichDay).sort((a, b) => a.date.localeCompare(b.date));
}

// ===== COLORS =====
export const DAY_COLORS = [
  '#FF441F','#2979FF','#00C853','#FFD600','#E040FB',
  '#00BCD4','#FF6D00','#69F0AE','#FF1744','#40C4FF','#FF6E40',
];
export function getDayColor(i) { return DAY_COLORS[i % DAY_COLORS.length]; }
