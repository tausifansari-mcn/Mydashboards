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
  let sql = 'SELECT * FROM db_masmis.upload_log';
  const params: string[] = [];
  if (tableName) { sql += ' WHERE table_name = ?'; params.push(tableName); }
  sql += ' ORDER BY uploaded_at DESC LIMIT 50';
  const [rows] = await getMasmisPool().execute(sql, params);
  return rows as any[];
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

export async function deleteUploadBatch(batchId: string, tableName: string): Promise<{ deleted: number }> {
  const [dataResult] = await getMasmisPool().execute(
    `DELETE FROM db_masmis.${tableName} WHERE upload_batch_id = ?`, [batchId],
  );
  await getMasmisPool().execute(
    'DELETE FROM db_masmis.upload_log WHERE batch_id = ?', [batchId],
  );
  return { deleted: (dataResult as mysql.ResultSetHeader).affectedRows };
}
