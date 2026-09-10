# Prompt — Build a Sales Uploader + Dashboard UI against an EXISTING shared database

Paste this whole document into the other project's Claude/coding session as one prompt.

**Important — read this before anything else:** the database and every table below **already
exist** in a live, shared MySQL database (schema `db_masmis`) that another portal ("My Dashboards")
is actively reading and writing right now. **Do not create these tables. Do not rename, drop, or
alter any column on them. Do not run any `CREATE TABLE` or migration against them.** Your job is
to build a **new upload interface and dashboard UI in this project**, that connects to this same
existing database and reads/writes these exact tables exactly as they already are — the UI is
yours to build; the data layer underneath it is shared and already live.

---

## 1. Connection

Connect to the same MySQL database this data already lives in:

- **Database name:** `db_masmis`
- **Tables you'll use:** listed in full below, one section per process (GNC / Bellavita / Neemans) —
  table names, column names, and types are exact and must be matched exactly in your queries.
- Get the actual host/port/user/password from whoever owns this database (don't guess or invent
  credentials) — in the source portal these are read from environment variables named
  `MYSQL_MASMIS_HOST`, `MYSQL_MASMIS_USER`, `MYSQL_MASMIS_PASSWORD`, `MYSQL_MASMIS_PORT`,
  `MYSQL_MASMIS_DATABASE` (falling back to generic `DB_HOST`/`DB_USER`/etc. if those aren't set) —
  set up equivalent config in this project, pointed at the same server.
- Use a plain SQL connection (any standard MySQL client/driver for this project's stack) — no ORM
  migration, no schema push. Treat every table below as **already there, read/write only**.

---

## 2. Shared conventions — reuse these, don't invent new ones

Because this database is shared with the live source portal, your new UI must play by the same
rules that portal already uses, or the two will step on each other:

- **Every table has `uploaded_by`, `upload_batch_id`, and a timestamp column** (`uploaded_at` or
  `inserted_at`, varies by table — see each table below). Every row your uploader inserts must set
  these three, the same way the existing portal does.
- **No upsert, no dedup key.** Every upload is a plain bulk insert. Uploading the same file twice
  creates duplicate rows — on purpose. The way to undo a bad upload is deleting everything with a
  given `upload_batch_id`, not detecting/skipping duplicates.
- **Reuse the existing shared `upload_log` table** (already exists — do not create a second one):
  ```sql
  -- existing table, reference only — do not CREATE
  CREATE TABLE `upload_log` (
    `id` int NOT NULL AUTO_INCREMENT,
    `batch_id` varchar(36) NOT NULL,
    `table_name` varchar(100) NOT NULL,
    `file_name` varchar(255) DEFAULT NULL,
    `row_count` int DEFAULT NULL,
    `uploaded_by` int DEFAULT NULL,
    `uploaded_at` datetime DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_batch_id` (`batch_id`)
  );
  ```
  After every successful upload, insert one row here (`batch_id` = a fresh random UUID you
  generate, `table_name` = whichever table you just inserted into, `row_count` = rows inserted).
  This table is shared across every process and every uploader (including the source portal's own
  uploads) — **don't filter your reads/writes to "only rows my UI created"**; a revert should work
  the same way regardless of which UI made the upload.
- **`uploaded_by` is a user ID (int)** — from whatever this project's own auth/user system is. It
  does not need to match any user ID meaning in the source portal; it's just "who ran this upload,"
  scoped to this project's own users.

---

## 3. What to build

For **each** process (GNC, Bellavita, Neemans — or whichever subset you actually need):

1. **Upload screen**: drag-and-drop or file-picker (accept `.xlsx`/`.xls`/`.csv`; confirm with
   whoever supplies real files whether `.xlsb` needs supporting too — the source portal's own
   uploader does not accept `.xlsb`), an Upload button, success/error feedback showing rows
   inserted, and an Upload History panel (recent batches + a revert/delete button per batch, per
   §2).
2. **Upload endpoint**: parses the file, maps columns per the exact structure below, bulk-inserts
   into the matching existing table, logs the batch. Response contract to use (matches the source
   portal's, keep it so any shared tooling/expectations stay compatible):
   ```json
   { "success": true, "data": { "rowsInserted": 128, "totalRows": 130, "batchId": "<uuid>" } }
   { "success": false, "message": "Upload failed: <reason>" }
   ```
3. **Dashboard screen**: reads back from the same tables (plain `SELECT`/aggregation queries,
   filtered by whatever date range/month the user picks) and renders:
   - KPI cards: Sale Count, Revenue, Prepaid %/COD %, RTO % (if applicable), Achievement % vs.
     target (prorated to elapsed days in the period — don't divide by the full-period target for a
     still-in-progress month), Active/Inactive agent counts.
   - A date-wise trend (chart + table).
   - An agent-wise leaderboard (sale count, revenue, COD/Paid split, RTO %, achievement % vs
     target).
   - For Neemans specifically: also a weekly breakdown view and an Agent Details tab backed by
     `nms_Agent_Details` (§6.5), since that table exists specifically to support per-agent
     targets/roster management.

This is the same feature shape as the source portal's own Sales dashboard — build your UI to match
that shape, using your own project's component library/design system; only the underlying tables
are shared, not any frontend code.

---

## 4. GNC — existing tables (reference only, already exist)

### `gnc_sale`
```sql
-- existing table, reference only — do not CREATE
CREATE TABLE `gnc_sale` (
  `id` int NOT NULL AUTO_INCREMENT,
  `week` varchar(20), `sale_date` date, `emp_id` varchar(50), `emp_name` varchar(255),
  `tl` varchar(255), `t1` date, `t3` varchar(100), `customer_number` varchar(50),
  `email_id` varchar(255), `payment_status` varchar(100), `gross_amount` decimal(12,2),
  `sum_before_gst` decimal(12,2), `order_id` varchar(100), `campaign` varchar(255),
  `discount_code` varchar(255), `sale_count` int, `status` varchar(255),
  `line_item_name` text, `sale_lob` varchar(100), `target` int, `sale_source` varchar(100),
  `uploaded_at` datetime DEFAULT CURRENT_TIMESTAMP, `uploaded_by` int, `upload_batch_id` varchar(36),
  PRIMARY KEY (`id`)
);
```
Source Excel header row → column, name-based lookup (lowercase+trim, both space and underscore
variants accepted):
```
Week→week  Date→sale_date  EMP ID/emp_id→emp_id  Emp_Name→emp_name  TL→tl  T1→t1  T3→t3
CustomerNumber→customer_number  E-mail ID→email_id  Payment Status→payment_status
Gross Amount→gross_amount  Sum Before GST→sum_before_gst  OrderID→order_id  Campaign→campaign
Discount Code→discount_code  Count→sale_count  Status→status  Lineitem name→line_item_name
Sale LOB→sale_lob  Target→target  Sale Source→sale_source
```
Treat literal `'-'` text values as blank/NULL on insert.

### `gnc_apr`
```sql
-- existing table, reference only — do not CREATE
CREATE TABLE `gnc_apr` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uid` varchar(200), `report_date` date, `user_name` varchar(255), `emp_id` varchar(50),
  `tl_name` varchar(255), `calls` int, `process_type` varchar(255), `login_time` varchar(50),
  `wait_time` varchar(50), `talk_time` varchar(50), `dispo_time` varchar(50),
  `pause_time` varchar(50), `login_duration` varchar(50), `logout_time` varchar(50), `acht` int,
  `aoc` varchar(50), `bio` varchar(50), `bre` varchar(50), `briefing` varchar(50),
  `down_time` varchar(50), `lunch` varchar(50), `meet` varchar(50), `qa` varchar(50),
  `sb` varchar(50), `tea_break` varchar(50), `training_break` varchar(50), `wash` varchar(50),
  `net_login` varchar(50), `break_time` varchar(50), `tra_qa` varchar(50), `downtime` varchar(50),
  `atten` int, `capping` varchar(50),
  `uploaded_at` datetime DEFAULT CURRENT_TIMESTAMP, `uploaded_by` int, `upload_batch_id` varchar(36),
  PRIMARY KEY (`id`)
);
```
**Positional parsing** (33 columns, 0-indexed) — locate the header/start row by scanning for a cell
that is exactly `"UID"`, then read every following row strictly by column index in the order the
columns are listed above (`uid` = index 0, `report_date` = index 1, … `capping` = index 32). This
sheet has duplicate header text, which is why it's positional, not name-based — re-verify the exact
index order against a real GNC APR export before wiring the insert.

### `gnc_allocation`
```sql
-- existing table, reference only — do not CREATE
CREATE TABLE `gnc_allocation` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uid` varchar(200), `alloc_date` date, `helper` varchar(200), `date_type` varchar(50),
  `time_slot` varchar(50), `store` varchar(200), `customer_name` varchar(255), `email` varchar(255),
  `total` decimal(12,2), `created_at` datetime, `lineitem_name` text, `lineitem_sku` varchar(2000),
  `shipping_name` varchar(255), `shipping_street` text, `shipping_city` varchar(255),
  `shipping_zip` varchar(20), `shipping_phone` varchar(50), `emp_id` varchar(50),
  `calling_status` varchar(50), `sub_scenarios_1` varchar(50), `callback_date` date,
  `same_day_connect` varchar(50), `nc_connect` varchar(50),
  `uploaded_at` datetime DEFAULT CURRENT_TIMESTAMP, `uploaded_by` int, `upload_batch_id` varchar(36),
  PRIMARY KEY (`id`)
);
```
**Positional parsing** (23 columns, 0-indexed), header row also located by a cell that is exactly
`"UID"` (this sheet has duplicate "Date" columns). Column order matches the field list above,
`uid` = index 0 through `nc_connect` = index 22 — re-verify against a real file before wiring.

---

## 5. Bellavita — existing tables (reference only, already exist)

### `bb_sale`
```sql
-- existing table, reference only — do not CREATE
CREATE TABLE `bb_sale` (
  `id` int NOT NULL AUTO_INCREMENT,
  `week` varchar(20), `Date` date, `emp_id` varchar(50), `emp_name` varchar(255), `tl` varchar(255),
  `t1` varchar(100), `t2` varchar(100), `FHD` date, `days` int, `phone_number` varchar(50),
  `email_id` varchar(255), `payment_status` varchar(100), `amount` decimal(12,2),
  `bella_vita_order_id` varchar(100), `campaign` varchar(255), `calling_status` varchar(255),
  `discount_code` varchar(255), `sale_count` int, `current_status` varchar(255),
  `final_status` varchar(255), `Order_DateTime` datetime, `state` varchar(255),
  `line_item_name` text, `pincode` varchar(50), `Order Date` date, `hrs_24_48` varchar(100),
  `crazy_deal` varchar(255), `perfume` varchar(255), `size` varchar(100),
  `order_pickup_datetime` datetime, `rto_initiated_datetime` datetime, `diff_hour` int,
  `lob` varchar(255), `pincode_relevent` varchar(255), `rto_status` varchar(255),
  `draft_order` varchar(255), `time_1608` varchar(100), `sale_source_name` varchar(255),
  `shift` varchar(100),
  `uploaded_at` datetime DEFAULT CURRENT_TIMESTAMP, `uploaded_by` int, `upload_batch_id` varchar(36),
  PRIMARY KEY (`id`)
);
```
Name-based lookup, source header row (verified against a real Bellavita `Sale` sheet):
```
Week Date EMP ID Emp_Name TL T1 T2 FHD Days "Phone Number" "E-mail ID" "Payment Status" Amount
"Bella Vita Order ID" Campaign "Calling Status" "Discount Code" Count "Current Status"
"Final Status" "Order Date&Time" State "Line Item Name" Pincode "Order Date" "24Hrs&48hrs"
"Crazy Deal" Perfume Size "Order Pickup Date" "RTO Initiated Date" "Diff Hour" LOB
"Pincode Relevent" "RTO Status" "Draft Order" Target "Sale Source Name" Shift
```
each maps 1:1 to the matching column above by meaning (e.g. `"Bella Vita Order ID"` →
`bella_vita_order_id`, `"24Hrs&48hrs"` → `hrs_24_48`).

### `bb_apr`
```sql
-- existing table, reference only — do not CREATE
CREATE TABLE `bb_apr` (
  `id` int NOT NULL AUTO_INCREMENT,
  `unique_id` varchar(200), `week` varchar(10), `report_date` date, `emp_name` varchar(255),
  `noiid` varchar(50), `num_calls_chat` int, `lob` varchar(255), `login_time` varchar(50),
  `wait_time` varchar(50), `talk_time` varchar(50), `dispo_time` varchar(50),
  `pause_time` varchar(50), `acht` int, `lunch` varchar(50), `tea` varchar(50), `tea1` varchar(50),
  `washr` varchar(50), `team_briefing_aux` varchar(50), `net_pause` varchar(50),
  `avg_dispo` varchar(50), `total_break` varchar(50), `actual_login_hrs` varchar(50),
  `downtime` varchar(50), `login_duration` varchar(50), `logout_time` varchar(50),
  `net_login_hrs` varchar(50), `utilization` varchar(50), `attendance_1` varchar(50),
  `week_1` varchar(50), `mtd` varchar(50), `team_leader` varchar(255), `fhd` varchar(50),
  `tenure` int, `tenurity_week` varchar(50), `sub_lob` varchar(255), `unique_count` int,
  `attendance_2` varchar(50), `capping` varchar(50), `attendance_3` varchar(50),
  `uploaded_at` datetime DEFAULT CURRENT_TIMESTAMP, `uploaded_by` int, `upload_batch_id` varchar(36),
  PRIMARY KEY (`id`)
);
```
**Positional parsing** (41 columns, 0-indexed), header row located by scanning for a cell that is
exactly `"UID"` — duplicate "Attendance" columns force positional here. Re-derive the exact index
order against a real Bellavita APR export before wiring the insert; treat the column list above as
the authoritative target shape.

### `bb_chat`
```sql
-- existing table, reference only — do not CREATE
CREATE TABLE `bb_chat` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ticket_id` varchar(100), `inbox_id` varchar(100), `inbox_name` varchar(255),
  `ticket_status` varchar(255), `agent_name` varchar(255), `email_1` varchar(255),
  `phone_number` varchar(50), `created_at` datetime, `assigned_at` datetime,
  `agent_frt_at` datetime, `frt_1` varchar(50), `resolution_time_at` datetime,
  `resolution_time` varchar(50), `average_wait_time` varchar(50), `is_resolved` varchar(50),
  `is_outside_working_hrs` varchar(50), `level1_tags` text, `level2_tags` text, `level3_tags` text,
  `system_tags` text, `chat_link` text, `repeat_status` varchar(255),
  `repeat_status_on_assign` varchar(255), `time_1406` varchar(50), `resolution_time_min` varchar(50),
  `frt_tat` varchar(50), `resolution_tat` varchar(50), `phone_number1` varchar(50),
  `current_agent` varchar(255), `email_2` varchar(255), `chat_date` date, `emp_id` varchar(50),
  `lob` varchar(255), `week` varchar(10), `count_1` decimal(10,2), `time_slot` varchar(50),
  `hour` int, `tl_name` varchar(255), `disposition` varchar(255),
  `day_shift_night_shift` varchar(50), `unique_id` varchar(200), `froud` varchar(50),
  `frt_2` varchar(50), `user_type` varchar(255),
  `uploaded_at` datetime DEFAULT CURRENT_TIMESTAMP, `uploaded_by` int, `upload_batch_id` varchar(36),
  PRIMARY KEY (`id`)
);
```
**Positional parsing** (44 columns, 0-indexed), header row located by a cell exactly `"TICKET ID"`.
Column order (verified): `ticket_id`(0) `inbox_id`(1) `inbox_name`(2) `ticket_status`(3)
`agent_name`(4) `email_1`(5) `phone_number`(6) `created_at`(7) `assigned_at`(8) `agent_frt_at`(9)
`frt_1`(10) `resolution_time_at`(11) `resolution_time`(12) `average_wait_time`(13)
`is_resolved`(14) `is_outside_working_hrs`(15) `level1_tags`(16) `level2_tags`(17)
`level3_tags`(18) `system_tags`(19) `chat_link`(20) `repeat_status`(21)
`repeat_status_on_assign`(22) `time_1406`(23) `resolution_time_min`(24) `frt_tat`(25)
`resolution_tat`(26) `phone_number1`(27) `current_agent`(28) `email_2`(29) `chat_date`(30)
`emp_id`(31) `lob`(32) `week`(33) `count_1`(34) `time_slot`(35) `hour`(36) `tl_name`(37)
`disposition`(38) `day_shift_night_shift`(39) `unique_id`(40) `froud`(41) `frt_2`(42) `user_type`(43)

### `bb_cart`, `bvo_order_export`, `bvo_Repeat_cdr`, `bvo_repeat_allocation`
```sql
-- existing tables, reference only — do not CREATE
CREATE TABLE `bb_cart` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cc` varchar(50), `source` varchar(255), `sno` int, `cart_id` varchar(50),
  `created_at` varchar(50), `updated_at` varchar(50), `customer_name` varchar(255),
  `customer_address` text, `phone_number` varchar(50), `email_id` varchar(255), `line_items` text,
  `variant_title` text, `abandoned_cart_link` text, `amount` decimal(12,2),
  `phone_10_digit` varchar(20), `dates` varchar(50), `agent` varchar(100),
  `disposition` varchar(255), `sub_disposition` varchar(255), `call_date` varchar(50),
  `same_day_connect` varchar(50), `status` varchar(100),
  `uploaded_at` datetime DEFAULT CURRENT_TIMESTAMP, `uploaded_by` int, `upload_batch_id` varchar(36),
  PRIMARY KEY (`id`)
);   -- header row located by a cell exactly "CC", name-based mapping after that

CREATE TABLE `bvo_order_export` (
  `id` int NOT NULL AUTO_INCREMENT,
  `shipping_phone` varchar(50), `name` varchar(100), `shipping_phone_2` varchar(50),
  `email` varchar(255), `financial_status` varchar(50), `total` decimal(12,2),
  `name_2` varchar(100), `discount_code` varchar(100), `created_at_raw` varchar(50),
  `lineitem_name` text, `shipping_name` varchar(255), `shipping_zip` varchar(20), `tags` text,
  `shipping_city` varchar(255), `shipping_province_name` varchar(255), `order_date` varchar(20),
  `uploaded_at` datetime DEFAULT CURRENT_TIMESTAMP, `uploaded_by` int, `upload_batch_id` varchar(36),
  PRIMARY KEY (`id`)
);

CREATE TABLE `bvo_Repeat_cdr` (
  `id` int NOT NULL AUTO_INCREMENT,
  `PhoneNumber` varchar(15), `CallStatus` varchar(20), `Agent` varchar(20),
  `uploaded_at` datetime DEFAULT CURRENT_TIMESTAMP, `uploaded_by` int, `upload_batch_id` varchar(36),
  PRIMARY KEY (`id`)
);

CREATE TABLE `bvo_repeat_allocation` (
  `id` int NOT NULL AUTO_INCREMENT,
  `unique_id` varchar(50), `mobile_no` varchar(20), `payment_mode` varchar(50), `email` varchar(255),
  `order_invoice_amount` decimal(12,2), `order_id` varchar(100), `product_name` text,
  `shipping_customer_name` varchar(255), `previous_order_creation_date` varchar(50),
  `uploaded_at` datetime DEFAULT CURRENT_TIMESTAMP, `uploaded_by` int, `upload_batch_id` varchar(36),
  PRIMARY KEY (`id`)
);
```
For these four, confirm the exact source-file header row against a real export before wiring the
column map — the column lists above are the exact, authoritative target shape (already live in the
database) regardless of which parsing strategy the source file's layout calls for.

---

## 6. Neemans — existing tables (reference only, already exist)

This is the most complete reference — it has a finished dashboard already, including
target-tracking and an agent roster, so build against all six of its tables, not just the raw sale
data, if you want feature parity.

### `neemans_sale_raw`
```sql
-- existing table, reference only — do not CREATE
CREATE TABLE `neemans_sale_raw` (
  `id` int NOT NULL AUTO_INCREMENT,
  `week` varchar(20), `date` varchar(50), `emp_id` varchar(50), `name` varchar(200),
  `tl` varchar(200), `lob` varchar(100), `tenure` varchar(100), `order_id` varchar(100),
  `customer_number` varchar(30), `email_id` varchar(255), `payment_status` varchar(100),
  `amount` decimal(12,2), `discount_code` varchar(255), `line_item_name` text,
  `calling_lob` varchar(100), `calling_status` varchar(100), `status` varchar(100), `count` int,
  `neemans_order_id` varchar(100), `current_status` varchar(255), `final_status` varchar(255),
  `line_item_qty` int, `target` int, `call_date_time` varchar(100), `duration` varchar(100),
  `created_at_raw` varchar(100),
  `uploaded_by` int, `upload_batch_id` varchar(36), `inserted_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);
```
**Positional parsing** (26 columns, 0-indexed), header row located by a cell matching
`/^(emp.?id|week)$/i`. Column order: `week`(0) `date`(1) `emp_id`(2) `name`(3) `tl`(4) `lob`(5)
`tenure`(6) `order_id`(7) `customer_number`(8) `email_id`(9) `payment_status`(10) `amount`(11)
`discount_code`(12) `line_item_name`(13) `calling_lob`(14) `calling_status`(15) `status`(16)
`count`(17) `neemans_order_id`(18) `current_status`(19) `final_status`(20) `line_item_qty`(21)
`target`(22) `call_date_time`(23) `duration`(24) `created_at_raw`(25).

**Critical existing-data quirk — read before querying, not just before inserting:** the `date`
column in the **existing rows already in this table** stores the raw Excel serial number as text
(no conversion applied), not a calendar date string. If you read this table for a dashboard, you
must convert serial→date the same way (days since 1899-12-30, standard Excel epoch) or your
date-wise grouping will be wrong. If you also insert new rows via your own uploader, insert the
same way (raw serial, unconverted) — mixing conventions mid-table breaks every date-based query
that follows.

### `neemans_allocation`
```sql
-- existing table, reference only — do not CREATE
CREATE TABLE `neemans_allocation` (
  `id` int NOT NULL AUTO_INCREMENT,
  `phone` varchar(30), `email` varchar(255), `customer_name` varchar(255), `product_title` text,
  `amount` decimal(12,2), `type` varchar(100), `date` varchar(50), `agent` varchar(200),
  `calling_status` varchar(100), `sub_scenario1` varchar(255), `sub_scenario2` varchar(255),
  `call_id` varchar(100),
  `uploaded_by` int, `upload_batch_id` varchar(36), `inserted_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);
```
Name-based with alias fallbacks (normalize header to lowercase snake_case first):
```
phone ← phone|phone_number|mobile             agent ← agent|agent_name|agentname
email ← email|email_id|emailid                callingStatus ← callingstatus|calling_status|status
customerName ← customername|customer_name|name  subScenario1 ← subscenario1|sub_scenario1|scenario1
productTitle ← producttitle|product_title|line_items|lineitems|product|products
amount ← amount|value|total|cart_value        subScenario2 ← subscenario2|sub_scenario2|scenario2
type ← type   date ← date                     callId ← callid|call_id|id
```

### `neemans_cart`
```sql
-- existing table, reference only — do not CREATE
CREATE TABLE `neemans_cart` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sno` int, `cart_id` varchar(100), `created_at` varchar(50), `updated_at` varchar(50),
  `customer_name` varchar(200), `phone_number` varchar(20), `email_id` varchar(200),
  `line_items` text, `amount` decimal(12,2), `agent` varchar(100), `disposition` varchar(100),
  `sub_disposition` varchar(100), `call_date` date, `status` varchar(50),
  `uploaded_by` int, `upload_batch_id` varchar(36), `inserted_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);
```
Name-based with alias fallbacks, header row located by a cell matching `/sno|cart.?id|customer/i`:
```
sno ← sno|s_no|serial                    lineItems ← line_items|lineitems|items|products|product
cartId ← cart_id|cartid|id               amount ← amount|cart_value|value|total
createdAt ← created_at|created_date|createdat    agent ← agent|agent_name|agentname
updatedAt ← updated_at|updated_date|updatedat    disposition ← disposition|disp
customerName ← customer_name|customername|name  subDisposition ← sub_disposition|subdisposition|sub_disp
phoneNumber ← phone_number|phonenumber|phone|mobile  callDate ← call_date|calldate|date
emailId ← email_id|email|emailid                 status ← status
```

### `neemans_apr`
```sql
-- existing table, reference only — do not CREATE
CREATE TABLE `neemans_apr` (
  `id` int NOT NULL AUTO_INCREMENT,
  `unique_id` varchar(100), `week` varchar(100), `date` varchar(100), `emp_name` varchar(200),
  `emp_id` varchar(100), `calls` int DEFAULT 0, `uca_ob` int DEFAULT 0, `lob` varchar(200),
  `login_time` varchar(100), `parks` int DEFAULT 0, `park_time` varchar(100),
  `avg_park` varchar(100), `parks_per_call` decimal(8,2), `wait` varchar(100), `talk` varchar(100),
  `dispo` varchar(100), `pause` varchar(100), `login_ts` varchar(100), `logout_ts` varchar(100),
  `acht` int DEFAULT 0, `team_briefing` varchar(100), `lunch` varchar(100), `tea` varchar(100),
  `tea1` varchar(100), `washr` varchar(100), `total_break` varchar(100), `net_login` varchar(100),
  `occu_pct` decimal(6,2), `week_short` varchar(100), `mtd` varchar(100), `attendance` int DEFAULT 0,
  `capping` varchar(100),
  `uploaded_by` int, `upload_batch_id` varchar(36), `inserted_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);
```
**Strictly positional** (32 columns, 0-indexed), no header search at all — data starts at row 1
(row 0 is skipped as the header). Column order matches the field list above exactly, index 0 =
`unique_id` through index 31 = `capping`. Two conversions applied on the way in (replicate both if
you also write to this table): the `date` column accepts either an Excel serial or text
(`1-Jul-26`, ISO) and is normalized to `DD-MMM-YYYY`; time-like columns convert an Excel
time-of-day fraction to `H:MM:SS` text.

### `neemans_month_targets` (Achievement % KPI source)
```sql
-- existing table, reference only — do not CREATE
CREATE TABLE `neemans_month_targets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `month` varchar(7) NOT NULL,      -- 'YYYY-MM'
  `target` decimal(15,2) NOT NULL DEFAULT 0.00,
  `created_by` int, `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `month` (`month`)
);
```
Not upload-populated — build a small admin-only screen to list/edit it (`month` + `target` per
row) if your dashboard needs the Achievement % KPI.

### `nms_Agent_Details` (agent roster, powers an Agent Details tab)
```sql
-- existing table, reference only — do not CREATE
CREATE TABLE `nms_Agent_Details` (
  `id` int NOT NULL AUTO_INCREMENT,
  `emp_id` varchar(20) NOT NULL, `daildesk_id` varchar(100), `name` varchar(200) NOT NULL,
  `lob` varchar(100), `tl` varchar(200), `doj` date, `fhd` date,
  `status` varchar(20) DEFAULT 'Active', `dol` date,
  `created_by` int, `updated_by` int, `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `monthly_target` decimal(15,2) DEFAULT 0.00,
  PRIMARY KEY (`id`)
);
```
Full CRUD screen (list/create/edit/delete) — this is what the agent-wise leaderboard should join
against for agent name/LOB/team-lead display and per-agent target.

---

## 7. Before you write a single query

Even though the table structure above is exact (pulled directly from the live database), **the
source Excel files' real headers can drift over time** — someone may have already renamed a column
in their export template since this was written. Get one real, recent export file per process you're
building, open it, and confirm the header row still matches what's documented above before wiring
the parser. If it's drifted, adjust your column-mapping logic to match the real file — the *target
table structure* is fixed (don't touch it), but the *source-file parsing* should always match
reality over documentation.
