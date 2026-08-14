# Adarsh Vidyapeeth Command Center — Explained Simply

This document explains the whole dashboard **like you know nothing about
coding**. Every section has a real-life analogy, a plain-English
explanation, and a worked example with real numbers. If you read this
top to bottom, you will understand exactly what every number on the
screen means and where it comes from.

---

## 0. The Big Picture (read this first)

Imagine a **school** with many **centers** (branches). Every day, someone
writes down in a big Excel sheet how each center is doing — how many
students admitted, how many attended class, how much fee (EMI) was
collected, how well they did in tests.

This dashboard is like a **smart report card generator**:

1. It **reads** that Excel sheet (from Google Sheets, over the internet).
2. It **calculates** scores, ranks, and averages.
3. It **draws** pictures (charts, tables, colors) so a manager can look at
   it for 5 seconds and know "which center is doing great, which one needs
   help."

That's it. Everything else in this document is just "how" it does that.

---

## 1. The Three Files — What Each One Is

Think of building a dashboard like building a car:

| File | Car part | What it actually does |
|---|---|---|
| `index.html` | The **body/frame** of the car | Just decides "here's a box for the header, here's a box for filters, here's a box for the chart." It has NO brains — it doesn't calculate anything. |
| `style.css` | The **paint job** | Decides colors, fonts, spacing, rounded corners, red/green highlighting. Makes it look nice. Has NO logic either. |
| `script.js` | The **engine + driver's brain** | ALL the thinking happens here: downloading data, doing math, deciding what color a score should be, drawing charts. This is the file that matters for "logic." |

So when you ask "where is the logic for X," the answer is **always**
`script.js`.

---

## 2. Where Does the Data Come From?

There is one Google Sheet. Someone (or an automated process) keeps adding
rows to it — like a diary, one row = one fact about one center on one
date for one metric's one sub-part.

The sheet is "published to the web" as a CSV file (CSV = a simple text
file, like a table, that any program can read — think of it as Excel's
plain-text cousin).

### Every row in the sheet looks like this:

| Column # | Column Name | Example value | In plain English |
|---|---|---|---|
| 1 | Updated Date | `12/08/2026` | Which day this fact is about |
| 2 | Center Name | `Prayagraj Center` | Which branch |
| 3 | Region | `North` | Group of zones |
| 4 | Zone | `Zone 3` | Group of centers |
| 5 | Metric | `Attendance` | The big category (e.g. Attendance, Admissions, EMI Collection) |
| 6 | Sub-metric | `DAS` | The specific thing inside that category |
| 7 | Target | `100` | What number they were SUPPOSED to hit |
| 8 | Min/Max Cap | `120` | The ceiling/floor limit for that number |
| 9 | Achieved | `85` | What number they ACTUALLY hit |
| 10 | Sub-metric Weightage | `10%` | How much this one sub-part matters |
| 11 | Overall Weightage | `25%` | How much the whole metric matters |
| 12 | Sub-metric Achievement % | `85%` | Achieved ÷ Target, for just this sub-part |
| 13 | **Overall Achievement %** | `82%` | The "official" percentage used for scoring — ⭐ **this is the ONLY achievement number the dashboard ever shows anywhere** |
| 14 | Business Head | `Mr. Sharma` | Who's in charge (business side) |
| 15 | Center Head | `Ms. Verma` | Who's in charge (center side) |

> 🎯 **Golden Rule of this dashboard:** whenever you see a "%" achievement
> number ANYWHERE on screen — a KPI card, a chart, a table cell, the CSV
> download — it always comes from column 13 (**Overall Achievement %**).
> Column 12 (Sub-metric Achievement %) is read from the sheet but is
> never shown to you. This was a specific decision made in the code.

---

## 3. How the Code Reads the Sheet (step-by-step, like a recipe)

Think of `script.js` as following a recipe every time the page loads:

### Step 1 — Go fetch the sheet
`loadData()` — like sending someone to go download the Excel file from the
internet. Since browsers sometimes block cross-website downloads (called
"CORS"), the code tries 3 different doors to get in:
1. Try the direct link.
2. If that door is locked, try door #2 (a helper website called `allorigins`).
3. If that's locked too, try door #3 (`corsproxy.io`).

If all 3 doors are locked, it shows you a "Could not load data — Retry"
screen.

### Step 2 — Turn the raw text into a table
A library called **PapaParse** turns the CSV text into rows and columns
(like opening it in Excel).

### Step 3 — Clean up every row
`buildRawRows_()` — imagine a teacher checking every row for messy
handwriting:
- `"85.3%"` → cleaned into the number `85.3`
- `"-"` or `"NA"` or blank → cleaned into "nothing" (`null`)
- Dates like `12/08/2026` get standardized to one format so they can be
  sorted and compared.
- Rows with no center name or unreadable date are thrown away (they're
  junk/incomplete rows).

### Step 4 — Figure out what Metrics exist (automatically!)
`buildMetricOrder_()` — the code looks at **every single row's Metric
column** and makes a list of every DIFFERENT value it sees, in the order
it first saw them. It does NOT have a fixed list written in the code.

**Example:** if the sheet has rows with Metric = `Admissions`, `Attendance`,
`Admissions`, `EMI Collection`, `Attendance`... the code notices only 3
unique values and remembers them in this order:
```
["Admissions", "Attendance", "EMI Collection"]
```
If tomorrow someone adds a brand-new metric called `Digital Marketing` to
the sheet, the very next time the dashboard loads, it will automatically
show up everywhere — filters, charts, tables — **with zero code changes.**

### Step 5 — Figure out what Sub-metrics exist per Metric (automatically!)
`buildSmList_()` — same idea, but now it looks at **pairs**: (Metric,
Sub-metric) together.

**Example:**
```
Attendance      → DAS
Attendance      → Inactivity
EMI Collection  → 1st EMI
EMI Collection  → 2nd EMI
EMI Collection  → 4th EMI
```
So if you pick the "Attendance" filter, you'll only ever see "DAS" and
"Inactivity" as sub-metric options — never "1st EMI," because that
sub-metric doesn't belong to Attendance.

### Step 6 — Work out the "last updated" date and build a master list
`buildMeta_()` — collects: every unique date, every unique region, every
unique zone, every unique center (with its region/zone/heads attached),
plus the dynamic metric list and sub-metric list from Steps 4–5.

### Step 7 — Calculate each center's score (for the LATEST date only)
`buildCenterSummary_()` — this is the heart of the scoring.

Imagine center "Prayagraj" has 8 rows on the latest date (one row per
sub-metric, e.g. C2, DAS, Inactivity, 4th EMI, 1st EMI, 2nd EMI, Result,
Attendance). The code just **adds up the Overall Achievement %** column
from all 8 of those rows:

```
totalScore = row1.overallAchPct + row2.overallAchPct + ... + row8.overallAchPct
```

It ALSO keeps a per-metric subtotal (`metricScores`), so you can see "how
much of my total score came from just the Attendance metric."

**Worked example:**

| Sub-metric | Overall Ach % |
|---|---|
| C2 (Admissions) | 22 |
| DAS (Attendance) | 18 |
| Inactivity (Attendance) | 15 |
| 4th EMI | 10 |
| 1st EMI | 12 |
| 2nd EMI | 8 |
| Result | 9 |
| Attendance (Test Perf.) | 6 |
| **Total Score** | **100** |

That `100` becomes this center's `totalScore` for the day.

### Step 8 — Rank the centers
`computeRanks_()` — sort all centers by `totalScore`, biggest first. Give
rank 1 to the highest. If two centers tie exactly, they both get the same
rank number (like a tied race), and the next center's rank skips ahead
(1, 2, 2, 4 — not 1,2,2,3).

`computeZoneRanks_()` — does the exact same thing, but separately for each
zone (so a center can be "Rank 1 in its Zone" even if it's "Rank 15
Overall").

### Step 9 — Build the giant detail table
`buildLatestTable_()` — makes one row per center with EVERY sub-metric's
Target / Cap / Achieved / Ach% side by side — like a giant spreadsheet
pivot. This powers the "Detailed Data" tab and the CSV download.

---

## 4. The Filter Bar — How Filters Talk to Each Other

Think of filters like a **funnel**: each one narrows down which rows of
data get used in every calculation.

```
Date  →  Region  →  Zone  →  Center
                                 (Center only shows options that match
                                  the chosen Region AND Zone)

Metric  →  Sub-Metric
              (Sub-Metric only shows options that belong to
               the chosen Metric)
```

**Real example:** If you pick Region = "North" and Zone = "Zone 3," the
Center dropdown will ONLY list centers that are actually in North + Zone
3 — it won't show you a center from "South, Zone 1."

Same idea for Metric → Sub-metric: pick Metric = "EMI Collection," and the
Sub-Metric dropdown will only offer "1st EMI," "2nd EMI," "4th EMI" — not
"DAS" (which belongs to Attendance, a different metric).

> **New addition:** the Sub-Metric filter didn't exist before — it's new.
> When you pick a specific sub-metric, the "Sub-Metric Drill-Down" chart
> section zooms in to show ONLY that one sub-metric's bar (instead of all
> sub-metrics under that metric).

**Reset button:** puts every filter back to "All" / the latest date, like
clearing all funnels at once.

---

## 5. Every Number/Chart on Screen, Explained

### 🏆 "Top Center" and "Bottom Center" KPI cards
Take all centers' `totalScore` (from Step 7 above, filtered by whatever
Region/Zone/Center you've picked), sort them, show the #1 (highest) and
the last (lowest).

### 📊 "Avg Score" KPI
Add up all centers' scores and divide by how many centers there are —
just a regular average, like a class average on a test.

### 🌍 "Best Region" / "Best Zone" KPI
Group all centers by their Region (or Zone), average the scores within
each group, and show whichever group has the highest average.

### ⭐ Insights bar
Just restates the Best Region/Zone in a sentence, plus counts how many
centers scored above 60% ("14/20 centers above target," for example). The
60% line is a fixed rule written into the code.

### 📈 Top 10 vs Bottom 10 chart
A horizontal bar chart. Same sorted list of scores as above — just the
top 10 shown in green bars, bottom 10 shown in red bars, so you can
instantly see who's winning and who's struggling.

### 🗺️ Zone Performance chart
Same idea as "Best Zone" KPI, but shown as a bar for EVERY zone (not just
the winner) — so you can compare all zones side-by-side.

### 🔥 Region × Metric Heatmap
A grid: rows = regions, columns = metrics. Each cell = the average
Overall Achievement % for that region, for that metric only. Color rule:
- 🟢 Green if ≥ 60%
- 🟡 Amber if ≥ 30%
- 🔴 Red if below 30%

So you can spot instantly, e.g., "South region is red on EMI Collection —
that's a problem area."

### 📉 Historical Trend chart
Unlike everything above (which only looks at the LATEST date), this chart
looks at **every single date** in the sheet and draws a line over time —
one line per metric, plus a thick combined line for "All Metrics." This
answers "are we improving or declining over the weeks/months?" Line
colors are auto-assigned from a fixed color list, cycling through if there
are more metrics than colors.

### 🧱 Sub-Metric Drill-Down charts
For the metric(s) you've selected, groups rows by sub-metric and draws 3
bars per sub-metric: Target, Min/Max Cap, and Achieved — as **raw numbers**
(not percentages) so you can see the actual figures, e.g., "Target was
100 students, we achieved 85." If you also pick a Sub-Metric filter, it
zooms into just that one sub-metric.

### 🏢 Zone Wise tab / Region Wise tab
Same centers, same scores — just organized into cards grouped by Zone or
by Region, sorted best-to-worst within each card. Score numbers are
color-shaded from red (low) to green (high) — like a heat gradient, so
your eye is drawn to the reds first.

### 📋 Detailed Data tab
The full Excel-style pivot table — every center as a row, every
sub-metric's Target/Cap/Achieved/% as columns, built dynamically (adds
new columns automatically if the sheet gets a new sub-metric). Has a
search box (type a center name, region, zone, or head's name to filter
instantly) and color-coded percentage cells (green ≥100%, amber ≥75%,
orange ≥50%, red below that).

### ⬇️ Export CSV button
Downloads exactly what's shown in the Detailed Data tab (respecting your
current filters) as a `.csv` file you can open in Excel.

---

## 6. Ranking Rules (in plain words)

Imagine a race:
- Whoever has the highest score finishes 1st.
- If two people cross the finish line at the EXACT same score, they both
  get "Rank 1" (tied) — nobody is arbitrarily picked as better.
- The next runner after a tie doesn't get "Rank 2" — they get the rank
  matching their actual position (so after two people tie for 1st, the
  next one is Rank 3, not Rank 2).

This "Overall Rank" happens across ALL centers. "Zone Rank" does the exact
same race, but only among centers in the same zone (so you can be #1 in
your zone while being #15 overall).

---

## 7. Dark Mode / Light Mode

There's a moon/sun button. Clicking it just flips a color theme (dark
background vs light background) and re-draws all the charts so their grid
lines and text stay readable in either mode. No data changes — purely
cosmetic.

---

## 8. "What If Someone Adds a New Metric to the Sheet Tomorrow?"

Nothing in `script.js` needs to change. Here's why, step by step:

1. Someone adds new rows to the Google Sheet with `Metric = "Digital
   Marketing"` and some sub-metrics under it.
2. Next time anyone opens the dashboard (or hits Refresh), `loadData()`
   downloads the updated sheet.
3. `buildMetricOrder_()` notices `"Digital Marketing"` is a new unique
   value and adds it to the metric list automatically.
4. `buildSmList_()` notices its sub-metrics and adds those too.
5. Every dropdown, chart, heatmap column, and table column that uses
   `DATA.meta.metrics` or `DATA.meta.smList` picks it up automatically.

This is the entire point of making metrics/sub-metrics **dynamic** instead
of hardcoded — the code adapts to the DATA, instead of someone having to
edit the CODE every time the business adds a new metric.

---

## 9. Quick Glossary

| Term | Meaning |
|---|---|
| CSV | A plain-text spreadsheet format, like Excel but simpler |
| KPI | "Key Performance Indicator" — a single important number, shown in a small card |
| Metric | A big category being measured (e.g. Attendance) |
| Sub-metric | A specific piece inside a Metric (e.g. DAS is a sub-metric of Attendance) |
| Overall Achievement % | The official score number for a row — the ONLY percentage the dashboard displays |
| Heatmap | A color-coded grid, red = bad, green = good |
| Dynamic | Means "figured out automatically from the data," not typed into the code by hand |
| Filter | A dropdown that narrows down which rows are used in calculations |
| Rank | A center's position compared to others, based on score |
| CORS | A browser security rule that sometimes blocks fetching data from another website directly |

---

