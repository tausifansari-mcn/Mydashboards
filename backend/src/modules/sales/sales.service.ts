import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { querySource } from '../../lib/sourceDb';
import { getMasmisPool } from '../../lib/masmisDb';

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

// ─── Bellavita Sale Upload ──────────────────────────────────────────────────

export interface BellavitaRow {
  week: string;
  saleDate: string;
  empId: string;
  empName: string;
  tl: string;
  t1: string;
  t2: string;
  fhd: string;
  days: number;
  phoneNumber: string;
  emailId: string;
  paymentStatus: string;
  amount: number;
  orderId: string;
  campaign: string;
  callingStatus: string;
  discountCode: string;
  count: number;
  currentStatus: string;
  finalStatus: string;
  orderDatetime: string;
  state: string;
  lineItemName: string;
  pincode: string;
  orderDate: string;
  hrs24_48: string;
  crazyDeal: string;
  perfume: string;
  size: string;
  orderPickupDatetime: string;
  rtoInitiatedDatetime: string;
  diffHour: number;
  lob: string;
  pincodeRelevent: string;
  rtoStatus: string;
  draftOrder: string;
  time1608: string;
  saleSourceName: string;
  shift: string;
}

function parseBellavitaDate(val: string): string | null {
  if (!val || val === 'N/A' || val === '-') return null;
  const namedMonths: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  // Excel serial date number (e.g. "46143" or "46143.819444")
  if (/^\d+(\.\d+)?$/.test(val.trim())) {
    const serial = Math.round(parseFloat(val.trim()) * 86400) / 86400;
    if (serial < 1) return null;
    const excelEpoch = new Date(1899, 11, 30);
    const jsDate = new Date(excelEpoch.getTime() + serial * 86400000);
    const y = jsDate.getFullYear();
    const m = String(jsDate.getMonth() + 1).padStart(2, '0');
    const d = String(jsDate.getDate()).padStart(2, '0');
    const h = String(jsDate.getHours()).padStart(2, '0');
    const min = String(jsDate.getMinutes()).padStart(2, '0');
    const sec = String(jsDate.getSeconds()).padStart(2, '0');
    const totalSec = serial % 1 * 86400;
    // Only include time if at least 1 minute past midnight
    if (totalSec >= 60) {
      return `${y}-${m}-${d} ${h}:${min}:${sec}`;
    }
    return `${y}-${m}-${d}`;
  }
  // Try "DD-Mon-YY" format (e.g. "01-May-26")
  const named = val.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/);
  if (named) {
    const [, d, m, y] = named;
    const month = namedMonths[m.toLowerCase()];
    if (!month) return null;
    return `${2000 + Number(y)}-${month}-${d.padStart(2, '0')}`;
  }
  // Try "D-M-YY" or "DD-MM-YY" (numeric only)
  const numeric = val.match(/^(\d{1,2})-(\d{1,2})-(\d{2})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (numeric) {
    const [, d, m, y, h, min] = numeric;
    const date = `${2000 + Number(y)}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    if (h && min) {
      return `${date} ${h.padStart(2, '0')}:${min}:00`;
    }
    return date;
  }
  return null;
}

export async function uploadBellavitaSales(rows: BellavitaRow[], uploadedBy: number, batchId: string): Promise<number> {
  const sql = `
    INSERT INTO db_masmis.bb_sale (
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
    r.week,
    parseBellavitaDate(r.saleDate),
    r.empId,
    r.empName,
    r.tl,
    r.t1,
    r.t2,
    parseBellavitaDate(r.fhd),
    r.days || null,
    r.phoneNumber,
    r.emailId,
    r.paymentStatus,
    r.amount || null,
    r.orderId,
    r.campaign,
    r.callingStatus,
    r.discountCode,
    r.count || null,
    r.currentStatus,
    r.finalStatus,
    parseBellavitaDate(r.orderDatetime) || parseBellavitaDate(r.orderDate),
    r.state,
    r.lineItemName,
    r.pincode,
    parseBellavitaDate(r.orderDate),
    r.hrs24_48,
    r.crazyDeal,
    r.perfume,
    r.size,
    parseBellavitaDate(r.orderPickupDatetime),
    parseBellavitaDate(r.rtoInitiatedDatetime),
    r.diffHour || null,
    r.lob,
    r.pincodeRelevent,
    r.rtoStatus,
    r.draftOrder,
    r.time1608,
    r.saleSourceName,
    r.shift,
    uploadedBy,
    batchId,
  ]);
  const [result] = await getMasmisPool().query(sql, [values]);
  return (result as mysql.ResultSetHeader).affectedRows;
}

// ─── GNC Sale Upload ──────────────────────────────────────────────────────────

export interface GncRow {
  week: string;
  saleDate: string;
  empId: string;
  empName: string;
  tl: string;
  t1: string;
  t3: string;
  customerNumber: string;
  emailId: string;
  paymentStatus: string;
  grossAmount: number;
  sumBeforeGst: number;
  orderId: string;
  campaign: string;
  discountCode: string;
  count: number;
  status: string;
  lineItemName: string;
  saleLob: string;
  target: number;
  saleSource: string;
}

export async function uploadGncSales(rows: GncRow[], uploadedBy: number, batchId: string): Promise<number> {
  const sql = `
    INSERT INTO db_masmis.gnc_sale (
      week, sale_date, emp_id, emp_name, tl, t1, t3,
      customer_number, email_id, payment_status, gross_amount, sum_before_gst,
      order_id, campaign, discount_code, sale_count,
      status, line_item_name, sale_lob, target, sale_source, uploaded_by, upload_batch_id
    ) VALUES ?`;
  const values = rows.map(r => [
    r.week,
    parseBellavitaDate(r.saleDate),
    r.empId,
    r.empName,
    r.tl,
    parseBellavitaDate(r.t1),
    r.t3,
    r.customerNumber === '-' ? '' : r.customerNumber,
    r.emailId === '-' ? '' : r.emailId,
    r.paymentStatus,
    r.grossAmount || null,
    r.sumBeforeGst || null,
    r.orderId,
    r.campaign,
    r.discountCode === '-' ? '' : r.discountCode,
    r.count || null,
    r.status,
    r.lineItemName === '-' ? '' : r.lineItemName,
    r.saleLob,
    r.target || null,
    r.saleSource,
    uploadedBy,
    batchId,
  ]);
  const [result] = await getMasmisPool().query(sql, [values]);
  return (result as mysql.ResultSetHeader).affectedRows;
}

// ─── GNC APR Upload ───────────────────────────────────────────────────────────

export interface GncAprRow {
  uid: string;
  reportDate: string;
  userName: string;
  empId: string;
  tlName: string;
  calls: number;
  processType: string;
  loginTime: string;
  waitTime: string;
  talkTime: string;
  dispoTime: string;
  pauseTime: string;
  loginDuration: string;
  logoutTime: string;
  acht: number;
  aoc: string;
  bio: string;
  bre: string;
  briefing: string;
  downTime: string;
  lunch: string;
  meet: string;
  qa: string;
  sb: string;
  teaBreak: string;
  trainingBreak: string;
  wash: string;
  netLogin: string;
  breakTime: string;
  traQa: string;
  downtime: string;
  atten: number;
  capping: string;
}

export async function uploadGncApr(rows: GncAprRow[], uploadedBy: number, batchId: string): Promise<number> {
  const sql = `
    INSERT INTO db_masmis.gnc_apr (
      uid, report_date, user_name, emp_id, tl_name, calls, process_type,
      login_time, wait_time, talk_time, dispo_time, pause_time,
      login_duration, logout_time, acht, aoc, bio, bre, briefing,
      down_time, lunch, meet, qa, sb, tea_break, training_break, wash,
      net_login, break_time, tra_qa, downtime, atten, capping, uploaded_by, upload_batch_id
    ) VALUES ?`;
  const values = rows.map(r => [
    r.uid,
    parseBellavitaDate(r.reportDate),
    r.userName,
    r.empId,
    r.tlName,
    r.calls || null,
    r.processType,
    r.loginTime,
    r.waitTime,
    r.talkTime,
    r.dispoTime,
    r.pauseTime,
    r.loginDuration,
    r.logoutTime,
    r.acht || null,
    r.aoc,
    r.bio,
    r.bre,
    r.briefing,
    r.downTime,
    r.lunch,
    r.meet,
    r.qa,
    r.sb,
    r.teaBreak,
    r.trainingBreak,
    r.wash,
    r.netLogin,
    r.breakTime,
    r.traQa,
    r.downtime,
    r.atten || null,
    r.capping,
    uploadedBy,
    batchId,
  ]);
  const [result] = await getMasmisPool().query(sql, [values]);
  return (result as mysql.ResultSetHeader).affectedRows;
}

// ─── GNC Allocation Upload ────────────────────────────────────────────────────

export interface GncAllocationRow {
  uid: string;
  allocDate: string;
  helper: string;
  dateType: string;
  timeSlot: string;
  store: string;
  customerName: string;
  email: string;
  total: number;
  createdAt: string;
  lineitemName: string;
  lineitemSku: string;
  shippingName: string;
  shippingStreet: string;
  shippingCity: string;
  shippingZip: string;
  shippingPhone: string;
  empId: string;
  callingStatus: string;
  subScenarios1: string;
  callbackDate: string;
  sameDayConnect: string;
  ncConnect: string;
}

export async function uploadGncAllocation(rows: GncAllocationRow[], uploadedBy: number, batchId: string): Promise<number> {
  const sql = `
    INSERT INTO db_masmis.gnc_allocation (
      uid, alloc_date, helper, date_type, time_slot, store,
      customer_name, email, total, created_at, lineitem_name, lineitem_sku,
      shipping_name, shipping_street, shipping_city, shipping_zip, shipping_phone,
      emp_id, calling_status, sub_scenarios_1, callback_date,
      same_day_connect, nc_connect, uploaded_by, upload_batch_id
    ) VALUES ?`;
  const values = rows.map(r => [
    r.uid,
    parseBellavitaDate(r.allocDate),
    r.helper,
    r.dateType,
    r.timeSlot,
    r.store,
    r.customerName,
    r.email,
    r.total || null,
    parseAllocationCreatedAt(r.createdAt),
    r.lineitemName,
    r.lineitemSku,
    r.shippingName,
    r.shippingStreet,
    r.shippingCity,
    r.shippingZip,
    r.shippingPhone,
    r.empId,
    r.callingStatus,
    r.subScenarios1,
    parseBellavitaDate(r.callbackDate),
    r.sameDayConnect,
    r.ncConnect,
    uploadedBy,
    batchId,
  ]);
  const [result] = await getMasmisPool().query(sql, [values]);
  return (result as mysql.ResultSetHeader).affectedRows;
}

function parseAllocationCreatedAt(val: string): string | null {
  if (!val) return null;
  const m = val.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);
  return m ? m[1] : null;
}

// ─── Bellavita APR Upload (array-based, duplicate "Attendance" cols) ─────────

export interface BellavitaAprRow {
  uniqueId: string;
  week: string;
  reportDate: string;
  empName: string;
  noiid: string;
  numCallsChat: number;
  lob: string;
  loginTime: string;
  waitTime: string;
  talkTime: string;
  dispoTime: string;
  pauseTime: string;
  acht: number;
  lunch: string;
  tea: string;
  tea1: string;
  washr: string;
  teamBriefingAux: string;
  netPause: string;
  avgDispo: string;
  totalBreak: string;
  actualLoginHrs: string;
  downtime: string;
  loginDuration: string;
  logoutTime: string;
  netLoginHrs: string;
  utilization: string;
  attendance1: string;
  week1: string;
  mtd: string;
  teamLeader: string;
  fhd: string;
  tenure: number;
  tenurityWeek: string;
  subLob: string;
  uniqueCount: number;
  attendance2: string;
  capping: string;
  attendance3: string;
}

export async function uploadBellavitaApr(rows: BellavitaAprRow[], uploadedBy: number, batchId: string): Promise<number> {
  const sql = `
    INSERT INTO db_masmis.bb_apr (
      unique_id, week, report_date, emp_name, noiid, num_calls_chat, lob,
      login_time, wait_time, talk_time, dispo_time, pause_time, acht,
      lunch, tea, tea1, washr, team_briefing_aux, net_pause, avg_dispo,
      total_break, actual_login_hrs, downtime, login_duration, logout_time,
      net_login_hrs, utilization, attendance_1, week_1, mtd, team_leader,
      fhd, tenure, tenurity_week, sub_lob, unique_count, attendance_2,
      capping, attendance_3, uploaded_by, upload_batch_id
    ) VALUES ?`;
  const values = rows.map(r => [
    r.uniqueId, r.week, parseBellavitaDate(r.reportDate), r.empName, r.noiid,
    r.numCallsChat || null, r.lob, r.loginTime, r.waitTime, r.talkTime,
    r.dispoTime, r.pauseTime, r.acht || null, r.lunch, r.tea, r.tea1,
    r.washr, r.teamBriefingAux, r.netPause, r.avgDispo, r.totalBreak,
    r.actualLoginHrs, r.downtime, r.loginDuration, r.logoutTime,
    r.netLoginHrs, r.utilization, r.attendance1, r.week1, r.mtd,
    r.teamLeader, r.fhd, r.tenure || null, r.tenurityWeek, r.subLob,
    r.uniqueCount || null, r.attendance2, r.capping, r.attendance3,
    uploadedBy,
    batchId,
  ]);
  const [result] = await getMasmisPool().query(sql, [values]);
  return (result as mysql.ResultSetHeader).affectedRows;
}

// ─── Bellavita Chat Upload (array-based, duplicate "Email", "FRT" cols) ──────

export interface BellavitaChatRow {
  ticketId: string;
  inboxId: string;
  inboxName: string;
  ticketStatus: string;
  agentName: string;
  email1: string;
  phoneNumber: string;
  createdAt: string;
  assignedAt: string;
  agentFrtAt: string;
  frt1: string;
  resolutionTimeAt: string;
  resolutionTime: string;
  averageWaitTime: string;
  isResolved: string;
  isOutsideWorkingHrs: string;
  level1Tags: string;
  level2Tags: string;
  level3Tags: string;
  systemTags: string;
  chatLink: string;
  repeatStatus: string;
  repeatStatusOnAssign: string;
  time1406: string;
  resolutionTimeMin: string;
  frtTat: string;
  resolutionTat: string;
  phoneNumber1: string;
  currentAgent: string;
  email2: string;
  chatDate: string;
  empId: string;
  lob: string;
  week: string;
  count1: number;
  timeSlot: string;
  hour: number;
  tlName: string;
  disposition: string;
  dayShiftNightShift: string;
  uniqueId: string;
  froud: string;
  frt2: string;
  userType: string;
}

export async function uploadBellavitaChat(rows: BellavitaChatRow[], uploadedBy: number, batchId: string): Promise<number> {
  const sql = `
    INSERT INTO db_masmis.bb_chat (
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
    uploadedBy,
    batchId,
  ]);
  const [result] = await getMasmisPool().query(sql, [values]);
  return (result as mysql.ResultSetHeader).affectedRows;
}

// ─── Bellavita Cart Upload ─────────────────────────────────────────────────────

export interface BellavitaCartRow {
  cc: string;
  source: string;
  sno: number;
  cartId: string;
  createdAt: string;
  updatedAt: string;
  customerName: string;
  customerAddress: string;
  phoneNumber: string;
  emailId: string;
  lineItems: string;
  variantTitle: string;
  abandonedCartLink: string;
  amount: number;
  phone10Digit: string;
  dates: string;
  agent: string;
  disposition: string;
  subDisposition: string;
  callDate: string;
  sameDayConnect: string;
  status: string;
}

export async function uploadBellavitaCart(rows: BellavitaCartRow[], uploadedBy: number, batchId: string): Promise<number> {
  const sql = `
    INSERT INTO db_masmis.bb_cart (
      cc, source, sno, cart_id, created_at, updated_at,
      customer_name, customer_address, phone_number, email_id,
      line_items, variant_title, abandoned_cart_link, amount,
      phone_10_digit, dates, agent, disposition, sub_disposition,
      call_date, same_day_connect, status, uploaded_by, upload_batch_id
    ) VALUES ?`;
  const values = rows.map(r => [
    r.cc,
    r.source,
    r.sno || null,
    r.cartId,
    r.createdAt,
    r.updatedAt,
    r.customerName,
    r.customerAddress,
    r.phoneNumber,
    r.emailId,
    r.lineItems,
    r.variantTitle,
    r.abandonedCartLink,
    r.amount || null,
    r.phone10Digit,
    r.dates,
    r.agent,
    r.disposition,
    r.subDisposition,
    r.callDate,
    r.sameDayConnect,
    r.status,
    uploadedBy,
    batchId,
  ]);
  const [result] = await getMasmisPool().query(sql, [values]);
  return (result as mysql.ResultSetHeader).affectedRows;
}

function parseChatDatetime(val: string): string | null {
  if (!val || val === '0') return null;
  // Format: "01-05-2026 12:19" (DD-MM-YYYY HH:mm)
  const m = val.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}:\d{2})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]} ${m[4]}:00`;
  return null;
}

// ─── Upload Log ─────────────────────────────────────────────────────────────

export function generateBatchId(): string {
  return crypto.randomUUID();
}

export async function logUpload(
  batchId: string,
  tableName: string,
  fileName: string,
  rowCount: number,
  uploadedBy: number,
): Promise<void> {
  await getMasmisPool().execute(
    'INSERT INTO db_masmis.upload_log (batch_id, table_name, file_name, row_count, uploaded_by) VALUES (?,?,?,?,?)',
    [batchId, tableName, fileName, rowCount, uploadedBy],
  );
}

export async function getUploadLogs(tableName?: string): Promise<any[]> {
  let sql = 'SELECT * FROM db_masmis.upload_log';
  const params: string[] = [];
  if (tableName) {
    sql += ' WHERE table_name = ?';
    params.push(tableName);
  }
  sql += ' ORDER BY uploaded_at DESC LIMIT 50';
  const [rows] = await getMasmisPool().execute(sql, params);
  return rows as any[];
}

export async function deleteUploadBatch(batchId: string, tableName: string): Promise<{ deleted: number }> {
  // Delete data rows with this batch_id
  const [dataResult] = await getMasmisPool().execute(
    `DELETE FROM db_masmis.${tableName} WHERE upload_batch_id = ?`,
    [batchId],
  );
  // Delete the log entry
  await getMasmisPool().execute(
    'DELETE FROM db_masmis.upload_log WHERE batch_id = ?',
    [batchId],
  );
  return { deleted: (dataResult as mysql.ResultSetHeader).affectedRows };
}
