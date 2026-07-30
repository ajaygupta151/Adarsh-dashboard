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
let darkMode = false;

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
  if (darkMode) {
    document.body.style.background = '#0c0a20';
    document.querySelectorAll('.bg-white, .kpi-card').forEach(el => el.style.background = '#161330');
    document.querySelectorAll('.text-slate-800').forEach(el => el.style.color = '#e2e8f0');
  } else {
    document.body.style.background = '#f0f2f8';
    document.querySelectorAll('.bg-white, .kpi-card').forEach(el => el.style.background = '');
    document.querySelectorAll('.text-slate-800').forEach(el => el.style.color = '');
  }
}

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
      <button onclick="location.reload()" class="mt-5" style="background:#4f46e5;color:#fff;border:none;padding:10px 24px;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer">
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
      scales: { x: { grid: { color: '#f1f5f9' }, ticks: { callback: v => v + '%' } }, y: { grid: { display: false } } }
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
      scales: { y: { grid: { color: '#f1f5f9' }, ticks: { callback: v => v + '%' } }, x: { grid: { display: false } } }
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
  metrics.forEach(m => { html += '<th class="p-2 bg-slate-50 text-center" style="color:#4f46e5;font-weight:600">' + m + '</th>'; });
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
    borderColor: '#1e293b',
    backgroundColor: function(ctx) {
      if (!ctx.chart.chartArea) return 'rgba(30,41,59,0.08)';
      var g = ctx.chart.ctx.createLinearGradient(0, ctx.chart.chartArea.top, 0, ctx.chart.chartArea.bottom);
      g.addColorStop(0, 'rgba(30,41,59,0.15)');
      g.addColorStop(1, 'rgba(30,41,59,0.01)');
      return g;
    },
    fill: true,
    tension: 0.4,
    pointRadius: 3,
    pointHoverRadius: 7,
    pointBackgroundColor: '#1e293b',
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
        legend: { position: 'bottom', labels: { boxWidth: 14, padding: 14, font: { size: 11 } } },
        tooltip: {
          mode: 'index', intersect: false,
          callbacks: {
            label: ctx => ctx.parsed.y != null ? ' ' + ctx.dataset.label + ': ' + ctx.parsed.y.toFixed(2) + '%' : ''
          }
        }
      },
      scales: {
        y: {
          grid: { color: '#f1f5f9' },
          ticks: { callback: v => v + '%' },
          beginAtZero: true
        },
        x: { grid: { display: false } }
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
          '</td><td class="p-2.5 text-center ' + scoreClass(c.totalScore) + '">' + c.totalScore.toFixed(2) + '%' +
          '</td><td class="p-2.5 text-center font-bold" style="color:#4f46e5">#' + c.zoneRank + '</td></tr>'
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
          '</td><td class="p-2
