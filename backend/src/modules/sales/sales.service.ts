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
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS db_masmis.neemans_apr (
        id INT AUTO_INCREMENT PRIMARY KEY,
        unique_id VARCHAR(100), week VARCHAR(100), date VARCHAR(100),
        emp_name VARCHAR(200), emp_id VARCHAR(100), calls INT DEFAULT 0,
        uca_ob INT DEFAULT 0, lob VARCHAR(200),
        login_time VARCHAR(100), parks INT DEFAULT 0,
        park_time VARCHAR(100), avg_park VARCHAR(100), parks_per_call DECIMAL(8,2),
        wait VARCHAR(100), talk VARCHAR(100), dispo VARCHAR(100), pause VARCHAR(100),
        login_ts VARCHAR(100), logout_ts VARCHAR(100), acht INT DEFAULT 0,
        team_briefing VARCHAR(100), lunch VARCHAR(100), tea VARCHAR(100),
        tea1 VARCHAR(100), washr VARCHAR(100), total_break VARCHAR(100),
        net_login VARCHAR(100), occu_pct DECIMAL(6,2),
        week_short VARCHAR(100), mtd VARCHAR(100),
        attendance INT DEFAULT 0, capping VARCHAR(100),
        uploaded_by INT, upload_batch_id VARCHAR(36),
        inserted_at DATETIME DEFAULT NOW()
      )
    `);
    // Widen VARCHAR columns on existing table (safe to run even if already wide)
    await pool.execute(`
      ALTER TABLE db_masmis.neemans_apr
        MODIFY COLUMN week VARCHAR(100),
        MODIFY COLUMN date VARCHAR(100),
        MODIFY COLUMN emp_id VARCHAR(100),
        MODIFY COLUMN lob VARCHAR(200),
        MODIFY COLUMN login_time VARCHAR(100),
        MODIFY COLUMN park_time VARCHAR(100),
        MODIFY COLUMN avg_park VARCHAR(100),
        MODIFY COLUMN wait VARCHAR(100),
        MODIFY COLUMN talk VARCHAR(100),
        MODIFY COLUMN dispo VARCHAR(100),
        MODIFY COLUMN pause VARCHAR(100),
        MODIFY COLUMN login_ts VARCHAR(100),
        MODIFY COLUMN logout_ts VARCHAR(100),
        MODIFY COLUMN team_briefing VARCHAR(100),
        MODIFY COLUMN lunch VARCHAR(100),
        MODIFY COLUMN tea VARCHAR(100),
        MODIFY COLUMN tea1 VARCHAR(100),
        MODIFY COLUMN washr VARCHAR(100),
        MODIFY COLUMN total_break VARCHAR(100),
        MODIFY COLUMN net_login VARCHAR(100),
        MODIFY COLUMN week_short VARCHAR(100),
        MODIFY COLUMN mtd VARCHAR(100),
        MODIFY COLUMN capping VARCHAR(100)
    `);
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS db_masmis.nms_Agent_Details (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        emp_id      VARCHAR(20)  NOT NULL,
        daildesk_id VARCHAR(100),
        name        VARCHAR(200) NOT NULL,
        lob         VARCHAR(100),
        tl          VARCHAR(200),
        doj         DATE,
        fhd         DATE,
        status      VARCHAR(20)  DEFAULT 'Active',
        dol         DATE,
        created_by  INT,
        updated_by  INT,
        created_at  DATETIME DEFAULT NOW(),
        updated_at  DATETIME DEFAULT NOW() ON UPDATE NOW()
      )
    `);
  } catch (err) {
    console.error('[sales] initNeemansTables warning:', (err as Error).message);
  }
}

// ─── NMS Agent Details CRUD ────────────────────────────────────────────────────

function tenureBucket(days: number): string {
  if (days > 180) return 'Above 180';
  if (days > 120) return '121-180';
  if (days > 90)  return '91-120';
  if (days > 60)  return '61-90';
  if (days > 30)  return '31-60';
  return '0-30';
}
function calcTenure(doj: string | null, dol: string | null) {
  if (!doj) return { tenure: 0, tenureBucket: '-' };
  const start = new Date(doj).getTime();
  const end   = dol ? new Date(dol).getTime() : Date.now();
  const days  = Math.max(0, Math.floor((end - start) / 86400000));
  return { tenure: days, tenureBucket: tenureBucket(days) };
}

function mapAgentRow(r: any) {
  const doj = r.doj ?? null;
  const fhd = r.fhd ?? null;
  const dol = r.dol ?? null;
  const { tenure, tenureBucket: bucket } = calcTenure(doj, dol);
  return { id: r.id, empId: r.emp_id, daildeskId: r.daildesk_id, name: r.name,
           lob: r.lob, tl: r.tl, doj, fhd, status: r.status, dol,
           tenure, tenureBucket: bucket };
}

export async function getNmsAgentDetails() {
  const [rows] = await getMasmisPool().query(`
    SELECT id, emp_id, daildesk_id, name, lob, tl,
      DATE_FORMAT(doj,'%Y-%m-%d') AS doj,
      DATE_FORMAT(fhd,'%Y-%m-%d') AS fhd,
      status,
      DATE_FORMAT(dol,'%Y-%m-%d') AS dol
    FROM db_masmis.nms_Agent_Details ORDER BY name ASC`);
  return (rows as any[]).map(mapAgentRow);
}

export async function createNmsAgentDetail(
  d: { empId: string; daildeskId?: string; name: string; lob?: string; tl?: string;
       doj?: string; fhd?: string; status?: string; dol?: string },
  userId: number
) {
  const [res] = await getMasmisPool().execute(
    `INSERT INTO db_masmis.nms_Agent_Details
       (emp_id,daildesk_id,name,lob,tl,doj,fhd,status,dol,created_by,updated_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [d.empId, d.daildeskId||null, d.name, d.lob||null, d.tl||null,
     d.doj||null, d.fhd||null, d.status||'Active', d.dol||null, userId, userId]
  );
  return (res as mysql.ResultSetHeader).insertId;
}

export async function updateNmsAgentDetail(
  id: number,
  d: { empId: string; daildeskId?: string; name: string; lob?: string; tl?: string;
       doj?: string; fhd?: string; status?: string; dol?: string },
  userId: number
) {
  await getMasmisPool().execute(
    `UPDATE db_masmis.nms_Agent_Details
     SET emp_id=?,daildesk_id=?,name=?,lob=?,tl=?,doj=?,fhd=?,status=?,dol=?,updated_by=?
     WHERE id=?`,
    [d.empId, d.daildeskId||null, d.name, d.lob||null, d.tl||null,
     d.doj||null, d.fhd||null, d.status||'Active', d.dol||null, userId, id]
  );
}

export async function deleteNmsAgentDetail(id: number) {
  await getMasmisPool().execute('DELETE FROM db_masmis.nms_Agent_Details WHERE id=?', [id]);
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

  // Prorated target: for the current month use days elapsed so far,
  // for past months use the full month (all days elapsed).
  const now          = new Date();
  const isCurrentMo  = now.getFullYear() === yr && now.getMonth() === mo;
  const daysElapsed  = isCurrentMo ? now.getDate() : daysInMo;
  const proratedTarget = Math.round(dailyTarget * daysElapsed);

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
        COALESCE(SUM(CASE WHEN LOWER(payment_status) = 'paid' THEN amount ELSE 0 END), 0) AS paid_revenue,
        COUNT(CASE WHEN LOWER(TRIM(COALESCE(final_status,''))) = 'rto' THEN 1 END) AS rto_count
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

  let totalOrders = 0, revenue = 0, paidOrders = 0, codOrders = 0, rtoCount = 0;
  for (const row of dateDetailRows as any[]) {
    totalOrders += Number(row.sale_count) || 0;
    revenue     += Number(row.revenue)    || 0;
    paidOrders  += Number(row.paid_count) || 0;
    codOrders   += Number(row.cod_count)  || 0;
    rtoCount    += Number(row.rto_count)  || 0;
  }

  const kpis = {
    workable, connected,
    connectedPct:   workable > 0         ? round1(connected   / workable         * 100) : 0,
    totalOrders,
    conversionPct:  connected > 0        ? round1(totalOrders / connected        * 100) : 0,
    revenue:        Math.round(revenue),
    target,
    proratedTarget,
    daysElapsed,
    daysInMo,
    achievementPct: proratedTarget > 0   ? round1(revenue     / proratedTarget   * 100) : 0,
    paidPct:        totalOrders > 0      ? round1(paidOrders  / totalOrders      * 100) : 0,
    codPct:         totalOrders > 0      ? round1(codOrders   / totalOrders      * 100) : 0,
    rtoCount,
    rtoPct:         totalOrders > 0      ? round1(rtoCount    / totalOrders      * 100) : 0,
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

  const dateTable = (dateDetailRows as any[]).map(r => {
    const saleCount = Number(r.sale_count) || 0;
    const paidCount = Number(r.paid_count) || 0;
    return {
      date:        serialToLabel(Number(r.serial)),
      saleCount,
      revenue:     Math.round(Number(r.revenue)     || 0),
      codCount:    Number(r.cod_count)    || 0,
      codRevenue:  Math.round(Number(r.cod_revenue)  || 0),
      paidCount,
      paidRevenue: Math.round(Number(r.paid_revenue) || 0),
      paidPct:     saleCount > 0 ? round1(paidCount / saleCount * 100) : 0,
    };
  });

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

// ─── Neemans APR Upload ────────────────────────────────────────────────────────

export interface NeemansAprRow {
  uniqueId: string; week: string; date: string; empName: string; empId: string;
  calls: number; ucaOb: number; lob: string; loginTime: string;
  parks: number; parkTime: string; avgPark: string; parksPerCall: number;
  wait: string; talk: string; dispo: string; pause: string;
  loginTs: string; logoutTs: string; acht: number;
  teamBriefing: string; lunch: string; tea: string; tea1: string;
  washr: string; totalBreak: string; netLogin: string;
  occuPct: number; weekShort: string; mtd: string;
  attendance: number; capping: string;
}

export async function uploadNeemansApr(rows: NeemansAprRow[], uploadedBy: number, batchId: string): Promise<number> {
  const sql = `INSERT INTO db_masmis.neemans_apr (
    unique_id, week, date, emp_name, emp_id, calls, uca_ob, lob,
    login_time, parks, park_time, avg_park, parks_per_call,
    wait, talk, dispo, pause, login_ts, logout_ts, acht,
    team_briefing, lunch, tea, tea1, washr, total_break, net_login,
    occu_pct, week_short, mtd, attendance, capping,
    uploaded_by, upload_batch_id
  ) VALUES ?`;
  const values = rows.map(r => [
    r.uniqueId, r.week, r.date, r.empName, r.empId,
    r.calls || 0, r.ucaOb || 0, r.lob, r.loginTime,
    r.parks || 0, r.parkTime, r.avgPark, r.parksPerCall || 0,
    r.wait, r.talk, r.dispo, r.pause, r.loginTs, r.logoutTs,
    r.acht || 0, r.teamBriefing, r.lunch, r.tea, r.tea1,
    r.washr, r.totalBreak, r.netLogin, r.occuPct || 0,
    r.weekShort, r.mtd, r.attendance || 0, r.capping,
    uploadedBy, batchId,
  ]);
  const [result] = await getMasmisPool().query(sql, [values]);
  return (result as mysql.ResultSetHeader).affectedRows;
}

// ─── Neemans APR Dashboard ─────────────────────────────────────────────────────

function hmsToSec(hms: string): number {
  if (!hms) return 0;
  const parts = String(hms).split(':').map(Number);
  if (parts.length === 3) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
  return 0;
}

function secToHms(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export async function getNeemansAprDashboard(startDate: string, endDate: string) {
  const [rows] = await getMasmisPool().execute(`
    SELECT
      emp_name, emp_id, lob, week_short, date,
      SUM(calls) AS total_calls,
      SUM(uca_ob) AS total_uca,
      SUM(parks) AS total_parks,
      SUM(attendance) AS attendance,
      AVG(CASE WHEN occu_pct > 0 AND occu_pct < 2 THEN occu_pct * 100 ELSE occu_pct END) AS avg_occu,
      AVG(acht) AS avg_acht,
      SUM(calls) AS calls,
      MIN(login_ts) AS first_login_raw,
      MAX(logout_ts) AS last_logout_raw,
      wait, talk, dispo, pause, net_login, total_break, lunch, capping
    FROM db_masmis.neemans_apr
    WHERE (? = '' OR ? = '') OR COALESCE(
        STR_TO_DATE(date, '%d-%b-%Y'),
        STR_TO_DATE(date, '%d-%b-%y'),
        STR_TO_DATE(date, '%Y-%m-%d')
      ) BETWEEN ? AND ?
    GROUP BY emp_name, emp_id, lob, week_short, date, wait, talk, dispo, pause, net_login, total_break, lunch, capping
    ORDER BY date ASC, emp_name ASC
  `, [startDate, endDate, startDate, endDate]);

  const agentMap = new Map<string, {
    empName: string; empId: string; lob: string;
    totalCalls: number; totalUca: number;
    totalTalkSec: number; totalWaitSec: number; totalPauseSec: number;
    totalNetLoginSec: number; totalBreakSec: number;
    totalAcht: number; ashtCount: number;
    totalOccu: number; occuCount: number;
    attendance: number;
    minLoginSec: number; maxLogoutSec: number;
  }>();

  const dateMap = new Map<string, { date: string; calls: number; agents: number }>();
  const lobMap  = new Map<string, number>();

  for (const r of rows as any[]) {
    const key = String(r.emp_id || r.emp_name);
    const date = String(r.date);

    // Agent aggregation
    if (!agentMap.has(key)) {
      agentMap.set(key, {
        empName: String(r.emp_name), empId: String(r.emp_id), lob: String(r.lob || ''),
        totalCalls: 0, totalUca: 0, totalTalkSec: 0, totalWaitSec: 0, totalPauseSec: 0,
        totalNetLoginSec: 0, totalBreakSec: 0, totalAcht: 0, ashtCount: 0,
        totalOccu: 0, occuCount: 0, attendance: 0,
        minLoginSec: Infinity, maxLogoutSec: 0,
      });
    }
    const a = agentMap.get(key)!;
    a.totalCalls += Number(r.total_calls) || 0;
    a.totalUca   += Number(r.total_uca)   || 0;
    a.attendance += Number(r.attendance)  || 0;
    a.totalTalkSec  += hmsToSec(String(r.talk  || '0:00:00'));
    a.totalWaitSec  += hmsToSec(String(r.wait  || '0:00:00'));
    a.totalPauseSec += hmsToSec(String(r.pause || '0:00:00'));
    a.totalNetLoginSec += hmsToSec(String(r.net_login   || '0:00:00'));
    a.totalBreakSec    += hmsToSec(String(r.total_break || '0:00:00'));
    if (r.avg_acht) { a.totalAcht += Number(r.avg_acht); a.ashtCount++; }
    if (r.avg_occu != null) { a.totalOccu += Number(r.avg_occu); a.occuCount++; }
    const loginSec  = hmsToSec(String(r.first_login_raw  || '0:00:00'));
    const logoutSec = hmsToSec(String(r.last_logout_raw  || '0:00:00'));
    if (loginSec  > 0 && loginSec  < a.minLoginSec)  a.minLoginSec  = loginSec;
    if (logoutSec > 0 && logoutSec > a.maxLogoutSec) a.maxLogoutSec = logoutSec;

    // Date aggregation
    if (!dateMap.has(date)) dateMap.set(date, { date, calls: 0, agents: 0 });
    const d = dateMap.get(date)!;
    d.calls  += Number(r.total_calls) || 0;
    d.agents += 1;

    // LOB aggregation
    const lob = String(r.lob || 'Unknown');
    lobMap.set(lob, (lobMap.get(lob) || 0) + (Number(r.total_calls) || 0));
  }

  const agentRows = [...agentMap.values()].map(a => ({
    empName:    a.empName,
    empId:      a.empId,
    lob:        a.lob,
    calls:      a.totalCalls,
    uca:        a.totalUca,
    attendance: a.attendance,
    talk:       secToHms(a.totalTalkSec),
    wait:       secToHms(a.totalWaitSec),
    pause:      secToHms(a.totalPauseSec),
    netLogin:   secToHms(a.totalNetLoginSec),
    totalBreak: secToHms(a.totalBreakSec),
    avgAcht:    a.ashtCount > 0 ? Math.round(a.totalAcht / a.ashtCount) : 0,
    avgOccu:    a.occuCount > 0 ? Math.round((a.totalOccu / a.occuCount) * 10) / 10 : 0,
    firstLogin:  a.minLoginSec  < Infinity ? secToHms(a.minLoginSec)  : '-',
    lastLogout:  a.maxLogoutSec > 0        ? secToHms(a.maxLogoutSec) : '-',
  })).sort((a, b) => b.calls - a.calls);

  const dateRows = [...dateMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  const lobRows  = [...lobMap.entries()].map(([lob, calls]) => ({ lob, calls })).sort((a, b) => b.calls - a.calls);

  // KPIs
  const totalCalls    = agentRows.reduce((s, r) => s + r.calls, 0);
  const totalAgents   = agentRows.length;
  const avgOccu       = agentRows.length > 0
    ? Math.round(agentRows.reduce((s, r) => s + r.avgOccu, 0) / agentRows.length * 10) / 10 : 0;
  const avgAcht       = agentRows.length > 0
    ? Math.round(agentRows.reduce((s, r) => s + r.avgAcht, 0) / agentRows.length) : 0;
  const totalAttendance = agentRows.reduce((s, r) => s + r.attendance, 0);

  return { kpis: { totalCalls, totalAgents, avgOccu, avgAcht, totalAttendance }, agentRows, dateRows, lobRows };
}

// ─── ABC Cart Snap ─────────────────────────────────────────────────────────────

export async function getAbcCartSnap(yyyyMm: string) {
  const [y, m] = yyyyMm.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const toSerial = (day: number) => Math.floor(Date.UTC(y, m - 1, day) / 86400000) + 25569;
  const startSerial = toSerial(1);
  const endSerial   = toSerial(daysInMonth);
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const startDateStr = `${y}-${pad2(m)}-01`;
  const endDateStr   = `${y}-${pad2(m)}-${pad2(daysInMonth)}`;
  const pool = getMasmisPool();
  const MON  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // SQL helper: HH:MM:SS string column → total seconds
  const toSecs = (col: string) =>
    `(CAST(SUBSTRING_INDEX(${col},':',1) AS UNSIGNED)*3600` +
    `+CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(${col},':',2),':',-1) AS UNSIGNED)*60` +
    `+CAST(SUBSTRING_INDEX(${col},':',-1) AS UNSIGNED))`;

  const [[allocRows],[saleRows],[aprCallRows],[aprAdvRows],[dispRows],[niRows],[niwpRows],[targetRows],[delivRows]] =
    await Promise.all([
      pool.query(`
        SELECT CAST(date AS UNSIGNED) AS serial,
          COUNT(CASE WHEN calling_status IN ('Connected','Not Connected','Pending To Call') THEN 1 END) AS workable,
          COUNT(CASE WHEN calling_status IN ('Connected','Not Connected') THEN 1 END)                   AS attempted,
          COUNT(CASE WHEN calling_status='Connected' THEN 1 END)                                        AS connected
        FROM db_masmis.neemans_allocation
        WHERE CAST(date AS UNSIGNED) BETWEEN ? AND ? AND CAST(date AS UNSIGNED)>0
        GROUP BY serial`, [startSerial, endSerial]),

      pool.query(`
        SELECT CAST(date AS UNSIGNED) AS serial,
          COUNT(CASE WHEN status='Sale Made' THEN 1 END)                                                        AS sale_count,
          COALESCE(SUM(CASE WHEN status IN ('Sale Made','PTP') THEN COALESCE(line_item_qty,0) END),0)           AS line_items,
          COUNT(CASE WHEN status='PTP' THEN 1 END)                                                              AS ptp_count,
          COALESCE(SUM(CASE WHEN status='PTP'       THEN COALESCE(amount,0) END),0)                            AS ptp_revenue,
          COALESCE(SUM(CASE WHEN status='Sale Made' THEN COALESCE(amount,0) END),0)                            AS revenue,
          COUNT(CASE WHEN status='Sale Made' AND UPPER(TRIM(payment_status))='COD' THEN 1 END)                  AS cod_count,
          COUNT(CASE WHEN status='Sale Made' AND UPPER(TRIM(payment_status)) NOT IN ('COD','') THEN 1 END)      AS prepaid_count
        FROM db_masmis.neemans_sale_raw
        WHERE CAST(date AS UNSIGNED) BETWEEN ? AND ? AND CAST(date AS UNSIGNED)>0
        GROUP BY serial`, [startSerial, endSerial]),

      pool.query(`
        SELECT DAY(COALESCE(STR_TO_DATE(date,'%d-%b-%Y'),STR_TO_DATE(date,'%d-%b-%y'),STR_TO_DATE(date,'%Y-%m-%d'))) AS day_num,
          SUM(calls) AS total_calls, COUNT(DISTINCT emp_id) AS agent_count
        FROM db_masmis.neemans_apr
        WHERE COALESCE(STR_TO_DATE(date,'%d-%b-%Y'),STR_TO_DATE(date,'%d-%b-%y'),STR_TO_DATE(date,'%Y-%m-%d')) BETWEEN ? AND ?
        GROUP BY day_num`, [startDateStr, endDateStr]),

      pool.query(`
        SELECT DAY(COALESCE(STR_TO_DATE(date,'%d-%b-%Y'),STR_TO_DATE(date,'%d-%b-%y'),STR_TO_DATE(date,'%Y-%m-%d'))) AS day_num,
          SUM(COALESCE(attendance,1))                                                                             AS login_count,
          SUM(calls)                                                                                              AS adv_calls,
          SUM(${toSecs('talk')})                                                                                  AS talk_secs,
          SUM(${toSecs('dispo')})                                                                                 AS wrap_secs,
          SUM(${toSecs('wait')})                                                                                  AS idle_secs,
          SUM(${toSecs('net_login')})                                                                             AS net_secs,
          SUM((CASE WHEN occu_pct>0 AND occu_pct<2 THEN occu_pct*100 ELSE occu_pct END)*COALESCE(attendance,1)) AS w_occu,
          SUM(COALESCE(acht,0)*COALESCE(attendance,1))                                                           AS w_aht
        FROM db_masmis.neemans_apr
        WHERE COALESCE(STR_TO_DATE(date,'%d-%b-%Y'),STR_TO_DATE(date,'%d-%b-%y'),STR_TO_DATE(date,'%Y-%m-%d')) BETWEEN ? AND ?
        GROUP BY day_num`, [startDateStr, endDateStr]),

      pool.query(`
        SELECT CAST(date AS UNSIGNED) AS serial, COALESCE(sub_scenario1,'') AS name, COUNT(*) AS cnt
        FROM db_masmis.neemans_allocation
        WHERE calling_status='Connected' AND sub_scenario1 IS NOT NULL AND sub_scenario1!=''
          AND CAST(date AS UNSIGNED) BETWEEN ? AND ? AND CAST(date AS UNSIGNED)>0
        GROUP BY serial, sub_scenario1`, [startSerial, endSerial]),

      pool.query(`
        SELECT CAST(date AS UNSIGNED) AS serial, COALESCE(sub_scenario2,'Unknown') AS name, COUNT(*) AS cnt
        FROM db_masmis.neemans_allocation
        WHERE sub_scenario1='Not Interested'
          AND CAST(date AS UNSIGNED) BETWEEN ? AND ? AND CAST(date AS UNSIGNED)>0
        GROUP BY serial, sub_scenario2`, [startSerial, endSerial]),

      pool.query(`
        SELECT CAST(date AS UNSIGNED) AS serial, COALESCE(sub_scenario1,'Unknown') AS name, COUNT(*) AS cnt
        FROM db_masmis.neemans_allocation
        WHERE sub_scenario2='Not Interested-Without pitched'
          AND CAST(date AS UNSIGNED) BETWEEN ? AND ? AND CAST(date AS UNSIGNED)>0
        GROUP BY serial, sub_scenario1`, [startSerial, endSerial]),

      pool.query(`SELECT target FROM db_masmis.neemans_month_targets WHERE month=? LIMIT 1`, [yyyyMm]),

      pool.query(`
        SELECT CAST(date AS UNSIGNED) AS serial,
          COALESCE(NULLIF(TRIM(current_status),''), 'Unknown') AS deliv_status,
          COUNT(*) AS cnt
        FROM db_masmis.neemans_sale_raw
        WHERE CAST(date AS UNSIGNED) BETWEEN ? AND ? AND CAST(date AS UNSIGNED)>0
        GROUP BY serial, deliv_status`, [startSerial, endSerial]),
    ]) as any[];

  // Build lookup maps
  const allocMap = new Map<number, any>();
  for (const r of allocRows as any[]) allocMap.set(Number(r.serial), r);

  const saleMap = new Map<number, any>();
  for (const r of saleRows as any[]) saleMap.set(Number(r.serial), r);

  const aprCallMap = new Map<number, any>();
  for (const r of aprCallRows as any[]) if (r.day_num) aprCallMap.set(Number(r.day_num), r);

  const aprAdvMap  = new Map<number, any>();
  for (const r of aprAdvRows as any[]) if (r.day_num) aprAdvMap.set(Number(r.day_num), r);

  function buildDispMap(rows: any[]) {
    const map = new Map<number, Map<string, number>>();
    for (const r of rows) {
      const s = Number(r.serial);
      if (!map.has(s)) map.set(s, new Map());
      map.get(s)!.set(String(r.name), Number(r.cnt || 0));
    }
    return map;
  }
  const connDispMap = buildDispMap(dispRows  as any[]);
  const niMap       = buildDispMap(niRows    as any[]);
  const niwpMap     = buildDispMap(niwpRows  as any[]);

  // Delivery status map: serial → status → count
  const delivMap = new Map<number, Record<string, number>>();
  for (const r of delivRows as any[]) {
    const s = Number(r.serial);
    if (!delivMap.has(s)) delivMap.set(s, {});
    delivMap.get(s)![String(r.deliv_status)] = Number(r.cnt || 0);
  }

  const totalTarget = Number((targetRows as any[])[0]?.target ?? 0);

  // Per-day raw data
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const day    = i + 1;
    const serial = toSerial(day);
    const al = allocMap.get(serial)    || {};
    const sl = saleMap.get(serial)     || {};
    const ca = aprCallMap.get(day)     || {};
    const ad = aprAdvMap.get(day)      || {};
    return {
      day, serial,
      label: `${pad2(day)}-${MON[m-1]}-${String(y).slice(-2)}`,
      delivCounts:  delivMap.get(serial) ?? {},
      workable:     Number(al.workable     ?? 0),
      attempted:    Number(al.attempted    ?? 0),
      connected:    Number(al.connected    ?? 0),
      totalCalls:   Number(ca.total_calls  ?? 0),
      agentCount:   Number(ca.agent_count  ?? 0),
      saleCount:    Number(sl.sale_count   ?? 0),
      lineItems:    Number(sl.line_items   ?? 0),
      ptpCount:     Number(sl.ptp_count    ?? 0),
      ptpRevenue:   Number(sl.ptp_revenue  ?? 0),
      revenue:      Number(sl.revenue      ?? 0),
      codCount:     Number(sl.cod_count    ?? 0),
      prepaidCount: Number(sl.prepaid_count ?? 0),
      loginCount:   Number(ad.login_count  ?? 0),
      advCalls:     Number(ad.adv_calls    ?? 0),
      talkSecs:     Number(ad.talk_secs    ?? 0),
      wrapSecs:     Number(ad.wrap_secs    ?? 0),
      idleSecs:     Number(ad.idle_secs    ?? 0),
      netSecs:      Number(ad.net_secs     ?? 0),
      wOccu:        Number(ad.w_occu       ?? 0),
      wAht:         Number(ad.w_aht        ?? 0),
    };
  });

  const secsToHms = (s: number) => {
    if (s <= 0) return '0:00:00';
    const h = Math.floor(s / 3600), min = Math.floor((s % 3600) / 60), sec = Math.round(s % 60);
    return `${h}:${pad2(min)}:${pad2(sec)}`;
  };

  function agg(slice: typeof days) {
    const workable    = slice.reduce((s,d) => s+d.workable,   0);
    const attempted   = slice.reduce((s,d) => s+d.attempted,  0);
    const connected   = slice.reduce((s,d) => s+d.connected,  0);
    const totalCalls  = slice.reduce((s,d) => s+d.totalCalls, 0);
    const agentDays   = slice.reduce((s,d) => s+d.agentCount, 0);
    const saleCount   = slice.reduce((s,d) => s+d.saleCount,  0);
    const lineItems   = slice.reduce((s,d) => s+d.lineItems,  0);
    const ptpCount    = slice.reduce((s,d) => s+d.ptpCount,   0);
    const ptpRevenue  = slice.reduce((s,d) => s+d.ptpRevenue, 0);
    const revenue     = slice.reduce((s,d) => s+d.revenue,    0);
    const codCount    = slice.reduce((s,d) => s+d.codCount,   0);
    const prepaid     = slice.reduce((s,d) => s+d.prepaidCount,0);
    const loginCount  = slice.reduce((s,d) => s+d.loginCount, 0);
    const advCalls    = slice.reduce((s,d) => s+d.advCalls,   0);
    const talkSecs    = slice.reduce((s,d) => s+d.talkSecs,   0);
    const wrapSecs    = slice.reduce((s,d) => s+d.wrapSecs,   0);
    const idleSecs    = slice.reduce((s,d) => s+d.idleSecs,   0);
    const netSecs     = slice.reduce((s,d) => s+d.netSecs,    0);
    const wOccu       = slice.reduce((s,d) => s+d.wOccu,      0);
    const wAht        = slice.reduce((s,d) => s+d.wAht,       0);
    const target      = daysInMonth > 0 ? Math.round(totalTarget * slice.length / daysInMonth) : 0;
    const r1 = (n: number) => Math.round(n * 10) / 10;
    const totalSales  = saleCount;
    return {
      workable, attempted, connected,
      connectedPct:    attempted  >0 ? r1(connected /attempted  *100) : 0,
      callPerAgent:    agentDays  >0 ? Math.round(totalCalls/agentDays) : 0,
      saleCount, lineItems, ptpCount, ptpRevenue,
      conversionPct:   connected  >0 ? r1(saleCount /connected  *100) : 0,
      revenue, target,
      achievementPct:  target     >0 ? r1(revenue   /target     *100) : 0,
      asp:             saleCount  >0 ? Math.round(revenue/saleCount)   : 0,
      salePerAgent:    agentDays  >0 ? r1(saleCount /agentDays)        : 0,
      revenuePerAgent: agentDays  >0 ? Math.round(revenue/agentDays)   : 0,
      loginCount,
      talktime:  secsToHms(loginCount>0 ? Math.round(talkSecs/loginCount) : 0),
      wrap:      secsToHms(loginCount>0 ? Math.round(wrapSecs/loginCount) : 0),
      idle:      secsToHms(loginCount>0 ? Math.round(idleSecs/loginCount) : 0),
      netLogin:  secsToHms(loginCount>0 ? Math.round(netSecs /loginCount) : 0),
      avgOccu:   loginCount>0 ? r1(wOccu/loginCount) : 0,
      avgAht:    loginCount>0 ? Math.round(wAht/loginCount) : 0,
      attemptPerAgent: loginCount>0 ? Math.round(advCalls/loginCount) : 0,
      totalSales, codCount, prepaid,
      prepaidPct: totalSales>0 ? +((prepaid/totalSales)*100).toFixed(2) : 0,
    };
  }

  const numWeeks = Math.ceil(daysInMonth / 7);
  const mtd   = agg(days);
  const weeks  = Array.from({ length: numWeeks }, (_, i) => ({
    label: `Week-${i+1}`,
    ...agg(days.filter(d => d.day > i*7 && d.day <= (i+1)*7)),
  }));
  const daily  = days.map(d => ({ label: d.label, ...agg([d]) }));

  // Aggregate disposition sections
  function aggDisp(dmap: Map<number, Map<string, number>>) {
    const nameSet = new Set<string>();
    for (const dm of dmap.values()) for (const n of dm.keys()) nameSet.add(n);
    const names = [...nameSet].sort();
    const get   = (serial: number, name: string) => dmap.get(serial)?.get(name) ?? 0;
    const mtdTotal  = names.reduce((s,n) => s + days.reduce((ss,d) => ss+get(d.serial,n),0), 0);
    const wkTotals  = Array.from({length:numWeeks},(_,i) =>
      names.reduce((s,n)=>s+days.filter(d=>d.day>i*7&&d.day<=(i+1)*7).reduce((ss,d)=>ss+get(d.serial,n),0),0));
    const dayTotals = days.map(d => names.reduce((s,n)=>s+get(d.serial,n),0));
    return {
      names,
      rows: names.map(name => {
        const mtdCnt   = days.reduce((s,d)=>s+get(d.serial,name),0);
        const wkCnts   = Array.from({length:numWeeks},(_,i)=>
          days.filter(d=>d.day>i*7&&d.day<=(i+1)*7).reduce((s,d)=>s+get(d.serial,name),0));
        const dayCnts  = days.map(d=>get(d.serial,name));
        return { name, mtd:mtdCnt, mtdPct: mtdTotal>0 ? +((mtdCnt/mtdTotal)*100).toFixed(1):0,
                 weeks:wkCnts, daily:dayCnts };
      }),
      mtdTotal, weekTotals:wkTotals, dailyTotals:dayTotals,
    };
  }

  // Aggregate delivery status counts
  function aggDeliv(slice: typeof days) {
    const counts: Record<string, number> = {};
    for (const d of slice) {
      for (const [s, cnt] of Object.entries(d.delivCounts)) {
        counts[s] = (counts[s] || 0) + cnt;
      }
    }
    const total = Object.values(counts).reduce((s, n) => s + n, 0);
    return { counts, total };
  }

  return {
    mtd, weeks, daily, totalTarget,
    connectedDisp: aggDisp(connDispMap),
    notInterested: aggDisp(niMap),
    notIntWp:      aggDisp(niwpMap),
    deliveryStatus: {
      mtd:   aggDeliv(days),
      weeks: Array.from({ length: numWeeks }, (_, i) => ({
        label: `Week-${i + 1}`,
        ...aggDeliv(days.filter(d => d.day > i * 7 && d.day <= (i + 1) * 7)),
      })),
      daily: days.map(d => ({ label: d.label, ...aggDeliv([d]) })),
    },
  };
}

export async function getNeemansAprExport(startDate: string, endDate: string) {
  const [rows] = await getMasmisPool().execute(`
    SELECT unique_id, week, date, emp_name, emp_id, calls, uca_ob, lob,
           login_time, parks, park_time, avg_park, parks_per_call,
           wait, talk, dispo, pause, login_ts, logout_ts, acht,
           team_briefing, lunch, tea, tea1, washr, total_break, net_login,
           occu_pct, week_short, mtd, attendance, capping
    FROM db_masmis.neemans_apr
    WHERE (? = '' OR ? = '') OR COALESCE(
        STR_TO_DATE(date, '%d-%b-%Y'),
        STR_TO_DATE(date, '%d-%b-%y'),
        STR_TO_DATE(date, '%Y-%m-%d')
      ) BETWEEN ? AND ?
    ORDER BY date ASC, emp_name ASC
    LIMIT 500000
  `, [startDate, endDate, startDate, endDate]);
  return rows;
}
