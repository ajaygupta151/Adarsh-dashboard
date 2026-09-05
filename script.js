/* ═══════════════════════════════════════════════════════════════
   VP Operations Command Center — JavaScript
   ═══════════════════════════════════════════════════════════════ */

/* ─── CONFIG ─── */
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQv78E-sNx7jHuv9RTfBJcw1-mGCXHijRtRbuCJut-T2A3ccncV3C_XXTe7iM1XEloaZ335wNrCh1cf/pub?gid=1425114708&single=true&output=csv';

const COL = {
  DATE: 0, CENTER: 1, REGION: 2, ZONE: 3, METRIC: 4, SUBMETRIC: 5,
  TARGET: 6, CAP: 7, ACHIEVED: 8, METRIC_WEIGHT: 9, OVERALL_WEIGHT: 10,
  METRIC_ACH_PCT: 12, OVERALL_ACH_PCT: 13, BUSINESS_HEAD: 14, CENTER_HEAD: 15
};

/* ─── Metrics & Sub-metrics ───
   These are NOT hardcoded. The sheet's "Metric" and "Sub-metric" columns are
   the source of truth — whatever unique values appear there (in first-seen
   order) become the metric list and, per metric, the sub-metric list. This
   means adding/renaming/removing a metric or sub-metric in the sheet is
   automatically reflected everywhere in the dashboard without code changes.
   See buildMetricOrder_() and buildSmList_() below. */

let DATA = null;
const CHARTS = {};
const DOM = {};
let darkMode = true; // default dark (Physics Wallah branding)

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
  DOM.filterRegion = document.getElementById('ddRegion');
  DOM.filterZone = document.getElementById('ddZone');
  DOM.filterCenter = document.getElementById('ddCenter');
  DOM.filterMetric = document.getElementById('ddMetric');
  DOM.filterSubmetric = document.getElementById('ddSubmetric');
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

  DOM.insightTop10 = document.getElementById('insightTop10');
  DOM.insightBottom10 = document.getElementById('insightBottom10');
  DOM.insightHeatmap = document.getElementById('insightHeatmap');
  DOM.insightTrend = document.getElementById('insightTrend');
  DOM.insightSubmetric = document.getElementById('insightSubmetric');

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
  DOM.topWhyList = document.getElementById('topWhyList');
  DOM.bottomWhyList = document.getElementById('bottomWhyList');
  DOM.zoneInsightsList = document.getElementById('zoneInsightsList');
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

  const metricOrder = buildMetricOrder_(rawRows);
  const smList = buildSmList_(rawRows);

  const meta = buildMeta_(rawRows, dates, latestDate, metricOrder, smList);
  const centerSummary = buildCenterSummary_(rawRows, latestDate, metricOrder);
  computeRanks_(centerSummary, 'totalScore', 'overallRank');
  computeZoneRanks_(centerSummary);

  const zoneWise = groupBy_(centerSummary, 'zone');
  const regionWise = groupBy_(centerSummary, 'region');
  const latestTable = buildLatestTable_(rawRows, latestDate, centerSummary, smList);

  return { meta, rawRows, centerSummary, zoneWise, regionWise, latestTable };
}

/* ─── Dynamic metric order ───
   Unique values from the Metric column, in first-appearance order in the
   sheet. This becomes the canonical order used across KPIs, charts, the
   heatmap and the trend lines. */
function buildMetricOrder_(rawRows) {
  const seen = new Set(), order = [];
  rawRows.forEach(r => {
    const m = r.metric;
    if (m && !seen.has(m)) { seen.add(m); order.push(m); }
  });
  return order;
}

/* ─── Dynamic sub-metric list ───
   Unique (Metric, Sub-metric) pairs, in first-appearance order, scoped per
   metric. Each entry gets a stable, unique, machine-safe key derived from
   its metric + sub-metric text (used as an object key throughout the pivot
   table / export, since the underlying names can contain spaces, slashes,
   parentheses, etc.). Callers that need "sub-metrics for metric X" can
   filter this list by .metric — see renderSubMetricCharts() which already
   does this per-row for chart drill-down. */
function buildSmList_(rawRows) {
  const seen = new Set(), list = [];
  rawRows.forEach(r => {
    if (!r.metric || !r.subMetric) return;
    const pairKey = r.metric + '||' + r.subMetric;
    if (seen.has(pairKey)) return;
    seen.add(pairKey);
    list.push({ metric: r.metric, sub: r.subMetric, key: uniqueSlug_(r.metric, r.subMetric) });
  });
  return list;
}

/* Machine-safe, collision-free key for a (metric, sub-metric) pair. */
function slugify_(str) {
  return String(str).toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'x';
}
const _slugKeysInUse_ = new Set();
function uniqueSlug_(metric, sub) {
  let base = slugify_(metric) + '__' + slugify_(sub);
  let key = base, n = 2;
  while (_slugKeysInUse_.has(key)) { key = base + '_' + n; n++; }
  _slugKeysInUse_.add(key);
  return key;
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

function buildMeta_(rawRows, dates, latestDate, metricOrder, smList) {
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
    metrics: metricOrder,
    smList: smList,
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

function buildCenterSummary_(rawRows, latestDate, metricOrder) {
  const latestRows = rawRows.filter(r => r.date === latestDate);
  const byCenter = {};
  latestRows.forEach(r => {
    if (!byCenter[r.center]) {
      byCenter[r.center] = {
        center: r.center, region: r.region, zone: r.zone,
        businessHead: r.businessHead, centerHead: r.centerHead,
        totalScore: 0, overallRank: null, zoneRank: null,
        metricScores: metricOrder.reduce((a, m) => { a[m] = 0; return a; }, {})
      };
    }
    const c = byCenter[r.center];
    c.totalScore += (r.overallAchPct || 0);
    if (c.metricScores.hasOwnProperty(r.metric)) c.metricScores[r.metric] += (r.overallAchPct || 0);
  });
  return Object.keys(byCenter).map(k => {
    const c = byCenter[k];
    c.totalScore = round2_(c.totalScore);
    metricOrder.forEach(m => { c.metricScores[m] = round2_(c.metricScores[m]); });
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
function buildLatestTable_(rawRows, latestDate, centerSummary, smList) {
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
    smList.forEach(sm => {
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
      row[sm.key + 'AchPct'] = get(sm.metric + '||' + sm.sub, 'overallAchPct');
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
  msFill('ddRegion', DATA.meta.regions.map(r => ({ v: r, l: r })));
  msFill('ddZone', DATA.meta.zones.map(z => ({ v: z, l: z })));
  msFill('ddMetric', DATA.meta.metrics.map(m => ({ v: m, l: m })));
  populateSubmetricFilter();
  populateCenterFilter();
}

/* Sub-Metric options cascade from the selected Metric(s) — only sub-metrics that
   actually belong to those metrics (per DATA.meta.smList) are shown. When no
   metric is selected, every sub-metric across all metrics is shown; if the same
   sub-metric text exists under more than one metric, its label is disambiguated
   with the metric name so the selection stays unambiguous. */
function populateSubmetricFilter() {
  const metricSel = msGet('ddMetric');
  let entries = DATA.meta.smList;
  if (metricSel.length > 0) entries = entries.filter(sm => metricSel.includes(sm.metric));

  const subTextCount = {};
  entries.forEach(sm => { subTextCount[sm.sub] = (subTextCount[sm.sub] || 0) + 1; });

  const opts = entries.map(sm => ({
    v: sm.metric + '||' + sm.sub,
    l: subTextCount[sm.sub] > 1 ? (sm.sub + ' (' + sm.metric + ')') : sm.sub
  }));
  msFill('ddSubmetric', opts);
}

function populateCenterFilter() {
  const region = msGet('ddRegion');
  const zone = msGet('ddZone');
  const centers = DATA.meta.centersMeta
    .filter(c => (region.length === 0 || region.includes(c.region)) && (zone.length === 0 || zone.includes(c.zone)))
    .map(c => ({ v: c.name, l: c.name }));
  msFill('ddCenter', centers);
}

function fillSelect(el, opts, sel) {
  el.innerHTML = opts.map(o => '<option value="' + o.v + '" ' + (o.v === sel ? 'selected' : '') + '>' + o.l + '</option>').join('');
}

/* ─── Multi-select dropdown helpers ───
   Semantics: "All" checkbox at top. When it (or nothing) is checked, the
   selection is [] which means "everything". Checking specific options returns
   the array of checked values. */
function msFill(ddId, opts) {
  const dd = document.getElementById(ddId);
  const panel = dd.querySelector('.ms-panel');
  const allLabel = dd.querySelector('.ms-btn').getAttribute('data-all-label') || 'All';
  const prev = msGet(ddId);
  const allChecked = prev.length === 0;
  let html = '<label class="ms-opt flex items-center gap-2"><input type="checkbox" value="All" class="ms-cb" ' + (allChecked ? 'checked' : '') + '> <span>' + allLabel + '</span></label>';
  html += opts.map(o => {
    const checked = !allChecked && prev.includes(o.v) ? 'checked' : '';
    return '<label class="ms-opt flex items-center gap-2"><input type="checkbox" value="' + escapeHtml(o.v) + '" data-label="' + escapeHtml(o.l) + '" class="ms-cb" ' + checked + '> <span>' + escapeHtml(o.l) + '</span></label>';
  }).join('');
  panel.innerHTML = html;
  msLabel(ddId);
}

function msGet(ddId) {
  const panel = document.getElementById(ddId).querySelector('.ms-panel');
  const checked = Array.from(panel.querySelectorAll('.ms-cb:checked')).map(cb => cb.value);
  if (checked.length === 0 || checked.includes('All')) return [];
  return checked;
}

function msLabel(ddId) {
  const dd = document.getElementById(ddId);
  const labelEl = dd.querySelector('.ms-label');
  const allLabel = dd.querySelector('.ms-btn').getAttribute('data-all-label') || 'All';
  const panel = dd.querySelector('.ms-panel');
  const checked = Array.from(panel.querySelectorAll('.ms-cb:checked'));
  if (checked.length === 0 || checked.some(c => c.value === 'All')) {
    labelEl.textContent = allLabel;
  } else if (checked.length <= 2) {
    labelEl.textContent = checked.map(c => c.getAttribute('data-label') || c.value).join(', ');
  } else {
    labelEl.textContent = checked.length + ' selected';
  }
}

function msReset(ddId) {
  const panel = document.getElementById(ddId).querySelector('.ms-panel');
  panel.querySelectorAll('.ms-cb').forEach(c => { c.checked = c.value === 'All'; });
  msLabel(ddId);
}

function msWire(ddId, onChange) {
  const dd = document.getElementById(ddId);
  const btn = dd.querySelector('.ms-btn');
  const panel = dd.querySelector('.ms-panel');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.ms-panel.open').forEach(p => { if (p !== panel) p.classList.remove('open'); });
    panel.classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    if (!dd.contains(e.target)) panel.classList.remove('open');
  });
  panel.addEventListener('change', (e) => {
    const cb = e.target;
    if (!cb.classList.contains('ms-cb')) return;
    if (cb.value === 'All') {
      panel.querySelectorAll('.ms-cb').forEach(c => { c.checked = cb.checked; });
    } else if (cb.checked) {
      // User checked a specific box: if "All" was checked, uncheck it so the
      // selection narrows to the checked boxes only.
      const allCb = panel.querySelector('.ms-cb[value="All"]');
      if (allCb.checked) allCb.checked = false;
      const specific = Array.from(panel.querySelectorAll('.ms-cb')).filter(c => c.value !== 'All');
      if (specific.every(c => c.checked)) allCb.checked = true;
    } else {
      panel.querySelector('.ms-cb[value="All"]').checked = false;
    }
    msLabel(ddId);
    if (onChange) onChange();
  });
}

function inFilter(val, arr) { return arr.length === 0 || arr.includes(val); }

function wireEvents() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = document.getElementById('tab-' + btn.dataset.tab);
      if (panel) panel.classList.add('active');
      if (btn.dataset.tab === 'overview' || btn.dataset.tab === 'detailoverview') renderAll();
    });
  });

  msWire('ddRegion', () => { populateCenterFilter(); renderAll(); });
  msWire('ddZone', () => { populateCenterFilter(); renderAll(); });
  DOM.filterDate.addEventListener('change', renderAll);
  msWire('ddCenter', renderAll);
  msWire('ddMetric', () => { populateSubmetricFilter(); renderAll(); });
  msWire('ddSubmetric', renderAll);

  DOM.resetFiltersBtn.addEventListener('click', () => {
    fillSelect(DOM.filterDate, DATA.meta.dates.map(d => ({ v: d, l: d })), DATA.meta.lastUpdatedRaw);
    msReset('ddRegion');
    msReset('ddZone');
    msReset('ddMetric');
    populateSubmetricFilter();
    msReset('ddSubmetric');
    populateCenterFilter();
    msReset('ddCenter');
    DOM.detailSearch.value = '';
    renderAll();
  });

  DOM.detailSearch.addEventListener('input', debounce(renderLatestTable, 150));
}

function getFilters() {
  return {
    date: DOM.filterDate.value, region: msGet('ddRegion'),
    zone: msGet('ddZone'), center: msGet('ddCenter'),
    metric: msGet('ddMetric'), submetric: msGet('ddSubmetric')
  };
}

function computeScoresForDate(date, f) {
  const rows = DATA.rawRows.filter(r =>
    r.date === date &&
    inFilter(r.region, f.region) &&
    inFilter(r.zone, f.zone) &&
    inFilter(r.center, f.center)
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
    inFilter(c.region, f.region) &&
    inFilter(c.zone, f.zone) &&
    inFilter(c.center, f.center)
  );
}

function renderAll() {
  const f = getFilters();
  renderKpis(f);
  renderTopBottomChart(f);
  renderTopBottomInsights(f);
  renderZoneComparisonChart(f);
  renderZoneInsights(f);
  renderHeatmap(f);
  renderTrendChart(f);
  renderSubMetricCharts(f);
  renderZoneTab(f);
  renderRegionTab(f);
  renderLatestTable();
  renderDetailedOverview(f);
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

/* ─── Frozen Y-axis scrollable line chart ───
   Dates run horizontally (oldest at left, newest at right). The % axis
   (left) stays frozen while the chart scrolls horizontally, so older dates
   are reachable by scrolling right. % values are dynamic (from data). */
function niceTicks_(min, max, count) {
  const span = max - min;
  if (span <= 0 || !isFinite(span)) return [min];
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const norm = step0 / mag;
  const step = (norm >= 3 ? 5 : norm >= 1.5 ? 2 : norm >= 0.75 ? 1 : 0.5) * mag;
  const ticks = [];
  for (let v = Math.floor(min / step) * step; v <= Math.ceil(max / step) * step + 1e-9; v += step) {
    ticks.push(Math.round(v * 100) / 100);
  }
  return ticks;
}

function renderFrozenYChart(cfg) {
  // cfg: { wrapId, frozenYId, legendId, canvasId, chartKey,
  //        dates, datasets, yMin, yMax, tickColor, gridColor, canvasH? }
  const wrap = document.getElementById(cfg.wrapId);
  const fy = document.getElementById(cfg.frozenYId);
  if (!wrap || !fy) return;
  const scroller = wrap.parentElement;
  const availW = scroller.clientWidth || 600;
  const pxPerDate = 100;
  const padTop = 10, padBottom = 10, padLeft = 50, padRight = 10;
  const canvasW = Math.max(availW, cfg.dates.length * pxPerDate);
  const canvasH = cfg.canvasH || 320;
  wrap.style.width = canvasW + 'px';
  wrap.style.height = canvasH + 'px';

  // Canvas must be sized explicitly (responsive:false ignores container size)
  const canvas = wrap.querySelector('canvas');
  if (canvas) {
    canvas.width = canvasW;
    canvas.height = canvasH;
    canvas.style.width = canvasW + 'px';
    canvas.style.height = canvasH + 'px';
  }

  // % ticks (frozen left column) — dynamic values from data.
  // suffix is configurable: percentage metrics use '%', count metrics (e.g.
  // Admission) use ''. decimals controls tooltip precision (0 for counts).
  const suffix = cfg.suffix != null ? cfg.suffix : '%';
  const decimals = cfg.decimals != null ? cfg.decimals : 2;
  const ticks = niceTicks_(cfg.yMin, cfg.yMax, 5);
  const tMin = ticks[0], tMax = ticks[ticks.length - 1];
  const step = ticks.length > 1 ? ticks[1] - ticks[0] : 1;
  const plotH = canvasH - padTop - padBottom;
  fy.innerHTML = ticks.map(t => {
    const y = padTop + (1 - (t - tMin) / (tMax - tMin)) * plotH;
    return '<div style="position:absolute;top:' + y + 'px;transform:translateY(-50%);left:0;right:0;text-align:center;font-size:11px;color:' + cfg.tickColor + '">' + t + suffix + '</div>';
  }).join('');
  fy.style.height = canvasH + 'px';

  // HTML legend (below the chart) — click a label to show/hide that line
  const legend = document.getElementById(cfg.legendId);
  if (legend) {
    legend.innerHTML = cfg.datasets.map((ds, i) => {
      const c = ds.borderColor || ds.backgroundColor;
      return '<span data-idx="' + i + '" class="flex items-center gap-1.5 cursor-pointer select-none" style="color:' + cfg.tickColor + '" title="Click to show/hide"><span style="width:10px;height:3px;border-radius:2px;background:' + c + ';display:inline-block"></span>' + ds.label + '</span>';
    }).join('');
    legend.querySelectorAll('[data-idx]').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.getAttribute('data-idx'), 10);
        const chart = CHARTS[cfg.chartKey];
        if (!chart || !chart.data.datasets[idx]) return;
        const ds = chart.data.datasets[idx];
        ds.hidden = !ds.hidden;
        chart.update();
        item.style.opacity = ds.hidden ? '0.35' : '1';
        item.style.textDecoration = ds.hidden ? 'line-through' : 'none';
      });
    });
  }

  // Chart (dates on X-axis, % on Y-axis)
  upsertChart(cfg.chartKey, cfg.canvasId, {
    type: 'line',
    data: { labels: cfg.dates, datasets: cfg.datasets },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { top: padTop, left: padLeft, right: padRight, bottom: padBottom } },
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index', intersect: false,
          callbacks: { label: function(ctx) { return ' ' + ctx.dataset.label + ': ' + (ctx.parsed.y != null ? ctx.parsed.y.toFixed(decimals) : '') + suffix; } }
        }
      },
      scales: {
        y: {
          min: tMin, max: tMax,
          ticks: { display: false, stepSize: step },
          grid: { color: cfg.gridColor }
        },
        x: {
          offset: true,
          ticks: { color: cfg.tickColor, maxRotation: 0, minRotation: 0, autoSkip: false },
          grid: { display: false }
        }
      }
    }
  });

  // Start scrolled to the right so the newest (rightmost) dates are visible;
  // users scroll left to see older dates. Retry a few frames: on initial load
  // layout may not be ready when the first rAF fires (scrollWidth = 0), so
  // keep re-applying until the scroll actually lands at the end.
  let tries = 0;
  (function scrollToEnd() {
    scroller.scrollLeft = scroller.scrollWidth;
    if (tries++ < 10) requestAnimationFrame(scrollToEnd);
  })();
}

function renderTopBottomChart(f) {
  const scores = computeScoresForDate(f.date, f).sort((a, b) => b.score - a.score);
  const top10 = scores.slice(0, 10);
  const bottom10 = scores.slice(-10).reverse();

  // ─── Top 10 Centers (green) ───
  upsertChart('top10', 'chartTop10', {
    type: 'bar',
    data: { labels: top10.map(c => c.center), datasets: [{ label: 'Score %', data: top10.map(c => c.score), backgroundColor: '#10b981', borderRadius: 6, borderSkipped: false }] },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ctx.parsed.x.toFixed(2) + '%' } } },
      scales: {
        x: { grid: { color: chartGridColor() }, ticks: { callback: v => v + '%', color: chartTickColor() } },
        y: { grid: { display: false }, ticks: { color: chartTickColor() } }
      }
    }
  });

  // ─── Bottom 10 Centers (red) ───
  upsertChart('bottom10', 'chartBottom10', {
    type: 'bar',
    data: { labels: bottom10.map(c => c.center), datasets: [{ label: 'Score %', data: bottom10.map(c => c.score), backgroundColor: '#f43f5e', borderRadius: 6, borderSkipped: false }] },
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

/* ─── Why top / why bottom ───
   For the selected date, explains each Top-10 center's biggest metric
   contributor and each Bottom-10 center's weakest metric, so a manager can
   see at a glance WHY a center is leading or lagging. */
function renderTopBottomInsights(f) {
  const topEl = DOM.topWhyList;
  const bottomEl = DOM.bottomWhyList;
  if (!topEl || !bottomEl) return;

  const scores = computeScoresForDate(f.date, f).sort((a, b) => b.score - a.score);
  if (scores.length === 0) {
    topEl.innerHTML = '<p class="text-sm text-slate-400">No data matches current filters.</p>';
    bottomEl.innerHTML = '';
    return;
  }
  const top10 = scores.slice(0, 10);
  const bottom10 = scores.slice(-10).reverse();

  // Per-center per-metric breakdown for the selected date (sum of overallAchPct)
  const rows = DATA.rawRows.filter(r =>
    r.date === f.date &&
    inFilter(r.region, f.region) &&
    inFilter(r.zone, f.zone) &&
    inFilter(r.center, f.center)
  );
  const byCenter = {};
  rows.forEach(r => {
    if (!byCenter[r.center]) byCenter[r.center] = { metrics: {} };
    byCenter[r.center].metrics[r.metric] = (byCenter[r.center].metrics[r.metric] || 0) + (r.overallAchPct || 0);
  });

  function strongest(center) {
    const m = byCenter[center] ? byCenter[center].metrics : {};
    let best = null, bestV = -Infinity;
    Object.keys(m).forEach(k => { if (m[k] > bestV) { bestV = m[k]; best = k; } });
    return best ? { metric: best, val: bestV } : null;
  }
  function weakest(center) {
    const m = byCenter[center] ? byCenter[center].metrics : {};
    let worst = null, worstV = Infinity;
    Object.keys(m).forEach(k => { if (m[k] < worstV) { worstV = m[k]; worst = k; } });
    return worst ? { metric: worst, val: worstV } : null;
  }

  topEl.innerHTML = top10.map((c, i) => {
    const s = strongest(c.center);
    const extra = s ? ' — driven by <b>' + escapeHtml(s.metric) + '</b> (' + s.val.toFixed(2) + ' pts)' : '';
    return '<div class="flex items-start gap-2 py-1.5">' +
      '<span class="text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 shrink-0">#' + (i + 1) + '</span>' +
      '<span class="text-xs"><b>' + escapeHtml(c.center) + '</b> <span class="text-emerald-600 font-semibold">' + c.score.toFixed(2) + '%</span>' + extra + '</span></div>';
  }).join('');

  bottomEl.innerHTML = bottom10.map((c, i) => {
    const w = weakest(c.center);
    const extra = w ? ' — dragged down by <b>' + escapeHtml(w.metric) + '</b> (' + w.val.toFixed(2) + ' pts)' : '';
    return '<div class="flex items-start gap-2 py-1.5">' +
      '<span class="text-[10px] font-bold bg-rose-100 text-rose-700 rounded-full px-2 py-0.5 shrink-0">#' + (scores.length - i) + '</span>' +
      '<span class="text-xs"><b>' + escapeHtml(c.center) + '</b> <span class="text-rose-600 font-semibold">' + c.score.toFixed(2) + '%</span>' + extra + '</span></div>';
  }).join('');

  // ─── Simple-language insight under the Top 10 / Bottom 10 charts ───
  const bulb = '<i class="fa-solid fa-lightbulb mr-1"></i>';
  const topAvg = top10.reduce((s, c) => s + c.score, 0) / top10.length;
  const bottomAvg = bottom10.reduce((s, c) => s + c.score, 0) / bottom10.length;
  if (DOM.insightTop10) {
    DOM.insightTop10.innerHTML = bulb + 'This chart shows the top <b>10</b> best-performing centers. Their average is <b>' + topAvg.toFixed(2) + '%</b> — <b>' + top10[0].center + '</b> is leading with <b>' + top10[0].score.toFixed(2) + '%</b>.';
  }
  if (DOM.insightBottom10) {
    DOM.insightBottom10.innerHTML = bulb + 'This chart shows the bottom <b>10</b> weakest centers. Their average is only <b>' + bottomAvg.toFixed(2) + '%</b> — <b>' + bottom10[0].center + '</b> is at the very bottom (' + bottom10[0].score.toFixed(2) + '%). These need immediate attention.';
  }
}

/* ─── Zone trend series ───
   For every date: per-center score (sum of overallAchPct), then per-zone
   average of those center scores. Returns { dates, zones, series } where
   series[zone] = [value per date] (null when a zone has no centers that day). */
function computeZoneSeries(f) {
  const center = f.center.length === 0 ? null : f.center;
  const baseRows = DATA.rawRows.filter(r =>
    inFilter(r.region, f.region) &&
    inFilter(r.zone, f.zone) &&
    (!center || center.includes(r.center))
  );
  const dates = DATA.meta.dates;
  const centerScoresByDate = {};
  dates.forEach(d => { centerScoresByDate[d] = {}; });
  baseRows.forEach(r => {
    const m = centerScoresByDate[r.date];
    if (!m) return;
    if (!m[r.center]) m[r.center] = { zone: r.zone, score: 0 };
    m[r.center].score += (r.overallAchPct || 0);
  });
  const zones = DATA.meta.zones;
  const series = {};
  zones.forEach(z => {
    series[z] = dates.map(d => {
      const centers = Object.values(centerScoresByDate[d]).filter(c => c.zone === z);
      if (centers.length === 0) return null;
      return Math.round((centers.reduce((s, c) => s + c.score, 0) / centers.length) * 100) / 100;
    });
  });
  return { dates, zones, series };
}

function renderZoneComparisonChart(f) {
  const { dates, zones, series } = computeZoneSeries(f);
  // Maximally distinct colors — first 5 (red, blue, green, amber, purple)
  // are as far apart on the color wheel as possible so zone lines never
  // get confused with each other; extras kick in if there are more zones.
  const palette = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899', '#84cc16'];
  const datasets = zones.map((zone, zi) => {
    const hex = palette[zi % palette.length];
    return {
      label: zone,
      data: series[zone],
      borderColor: hex,
      backgroundColor: hexToRgba_(hex, 0.08),
      fill: false,
      tension: 0.4,
      pointRadius: 4,
      pointHoverRadius: 7,
      pointBackgroundColor: hex,
      borderWidth: 2.5,
      spanGaps: true
    };
  });

  // Dynamic Y-axis: (data min - 1) to (data max + 1) so the lines spread out
  // and the differences between zones are clearly visible (instead of a
  // 0-based axis that squishes everything near the top).
  const allVals = [];
  zones.forEach(z => series[z].forEach(v => { if (v != null) allVals.push(v); }));
  let yMin = 0, yMax = 100;
  if (allVals.length > 0) {
    yMin = Math.floor(Math.min.apply(null, allVals)) - 1;
    yMax = Math.ceil(Math.max.apply(null, allVals)) + 1;
  }

  renderFrozenYChart({
    wrapId: 'zoneChartWrap',
    frozenYId: 'zoneFrozenY',
    legendId: 'zoneLegend',
    canvasId: 'chartZoneComparison',
    chartKey: 'zoneComparison',
    dates,
    datasets,
    yMin, yMax,
    tickColor: darkMode ? '#cbd5e1' : '#64748b',
    gridColor: chartGridColor()
  });
}

/* ─── Zone trend auto-insights ───
   Explains in plain words what the line graph is showing: who leads right
   now, who has the best overall average, who improved the most, and which
   zone is declining. */
function renderZoneInsights(f) {
  const el = DOM.zoneInsightsList;
  if (!el) return;
  const { dates, zones, series } = computeZoneSeries(f);
  if (dates.length === 0 || zones.length === 0) {
    el.innerHTML = '<p class="text-sm text-slate-400">No data matches current filters.</p>';
    return;
  }
  const first = dates[0], last = dates[dates.length - 1];
  const stats = zones.map(z => {
    const vals = series[z];
    const valid = vals.filter(v => v != null);
    const avg = valid.length ? valid.reduce((s, v) => s + v, 0) / valid.length : null;
    const fv = vals[0], lv = vals[vals.length - 1];
    const change = (fv != null && lv != null) ? lv - fv : null;
    return { zone: z, avg, first: fv, last: lv, change };
  });

  const lastVals = stats.filter(s => s.last != null);
  const currentLeader = lastVals.length ? lastVals.reduce((a, b) => b.last > a.last ? b : a) : null;
  const withAvg = stats.filter(s => s.avg != null);
  const bestAvg = withAvg.length ? withAvg.reduce((a, b) => b.avg > a.avg ? b : a) : null;
  const withChange = stats.filter(s => s.change != null);
  const mostImproved = withChange.length ? withChange.reduce((a, b) => b.change > a.change ? b : a) : null;
  const declining = withChange.filter(s => s.change < 0).sort((a, b) => a.change - b.change);

  let html = '';
  if (currentLeader) {
    html += '<div class="flex items-start gap-2"><i class="fa-solid fa-crown text-amber-500 mt-0.5"></i><span><b>' + currentLeader.zone + '</b> is leading right now with <b>' + currentLeader.last.toFixed(2) + '%</b> average on ' + formatDisplayDate_(last) + '.</span></div>';
  }
  if (bestAvg) {
    html += '<div class="flex items-start gap-2"><i class="fa-solid fa-trophy text-amber-500 mt-0.5"></i><span><b>' + bestAvg.zone + '</b> has the best overall average (<b>' + bestAvg.avg.toFixed(2) + '%</b>) across all ' + dates.length + ' dates.</span></div>';
  }
  if (mostImproved && mostImproved.change > 0) {
    html += '<div class="flex items-start gap-2"><i class="fa-solid fa-arrow-trend-up text-emerald-500 mt-0.5"></i><span><b>' + mostImproved.zone + '</b> improved the most — from <b>' + mostImproved.first.toFixed(2) + '%</b> to <b>' + mostImproved.last.toFixed(2) + '%</b> (' + mostImproved.change.toFixed(2) + ' pts up).</span></div>';
  }
  if (declining.length > 0) {
    html += '<div class="flex items-start gap-2"><i class="fa-solid fa-arrow-trend-down text-rose-500 mt-0.5"></i><span><b>' + declining[0].zone + '</b> is declining — from <b>' + declining[0].first.toFixed(2) + '%</b> to <b>' + declining[0].last.toFixed(2) + '%</b> (' + Math.abs(declining[0].change).toFixed(2) + ' pts down).</span></div>';
  }
  if (!html) html = '<p class="text-sm text-slate-400">Not enough data to draw insights.</p>';
  el.innerHTML = html;
}

function renderHeatmap(f) {
  const rows = DATA.rawRows.filter(r =>
    r.date === f.date && inFilter(r.region, f.region) &&
    inFilter(r.zone, f.zone) && inFilter(r.center, f.center)
  );
  const regions = uniq(rows.map(r => r.region)).sort();
  const metrics = DATA.meta.metrics;
  const sums = {}, centerSets = {};
  rows.forEach(r => {
    const k = r.region + '||' + r.metric;
    sums[k] = (sums[k] || 0) + (r.overallAchPct || 0);
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

  // ─── Simple-language insight under the heatmap ───
  const bulb = '<i class="fa-solid fa-lightbulb mr-1"></i>';
  if (DOM.insightHeatmap) {
    if (regions.length === 0) {
      DOM.insightHeatmap.innerHTML = bulb + 'No regions in this selection.';
    } else {
      // Best & worst region by overall average across metrics
      let bestR = null, bestRV = -Infinity, worstR = null, worstRV = Infinity;
      regions.forEach(r => {
        const cc = Object.keys(centerSets[r] || {}).length || 1;
        let tot = 0;
        metrics.forEach(m => { tot += (sums[r + '||' + m] || 0) / cc; });
        const avg = tot / metrics.length;
        if (avg > bestRV) { bestRV = avg; bestR = r; }
        if (avg < worstRV) { worstRV = avg; worstR = r; }
      });
      DOM.insightHeatmap.innerHTML = bulb + 'This table shows each region\'s performance on every metric (green = good, red = weak). Best region: <b>' + bestR + '</b> (' + bestRV.toFixed(1) + '%). Weakest: <b>' + worstR + '</b> (' + worstRV.toFixed(1) + '%).';
    }
  }
}

function heatClass(v) { return v >= 60 ? 'score-high' : v >= 30 ? 'score-mid' : 'score-low'; }

function renderTrendChart(f) {
  // Always ALL metrics — each metric gets its own line
  // Filter applies ONLY to center/region/zone (NOT metric)
  const center = f.center.length === 0 ? null : f.center;
  const baseRows = DATA.rawRows.filter(r =>
    inFilter(r.region, f.region) &&
    inFilter(r.zone, f.zone) &&
    (!center || center.includes(r.center))
  );

  const dates = DATA.meta.dates;

  // ─── Per-metric datasets ───
  const palette = ['#6366f1', '#14b8a6', '#f97316', '#e11d48', '#8b5cf6', '#0ea5e9', '#22c55e', '#eab308'];
  const datasets = DATA.meta.metrics.map((metric, mi) => {
    const byDate = {};
    dates.forEach(d => { byDate[d] = { sum: 0, count: 0 }; });

    baseRows.forEach(r => {
      if (r.metric !== metric) return;
      const b = byDate[r.date];
      if (!b) return;
      if (r.overallAchPct != null) { b.sum += r.overallAchPct; b.count++; }
    });

    const values = dates.map(d => {
      const b = byDate[d];
      return b.count > 0 ? Math.round((b.sum / b.count) * 100) / 100 : null;
    });

    const hex = palette[mi % palette.length];
    const c = { line: hex, fill: hexToRgba_(hex, 0.12) };
    return {
      label: metric,
      data: values,
      borderColor: c.line,
      backgroundColor: c.fill,
      fill: false,
      tension: 0.4,
      pointRadius: 4,
      pointHoverRadius: 7,
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
    if (r.overallAchPct != null) { b.sum += r.overallAchPct; b.count++; }
  });
  const allValues = dates.map(d => {
    const b = allByDate[d];
    return b.count > 0 ? Math.round((b.sum / b.count) * 100) / 100 : null;
  });
  datasets.push({
    label: 'Overall Score',
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
    pointRadius: 4,
    pointHoverRadius: 8,
    pointBackgroundColor: darkMode ? '#e2e8f0' : '#1e293b',
    borderWidth: 2,
    borderDash: [5, 3],
    spanGaps: true
  });

  // % axis range: 0 to the highest value across all lines
  let maxVal = 0;
  datasets.forEach(ds => ds.data.forEach(v => { if (v != null && v > maxVal) maxVal = v; }));

  renderFrozenYChart({
    wrapId: 'trendChartWrap',
    frozenYId: 'trendFrozenY',
    legendId: 'trendLegend',
    canvasId: 'chartTrend',
    chartKey: 'trend',
    dates,
    datasets,
    yMin: 0,
    yMax: maxVal,
    tickColor: darkMode ? '#cbd5e1' : '#64748b',
    gridColor: chartGridColor()
  });

  // ─── Simple-language insight under the trend chart ───
  const bulb = '<i class="fa-solid fa-lightbulb mr-1"></i>';
  if (DOM.insightTrend) {
    if (dates.length < 2) {
      DOM.insightTrend.innerHTML = bulb + 'Need at least 2 dates of data to show a trend.';
    } else {
      const first = dates[0], last = dates[dates.length - 1];
      const fv = allValues[0], lv = allValues[allValues.length - 1];
      if (fv == null || lv == null) {
        DOM.insightTrend.innerHTML = bulb + 'No trend data found for this selection.';
      } else {
        const diff = lv - fv;
        const dir = diff > 0.5 ? 'going up' : diff < -0.5 ? 'going down' : 'staying about the same';
        DOM.insightTrend.innerHTML = bulb + 'This chart shows how each metric\'s performance changes over time. Overall average went from <b>' + fv.toFixed(1) + '%</b> to <b>' + lv.toFixed(1) + '%</b> — performance is ' + dir + ' (' + (diff > 0 ? '+' : '') + diff.toFixed(1) + ' pts).';
      }
    }
  }
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
    if (!inFilter(r.region, f.region)) return false;
    if (!inFilter(r.zone, f.zone)) return false;
    if (!inFilter(r.center, f.center)) return false;
    if (!search) return true;
    return (r.center + ' ' + r.region + ' ' + r.zone + ' ' + r.businessHead + ' ' + r.centerHead).toLowerCase().includes(search);
  });

  // ─── Column definitions ───
  // Only 4 frozen: #, Region, Center, Zone
  const ID_COLS = ['#','Region','Center','Zone'];

  // Target columns — dynamically generated from DATA.meta.smList like Achieved/Ach%
  const smList = DATA.meta.smList;
  function makeTgtFields() {
    var fields = [];
    smList.forEach(function(sm) {
      fields.push({group:'Targets', metric:sm.metric, sub:sm.sub, field:'Target', key:sm.key+'Target'});
      fields.push({group:'Targets', metric:sm.metric, sub:sm.sub, field:'Cap', key:sm.key+'Cap'});
    });
    return fields;
  }
  const tgtFields = makeTgtFields(); // 2 entries per sub-metric (Target + Cap)

  // Achieved columns (1 per sub-metric)
  const achFields = smList.map(sm => ({
    group:'Achieved', metric:sm.metric, sub:sm.sub, field:'Achieved', key:sm.key+'Achieved'
  }));

  // Ach% columns (1 per sub-metric)
  const pctFields = smList.map(sm => ({
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

  // ─── 3-row color-coded header ───
  // Row 0: Groups (Targets | Achieved | Ach. % | Final) — colored
  // Row 1: Metrics — tinted to match group
  // Row 2: Sub-metric / field names

  var h = '<thead>';

  // Row 0: Groups
  h += '<tr class="detail-group-row">';
  for (let ci = 0; ci < ID_COLS.length; ci++) {
    h += '<th class="id-col"' + fStyle(ci, 44) + '>' + (ci === 0 ? '#' : ID_COLS[ci]) + '</th>';
  }
  h += '<th colspan="' + tgtFields.length + '" class="grp-targets"' + fStyle(ID_COLS.length, 44) + '>Targets</th>';
  h += '<th colspan="' + achFields.length + '" class="grp-achieved"' + fStyle(ID_COLS.length + tgtFields.length, 44) + '>Achieved</th>';
  h += '<th colspan="' + pctFields.length + '" class="grp-pct"' + fStyle(ID_COLS.length + tgtFields.length + achFields.length, 44) + '>Ach. %</th>';
  for (let fi = 0; fi < FINAL_COLS.length; fi++) {
    h += '<th class="grp-final"' + fStyle(ID_COLS.length + ALL_FIELDS.length + fi, 44) + '>' + FINAL_COLS[fi].name + '</th>';
  }
  h += '</tr>';

  // Row 1: Metrics
  h += '<tr class="detail-metric-row">';
  for (let ci = 0; ci < ID_COLS.length; ci++) {
    h += '<th' + fStyle(ci, 38) + '></th>';
  }
  for (let fi = 0; fi < ALL_FIELDS.length; fi++) {
    const fld = ALL_FIELDS[fi];
    const gcls = fld.group === 'Targets' ? 'm-targets' : fld.group === 'Achieved' ? 'm-achieved' : 'm-pct';
    h += '<th class="' + gcls + '"' + fStyle(ID_COLS.length + fi, 38) + '>' + fld.metric + '</th>';
  }
  for (let fi = 0; fi < FINAL_COLS.length; fi++) {
    h += '<th' + fStyle(ID_COLS.length + ALL_FIELDS.length + fi, 38) + '></th>';
  }
  h += '</tr>';

  // Row 2: Sub-metric / field
  h += '<tr class="detail-field-row">';
  for (let ci = 0; ci < ID_COLS.length; ci++) {
    h += '<th' + fStyle(ci, 32) + '></th>';
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
    if (!inFilter(r.region, f.region)) return false;
    if (!inFilter(r.zone, f.zone)) return false;
    if (!inFilter(r.center, f.center)) return false;
    return true;
  });

  const smList = DATA.meta.smList;
  const tgtHeaders = smList.flatMap(sm => [sm.sub + ' (Target)', sm.sub + ' (Cap)']);
  const achHeaders = smList.map(sm => sm.sub + ' (Achieved)');
  const pctHeaders = smList.map(sm => sm.sub + ' (%)');
  const headers = ['Region', 'Center', 'Zone', 'Bus. Head', 'Center Head',
    ...tgtHeaders, ...achHeaders, ...pctHeaders,
    'Score %', 'Rank', 'Z-Rank'];

  const csvRows = [headers.join(',')];
  rows.forEach(r => {
    const tgtVals = smList.flatMap(sm => [r[sm.key + 'Target'] ?? '', r[sm.key + 'Cap'] ?? '']);
    const achVals = smList.map(sm => r[sm.key + 'Achieved'] ?? '');
    const pctVals = smList.map(sm => r[sm.key + 'AchPct'] != null ? r[sm.key + 'AchPct'].toFixed(1) + '%' : '');
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

  // Sub-Metric filter values are compound "metric||sub" keys (see
  // populateSubmetricFilter). When set, they pin the drill-down to those exact
  // metrics and, within each, that single sub-metric.
  let pinnedSubs = []; // array of { metric, sub }
  f.submetric.forEach(key => {
    const parts = key.split('||');
    pinnedSubs.push({ metric: parts[0], sub: parts.slice(1).join('||') });
  });

  let metrics = [];
  let labelPrefix = '';
  if (pinnedSubs.length > 0) {
    metrics = pinnedSubs.map(p => p.metric);
    labelPrefix = pinnedSubs.length === 1 ? (pinnedSubs[0].metric + ' \u2014 ' + pinnedSubs[0].sub) : (pinnedSubs.length + ' sub-metrics');
  } else if (f.metric.length === 0) {
    metrics = DATA.meta.metrics;
    labelPrefix = 'All Metrics';
  } else {
    metrics = f.metric;
    labelPrefix = f.metric.join(', ');
  }
  if (subtitle) subtitle.textContent = labelPrefix + ' \u2014 Target vs Min/Max Cap vs Achieved by sub-metric';

  // Base rows filtered by region/zone/center (but NOT metric)
  const baseRows = DATA.rawRows.filter(r =>
    r.date === f.date &&
    inFilter(r.region, f.region) &&
    inFilter(r.zone, f.zone) &&
    inFilter(r.center, f.center)
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
      const pin = pinnedSubs.find(p => p.metric === r.metric);
      if (pin && sub !== pin.sub) return;
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
    if (f.metric.length === 0) {
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
    // Admisison renders as a scrollable line graph over dates (initial → selected date);
    // other metrics stay as bar charts for the selected date.
    const isLine = metric.toLowerCase() === 'admisison';
    if (isLine) {
      card.innerHTML = headerHtml +
        '<div class="chart-scroll-wrap"><div class="chart-frozen-y" id="submetric-fy-' + cardIdx + '"></div><div class="relative" id="submetric-wrap-' + cardIdx + '"><canvas id="submetric-canvas-' + cardIdx + '"></canvas></div></div>' +
        '<div class="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px]" id="submetric-legend-' + cardIdx + '"></div>';
    } else {
      card.innerHTML = headerHtml +
        '<div class="relative" style="height:300px"><canvas id="submetric-canvas-' + cardIdx + '"></canvas></div>';
    }
    container.appendChild(card);

    if (isLine) {
      // ─── Admisison: line graph from initial date → selected date ───
      const allDates = (DATA.meta.dates || []).slice();
      const selIdx = allDates.indexOf(f.date);
      const dates = selIdx >= 0 ? allDates.slice(0, selIdx + 1) : allDates;
      const trendRows = DATA.rawRows.filter(r =>
        dates.includes(r.date) &&
        inFilter(r.region, f.region) &&
        inFilter(r.zone, f.zone) &&
        inFilter(r.center, f.center)
      );
      const byDate = {};
      dates.forEach(d => { byDate[d] = { t: 0, c: 0, a: 0, n: 0 }; });
      trendRows.forEach(r => {
        if (r.metric !== metric) return;
        const b = byDate[r.date]; if (!b) return;
        b.t += (r.target != null ? r.target : 0);
        b.c += (r.cap != null ? r.cap : 0);
        b.a += (r.achieved != null ? r.achieved : 0);
        b.n++;
      });
      // Admission counts are integers — round the per-date averages so the
      // chart never shows decimals (e.g. 136.77 → 137).
      const targetData   = dates.map(d => byDate[d].n > 0 ? Math.round(byDate[d].t / byDate[d].n) : null);
      const capData      = dates.map(d => byDate[d].n > 0 ? Math.round(byDate[d].c / byDate[d].n) : null);
      const achievedData = dates.map(d => byDate[d].n > 0 ? Math.round(byDate[d].a / byDate[d].n) : null);

      const allVals = [].concat(targetData, capData, achievedData).filter(v => v != null);
      let yMin = 0, yMax = 100;
      if (allVals.length > 0) {
        yMin = Math.floor(Math.min.apply(null, allVals)) - 1;
        yMax = Math.ceil(Math.max.apply(null, allVals)) + 1;
      }

      renderFrozenYChart({
        wrapId: 'submetric-wrap-' + cardIdx,
        frozenYId: 'submetric-fy-' + cardIdx,
        legendId: 'submetric-legend-' + cardIdx,
        canvasId: 'submetric-canvas-' + cardIdx,
        chartKey: 'submetric-' + cardIdx,
        dates,
        datasets: [
          { label: 'Target',      data: targetData,   borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.12)', borderWidth: 2.5, pointRadius: 4, pointHoverRadius: 6, pointBackgroundColor: '#10b981', tension: 0.35, fill: false, spanGaps: true },
          { label: 'Min/Max Cap', data: capData,      borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.12)', borderWidth: 2.5, pointRadius: 4, pointHoverRadius: 6, pointBackgroundColor: '#f59e0b', tension: 0.35, fill: false, spanGaps: true },
          { label: 'Achieved',    data: achievedData, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.12)', borderWidth: 2.5, pointRadius: 4, pointHoverRadius: 6, pointBackgroundColor: '#3b82f6', tension: 0.35, fill: false, spanGaps: true }
        ],
        yMin, yMax,
        canvasH: 300,
        suffix: '',
        decimals: 0,
        tickColor: darkMode ? '#cbd5e1' : '#64748b',
        gridColor: chartGridColor()
      });
    } else {
      // Bar chart for the selected date
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
    }
  });

  if (container.children.length === 0) {
    container.innerHTML = '<p class="text-sm text-slate-400 col-span-2 text-center py-8">No sub-metric data for current selection.</p>';
  }

  // ─── Simple-language insight under the sub-metric section ───
  const bulb = '<i class="fa-solid fa-lightbulb mr-1"></i>';
  // Admission Target/Cap/Achieved are counts (not percentages) — explain this
  // in the insight whenever the Admission metric is in scope.
  const admissionInScope = metrics.some(m => m.toLowerCase() === 'admisison');
  const admissionNote = admissionInScope
    ? '<div class="mt-1.5 pt-1.5 border-t border-slate-200 dark:border-slate-700 flex items-start gap-1.5">' +
      '<i class="fa-solid fa-circle-info mt-0.5"></i>' +
      '<span><b>Note:</b> Admission Target, Cap and Achieved are counts (number of admissions), not percentages. The Admission chart shows the daily average across centers, rounded to whole numbers.</span></div>'
    : '';
  if (DOM.insightSubmetric) {
    if (baseRows.length === 0) {
      DOM.insightSubmetric.innerHTML = bulb + 'No data for this selection.';
    } else {
      // Biggest target vs achieved gap across all sub-metrics in scope
      let bestGap = null; // { metric, sub, target, achieved, gapPct }
      metrics.forEach(metric => {
        const metricRows = baseRows.filter(r => r.metric === metric);
        const bySub2 = {};
        metricRows.forEach(r => {
          const sub = String(r.subMetric || 'Overall').trim();
          if (!sub || sub === 'None' || sub === '-') return;
          const pin = pinnedSubs.find(p => p.metric === r.metric);
          if (pin && sub !== pin.sub) return;
          if (!bySub2[sub]) bySub2[sub] = { targetSum: 0, achievedSum: 0, count: 0 };
          bySub2[sub].targetSum += (r.target != null ? r.target : 0);
          bySub2[sub].achievedSum += (r.achieved != null ? r.achieved : 0);
          bySub2[sub].count++;
        });
        Object.keys(bySub2).forEach(sub => {
          const s = bySub2[sub];
          const t = s.targetSum / s.count, a = s.achievedSum / s.count;
          if (t <= 0) return;
          const gapPct = ((t - a) / t) * 100;
          if (!bestGap || gapPct > bestGap.gapPct) bestGap = { metric, sub, target: t, achieved: a, gapPct };
        });
      });
      if (!bestGap) {
        DOM.insightSubmetric.innerHTML = bulb + 'This chart shows <b>Target</b> (green), <b>Cap</b> (yellow) and <b>Achieved</b> (blue) for each sub-metric. Not enough data to find a gap in this selection.' + admissionNote;
      } else {
        DOM.insightSubmetric.innerHTML = bulb + 'This chart shows <b>Target</b> (green), <b>Cap</b> (yellow) and <b>Achieved</b> (blue) for each sub-metric. Biggest gap: <b>' + escapeHtml(bestGap.sub) + '</b> (' + escapeHtml(bestGap.metric) + ') — target was <b>' + bestGap.target.toFixed(1) + '</b>, only <b>' + bestGap.achieved.toFixed(1) + '</b> achieved.' + admissionNote;
      }
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   DETAILED OVERVIEW TAB — deep-dive visualizations
   ═══════════════════════════════════════════════════════════════ */
function renderDetailedOverview(f) {
  const bulb = '<i class="fa-solid fa-lightbulb mr-1"></i>';
  const dates = DATA.meta.dates;
  const metrics = DATA.meta.metrics;
  const metricColors = { 'Admisison': '#3b82f6', 'Attendance': '#10b981', 'EMI Collection': '#f59e0b', 'Test': '#e21b38' };
  const shortMetric = { 'Admisison': 'Admission', 'Attendance': 'Attendance', 'EMI Collection': 'EMI', 'Test': 'Test' };

  // Rows filtered by region/zone/center (all dates)
  const rows = DATA.rawRows.filter(r =>
    inFilter(r.region, f.region) &&
    inFilter(r.zone, f.zone) &&
    inFilter(r.center, f.center)
  );

  // Per-center scores for the SELECTED date (sum of overallAchPct = Column N),
  // so every chart here respects the date filter like the rest of the dashboard.
  const selRows = rows.filter(r => r.date === f.date);
  const byCenter = {};
  selRows.forEach(r => {
    if (!byCenter[r.center]) {
      byCenter[r.center] = {
        center: r.center, region: r.region, zone: r.zone,
        businessHead: r.businessHead, centerHead: r.centerHead,
        totalScore: 0, metricScores: {}
      };
    }
    const c = byCenter[r.center];
    c.totalScore += (r.overallAchPct || 0);
    c.metricScores[r.metric] = (c.metricScores[r.metric] || 0) + (r.overallAchPct || 0);
  });
  const centers = Object.values(byCenter).map(c => {
    c.totalScore = Math.round(c.totalScore * 100) / 100;
    metrics.forEach(m => { if (c.metricScores[m] != null) c.metricScores[m] = Math.round(c.metricScores[m] * 100) / 100; });
    return c;
  });

  // ─── 1. Metric Achievement Trend (all dates) ───
  const byDM = {};
  rows.forEach(r => {
    const k = r.date + '||' + r.metric;
    if (!byDM[k]) byDM[k] = { sum: 0, n: 0 };
    byDM[k].sum += (r.metricAchPct || 0);
    byDM[k].n++;
  });
  const trendDatasets = metrics.map(m => ({
    label: m,
    data: dates.map(d => {
      const k = d + '||' + m;
      return byDM[k] && byDM[k].n > 0 ? Math.round(byDM[k].sum / byDM[k].n * 100) / 100 : null;
    }),
    borderColor: metricColors[m] || '#64748b',
    backgroundColor: (metricColors[m] || '#64748b') + '22',
    borderWidth: 2.5, pointRadius: 4, pointHoverRadius: 6, tension: 0.35, fill: false, spanGaps: true
  }));
  upsertChart('metricTrend', 'chartMetricTrend', {
    type: 'line',
    data: { labels: dates, datasets: trendDatasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12, font: { size: 11 }, color: chartTickColor() } },
        tooltip: { mode: 'index', intersect: false, callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + (ctx.parsed.y != null ? ctx.parsed.y.toFixed(2) + '%' : '') } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: chartTickColor(), font: { size: 11 } } },
        y: { beginAtZero: true, grid: { color: chartGridColor() }, ticks: { callback: v => v + '%', color: chartTickColor(), font: { size: 11 } } }
      }
    }
  });
  const insTrend = document.getElementById('insightMetricTrend');
  if (insTrend) {
    const lastVals = {};
    metrics.forEach(m => { const k = f.date + '||' + m; lastVals[m] = byDM[k] && byDM[k].n > 0 ? byDM[k].sum / byDM[k].n : null; });
    const withVal = metrics.filter(m => lastVals[m] != null);
    if (withVal.length > 0) {
      const bestM = withVal.slice().sort((a, b) => lastVals[b] - lastVals[a])[0];
      const worstM = withVal.slice().sort((a, b) => lastVals[a] - lastVals[b])[0];
      insTrend.innerHTML = bulb + 'On <b>' + f.date + '</b>: <b>' + escapeHtml(shortMetric[bestM] || bestM) + '</b> leads at <b>' + lastVals[bestM].toFixed(1) + '%</b>, while <b>' + escapeHtml(shortMetric[worstM] || worstM) + '</b> lags at <b>' + lastVals[worstM].toFixed(1) + '%</b>.';
    } else {
      insTrend.innerHTML = bulb + 'No data for this selection.';
    }
  }

  // ─── 2. Weight vs Achievement (selected date) ───
  const weightByMetric = {};
  rows.forEach(r => { if (!weightByMetric[r.metric]) weightByMetric[r.metric] = r.overallWeight; });
  const achByMetric = {};
  rows.filter(r => r.date === f.date).forEach(r => {
    if (!achByMetric[r.metric]) achByMetric[r.metric] = { sum: 0, n: 0 };
    achByMetric[r.metric].sum += (r.metricAchPct || 0);
    achByMetric[r.metric].n++;
  });
  upsertChart('weightVsAch', 'chartWeightVsAch', {
    type: 'bar',
    data: {
      labels: metrics.map(m => shortMetric[m] || m),
      datasets: [
        { label: 'Weight %', data: metrics.map(m => weightByMetric[m] != null ? weightByMetric[m] : 0), backgroundColor: 'rgba(100,116,139,0.75)', borderColor: '#64748b', borderWidth: 1, borderRadius: 4 },
        { label: 'Achieved %', data: metrics.map(m => achByMetric[m] && achByMetric[m].n > 0 ? Math.round(achByMetric[m].sum / achByMetric[m].n * 100) / 100 : 0), backgroundColor: 'rgba(226,27,56,0.8)', borderColor: '#e21b38', borderWidth: 1, borderRadius: 4 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12, font: { size: 11 }, color: chartTickColor() } },
        tooltip: { callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + ctx.parsed.y + '%' } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: chartTickColor(), font: { size: 11 } } },
        y: { beginAtZero: true, grid: { color: chartGridColor() }, ticks: { callback: v => v + '%', color: chartTickColor(), font: { size: 11 } } }
      }
    }
  });
  const insWv = document.getElementById('insightWeightVsAch');
  if (insWv) {
    let bestOpp = null; // metric with biggest (weight - achievement)
    metrics.forEach(m => {
      const w = weightByMetric[m] != null ? weightByMetric[m] : 0;
      const a = achByMetric[m] && achByMetric[m].n > 0 ? achByMetric[m].sum / achByMetric[m].n : 0;
      const gap = w - a;
      if (!bestOpp || gap > bestOpp.gap) bestOpp = { metric: m, w, a, gap };
    });
    if (bestOpp && bestOpp.w > 0) {
      insWv.innerHTML = bulb + '<b>' + escapeHtml(shortMetric[bestOpp.metric] || bestOpp.metric) + '</b> carries <b>' + bestOpp.w + '%</b> of the score but achieves only <b>' + bestOpp.a.toFixed(1) + '%</b> — the biggest focus opportunity.';
    } else {
      insWv.innerHTML = bulb + 'No data for this selection.';
    }
  }

  // ─── 3. Region Ranking (avg score) ───
  const regionScores = {};
  centers.forEach(c => {
    if (!regionScores[c.region]) regionScores[c.region] = { sum: 0, n: 0 };
    regionScores[c.region].sum += c.totalScore;
    regionScores[c.region].n++;
  });
  const regionList = Object.keys(regionScores)
    .map(r => ({ region: r, avg: Math.round(regionScores[r].sum / regionScores[r].n * 100) / 100, n: regionScores[r].n }))
    .sort((a, b) => b.avg - a.avg);
  upsertChart('regionRank', 'chartRegionRank', {
    type: 'bar',
    data: {
      labels: regionList.map(r => r.region),
      datasets: [{ label: 'Avg Score', data: regionList.map(r => r.avg), backgroundColor: regionList.map((r, i) => i < 3 ? 'rgba(16,185,129,0.85)' : 'rgba(59,130,246,0.75)'), borderRadius: 5, borderSkipped: false }]
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ' Avg score: ' + ctx.parsed.x.toFixed(2) } }
      },
      scales: {
        x: { grid: { color: chartGridColor() }, ticks: { color: chartTickColor(), font: { size: 11 } } },
        y: { grid: { display: false }, ticks: { color: chartTickColor(), font: { size: 10 } } }
      }
    }
  });
  const insRegion = document.getElementById('insightRegionRank');
  if (insRegion) {
    if (regionList.length > 0) {
      const bestR = regionList[0], worstR = regionList[regionList.length - 1];
      insRegion.innerHTML = bulb + '<b>' + escapeHtml(bestR.region) + '</b> leads with avg <b>' + bestR.avg.toFixed(1) + '</b> (' + bestR.n + ' centers), while <b>' + escapeHtml(worstR.region) + '</b> trails at <b>' + worstR.avg.toFixed(1) + '</b>.';
    } else {
      insRegion.innerHTML = bulb + 'No data for this selection.';
    }
  }

  // ─── 4. Score Distribution (histogram) ───
  const buckets = [];
  for (let i = 0; i <= 70; i += 10) buckets.push({ label: i + '-' + (i + 10), count: 0 });
  centers.forEach(c => {
    const idx = Math.min(Math.floor(c.totalScore / 10), 7);
    buckets[idx].count++;
  });
  upsertChart('scoreDist', 'chartScoreDist', {
    type: 'bar',
    data: {
      labels: buckets.map(b => b.label),
      datasets: [{ label: 'Centers', data: buckets.map(b => b.count), backgroundColor: buckets.map(b => b.count > 0 ? 'rgba(139,92,246,0.8)' : 'rgba(139,92,246,0.15)'), borderRadius: 5, borderSkipped: false }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ' ' + ctx.parsed.y + ' centers' } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: chartTickColor(), font: { size: 11 } } },
        y: { beginAtZero: true, grid: { color: chartGridColor() }, ticks: { color: chartTickColor(), font: { size: 11 } } }
      }
    }
  });
  const insDist = document.getElementById('insightScoreDist');
  if (insDist) {
    const weak = buckets.slice(0, 3).reduce((a, b) => a + b.count, 0);
    const strong = buckets.slice(5).reduce((a, b) => a + b.count, 0);
    insDist.innerHTML = bulb + '<b>' + weak + '</b> of <b>' + centers.length + '</b> centers score below 30 — the weak zone. Only <b>' + strong + '</b> score 50+.';
  }

  // ─── 5. Zone × Metric Heatmap (selected date) ───
  const zones = DATA.meta.zones;
  const byZM = {};
  rows.filter(r => r.date === f.date).forEach(r => {
    const k = r.zone + '||' + r.metric;
    if (!byZM[k]) byZM[k] = { sum: 0, n: 0 };
    byZM[k].sum += (r.metricAchPct || 0);
    byZM[k].n++;
  });
  const heatEl = document.getElementById('zoneMetricHeatmap');
  if (heatEl) {
    const cell = (v) => {
      if (v == null) return '<div style="background:#e2e8f0;color:#94a3b8;padding:9px 4px;text-align:center;border-radius:6px;font-weight:600">—</div>';
      const val = Math.max(0, Math.min(100, v));
      const hue = val / 100 * 120;
      return '<div style="background:hsl(' + hue + ',70%,42%);color:#fff;padding:9px 4px;text-align:center;border-radius:6px;font-weight:600">' + val.toFixed(1) + '%</div>';
    };
    let html = '<div class="grid gap-1.5" style="grid-template-columns:64px repeat(' + metrics.length + ',1fr)">';
    html += '<div></div>' + metrics.map(m => '<div class="text-center font-semibold text-slate-500 dark:text-slate-300 pb-1 truncate" title="' + escapeHtml(m) + '">' + escapeHtml(shortMetric[m] || m) + '</div>').join('');
    zones.forEach(z => {
      html += '<div class="flex items-center font-semibold text-slate-500 dark:text-slate-300">' + escapeHtml(z) + '</div>';
      metrics.forEach(m => {
        const k = z + '||' + m;
        const v = byZM[k] && byZM[k].n > 0 ? byZM[k].sum / byZM[k].n : null;
        html += cell(v);
      });
    });
    html += '</div>';
    heatEl.innerHTML = html;
  }
  const insHeat = document.getElementById('insightHeatmap2');
  if (insHeat) {
    let weakest = null; // { zone, metric, v }
    zones.forEach(z => {
      metrics.forEach(m => {
        const k = z + '||' + m;
        const v = byZM[k] && byZM[k].n > 0 ? byZM[k].sum / byZM[k].n : null;
        if (v != null && (!weakest || v < weakest.v)) weakest = { zone: z, metric: m, v };
      });
    });
    if (weakest) {
      insHeat.innerHTML = bulb + 'Weakest cell: <b>' + escapeHtml(weakest.zone) + ' × ' + escapeHtml(shortMetric[weakest.metric] || weakest.metric) + '</b> at only <b>' + weakest.v.toFixed(1) + '%</b>.';
    } else {
      insHeat.innerHTML = bulb + 'No data for this selection.';
    }
  }

  // ─── 6. Business Head Leaderboard ───
  const heads = {};
  centers.forEach(c => {
    const h = c.businessHead || 'Unknown';
    if (!heads[h]) heads[h] = { sum: 0, n: 0 };
    heads[h].sum += c.totalScore;
    heads[h].n++;
  });
  const headList = Object.keys(heads)
    .map(h => ({ head: h, avg: Math.round(heads[h].sum / heads[h].n * 100) / 100, n: heads[h].n }))
    .sort((a, b) => b.avg - a.avg);
  const topHeads = headList.slice(0, 10);
  const bottomHeads = headList.slice(-10).reverse();
  const headBar = (chartId, list, color, subLabelFn, tooltipFn) => {
    upsertChart(chartId, chartId, {
      type: 'bar',
      data: {
        labels: list.map(h => h.head + (subLabelFn ? '\n' + subLabelFn(h) : '')),
        datasets: [{ label: 'Avg Score', data: list.map(h => h.avg), backgroundColor: color, borderRadius: 5, borderSkipped: false }]
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const item = list[ctx.dataIndex];
                const lines = ['Avg score: ' + item.avg.toFixed(2) + ' (' + item.n + ' center' + (item.n > 1 ? 's' : '') + ')'];
                if (tooltipFn) lines.push(tooltipFn(item));
                return lines;
              }
            }
          }
        },
        scales: {
          x: { grid: { color: chartGridColor() }, ticks: { color: chartTickColor(), font: { size: 11 } } },
          y: { grid: { display: false }, ticks: { color: chartTickColor(), font: { size: 10 }, autoSkip: false } }
        }
      }
    });
  };
  // BH → their centers (with CH names) for labels & tooltips
  const headCenters = {};
  centers.forEach(c => {
    const h = c.businessHead || 'Unknown';
    if (!headCenters[h]) headCenters[h] = [];
    headCenters[h].push({ center: c.center, ch: c.centerHead || '—' });
  });
  const bhSub = h => {
    const chs = uniq((headCenters[h.head] || []).map(x => x.ch));
    const shown = chs.slice(0, 2).join(', ');
    return 'CH: ' + shown + (chs.length > 2 ? ' +' + (chs.length - 2) + ' more' : '');
  };
  const bhTip = h => {
    const cs = (headCenters[h.head] || []).map(x => x.center);
    const shown = cs.slice(0, 3).join(', ');
    return 'Centers: ' + shown + (cs.length > 3 ? ' +' + (cs.length - 3) + ' more' : '');
  };
  headBar('chartHeadTop', topHeads, 'rgba(16,185,129,0.85)', bhSub, bhTip);
  headBar('chartHeadBottom', bottomHeads, 'rgba(244,63,94,0.85)', bhSub, bhTip);
  const insHeads = document.getElementById('insightHeads');
  if (insHeads) {
    if (headList.length > 0) {
      insHeads.innerHTML = bulb + '<b>' + escapeHtml(topHeads[0].head) + '</b> leads with avg <b>' + topHeads[0].avg.toFixed(1) + '</b> across ' + topHeads[0].n + ' center(s); <b>' + escapeHtml(bottomHeads[bottomHeads.length - 1].head) + '</b> trails at <b>' + bottomHeads[bottomHeads.length - 1].avg.toFixed(1) + '</b>.';
    } else {
      insHeads.innerHTML = bulb + 'No data for this selection.';
    }
  }

  // ─── 8. Zone Ranking (avg score) ───
  const zoneScores = {};
  centers.forEach(c => {
    if (!zoneScores[c.zone]) zoneScores[c.zone] = { sum: 0, n: 0 };
    zoneScores[c.zone].sum += c.totalScore;
    zoneScores[c.zone].n++;
  });
  const zoneList = Object.keys(zoneScores)
    .map(z => ({ zone: z, avg: Math.round(zoneScores[z].sum / zoneScores[z].n * 100) / 100, n: zoneScores[z].n }))
    .sort((a, b) => b.avg - a.avg);
  upsertChart('zoneRank', 'chartZoneRank', {
    type: 'bar',
    data: {
      labels: zoneList.map(z => z.zone),
      datasets: [{ label: 'Avg Score', data: zoneList.map(z => z.avg), backgroundColor: zoneList.map((z, i) => i < 2 ? 'rgba(16,185,129,0.85)' : 'rgba(99,102,241,0.75)'), borderRadius: 5, borderSkipped: false }]
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ' Avg score: ' + ctx.parsed.x.toFixed(2) } }
      },
      scales: {
        x: { grid: { color: chartGridColor() }, ticks: { color: chartTickColor(), font: { size: 11 } } },
        y: { grid: { display: false }, ticks: { color: chartTickColor(), font: { size: 11 } } }
      }
    }
  });
  const insZoneRank = document.getElementById('insightZoneRank');
  if (insZoneRank) {
    if (zoneList.length > 0) {
      insZoneRank.innerHTML = bulb + '<b>' + escapeHtml(zoneList[0].zone) + '</b> leads with avg <b>' + zoneList[0].avg.toFixed(1) + '</b>, while <b>' + escapeHtml(zoneList[zoneList.length - 1].zone) + '</b> trails at <b>' + zoneList[zoneList.length - 1].avg.toFixed(1) + '</b>.';
    } else {
      insZoneRank.innerHTML = bulb + 'No data for this selection.';
    }
  }

  // ─── 9. Cap Utilization (selected date) ───
  const capUtil = metrics.map(m => {
    const rowsM = rows.filter(r => r.date === f.date && r.metric === m);
    if (rowsM.length === 0) return { metric: m, util: null };
    let capSum = 0, achSum = 0, n = 0;
    rowsM.forEach(r => {
      if (r.cap != null && r.cap > 0) { capSum += r.cap; achSum += (r.achieved != null ? r.achieved : 0); n++; }
    });
    return { metric: m, util: n > 0 ? Math.round(achSum / capSum * 10000) / 100 : null };
  });
  upsertChart('capUtil', 'chartCapUtil', {
    type: 'bar',
    data: {
      labels: capUtil.map(c => shortMetric[c.metric] || c.metric),
      datasets: [{ label: 'Cap Utilization %', data: capUtil.map(c => c.util != null ? c.util : 0), backgroundColor: capUtil.map(c => c.util != null && c.util >= 100 ? 'rgba(16,185,129,0.85)' : 'rgba(20,184,166,0.75)'), borderRadius: 5, borderSkipped: false }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ' ' + ctx.parsed.y.toFixed(1) + '% of cap' } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: chartTickColor(), font: { size: 11 } } },
        y: { beginAtZero: true, grid: { color: chartGridColor() }, ticks: { callback: v => v + '%', color: chartTickColor(), font: { size: 11 } } }
      }
    }
  });
  const insCap = document.getElementById('insightCapUtil');
  if (insCap) {
    const withVal = capUtil.filter(c => c.util != null);
    if (withVal.length > 0) {
      const best = withVal.slice().sort((a, b) => b.util - a.util)[0];
      const worst = withVal.slice().sort((a, b) => a.util - b.util)[0];
      insCap.innerHTML = bulb + '<b>' + escapeHtml(shortMetric[best.metric] || best.metric) + '</b> uses <b>' + best.util.toFixed(1) + '%</b> of its cap; <b>' + escapeHtml(shortMetric[worst.metric] || worst.metric) + '</b> only <b>' + worst.util.toFixed(1) + '%</b>.';
    } else {
      insCap.innerHTML = bulb + 'No data for this selection.';
    }
  }

  // ─── 10. Metric Contribution to Score (stacked, per zone) ───
  const contribByZone = {};
  centers.forEach(c => {
    if (!contribByZone[c.zone]) contribByZone[c.zone] = { n: 0, sums: {} };
    contribByZone[c.zone].n++;
    metrics.forEach(m => {
      const v = c.metricScores && c.metricScores[m] != null ? c.metricScores[m] : 0;
      contribByZone[c.zone].sums[m] = (contribByZone[c.zone].sums[m] || 0) + v;
    });
  });
  const zoneOrder = DATA.meta.zones;
  const contribDatasets = metrics.map(m => ({
    label: shortMetric[m] || m,
    data: zoneOrder.map(z => {
      const cz = contribByZone[z];
      return cz ? Math.round(cz.sums[m] / cz.n * 100) / 100 : 0;
    }),
    backgroundColor: (metricColors[m] || '#64748b') + 'cc',
    borderColor: metricColors[m] || '#64748b',
    borderWidth: 1
  }));
  upsertChart('metricContrib', 'chartMetricContrib', {
    type: 'bar',
    data: { labels: zoneOrder, datasets: contribDatasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12, font: { size: 11 }, color: chartTickColor() } },
        tooltip: { mode: 'index', intersect: false, callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + ctx.parsed.y.toFixed(2) + ' pts' } }
      },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { color: chartTickColor(), font: { size: 11 } } },
        y: { stacked: true, beginAtZero: true, grid: { color: chartGridColor() }, ticks: { color: chartTickColor(), font: { size: 11 } } }
      }
    }
  });
  const insContrib = document.getElementById('insightMetricContrib');
  if (insContrib) {
    const avgContrib = {};
    metrics.forEach(m => {
      let s = 0, n = 0;
      zoneOrder.forEach(z => { const cz = contribByZone[z]; if (cz) { s += cz.sums[m] / cz.n; n++; } });
      avgContrib[m] = n > 0 ? s / n : 0;
    });
    const topM = metrics.slice().sort((a, b) => avgContrib[b] - avgContrib[a])[0];
    insContrib.innerHTML = bulb + '<b>' + escapeHtml(shortMetric[topM] || topM) + '</b> contributes the most to scores (avg <b>' + avgContrib[topM].toFixed(1) + '</b> pts per zone), stacked per zone below.';
  }

  // ─── 11. Center Head Leaderboard ───
  const cHeads = {};
  centers.forEach(c => {
    const h = c.centerHead || 'Unknown';
    if (!cHeads[h]) cHeads[h] = { sum: 0, n: 0 };
    cHeads[h].sum += c.totalScore;
    cHeads[h].n++;
  });
  const cHeadList = Object.keys(cHeads)
    .map(h => ({ head: h, avg: Math.round(cHeads[h].sum / cHeads[h].n * 100) / 100, n: cHeads[h].n }))
    .sort((a, b) => b.avg - a.avg);
  const topCH = cHeadList.slice(0, 10);
  const bottomCH = cHeadList.slice(-10).reverse();
  // CH → their centers (with BH names) for labels & tooltips
  const chCenters = {};
  centers.forEach(c => {
    const h = c.centerHead || 'Unknown';
    if (!chCenters[h]) chCenters[h] = [];
    chCenters[h].push({ center: c.center, bh: c.businessHead || '—' });
  });
  const chSub = h => {
    const bhs = uniq((chCenters[h.head] || []).map(x => x.bh));
    const shown = bhs.slice(0, 2).join(', ');
    return 'BH: ' + shown + (bhs.length > 2 ? ' +' + (bhs.length - 2) + ' more' : '');
  };
  const chTip = h => {
    const cs = (chCenters[h.head] || []).map(x => x.center);
    const shown = cs.slice(0, 3).join(', ');
    return 'Centers: ' + shown + (cs.length > 3 ? ' +' + (cs.length - 3) + ' more' : '');
  };
  headBar('chartCenterHeadTop', topCH, 'rgba(217,70,239,0.85)', chSub, chTip);
  headBar('chartCenterHeadBottom', bottomCH, 'rgba(244,63,94,0.85)', chSub, chTip);
  const insCH = document.getElementById('insightCenterHeads');
  if (insCH) {
    if (cHeadList.length > 0) {
      insCH.innerHTML = bulb + '<b>' + escapeHtml(topCH[0].head) + '</b> leads with avg <b>' + topCH[0].avg.toFixed(1) + '</b> across ' + topCH[0].n + ' center(s); <b>' + escapeHtml(bottomCH[bottomCH.length - 1].head) + '</b> trails at <b>' + bottomCH[bottomCH.length - 1].avg.toFixed(1) + '</b>.';
    } else {
      insCH.innerHTML = bulb + 'No data for this selection.';
    }
  }

  // ─── 7. Most Improved / Declined Centers ───
  const firstDate = dates[0];
  const scoresFirst = computeScoresForDate(firstDate, f);
  const scoresLast = computeScoresForDate(f.date, f);
  const byCenter2 = {};
  scoresFirst.forEach(s => byCenter2[s.center] = { first: s.score });
  scoresLast.forEach(s => { if (byCenter2[s.center]) byCenter2[s.center].last = s.score; });
  const movers = Object.keys(byCenter2)
    .filter(c => byCenter2[c].last != null)
    .map(c => ({ center: c, delta: Math.round((byCenter2[c].last - byCenter2[c].first) * 100) / 100 }))
    .sort((a, b) => b.delta - a.delta);
  const up = movers.slice(0, 5);
  const down = movers.slice(-5).reverse();
  const moverBar = (chartId, list, color) => {
    upsertChart(chartId, chartId, {
      type: 'bar',
      data: {
        labels: list.map(m => m.center),
        datasets: [{ label: 'Score change', data: list.map(m => m.delta), backgroundColor: color, borderRadius: 5, borderSkipped: false }]
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ' ' + (ctx.parsed.x > 0 ? '+' : '') + ctx.parsed.x.toFixed(2) + ' pts' } }
        },
        scales: {
          x: { grid: { color: chartGridColor() }, ticks: { color: chartTickColor(), font: { size: 11 } } },
          y: { grid: { display: false }, ticks: { color: chartTickColor(), font: { size: 10 } } }
        }
      }
    });
  };
  moverBar('chartMoversUp', up, 'rgba(16,185,129,0.85)');
  moverBar('chartMoversDown', down, 'rgba(244,63,94,0.85)');
  const insUp = document.getElementById('insightMoversUp');
  if (insUp) {
    if (up.length > 0) {
      insUp.innerHTML = bulb + '<b>' + escapeHtml(up[0].center) + '</b> improved the most: <b>+' + up[0].delta.toFixed(1) + '</b> points from ' + firstDate + ' to ' + f.date + '.';
    } else {
      insUp.innerHTML = bulb + 'No data for this selection.';
    }
  }
  const insDown = document.getElementById('insightMoversDown');
  if (insDown) {
    if (down.length > 0) {
      insDown.innerHTML = bulb + '<b>' + escapeHtml(down[0].center) + '</b> declined the most: <b>' + down[0].delta.toFixed(1) + '</b> points from ' + firstDate + ' to ' + f.date + '.';
    } else {
      insDown.innerHTML = bulb + 'No data for this selection.';
    }
  }
}

function hexToRgba_(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}
function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function uniq(arr) { return Array.from(new Set(arr.filter(Boolean))); }
function debounce(fn, wait) { let t; return function(...a) { clearTimeout(t); t = setTimeout(function() { fn.apply(this, a); }, wait); }; }