import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { querySource } from '../../lib/sourceDb';
import { getMasmisPool, queryMasmis } from '../../lib/masmisDb';

// ─── One-time table init (called at server startup) ───────────────────────────

export async function initNeemansTables(): Promise<void> {
  const pool = getMasmisPool();
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS db_masmis.neemans_sale_raw (
        id INT AUTO_INCREMENT PRIMARY KEY,
        week VARCHAR(20), date VARCHAR(50), emp_id VARCHAR(50),
        name VARCHAR(200), tl VARCHAR(200), lob VARCHAR(100), tenure VARCHAR(100),
        order_id VARCHAR(100), customer_number VARCHAR(30), email_id VARCHAR(255),
        payment_status VARCHAR(100), amount DECIMAL(12,2), discount_code VARCHAR(255),
        line_item_name TEXT, calling_lob VARCHAR(100), calling_status VARCHAR(100),
        status VARCHAR(100), count INT, neemans_order_id VARCHAR(100),
        current_status VARCHAR(255), final_status VARCHAR(255),
        line_item_qty INT, target INT, call_date_time VARCHAR(100),
        duration VARCHAR(100), created_at_raw VARCHAR(100),
        uploaded_by INT, upload_batch_id VARCHAR(36),
        inserted_at DATETIME DEFAULT NOW()
      )
    `);
    // Widen columns that may already exist with a shorter length
    await pool.execute(`ALTER TABLE db_masmis.neemans_sale_raw MODIFY COLUMN duration VARCHAR(100)`);
    await pool.execute(`ALTER TABLE db_masmis.neemans_sale_raw MODIFY COLUMN call_date_time VARCHAR(100)`);
    await pool.execute(`ALTER TABLE db_masmis.neemans_sale_raw MODIFY COLUMN created_at_raw VARCHAR(100)`);
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS db_masmis.neemans_allocation (
        id INT AUTO_INCREMENT PRIMARY KEY,
        phone VARCHAR(30), email VARCHAR(255), customer_name VARCHAR(255),
        product_title TEXT, amount DECIMAL(12,2), type VARCHAR(100),
        date VARCHAR(50), agent VARCHAR(200), calling_status VARCHAR(100),
        sub_scenario1 VARCHAR(255), sub_scenario2 VARCHAR(255), call_id VARCHAR(100),
        uploaded_by INT, upload_batch_id VARCHAR(36),
        inserted_at DATETIME DEFAULT NOW()
      )
    `);
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS db_masmis.neemans_cart (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sno INT, cart_id VARCHAR(100), created_at VARCHAR(50), updated_at VARCHAR(50),
        customer_name VARCHAR(200), phone_number VARCHAR(20), email_id VARCHAR(200),
        line_items TEXT, amount DECIMAL(12,2), agent VARCHAR(100),
        disposition VARCHAR(100), sub_disposition VARCHAR(100), call_date DATE,
        status VARCHAR(50), uploaded_by INT, upload_batch_id VARCHAR(36),
        inserted_at DATETIME DEFAULT NOW()
      )
    `);
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS db_masmis.neemans_month_targets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        month VARCHAR(7) NOT NULL UNIQUE,
        target DECIMAL(15,2) NOT NULL DEFAULT 0,
        created_by INT,
        updated_at DATETIME DEFAULT NOW() ON UPDATE NOW()
      )
    `);
    // Seed existing Jun 2026 target if not already present
    await pool.execute(`
      INSERT IGNORE INTO db_masmis.neemans_month_targets (month, target) VALUES ('2026-06', 6774194)
    `);
  } catch (err) {
    console.error('[sales] initNeemansTables warning:', (err as Error).message);
  }
}

// ─── Neemans Target CRUD ──────────────────────────────────────────────────────

export async function getNeemansTarget(month: string): Promise<number> {
  const [rows] = await getMasmisPool().execute(
    'SELECT target FROM db_masmis.neemans_month_targets WHERE month = ?', [month],
  );
  const r = (rows as any[])[0];
  return r ? Number(r.target) : 0;
}

export async function getAllNeemansTargets(): Promise<{ month: string; target: number }[]> {
  const [rows] = await getMasmisPool().execute(
    'SELECT month, target FROM db_masmis.neemans_month_targets ORDER BY month DESC',
  );
  return (rows as any[]).map(r => ({ month: r.month, target: Number(r.target) }));
}

export async function upsertNeemansTarget(month: string, target: number, userId: number): Promise<void> {
  await getMasmisPool().execute(`
    INSERT INTO db_masmis.neemans_month_targets (month, target, created_by)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE target = VALUES(target), created_by = VALUES(created_by), updated_at = NOW()
  `, [month, target, userId]);
}

export interface SalesFilters {
  startDate: string;
  endDate: string;
  clientIds?: number[];
  lob?: string;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function clientClause(clientIds?: number[]): string {
  return clientIds?.length
    ? `AND ClientId IN (${clientIds.map(() => '?').join(',')})`
    : '';
}

function lobClause(lob?: string): string {
  return lob && lob !== 'All' ? 'AND TRIM(Field13) = ?' : '';
}

function lobParams(lob?: string): (string | number | null)[] {
  return lob && lob !== 'All' ? [lob] : [];
}

// Amount expression: strip commas, coerce to number
const AMOUNT_EXPR = `(0 + REPLACE(COALESCE(Field14,'0'),',',''))`;

// Sale detection
const SALE_WHERE = `LOWER(Category1) LIKE '%sale%'`;

// ─── KPIs ─────────────────────────────────────────────────────────────────────

export async function getSalesKPIs(filters: SalesFilters) {
  const { startDate, endDate, clientIds, lob } = filters;
  const cc = clientClause(clientIds);
  const lc = lobClause(lob);
  const params: (string | number | null)[] = [
    startDate, endDate,
    ...(clientIds || []),
    ...lobParams(lob),
  ];

  const [row] = await querySource<{
    total_calls: number;
    total_sales: number;
    total_revenue: number;
    avg_sale: number;
    cod_count: number;
    paid_count: number;
  }>(`
    SELECT
      COUNT(*)                                                                            AS total_calls,
      SUM(CASE WHEN ${SALE_WHERE} THEN 1 ELSE 0 END)                                    AS total_sales,
      ROUND(SUM(CASE WHEN ${SALE_WHERE} THEN ${AMOUNT_EXPR} ELSE 0 END), 2)             AS total_revenue,
      ROUND(AVG(CASE WHEN ${SALE_WHERE} THEN ${AMOUNT_EXPR} END), 2)                    AS avg_sale,
      SUM(CASE WHEN ${SALE_WHERE} AND LOWER(TRIM(COALESCE(Field26,''))) = 'cod'  THEN 1 ELSE 0 END) AS cod_count,
      SUM(CASE WHEN ${SALE_WHERE} AND LOWER(TRIM(COALESCE(Field26,''))) != 'cod'
               AND TRIM(COALESCE(Field26,'')) != ''                               THEN 1 ELSE 0 END) AS paid_count
    FROM dialer_db.data_master_in
    WHERE CallDate BETWEEN ? AND ?
      ${cc}
      ${lc}
  `, params);

  const total_calls   = Number(row?.total_calls)   || 0;
  const total_sales   = Number(row?.total_sales)   || 0;
  const total_revenue = Number(row?.total_revenue) || 0;
  const avg_sale      = Number(row?.avg_sale)      || 0;
  const cod_count     = Number(row?.cod_count)     || 0;
  const paid_count    = Number(row?.paid_count)    || 0;
  const conversion_rate = total_calls > 0 ? Math.round(total_sales / total_calls * 10000) / 100 : 0;
  const cod_pct  = total_sales > 0 ? Math.round(cod_count  / total_sales * 10000) / 100 : 0;
  const paid_pct = total_sales > 0 ? Math.round(paid_count / total_sales * 10000) / 100 : 0;

  return {
    total_calls,
    total_sales,
    total_revenue,
    avg_sale,
    conversion_rate,
    cod_count,
    paid_count,
    cod_pct,
    paid_pct,
  };
}

// ─── Sales Trend (by hour) ────────────────────────────────────────────────────

export async function getSalesTrend(filters: SalesFilters) {
  const { startDate, endDate, clientIds, lob } = filters;
  const cc = clientClause(clientIds);
  const lc = lobClause(lob);
  const params: (string | number | null)[] = [
    startDate, endDate,
    ...(clientIds || []),
    ...lobParams(lob),
  ];

  const rows = await querySource<{ hour: number; calls: number; sales: number; revenue: number }>(`
    SELECT
      HOUR(CallDate)                                                                       AS hour,
      COUNT(*)                                                                             AS calls,
      SUM(CASE WHEN ${SALE_WHERE} THEN 1 ELSE 0 END)                                      AS sales,
      ROUND(SUM(CASE WHEN ${SALE_WHERE} THEN ${AMOUNT_EXPR} ELSE 0 END), 2)               AS revenue
    FROM dialer_db.data_master_in
    WHERE CallDate BETWEEN ? AND ?
      ${cc}
      ${lc}
    GROUP BY HOUR(CallDate)
    ORDER BY hour ASC
  `, params);

  return rows.map(r => ({
    hour:    Number(r.hour),
    calls:   Number(r.calls)   || 0,
    sales:   Number(r.sales)   || 0,
    revenue: Number(r.revenue) || 0,
  }));
}

// ─── Sales by LOB ─────────────────────────────────────────────────────────────

export async function getSalesByLob(filters: SalesFilters) {
  const { startDate, endDate, clientIds } = filters;
  const cc = clientClause(clientIds);
  const params: (string | number | null)[] = [startDate, endDate, ...(clientIds || [])];

  const rows = await querySource<{ lob: string; calls: number; sales: number; revenue: number }>(`
    SELECT
      TRIM(COALESCE(Field13,''))                                                           AS lob,
      COUNT(*)                                                                             AS calls,
      SUM(CASE WHEN ${SALE_WHERE} THEN 1 ELSE 0 END)                                      AS sales,
      ROUND(SUM(CASE WHEN ${SALE_WHERE} THEN ${AMOUNT_EXPR} ELSE 0 END), 2)               AS revenue
    FROM dialer_db.data_master_in
    WHERE CallDate BETWEEN ? AND ?
      ${cc}
      AND TRIM(COALESCE(Field13,'')) != ''
    GROUP BY TRIM(COALESCE(Field13,''))
    ORDER BY sales DESC
  `, params);

  return rows.map(r => ({
    lob:        String(r.lob),
    calls:      Number(r.calls)   || 0,
    sales:      Number(r.sales)   || 0,
    revenue:    Number(r.revenue) || 0,
    conversion: Number(r.calls) > 0
      ? Math.round(Number(r.sales) / Number(r.calls) * 10000) / 100
      : 0,
  }));
}

// ─── Payment Breakdown ────────────────────────────────────────────────────────

export async function getPaymentBreakdown(filters: SalesFilters) {
  const { startDate, endDate, clientIds, lob } = filters;
  const cc = clientClause(clientIds);
  const lc = lobClause(lob);
  const params: (string | number | null)[] = [
    startDate, endDate,
    ...(clientIds || []),
    ...lobParams(lob),
  ];

  const rows = await querySource<{ mode: string; count: number; revenue: number }>(`
    SELECT
      TRIM(Field26)                                        AS mode,
      COUNT(*)                                             AS count,
      ROUND(SUM(${AMOUNT_EXPR}), 2)                       AS revenue
    FROM dialer_db.data_master_in
    WHERE CallDate BETWEEN ? AND ?
      AND ${SALE_WHERE}
      AND TRIM(COALESCE(Field26,'')) != ''
      ${cc}
      ${lc}
    GROUP BY TRIM(Field26)
    ORDER BY count DESC
  `, params);

  return rows.map(r => ({
    mode:    String(r.mode),
    count:   Number(r.count)   || 0,
    revenue: Number(r.revenue) || 0,
  }));
}

// ─── Top Products ─────────────────────────────────────────────────────────────

export async function getTopProducts(filters: SalesFilters, limit = 12) {
  const { startDate, endDate, clientIds, lob } = filters;
  const cc = clientClause(clientIds);
  const lc = lobClause(lob);
  const params: (string | number | null)[] = [
    startDate, endDate,
    ...(clientIds || []),
    ...lobParams(lob),
  ];

  const rows = await querySource<{ product: string; sales: number; revenue: number; avg_value: number }>(`
    SELECT
      TRIM(Field19)                                        AS product,
      COUNT(*)                                             AS sales,
      ROUND(SUM(${AMOUNT_EXPR}), 2)                       AS revenue,
      ROUND(AVG(${AMOUNT_EXPR}), 2)                       AS avg_value
    FROM dialer_db.data_master_in
    WHERE CallDate BETWEEN ? AND ?
      AND ${SALE_WHERE}
      AND TRIM(COALESCE(Field19,'')) != ''
      ${cc}
      ${lc}
    GROUP BY TRIM(Field19)
    ORDER BY sales DESC
    LIMIT ${limit}
  `, params);

  return rows.map(r => ({
    product:   String(r.product),
    sales:     Number(r.sales)     || 0,
    revenue:   Number(r.revenue)   || 0,
    avg_value: Number(r.avg_value) || 0,
  }));
}

// ─── Agent Leaderboard ────────────────────────────────────────────────────────

export async function getAgentLeaderboard(filters: SalesFilters) {
  const { startDate, endDate, clientIds, lob } = filters;
  const cc = clientClause(clientIds);
  const lc = lobClause(lob);
  const params: (string | number | null)[] = [
    startDate, endDate,
    ...(clientIds || []),
    ...lobParams(lob),
  ];

  const rows = await querySource<{
    masid: string;
    agent_id: string;
    total_calls: number;
    sales: number;
    revenue: number;
  }>(`
    SELECT
      RIGHT(callcreated, 8)                                                                AS masid,
      callcreated                                                                          AS agent_id,
      COUNT(*)                                                                             AS total_calls,
      SUM(CASE WHEN ${SALE_WHERE} THEN 1 ELSE 0 END)                                      AS sales,
      ROUND(SUM(CASE WHEN ${SALE_WHERE} THEN ${AMOUNT_EXPR} ELSE 0 END), 2)               AS revenue
    FROM dialer_db.data_master_in
    WHERE CallDate BETWEEN ? AND ?
      ${cc}
      ${lc}
    GROUP BY callcreated
    HAVING total_calls >= 1
    ORDER BY sales DESC
    LIMIT 25
  `, params);

  return rows.map(r => ({
    masid:       String(r.masid),
    agent_id:    String(r.agent_id),
    total_calls: Number(r.total_calls) || 0,
    sales:       Number(r.sales)       || 0,
    revenue:     Number(r.revenue)     || 0,
    conversion:  Number(r.total_calls) > 0
      ? Math.round(Number(r.sales) / Number(r.total_calls) * 10000) / 100
      : 0,
  }));
}

// ─── Sub Scenarios ────────────────────────────────────────────────────────────

export async function getSubScenarios(filters: SalesFilters) {
  const { startDate, endDate, clientIds, lob } = filters;
  const cc = clientClause(clientIds);
  const lc = lobClause(lob);
  const params: (string | number | null)[] = [
    startDate, endDate,
    ...(clientIds || []),
    ...lobParams(lob),
  ];

  const rows = await querySource<{ scenario: string; count: number; revenue: number }>(`
    SELECT
      TRIM(Category2)                                      AS scenario,
      COUNT(*)                                             AS count,
      ROUND(SUM(${AMOUNT_EXPR}), 2)                       AS revenue
    FROM dialer_db.data_master_in
    WHERE CallDate BETWEEN ? AND ?
      AND ${SALE_WHERE}
      AND TRIM(COALESCE(Category2,'')) != ''
      ${cc}
      ${lc}
    GROUP BY TRIM(Category2)
    ORDER BY count DESC
    LIMIT 10
  `, params);

  return rows.map(r => ({
    scenario: String(r.scenario),
    count:    Number(r.count)   || 0,
    revenue:  Number(r.revenue) || 0,
  }));
}

// ─── LOB List ─────────────────────────────────────────────────────────────────

export async function getSalesLobList(filters: SalesFilters): Promise<string[]> {
  const { startDate, endDate, clientIds } = filters;
  const cc = clientClause(clientIds);
  const params: (string | number | null)[] = [startDate, endDate, ...(clientIds || [])];

  const rows = await querySource<{ lob: string }>(`
    SELECT DISTINCT TRIM(Field13) AS lob
    FROM dialer_db.data_master_in
    WHERE CallDate BETWEEN ? AND ?
      AND TRIM(COALESCE(Field13,'')) != ''
      ${cc}
    ORDER BY lob ASC
  `, params);

  return rows.map(r => String(r.lob)).filter(Boolean);
}

// ─── Export ───────────────────────────────────────────────────────────────────

export async function getSalesExport(filters: SalesFilters, limit = 10000) {
  const { startDate, endDate, clientIds, lob } = filters;
  const cc = clientClause(clientIds);
  const lc = lobClause(lob);
  const params: (string | number | null)[] = [
    startDate, endDate,
    ...(clientIds || []),
    ...lobParams(lob),
  ];

  return querySource<Record<string, unknown>>(`
    SELECT
      MSISDN,
      Category1,
      Category2,
      Field1,
      Field9,
      Field10,
      Field13,
      Field14,
      Field19,
      Field20,
      Field26,
      Field27,
      CallDate,
      callcreated,
      RIGHT(callcreated, 8) AS masid
    FROM dialer_db.data_master_in
    WHERE CallDate BETWEEN ? AND ?
      AND ${SALE_WHERE}
      ${cc}
      ${lc}
    ORDER BY CallDate DESC
    LIMIT ${limit}
  `, params);
}

// ═══════════════════════════════════════════════════════════════════════════════
// UPLOAD FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface BellavitaRow {
  week: string; saleDate: string; empId: string; empName: string;
  tl: string; t1: string; t2: string; fhd: string; days: number;
  phoneNumber: string; emailId: string; paymentStatus: string; amount: number;
  orderId: string; campaign: string; callingStatus: string; discountCode: string;
  count: number; currentStatus: string; finalStatus: string; orderDatetime: string;
  state: string; lineItemName: string; pincode: string; orderDate: string;
  hrs24_48: string; crazyDeal: string; perfume: string; size: string;
  orderPickupDatetime: string; rtoInitiatedDatetime: string; diffHour: number;
  lob: string; pincodeRelevent: string; rtoStatus: string; draftOrder: string;
  time1608: string; saleSourceName: string; shift: string;
}

export async function uploadBellavitaSales(rows: BellavitaRow[], uploadedBy: number, batchId: string): Promise<number> {
  const sql = `INSERT INTO db_masmis.bb_sale (
    week, \`Date\`, emp_id, emp_name, tl, t1, t2, FHD, days,
    phone_number, email_id, payment_status, amount, bella_vita_order_id,
    campaign, calling_status, discount_code, sale_count,
    current_status, final_status, Order_DateTime, state, line_item_name,
    pincode, \`Order Date\`, hrs_24_48, crazy_deal, perfume, size,
    order_pickup_datetime, rto_initiated_datetime, diff_hour,
    lob, pincode_relevent, rto_status, draft_order, time_1608,
    sale_source_name, shift, uploaded_by, upload_batch_id
  ) VALUES ?`;
  const values = rows.map(r => [
    r.week, parseBellavitaDate(r.saleDate), r.empId, r.empName, r.tl,
    parseBellavitaDate(r.t1), parseBellavitaDate(r.t2), parseBellavitaDate(r.fhd), r.days || null,
    r.phoneNumber, r.emailId, r.paymentStatus, r.amount || null, r.orderId,
    r.campaign, r.callingStatus, r.discountCode, r.count || null,
    r.currentStatus, r.finalStatus, parseBellavitaDate(r.orderDatetime) || parseBellavitaDate(r.orderDate),
    r.state, r.lineItemName, r.pincode, parseBellavitaDate(r.orderDate),
    r.hrs24_48, r.crazyDeal, r.perfume, r.size,
    parseBellavitaDate(r.orderPickupDatetime), parseBellavitaDate(r.rtoInitiatedDatetime), r.diffHour || null,
    r.lob, r.pincodeRelevent, r.rtoStatus, r.draftOrder, r.time1608,
    r.saleSourceName, r.shift, uploadedBy, batchId,
  ]);
  const [result] = await getMasmisPool().query(sql, [values]);
  return (result as mysql.ResultSetHeader).affectedRows;
}

// ─── GNC Sale Upload ───────────────────────────────────────────────────────────

export interface GncRow {
  week: string; saleDate: string; empId: string; empName: string; tl: string;
  t1: string; t3: string; customerNumber: string; emailId: string;
  paymentStatus: string; grossAmount: number; sumBeforeGst: number;
  orderId: string; campaign: string; discountCode: string; count: number;
  status: string; lineItemName: string; saleLob: string; target: number;
  saleSource: string;
}

export async function uploadGncSales(rows: GncRow[], uploadedBy: number, batchId: string): Promise<number> {
  const sql = `INSERT INTO db_masmis.gnc_sale (
    week, \`Date\`, emp_id, emp_name, tl, t1, t3, customer_number,
    email_id, payment_status, gross_amount, sum_before_gst,
    gnc_order_id, campaign, discount_code, sale_count, status,
    line_item_name, sale_lob, target, sale_source, uploaded_by, upload_batch_id
  ) VALUES ?`;
  const values = rows.map(r => [
    r.week, parseBellavitaDate(r.saleDate), r.empId, r.empName, r.tl,
    parseBellavitaDate(r.t1), r.t3, r.customerNumber === '-' ? '' : r.customerNumber,
    r.emailId === '-' ? '' : r.emailId, r.paymentStatus, r.grossAmount || null,
    r.sumBeforeGst || null, r.orderId, r.campaign, r.discountCode === '-' ? '' : r.discountCode,
    r.count || null, r.status, r.lineItemName === '-' ? '' : r.lineItemName,
    r.saleLob, r.target || null, r.saleSource, uploadedBy, batchId,
  ]);
  const [result] = await getMasmisPool().query(sql, [values]);
  return (result as mysql.ResultSetHeader).affectedRows;
}

// ─── GNC APR Upload ────────────────────────────────────────────────────────────

export interface GncAprRow {
  uid: string; reportDate: string; userName: string; empId: string; tlName: string;
  calls: number; processType: string; loginTime: string; waitTime: string;
  talkTime: string; dispoTime: string; pauseTime: string; loginDuration: string;
  logoutTime: string; acht: number; aoc: string; bio: string; bre: string;
  briefing: string; downTime: string; lunch: string; meet: string; qa: string;
  sb: string; teaBreak: string; trainingBreak: string; wash: string;
  netLogin: string; breakTime: string; traQa: string; downtime: string;
  atten: number; capping: string;
}

export async function uploadGncApr(rows: GncAprRow[], uploadedBy: number, batchId: string): Promise<number> {
  const sql = `INSERT INTO db_masmis.gnc_apr (
    uid, report_date, user_name, emp_id, tl_name, calls, process_type,
    login_time, wait_time, talk_time, dispo_time, pause_time,
    login_duration, logout_time, acht, aoc, bio, bre, briefing,
    down_time, lunch, meet, qa, sb, tea_break, training_break, wash,
    net_login, break_time, tra_qa, downtime, atten, capping, uploaded_by, upload_batch_id
  ) VALUES ?`;
  const values = rows.map(r => [
    r.uid, parseBellavitaDate(r.reportDate), r.userName, r.empId, r.tlName,
    r.calls || null, r.processType, r.loginTime, r.waitTime, r.talkTime,
    r.dispoTime, r.pauseTime, r.loginDuration, r.logoutTime, r.acht || null,
    r.aoc, r.bio, r.bre, r.briefing, r.downTime, r.lunch, r.meet, r.qa,
    r.sb, r.teaBreak, r.trainingBreak, r.wash, r.netLogin, r.breakTime,
    r.traQa, r.downtime, r.atten || null, r.capping, uploadedBy, batchId,
  ]);
  const [result] = await getMasmisPool().query(sql, [values]);
  return (result as mysql.ResultSetHeader).affectedRows;
}

// ─── GNC Allocation Upload ─────────────────────────────────────────────────────

export interface GncAllocationRow {
  uid: string; allocDate: string; helper: string; dateType: string;
  timeSlot: string; store: string; customerName: string; email: string;
  total: number; createdAt: string; lineitemName: string; lineitemSku: string;
  shippingName: string; shippingStreet: string; shippingCity: string;
  shippingZip: string; shippingPhone: string; empId: string;
  callingStatus: string; subScenarios1: string; callbackDate: string;
  sameDayConnect: string; ncConnect: string;
}

export async function uploadGncAllocation(rows: GncAllocationRow[], uploadedBy: number, batchId: string): Promise<number> {
  const sql = `INSERT INTO db_masmis.gnc_allocation (
    uid, alloc_date, helper, date_type, time_slot, store, customer_name,
    email, total, created_at, lineitem_name, lineitem_sku, shipping_name,
    shipping_street, shipping_city, shipping_zip, shipping_phone, emp_id,
    calling_status, sub_scenarios1, callback_date, same_day_connect,
    nc_connect, uploaded_by, upload_batch_id
  ) VALUES ?`;
  const values = rows.map(r => [
    r.uid, parseBellavitaDate(r.allocDate), r.helper, r.dateType, r.timeSlot,
    r.store, r.customerName, r.email, r.total || null,
    parseAllocationCreatedAt(r.createdAt), r.lineitemName, r.lineitemSku,
    r.shippingName, r.shippingStreet, r.shippingCity, r.shippingZip,
    r.shippingPhone, r.empId, r.callingStatus, r.subScenarios1,
    r.callbackDate, r.sameDayConnect, r.ncConnect, uploadedBy, batchId,
  ]);
  const [result] = await getMasmisPool().query(sql, [values]);
  return (result as mysql.ResultSetHeader).affectedRows;
}

// ─── Bellavita APR Upload ──────────────────────────────────────────────────────

export interface BellavitaAprRow {
  uid: string; week: string; saleDate: string; did: string; campaign: string;
  tl: string; empId: string; empName: string; loginTime: string;
  totalDuration: string; totalCallTime: string; totalPause: string;
  totalIdleTime: string; totalBreakTime: string; routingTime: string;
  afterCallWork: string; loginDuration: string; utilization: string;
  totalBreaks: string; billable: string; lunchDuration: string;
  meetingDuration: string; trainingDuration: string;
  totalACW: string; totalHoldTime: string; totalMuteDuration: string;
  totalConferenceTime: string; totalConsultTime: string;
  avgSpeedOfAnswer: string; auxTime: string; totalOnlineTime: string;
  mtd: string; teamLeader: string; fhd: string; tenure: number;
  tenurityWeek: string; subLob: string; uniqueCount: number;
  attendance2: string; capping: string; attendance3: string;
}

export async function uploadBellavitaApr(rows: BellavitaAprRow[], uploadedBy: number, batchId: string): Promise<number> {
  const sql = `INSERT INTO db_masmis.bb_apr (
    uid, week, sale_date, did, campaign, tl, emp_id, emp_name,
    login_time, total_duration, total_call_time, total_pause,
    total_idle_time, total_break_time, routing_time, after_call_work,
    login_duration, utilization, total_breaks, billable, lunch_duration,
    meeting_duration, training_duration, total_acw, total_hold_time,
    total_mute_duration, total_conference_time, total_consult_time,
    avg_speed_of_answer, aux_time, total_online_time, mtd, team_leader,
    fhd_s, tenure, tenurity_week, sub_lob, unique_count, attendance2,
    capping_s, attendance3, uploaded_by, upload_batch_id
  ) VALUES ?`;
  const values = rows.map(r => [
    r.uid, r.week, parseBellavitaDate(r.saleDate), r.did, r.campaign,
    r.tl, r.empId, r.empName, r.loginTime, r.totalDuration, r.totalCallTime,
    r.totalPause, r.totalIdleTime, r.totalBreakTime, r.routingTime,
    r.afterCallWork, r.loginDuration, r.utilization, r.totalBreaks,
    r.billable, r.lunchDuration, r.meetingDuration, r.trainingDuration,
    r.totalACW, r.totalHoldTime, r.totalMuteDuration, r.totalConferenceTime,
    r.totalConsultTime, r.avgSpeedOfAnswer, r.auxTime, r.totalOnlineTime,
    r.mtd, r.teamLeader, parseBellavitaDate(r.fhd), r.tenure || null,
    r.tenurityWeek, r.subLob, r.uniqueCount || null, r.attendance2,
    r.capping, r.attendance3, uploadedBy, batchId,
  ]);
  const [result] = await getMasmisPool().query(sql, [values]);
  return (result as mysql.ResultSetHeader).affectedRows;
}

// ─── Bellavita Chat Upload ─────────────────────────────────────────────────────

export interface BellavitaChatRow {
  ticketId: string; inboxId: string; inboxName: string; ticketStatus: string;
  agentName: string; email1: string; phoneNumber: string; createdAt: string;
  assignedAt: string; agentFrtAt: string; frt1: string;
  resolutionTimeAt: string; resolutionTime: string; averageWaitTime: string;
  isResolved: string; isOutsideWorkingHrs: string; level1Tags: string;
  level2Tags: string; level3Tags: string; systemTags: string;
  chatLink: string; repeatStatus: string; repeatStatusOnAssign: string;
  time1406: string; resolutionTimeMin: string; frtTat: string;
  resolutionTat: string; phoneNumber1: string; currentAgent: string;
  email2: string; chatDate: string; empId: string; lob: string;
  week: string; count1: number; timeSlot: string; hour: number;
  tlName: string; disposition: string; dayShiftNightShift: string;
  uniqueId: string; froud: string; frt2: string; userType: string;
}

export async function uploadBellavitaChat(rows: BellavitaChatRow[], uploadedBy: number, batchId: string): Promise<number> {
  const sql = `INSERT INTO db_masmis.bb_chat (
    ticket_id, inbox_id, inbox_name, ticket_status, agent_name,
    email_1, phone_number, created_at, assigned_at, agent_frt_at,
    frt_1, resolution_time_at, resolution_time, average_wait_time,
    is_resolved, is_outside_working_hrs, level1_tags, level2_tags,
    level3_tags, system_tags, chat_link, repeat_status,
    repeat_status_on_assign, time_1406, resolution_time_min, frt_tat,
    resolution_tat, phone_number1, current_agent, email_2, chat_date,
    emp_id, lob, week, count_1, time_slot, hour, tl_name, disposition,
    day_shift_night_shift, unique_id, froud, frt_2, user_type, uploaded_by, upload_batch_id
  ) VALUES ?`;
  const values = rows.map(r => [
    r.ticketId, r.inboxId, r.inboxName, r.ticketStatus, r.agentName,
    r.email1, r.phoneNumber, parseChatDatetime(r.createdAt),
    parseChatDatetime(r.assignedAt), parseChatDatetime(r.agentFrtAt),
    r.frt1, parseChatDatetime(r.resolutionTimeAt), r.resolutionTime,
    r.averageWaitTime, r.isResolved, r.isOutsideWorkingHrs, r.level1Tags,
    r.level2Tags, r.level3Tags, r.systemTags, r.chatLink, r.repeatStatus,
    r.repeatStatusOnAssign, r.time1406, r.resolutionTimeMin, r.frtTat,
    r.resolutionTat, r.phoneNumber1, r.currentAgent, r.email2,
    parseBellavitaDate(r.chatDate), r.empId, r.lob, r.week,
    r.count1 || null, r.timeSlot, r.hour || null, r.tlName, r.disposition,
    r.dayShiftNightShift, r.uniqueId, r.froud, r.frt2, r.userType,
    uploadedBy, batchId,
  ]);
  const [result] = await getMasmisPool().query(sql, [values]);
  return (result as mysql.ResultSetHeader).affectedRows;
}

// ─── Neemans Sale Raw Upload ───────────────────────────────────────────────────

export interface NeemansSaleRawRow {
  week: string; date: string; empId: string; name: string; tl: string;
  lob: string; tenure: string; orderId: string; customerNumber: string;
  emailId: string; paymentStatus: string; amount: number; discountCode: string;
  lineItemName: string; callingLob: string; callingStatus: string; status: string;
  count: number; neemansOrderId: string; currentStatus: string; finalStatus: string;
  lineItemQty: number; target: number; callDateTime: string; duration: string;
  createdAt: string;
}

export async function uploadNeemansSaleRaw(rows: NeemansSaleRawRow[], uploadedBy: number, batchId: string): Promise<number> {
  const sql = `INSERT INTO db_masmis.neemans_sale_raw (
    week, date, emp_id, name, tl, lob, tenure,
    order_id, customer_number, email_id, payment_status, amount, discount_code,
    line_item_name, calling_lob, calling_status, status, count,
    neemans_order_id, current_status, final_status, line_item_qty, target,
    call_date_time, duration, created_at_raw, uploaded_by, upload_batch_id
  ) VALUES ?`;
  const values = rows.map(r => [
    r.week, r.date, r.empId, r.name, r.tl, r.lob, r.tenure,
    r.orderId, r.customerNumber, r.emailId, r.paymentStatus, r.amount || null, r.discountCode,
    r.lineItemName, r.callingLob, r.callingStatus, r.status, r.count || null,
    r.neemansOrderId, r.currentStatus, r.finalStatus, r.lineItemQty || null, r.target || null,
    r.callDateTime, r.duration, r.createdAt, uploadedBy, batchId,
  ]);
  const [result] = await getMasmisPool().query(sql, [values]);
  return (result as mysql.ResultSetHeader).affectedRows;
}

// ─── Neemans Allocation Upload ─────────────────────────────────────────────────

export interface NeemansAllocationRow {
  phone: string; email: string; customerName: string; productTitle: string;
  amount: number; type: string; date: string; agent: string;
  callingStatus: string; subScenario1: string; subScenario2: string; callId: string;
}

export async function uploadNeemansAllocation(rows: NeemansAllocationRow[], uploadedBy: number, batchId: string): Promise<number> {
  const sql = `INSERT INTO db_masmis.neemans_allocation (
    phone, email, customer_name, product_title, amount, type, date,
    agent, calling_status, sub_scenario1, sub_scenario2, call_id,
    uploaded_by, upload_batch_id
  ) VALUES ?`;
  const values = rows.map(r => [
    r.phone, r.email, r.customerName, r.productTitle, r.amount || null, r.type, r.date,
    r.agent, r.callingStatus, r.subScenario1, r.subScenario2, r.callId,
    uploadedBy, batchId,
  ]);
  const [result] = await getMasmisPool().query(sql, [values]);
  return (result as mysql.ResultSetHeader).affectedRows;
}

// ─── Neemans Cart Upload ───────────────────────────────────────────────────────

export interface NeemansCartRow {
  sno: number; cartId: string; createdAt: string; updatedAt: string;
  customerName: string; phoneNumber: string; emailId: string;
  lineItems: string; amount: number; agent: string;
  disposition: string; subDisposition: string; callDate: string; status: string;
}

export async function uploadNeemansCart(rows: NeemansCartRow[], uploadedBy: number, batchId: string): Promise<number> {
  const sql = `INSERT INTO db_masmis.neemans_cart (
    sno, cart_id, created_at, updated_at,
    customer_name, phone_number, email_id, line_items, amount,
    agent, disposition, sub_disposition, call_date, status,
    uploaded_by, upload_batch_id
  ) VALUES ?`;
  const values = rows.map(r => [
    r.sno || null, r.cartId, r.createdAt, r.updatedAt,
    r.customerName, r.phoneNumber, r.emailId, r.lineItems, r.amount || null,
    r.agent, r.disposition, r.subDisposition, r.callDate || null, r.status,
    uploadedBy, batchId,
  ]);
  const [result] = await getMasmisPool().query(sql, [values]);
  return (result as mysql.ResultSetHeader).affectedRows;
}

// ─── Bellavita Cart Upload ─────────────────────────────────────────────────────

export interface BellavitaCartRow {
  cc: string; source: string; sno: number; cartId: string; createdAt: string;
  updatedAt: string; customerName: string; customerAddress: string;
  phoneNumber: string; emailId: string; lineItems: string; variantTitle: string;
  abandonedCartLink: string; amount: number; phone10Digit: string; dates: string;
  agent: string; disposition: string; subDisposition: string; callDate: string;
  sameDayConnect: string; status: string;
}

export async function uploadBellavitaCart(rows: BellavitaCartRow[], uploadedBy: number, batchId: string): Promise<number> {
  const sql = `INSERT INTO db_masmis.bb_cart (
    cc, source, sno, cart_id, created_at, updated_at,
    customer_name, customer_address, phone_number, email_id,
    line_items, variant_title, abandoned_cart_link, amount,
    phone_10_digit, dates, agent, disposition, sub_disposition,
    call_date, same_day_connect, status, uploaded_by, upload_batch_id
  ) VALUES ?`;
  const values = rows.map(r => [
    r.cc, r.source, r.sno || null, r.cartId, r.createdAt, r.updatedAt,
    r.customerName, r.customerAddress, r.phoneNumber, r.emailId,
    r.lineItems, r.variantTitle, r.abandonedCartLink, r.amount || null,
    r.phone10Digit, r.dates, r.agent, r.disposition, r.subDisposition,
    parseBellavitaDate(r.callDate), r.sameDayConnect, r.status, uploadedBy, batchId,
  ]);
  const [result] = await getMasmisPool().query(sql, [values]);
  return (result as mysql.ResultSetHeader).affectedRows;
}

// ─── Date Helpers ───────────────────────────────────────────────────────────────

function parseBellavitaDate(val: string): string | null {
  if (!val || val === '0' || val === '-' || val.trim() === '') return null;
  // Excel serial number
  const sn = parseFloat(val);
  if (!isNaN(sn) && sn > 40000 && sn < 60000) {
    const d = new Date((sn - 25569) * 86400 * 1000);
    return d.toISOString().slice(0, 19).replace('T', ' ');
  }
  // DD-Mon-YY
  const m = val.match(/^(\d{2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2})$/i);
  if (m) {
    const months: Record<string, string> = { Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12' };
    const year = parseInt(m[3]) < 50 ? `20${m[3]}` : `19${m[3]}`;
    return `${year}-${months[m[2]]}-${m[1]} 00:00:00`;
  }
  return null;
}

function parseChatDatetime(val: string): string | null {
  if (!val || val === '0') return null;
  const m = val.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}:\d{2})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]} ${m[4]}:00`;
  return null;
}

function parseAllocationCreatedAt(val: string): string | null {
  if (!val || val === '0' || val === '-') return null;
  const sn = parseFloat(val);
  if (!isNaN(sn) && sn > 40000 && sn < 60000) {
    const d = new Date((sn - 25569) * 86400 * 1000);
    return d.toISOString().slice(0, 19).replace('T', ' ');
  }
  return val;
}

// ─── Upload Log ─────────────────────────────────────────────────────────────────

export function generateBatchId(): string {
  return crypto.randomUUID();
}

export async function logUpload(
  batchId: string, tableName: string, fileName: string,
  rowCount: number, uploadedBy: number,
): Promise<void> {
  await getMasmisPool().execute(
    'INSERT INTO db_masmis.upload_log (batch_id, table_name, file_name, row_count, uploaded_by) VALUES (?,?,?,?,?)',
    [batchId, tableName, fileName, rowCount, uploadedBy],
  );
}

export async function getUploadLogs(tableName?: string): Promise<any[]> {
  let sql = `
    SELECT batch_id, table_name, file_name, row_count, uploaded_by,
           DATE_FORMAT(uploaded_at, '%Y-%m-%dT%H:%i:%s') AS uploaded_at
    FROM db_masmis.upload_log`;
  const params: string[] = [];
  if (tableName) { sql += ' WHERE table_name = ?'; params.push(tableName); }
  sql += ' ORDER BY uploaded_at DESC LIMIT 50';
  const [rows] = await getMasmisPool().execute(sql, params);
  return (rows as any[]).map(r => ({
    batchId:      r.batch_id,
    tableName:    r.table_name,
    fileName:     r.file_name,
    rowsInserted: r.row_count,
    uploadedBy:   r.uploaded_by,
    uploadedAt:   r.uploaded_at,
  }));
}

// ─── Bellavita Dashboard ───────────────────────────────────────────────────────

export interface BellavitaDashboardMetrics {
  totalRevenue: number;
  totalSaleCount: number;
  rtoPct: number;
  codPct: number;
  codCount: number;
  paidPct: number;
  paidCount: number;
  aov: number;
  rtoAmount: number;
  netRevenue: number;
  netSaleCount: number;
  netRevenueWithoutGst: number;
}

export interface BellavitaDashboardLobRow {
  campaign: string;
  totalRevenue: number;
  totalSaleCount: number;
  rtoPct: number;
  codPct: number;
  paidPct: number;
  aov: number;
  rtoAmount: number;
  netRevenue: number;
  netSaleCount: number;
  netRevenueWithoutGst: number;
}

export async function getBellavitaDashboard(month: string): Promise<{
  metrics: BellavitaDashboardMetrics;
  lob: BellavitaDashboardLobRow[];
}> {
  const startDate = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const endDate = `${month}-${String(lastDay).padStart(2, '0')} 23:59:59`;

  const pool = getMasmisPool();

  // Overall metrics
  const [overallRows] = await pool.query(`
    SELECT
      COUNT(*) AS total_sale_count,
      COALESCE(SUM(amount), 0) AS total_revenue,
      SUM(CASE WHEN final_status = 'RTO' THEN 1 ELSE 0 END) AS rto_count,
      SUM(CASE WHEN LOWER(payment_status) = 'cod' THEN 1 ELSE 0 END) AS cod_count,
      SUM(CASE WHEN LOWER(payment_status) = 'paid' THEN 1 ELSE 0 END) AS paid_count,
      COALESCE(SUM(CASE WHEN final_status = 'RTO' THEN amount ELSE 0 END), 0) AS rto_amount
    FROM db_masmis.bb_sale
    WHERE calling_status = 'Sale Made'
      AND \`Date\` >= ? AND \`Date\` <= ?
  `, [startDate, endDate]);

  const o = (overallRows as any[])[0];

  const totalRevenue = Number(o.total_revenue) || 0;
  const totalSaleCount = Number(o.total_sale_count) || 0;
  const rtoCount = Number(o.rto_count) || 0;
  const codCount = Number(o.cod_count) || 0;
  const paidCount = Number(o.paid_count) || 0;
  const rtoAmount = Number(o.rto_amount) || 0;
  const netSaleCount = totalSaleCount - rtoCount;
  const netRevenue = totalRevenue - rtoAmount;

  const metrics: BellavitaDashboardMetrics = {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalSaleCount,
    rtoPct: totalSaleCount > 0 ? Math.round((rtoCount / totalSaleCount) * 10000) / 100 : 0,
    codPct: totalSaleCount > 0 ? Math.round((codCount / totalSaleCount) * 10000) / 100 : 0,
    codCount,
    paidPct: totalSaleCount > 0 ? Math.round((paidCount / totalSaleCount) * 10000) / 100 : 0,
    paidCount,
    aov: totalSaleCount > 0 ? Math.round((totalRevenue / totalSaleCount) * 100) / 100 : 0,
    rtoAmount: Math.round(rtoAmount * 100) / 100,
    netRevenue: Math.round(netRevenue * 100) / 100,
    netSaleCount,
    netRevenueWithoutGst: Math.round((netRevenue / 1.18) * 100) / 100,
  };

  // LOB-wise (campaign) breakdown
  const [lobRows] = await pool.query(`
    SELECT
      campaign,
      COUNT(*) AS total_sale_count,
      COALESCE(SUM(amount), 0) AS total_revenue,
      SUM(CASE WHEN final_status = 'RTO' THEN 1 ELSE 0 END) AS rto_count,
      SUM(CASE WHEN LOWER(payment_status) = 'cod' THEN 1 ELSE 0 END) AS cod_count,
      SUM(CASE WHEN LOWER(payment_status) = 'paid' THEN 1 ELSE 0 END) AS paid_count,
      COALESCE(SUM(CASE WHEN final_status = 'RTO' THEN amount ELSE 0 END), 0) AS rto_amount
    FROM db_masmis.bb_sale
    WHERE calling_status = 'Sale Made'
      AND \`Date\` >= ? AND \`Date\` <= ?
    GROUP BY campaign
    ORDER BY total_revenue DESC
  `, [startDate, endDate]);

  const lob: BellavitaDashboardLobRow[] = (lobRows as any[]).map((r: any) => {
    const rev = Number(r.total_revenue) || 0;
    const count = Number(r.total_sale_count) || 0;
    const rtoC = Number(r.rto_count) || 0;
    const codC = Number(r.cod_count) || 0;
    const paidC = Number(r.paid_count) || 0;
    const rtoAmt = Number(r.rto_amount) || 0;
    const netC = count - rtoC;
    const netRev = rev - rtoAmt;
    return {
      campaign: r.campaign || 'Unknown',
      totalRevenue: Math.round(rev * 100) / 100,
      totalSaleCount: count,
      rtoPct: count > 0 ? Math.round((rtoC / count) * 10000) / 100 : 0,
      codPct: count > 0 ? Math.round((codC / count) * 10000) / 100 : 0,
      paidPct: count > 0 ? Math.round((paidC / count) * 10000) / 100 : 0,
      aov: count > 0 ? Math.round((rev / count) * 100) / 100 : 0,
      rtoAmount: Math.round(rtoAmt * 100) / 100,
      netRevenue: Math.round(netRev * 100) / 100,
      netSaleCount: netC,
      netRevenueWithoutGst: netRev > 0 ? Math.round((netRev / 1.18) * 100) / 100 : 0,
    };
  });

  return { metrics, lob };
}

// ─── Neemans Dashboard ────────────────────────────────────────────────────────

// Targets now stored in db_masmis.neemans_month_targets (managed via API)

const SERIAL_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Excel serial number → date (UTC). Excel epoch is 1899-12-30.
function serialToDate(serial: number): Date {
  return new Date((serial - 25569) * 86400000);
}

// Date → Excel serial number.
function dateToSerial(y: number, m: number, d: number): number {
  return Math.floor(Date.UTC(y, m, d) / 86400000) + 25569;
}

// Excel serial → "1-Jun" label for chart display.
function serialToLabel(serial: number): string {
  const d = serialToDate(serial);
  return `${d.getUTCDate()}-${SERIAL_MONTHS[d.getUTCMonth()]}`;
}

function round1(n: number) { return Math.round(n * 10) / 10; }

export async function getNeemansDashboard(yyyyMm: string) {
  const [yyyy, mm] = yyyyMm.split('-');
  const yr = parseInt(yyyy);
  const mo = parseInt(mm) - 1; // 0-indexed

  const target      = await getNeemansTarget(yyyyMm);
  const daysInMo    = new Date(yr, mo + 1, 0).getDate();
  const dailyTarget = target / daysInMo;

  // Excel serial range for the selected month
  const startSerial = dateToSerial(yr, mo, 1);
  const endSerial   = dateToSerial(yr, mo, daysInMo);

  const calendarStart = `${yyyy}-${mm}-01`;
  const calendarEnd   = `${yyyy}-${mm}-${String(daysInMo).padStart(2, '0')}`;

  // 2 queries — agent data is handled by the separate /neemans-agent-data endpoint
  const [allocDateRows, dateDetailRows] = await Promise.all([
    // Allocation: workable + connected per day — sum in JS for KPI totals
    queryMasmis(`
      SELECT
        CAST(date AS UNSIGNED) AS serial,
        COUNT(CASE WHEN calling_status IS NOT NULL AND calling_status NOT IN ('', '-') THEN 1 END) AS workable,
        COUNT(CASE WHEN calling_status = 'Connected' THEN 1 END) AS connected
      FROM db_masmis.neemans_allocation
      WHERE CAST(date AS UNSIGNED) BETWEEN ? AND ?
        AND CAST(date AS UNSIGNED) > 0
      GROUP BY serial
      ORDER BY serial ASC
    `, [startSerial, endSerial]),

    // Date detail: sale KPIs + COD/paid breakdown per day (one scan)
    queryMasmis(`
      SELECT
        CAST(date AS UNSIGNED) AS serial,
        COUNT(*) AS sale_count,
        COALESCE(SUM(amount), 0) AS revenue,
        COUNT(CASE WHEN LOWER(payment_status) = 'cod'  THEN 1 END) AS cod_count,
        COALESCE(SUM(CASE WHEN LOWER(payment_status) = 'cod'  THEN amount ELSE 0 END), 0) AS cod_revenue,
        COUNT(CASE WHEN LOWER(payment_status) = 'paid' THEN 1 END) AS paid_count,
        COALESCE(SUM(CASE WHEN LOWER(payment_status) = 'paid' THEN amount ELSE 0 END), 0) AS paid_revenue
      FROM db_masmis.neemans_sale_raw
      WHERE CAST(date AS UNSIGNED) BETWEEN ? AND ?
        AND CAST(date AS UNSIGNED) > 0
      GROUP BY serial
      ORDER BY serial ASC
    `, [startSerial, endSerial]),
  ]);

  // Derive KPI totals by summing the per-day rows
  let workable = 0, connected = 0;
  for (const row of allocDateRows as any[]) {
    workable  += Number(row.workable)  || 0;
    connected += Number(row.connected) || 0;
  }

  let totalOrders = 0, revenue = 0, paidOrders = 0, codOrders = 0;
  for (const row of dateDetailRows as any[]) {
    totalOrders += Number(row.sale_count) || 0;
    revenue     += Number(row.revenue)    || 0;
    paidOrders  += Number(row.paid_count) || 0;
    codOrders   += Number(row.cod_count)  || 0;
  }

  const kpis = {
    workable, connected,
    connectedPct:   workable > 0    ? round1(connected   / workable    * 100) : 0,
    totalOrders,
    conversionPct:  connected > 0   ? round1(totalOrders / connected   * 100) : 0,
    revenue:        Math.round(revenue),
    target,
    achievementPct: target > 0      ? round1(revenue     / target      * 100) : 0,
    paidPct:        totalOrders > 0 ? round1(paidOrders  / totalOrders * 100) : 0,
    codPct:         totalOrders > 0 ? round1(codOrders   / totalOrders * 100) : 0,
  };

  // Merge allocation + sale rows into one date map
  const dateMap = new Map<number, { connected: number; workable: number; saleCount: number; revenue: number }>();
  for (const row of allocDateRows as any[]) {
    const ser = Number(row.serial);
    dateMap.set(ser, { workable: Number(row.workable) || 0, connected: Number(row.connected) || 0, saleCount: 0, revenue: 0 });
  }
  for (const row of dateDetailRows as any[]) {
    const ser = Number(row.serial);
    const e   = dateMap.get(ser) ?? { workable: 0, connected: 0, saleCount: 0, revenue: 0 };
    dateMap.set(ser, { ...e, saleCount: Number(row.sale_count) || 0, revenue: Number(row.revenue) || 0 });
  }

  const sortedSerials = [...dateMap.keys()].sort((a, b) => a - b);

  let cumRevenue = 0;
  let cumTarget  = 0;
  const dateRows = sortedSerials.map(ser => {
    const row = dateMap.get(ser)!;
    cumRevenue += row.revenue;
    cumTarget  += dailyTarget;
    return {
      date:              serialToLabel(ser),
      connected:         row.connected,
      saleCount:         row.saleCount,
      revenue:           Math.round(row.revenue),
      conversionPct:     row.connected > 0 ? round1(row.saleCount / row.connected * 100) : 0,
      dailyTarget:       Math.round(dailyTarget),
      cumulativeRevenue: Math.round(cumRevenue),
      cumulativeTarget:  Math.round(cumTarget),
    };
  });

  const dateTable = (dateDetailRows as any[]).map(r => ({
    date:        serialToLabel(Number(r.serial)),
    saleCount:   Number(r.sale_count)   || 0,
    revenue:     Math.round(Number(r.revenue)     || 0),
    codCount:    Number(r.cod_count)    || 0,
    codRevenue:  Math.round(Number(r.cod_revenue)  || 0),
    paidCount:   Number(r.paid_count)   || 0,
    paidRevenue: Math.round(Number(r.paid_revenue) || 0),
  }));

  return { kpis, dateRows, dateTable };
}

// ─── Neemans Agent Data (date-range filtered, separate from main dashboard) ────

export async function getNeemansAgentData(startDate: string, endDate: string) {
  // Convert calendar dates to Excel serial numbers
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  const startSerial = dateToSerial(sy, sm - 1, sd);
  const endSerial   = dateToSerial(ey, em - 1, ed);

  const [agentRows, cdrRows] = await Promise.all([
    queryMasmis(`
      SELECT
        COALESCE(NULLIF(TRIM(name), ''), 'Unknown') AS agent,
        COALESCE(NULLIF(TRIM(emp_id), ''), '')      AS emp_id,
        COUNT(*)                                    AS sale_count,
        COALESCE(SUM(amount), 0)                   AS revenue,
        COUNT(CASE WHEN LOWER(payment_status) = 'cod'  THEN 1 END) AS cod_count,
        COALESCE(SUM(CASE WHEN LOWER(payment_status) = 'cod'  THEN amount ELSE 0 END), 0) AS cod_revenue,
        COUNT(CASE WHEN LOWER(payment_status) = 'paid' THEN 1 END) AS paid_count,
        COALESCE(SUM(CASE WHEN LOWER(payment_status) = 'paid' THEN amount ELSE 0 END), 0) AS paid_revenue
      FROM db_masmis.neemans_sale_raw
      WHERE CAST(date AS UNSIGNED) BETWEEN ? AND ?
        AND CAST(date AS UNSIGNED) > 0
      GROUP BY agent, emp_id
      ORDER BY revenue DESC
    `, [startSerial, endSerial]),

    querySource<{ masid: string; total_calls: number }>(`
      SELECT Agent AS masid, COUNT(PhoneNumber) AS total_calls
      FROM dialer_db.cdr_ob_249
      WHERE CallDate BETWEEN ? AND ?
        AND Agent IS NOT NULL AND Agent != ''
      GROUP BY Agent
    `, [startDate, endDate]),
  ]);

  const cdrMap = new Map<string, number>();
  for (const row of cdrRows as any[]) {
    const key = String(row.masid).toUpperCase().trim();
    if (key) cdrMap.set(key, Number(row.total_calls) || 0);
  }

  return (agentRows as any[]).map(r => {
    const masid      = String(r.emp_id).toUpperCase().trim();
    const saleCount  = Number(r.sale_count) || 0;
    const codCount   = Number(r.cod_count)  || 0;
    const paidCount  = Number(r.paid_count) || 0;
    return {
      agent:       String(r.agent),
      empId:       masid,
      totalCalls:  cdrMap.get(masid) ?? 0,
      saleCount,
      revenue:     Math.round(Number(r.revenue)      || 0),
      codCount,
      codRevenue:  Math.round(Number(r.cod_revenue)  || 0),
      paidCount,
      paidRevenue: Math.round(Number(r.paid_revenue) || 0),
      codPct:      saleCount > 0 ? round1(codCount  / saleCount * 100) : 0,
      paidPct:     saleCount > 0 ? round1(paidCount / saleCount * 100) : 0,
    };
  });
}

// ─── Sale Raw export — all columns for a calendar date range ─────────────────

export async function getNeemansSaleRawExport(startDate: string, endDate: string) {
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  const startSerial = dateToSerial(sy, sm - 1, sd);
  const endSerial   = dateToSerial(ey, em - 1, ed);

  return queryMasmis(`
    SELECT
      DATE_ADD('1970-01-01', INTERVAL (CAST(date AS UNSIGNED) - 25569) DAY) AS sale_date,
      week, emp_id, name, tl, lob, tenure,
      order_id, customer_number, email_id, payment_status, amount,
      discount_code, line_item_name, calling_lob, calling_status,
      status, \`count\`, neemans_order_id, current_status, final_status,
      line_item_qty, target, call_date_time, duration
    FROM db_masmis.neemans_sale_raw
    WHERE CAST(date AS UNSIGNED) BETWEEN ? AND ?
      AND CAST(date AS UNSIGNED) > 0
    ORDER BY CAST(date AS UNSIGNED) ASC
    LIMIT 200000
  `, [startSerial, endSerial]);
}

// ─── CDR sub-scenario + priority lookup ──────────────────────────────────────

const CDR_SCENARIO: Record<string, string> = {
  SALE:'Sale Done', OP:'Order Placed', PTP:'PTP 24 HOURS',
  CODIN:'COD Interested', CB:'Call back', CALLBK:'Call Back', BCALL:'Call Back',
  BISSU:'CX facing Payment failure issu', CXJC:'Cx just checking the product',
  CDBS:'Call drop before sale pitch', NAMP:'CX facing Payment failure issu',
  CHEK:'Just checking Product', RMD:'Require More Discount', PRZ:'Price Issue',
  DISMX:'Not Required Now', NRN:'Not Required Now', ALHAV:'Already having the product',
  NR:'Not Required', OOS:'Out of Stock', NI:'Not Interested', OS:'Out Of Stock',
  COM:'Complaint', CDWT:'Call Disconnected While Talkin',
  APFW:'Already Placed from Website', APFOW:'Already placed from other Webs',
  PI:'Price Issue', OUTOF:'Out Of Stock',
  ALRS:'Already order from our site', ALRD:'Already order from our site', ALRA:'Already order from our site',
  XFER:'Transfer', WCL:'Will Check Later', PC:'Price Costly',
  NS:'Didnt like the Quality', INCAD:'Incomplete Address',
  CXPM:'Cx did not use prepaid Method', PL:'Purchase Later',
  TI:'Trust Issue', VM:'Voice Mail', B:'Busy',
  POFO:'Placed Order From Other Source', OON:'Placed Order From Other Source',
  LB:'Language Barrie', OWGMD:'Other Website Giving More Disc',
  STOB:'Switch To Other Brand', SWITCH:'Switch To Other Brand',
  WOS:'Purchase from Offline Store', CXQ:'Cx didnt like the Quality',
  DC:'Call Diconnected', CD:'Call Disconnected By Customer',
  NP:'No Pitch No Price', CSDL:'Call Disc after Sending Link',
  FOLLOW:'Follow Up', DISC:'Cx Disconnected call', PU:'Call Picked Up',
  CXD:'Cx Disconnected call', COD:'Need only Cash on Delievery',
  NCOD:'Need only Cash on Delievery', CODN:'COD Not Available',
  DNC:'Do Not Disturb', PNI:'Prepaid Not Interested',
  ALRE:'CX ALREADY ORDER PRODUCT', INCALL:'Lead Being Call',
  NA:'No Answer AutoDial', DAIR:'dead Air', DA:'dead Air',
  DROP:'Agent Not Available', N:'No Answer', AB:'No Answer',
  ADC:'Disconnected Number', ERI:'No Answer', DISPO:'No Answer',
  PDROP:'Outbound Pre-Routing Drop', NC:'Not Connected', A:'Answering Machine',
};

const CDR_PRIORITY: Record<string, number> = {
  SALE:1, OP:1, PTP:2, CODIN:3, CB:3, CALLBK:3, BCALL:3,
  BISSU:4, CXJC:4, CDBS:4, NAMP:4, CHEK:5, RMD:5, PRZ:6,
  DISMX:7, NRN:7, ALHAV:7, NR:7, OOS:7, NI:8, OS:8, COM:8,
  CDWT:8, APFW:8, APFOW:8, PI:8, OUTOF:8,
  ALRS:9, ALRD:9, ALRA:9, XFER:9, WCL:9,
  PC:10, NS:10, INCAD:10, CXPM:10, PL:11, TI:11, VM:11, B:12,
  POFO:12, OON:12, LB:12, OWGMD:12, STOB:13, SWITCH:13, WOS:13,
  CXQ:14, DC:15, CD:15, NP:15, CSDL:15, FOLLOW:15,
  DISC:16, PU:16, CXD:16, COD:16, NCOD:16, CODN:17, DNC:18,
  PNI:18, ALRE:19, INCALL:20, NA:21, DAIR:22, DA:22, DROP:23,
  N:24, AB:25, ADC:25, ERI:25, DISPO:25, PDROP:25, NC:25, A:26,
};

// ─── CDR export — formatted with computed columns ─────────────────────────────

export async function getNeemansCdrExport(startDate: string, endDate: string) {
  const rows = await querySource<Record<string, unknown>>(`
    SELECT
      Agent,
      PhoneNumber                                                          AS \`Phone Number\`,
      DATE(CallDate)                                                       AS \`Call Date\`,
      CallStatus                                                           AS \`Call Code\`,
      StartTime                                                            AS \`Start Time\`,
      EndTime                                                              AS \`End Time\`,
      LengthInSec                                                          AS \`Length (Sec)\`,
      LengthInMin                                                          AS \`Length (Min)\`,
      campaign_id                                                          AS \`Campaign\`,
      term_reason                                                          AS \`Reason\`,
      Agent                                                                AS \`Agent ID\`,
      CASE WHEN Agent = 'VDAD' THEN 'Not Connected' ELSE 'Connected' END  AS \`Calling Status\`
    FROM dialer_db.cdr_ob_249
    WHERE CallDate BETWEEN ? AND ?
      AND campaign_id IN ('NEEMANS', 'NEEM_OUT')
    ORDER BY CallDate ASC
    LIMIT 200000
  `, [startDate, endDate]);

  return (rows as any[]).map(r => {
    const code = String(r['Call Code'] ?? '').toUpperCase().trim();
    const name = CDR_SCENARIO[code] ?? String(r['Call Code'] ?? '');
    return {
      ...r,
      'SUB SCENARIOS 1': name,
      'SUB SCENARIOS 2': name,
      'Priority': CDR_PRIORITY[code] ?? 99,
    };
  });
}

export async function deleteUploadBatch(batchId: string, tableName: string): Promise<{ deleted: number }> {
  const [dataResult] = await getMasmisPool().execute(
    `DELETE FROM db_masmis.${tableName} WHERE upload_batch_id = ?`, [batchId],
  );
  await getMasmisPool().execute(
    'DELETE FROM db_masmis.upload_log WHERE batch_id = ?', [batchId],
  );
  return { deleted: (dataResult as mysql.ResultSetHeader).affectedRows };
}
