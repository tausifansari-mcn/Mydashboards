# Prompt: Build an Excel Uploader + Sales Performance Dashboard for [PROCESS NAME]

Give this whole document to the other project's dev team (or paste it into their AI coding
assistant) as the build spec. It describes a feature pattern that is **already built and working**
in a sister portal ("My Dashboards") for three processes — GNC, Bellavita, and Neemans — and asks
for the same pattern to be replicated for a new process in their own project.

Fill in the `[bracketed]` placeholders with the new process's details before handing this off.

---

## 1. What this feature is

A **Sale Page** with two halves:

1. **Uploader** — an admin/manager drags in the process's daily/weekly Sales Performance Excel
   export (the same file the team already maintains by hand today), the system parses it, and
   stores every row in a database table. Nothing is calculated by hand after that.
2. **Dashboard** — a web page that reads those stored rows back and renders the KPIs, trends, and
   agent-performance tables the team currently has to build manually in Excel — automatically,
   for any date range, refreshed the moment a new file is uploaded.

This is **not a new idea for this reference portal** — it's a proven pattern already running in
production for three processes there. Neemans has the most complete version (5-tab dashboard);
Bellavita has a simpler but fully working one-page version; GNC has the uploader done but the
dashboard was never finished. Use Neemans as the structural gold standard and Bellavita as the
"simplest complete version" fallback if the new process doesn't need all 5 tabs.

**Goal for this project:** replicate the same uploader + dashboard pattern for **[PROCESS NAME]**,
using **[PROCESS NAME]'s own Excel export layout** — not GNC/Bellavita/Neemans's columns, which
are shown below only as *worked examples* of the pattern, not as the columns to copy literally.

---

## 2. Architecture pattern (proven — follow this shape)

```
Excel file (.xlsx export from the team's existing sheet)
        │  drag-drop / file picker, multipart/form-data upload
        ▼
Upload endpoint (per upload "type" — see §3)
        │  parse workbook → find header row → map columns → validate
        ▼
Bulk INSERT into a dedicated DB table for that upload type
        │  every batch gets a random batch ID, logged in a shared upload_log table
        ▼
Dashboard endpoint(s) — read-only aggregation queries over the stored rows,
filtered by date range / month / agent, returning KPI numbers + trend rows + agent tables
        │
        ▼
Dashboard page — KPI cards, charts, and tables built from those endpoints
```

Key design decisions worth keeping, because they're what makes the existing version reliable:

- **One table per upload "type", not one giant table.** A process typically has more than one kind
  of export (e.g. daily Sale data, an Allocation/dialer export, an Agent Utilization/APR report,
  a Cart/abandoned-cart export). Each gets its own table and its own upload endpoint, even though
  they all share the same upload widget and the same upload-log pattern.
- **No upsert, no dedup key.** Every upload is a plain bulk insert. If the same file is uploaded
  twice, rows are duplicated — on purpose, the fix is *revert*, not merge:
- **Batch-based revert instead of update-in-place.** Every upload gets a `upload_batch_id`
  (random UUID), recorded in a shared `upload_log` table (file name, row count, uploader, table
  name, timestamp). The upload UI shows recent batches with a "delete this batch" button, which
  does `DELETE FROM <table> WHERE upload_batch_id = ?`. This is how a bad upload gets undone —
  never by trying to detect-and-skip duplicate rows.
- **Dashboard queries are pure aggregation over the stored table(s)** — no caching layer needed at
  this data volume (a few thousand rows per upload). Keep it simple: read straight from the table,
  filtered by the date range the user picked.

---

## 3. Step 1 — Excel ingestion

### 3.1 Before writing any parsing code: open the real Excel file

Do this first, always — do not guess column names from memory or from a similar process. Every
process's export has a different layout, even ones that look similar at a glance. Concretely:

1. Get a real, recent export of [PROCESS NAME]'s Sales Performance workbook.
2. Open every sheet and note: sheet name, whether row 1 is the real header or there's a title/merged
   row above it, and the exact column headers (copy them verbatim — trailing spaces, `&`, `%`, and
   inconsistent capitalization all matter and will break a name-based header match if you retype
   them from memory).
3. Identify which sheet is the **raw per-row data** to actually ingest (e.g. "Sale", "Date & Camp
   wise Overall Sale", "Allocation", "APR-Utilization Raw") versus which sheets are **pre-built
   pivot/summary views** that a human currently reads for reporting — those summary sheets are not
   uploaded; they exist to tell you *what the dashboard needs to calculate*, not what to parse.

In the reference portal, the real workbooks turned out to contain both kinds of sheets in one
file — e.g. GNC's workbook has a raw `Date & Camp wise Overall Sale` sheet (this is what gets
uploaded) *and* a manually-built `Dashboard` summary sheet, an `LOB&Agent Wise Sale Made Perf`
pivot, a `Weekly Agent Wise Performance1` sheet, etc. — those extra sheets are exactly the kind of
view the new web dashboard should reproduce (see §5), but they are not upload targets themselves.

### 3.2 Choosing a header-matching strategy

Pick per sheet, based on what you actually observe in 3.1:

| Situation | Strategy |
|---|---|
| Headers are stable, unique text, always in row 1 or a locatable row | **Name-based**: build a `{ "header text (lowercased/trimmed)": fieldName }` map, find the header row by matching known header text, then read each subsequent row by header name, not position. **Preferred whenever possible** — survives the source team reordering or inserting columns. |
| Headers repeat (e.g. two columns both called "Date"), or the header row can't be reliably located by name | **Positional**: locate the header/start row by scanning for a distinctive marker cell (e.g. a cell that says exactly "UID" or matches `/^emp.?id$/i`), then read every row strictly by column index from a hardcoded field list. Fragile to column reordering — only use when name-based isn't viable, and comment clearly in the code why.

Both strategies are used in the reference implementation, chosen per-sheet for exactly this reason
(GNC's Allocation sheet has duplicate "Date" columns, forcing positional parsing there, while its
Sale sheet has clean unique headers and uses name-based parsing).

### 3.3 Data type handling — the gotcha that broke things before

- **Dates**: Excel stores dates as a serial number (days since 1900) *or* as pre-formatted text,
  depending on how the source sheet's column was formatted — and this is inconsistent even between
  different upload types for the *same* process. Handle both: if the cell value parses as a number,
  treat it as an Excel serial and convert; if it's already a recognizable date string (`DD-Mon-YY`,
  `D/M/YY`, ISO, etc.), parse that directly. **Decide once per column, store consistently**, and
  make sure the dashboard's date-bucketing logic matches whatever you chose to store (in the
  reference implementation, one process stores the raw serial number as-is and only converts it
  back to a label at query time — that's fine as a design choice, but it must be applied
  consistently or the day-wise dashboard charts silently misalign).
- **Times / durations** (login time, talk time, ACHT, etc., if the process tracks agent utilization):
  Excel stores these as a time-of-day fraction (0–1) or as `H:MM:SS` text. Convert to a single unit
  (seconds, or a normalized `H:MM:SS` string) consistently before storing.
- **Blank/placeholder values**: watch for literal placeholder strings the source team uses instead
  of a true blank — e.g. `"-"`, `"N/A"`, `"None"`. Normalize these to actual empty/NULL on insert,
  the same way the reference implementation blanks out `'-'` in specific text columns rather than
  storing the literal dash.

### 3.4 Upload endpoint requirements

For **each** upload type (one per raw-data sheet identified in 3.1):

- Accept `multipart/form-data`, field name `file`.
- **File type allow-list — confirm this explicitly, don't assume.** The reference implementation's
  upload filter only accepts `.xlsx`, `.xls`, `.csv` — it silently rejects `.xlsb`. If the team's
  real export is `.xlsb` (binary Excel, common for very large workbooks with macros/pivot caches),
  either have them export/save-as `.xlsx` before uploading, or explicitly extend the parser and
  file filter to accept `.xlsb` — don't discover this gap after the uploader is "done" and the
  first real file gets rejected.
- Reasonable size limit (50MB was sufficient for the reference workbooks, several thousand rows).
- Parse → validate → bulk insert → log the batch → respond. Response shape (keep consistent across
  every upload endpoint so the frontend widget is fully reusable):
  ```json
  // success
  { "success": true, "data": { "rowsInserted": 128, "totalRows": 130, "batchId": "<uuid>" } }
  // failure
  { "success": false, "message": "Upload failed: <reason>" }
  ```
  (`totalRows` vs `rowsInserted` differing is fine and expected — it tells the uploader "3 rows
  were skipped as blank/invalid", which the UI should surface, not hide.)
- Log every batch to a shared upload-log table: `batch_id, table_name, file_name, row_count,
  uploaded_by, uploaded_at`.
- Provide a companion `GET .../upload-logs?table=<name>` (recent batches for that table) and
  `DELETE .../upload-log/:batchId?table=<name>` (revert — deletes every row with that batch id from
  that table, and removes the log entry).

---

## 4. Step 2 — Database design

One table per upload type. Standard shape (this is the Neemans "sale raw" table, as a template —
replace the business columns with [PROCESS NAME]'s actual fields from §3.1):

```sql
CREATE TABLE IF NOT EXISTS <process>_sale_raw (
  id INT AUTO_INCREMENT PRIMARY KEY,

  -- business columns: one per Excel column you decided to ingest, named to match what the
  -- dashboard queries will actually need (not necessarily identical to the Excel header text)
  week VARCHAR(20),
  date VARCHAR(50),           -- see §3.3 re: serial vs text, pick one and be consistent
  emp_id VARCHAR(50),
  name VARCHAR(200),
  ...

  -- standard housekeeping columns — same four on every upload table, every process
  uploaded_by INT,
  upload_batch_id VARCHAR(36),
  inserted_at DATETIME DEFAULT NOW()
);
```

If the process needs **month/agent-level sales targets** (for an Achievement % KPI), add a small
targets table too, e.g.:

```sql
CREATE TABLE IF NOT EXISTS <process>_month_targets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  month VARCHAR(7) NOT NULL UNIQUE,   -- 'YYYY-MM'
  target DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_by INT,
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW()
);
```

...and an **agent roster** table if the dashboard needs an agent-details/target-management tab
(date of joining, LOB, team lead, per-agent monthly target, active/inactive status) — this doubles
as the source of truth for agent names/LOBs the dashboard joins against.

No foreign keys required to the upload_log table or between upload tables — everything is joined
at query time by shared fields like `emp_id`/agent identifier and date range. Keep it simple.

---

## 5. Step 3 — Dashboard requirements (what to actually show)

This is the part most likely to be under-scoped if the spec just says "build a dashboard." Below
is a concrete list, drawn directly from what the reference processes' teams already track by hand
today in their Excel workbooks (GNC's and Bellavita's real "Overall Sale Performance Dashboard"
workbooks were inspected sheet-by-sheet to build this list) — treat it as the *menu* to pick from
for [PROCESS NAME], not a mandatory checklist; include what's relevant to how this process is run.

### 5.1 Top KPI strip (every dashboard has this)

A row of KPI cards at the top, computed for whatever date range / month is currently selected:

- **Sale Count** (total orders/sales in range)
- **Revenue / Turnover** (₹ total)
- **Prepaid % / COD %** (payment-method split, if the process has both)
- **RTO %** (return-to-origin rate, if applicable — logistics/e-commerce processes)
- **Achievement %** — actual revenue or sale count vs. the period's target, ideally **prorated to
  the number of days elapsed so far in the period**, not divided by the full month's target (the
  reference dashboards specifically do this — an early-month view showing 20% against a full-month
  target reads as failing when it's actually on pace)
- **Active Agents / Inactive Agents** (headcount currently working this process)
- **Total Allocation** and **Connect %** / **Same-Day-Connected %** (if the process is an outbound
  dialer-driven one — allocation is how many leads were assigned, connect rate is how many were
  actually reached)

### 5.2 Date-wise trend

A line/bar chart plus a backing data table, one row per day in the selected range: sale
count, revenue, and whichever KPI split matters most (COD vs Prepaid, or channel-wise if the
process has multiple lead sources/campaigns like "Abandon Cart" / "Chat" / "Inbound").

### 5.3 Agent-wise leaderboard

Per-agent table for the selected range: agent name, team lead, sale count, revenue, COD/Paid
split, RTO %, target, achievement %, and a simple **performance-tier classification** (the
reference dashboards use a TQ/MQ/BQ — Top/Mid/Bottom Quartile — style bucket based on achievement
%; adapt the tiering to whatever the process's team already uses). Sortable by any column, plus a
small chart calling out the top N agents by revenue.

### 5.4 Weekly breakdown (if the process reports weekly, not just daily)

Same agent-wise table, but pivoted into Week-1 / Week-2 / Week-3 / Week-4(/5) columns instead of
one aggregate — lets a manager see whether an agent's performance is trending up or down within
the month, not just the month-to-date total.

### 5.5 Agent Utilization / APR tab (only if this process tracks agent occupancy/ACHT)

If [PROCESS NAME]'s team also uploads a separate Attendance/Utilization report (login hours, talk
time, average handle time, occupancy %), give it its own tab: KPI cards (Total Calls, Agents,
Avg Occupancy %, Avg ACHT, Attendance), a date-wise trend, and a full per-agent table.

### 5.6 Agent Roster / Target management tab

A simple CRUD table for the agent list backing the leaderboard — employee ID, name, LOB, team
lead, date of joining, status (active/inactive), and monthly target. This is what lets the
Achievement % KPI actually mean something instead of being hardcoded. Gate create/edit/delete to
admin/manager roles only.

### 5.7 Filters, everywhere

Every tab should accept a **date range** (from/to) or **month** picker, applied consistently.
Whichever tabs are agent-scoped should also support filtering to a single agent. Keep the picker
behavior identical across tabs so switching tabs doesn't feel like a different tool each time.

---

## 6. Step 4 — Frontend UX requirements

- **Navigation**: one entry point (e.g. a "Sales" nav item), gated by whatever role/permission
  system this project already uses — don't show it to users who shouldn't see sales figures.
- **Upload widget** (build once, reuse for every upload type on this process):
  - Drag-and-drop zone, or click-to-browse, restricted to the accepted file types (see §3.4).
  - Show the selected file's name and size before uploading.
  - An explicit "Upload" action with a loading/spinner state — never upload on file-select alone,
    let the user confirm.
  - Success state: green banner, "Uploaded N rows" (and call out if `rowsInserted < totalRows`).
  - Error state: red banner with the actual failure reason (bad file type, missing header row,
    server error) — never a silent failure.
  - **Upload History** panel below the widget: recent batches (file name, row count, uploader,
    timestamp) each with a delete/revert button, refreshing automatically after every
    upload or delete.
- **Dashboard page**: themed header banner with the date-range/month picker + a refresh button +
  (for admins) a "Set Target" action; then the KPI card strip; then the trend chart(s) and
  tables described in §5, organized into tabs if there's more than one view (Overall / Agent-wise /
  Utilization / Roster, matching the Neemans reference structure) or a single scrolling page if the
  process only needs the simpler KPI-cards-plus-one-table version (matching the Bellavita reference).
- **Numbers must be independently verifiable.** Before calling this done, take one real day/week
  from the uploaded data and manually recompute at least the top-line KPIs (sale count, revenue,
  achievement %) from the raw Excel, and confirm the dashboard matches. This is how the reference
  implementation caught a scoring bug early — don't skip it.

---

## 7. Pitfalls to avoid (lessons already paid for once — don't re-pay them)

1. **Don't accept a narrower file-type list than the real export format.** Check the actual file
   extension the team's export produces (`.xlsx` vs `.xlsb` vs `.csv`) *before* building the
   upload filter, not after the first real upload fails.
2. **Don't hand-guess column names from memory.** Always re-open the actual source file for the
   exact header text — trailing spaces, punctuation, and capitalization differences will silently
   break a name-based header map.
3. **Don't assume one column mapping applies to every upload type for the process.** A process
   with 3-4 different Excel exports (Sale, Allocation, APR, Cart) needs its column mapping derived
   separately for each — they are not the same shape even within one process.
4. **Don't build upsert/dedup logic.** It adds complexity for no real benefit at this data volume —
   use the batch-based revert pattern (§2) instead.
5. **Don't hardcode target thresholds in the frontend if the process's targets change over time.**
   Prefer a small targets table + admin-editable UI over baking a number like "RTO ≤ 10%" into the
   dashboard component — it will need to change, and someone will have to find it in the code
   instead of a settings screen.
6. **Don't compute Achievement % against the full-period target when the period isn't over yet.**
   Prorate to elapsed days, or the dashboard will look artificially bad for the first half of every
   month.
7. **Don't skip the manual-recalculation sanity check** (end of §6) before calling the dashboard
   done — a wrong aggregation query looks exactly like a right one until someone checks the math.

---

## 8. Acceptance checklist

- [ ] Every raw-data sheet identified in the process's real Excel export has its own upload
      endpoint, correctly parsing a real recent file end-to-end (not a hand-crafted test file).
- [ ] Uploading the same file twice, then reverting one batch via Upload History, leaves exactly
      one copy of the data — no duplicates, no data loss.
- [ ] Every dashboard KPI, for at least one real day/week, has been manually cross-checked against
      the source Excel and matches.
- [ ] Date-range/month filters behave consistently across every tab.
- [ ] Non-admin users cannot reach the upload screen or target-management screen if the
      permission system says they shouldn't.
- [ ] Uploading a wrong/malformed file produces a clear error message, not a silent failure or a
      server crash.
- [ ] The dashboard is usable (not broken, not blank) the moment after the very first successful
      upload — no separate "processing" step required.
