# Adarsh Vidyapeeth Command Center — Technical README

A single-page analytics dashboard (Physics Wallah branding) that reads live data
from a **published Google Sheet CSV**, transforms it in the browser, and
renders KPIs, charts, a heatmap, zone/region breakdowns, and a detailed
Excel-style data grid — with CSV export.

No backend. Everything (fetch → parse → compute → render) happens in
`script.js`, in the browser, on every page load / refresh.

---

## 1. Files

| File | Responsibility |
|---|---|
| `index.html` | DOM structure only — header, filter bar, 4 tabs (Overview / Zone Wise / Region Wise / Detailed Data). No business logic. |
| `style.css` | Visual styling — glassmorphism header, KPI cards, heatmap colors, Excel-style detail grid, score-gradient helper classes. |
| `script.js` | Everything else: data fetch, CSV parsing, all derived metrics, all chart/table rendering, filters, CSV export. |

Third-party libraries (loaded via CDN in `index.html`):
- **Tailwind CSS v4** (browser build) — utility styling
- **Chart.js 4.4.7** — all charts
- **PapaParse 5.4.1** — CSV parsing
- **Font Awesome 6.7.2** — icons

---

## 2. Data Source & Column Mapping

Data comes from one published Google Sheet, fetched as CSV:

```
CSV_URL = 'https://docs.google.com/spreadsheets/.../pub?...&output=csv'
```

`loadData()` tries, in order (first success wins):
1. Direct fetch (cache-busted with `?_cb=<timestamp>`)
2. `https://api.allorigins.win/raw?url=...` (CORS proxy fallback #1)
3. `https://corsproxy.io/?url=...` (CORS proxy fallback #2)

Each attempt has a 15-second timeout (`fetchWithTimeout`). If all three fail,
`onLoadError()` shows a retry screen.

### Column order (must match the sheet exactly)

```js
const COL = {
  DATE: 0, CENTER: 1, REGION: 2, ZONE: 3, METRIC: 4, SUBMETRIC: 5,
  TARGET: 6, CAP: 7, ACHIEVED: 8, METRIC_WEIGHT: 9, OVERALL_WEIGHT: 10,
  METRIC_ACH_PCT: 11, OVERALL_ACH_PCT: 12, BUSINESS_HEAD: 13, CENTER_HEAD: 14
};
```

| Index | Sheet header |
|---|---|
| 0 | Updated Date |
| 1 | Center Name |
| 2 | Region |
| 3 | Zone |
| 4 | Metric |
| 5 | Sub-metric |
| 6 | Target |
| 7 | Min/Max Cap |
| 8 | Achieved |
| 9 | Sub-metric Weightage |
| 10 | Overall Weightage |
| 11 | Sub-metric Achievement % |
| 12 | **Overall Achievement %** ← used everywhere achievement is *displayed* |
| 13 | Business Head |
| 14 | Center Head |

> **Important rule:** wherever the dashboard shows an achievement percentage
> (KPIs, heatmap, trend lines, per-metric scores, detailed-grid "Ach. %"
> columns, CSV export), it always reads `overallAchPct` (column 12 — *Overall
> Achievement %*). `metricAchPct` (column 11 — *Sub-metric Achievement %*) is
> parsed into memory but never used for display, by design.

---

## 3. Data Build Pipeline (`buildDashboardData()`)

Runs once per successful fetch. Order of operations:

1. **`buildRawRows_(dataRows)`** — converts every CSV row into a clean object:
   `{ date, center, region, zone, metric, subMetric, target, cap, achieved,
   metricWeight, overallWeight, metricAchPct, overallAchPct, businessHead,
   centerHead }`. Rows without a center name or a parseable date are dropped.
   - `sanitizeValue_()` cleans numeric/percent strings (`"85.3%"` → `85.3`,
     `"-"`/`"NA"`/`""` → `null`).
   - `formatDateFromCsv_()` normalizes `DD/MM/YYYY`, `MM/DD/YYYY`, or native
     date strings into `YYYY-MM-DD`.

2. **`buildMetricOrder_(rawRows)`** *(dynamic, not hardcoded)* — walks all
   rows and collects unique `metric` values in first-appearance order. This
   becomes the canonical metric list used everywhere (KPI metric filter,
   heatmap columns, trend chart lines, sub-metric drill-down groups).

3. **`buildSmList_(rawRows)`** *(dynamic, not hardcoded)* — walks all rows
   and collects unique `(metric, subMetric)` pairs in first-appearance
   order. Each pair gets a stable, collision-free machine key via
   `uniqueSlug_()` (e.g. `admissions_ay26__c2`), used internally as an
   object-property key throughout the pivot table and CSV export (since raw
   sub-metric text can contain spaces, slashes, parentheses, etc.).
   - Adding, renaming, or removing a metric/sub-metric in the sheet requires
     **zero code changes** — it's picked up automatically on next load.

4. **`buildMeta_()`** — assembles `dates`, `regions`, `zones` (unique,
   sorted; zones sorted numerically via `zoneComparator_`), the dynamic
   `metrics` and `smList` from steps 2–3, and `centersMeta` (one entry per
   center with its region/zone/heads, for the Center filter).

5. **`buildCenterSummary_(rawRows, latestDate, metricOrder)`** — filters to
   **only the latest date's rows**, and for each center computes:
   - `totalScore` = sum of `overallAchPct` across all that center's rows on
     the latest date
   - `metricScores[metric]` = sum of `overallAchPct` restricted to rows of
     that metric (same source column, just scoped)

6. **`computeRanks_()`** — sorts centers by `totalScore` descending, assigns
   `overallRank` (ties share a rank, e.g. two centers tied at rank 3 → next
   rank is 5, not 4).

7. **`computeZoneRanks_()`** — same ranking logic but computed independently
   *within each zone* → `zoneRank`.

8. **`groupBy_()`** — produces `zoneWise` and `regionWise` lookups (center
   summaries grouped by zone / region, each group pre-sorted by score).

9. **`buildLatestTable_(rawRows, latestDate, centerSummary, smList)`** —
   builds the pivot used by the Detailed Data tab and CSV export: one row
   per center, with `Target`, `Cap`, `Achieved`, and `Ach%` (from
   `overallAchPct`) for **every** sub-metric in `smList`, plus that center's
   `scorePct` / `overallRank` / `zonalRank`.

Final shape returned and stored in the global `DATA`:
```js
{ meta, rawRows, centerSummary, zoneWise, regionWise, latestTable }
```

---

## 4. Filters

All filter state is read via `getFilters()`:
```js
{ date, region, zone, center, metric, submetric }
```

| Filter | Populated by | Cascades from |
|---|---|---|
| Date | `DATA.meta.dates` | — |
| Region | `DATA.meta.regions` | — |
| Zone | `DATA.meta.zones` | — |
| Center | `populateCenterFilter()` | Region + Zone (only shows centers matching both) |
| Metric | `DATA.meta.metrics` (dynamic) | — |
| **Sub-Metric** *(new)* | `populateSubmetricFilter()` | Metric (only shows that metric's sub-metrics; if "All Metrics", shows every sub-metric, disambiguated by metric name if the same sub-metric text exists under more than one metric) |

- The Sub-Metric filter's option **value** is a compound key
  `"<Metric>||<SubMetric>"` so selection is unambiguous even across metrics
  that share a sub-metric name.
- Changing **Metric** re-populates the Sub-Metric dropdown
  (`populateSubmetricFilter()`) before re-rendering.
- **Reset** button restores every filter to `'All'` / latest date.
- The Sub-Metric filter currently affects only the **Sub-Metric
  Drill-Down** section (see §5) — it pins that section to one exact
  metric + sub-metric pair. KPIs, the heatmap, and the trend chart are
  intentionally unaffected by Metric/Sub-Metric selection (same as the
  original Metric filter's scope), so overall performance numbers stay
  comparable regardless of which metric you're inspecting.

---

## 5. Section-by-Section Logic

### Overview tab

| Element | Function | Formula / Logic |
|---|---|---|
| Top Center / Bottom Center KPI | `renderKpis()` → `computeScoresForDate()` | Filters `rawRows` to the selected date (+ region/zone/center filters), sums `overallAchPct` per center, sorts, takes first/last. |
| Avg Score KPI | `renderKpis()` | Mean of the same per-center scores. |
| Best Region / Best Zone KPI | `renderKpis()` | Groups the same scores by region/zone, takes the group with the highest average. |
| Insights bar (🌟 🎯 📈) | `renderKpis()` | Restates best region/zone; "X/N centers above 60%" — 60% is a fixed threshold in code. |
| Top 10 vs Bottom 10 chart | `renderTopBottomChart()` | Same per-center scores, sorted; first 10 = top (green), last 10 reversed = bottom (red). Horizontal bar chart. |
| Zone Performance chart | `renderZoneComparisonChart()` | Same scores grouped by zone, averaged, sorted by zone number. |
| Region × Metric Heatmap | `renderHeatmap()` | For the selected date, average `overallAchPct` per `(region, metric)` cell, divided by that region's unique center count. Color bands: ≥60% green / ≥30% amber / else red (`heatClass()`). |
| Historical Trend chart | `renderTrendChart()` | For **every** date (not just latest), one line per metric = average `overallAchPct` of that metric's rows on that date (region/zone/center filters apply, metric filter does not). Plus a combined "All Metrics" line/area. Colors are assigned from a fixed palette cycling by metric index (`palette[]` + `hexToRgba_()`), since the metric list itself is dynamic. |
| Sub-Metric Drill-Down charts | `renderSubMetricCharts()` | For the selected date + region/zone/center, groups rows by metric (or the one pinned metric) then by sub-metric, averaging raw `target` / `cap` / `achieved` (NOT percentages) per sub-metric. Renders one grouped bar chart per metric card. The Sub-Metric filter, when set, restricts this to a single sub-metric bar within a single metric's card. |

### Zone Wise / Region Wise tabs

- `renderZoneTab()` / `renderRegionTab()` use `filteredCenterSummary()` (the
  latest-date `centerSummary`, filtered by region/zone/center) grouped by
  zone/region respectively.
- Centers within each card are sorted by their `zoneRank` (Zone tab) or
  `overallRank` (Region tab).
- Score cells use `scoreGradientStyle()` — a red→amber→green linear
  interpolation based on the min/max score **across the entire current
  filter selection**, so colors stay visually consistent across all cards on
  screen (not per-card min/max).

### Detailed Data tab

- `renderLatestTable()` filters `DATA.latestTable` by region/zone/center and
  a free-text search box (matches center/region/zone/business head/center
  head, case-insensitive, debounced 150ms).
- Renders a 4-row header (spreadsheet column letters → group `Targets /
  Achieved / Ach. %` → metric name → sub-metric/field name) and a frozen
  `#/Region/Center/Zone` column set, Excel-style.
- Columns are built dynamically from `DATA.meta.smList` — 2 columns
  (Target, Cap) per sub-metric under "Targets", 1 column (Achieved) per
  sub-metric under "Achieved", 1 column (%) per sub-metric under "Ach. %",
  followed by Score / Rank / Z-Rank.
- Cell coloring: `pctSpan()` — ≥100% green, ≥75% amber, ≥50% orange, else
  red.

### CSV Export (`exportCsv()`)

- Exports the same region/zone/center-filtered rows from `DATA.latestTable`.
- Headers and per-row values are generated from `DATA.meta.smList`
  dynamically (Target/Cap/Achieved/% per sub-metric), so the exported file
  always matches whatever metrics/sub-metrics currently exist in the sheet.

---

## 6. Ranking Rules

- **Overall Rank**: centers sorted by `totalScore` (sum of `overallAchPct`
  on the latest date) descending. Equal scores share the same rank; the
  next distinct score continues from `position + 1` (standard competition
  ranking, e.g. 1, 2, 2, 4).
- **Zonal Rank**: identical logic, computed independently within each zone.

---

## 7. Theme

- `darkMode` defaults to `true` (Physics Wallah dark branding).
- `toggleTheme()` flips the `.dark` class on `<html>` (Tailwind v4
  class-based dark variant) and re-runs `renderAll()` so Chart.js grid/tick
  colors (`chartGridColor()`, `chartTickColor()`) and the score-gradient
  colors adapt.

---

## 8. Extensibility Notes

- **Adding a new Metric or Sub-Metric**: just add rows with the new value in
  the sheet's Metric/Sub-metric columns — no code change needed. It will
  appear in the Metric filter, Sub-Metric filter (scoped correctly), heatmap
  columns, trend chart lines (colored from the fixed palette, cycling if
  there are more metrics than palette colors), and every table/export.
- **Changing which column drives "achievement"**: currently hardcoded to
  `overallAchPct` (sheet column 12) everywhere it's displayed — search for
  `overallAchPct` in `script.js` to see every usage site.
- **Column order**: if the sheet's column order ever changes, only the
  `COL` object at the top of `script.js` needs updating.