import { querySource } from '../../lib/sourceDb';

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
