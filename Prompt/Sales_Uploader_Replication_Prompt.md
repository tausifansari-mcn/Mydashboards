# Prompt — Replicate the GNC / Bellavita / Neemans Sales Uploaders in this project

Paste this entire document into your project's AI coding session as one prompt. It is a literal,
field-by-field description of an Excel-uploader feature that is already built and running in a
sister portal called "My Dashboards", for three processes: **GNC**, **Bellavita**, and **Neemans**.
Build the same tables and the same upload logic in this project's database and backend.

**Status in the source portal, to match here:**
- **Neemans** — uploader **and** a full 5-tab dashboard, both complete. This is the gold-standard,
  most finished example.
- **Bellavita** — uploader fully built (7 upload types) **and** a working, simpler one-page
  dashboard.
- **GNC** — uploader fully built (3 upload types); the dashboard side was not finished (that's a
  separate task — build the tables/uploaders described here first, dashboards can follow using the
  same visual/data pattern as Bellavita/Neemans once the data is flowing).

---

## 0. Shared infrastructure — build this once, all three processes use it

### 0.1 Upload log table (tracks every upload, enables revert)

```sql
CREATE TABLE `upload_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `batch_id` varchar(36) NOT NULL,
  `table_name` varchar(100) NOT NULL,
  `file_name` varchar(255) DEFAULT NULL,
  `row_count` int DEFAULT NULL,
  `uploaded_by` int DEFAULT NULL,
  `uploaded_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_batch_id` (`batch_id`),
  KEY `idx_table` (`table_name`),
  KEY `idx_uploaded_at` (`uploaded_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Every upload endpoint, after inserting rows, does:
```sql
INSERT INTO upload_log (batch_id, table_name, file_name, row_count, uploaded_by)
VALUES (?, ?, ?, ?, ?)
```
using a fresh random UUID as `batch_id`. **No upsert, no dedup key on the data tables** — re-uploading
the same file just inserts more rows. The fix for a bad upload is deleting that batch:
```sql
DELETE FROM <table_name> WHERE upload_batch_id = ?;
DELETE FROM upload_log WHERE batch_id = ?;
```
Expose this as `GET /sales/upload-logs?table=<name>` (recent batches for that table) and
`DELETE /sales/upload-log/:batchId?table=<name>` (revert one batch).

### 0.2 Upload endpoint plumbing

- `multipart/form-data`, field name `file`, in-memory (not disk) storage, 50MB limit.
- **File-type allow-list — the source portal only accepts `.xlsx`, `.xls`, `.csv`** (checked by
  both MIME type and file extension). If any of GNC/Bellavita/Neemans's real files in this project
  are `.xlsb`, either convert to `.xlsx` before upload or extend this allow-list and the parser —
  decide this explicitly, don't find out when the first real upload is rejected.
- Parse with a library that reads `.xlsx`/`.xls`/`.csv` into a 2D array (`XLSX.utils.sheet_to_json`
  with `{ header: 1 }` in the source portal, using the `xlsx`/SheetJS package — use the equivalent
  in this project's stack).
- Every upload endpoint returns the same response shape:
  ```json
  // success
  { "success": true, "data": { "rowsInserted": 128, "totalRows": 130, "batchId": "<uuid>" } }
  // failure
  { "success": false, "message": "Upload failed: <reason>" }
  ```
- Gate every route (uploads, dashboards, logs) behind auth + a role check (admin/manager/etc. —
  match whatever this project's role system already has) — don't leave sales data open.

---

## 1. GNC

Three upload types: **Sale**, **APR** (agent utilization report), **Allocation**.

### 1.1 `gnc_sale` — table

```sql
CREATE TABLE `gnc_sale` (
  `id` int NOT NULL AUTO_INCREMENT,
  `week` varchar(20) DEFAULT NULL,
  `sale_date` date DEFAULT NULL,
  `emp_id` varchar(50) DEFAULT NULL,
  `emp_name` varchar(255) DEFAULT NULL,
  `tl` varchar(255) DEFAULT NULL,
  `t1` date DEFAULT NULL,
  `t3` varchar(100) DEFAULT NULL,
  `customer_number` varchar(50) DEFAULT NULL,
  `email_id` varchar(255) DEFAULT NULL,
  `payment_status` varchar(100) DEFAULT NULL,
  `gross_amount` decimal(12,2) DEFAULT NULL,
  `sum_before_gst` decimal(12,2) DEFAULT NULL,
  `order_id` varchar(100) DEFAULT NULL,
  `campaign` varchar(255) DEFAULT NULL,
  `discount_code` varchar(255) DEFAULT NULL,
  `sale_count` int DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  `line_item_name` text,
  `sale_lob` varchar(100) DEFAULT NULL,
  `target` int DEFAULT NULL,
  `sale_source` varchar(100) DEFAULT NULL,
  `uploaded_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `uploaded_by` int DEFAULT NULL,
  `upload_batch_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_emp_id` (`emp_id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_sale_date` (`sale_date`),
  KEY `idx_uploaded_at` (`uploaded_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Parsing: header-name based.** Row 1 of the source sheet is the header row. Lowercase + trim every
header cell, build a `{header text: column index}` map, then read every subsequent non-blank row by
looking up each field's header text (case-insensitive, both space- and underscore-separated variants
accepted). Confirmed against a real GNC export (`Date & Camp wise Overall Sale` sheet) — header row
is exactly:
```
Week | Date | EMP ID | Emp_Name | TL | T1 | T3 | CustomerNumber | E-mail ID | Payment Status |
Gross Amount | Sum Before GST | OrderID | Campaign | Discount Code | Count | Status |
Lineitem name | Status
```
Header → field mapping:
```
week → week                              gross amount / gross_amount → grossAmount (decimal)
date → saleDate                          sum before gst / sum_before_gst → sumBeforeGst (decimal)
emp id / emp_id → empId                  gnc order id / gnc_order_id → orderId
emp name / emp_name → empName            campaign → campaign
tl → tl                                  discount code / discount_code → discountCode
t1 → t1                                  count → count (int)
t3 → t3                                  status → status
customer number / customer_number → customerNumber   line item name / line_item_name → lineItemName
email id / email_id → emailId            sale lob / sale_lob → saleLob
payment status / payment_status → paymentStatus       target → target (int)
                                          sale source / sale_source → saleSource
```
Treat `'-'` string literals in text fields as blank/NULL on insert (the source file uses `-` as its
"no value" placeholder in several columns).

### 1.2 `gnc_apr` — table

```sql
CREATE TABLE `gnc_apr` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uid` varchar(200) DEFAULT NULL,
  `report_date` date DEFAULT NULL,
  `user_name` varchar(255) DEFAULT NULL,
  `emp_id` varchar(50) DEFAULT NULL,
  `tl_name` varchar(255) DEFAULT NULL,
  `calls` int DEFAULT NULL,
  `process_type` varchar(255) DEFAULT NULL,
  `login_time` varchar(50) DEFAULT NULL,
  `wait_time` varchar(50) DEFAULT NULL,
  `talk_time` varchar(50) DEFAULT NULL,
  `dispo_time` varchar(50) DEFAULT NULL,
  `pause_time` varchar(50) DEFAULT NULL,
  `login_duration` varchar(50) DEFAULT NULL,
  `logout_time` varchar(50) DEFAULT NULL,
  `acht` int DEFAULT NULL,
  `aoc` varchar(50) DEFAULT NULL,
  `bio` varchar(50) DEFAULT NULL,
  `bre` varchar(50) DEFAULT NULL,
  `briefing` varchar(50) DEFAULT NULL,
  `down_time` varchar(50) DEFAULT NULL,
  `lunch` varchar(50) DEFAULT NULL,
  `meet` varchar(50) DEFAULT NULL,
  `qa` varchar(50) DEFAULT NULL,
  `sb` varchar(50) DEFAULT NULL,
  `tea_break` varchar(50) DEFAULT NULL,
  `training_break` varchar(50) DEFAULT NULL,
  `wash` varchar(50) DEFAULT NULL,
  `net_login` varchar(50) DEFAULT NULL,
  `break_time` varchar(50) DEFAULT NULL,
  `tra_qa` varchar(50) DEFAULT NULL,
  `downtime` varchar(50) DEFAULT NULL,
  `atten` int DEFAULT NULL,
  `capping` varchar(50) DEFAULT NULL,
  `uploaded_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `uploaded_by` int DEFAULT NULL,
  `upload_batch_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_emp_id` (`emp_id`),
  KEY `idx_report_date` (`report_date`),
  KEY `idx_uploaded_at` (`uploaded_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Parsing: positional (33 columns, 0-indexed), header row located by scanning for a cell that is
exactly `"UID"`** (case-insensitive), then reading every row after it strictly by column position —
*not* by header name, because this sheet's real headers include duplicates that make name-lookup
unreliable. Confirmed against the real GNC `APR-Utilization Raw` sheet — column order is:
```
0 uid            9  wait_time      18 briefing      27 tra_qa
1 report_date    10 talk_time      19 down_time     28 downtime
2 user_name      11 dispo_time     20 lunch         29 atten
3 emp_id         12 pause_time     21 meet          30 capping
4 tl_name        13 login_duration 22 qa            (32 cols total)
5 calls          14 logout_time    23 sb
6 process_type   15 acht           24 tea_break
7 login_time     16 aoc            25 training_break
8 wait_time      17 bio            26 wash / net_login / break_time
```
(Re-derive the exact index list against the real file before building — column count/order must
match precisely for positional parsing; the table's field list above is the authoritative target
shape either way.)

### 1.3 `gnc_allocation` — table

```sql
CREATE TABLE `gnc_allocation` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uid` varchar(200) DEFAULT NULL,
  `alloc_date` date DEFAULT NULL,
  `helper` varchar(200) DEFAULT NULL,
  `date_type` varchar(50) DEFAULT NULL,
  `time_slot` varchar(50) DEFAULT NULL,
  `store` varchar(200) DEFAULT NULL,
  `customer_name` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `total` decimal(12,2) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `lineitem_name` text,
  `lineitem_sku` varchar(2000) DEFAULT NULL,
  `shipping_name` varchar(255) DEFAULT NULL,
  `shipping_street` text,
  `shipping_city` varchar(255) DEFAULT NULL,
  `shipping_zip` varchar(20) DEFAULT NULL,
  `shipping_phone` varchar(50) DEFAULT NULL,
  `emp_id` varchar(50) DEFAULT NULL,
  `calling_status` varchar(50) DEFAULT NULL,
  `sub_scenarios_1` varchar(50) DEFAULT NULL,
  `callback_date` date DEFAULT NULL,
  `same_day_connect` varchar(50) DEFAULT NULL,
  `nc_connect` varchar(50) DEFAULT NULL,
  `uploaded_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `uploaded_by` int DEFAULT NULL,
  `upload_batch_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_emp_id` (`emp_id`),
  KEY `idx_alloc_date` (`alloc_date`),
  KEY `idx_uploaded_at` (`uploaded_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Parsing: positional (23 columns, 0-indexed)**, header row located the same way as APR — scan for
a cell that is exactly `"UID"`. Positional because this sheet has duplicate "Date" columns, which
defeats name-based lookup. Confirmed against the real GNC `Allocation` sheet — column order is:
```
0 uid              6 customer_name    12 lineitem_sku      18 calling_status
1 alloc_date       7 email            13 shipping_name     19 sub_scenarios_1
2 helper           8 total            14 shipping_street   20 callback_date
3 date_type        9 created_at       15 shipping_city     21 same_day_connect
4 time_slot        10 lineitem_name   16 shipping_zip      22 nc_connect
5 store            11 (lineitem_sku)  17 shipping_phone / emp_id
```
(Re-verify indices 10-17 against the real file — this region is the most likely to drift; treat the
DDL column list above as the ground truth for what must end up populated, in this order.)

---

## 2. Bellavita

Seven upload types: **Sale**, **APR**, **Chat**, **Cart**, **Order Export**, **Repeat CDR**,
**Repeat Allocation**.

### 2.1 `bb_sale` — table

```sql
CREATE TABLE `bb_sale` (
  `id` int NOT NULL AUTO_INCREMENT,
  `week` varchar(20) DEFAULT NULL,
  `Date` date DEFAULT NULL,
  `emp_id` varchar(50) DEFAULT NULL,
  `emp_name` varchar(255) DEFAULT NULL,
  `tl` varchar(255) DEFAULT NULL,
  `t1` varchar(100) DEFAULT NULL,
  `t2` varchar(100) DEFAULT NULL,
  `FHD` date DEFAULT NULL,
  `days` int DEFAULT NULL,
  `phone_number` varchar(50) DEFAULT NULL,
  `email_id` varchar(255) DEFAULT NULL,
  `payment_status` varchar(100) DEFAULT NULL,
  `amount` decimal(12,2) DEFAULT NULL,
  `bella_vita_order_id` varchar(100) DEFAULT NULL,
  `campaign` varchar(255) DEFAULT NULL,
  `calling_status` varchar(255) DEFAULT NULL,
  `discount_code` varchar(255) DEFAULT NULL,
  `sale_count` int DEFAULT NULL,
  `current_status` varchar(255) DEFAULT NULL,
  `final_status` varchar(255) DEFAULT NULL,
  `Order_DateTime` datetime DEFAULT NULL,
  `state` varchar(255) DEFAULT NULL,
  `line_item_name` text,
  `pincode` varchar(50) DEFAULT NULL,
  `Order Date` date DEFAULT NULL,
  `hrs_24_48` varchar(100) DEFAULT NULL,
  `crazy_deal` varchar(255) DEFAULT NULL,
  `perfume` varchar(255) DEFAULT NULL,
  `size` varchar(100) DEFAULT NULL,
  `order_pickup_datetime` datetime DEFAULT NULL,
  `rto_initiated_datetime` datetime DEFAULT NULL,
  `diff_hour` int DEFAULT NULL,
  `lob` varchar(255) DEFAULT NULL,
  `pincode_relevent` varchar(255) DEFAULT NULL,
  `rto_status` varchar(255) DEFAULT NULL,
  `draft_order` varchar(255) DEFAULT NULL,
  `time_1608` varchar(100) DEFAULT NULL,
  `sale_source_name` varchar(255) DEFAULT NULL,
  `shift` varchar(100) DEFAULT NULL,
  `uploaded_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `uploaded_by` int DEFAULT NULL,
  `upload_batch_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_emp_id` (`emp_id`),
  KEY `idx_order_id` (`bella_vita_order_id`),
  KEY `idx_sale_date` (`Date`),
  KEY `idx_uploaded_at` (`uploaded_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Parsing: header-name based**, same mechanism as GNC Sale (row 1 = headers, lowercase+trim, map by
header text). Confirmed against the real Bellavita `Sale` sheet — header row is exactly:
```
Week | Date | EMP ID | Emp_Name | TL | T1 | T2 | FHD | Days | Phone Number | E-mail ID |
Payment Status | Amount | Bella Vita Order ID | Campaign | Calling Status | Discount Code |
Count | Current Status | Final Status | Order Date&Time | State | Line Item Name | Pincode |
Order Date | 24Hrs&48hrs | Crazy Deal | Perfume | Size | Order Pickup Date | RTO Initiated Date |
Diff Hour | LOB | Pincode Relevent | RTO Status | Draft Order | Target | Sale Source Name | Shift
```
Header → field mapping (37 fields → matching DDL columns above 1:1 by name, e.g. `"emp id"`/`"emp_id"`
→ `emp_id`, `"e-mail id"`/`"email id"`/`"email_id"` → `email_id`, `"bella vita order id"`/
`"bella_vita_order_id"` → `bella_vita_order_id`, `"24hrs&48hrs"`/`"hrs 24-48"`/`"24hrs_48hrs"` →
`hrs_24_48`, `"16:08"`/`"time 1608"` → `time_1608`, etc. — accept both the literal header text and
a space→underscore/lowercased variant for every field, same pattern as GNC).

### 2.2 `bb_apr` — table

```sql
CREATE TABLE `bb_apr` (
  `id` int NOT NULL AUTO_INCREMENT,
  `unique_id` varchar(200) DEFAULT NULL,
  `week` varchar(10) DEFAULT NULL,
  `report_date` date DEFAULT NULL,
  `emp_name` varchar(255) DEFAULT NULL,
  `noiid` varchar(50) DEFAULT NULL,
  `num_calls_chat` int DEFAULT NULL,
  `lob` varchar(255) DEFAULT NULL,
  `login_time` varchar(50) DEFAULT NULL,
  `wait_time` varchar(50) DEFAULT NULL,
  `talk_time` varchar(50) DEFAULT NULL,
  `dispo_time` varchar(50) DEFAULT NULL,
  `pause_time` varchar(50) DEFAULT NULL,
  `acht` int DEFAULT NULL,
  `lunch` varchar(50) DEFAULT NULL,
  `tea` varchar(50) DEFAULT NULL,
  `tea1` varchar(50) DEFAULT NULL,
  `washr` varchar(50) DEFAULT NULL,
  `team_briefing_aux` varchar(50) DEFAULT NULL,
  `net_pause` varchar(50) DEFAULT NULL,
  `avg_dispo` varchar(50) DEFAULT NULL,
  `total_break` varchar(50) DEFAULT NULL,
  `actual_login_hrs` varchar(50) DEFAULT NULL,
  `downtime` varchar(50) DEFAULT NULL,
  `login_duration` varchar(50) DEFAULT NULL,
  `logout_time` varchar(50) DEFAULT NULL,
  `net_login_hrs` varchar(50) DEFAULT NULL,
  `utilization` varchar(50) DEFAULT NULL,
  `attendance_1` varchar(50) DEFAULT NULL,
  `week_1` varchar(50) DEFAULT NULL,
  `mtd` varchar(50) DEFAULT NULL,
  `team_leader` varchar(255) DEFAULT NULL,
  `fhd` varchar(50) DEFAULT NULL,
  `tenure` int DEFAULT NULL,
  `tenurity_week` varchar(50) DEFAULT NULL,
  `sub_lob` varchar(255) DEFAULT NULL,
  `unique_count` int DEFAULT NULL,
  `attendance_2` varchar(50) DEFAULT NULL,
  `capping` varchar(50) DEFAULT NULL,
  `attendance_3` varchar(50) DEFAULT NULL,
  `uploaded_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `uploaded_by` int DEFAULT NULL,
  `upload_batch_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_report_date` (`report_date`),
  KEY `idx_emp_name` (`emp_name`),
  KEY `idx_noiid` (`noiid`),
  KEY `idx_uploaded_at` (`uploaded_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Parsing: positional (41 columns, 0-indexed)**, header row located by scanning for a cell that is
exactly `"UID"` (this sheet has duplicate "Attendance" columns, so positional-by-index is required,
same reasoning as GNC's Allocation/APR sheets). Column order (0→40):
```
0  uid → unique_id        14 attendance_2 (from source) → attendance2
1  week → week            ...
2  saleDate → report_date  the code field names are: uid, week, saleDate, did, campaign, tl, empId,
3  did (unused/DDL n/a)    empName, loginTime, totalDuration, totalCallTime, totalPause,
4  campaign (unused)       totalIdleTime, totalBreakTime, routingTime, afterCallWork,
...                        loginDuration, utilization, totalBreaks, billable, lunchDuration,
                           meetingDuration, trainingDuration, totalACW, totalHoldTime,
                           totalMuteDuration, totalConferenceTime, totalConsultTime,
                           avgSpeedOfAnswer, auxTime, totalOnlineTime, mtd, teamLeader, fhd,
                           tenure, tenurityWeek, subLob, uniqueCount, attendance2, capping,
                           attendance3  (41 fields, indices 0-40 in that order)
```
Re-verify this list against the real `APR-Utilization Raw`/APR export sheet before building — this
is the most complex positional mapping of the three processes; treat the `bb_apr` DDL column list
as the authoritative target shape, and the index order above as a strong starting point to confirm
against the actual file.

### 2.3 `bb_chat` — table

```sql
CREATE TABLE `bb_chat` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ticket_id` varchar(100) DEFAULT NULL,
  `inbox_id` varchar(100) DEFAULT NULL,
  `inbox_name` varchar(255) DEFAULT NULL,
  `ticket_status` varchar(255) DEFAULT NULL,
  `agent_name` varchar(255) DEFAULT NULL,
  `email_1` varchar(255) DEFAULT NULL,
  `phone_number` varchar(50) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `assigned_at` datetime DEFAULT NULL,
  `agent_frt_at` datetime DEFAULT NULL,
  `frt_1` varchar(50) DEFAULT NULL,
  `resolution_time_at` datetime DEFAULT NULL,
  `resolution_time` varchar(50) DEFAULT NULL,
  `average_wait_time` varchar(50) DEFAULT NULL,
  `is_resolved` varchar(50) DEFAULT NULL,
  `is_outside_working_hrs` varchar(50) DEFAULT NULL,
  `level1_tags` text,
  `level2_tags` text,
  `level3_tags` text,
  `system_tags` text,
  `chat_link` text,
  `repeat_status` varchar(255) DEFAULT NULL,
  `repeat_status_on_assign` varchar(255) DEFAULT NULL,
  `time_1406` varchar(50) DEFAULT NULL,
  `resolution_time_min` varchar(50) DEFAULT NULL,
  `frt_tat` varchar(50) DEFAULT NULL,
  `resolution_tat` varchar(50) DEFAULT NULL,
  `phone_number1` varchar(50) DEFAULT NULL,
  `current_agent` varchar(255) DEFAULT NULL,
  `email_2` varchar(255) DEFAULT NULL,
  `chat_date` date DEFAULT NULL,
  `emp_id` varchar(50) DEFAULT NULL,
  `lob` varchar(255) DEFAULT NULL,
  `week` varchar(10) DEFAULT NULL,
  `count_1` decimal(10,2) DEFAULT NULL,
  `time_slot` varchar(50) DEFAULT NULL,
  `hour` int DEFAULT NULL,
  `tl_name` varchar(255) DEFAULT NULL,
  `disposition` varchar(255) DEFAULT NULL,
  `day_shift_night_shift` varchar(50) DEFAULT NULL,
  `unique_id` varchar(200) DEFAULT NULL,
  `froud` varchar(50) DEFAULT NULL,
  `frt_2` varchar(50) DEFAULT NULL,
  `user_type` varchar(255) DEFAULT NULL,
  `uploaded_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `uploaded_by` int DEFAULT NULL,
  `upload_batch_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_chat_date` (`chat_date`),
  KEY `idx_emp_id` (`emp_id`),
  KEY `idx_agent_name` (`agent_name`),
  KEY `idx_uploaded_at` (`uploaded_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Parsing: positional (44 columns, 0-indexed)**, header row located by scanning for a cell that is
exactly `"TICKET ID"` (duplicate Email/FRT columns force positional parsing here too). Confirmed
column order:
```
0 ticketId          11 resolutionTimeAt   22 repeatStatusOnAssign  33 week
1 inboxId           12 resolutionTime     23 time1406             34 count1 (decimal)
2 inboxName         13 averageWaitTime    24 resolutionTimeMin    35 timeSlot
3 ticketStatus       14 isResolved        25 frtTat               36 hour (int)
4 agentName          15 isOutsideWorkingHrs 26 resolutionTat      37 tlName
5 email1            16 level1Tags         27 phoneNumber1         38 disposition
6 phoneNumber        17 level2Tags        28 currentAgent         39 dayShiftNightShift
7 createdAt          18 level3Tags        29 email2               40 uniqueId
8 assignedAt         19 systemTags        30 chatDate             41 froud
9 agentFrtAt         20 chatLink          31 empId                42 frt2
10 frt1              21 repeatStatus      32 lob                  43 userType
```

### 2.4 `bb_cart`, `bvo_order_export`, `bvo_Repeat_cdr`, `bvo_repeat_allocation` — tables

```sql
CREATE TABLE `bb_cart` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cc` varchar(50) DEFAULT NULL,
  `source` varchar(255) DEFAULT NULL,
  `sno` int DEFAULT NULL,
  `cart_id` varchar(50) DEFAULT NULL,
  `created_at` varchar(50) DEFAULT NULL,
  `updated_at` varchar(50) DEFAULT NULL,
  `customer_name` varchar(255) DEFAULT NULL,
  `customer_address` text,
  `phone_number` varchar(50) DEFAULT NULL,
  `email_id` varchar(255) DEFAULT NULL,
  `line_items` text,
  `variant_title` text,
  `abandoned_cart_link` text,
  `amount` decimal(12,2) DEFAULT NULL,
  `phone_10_digit` varchar(20) DEFAULT NULL,
  `dates` varchar(50) DEFAULT NULL,
  `agent` varchar(100) DEFAULT NULL,
  `disposition` varchar(255) DEFAULT NULL,
  `sub_disposition` varchar(255) DEFAULT NULL,
  `call_date` varchar(50) DEFAULT NULL,
  `same_day_connect` varchar(50) DEFAULT NULL,
  `status` varchar(100) DEFAULT NULL,
  `uploaded_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `uploaded_by` int DEFAULT NULL,
  `upload_batch_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_upload_batch_id` (`upload_batch_id`),
  KEY `idx_uploaded_at` (`uploaded_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `bvo_order_export` (
  `id` int NOT NULL AUTO_INCREMENT,
  `shipping_phone` varchar(50) DEFAULT NULL,
  `name` varchar(100) DEFAULT NULL,
  `shipping_phone_2` varchar(50) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `financial_status` varchar(50) DEFAULT NULL,
  `total` decimal(12,2) DEFAULT NULL,
  `name_2` varchar(100) DEFAULT NULL,
  `discount_code` varchar(100) DEFAULT NULL,
  `created_at_raw` varchar(50) DEFAULT NULL,
  `lineitem_name` text,
  `shipping_name` varchar(255) DEFAULT NULL,
  `shipping_zip` varchar(20) DEFAULT NULL,
  `tags` text,
  `shipping_city` varchar(255) DEFAULT NULL,
  `shipping_province_name` varchar(255) DEFAULT NULL,
  `order_date` varchar(20) DEFAULT NULL,
  `uploaded_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `uploaded_by` int DEFAULT NULL,
  `upload_batch_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_upload_batch_id` (`upload_batch_id`),
  KEY `idx_uploaded_at` (`uploaded_at`),
  KEY `idx_shipping_phone` (`shipping_phone`),
  KEY `idx_name` (`name`),
  KEY `idx_order_date_phone2` (`order_date`,`shipping_phone_2`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `bvo_Repeat_cdr` (
  `id` int NOT NULL AUTO_INCREMENT,
  `PhoneNumber` varchar(15) DEFAULT NULL,
  `CallStatus` varchar(20) DEFAULT NULL,
  `Agent` varchar(20) DEFAULT NULL,
  `uploaded_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `uploaded_by` int DEFAULT NULL,
  `upload_batch_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_upload_batch_id` (`upload_batch_id`),
  KEY `idx_uploaded_at` (`uploaded_at`),
  KEY `idx_phone_number` (`PhoneNumber`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `bvo_repeat_allocation` (
  `id` int NOT NULL AUTO_INCREMENT,
  `unique_id` varchar(50) DEFAULT NULL,
  `mobile_no` varchar(20) DEFAULT NULL,
  `payment_mode` varchar(50) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `order_invoice_amount` decimal(12,2) DEFAULT NULL,
  `order_id` varchar(100) DEFAULT NULL,
  `product_name` text,
  `shipping_customer_name` varchar(255) DEFAULT NULL,
  `previous_order_creation_date` varchar(50) DEFAULT NULL,
  `uploaded_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `uploaded_by` int DEFAULT NULL,
  `upload_batch_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_upload_batch_id` (`upload_batch_id`),
  KEY `idx_mobile_no` (`mobile_no`),
  KEY `idx_uploaded_at` (`uploaded_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

`bb_cart` is parsed header-name based (header row located by scanning for a cell that is exactly
`"CC"`). `bvo_order_export`, `bvo_Repeat_cdr`, and `bvo_repeat_allocation` follow the same
upload/parse/batch-log pattern as every other table here — confirm the exact source export's header
row against a real file before finalizing the column map, same discipline as every table above (the
DDL column lists are the authoritative target shape regardless of the exact parsing strategy chosen).

---

## 3. Neemans — the complete reference (build this one most carefully; it's the template)

Four upload types (**Sale Raw**, **Allocation**, **Cart**, **APR**) plus two supporting tables
(**month targets**, **agent roster**) that power the dashboard's target/achievement and agent-detail
features. If your project's dashboard needs an Achievement % KPI or an agent-details tab, these two
extra tables are what make that possible — don't skip them just because they're not upload targets.

### 3.1 `neemans_sale_raw` — table

```sql
CREATE TABLE `neemans_sale_raw` (
  `id` int NOT NULL AUTO_INCREMENT,
  `week` varchar(20) DEFAULT NULL,
  `date` varchar(50) DEFAULT NULL,
  `emp_id` varchar(50) DEFAULT NULL,
  `name` varchar(200) DEFAULT NULL,
  `tl` varchar(200) DEFAULT NULL,
  `lob` varchar(100) DEFAULT NULL,
  `tenure` varchar(100) DEFAULT NULL,
  `order_id` varchar(100) DEFAULT NULL,
  `customer_number` varchar(30) DEFAULT NULL,
  `email_id` varchar(255) DEFAULT NULL,
  `payment_status` varchar(100) DEFAULT NULL,
  `amount` decimal(12,2) DEFAULT NULL,
  `discount_code` varchar(255) DEFAULT NULL,
  `line_item_name` text,
  `calling_lob` varchar(100) DEFAULT NULL,
  `calling_status` varchar(100) DEFAULT NULL,
  `status` varchar(100) DEFAULT NULL,
  `count` int DEFAULT NULL,
  `neemans_order_id` varchar(100) DEFAULT NULL,
  `current_status` varchar(255) DEFAULT NULL,
  `final_status` varchar(255) DEFAULT NULL,
  `line_item_qty` int DEFAULT NULL,
  `target` int DEFAULT NULL,
  `call_date_time` varchar(100) DEFAULT NULL,
  `duration` varchar(100) DEFAULT NULL,
  `created_at_raw` varchar(100) DEFAULT NULL,
  `uploaded_by` int DEFAULT NULL,
  `upload_batch_id` varchar(36) DEFAULT NULL,
  `inserted_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Parsing: positional (26 columns, 0-indexed)**, header row located by scanning for a cell matching
`/^(emp.?id|week)$/i`. Column order — **verified directly from the live source code**:
```
0 week    1 date    2 empId          3 name           4 tl            5 lob
6 tenure  7 orderId 8 customerNumber 9 emailId        10 paymentStatus 11 amount
12 discountCode  13 lineItemName  14 callingLob  15 callingStatus  16 status
17 count  18 neemansOrderId  19 currentStatus  20 finalStatus  21 lineItemQty
22 target  23 callDateTime  24 duration  25 createdAt
```
**Critical quirk to replicate deliberately, not by accident:** column 1 (`date`) is stored **as the
raw Excel serial number, with no date conversion at all** — the dashboard queries cast it to an
integer and convert back to a calendar date at query time. This is a real design choice in the
reference implementation, not a bug — but it only works because storage and query-time conversion
agree. If your process's dashboard needs day-wise bucketing, pick one approach (store converted, or
store raw + convert at query time) and apply it consistently, or the trend charts will silently
misalign.

### 3.2 `neemans_allocation` — table

```sql
CREATE TABLE `neemans_allocation` (
  `id` int NOT NULL AUTO_INCREMENT,
  `phone` varchar(30) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `customer_name` varchar(255) DEFAULT NULL,
  `product_title` text,
  `amount` decimal(12,2) DEFAULT NULL,
  `type` varchar(100) DEFAULT NULL,
  `date` varchar(50) DEFAULT NULL,
  `agent` varchar(200) DEFAULT NULL,
  `calling_status` varchar(100) DEFAULT NULL,
  `sub_scenario1` varchar(255) DEFAULT NULL,
  `sub_scenario2` varchar(255) DEFAULT NULL,
  `call_id` varchar(100) DEFAULT NULL,
  `uploaded_by` int DEFAULT NULL,
  `upload_batch_id` varchar(36) DEFAULT NULL,
  `inserted_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Parsing: header-name based (with alias fallbacks)** — normalize every header cell to
lowercase + `snake_case` (strip punctuation), find the header row by matching `phone`, `email`, or
`customername`/`customer name`, then resolve each field via a list of accepted aliases:
```
phone          ← phone | phone_number | mobile
email          ← email | email_id | emailid
customerName   ← customername | customer_name | name
productTitle   ← producttitle | product_title | line_items | lineitems | product | products
amount         ← amount | value | total | cart_value
type           ← type
date           ← date
agent          ← agent | agent_name | agentname
callingStatus  ← callingstatus | calling_status | status
subScenario1   ← subscenario1 | sub_scenario1 | subscenario_1 | scenario1
subScenario2   ← subscenario2 | sub_scenario2 | subscenario_2 | scenario2
callId         ← callid | call_id | id
```
This alias-list approach is the most robust of the three processes' strategies — prefer it over
strict positional parsing whenever the source sheet's headers are reasonably stable, because it
survives the source team reordering or renaming a column slightly.

### 3.3 `neemans_cart` — table

```sql
CREATE TABLE `neemans_cart` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sno` int DEFAULT NULL,
  `cart_id` varchar(100) DEFAULT NULL,
  `created_at` varchar(50) DEFAULT NULL,
  `updated_at` varchar(50) DEFAULT NULL,
  `customer_name` varchar(200) DEFAULT NULL,
  `phone_number` varchar(20) DEFAULT NULL,
  `email_id` varchar(200) DEFAULT NULL,
  `line_items` text,
  `amount` decimal(12,2) DEFAULT NULL,
  `agent` varchar(100) DEFAULT NULL,
  `disposition` varchar(100) DEFAULT NULL,
  `sub_disposition` varchar(100) DEFAULT NULL,
  `call_date` date DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `uploaded_by` int DEFAULT NULL,
  `upload_batch_id` varchar(36) DEFAULT NULL,
  `inserted_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Parsing: header-name based with alias fallbacks**, header row located by scanning for a cell
matching `/sno|cart.?id|customer/i`:
```
sno ← sno | s_no | serial            lineItems ← line_items | lineitems | items | products | product
cartId ← cart_id | cartid | id       amount ← amount | cart_value | value | total
createdAt ← created_at | created_date | createdat      agent ← agent | agent_name | agentname
updatedAt ← updated_at | updated_date | updatedat       disposition ← disposition | disp
customerName ← customer_name | customername | name      subDisposition ← sub_disposition | subdisposition | sub_disp
phoneNumber ← phone_number | phonenumber | phone | mobile   callDate ← call_date | calldate | date
emailId ← email_id | email | emailid                    status ← status
```

### 3.4 `neemans_apr` — table

```sql
CREATE TABLE `neemans_apr` (
  `id` int NOT NULL AUTO_INCREMENT,
  `unique_id` varchar(100) DEFAULT NULL,
  `week` varchar(100) DEFAULT NULL,
  `date` varchar(100) DEFAULT NULL,
  `emp_name` varchar(200) DEFAULT NULL,
  `emp_id` varchar(100) DEFAULT NULL,
  `calls` int DEFAULT '0',
  `uca_ob` int DEFAULT '0',
  `lob` varchar(200) DEFAULT NULL,
  `login_time` varchar(100) DEFAULT NULL,
  `parks` int DEFAULT '0',
  `park_time` varchar(100) DEFAULT NULL,
  `avg_park` varchar(100) DEFAULT NULL,
  `parks_per_call` decimal(8,2) DEFAULT NULL,
  `wait` varchar(100) DEFAULT NULL,
  `talk` varchar(100) DEFAULT NULL,
  `dispo` varchar(100) DEFAULT NULL,
  `pause` varchar(100) DEFAULT NULL,
  `login_ts` varchar(100) DEFAULT NULL,
  `logout_ts` varchar(100) DEFAULT NULL,
  `acht` int DEFAULT '0',
  `team_briefing` varchar(100) DEFAULT NULL,
  `lunch` varchar(100) DEFAULT NULL,
  `tea` varchar(100) DEFAULT NULL,
  `tea1` varchar(100) DEFAULT NULL,
  `washr` varchar(100) DEFAULT NULL,
  `total_break` varchar(100) DEFAULT NULL,
  `net_login` varchar(100) DEFAULT NULL,
  `occu_pct` decimal(6,2) DEFAULT NULL,
  `week_short` varchar(100) DEFAULT NULL,
  `mtd` varchar(100) DEFAULT NULL,
  `attendance` int DEFAULT '0',
  `capping` varchar(100) DEFAULT NULL,
  `uploaded_by` int DEFAULT NULL,
  `upload_batch_id` varchar(36) DEFAULT NULL,
  `inserted_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Parsing: strictly positional, 32 columns (0-indexed), no header search at all** — just skip row 0
and read every row after it by fixed column position:
```
0 uniqueId  1 week  2 date  3 empName  4 empId  5 calls  6 ucaOb  7 lob  8 loginTime
9 parks  10 parkTime  11 avgPark  12 parksPerCall  13 wait  14 talk  15 dispo  16 pause
17 loginTs  18 logoutTs  19 acht  20 teamBriefing  21 lunch  22 tea  23 tea1  24 washr
25 totalBreak  26 netLogin  27 occuPct  28 weekShort  29 mtd  30 attendance  31 capping
```
Two helper conversions are used on this sheet specifically:
- **Date column** (`date`): accepts either an Excel serial number *or* pre-formatted text
  (`1-Jul-26`, ISO `YYYY-MM-DD`) and normalizes to `DD-MMM-YYYY` before storing.
- **Time columns** (`login_time`, durations, etc. where applicable): Excel time-of-day fraction
  (0–1) converted to `H:MM:SS` text.

Build the equivalent of both conversion helpers — don't store raw Excel time fractions unconverted,
they're meaningless without the conversion.

### 3.5 `neemans_month_targets` — table (powers Achievement % KPI)

```sql
CREATE TABLE `neemans_month_targets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `month` varchar(7) NOT NULL,
  `target` decimal(15,2) NOT NULL DEFAULT '0.00',
  `created_by` int DEFAULT NULL,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `month` (`month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```
`month` is `'YYYY-MM'`. Not populated by file upload — has its own small admin-only CRUD:
`GET /sales/neemans-targets` (list) and `POST /sales/neemans-targets` (upsert one month, gated to
super-admin only). The dashboard's Achievement % KPI divides actual revenue by this target,
**prorated to elapsed days in the month** — don't divide by the full-month target for a
still-in-progress month, it makes early-month numbers look artificially bad.

### 3.6 `nms_Agent_Details` — table (agent roster, powers the Agent Details tab)

```sql
CREATE TABLE `nms_Agent_Details` (
  `id` int NOT NULL AUTO_INCREMENT,
  `emp_id` varchar(20) NOT NULL,
  `daildesk_id` varchar(100) DEFAULT NULL,
  `name` varchar(200) NOT NULL,
  `lob` varchar(100) DEFAULT NULL,
  `tl` varchar(200) DEFAULT NULL,
  `doj` date DEFAULT NULL,
  `fhd` date DEFAULT NULL,
  `status` varchar(20) DEFAULT 'Active',
  `dol` date DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `monthly_target` decimal(15,2) DEFAULT '0.00',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```
Full CRUD, not an upload target: `GET/POST /sales/nms-agent-details`,
`PUT/DELETE /sales/nms-agent-details/:id`. This is the roster the agent-wise leaderboard joins
against for name/LOB/team-lead display and per-agent target achievement — build this before the
agent-wise dashboard view, not after.

---

## 4. Build order

1. `upload_log` table + the shared upload endpoint plumbing (§0) — every process's uploader depends
   on this.
2. Pick **one** process to build fully end-to-end first (uploader → real file upload → dashboard),
   to validate the whole pipeline before repeating it three times. Neemans is the richest reference
   if your new process needs agent-level targets/roster; Bellavita is the fastest path to a working
   simple dashboard if it doesn't.
3. Repeat for the other processes, re-deriving each one's real column mapping from an actual recent
   export file per process (§0.2 and the per-table notes above) rather than assuming the layouts
   above are identical to what you'll see in this project's real files — treat everything above as
   "this is exactly what the source portal's files look like today", not as a universal Excel format.
4. Dashboards: build using the same visual/KPI pattern described in the companion prompt document
   `Sales_Uploader_And_Dashboard_Build_Prompt.md` (KPI strip, date-wise trend, agent leaderboard,
   weekly breakdown, utilization tab, target/roster management) — that document covers the dashboard
   side in depth; this one is the data-layer companion to it.
