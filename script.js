/* ═══════════════════════════════════════════════════════════════
   VP Operations Command Center — JavaScript
   ═══════════════════════════════════════════════════════════════ */

/* ─── CONFIG ─── */
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQv78E-sNx7jHuv9RTfBJcw1-mGCXHijRtRbuCJut-T2A3ccncV3C_XXTe7iM1XEloaZ335wNrCh1cf/pub?gid=1425114708&single=true&output=csv';

const COL = {
  DATE: 0, CENTER: 1, REGION: 2, ZONE: 3, METRIC: 4, SUBMETRIC: 5,
  TARGET: 6, CAP: 7, ACHIEVED: 8, METRIC_WEIGHT: 9, OVERALL_WEIGHT: 10,
  METRIC_ACH_PCT: 11, OVERALL_ACH_PCT: 12, BUSINESS_HEAD: 13, CENTER_HEAD: 14
};

const METRIC_ORDER = [
  'Admissions AY26',
  'Attendance',
  'EMI Collection',
  'Test Performance and Attendance'
];

let DATA = null;
const CHARTS = {};
const DOM = {};
let darkMode = true; // default dark (Physics Wallah branding)

/* ─── Sub-metric definitions (for pivot table) ─── */
const SM_LIST = [
  {metric:'Admissions AY26', sub:'C2', key:'c2'},
  {metric:'Attendance', sub:'DAS', key:'das'},
  {metric:'Attendance', sub:'Inactivity', key:'inact'},
  {metric:'EMI Collection', sub:'4th EMI', key:'emi4'},
  {metric:'EMI Collection', sub:'1st EMI (Sep-Jun)', key:'emi1'},
  {metric:'EMI Collection', sub:'2nd EMI', key:'emi2'},
  {metric:'Test Performance and Attendance', sub:'Result', key:'result'},
  {metric:'Test Performance and Attendance', sub:'Attendance', key:'tpaAtt'}
];

document.addEventListener('DOMContentLoaded', () => {
  cacheDOM();
  DOM.refreshBtn.addEventListener('click', () => location.reload());
  DOM.themeToggle.addEventListener('click', toggleTheme);
  DOM.exportCsvBtn.addEventListener('click', exportCsv);
  loadData();
});

/* ═══════════════════════════════════════════════════════════════
   DOM CACHE
   ═══════════════════════════════════════════════════════════════ */
function cacheDOM() {
  DOM.loadingOverlay = document.getElementById('loadingOverlay');
  DOM.app = document.getElementById('app');
  DOM.lastUpdatedBadge = document.getElementById('lastUpdatedBadge');
  DOM.refreshBtn = document.getElementById('refreshBtn');
  DOM.themeToggle = document.getElementById('themeToggle');
  DOM.zoneLatestDateLabel = document.getElementById('zoneLatestDateLabel');
  DOM.regionLatestDateLabel = document.getElementById('regionLatestDateLabel');
  DOM.latestDateLabel = document.getElementById('latestDateLabel');

  DOM.filterDate = document.getElementById('filterDate');
  DOM.filterRegion = document.getElementById('filterRegion');
  DOM.filterZone = document.getElementById('filterZone');
  DOM.filterCenter = document.getElementById('filterCenter');
  DOM.filterMetric = document.getElementById('filterMetric');
  DOM.resetFiltersBtn = document.getElementById('resetFiltersBtn');
  DOM.latestSearch = document.getElementById('latestSearch');
  DOM.exportCsvBtn = document.getElementById('exportCsvBtn');

  DOM.kpiTopCenter = document.getElementById('kpiTopCenter');
  DOM.kpiTopScore = document.getElementById('kpiTopScore');
  DOM.kpiBottomCenter = document.getElementById('kpiBottomCenter');
  DOM.kpiBottomScore = document.getElementById('kpiBottomScore');
  DOM.kpiAvgScore = document.getElementById('kpiAvgScore');
  DOM.kpiCenterCount = document.getElementById('kpiCenterCount');
  DOM.kpiBestRegion = document.getElementById('kpiBestRegion');
  DOM.kpiBestRegionScore = document.getElementById('kpiBestRegionScore');
  DOM.kpiBestZone = document.getElementById('kpiBestZone');
  DOM.kpiBestZoneScore = document.getElementById('kpiBestZoneScore');

  DOM.insightsBar = document.getElementById('insightsBar');
  DOM.insightTopRegion = document.getElementById('insightTopRegion');
  DOM.insightTopZone = document.getElementById('insightTopZone');
  DOM.insightAboveTarget = document.getElementById('insightAboveTarget');

  DOM.heatmapTable = document.getElementById('heatmapTable');
  DOM.zoneGrid = document.getElementById('zoneGrid');
  DOM.regionGrid = document.getElementById('regionGrid');
  DOM.latestTable = document.getElementById('latestTable');
  DOM.rowCountLabel = document.getElementById('rowCountLabel');
  DOM.statusBarCount = document.getElementById('statusBarCount');
  DOM.detailSearch = document.getElementById('detailSearch');
}

/* ═══════════════════════════════════════════════════════════════
   THEME TOGGLE
   ═══════════════════════════════════════════════════════════════ */
function toggleTheme() {
  darkMode = !darkMode;
  document.documentElement.classList.toggle('dark', darkMode);
  const icon = DOM.themeToggle.querySelector('i');
  icon.className = darkMode ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  // Re-create charts so grid/tick colors adapt to the active theme
  if (DATA) renderAll();
}

/* Theme-aware chart palette helpers */
function chartGridColor() { return darkMode ? 'rgba(255,255,255,0.08)' : '#f1f5f9'; }
function chartTickColor() { return darkMode ? '#94a3b8' : '#64748b'; }

/* ═══════════════════════════════════════════════════════════════
   ERROR & LOADING
   ═══════════════════════════════════════════════════════════════ */
function onLoadError(err) {
  DOM.loadingOverlay.innerHTML = `
    <div class="text-center px-6 max-w-sm" style="margin:auto">
      <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-rose-50 flex items-center justify-center">
        <i class="fa-solid fa-triangle-exclamation text-2xl" style="color:#f43f5e"></i>
      </div>
      <p class="font-bold text-lg" style="color:#1e293b">Could not load data</p>
      <p class="text-xs mt-2" style="color:#64748b">${err && err.message ? err.message : String(err)}</p>
      <button onclick="location.reload()" class="mt-5" style="background:#e21b38;color:#fff;border:none;padding:10px 24px;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer">
        <i class="fa-solid fa-rotate mr-2"></i>Retry
      </button>
    </div>`;
}

function onDataLoaded(payload) {
  DATA = payload;
  DOM.loadingOverlay.classList.add('hidden');
  DOM.app.classList.remove('hidden');

  const df = DATA.meta.lastUpdatedFormatted;
  DOM.lastUpdatedBadge.innerHTML = `<i class="fa-regular fa-clock"></i> <span>Last Updated on: ${df}</span>`;
  DOM.zoneLatestDateLabel.textContent = df;
  DOM.regionLatestDateLabel.textContent = df;
  DOM.latestDateLabel.textContent = df;

  populateFilters();
  wireEvents();
  renderAll();
}

/* ═══════════════════════════════════════════════════════════════
   DATA LOADING
   ═══════════════════════════════════════════════════════════════ */
function loadData() {
  const bustUrl = CSV_URL + (CSV_URL.includes('?') ? '&' : '?') + '_cb=' + Date.now();
  const candidates = [
    bustUrl,
    'https://api.allorigins.win/raw?url=' + encodeURIComponent(bustUrl),
    'https://corsproxy.io/?url=' + encodeURIComponent(bustUrl)
  ];
  tryLoadSequential(candidates, 0);
}

function tryLoadSequential(urls, idx) {
  if (idx >= urls.length) {
    onLoadError(new Error('Could not reach the data source. Check your internet or the sheet publish status.'));
    return;
  }
  fetchWithTimeout(urls[idx], 15000)
    .then(res => { if (!res.ok) throw new Error('HTTP ' + res.status); return res.text(); })
    .then(csvText => {
      const parsed = Papa.parse(csvText, { skipEmptyLines: true });
      const dataRows = parsed.data.slice(1);
      const payload = buildDashboardData(dataRows);
      onDataLoaded(payload);
    })
    .catch(err => {
      console.warn('Load attempt failed for', urls[idx], err.message);
      tryLoadSequential(urls, idx + 1);
    });
}

function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

/* ═══════════════════════════════════════════════════════════════
   DATA BUILDER
   ═══════════════════════════════════════════════════════════════ */
function buildDashboardData(dataRows) {
  const rawRows = buildRawRows_(dataRows);
  if (rawRows.length === 0) throw new Error('No data rows found in the published sheet.');

  const dates = uniqueSorted_(rawRows.map(r => r.date));
  const latestDate = dates[dates.length - 1];

  const meta = buildMeta_(rawRows, dates, latestDate);
  const centerSummary = buildCenterSummary_(rawRows, latestDate);
  computeRanks_(centerSummary, 'totalScore', 'overallRank');
  computeZoneRanks_(centerSummary);

  const zoneWise = groupBy_(centerSummary, 'zone');
  const regionWise = groupBy_(centerSummary, 'region');
  const latestTable = buildLatestTable_(rawRows, latestDate, centerSummary);

  return { meta, rawRows, centerSummary, zoneWise, regionWise, latestTable };
}

function buildRawRows_(dataRows) {
  const rows = [];
  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i];
    if (!r || !r[COL.CENTER]) continue;
    const dateStr = formatDateFromCsv_(r[COL.DATE]);
    if (!dateStr) continue;
    rows.push({
      date: dateStr,
      center: String(r[COL.CENTER] || '').trim(),
      region: String(r[COL.REGION] || '').trim(),
      zone: String(r[COL.ZONE] || '').trim(),
      metric: String(r[COL.METRIC] || '').trim(),
      subMetric: String(r[COL.SUBMETRIC] || '').trim(),
      target: sanitizeValue_(r[COL.TARGET]),
      cap: sanitizeValue_(r[COL.CAP]),
      achieved: sanitizeValue_(r[COL.ACHIEVED]),
      metricWeight: sanitizeValue_(r[COL.METRIC_WEIGHT]),
      overallWeight: sanitizeValue_(r[COL.OVERALL_WEIGHT]),
      metricAchPct: sanitizeValue_(r[COL.METRIC_ACH_PCT]),
      overallAchPct: sanitizeValue_(r[COL.OVERALL_ACH_PCT]),
      businessHead: String(r[COL.BUSINESS_HEAD] || '').trim(),
      centerHead: String(r[COL.CENTER_HEAD] || '').trim()
    });
  }
  return rows;
}

function sanitizeValue_(v) {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).trim();
  if (!s || s === '-' || s === '\u2013' || s === 'NA' || s === 'N/A') return null;
  if (s.includes('%')) {
    const num = parseFloat(s.replace(/%/g, '').replace(/,/g, ''));
    return isNaN(num) ? null : num;
  }
  const plain = parseFloat(s.replace(/,/g, ''));
  if (!isNaN(plain) && /^-?[\d.,]+$/.test(s)) return plain;
  return s;
}

function formatDateFromCsv_(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const parts = s.split(/[\/\-]/).map(p => p.trim());
  if (parts.length === 3 && parts.every(p => /^\d+$/.test(p))) {
    let [a, b, c] = parts.map(Number);
    let y, m, d;
    if (a > 999) { y = a; m = b; d = c; }
    else { d = a; m = b; y = c; if (y < 100) y += 2000; }
    const dt = new Date(y, m - 1, d);
    if (!isNaN(dt.getTime())) {
      return dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0');
    }
  }
  const native = new Date(s);
  if (!isNaN(native.getTime())) {
    return native.getFullYear() + '-' + String(native.getMonth()+1).padStart(2,'0') + '-' + String(native.getDate()).padStart(2,'0');
  }
  return s;
}

function buildMeta_(rawRows, dates, latestDate) {
  const regions = uniqueSorted_(rawRows.map(r => r.region));
  const zones = uniqueSorted_(rawRows.map(r => r.zone)).sort(zoneComparator_);
  const centersMap = {};
  rawRows.forEach(r => {
    if (!centersMap[r.center]) centersMap[r.center] = { name: r.center, region: r.region, zone: r.zone, businessHead: r.businessHead, centerHead: r.centerHead };
  });
  return {
    lastUpdatedRaw: latestDate,
    lastUpdatedFormatted: formatDisplayDate_(latestDate),
    dates, regions, zones,
    metrics: METRIC_ORDER,
    centersMeta: Object.keys(centersMap).sort().map(k => centersMap[k])
  };
}

function formatDisplayDate_(isoDate) {
  const d = new Date(isoDate + 'T00:00:00');
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}

function zoneComparator_(a, b) {
  return (parseInt(String(a).replace(/\D/g, ''), 10) || 0) - (parseInt(String(b).replace(/\D/g, ''), 10) || 0);
}

function buildCenterSummary_(rawRows, latestDate) {
  const latestRows = rawRows.filter(r => r.date === latestDate);
  const byCenter = {};
  latestRows.forEach(r => {
    if (!byCenter[r.center]) {
      byCenter[r.center] = {
        center: r.center, region: r.region, zone: r.zone,
        businessHead: r.businessHead, centerHead: r.centerHead,
        totalScore: 0, overallRank: null, zoneRank: null,
        metricScores: METRIC_ORDER.reduce((a, m) => { a[m] = 0; return a; }, {})
      };
    }
    const c = byCenter[r.center];
    c.totalScore += (r.overallAchPct || 0);
    if (c.metricScores.hasOwnProperty(r.metric)) c.metricScores[r.metric] += (r.metricAchPct || 0);
  });
  return Object.keys(byCenter).map(k => {
    const c = byCenter[k];
    c.totalScore = round2_(c.totalScore);
    METRIC_ORDER.forEach(m => { c.metricScores[m] = round2_(c.metricScores[m]); });
    return c;
  });
}

function computeRanks_(items, scoreField, rankField) {
  const sorted = items.slice().sort((a, b) => b[scoreField] - a[scoreField]);
  let rank = 0, prev = null;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i][scoreField] !== prev) { rank = i + 1; prev = sorted[i][scoreField]; }
    sorted[i][rankField] = rank;
  }
}


function computeZoneRanks_(centerSummary) {
  Object.keys(groupBy_(centerSummary, 'zone')).forEach(zone =>
    computeRanks_(groupBy_(centerSummary, 'zone')[zone], 'totalScore', 'zoneRank'));
}

function groupBy_(arr, key) {
  const g = {};
  arr.forEach(c => { const k = c[key]; if (!g[k]) g[k] = []; g[k].push(c); });
  Object.keys(g).forEach(k => g[k].sort((a, b) => b.totalScore - a.totalScore));
  return g;
}

/* ─── Build pivot table rows ─── */
function buildLatestTable_(rawRows, latestDate, centerSummary) {
  const latestRows = rawRows.filter(r => r.date === latestDate);
  const byCenter = {};
  latestRows.forEach(r => {
    if (!byCenter[r.center]) byCenter[r.center] = {};
    byCenter[r.center][r.metric + '||' + r.subMetric] = r;
  });
  const sumByCenter = centerSummary.reduce((a, c) => { a[c.center] = c; return a; }, {});

  return Object.keys(byCenter).map(name => {
    const r = byCenter[name];
    const s = sumByCenter[name] || {};
    const get = (key, field) => {
      const sm = r[key];
      return sm ? (sm[field] != null ? sm[field] : null) : null;
    };
    const row = { region: '', center: name, businessHead: '', centerHead: '', zone: '' };
    SM_LIST.forEach(sm => {
      const src = r[sm.metric + '||' + sm.sub];
      if (src) {
        if (!row.region) row.region = src.region;
        if (!row.businessHead) row.businessHead = src.businessHead;
        if (!row.centerHead) row.centerHead = src.centerHead;
        if (!row.zone) row.zone = src.zone;
      }
      row[sm.key + 'Target'] = get(sm.metric + '||' + sm.sub, 'target');
      row[sm.key + 'Cap'] = get(sm.metric + '||' + sm.sub, 'cap');
      row[sm.key + 'Achieved'] = get(sm.metric + '||' + sm.sub, 'achieved');
      row[sm.key + 'AchPct'] = get(sm.metric + '||' + sm.sub, 'metricAchPct');
    });
    row.scorePct = s.totalScore;
    row.overallRank = s.overallRank;
    row.zonalRank = s.zoneRank;
    return row;
  }).sort((a, b) => (a.overallRank || 9999) - (b.overallRank || 9999));
}

/* ─── Utility ─── */
function uniqueSorted_(arr) {
  const s = new Set(), o = [];
  arr.forEach(v => { if (v != null && v !== '' && !s.has(v)) { s.add(v); o.push(v); } });
  return o.sort();
}

function round2_(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

/* ═══════════════════════════════════════════════════════════════
   UI LOGIC
   ═══════════════════════════════════════════════════════════════ */
function populateFilters() {
  fillSelect(DOM.filterDate, DATA.meta.dates.map(d => ({ v: d, l: d })), DATA.meta.lastUpdatedRaw);
  fillSelect(DOM.filterRegion, [{ v: 'All', l: 'All Regions' }, ...DATA.meta.regions.map(r => ({ v: r, l: r }))], 'All');
  fillSelect(DOM.filterZone, [{ v: 'All', l: 'All Zones' }, ...DATA.meta.zones.map(z => ({ v: z, l: z }))], 'All');
  fillSelect(DOM.filterMetric, [{ v: 'All', l: 'All Metrics' }, ...DATA.meta.metrics.map(m => ({ v: m, l: m }))], 'All');
  populateCenterFilter();
}

function populateCenterFilter() {
  const region = DOM.filterRegion.value || 'All';
  const zone = DOM.filterZone.value || 'All';
  const centers = DATA.meta.centersMeta
    .filter(c => (region === 'All' || c.region === region) && (zone === 'All' || c.zone === zone))
    .map(c => ({ v: c.name, l: c.name }));
  const cur = DOM.filterCenter.value;
  fillSelect(DOM.filterCenter, [{ v: 'All', l: 'All Centers' }, ...centers], centers.some(c => c.v === cur) ? cur : 'All');
}

function fillSelect(el, opts, sel) {
  el.innerHTML = opts.map(o => '<option value="' + o.v + '" ' + (o.v === sel ? 'selected' : '') + '>' + o.l + '</option>').join('');
}

function wireEvents() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = document.getElementById('tab-' + btn.dataset.tab);
      if (panel) panel.classList.add('active');
      if (btn.dataset.tab === 'overview') renderAll();
    });
  });

  DOM.filterRegion.addEventListener('change', () => { populateCenterFilter(); renderAll(); });
  DOM.filterZone.addEventListener('change', () => { populateCenterFilter(); renderAll(); });
  DOM.filterDate.addEventListener('change', renderAll);
  DOM.filterCenter.addEventListener('change', renderAll);
  DOM.filterMetric.addEventListener('change', renderAll);

  DOM.resetFiltersBtn.addEventListener('click', () => {
    fillSelect(DOM.filterDate, DATA.meta.dates.map(d => ({ v: d, l: d })), DATA.meta.lastUpdatedRaw);
    DOM.filterRegion.value = 'All';
    DOM.filterZone.value = 'All';
    DOM.filterMetric.value = 'All';
    populateCenterFilter();
    DOM.filterCenter.value = 'All';
    DOM.detailSearch.value = '';
    renderAll();
  });

  DOM.detailSearch.addEventListener('input', debounce(renderLatestTable, 150));
}

function getFilters() {
  return {
    date: DOM.filterDate.value, region: DOM.filterRegion.value,
    zone: DOM.filterZone.value, center: DOM.filterCenter.value,
    metric: DOM.filterMetric.value
  };
}

function computeScoresForDate(date, f) {
  const rows = DATA.rawRows.filter(r =>
    r.date === date &&
    (f.region === 'All' || r.region === f.region) &&
    (f.zone === 'All' || r.zone === f.zone) &&
    (f.center === 'All' || r.center === f.center)
  );
  const byCenter = {};
  rows.forEach(r => {
    if (!byCenter[r.center]) byCenter[r.center] = { center: r.center, region: r.region, zone: r.zone, score: 0 };
    byCenter[r.center].score += (r.overallAchPct || 0);
  });
  return Object.values(byCenter).map(c => { c.score = Math.round(c.score * 100) / 100; return c; });
}

function filteredCenterSummary(f) {
  return DATA.centerSummary.filter(c =>
    (f.region === 'All' || c.region === f.region) &&
    (f.zone === 'All' || c.zone === f.zone) &&
    (f.center === 'All' || c.center === f.center)
  );
}

function renderAll() {
  const f = getFilters();
  renderKpis(f);
  renderTopBottomChart(f);
  renderZoneComparisonChart(f);
  renderHeatmap(f);
  renderTrendChart(f);
  renderSubMetricCharts(f);
  renderZoneTab(f);
  renderRegionTab(f);
  renderLatestTable();
}

/* ─── KPI + Insights ─── */
function renderKpis(f) {
  const scores = computeScoresForDate(f.date, f);
  if (scores.length === 0) {
    DOM.kpiTopCenter.textContent = '\u2014'; DOM.kpiTopScore.textContent = '\u2014';
    DOM.kpiBottomCenter.textContent = '\u2014'; DOM.kpiBottomScore.textContent = '\u2014';
    DOM.kpiAvgScore.textContent = '\u2014'; DOM.kpiCenterCount.textContent = '0';
    DOM.kpiBestRegion.textContent = '\u2014'; DOM.kpiBestRegionScore.textContent = '\u2014';
    DOM.kpiBestZone.textContent = '\u2014'; DOM.kpiBestZoneScore.textContent = '\u2014';
    DOM.insightTopRegion.textContent = ''; DOM.insightTopZone.textContent = '';
    DOM.insightAboveTarget.textContent = '';
    return;
  }
  const sorted = scores.slice().sort((a, b) => b.score - a.score);
  const top = sorted[0], bottom = sorted[sorted.length - 1];
  const avg = scores.reduce((s, c) => s + c.score, 0) / scores.length;
  DOM.kpiTopCenter.textContent = top.center;
  DOM.kpiTopScore.textContent = top.score.toFixed(2) + '%';
  DOM.kpiBottomCenter.textContent = bottom.center;
  DOM.kpiBottomScore.textContent = bottom.score.toFixed(2) + '%';
  DOM.kpiAvgScore.textContent = avg.toFixed(2) + '%';
  DOM.kpiCenterCount.textContent = scores.length;

  // Best region & zone
  const byRegion = {}, byZone = {};
  scores.forEach(c => {
    if (!byRegion[c.region]) byRegion[c.region] = [];
    byRegion[c.region].push(c.score);
    if (!byZone[c.zone]) byZone[c.zone] = [];
    byZone[c.zone].push(c.score);
  });
  let bestRegion = '', bestRegionAvg = 0, bestZone = '', bestZoneAvg = 0;
  Object.keys(byRegion).forEach(r => {
    const ra = byRegion[r].reduce((s, v) => s + v, 0) / byRegion[r].length;
    if (ra > bestRegionAvg) { bestRegionAvg = ra; bestRegion = r; }
  });
  Object.keys(byZone).forEach(z => {
    const za = byZone[z].reduce((s, v) => s + v, 0) / byZone[z].length;
    if (za > bestZoneAvg) { bestZoneAvg = za; bestZone = z; }
  });
  DOM.kpiBestRegion.textContent = bestRegion;
  DOM.kpiBestRegionScore.textContent = bestRegionAvg.toFixed(2) + '%';
  DOM.kpiBestZone.textContent = bestZone;
  DOM.kpiBestZoneScore.textContent = bestZoneAvg.toFixed(2) + '%';

  const above60 = scores.filter(c => c.score >= 60).length;
  DOM.insightTopRegion.textContent = '\uD83C\uDF1F Best Region: ' + bestRegion + ' (' + bestRegionAvg.toFixed(1) + '%)';
  DOM.insightTopZone.textContent = '\uD83C\uDFAF Best Zone: ' + bestZone + ' (' + bestZoneAvg.toFixed(1) + '%)';
  DOM.insightAboveTarget.textContent = '\uD83D\uDCC8 ' + above60 + '/' + scores.length + ' centers above 60%';
}

/* ─── Chart helpers ─── */
function upsertChart(key, ctxId, config) {
  if (CHARTS[key]) CHARTS[key].destroy();
  const ctx = document.getElementById(ctxId).getContext('2d');
  CHARTS[key] = new Chart(ctx, config);
}

function renderTopBottomChart(f) {
  const scores = computeScoresForDate(f.date, f).sort((a, b) => b.score - a.score);
  const top10 = scores.slice(0, 10);
  const bottom10 = scores.slice(-10).reverse();
  const labels = [...top10.map(c => c.center), ...bottom10.map(c => c.center)];
  const values = [...top10.map(c => c.score), ...bottom10.map(c => c.score)];
  const colors = [...top10.map(() => '#10b981'), ...bottom10.map(() => '#f43f5e')];
  upsertChart('topBottom', 'chartTopBottom', {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Score %', data: values, backgroundColor: colors, borderRadius: 6, borderSkipped: false }] },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ctx.parsed.x.toFixed(2) + '%' } } },
      scales: {
        x: { grid: { color: chartGridColor() }, ticks: { callback: v => v + '%', color: chartTickColor() } },
        y: { grid: { display: false }, ticks: { color: chartTickColor() } }
      }
    }
  });
}

function renderZoneComparisonChart(f) {
  const scores = computeScoresForDate(f.date, f);
  const byZone = {};
  scores.forEach(c => { if (!byZone[c.zone]) byZone[c.zone] = []; byZone[c.zone].push(c.score); });
  const zones = Object.keys(byZone).sort((a, b) => (parseInt(a.replace(/\D/g, ''), 10) || 0) - (parseInt(b.replace(/\D/g, ''), 10) || 0));
  const avgs = zones.map(z => byZone[z].reduce((s, v) => s + v, 0) / byZone[z].length);
  const gradientColors = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e'];
  upsertChart('zoneComparison', 'chartZoneComparison', {
    type: 'bar',
    data: { labels: zones, datasets: [{ label: 'Avg Score %', data: avgs.map(v => Math.round(v * 100) / 100), backgroundColor: gradientColors.slice(0, zones.length), borderRadius: 8, borderSkipped: false }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ctx.parsed.y.toFixed(2) + '%' } } },
      scales: {
        y: { grid: { color: chartGridColor() }, ticks: { callback: v => v + '%', color: chartTickColor() } },
        x: { grid: { display: false }, ticks: { color: chartTickColor() } }
      }
    }
  });
}

function renderHeatmap(f) {
  const rows = DATA.rawRows.filter(r =>
    r.date === f.date && (f.region === 'All' || r.region === f.region) &&
    (f.zone === 'All' || r.zone === f.zone) && (f.center === 'All' || r.center === f.center)
  );
  const regions = uniq(rows.map(r => r.region)).sort();
  const metrics = DATA.meta.metrics;
  const sums = {}, centerSets = {};
  rows.forEach(r => {
    const k = r.region + '||' + r.metric;
    sums[k] = (sums[k] || 0) + (r.metricAchPct || 0);
    if (!centerSets[r.region]) centerSets[r.region] = {};
    centerSets[r.region][r.center] = true;
  });

  let html = '<thead><tr><th class="text-left p-2 bg-slate-50 rounded-tl-xl" style="position:sticky;left:0;z-index:5">Region</th>';
  metrics.forEach(m => { html += '<th class="p-2 bg-slate-50 text-center" style="color:#e21b38;font-weight:600">' + m + '</th>'; });
  html += '</tr></thead><tbody>';
  regions.forEach(r => {
    const cc = Object.keys(centerSets[r] || {}).length || 1;
    html += '<tr><td class="p-2 font-semibold" style="position:sticky;left:0;background:#fff">' + r + '</td>';
    metrics.forEach(m => {
      const avg = (sums[r + '||' + m] || 0) / cc;
      html += '<td class="p-2 text-center ' + heatClass(avg) + '">' + avg.toFixed(1) + '%</td>';
    });
    html += '</tr>';
  });
  html += '</tbody>';
  DOM.heatmapTable.innerHTML = html;
}

function heatClass(v) { return v >= 60 ? 'score-high' : v >= 30 ? 'score-mid' : 'score-low'; }

function renderTrendChart(f) {
  // Always ALL metrics — each metric gets its own line
  // Filter applies ONLY to center/region/zone (NOT metric)
  const center = f.center === 'All' ? null : f.center;
  const baseRows = DATA.rawRows.filter(r =>
    (f.region === 'All' || r.region === f.region) &&
    (f.zone  === 'All' || r.zone  === f.zone) &&
    (!center || r.center === center)
  );

  const metricColors = {
    'Admissions AY26':                { line: '#6366f1', fill: 'rgba(99,102,241,0.12)' },
    'Attendance':                     { line: '#14b8a6', fill: 'rgba(20,184,166,0.12)' },
    'EMI Collection':                 { line: '#f97316', fill: 'rgba(249,115,22,0.12)'  },
    'Test Performance and Attendance':{ line: '#e11d48', fill: 'rgba(225,29,72,0.12)'   }
  };

  const dates = DATA.meta.dates;

  // ─── Per-metric datasets ───
  const datasets = METRIC_ORDER.map(metric => {
    const byDate = {};
    dates.forEach(d => { byDate[d] = { sum: 0, count: 0 }; });

    baseRows.forEach(r => {
      if (r.metric !== metric) return;
      const b = byDate[r.date];
      if (!b) return;
      if (r.metricAchPct != null) { b.sum += r.metricAchPct; b.count++; }
    });

    const values = dates.map(d => {
      const b = byDate[d];
      return b.count > 0 ? Math.round((b.sum / b.count) * 100) / 100 : null;
    });

    const c = metricColors[metric] || { line: '#94a3b8', fill: 'rgba(148,163,184,0.12)' };
    return {
      label: metric,
      data: values,
      borderColor: c.line,
      backgroundColor: c.fill,
      fill: false,
      tension: 0.4,
      pointRadius: 3,
      pointHoverRadius: 6,
      pointBackgroundColor: c.line,
      borderWidth: 2.5,
      spanGaps: true
    };
  });

  // ─── 5th dataset: All Metrics Combined ───
  const allByDate = {};
  dates.forEach(d => { allByDate[d] = { sum: 0, count: 0 }; });
  baseRows.forEach(r => {
    const b = allByDate[r.date]; if (!b) return;
    if (r.metricAchPct != null) { b.sum += r.metricAchPct; b.count++; }
  });
  const allValues = dates.map(d => {
    const b = allByDate[d];
    return b.count > 0 ? Math.round((b.sum / b.count) * 100) / 100 : null;
  });
  datasets.push({
    label: 'All Metrics Combined',
    data: allValues,
    borderColor: darkMode ? '#e2e8f0' : '#1e293b',
    backgroundColor: function(ctx) {
      if (!ctx.chart.chartArea) return 'rgba(30,41,59,0.08)';
      const c1 = darkMode ? 'rgba(226,232,240,0.15)' : 'rgba(30,41,59,0.15)';
      const c2 = darkMode ? 'rgba(226,232,240,0.01)' : 'rgba(30,41,59,0.01)';
      const g = ctx.chart.ctx.createLinearGradient(0, ctx.chart.chartArea.top, 0, ctx.chart.chartArea.bottom);
      g.addColorStop(0, c1);
      g.addColorStop(1, c2);
      return g;
    },
    fill: true,
    tension: 0.4,
    pointRadius: 3,
    pointHoverRadius: 7,
    pointBackgroundColor: darkMode ? '#e2e8f0' : '#1e293b',
    borderWidth: 2,
    borderDash: [5, 3],
    spanGaps: true
  });

  upsertChart('trend', 'chartTrend', {
    type: 'line',
    data: { labels: dates, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 14, padding: 14, font: { size: 11 }, color: darkMode ? '#cbd5e1' : '#64748b' } },
        tooltip: {
          mode: 'index', intersect: false,
          callbacks: {
            label: ctx => ctx.parsed.y != null ? ' ' + ctx.dataset.label + ': ' + ctx.parsed.y.toFixed(2) + '%' : ''
          }
        }
      },
      scales: {
        y: {
          grid: { color: chartGridColor() },
          ticks: { callback: v => v + '%', color: chartTickColor() },
          beginAtZero: true
        },
        x: { grid: { display: false }, ticks: { color: chartTickColor() } }
      }
    }
  });
}

/* ─── Zone Tab ─── */
function renderZoneTab(f) {
  const list = filteredCenterSummary(f);
  const byZone = {};
  list.forEach(c => { if (!byZone[c.zone]) byZone[c.zone] = []; byZone[c.zone].push(c); });
  const zones = Object.keys(byZone).sort((a, b) => (parseInt(a.replace(/\D/g, ''), 10) || 0) - (parseInt(b.replace(/\D/g, ''), 10) || 0));
  DOM.zoneGrid.innerHTML = '';
  if (zones.length === 0) { DOM.zoneGrid.innerHTML = '<p class="text-sm" style="color:#94a3b8">No centers match filters.</p>'; return; }

  // Min/max across ALL filtered centers so colours are consistent between zone cards
  const allScores = list.map(c => c.totalScore);
  const minScore = Math.min.apply(null, allScores);
  const maxScore = Math.max.apply(null, allScores);

  zones.forEach(zone => {
    const centers = byZone[zone].slice().sort((a, b) => a.zoneRank - b.zoneRank);
    const card = document.createElement('div');
    card.className = 'bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden';
    card.innerHTML = `
      <div class="zone-banner text-white px-4 py-3 flex items-center justify-between">
        <span class="font-bold tracking-wide">${zone}</span>
        <span class="text-xs bg-white/20 px-2 py-0.5 rounded-full">${centers.length} centers</span>
      </div>
      <div style="overflow-y:auto;max-height:320px">
        <table class="w-full text-xs"><thead><tr class="bg-slate-50" style="color:#64748b">
          <th class="p-2.5 text-left">Center</th><th class="p-2.5">Score</th><th class="p-2.5">Rank</th>
        </tr></thead><tbody>${centers.map(c =>
          '<tr class="border-t border-slate-50"><td class="p-2.5 font-medium">' + c.center +
          '</td><td class="p-2.5 text-center" style="' + scoreGradientStyle(c.totalScore, minScore, maxScore) + '">' + c.totalScore.toFixed(2) + '%' +
          '</td><td class="p-2.5 text-center font-bold" style="color:#e21b38">#' + c.zoneRank + '</td></tr>'
        ).join('')}</tbody></table>
      </div>`;
    DOM.zoneGrid.appendChild(card);
  });
}

/* ─── Region Tab ─── */
function renderRegionTab(f) {
  const list = filteredCenterSummary(f);
  const byRegion = {};
  list.forEach(c => { if (!byRegion[c.region]) byRegion[c.region] = []; byRegion[c.region].push(c); });
  const regions = Object.keys(byRegion).sort();
  DOM.regionGrid.innerHTML = '';
  if (regions.length === 0) { DOM.regionGrid.innerHTML = '<p class="text-sm" style="color:#94a3b8">No centers match filters.</p>'; return; }

  // Min/max across ALL filtered centers so colours are consistent between region cards
  const allScores = list.map(c => c.totalScore);
  const minScore = Math.min.apply(null, allScores);
  const maxScore = Math.max.apply(null, allScores);

  regions.forEach(region => {
    const centers = byRegion[region].slice().sort((a, b) => a.overallRank - b.overallRank);
    const card = document.createElement('div');
    card.className = 'bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden';
    card.innerHTML = `
      <div class="region-banner text-white px-4 py-3 flex items-center justify-between">
        <span class="font-bold tracking-wide">${region}</span>
        <span class="text-xs bg-white/20 px-2 py-0.5 rounded-full">${centers.length} centers</span>
      </div>
      <div style="overflow-y:auto;max-height:320px">
        <table class="w-full text-xs"><thead><tr class="bg-slate-50" style="color:#64748b">
          <th class="p-2.5 text-left">Center</th><th class="p-2.5">Score</th><th class="p-2.5">Zone</th><th class="p-2.5">Rank</th>
        </tr></thead><tbody>${centers.map(c =>
          '<tr class="border-t border-slate-50"><td class="p-2.5 font-medium">' + c.center +
          '</td><td class="p-2.5 text-center" style="' + scoreGradientStyle(c.totalScore, minScore, maxScore) + '">' + c.totalScore.toFixed(2) + '%' +
          '</td><td class="p-2.5 text-center" style="color:#64748b">' + c.zone +
          '</td><td class="p-2.5 text-center font-bold" style="color:#e21b38">#' + c.overallRank + '</td></tr>'
        ).join('')}</tbody></table>
      </div>`;
    DOM.regionGrid.appendChild(card);
  });
}

/* Excel-style continuous colour scale — lowest value → red, highest → green.
   Returns an inline style for the score cell; adapts to the active theme. */
function scoreGradientStyle(v, min, max) {
  const t = max === min ? 0.5 : Math.max(0, Math.min(1, (v - min) / (max - min)));
  const stops = [[239, 68, 68], [245, 158, 11], [16, 185, 129]]; // red → amber → green
  const seg = t * 2;
  const i = Math.min(2, Math.floor(seg));
  const k = seg - i;
  const a = stops[i], b = stops[Math.min(2, i + 1)];
  const r = Math.round(a[0] + (b[0] - a[0]) * k);
  const g = Math.round(a[1] + (b[1] - a[1]) * k);
  const bl = Math.round(a[2] + (b[2] - a[2]) * k);
  const dark = document.documentElement.classList.contains('dark');
  const bg = dark
    ? 'linear-gradient(135deg, rgba(' + r + ',' + g + ',' + bl + ',0.45), rgba(' + r + ',' + g + ',' + bl + ',0.20))'
    : 'linear-gradient(135deg, rgba(' + r + ',' + g + ',' + bl + ',0.30), rgba(' + r + ',' + g + ',' + bl + ',0.10))';
  const fg = dark ? '#f1f5f9' : '#0f172a';
  return 'background:' + bg + ';color:' + fg + ';font-weight:600;border-radius:6px;';
}

/* ═══════════════════════════════════════════════════════════════
   DETAILED DATA — PROFESSIONAL SINGLE-COLOR EXCEL GRID
   ═══════════════════════════════════════════════════════════════ */

function renderLatestTable() {
  const f = getFilters();
  const search = (DOM.detailSearch.value || '').toLowerCase().trim();
  let rows = DATA.latestTable.filter(r => {
    if (f.region !== 'All' && r.region !== f.region) return false;
    if (f.zone !== 'All' && r.zone !== f.zone) return false;
    if (f.center !== 'All' && r.center !== f.center) return false;
    if (!search) return true;
    return (r.center + ' ' + r.region + ' ' + r.zone + ' ' + r.businessHead + ' ' + r.centerHead).toLowerCase().includes(search);
  });

  // ─── Column definitions ───
  // Only 4 frozen: #, Region, Center, Zone
  const ID_COLS = ['#','Region','Center','Zone'];

  // Target columns — dynamically generated from SM_LIST like Achieved/Ach%
  function makeTgtFields() {
    var fields = [];
    SM_LIST.forEach(function(sm) {
      fields.push({group:'Targets', metric:sm.metric, sub:sm.sub, field:'Target', key:sm.key+'Target'});
      fields.push({group:'Targets', metric:sm.metric, sub:sm.sub, field:'Cap', key:sm.key+'Cap'});
    });
    return fields;
  }
  const tgtFields = makeTgtFields(); // 16 entries (8 × 2) // now 16, not 13

  // Achieved columns (8)
  const achFields = SM_LIST.map(sm => ({
    group:'Achieved', metric:sm.metric, sub:sm.sub, field:'Achieved', key:sm.key+'Achieved'
  }));

  // Ach% columns (8)
  const pctFields = SM_LIST.map(sm => ({
    group:'Ach. %', metric:sm.metric, sub:sm.sub, field:'%', key:sm.key+'AchPct', isPct:true
  }));

  const ALL_FIELDS = [].concat(tgtFields, achFields, pctFields);

  // Final score columns (3)
  const FINAL_COLS = [
    {name:'Score', key:'scorePct', isPct:true},
    {name:'Rank', key:'overallRank'},
    {name:'Z-Rank', key:'zonalRank'}
  ];

  // ─── Column enumeration ───
  const totalCols = ID_COLS.length + ALL_FIELDS.length + FINAL_COLS.length;
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const colLetters = [];
  for (let i = 0; i < totalCols; i++) {
    if (i < 26) colLetters.push(letters[i]);
    else colLetters.push('A' + letters[i - 26]);
  }

  // Frozen columns: #(0), Region(38), Center(128), Zone(278)
  const frozenPos = [0, 38, 128, 278];
  const idWidths = [36, 90, 150, 60];

  function isFrozen(ci) { return ci < ID_COLS.length; }

  function fStyle(ci, z, w) {
    var s = '';
    if (isFrozen(ci)) s += 'position:sticky;left:' + frozenPos[ci] + 'px;z-index:' + z + ';';
    if (w) s += 'min-width:' + w + 'px;';
    if (s) return ' style="' + s + '"';
    return '';
  }

  // ─── 4-row single-color header ───
  // Row 0: Letters (A B C...)
  // Row 1: Groups (Targets | Achieved | Ach. %)
  // Row 2: Metrics
  // Row 3: Sub-metric / field names

  var h = '<thead>';

  // Row 0: Letters
  h += '<tr class="detail-letter-row">';
  for (let ci = 0; ci < totalCols; ci++) {
    const w = ci < ID_COLS.length ? idWidths[ci] : 64;
    h += '<th' + fStyle(ci, 50, w) + '>' + colLetters[ci] + '</th>';
  }
  h += '</tr>';

  // Row 1: Groups
  h += '<tr class="detail-group-row">';
  for (let ci = 0; ci < ID_COLS.length; ci++) {
    h += '<th' + fStyle(ci, 44) + '>' + (ci === 0 ? '' : ID_COLS[ci]) + '</th>';
  }
  h += '<th colspan="' + tgtFields.length + '"' + fStyle(ID_COLS.length, 44) + '>Targets</th>';
  h += '<th colspan="' + achFields.length + '"' + fStyle(ID_COLS.length + tgtFields.length, 44) + '>Achieved</th>';
  h += '<th colspan="' + pctFields.length + '"' + fStyle(ID_COLS.length + tgtFields.length + achFields.length, 44) + '>Ach. %</th>';
  for (let fi = 0; fi < FINAL_COLS.length; fi++) {
    h += '<th' + fStyle(ID_COLS.length + ALL_FIELDS.length + fi, 44) + '>' + FINAL_COLS[fi].name + '</th>';
  }
  h += '</tr>';

  // Row 2: Metrics
  h += '<tr class="detail-metric-row">';
  for (let ci = 0; ci < ID_COLS.length; ci++) {
    h += '<th' + fStyle(ci, 38) + '></th>';
  }
  for (let fi = 0; fi < ALL_FIELDS.length; fi++) {
    h += '<th' + fStyle(ID_COLS.length + fi, 38) + '>' + ALL_FIELDS[fi].metric + '</th>';
  }
  for (let fi = 0; fi < FINAL_COLS.length; fi++) {
    h += '<th' + fStyle(ID_COLS.length + ALL_FIELDS.length + fi, 38) + '></th>';
  }
  h += '</tr>';

  // Row 3: Sub-metric / field
  h += '<tr class="detail-field-row">';
  for (let ci = 0; ci < ID_COLS.length; ci++) {
    h += '<th' + fStyle(ci, 32) + '>' + ID_COLS[ci] + '</th>';
  }
  for (let fi = 0; fi < ALL_FIELDS.length; fi++) {
    const fld = ALL_FIELDS[fi];
    let label = fld.sub;
    if (fld.field && fld.field !== 'Achieved' && fld.field !== '%') {
      label += ' (' + fld.field + ')';
    } else if (fld.field === '%') {
      label += ' %';
    }
    h += '<th' + fStyle(ID_COLS.length + fi, 32) + '>' + label + '</th>';
  }
  for (let fi = 0; fi < FINAL_COLS.length; fi++) {
    h += '<th' + fStyle(ID_COLS.length + ALL_FIELDS.length + fi, 32) + '>' + FINAL_COLS[fi].name + '</th>';
  }
  h += '</tr></thead>';

  // ─── Body ───
  function pctSpan(v) {
    if (v == null) return '<span class="cf-na">\u2014</span>';
    const cls = v >= 100 ? 'cf-green' : v >= 75 ? 'cf-amber' : v >= 50 ? 'cf-orange' : 'cf-red';
    return '<span class="' + cls + '">' + v.toFixed(1) + '%</span>';
  }

  let body = '<tbody>';
  for (let ri = 0; ri < rows.length; ri++) {
    const r = rows[ri];
    const vals = [
      String(ri + 1),
      r.region || '\u2014',
      r.center || '\u2014',
      r.zone || '\u2014'
    ];

    // Data fields
    for (let fi = 0; fi < ALL_FIELDS.length; fi++) {
      const fld = ALL_FIELDS[fi];
      const raw = r[fld.key];
      if (fld.isPct) {
        vals.push(pctSpan(raw));
      } else {
        vals.push(raw != null ? raw : '\u2014');
      }
    }

    // Final cols
    vals.push(
      r.scorePct != null
        ? '<span class="' + (r.scorePct >= 80 ? 'cf-green' : r.scorePct >= 60 ? 'cf-amber' : 'cf-red') + '">' + r.scorePct.toFixed(1) + '%</span>'
        : '\u2014',
      r.overallRank != null ? r.overallRank : '\u2014',
      r.zonalRank != null ? r.zonalRank : '\u2014'
    );

    // Column ranges for group coloring
    const tSt = ID_COLS.length, tEn = tSt + tgtFields.length;
    const aSt = tEn,       aEn = aSt + achFields.length;
    const pSt = aEn,       pEn = pSt + pctFields.length;

    body += '<tr>';
    for (let ci = 0; ci < vals.length; ci++) {
      let cls = 'detail-cell';
      if (ci === 0) cls = 'detail-rownum';
      else if (isFrozen(ci)) cls += ' detail-frozen' + (ci === 3 ? ' detail-frozen-zone' : '');
      else if (ci >= tSt && ci < tEn) cls += ' detail-num detail-target';
      else if (ci >= aSt && ci < aEn) cls += ' detail-num detail-achieved';
      else if (ci >= pSt)              cls += ' detail-num detail-pct';
      else                              cls += ' detail-num';

      body += '<td class="' + cls + '"' + (isFrozen(ci) ? ' style="left:' + frozenPos[ci] + 'px"' : '') + '>';
      body += vals[ci];
      body += '</td>';
    }
    body += '</tr>';
  }
  body += '</tbody>';

  DOM.latestTable.innerHTML = h + body;
  if (DOM.rowCountLabel) DOM.rowCountLabel.textContent = rows.length + ' rows';
  if (DOM.statusBarCount) DOM.statusBarCount.textContent = rows.length + ' records \u00b7 Filtered from ' + DATA.latestTable.length;
}

/* ═══════════════════════════════════════════════════════════════
   EXPORT CSV
   ═══════════════════════════════════════════════════════════════ */
function exportCsv() {
  const f = getFilters();
  const rows = DATA.latestTable.filter(r => {
    if (f.region !== 'All' && r.region !== f.region) return false;
    if (f.zone !== 'All' && r.zone !== f.zone) return false;
    if (f.center !== 'All' && r.center !== f.center) return false;
    return true;
  });

  const tgtHeaders = SM_LIST.flatMap(sm => [sm.sub + ' (Target)', sm.sub + ' (Cap)']);
  const achHeaders = SM_LIST.map(sm => sm.sub + ' (Achieved)');
  const pctHeaders = SM_LIST.map(sm => sm.sub + ' (%)');
  const headers = ['Region', 'Center', 'Zone', 'Bus. Head', 'Center Head',
    ...tgtHeaders, ...achHeaders, ...pctHeaders,
    'Score %', 'Rank', 'Z-Rank'];

  const csvRows = [headers.join(',')];
  rows.forEach(r => {
    const tgtVals = SM_LIST.flatMap(sm => [r[sm.key + 'Target'] ?? '', r[sm.key + 'Cap'] ?? '']);
    const achVals = SM_LIST.map(sm => r[sm.key + 'Achieved'] ?? '');
    const pctVals = SM_LIST.map(sm => r[sm.key + 'AchPct'] != null ? r[sm.key + 'AchPct'].toFixed(1) + '%' : '');
    const vals = [r.region, r.center, r.zone, r.businessHead, r.centerHead,
      ...tgtVals, ...achVals, ...pctVals,
      r.scorePct != null ? r.scorePct.toFixed(1) + '%' : '',
      r.overallRank ?? '', r.zonalRank ?? ''];
    csvRows.push(vals.map(v => String(v).includes(',') ? '"' + v + '"' : v).join(','));
  });

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'VP_Dashboard_Data_' + new Date().toISOString().slice(0, 10) + '.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}

/* ═══════════════════════════════════════════════════════════════
   SUB-METRIC STACKED BAR CHARTS
   ═══════════════════════════════════════════════════════════════ */
function renderSubMetricCharts(f) {
  const container = document.getElementById('submetricChartsGrid');
  const subtitle = document.getElementById('submetricSubtitle');
  if (!container) return;

  // Destroy old sub-metric charts
  Object.keys(CHARTS).forEach(k => {
    if (k.startsWith('submetric-')) { CHARTS[k].destroy(); delete CHARTS[k]; }
  });
  container.innerHTML = '';

  let metrics = [];
  let labelPrefix = '';
  if (f.metric === 'All') {
    metrics = DATA.meta.metrics;
    labelPrefix = 'All Metrics';
  } else {
    metrics = [f.metric];
    labelPrefix = f.metric;
  }
  if (subtitle) subtitle.textContent = labelPrefix + ' \u2014 Target vs Min/Max Cap vs Achieved by sub-metric';

  // Base rows filtered by region/zone/center (but NOT metric)
  const baseRows = DATA.rawRows.filter(r =>
    r.date === f.date &&
    (f.region === 'All' || r.region === f.region) &&
    (f.zone   === 'All' || r.zone   === f.zone) &&
    (f.center === 'All' || r.center === f.center)
  );

  if (baseRows.length === 0) {
    container.innerHTML = '<p class="text-sm text-slate-400 col-span-2 text-center py-8">No data matches current filters.</p>';
    return;
  }

  metrics.forEach((metric, mi) => {
    const metricRows = baseRows.filter(r => r.metric === metric);
    if (metricRows.length === 0) return;

    // Group by sub-metric
    const bySub = {};
    metricRows.forEach(r => {
      const sub = String(r.subMetric || 'Overall').trim();
      if (!sub || sub === 'None' || sub === '-') return;
      if (!bySub[sub]) bySub[sub] = { targetSum: 0, capSum: 0, achievedSum: 0, count: 0 };
      bySub[sub].targetSum += (r.target  != null ? r.target : 0);
      bySub[sub].capSum    += (r.cap     != null ? r.cap : 0);
      bySub[sub].achievedSum += (r.achieved != null ? r.achieved : 0);
      bySub[sub].count++;
    });

    const subLabels = Object.keys(bySub);
    if (subLabels.length === 0) return;

    const targetData    = subLabels.map(s => round2_(bySub[s].targetSum    / bySub[s].count));
    const capData       = subLabels.map(s => round2_(bySub[s].capSum       / bySub[s].count));
    const achievedData  = subLabels.map(s => round2_(bySub[s].achievedSum  / bySub[s].count));

    // Card
    const cardIdx = mi + '_' + metric.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const card = document.createElement('div');
    card.className = 'bg-white rounded-2xl shadow-sm border border-slate-100 p-4 md:p-5';

    let headerHtml = '';
    if (f.metric === 'All') {
      headerHtml = '<div class="flex items-center gap-2 mb-3">' +
        '<div class="w-7 h-7 rounded-lg bg-gradient-to-br from-red-500 to-red-800 flex items-center justify-center text-white text-xs"><i class="fa-solid fa-chart-bar"></i></div>' +
        '<h3 class="font-semibold text-sm">' + escapeHtml(metric) + '</h3>' +
        '<span class="text-xs text-slate-400 ml-auto">' + subLabels.length + ' sub-metrics</span></div>';
    } else {
      headerHtml = '<div class="flex items-center gap-2 mb-3">' +
        '<div class="w-7 h-7 rounded-lg bg-gradient-to-br from-red-500 to-red-800 flex items-center justify-center text-white text-xs"><i class="fa-solid fa-chart-bar"></i></div>' +
        '<h3 class="font-semibold text-sm">Sub-Metric Breakdown</h3>' +
        '<span class="text-xs text-slate-400 ml-auto">' + subLabels.length + ' sub-metrics</span></div>';
    }
    card.innerHTML = headerHtml +
      '<div class="relative" style="height:300px"><canvas id="submetric-canvas-' + cardIdx + '"></canvas></div>';
    container.appendChild(card);

    // Chart
    const ctx = document.getElementById('submetric-canvas-' + cardIdx).getContext('2d');
    const chartKey = 'submetric-' + cardIdx;
    CHARTS[chartKey] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: subLabels,
        datasets: [
          { label: 'Target',     data: targetData,    backgroundColor: 'rgba(16,185,129,0.85)', borderColor: '#10b981', borderWidth: 1, borderRadius: 4 },
          { label: 'Min/Max Cap', data: capData,      backgroundColor: 'rgba(245,158,11,0.85)', borderColor: '#f59e0b', borderWidth: 1, borderRadius: 4 },
          { label: 'Achieved',   data: achievedData, backgroundColor: 'rgba(59,130,246,0.85)', borderColor: '#3b82f6', borderWidth: 1, borderRadius: 4 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12, font: { size: 11 }, color: darkMode ? '#cbd5e1' : '#64748b' } },
          tooltip: {
            mode: 'index', intersect: false,
            callbacks: {
              label: function(ctx) {
                return ctx.dataset.label + ': ' + (ctx.parsed.y != null ? ctx.parsed.y.toFixed(2) : '0');
              }
            }
          }
        },
        scales: {
          x: {
            stacked: false, grid: { display: false },
            ticks: { font: { size: 11 }, color: chartTickColor() }
          },
          y: {
            stacked: false, beginAtZero: true,
            grid: { color: chartGridColor() },
            ticks: { font: { size: 11 }, color: chartTickColor() }
          }
        }
      }
    });
  });

  if (container.children.length === 0) {
    container.innerHTML = '<p class="text-sm text-slate-400 col-span-2 text-center py-8">No sub-metric data for current selection.</p>';
  }
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function uniq(arr) { return Array.from(new Set(arr.filter(Boolean))); }
function debounce(fn, wait) { let t; return function(...a) { clearTimeout(t); t = setTimeout(function() { fn.apply(this, a); }, wait); }; }
