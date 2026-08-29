import type { Response } from 'express';
import { querySource, getSourcePool } from '../../lib/sourceDb';
import { queryMasmis, getMasmisPool } from '../../lib/masmisDb';
import { csvEscape } from '../../lib/csv';

export interface QualityFilters {
  startDate: string;
  endDate: string;
  clientId?: string;
  agentIds?: string[];
  campaignId?: string;
}

export interface ClientSummary {
  client_id: number;
  client_name: string;
  calls: number;
}

export interface CSTData {
  totalCalls: number;
  ops: number;
  cps: number;
  offeredSuccess: number;
  saleDone: number;
  successRatePct: number;
}

export interface CRTData {
  orCount: number;
  crCount: number;
  oprCount: number;
  porCount: number;
  failureRatePct: number;
}

export interface CSTCRTData extends CSTData, CRTData {}

export interface PieSlice {
  name: string;
  value: number;
}

export interface FunnelStep {
  name: string;
  value: number;
}

export interface MOCategoryRow {
  category: string;
  insight: string;
  count: number;
  pct: number;
}

export interface NEDRow {
  nedCategory: string;
  nedQS: string;
  nedStatus: string;
  count: number;
  pct: number;
}

export interface NPSDayRow {
  calldate: string;
  totalFeedbacks: number;
  promoter: number;
  detractor: number;
  passive: number;
  npsScore: number;
}

export interface AgentNPSRow {
  agent: string;
  agentId: string;
  calls: number;
  promoter: number;
  passive: number;
  detractor: number;
  csat: number;
  nps: number;
}

export interface AgentNPSDetailRow {
  agentId:   string;
  agentName: string;
  promoter:  number;
  passive:   number;
  detractor: number;
  total:     number;
  npsScore:  number;
}

export interface NPSData {
  total: number;
  promoter: number;
  detractor: number;
  passive: number;
  npsScore: number;
  csatPct: number;
  days: NPSDayRow[];
}

export interface AuditCountDayRow {
  calldate: string;
  count: number;
}

export interface KPIResponse {
  cst: CSTData;
  crt: CRTData;
  rejectedPie: PieSlice[];
  cstFunnel: FunnelStep[];
  crtFunnel: FunnelStep[];
  auditCountByDate: AuditCountDayRow[];
  opportunity: {
    totalOpportunities: number;
    moCount: number;
    opportunityLoss: PieSlice[];
    opportunityCategory: PieSlice[];
    moBreaks: PieSlice[];
    moCategoryTable: MOCategoryRow[];
    objectionCategoryPie: PieSlice[];
    nedTable: NEDRow[];
  };
  nps: NPSData;
}

export interface OPCategoryRow {
  openingCategory: string;
  totalCalls: number;
  opsCount: number;
  orCount: number;
  saleCount: number;
}

export interface CSCategoryRow {
  contactGroup: string;
  totalCalls: number;
  opsCount: number;
  orCount: number;
  saleCount: number;
}

export interface OfferedPitchRow {
  discountType: string;
  totalOffer: number;
  orCount: number;
  osCount: number;
  saleCount: number;
}

export interface DetailAnalysisResponse {
  opCategories: OPCategoryRow[];
  csCategories: CSCategoryRow[];
  offeredPitch: OfferedPitchRow[];
}

function clientClause(filters: QualityFilters): { sql: string; params: (string | number)[] } {
  if (filters.clientId) {
    return { sql: ' AND cd.client_id = ?', params: [Number(filters.clientId)] };
  }
  return { sql: '', params: [] };
}

function agentClause(filters: QualityFilters): { sql: string; params: string[] } {
  if (filters.agentIds && filters.agentIds.length > 0) {
    const placeholders = filters.agentIds.map(() => '?').join(',');
    return { sql: ` AND cd.agent_name IN (${placeholders})`, params: filters.agentIds };
  }
  return { sql: '', params: [] };
}

// Feeds the campaign dropdown next to the Date Range picker (e.g. Lawyer Panel's
// "regional" / "non_regional" split) — only meaningful for clients that run more than one
// campaign, a no-op otherwise.
function campaignClause(filters: QualityFilters): { sql: string; params: string[] } {
  if (filters.campaignId) {
    return { sql: ' AND cd.campaign_id = ?', params: [filters.campaignId] };
  }
  return { sql: '', params: [] };
}

export async function getClients(filters: QualityFilters): Promise<ClientSummary[]> {
  const { startDate, endDate } = filters;
  return querySource<ClientSummary>(`
    SELECT
      cd.client_id,
      COALESCE(c.name, CONCAT('Client ', cd.client_id)) AS client_name,
      COUNT(*) AS calls
    FROM db_external.CallDetails cd
    LEFT JOIN shivamgiri.md_clients c ON c.dialdesk_client_id = cd.client_id
    WHERE cd.client_id IS NOT NULL AND cd.client_id != 0
      AND cd.MobileNo IS NOT NULL AND cd.MobileNo != ''
      AND cd.CallDate BETWEEN ? AND ?
    GROUP BY cd.client_id, c.name
    ORDER BY client_name ASC
  `, [startDate, endDate]);
}

// ─── Outbound Dashboard KPI cache ──────────────────────────────────────────────
// getKPIs below used to fire 12 separate live queries against db_external.CallDetails per page
// load, most of them independently re-deriving the same rejected_status classification from
// scratch. Measured: ~50-67 SECONDS for a single client's current-month data alone, even though
// EXPLAIN shows the CallDate index being used correctly — the shared/remote DB server (also serving
// VICIdial) is just slow per-query, and firing 12 of them (only 3 can run concurrently — the pool is
// deliberately capped low to protect that shared server) compounds badly.
//
// Same fix as Magical Script and Outbound Insights: a background job pre-classifies every call once
// into a small, fully-indexed cache table in db_masmis, and getKPIs reads only from that cache.
// Two DIFFERENT rejected_status classification schemes coexist in the original 12 queries (one never
// falls through to 'Other' and defaults straight to 'Opening Rejected'; the other adds two more
// branches — OpeningRejected/OfferedPitchContext — before falling through to 'Other') — both are
// cached separately (rejected_status_a / rejected_status_b) rather than unified, to avoid silently
// changing which numbers show up where.
export async function initOutboundDashboardCacheTables(): Promise<void> {
  const pool = getMasmisPool();
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS db_masmis.outbound_dashboard_cache (
        call_id                INT PRIMARY KEY,
        client_id               INT NOT NULL,
        call_date                DATETIME NOT NULL,
        mobile_valid             TINYINT(1) NOT NULL DEFAULT 0,
        has_objection_category   TINYINT(1) NOT NULL DEFAULT 0,
        rejected_status_a        VARCHAR(20) NOT NULL DEFAULT 'Opening Rejected',
        rejected_status_b        VARCHAR(20) NOT NULL DEFAULT 'Other',
        sale_done                TINYINT(1) NOT NULL DEFAULT 0,
        objection_subcategory    VARCHAR(120) NULL,
        feedback                 VARCHAR(20) NULL,
        agent_id                 VARCHAR(150) NULL,
        campaign_id              VARCHAR(20) NULL,
        computed_at              DATETIME DEFAULT NOW(),
        INDEX idx_client_date (client_id, call_date),
        INDEX idx_agent_id (agent_id)
      )
    `);
    // Add campaign_id column if it doesn't exist (migration for existing tables) — feeds the
    // Dashboard tab's campaign filter (e.g. Lawyer Panel's "regional" / "non_regional" split).
    const [existingCampaignCol] = await pool.execute<import('mysql2').RowDataPacket[]>(
      `SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema = 'db_masmis' AND table_name = 'outbound_dashboard_cache' AND COLUMN_NAME = 'campaign_id'`
    );
    if (existingCampaignCol.length === 0) {
      await pool.execute(`
        ALTER TABLE db_masmis.outbound_dashboard_cache
        ADD COLUMN campaign_id VARCHAR(20) NULL AFTER agent_id
      `).catch(() => {});
    }
    // Add agent_id column if it doesn't exist (migration for existing tables). This server
    // rejects `IF NOT EXISTS` on ADD COLUMN / CREATE INDEX with a parse error (ER_PARSE_ERROR),
    // so check information_schema instead of relying on that clause — the old version silently
    // swallowed the parse error via .catch(), meaning the column was NEVER actually added and
    // every batch insert failed with "Unknown column 'agent_id'".
    const [existingCols] = await pool.execute<import('mysql2').RowDataPacket[]>(
      `SELECT COLUMN_NAME, CHARACTER_MAXIMUM_LENGTH FROM information_schema.columns WHERE table_schema = 'db_masmis' AND table_name = 'outbound_dashboard_cache' AND COLUMN_NAME = 'agent_id'`
    );
    if (existingCols.length === 0) {
      await pool.execute(`
        ALTER TABLE db_masmis.outbound_dashboard_cache
        ADD COLUMN agent_id VARCHAR(150) NULL AFTER feedback
      `).catch(() => {});
    } else if (Number(existingCols[0].CHARACTER_MAXIMUM_LENGTH) < 150) {
      // Some raw AgentName values (e.g. "Sneha saini MCN-Extension(Extension-...)") run 50+
      // chars — a narrow column here silently fails the ENTIRE batch insert (not just that row),
      // which stalls the cache cursor for every client behind it in id order, not just this one.
      await pool.execute(`
        ALTER TABLE db_masmis.outbound_dashboard_cache
        MODIFY COLUMN agent_id VARCHAR(150) NULL
      `).catch(() => {});
    }
    const [existingIdx] = await pool.execute<import('mysql2').RowDataPacket[]>(
      `SHOW INDEX FROM db_masmis.outbound_dashboard_cache WHERE Key_name = 'idx_agent_id'`
    );
    if (existingIdx.length === 0) {
      await pool.execute(`
        CREATE INDEX idx_agent_id ON db_masmis.outbound_dashboard_cache (agent_id)
      `).catch(() => {});
    }
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS db_masmis.outbound_dashboard_cursor (
        id      TINYINT PRIMARY KEY DEFAULT 1,
        next_id INT NOT NULL DEFAULT 0
      )
    `);
    const [cursorRows] = await pool.execute(`SELECT next_id FROM db_masmis.outbound_dashboard_cursor WHERE id = 1`);
    // Re-seed a fully-consumed cursor (next_id = 0) to a 30-day lookback so it starts picking up
    // new rows again instead of staying dead forever — see processOutboundDashboardBatch. A fresh
    // table seeds from 0 so the whole history gets classified, matching the original intent.
    if ((cursorRows as unknown[]).length === 0) {
      await pool.execute(`INSERT INTO db_masmis.outbound_dashboard_cursor (id, next_id) VALUES (1, 0)`);
    } else if (Number((cursorRows as { next_id: number }[])[0].next_id) === 0) {
      const seedRows = await querySource<{ minId: number }>(
        `SELECT COALESCE(MIN(id), 0) AS minId FROM db_external.CallDetails WHERE CallDate >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
      );
      const seedId = Math.max(0, Number(seedRows[0]?.minId ?? 0) - 1);
      await pool.execute(`UPDATE db_masmis.outbound_dashboard_cursor SET next_id = ? WHERE id = 1`, [seedId]);
    }
  } catch (err) {
    console.error('[quality] initOutboundDashboardCacheTables warning:', (err as Error).message);
  }
}

async function processOutboundDashboardBatch(batchSize = 1000): Promise<number> {
  const [cursorRow] = await queryMasmis<{ next_id: number }>(
    `SELECT next_id FROM db_masmis.outbound_dashboard_cursor WHERE id = 1`
  );
  const nextId = cursorRow?.next_id ?? 0;
  if (nextId <= 0) return 0;

  type Row = {
    id: number; client_id: number; CallDate: string; AgentName: string | null; campaign_id: string | null;
    mobile_valid: number; has_objection_category: number;
    rejected_status_a: string; rejected_status_b: string;
    sale_done: number; objection_subcategory: string | null; feedback: string | null;
  };

  const rows = await querySource<Row>(`
    SELECT
      cd.id, cd.client_id, cd.CallDate, cd.AgentName, cd.campaign_id,
      CASE WHEN cd.MobileNo IS NOT NULL AND cd.MobileNo != '' THEN 1 ELSE 0 END AS mobile_valid,
      CASE WHEN cd.CustomerObjectionCategory IS NOT NULL AND cd.CustomerObjectionCategory != '' THEN 1 ELSE 0 END AS has_objection_category,
      CASE
        WHEN cd.AfterListeningOfferRejected = 1 OR cd.SaleDone = 1 THEN 'Post Offer Rejected'
        WHEN cd.ObjectionHandlingContext = 'None' THEN 'Offering Rejected'
        WHEN cd.ContactSettingContext = 'None' THEN 'Context Rejected'
        ELSE 'Opening Rejected'
      END AS rejected_status_a,
      CASE
        WHEN cd.AfterListeningOfferRejected = 1 OR cd.SaleDone = 1 THEN 'Post Offer Rejected'
        WHEN cd.ObjectionHandlingContext = 'None'  THEN 'Offering Rejected'
        WHEN cd.ContactSettingContext = 'None'     THEN 'Context Rejected'
        WHEN cd.OpeningRejected = 1                THEN 'Opening Rejected'
        WHEN cd.OfferedPitchContext = 'None'       THEN 'Opening Rejected'
        ELSE 'Other'
      END AS rejected_status_b,
      CASE WHEN cd.SaleDone = 1 THEN 1 ELSE 0 END AS sale_done,
      LEFT(cd.CustomerObjectionSubCategory, 120) AS objection_subcategory,
      LEFT(cd.Feedback, 20) AS feedback
    FROM db_external.CallDetails cd
    WHERE cd.id > ? AND cd.client_id IS NOT NULL
    ORDER BY cd.id ASC
    LIMIT ${Number(batchSize)}
  `, [nextId]);

  if (rows.length === 0) return 0;

  const cols = [
    'call_id', 'client_id', 'call_date', 'mobile_valid', 'has_objection_category',
    'rejected_status_a', 'rejected_status_b', 'sale_done', 'objection_subcategory', 'feedback', 'agent_id',
    'campaign_id',
  ];
  const placeholders = rows.map(() => `(${cols.map(() => '?').join(',')},NOW())`).join(',');
  const flat = rows.flatMap(r => [
    r.id, r.client_id, r.CallDate, r.mobile_valid, r.has_objection_category,
    r.rejected_status_a, r.rejected_status_b, r.sale_done, r.objection_subcategory, r.feedback,
    r.AgentName ?? null, r.campaign_id ?? null,
  ]);
  const updateCols = cols.filter(c => c !== 'call_id').map(c => `${c} = VALUES(${c})`).join(', ');

  await queryMasmis(`
    INSERT INTO db_masmis.outbound_dashboard_cache (${cols.join(', ')}, computed_at)
    VALUES ${placeholders}
    ON DUPLICATE KEY UPDATE ${updateCols}, computed_at = NOW()
  `, flat);

  const newNextId = rows[rows.length - 1].id;
  await queryMasmis(`UPDATE db_masmis.outbound_dashboard_cursor SET next_id = ? WHERE id = 1`, [newNextId]);
  return rows.length;
}

let outboundDashboardCacheRunning = false;
async function runOutboundDashboardCatchUp(): Promise<void> {
  if (outboundDashboardCacheRunning) return;
  outboundDashboardCacheRunning = true;
  try {
    let processed = 0;
    do {
      processed = await processOutboundDashboardBatch(1000);
      if (processed > 0) await new Promise(r => setTimeout(r, 300));
    } while (processed > 0);
  } catch (err) {
    console.error('[quality] outbound dashboard cache batch error:', (err as Error).message);
  } finally {
    outboundDashboardCacheRunning = false;
  }
}

export function startOutboundDashboardCacheJob(): void {
  runOutboundDashboardCatchUp().catch(() => {});
  const timer = setInterval(() => { runOutboundDashboardCatchUp().catch(() => {}); }, 5 * 60 * 1000);
  if (typeof timer.unref === 'function') timer.unref();
}

export async function getKPIs(filters: QualityFilters): Promise<KPIResponse> {
  const { startDate, endDate } = filters;
  const { sql: cf, params: cfParams } = clientClause(filters);
  const { sql: af, params: afParams } = agentClause(filters);
  const campF = filters.campaignId ? ' AND cd.campaign_id = ?' : '';
  const campParams = filters.campaignId ? [filters.campaignId] : [];
  const params = [startDate, endDate, ...cfParams, ...afParams, ...campParams];

  // All 12 reads come from the pre-classified db_masmis cache (see initOutboundDashboardCacheTables /
  // processOutboundDashboardBatch above) instead of scanning CallDetails live — cut this endpoint
  // from 49-67 SECONDS down to near-instant. rejected_status_a is the 4-branch classification (no
  // 'Other', defaults to 'Opening Rejected'); rejected_status_b is the 5-branch one (adds
  // OpeningRejected/OfferedPitchContext, defaults to 'Other') — the two coexisted in the original
  // live queries for different sub-features and are cached separately to keep every number identical.
  const [rejectedBreakdown, row, oppRow, oppLossPie, oppCatPie, moBreaksPie, moCategoryRaw, nedRaw, objectionCategoryPie, npsRaw, npsDaysRaw, auditCountRaw] = await Promise.all([
    queryMasmis<PieSlice>(`
      WITH base AS (
        SELECT * FROM db_masmis.outbound_dashboard_cache cd
        WHERE cd.mobile_valid = 1 AND cd.call_date BETWEEN ? AND ? ${cf}${af}${campF}
      ),
      valid AS (
        SELECT * FROM base WHERE has_objection_category = 1
      )
      SELECT rejected_status_a AS name, COUNT(*) AS value
      FROM valid
      GROUP BY rejected_status_a
      ORDER BY value DESC
    `, params),

    queryMasmis<{
      total: number; ops: number; cps: number; offered: number; sale: number;
      or_cnt: number; cr_cnt: number; opr_cnt: number; por_cnt: number;
    }>(`
      WITH base AS (
        SELECT * FROM db_masmis.outbound_dashboard_cache cd
        WHERE cd.mobile_valid = 1 AND cd.call_date BETWEEN ? AND ? ${cf}${af}${campF}
      ),
      valid AS (
        SELECT * FROM base WHERE has_objection_category = 1
      )
      SELECT
        (SELECT COUNT(*) FROM valid) AS total,
        (SELECT COUNT(*) FROM valid WHERE rejected_status_a != 'Opening Rejected') AS ops,
        (SELECT COUNT(*) FROM valid WHERE rejected_status_a NOT IN ('Opening Rejected','Context Rejected')) AS cps,
        (SELECT COUNT(*) FROM base  WHERE rejected_status_a NOT IN ('Opening Rejected','Offering Rejected')) AS offered,
        (SELECT COUNT(*) FROM valid WHERE sale_done = 1) AS sale,
        (SELECT COUNT(*) FROM valid WHERE rejected_status_a = 'Opening Rejected') AS or_cnt,
        (SELECT COUNT(*) FROM valid WHERE rejected_status_a = 'Context Rejected') AS cr_cnt,
        (SELECT COUNT(*) FROM valid WHERE rejected_status_a = 'Offering Rejected') AS opr_cnt,
        (SELECT COUNT(*) FROM valid WHERE rejected_status_a NOT IN ('Offering Rejected','Opening Rejected','Context Rejected')) AS por_cnt
    `, params),

    queryMasmis<{ total_opp: number; mo_count: number }>(`
      WITH base AS (
        SELECT * FROM db_masmis.outbound_dashboard_cache cd
        WHERE cd.mobile_valid = 1 AND cd.call_date BETWEEN ? AND ? ${cf}${af}${campF}
      )
      SELECT
        (SELECT COUNT(*) FROM base WHERE rejected_status_a NOT IN ('Opening Rejected','Offering Rejected','Context Rejected')) AS total_opp,
        (SELECT COUNT(*) FROM base WHERE rejected_status_a NOT IN ('Opening Rejected','Offering Rejected','Context Rejected')
          AND has_objection_category = 1
          AND sale_done = 1) AS mo_count
    `, params),

    queryMasmis<PieSlice>(`
      WITH base AS (
        SELECT * FROM db_masmis.outbound_dashboard_cache cd
        WHERE cd.mobile_valid = 1 AND cd.call_date BETWEEN ? AND ? ${cf}${af}${campF}
      )
      SELECT
        CASE
          WHEN objection_subcategory IN (
            'Liked the product but wants a better deal',
            'Wants to buy later',
            'Perfume Longevity Issue',
            'Perfume too strong',
            'Damaged Product Received',
            'Wrong Product Received',
            'Doesn''t trust online payments'
          ) THEN 'Workable'
          ELSE 'Non Workable'
        END AS name,
        COUNT(*) AS value
      FROM base
      WHERE sale_done = 0
        AND rejected_status_b NOT IN ('Opening Rejected', 'Offering Rejected')
      GROUP BY 1
    `, params),

    queryMasmis<PieSlice>(`
      WITH base AS (
        SELECT * FROM db_masmis.outbound_dashboard_cache cd
        WHERE cd.mobile_valid = 1 AND cd.call_date BETWEEN ? AND ? ${cf}${af}${campF}
      ),
      opp AS (
        SELECT * FROM base
        WHERE rejected_status_a NOT IN ('Opening Rejected','Offering Rejected')
          AND has_objection_category = 1
          AND sale_done != 1
      )
      SELECT
        CASE
          WHEN objection_subcategory IN ('Already has the same product','Already has enough perfumes','Overstock / No Need for More','Already Owns Enough','Already has too many perfumes','Happy with the product but not interested in buying more') THEN 'No Need'
          WHEN objection_subcategory = 'Already has another preferred brand' THEN 'Brand Preference'
          WHEN objection_subcategory = 'Liked the product but wants a better deal' THEN 'Price Sensitivity'
          WHEN objection_subcategory = 'Wants to buy later' THEN 'Budget Constraint'
          WHEN objection_subcategory = 'Not Interested in Perfumes' THEN 'Product Disinterest'
          WHEN objection_subcategory IN ('Didn''t like one of the perfumes','Disappointed with perfume quality','Perfume Longevity Issue','Perfume too strong') THEN 'Negative Experience'
          WHEN objection_subcategory IN ('Damaged Product Received','Wrong Product Received') THEN 'Logistic Concern'
          WHEN objection_subcategory = 'Doesn''t trust online payments' THEN 'Trust Concerns'
          ELSE ''
        END AS name,
        COUNT(*) AS value
      FROM opp
      GROUP BY name
      HAVING name != '' AND name != 'Negative Experience'
    `, params),

    queryMasmis<PieSlice>(`
      WITH base AS (
        SELECT * FROM db_masmis.outbound_dashboard_cache cd
        WHERE cd.mobile_valid = 1 AND cd.call_date BETWEEN ? AND ? ${cf}${af}${campF}
      ),
      mo AS (
        SELECT * FROM base
        WHERE rejected_status_a NOT IN ('Opening Rejected','Offering Rejected','Context Rejected')
          AND has_objection_category = 1
          AND sale_done = 1
      )
      SELECT
        CASE
          WHEN objection_subcategory IN ('Already has the same product','Already has enough perfumes','Overstock / No Need for More','Already Owns Enough','Already has too many perfumes','Happy with the product but not interested in buying more') THEN 'No Need'
          WHEN objection_subcategory = 'Already has another preferred brand' THEN 'Brand Preference'
          WHEN objection_subcategory = 'Liked the product but wants a better deal' THEN 'Price Sensitivity'
          WHEN objection_subcategory = 'Wants to buy later' THEN 'Budget Constraint'
          WHEN objection_subcategory = 'Not Interested in Perfumes' THEN 'Product Disinterest'
          WHEN objection_subcategory IN ('Didn''t like one of the perfumes','Disappointed with perfume quality','Perfume Longevity Issue','Perfume too strong') THEN 'Negative Experience'
          WHEN objection_subcategory IN ('Damaged Product Received','Wrong Product Received') THEN 'Logistic Concern'
          WHEN objection_subcategory = 'Doesn''t trust online payments' THEN 'Trust Concerns'
          ELSE ''
        END AS name,
        COUNT(*) AS value
      FROM mo
      GROUP BY name
      HAVING name != ''
    `, params),

    queryMasmis<{ category: string; insight: string; cnt: number }>(`
      WITH base AS (
        SELECT * FROM db_masmis.outbound_dashboard_cache cd
        WHERE cd.mobile_valid = 1 AND cd.call_date BETWEEN ? AND ? ${cf}${af}${campF}
      )
      SELECT
        CASE
          WHEN objection_subcategory = 'Already has the same product'                        THEN 'No Need'
          WHEN objection_subcategory = 'Already has enough perfumes'                          THEN 'No Need'
          WHEN objection_subcategory = 'Overstock / No Need for More'                        THEN 'No Need'
          WHEN objection_subcategory = 'Already Owns Enough'                                 THEN 'No Need'
          WHEN objection_subcategory = 'Already has too many perfumes'                        THEN 'No Need'
          WHEN objection_subcategory = 'Already has another preferred brand'                  THEN 'Brand Preference'
          WHEN objection_subcategory = 'Liked the product but wants a better deal'            THEN 'Price Sensitivity'
          WHEN objection_subcategory = 'Wants to buy later'                                  THEN 'Budget Constraint'
          WHEN objection_subcategory = 'Not Interested in Perfumes'                          THEN 'Product Disinterest'
          WHEN objection_subcategory = 'Happy with the product but not interested in buying more' THEN 'No Need'
          WHEN objection_subcategory = 'Didn''t like one of the perfumes'                    THEN 'Negative Experience'
          WHEN objection_subcategory = 'Disappointed with perfume quality'                   THEN 'Negative Experience'
          WHEN objection_subcategory = 'Perfume Longevity Issue'                             THEN 'Negative Experience'
          WHEN objection_subcategory = 'Perfume too strong'                                  THEN 'Negative Experience'
          WHEN objection_subcategory = 'Damaged Product Received'                            THEN 'Logistic Concern'
          WHEN objection_subcategory = 'Wrong Product Received'                              THEN 'Logistic Concern'
          WHEN objection_subcategory = 'Doesn''t trust online payments'                      THEN 'Trust Concerns'
          ELSE ''
        END AS category,
        CASE
          WHEN objection_subcategory = 'Already has the same product'                        THEN 'Customer already has same product; no need to buy.'
          WHEN objection_subcategory = 'Already has enough perfumes'                          THEN 'Fully stocked; low chance of purchase.'
          WHEN objection_subcategory = 'Overstock / No Need for More'                        THEN 'No immediate need; possible future purchase.'
          WHEN objection_subcategory = 'Already Owns Enough'                                 THEN 'No need for additional purchases now.'
          WHEN objection_subcategory = 'Already has too many perfumes'                        THEN 'Similar to overstocked; minimal conversion potential.'
          WHEN objection_subcategory = 'Already has another preferred brand'                  THEN 'Prefers another brand; difficult to convert.'
          WHEN objection_subcategory = 'Liked the product but wants a better deal'            THEN 'Possible to convert with discounts or offers.'
          WHEN objection_subcategory = 'Wants to buy later'                                  THEN 'Future potential lead; needs follow-up.'
          WHEN objection_subcategory = 'Not Interested in Perfumes'                          THEN 'No interest at all; unlikely to convert.'
          WHEN objection_subcategory = 'Happy with the product but not interested in buying more' THEN 'No further purchase intent; hard to upsell.'
          WHEN objection_subcategory = 'Didn''t like one of the perfumes'                    THEN 'A bad experience with one variant; can recommend others.'
          WHEN objection_subcategory = 'Disappointed with perfume quality'                   THEN 'Concerns about quality; provide product assurance.'
          WHEN objection_subcategory = 'Perfume Longevity Issue'                             THEN 'Customer finds longevity lacking; suggest long-lasting alternatives.'
          WHEN objection_subcategory = 'Perfume too strong'                                  THEN 'Scent preference issue; suggest milder alternatives.'
          WHEN objection_subcategory = 'Damaged Product Received'                            THEN 'A serious issue; needs strong resolution to regain trust.'
          WHEN objection_subcategory = 'Wrong Product Received'                              THEN 'Fulfillment error; needs rectification and trust-building.'
          WHEN objection_subcategory = 'Doesn''t trust online payments'                      THEN 'Major barrier; provide secure payment options and reassurance.'
          ELSE ''
        END AS insight,
        COUNT(*) AS cnt
      FROM base
      WHERE sale_done = 0
        AND rejected_status_b NOT IN ('Opening Rejected', 'Offering Rejected')
      GROUP BY 1, 2
      HAVING category != ''
      ORDER BY cnt DESC
    `, params),

    queryMasmis<{ ned_category: string; ned_qs: string; ned_status: string; cnt: number }>(`
      WITH base AS (
        SELECT * FROM db_masmis.outbound_dashboard_cache cd
        WHERE cd.mobile_valid = 1 AND cd.call_date BETWEEN ? AND ? ${cf}${af}${campF}
      )
      SELECT
        CASE
          WHEN objection_subcategory = 'Already has the same product'                        THEN 'No Need'
          WHEN objection_subcategory = 'Already has enough perfumes'                         THEN 'No Need'
          WHEN objection_subcategory = 'Overstock / No Need for More'                       THEN 'No Need'
          WHEN objection_subcategory = 'Already Owns Enough'                                THEN 'No Need'
          WHEN objection_subcategory = 'Already has too many perfumes'                      THEN 'No Need'
          WHEN objection_subcategory = 'Already has another preferred brand'                THEN 'Brand Preference'
          WHEN objection_subcategory = 'Liked the product but wants a better deal'          THEN 'Price Sensitivity'
          WHEN objection_subcategory = 'Wants to buy later'                                 THEN 'Budget Constraint'
          WHEN objection_subcategory = 'Not Interested in Perfumes'                         THEN 'Product Disinterest'
          WHEN objection_subcategory = 'Happy with the product but not interested in buying more' THEN 'No Need'
          WHEN objection_subcategory = 'Didn''t like one of the perfumes'                   THEN 'Negative Experience'
          WHEN objection_subcategory = 'Disappointed with perfume quality'                  THEN 'Negative Experience'
          WHEN objection_subcategory = 'Perfume Longevity Issue'                            THEN 'Negative Experience'
          WHEN objection_subcategory = 'Perfume too strong'                                 THEN 'Negative Experience'
          WHEN objection_subcategory = 'Damaged Product Received'                           THEN 'Logistic Concern'
          WHEN objection_subcategory = 'Wrong Product Received'                             THEN 'Logistic Concern'
          WHEN objection_subcategory = 'Doesn''t trust online payments'                     THEN 'Trust Concerns'
          ELSE ''
        END AS ned_category,
        CASE
          WHEN objection_subcategory = 'Didn''t like one of the perfumes'   THEN 'Disappointed with perfume quality'
          WHEN objection_subcategory = 'Already has enough perfumes'         THEN 'Already has too many perfumes'
          WHEN objection_subcategory = 'Already has the same product'        THEN 'Already has too many perfumes'
          WHEN objection_subcategory = 'Already has too many perfumes'       THEN 'Already has too many perfumes'
          WHEN objection_subcategory = 'Already Owns Enough'                 THEN 'Already has too many perfumes'
          WHEN objection_subcategory = 'Overstock/No Need for More'          THEN 'Already has too many perfumes'
          ELSE COALESCE(objection_subcategory, '')
        END AS ned_qs,
        CASE
          WHEN objection_subcategory IN (
            'Already has the same product','Already has enough perfumes','Overstock / No Need for More',
            'Already Owns Enough','Already has too many perfumes','Already has another preferred brand',
            'Not Interested in Perfumes','Happy with the product but not interested in buying more',
            'Didn''t like one of the perfumes','Disappointed with perfume quality'
          ) THEN 'Non Workable'
          WHEN objection_subcategory IN (
            'Liked the product but wants a better deal','Wants to buy later',
            'Perfume Longevity Issue','Perfume too strong',
            'Damaged Product Received','Wrong Product Received',
            'Doesn''t trust online payments'
          ) THEN 'Workable'
          ELSE ''
        END AS ned_status,
        COUNT(*) AS cnt
      FROM base
      WHERE sale_done = 0
        AND rejected_status_b NOT IN ('Opening Rejected', 'Offering Rejected')
      GROUP BY 1, 2, 3
      HAVING ned_category != '' AND ned_status != ''
      ORDER BY cnt DESC
    `, params),

    queryMasmis<PieSlice>(`
      WITH base AS (
        SELECT * FROM db_masmis.outbound_dashboard_cache cd
        WHERE cd.mobile_valid = 1 AND cd.call_date BETWEEN ? AND ? ${cf}${af}${campF}
      )
      SELECT
        CASE
          WHEN objection_subcategory IS NULL
               OR objection_subcategory = ''
               OR objection_subcategory IN (
                 'Already has the same product','Already has enough perfumes',
                 'Overstock / No Need for More','Already Owns Enough',
                 'Already has too many perfumes',
                 'Happy with the product but not interested in buying more'
               ) THEN 'No Need'
          WHEN objection_subcategory = 'Already has another preferred brand'          THEN 'Brand Preference'
          WHEN objection_subcategory = 'Liked the product but wants a better deal'   THEN 'Price Sensitivity'
          WHEN objection_subcategory = 'Wants to buy later'                          THEN 'Budget Constraint'
          WHEN objection_subcategory = 'Not Interested in Perfumes'                  THEN 'Product Disinterest'
          WHEN objection_subcategory IN (
            'Didn''t like one of the perfumes','Disappointed with perfume quality',
            'Perfume Longevity Issue','Perfume too strong'
          ) THEN 'Negative Experience'
          WHEN objection_subcategory IN ('Damaged Product Received','Wrong Product Received') THEN 'Logistic Concern'
          WHEN objection_subcategory = 'Doesn''t trust online payments'              THEN 'Trust Concerns'
          ELSE 'No Need'
        END AS name,
        COUNT(*) AS value
      FROM base
      WHERE rejected_status_b NOT IN ('Opening Rejected', 'Offering Rejected')
      GROUP BY 1
      ORDER BY value DESC
    `, params),

    queryMasmis<{
      total: number; promoter: number; detractor: number; passive: number;
      nps_score: number | null; csat_score: number | null;
    }>(`
      SELECT
        SUM(CASE WHEN cd.feedback IN ('Positive','Negative','Neutral') THEN 1 ELSE 0 END) AS total,
        SUM(CASE WHEN cd.feedback = 'Positive' THEN 1 ELSE 0 END) AS promoter,
        SUM(CASE WHEN cd.feedback = 'Negative' THEN 1 ELSE 0 END) AS detractor,
        SUM(CASE WHEN cd.feedback = 'Neutral'  THEN 1 ELSE 0 END) AS passive,
        ROUND(
          (SUM(CASE WHEN cd.feedback = 'Positive' THEN 1 ELSE 0 END) * 100.0 /
           NULLIF(SUM(CASE WHEN cd.feedback IN ('Positive','Negative','Neutral') THEN 1 ELSE 0 END), 0))
          -
          (SUM(CASE WHEN cd.feedback = 'Negative' THEN 1 ELSE 0 END) * 100.0 /
           NULLIF(SUM(CASE WHEN cd.feedback IN ('Positive','Negative','Neutral') THEN 1 ELSE 0 END), 0)),
          2
        ) AS nps_score,
        ROUND(
          (SUM(CASE WHEN cd.feedback IN ('Positive','Neutral') THEN 1 ELSE 0 END) * 100.0 /
           NULLIF(SUM(CASE WHEN cd.feedback IN ('Positive','Negative','Neutral') THEN 1 ELSE 0 END), 0)) / 100,
          4
        ) AS csat_score
      FROM db_masmis.outbound_dashboard_cache cd
      WHERE cd.feedback IN ('Positive','Negative','Neutral')
        AND cd.call_date BETWEEN ? AND ? ${cf}${af}${campF}
    `, params),

    queryMasmis<{
      calldate: string; total_feedbacks: number;
      promoter: number; detractor: number; passive: number; nps_score: number | null;
    }>(`
      SELECT
        DATE_FORMAT(cd.call_date, '%Y-%m-%d') AS calldate,
        COUNT(*) AS total_feedbacks,
        SUM(CASE WHEN cd.feedback = 'Positive' THEN 1 ELSE 0 END) AS promoter,
        SUM(CASE WHEN cd.feedback = 'Negative' THEN 1 ELSE 0 END) AS detractor,
        SUM(CASE WHEN cd.feedback = 'Neutral'  THEN 1 ELSE 0 END) AS passive,
        ROUND(
          (SUM(CASE WHEN cd.feedback = 'Positive' THEN 1 ELSE 0 END) * 100.0 /
           NULLIF(SUM(CASE WHEN cd.feedback IN ('Positive','Negative','Neutral') THEN 1 ELSE 0 END), 0))
          -
          (SUM(CASE WHEN cd.feedback = 'Negative' THEN 1 ELSE 0 END) * 100.0 /
           NULLIF(SUM(CASE WHEN cd.feedback IN ('Positive','Negative','Neutral') THEN 1 ELSE 0 END), 0)),
          2
        ) AS nps_score
      FROM db_masmis.outbound_dashboard_cache cd
      WHERE cd.feedback IN ('Positive','Negative','Neutral')
        AND cd.call_date BETWEEN ? AND ? ${cf}${af}${campF}
      GROUP BY 1
      ORDER BY 1
    `, params),

    // Date-wise audit count — same "valid call" definition as the CST/CRT total above
    // (MobileNo present, CustomerObjectionCategory tagged), just broken out per day.
    queryMasmis<{ calldate: string; cnt: number }>(`
      SELECT DATE_FORMAT(cd.call_date, '%Y-%m-%d') AS calldate, COUNT(*) AS cnt
      FROM db_masmis.outbound_dashboard_cache cd
      WHERE cd.mobile_valid = 1
        AND cd.has_objection_category = 1
        AND cd.call_date BETWEEN ? AND ? ${cf}${af}${campF}
      GROUP BY 1
      ORDER BY 1
    `, params),
  ]);

  const r = row[0];
  const total = r?.total ?? 0;
  const sale = r?.sale ?? 0;
  const ops = r?.ops ?? 0;
  const cps = r?.cps ?? 0;
  const offered = r?.offered ?? 0;
  const orCnt = r?.or_cnt ?? 0;
  const crCnt = r?.cr_cnt ?? 0;
  const oprCnt = r?.opr_cnt ?? 0;
  const porCnt = r?.por_cnt ?? 0;
  const totalOpp = Number(oppRow[0]?.total_opp ?? 0);
  const moCount = Number(oppRow[0]?.mo_count ?? 0);
  const moTotal = moCategoryRaw.reduce((s, r) => s + Number(r.cnt), 0);
  const moCategoryTable: MOCategoryRow[] = moCategoryRaw.map(r => ({
    category: r.category,
    insight: r.insight,
    count: Number(r.cnt),
    pct: moTotal > 0 ? Number(((Number(r.cnt) / moTotal) * 100).toFixed(1)) : 0,
  }));
  const nedTotal = nedRaw.reduce((s, r) => s + Number(r.cnt), 0);
  const nedTable: NEDRow[] = nedRaw.map(r => ({
    nedCategory: r.ned_category,
    nedQS:       r.ned_qs,
    nedStatus:   r.ned_status,
    count:       Number(r.cnt),
    pct:         nedTotal > 0 ? Number(((Number(r.cnt) / nedTotal) * 100).toFixed(1)) : 0,
  }));

  const npsDays: NPSDayRow[] = npsDaysRaw.map(r => ({
    calldate:       String(r.calldate),
    totalFeedbacks: Number(r.total_feedbacks),
    promoter:       Number(r.promoter),
    detractor:      Number(r.detractor),
    passive:        Number(r.passive),
    npsScore:       Number(r.nps_score ?? 0),
  }));

  const npsR = npsRaw[0] ?? { total: 0, promoter: 0, detractor: 0, passive: 0, nps_score: 0, csat_score: 0 };
  const npsTotal = Number(npsR.total);
  const npsData: NPSData = {
    total:    npsTotal,
    promoter: Number(npsR.promoter),
    detractor: Number(npsR.detractor),
    passive:  Number(npsR.passive),
    npsScore: Number(npsR.nps_score ?? 0),
    csatPct:  Number(((Number(npsR.csat_score ?? 0)) * 100).toFixed(1)),
    days:     npsDays,
  };

  return {
    cst: {
      totalCalls: total,
      ops,
      cps,
      offeredSuccess: offered,
      saleDone: sale,
      successRatePct: total > 0 ? Number((sale / total * 100).toFixed(1)) : 0,
    },
    crt: {
      orCount: orCnt,
      crCount: crCnt,
      oprCount: oprCnt,
      porCount: porCnt,
      failureRatePct: total > 0 ? Number(((total - sale) / total * 100).toFixed(1)) : 0,
    },
    rejectedPie: rejectedBreakdown,
    cstFunnel: [
      { name: 'Total Calls', value: total },
      { name: 'OPS', value: ops },
      { name: 'CPS', value: cps },
      { name: 'Offered Success', value: offered },
      { name: 'Sale Done', value: sale },
    ],
    crtFunnel: [
      { name: 'OR (Opening Rejected)', value: orCnt },
      { name: 'CR (Context Rejected)', value: crCnt },
      { name: 'OPR (Offering Rejected)', value: oprCnt },
      { name: 'POR (Post Offer Rejected)', value: porCnt },
    ],
    auditCountByDate: auditCountRaw.map(r => ({ calldate: String(r.calldate), count: Number(r.cnt) })),
    opportunity: {
      totalOpportunities: totalOpp,
      moCount,
      opportunityLoss: oppLossPie,
      opportunityCategory: oppCatPie,
      moBreaks: moBreaksPie,
      moCategoryTable,
      objectionCategoryPie,
      nedTable,
    },
    nps: npsData,
  };
}

export interface SaleDoneCallRow {
  callId: number;
  callDate: string;
  agentName: string;
  mobileNo: string;
  fileName: string;
}

// Drill-down behind the CST funnel's "Sale Done" segment — same "valid call" population as the
// CST total/sale figures above, so the row count here always matches the number shown there.
export async function getSaleDoneCalls(filters: QualityFilters): Promise<SaleDoneCallRow[]> {
  const { startDate, endDate } = filters;
  const { sql: cf, params: cfParams } = clientClause(filters);
  const { sql: campF, params: campParams } = campaignClause(filters);
  const params = [startDate, endDate, ...cfParams, ...campParams];

  const rows = await querySource<{ id: number; CallDate: string; AgentName: string | null; MobileNo: string | null; FileName: string | null }>(`
    SELECT cd.id, cd.CallDate, cd.AgentName, cd.MobileNo, cd.FileName
    FROM db_external.CallDetails cd
    WHERE cd.MobileNo IS NOT NULL AND cd.MobileNo != ''
      AND cd.CustomerObjectionCategory IS NOT NULL AND cd.CustomerObjectionCategory != ''
      AND COALESCE(cd.SaleDone, 0) = 1
      AND cd.CallDate BETWEEN ? AND ? ${cf}${campF}${campF}
    ORDER BY cd.CallDate DESC
    LIMIT 500
  `, params);

  return rows.map(r => ({
    callId:    Number(r.id),
    callDate:  String(r.CallDate),
    agentName: r.AgentName ?? 'Unknown',
    mobileNo:  r.MobileNo ?? '',
    fileName:  r.FileName ?? '',
  }));
}

// Drill-down behind a Magical Script category branch's "Sale Done" pill. Column-based clients
// (Bellavita/GNC/Neeman's) group by magical_script_cache.resolved_category; every other client's
// generic flow groups by objection_category (CustomerObjectionCategory) instead — both are
// computed for every row regardless of client, so this just picks the right column to match on.
export async function getMagicalCategorySaleDoneCalls(
  filters: QualityFilters, category: string, variant: 'bellavita' | 'generic',
): Promise<SaleDoneCallRow[]> {
  const { startDate, endDate, clientId } = filters;
  const field = variant === 'bellavita' ? 'resolved_category' : 'objection_category';
  const cf = clientId ? ' AND client_id = ?' : '';
  const params: (string | number)[] = [startDate, endDate, category, ...(clientId ? [Number(clientId)] : [])];

  const cacheRows = await queryMasmis<{ call_id: number }>(`
    SELECT call_id FROM db_masmis.magical_script_cache
    WHERE call_date BETWEEN ? AND ? AND ${field} = ? AND sale_done = 1 ${cf}
    ORDER BY call_date DESC
    LIMIT 200
  `, params);

  const ids = cacheRows.map(r => Number(r.call_id));
  if (ids.length === 0) return [];

  const placeholders = ids.map(() => '?').join(',');
  const rows = await querySource<{ id: number; CallDate: string; AgentName: string | null; MobileNo: string | null; FileName: string | null }>(
    `SELECT id, CallDate, AgentName, MobileNo, FileName FROM db_external.CallDetails WHERE id IN (${placeholders})`,
    ids,
  );

  return rows
    .map(r => ({
      callId:    Number(r.id),
      callDate:  String(r.CallDate),
      agentName: r.AgentName ?? 'Unknown',
      mobileNo:  r.MobileNo ?? '',
      fileName:  r.FileName ?? '',
    }))
    .sort((a, b) => b.callDate.localeCompare(a.callDate));
}

// Shared by the two "Call End" drill-downs below — turns a set of magical_script_cache call_ids
// into the same row shape the Sale Done drill-downs use, so both reuse one frontend modal.
async function hydrateSaleDoneRows(callIds: number[]): Promise<SaleDoneCallRow[]> {
  if (callIds.length === 0) return [];
  const placeholders = callIds.map(() => '?').join(',');
  const rows = await querySource<{ id: number; CallDate: string; AgentName: string | null; MobileNo: string | null; FileName: string | null }>(
    `SELECT id, CallDate, AgentName, MobileNo, FileName FROM db_external.CallDetails WHERE id IN (${placeholders})`,
    callIds,
  );
  return rows
    .map(r => ({
      callId:    Number(r.id),
      callDate:  String(r.CallDate),
      agentName: r.AgentName ?? 'Unknown',
      mobileNo:  r.MobileNo ?? '',
      fileName:  r.FileName ?? '',
    }))
    .sort((a, b) => b.callDate.localeCompare(a.callDate));
}

// Drill-down behind a Magical Script category branch's "Call End" pill — mirror of
// getMagicalCategorySaleDoneCalls above but for calls that did NOT convert in that category.
export async function getMagicalCategoryCallEndCalls(
  filters: QualityFilters, category: string, variant: 'bellavita' | 'generic',
): Promise<SaleDoneCallRow[]> {
  const { startDate, endDate, clientId } = filters;
  const field = variant === 'bellavita' ? 'resolved_category' : 'objection_category';
  const cf = clientId ? ' AND client_id = ?' : '';
  const params: (string | number)[] = [startDate, endDate, category, ...(clientId ? [Number(clientId)] : [])];

  const cacheRows = await queryMasmis<{ call_id: number }>(`
    SELECT call_id FROM db_masmis.magical_script_cache
    WHERE call_date BETWEEN ? AND ? AND ${field} = ? AND sale_done = 0 ${cf}
    ORDER BY call_date DESC
    LIMIT 200
  `, params);

  return hydrateSaleDoneRows(cacheRows.map(r => Number(r.call_id)));
}

// Drill-down behind a Magical Script stage's "Call End" pill (OP/CSP/Offer) — the calls that
// dropped out at that exact stage, matching the call_end figure computed in getColumnBasedMagicalScript
// / getMagicalScript above stage-by-stage.
export async function getMagicalStageCallEndCalls(
  filters: QualityFilters, stage: 'op' | 'csp' | 'offer', variant: 'bellavita' | 'generic',
): Promise<SaleDoneCallRow[]> {
  const { startDate, endDate, clientId } = filters;
  const cf = clientId ? ' AND client_id = ?' : '';
  const params: (string | number)[] = [startDate, endDate, ...(clientId ? [Number(clientId)] : [])];

  const whereExtra = variant === 'bellavita'
    ? (stage === 'op'   ? 'op_success = 0'
     : stage === 'csp'  ? 'op_success = 1 AND csp_call_end = 1'
     :                    'op_success = 1 AND csp_success = 1 AND offer_success = 0')
    // Generic flow's call_stage only ever takes 3 values (opening_rejected / offering_rejected /
    // post_offer) — see processMagicalScriptBatch below — so op_pass and csp_pass end up computed
    // over the exact same population, meaning the CSP stage's dropped count is always 0 (same as
    // shown on the pill itself). The condition below stays logically correct for that fact rather
    // than special-casing it, so it keeps matching the pill if that ever changes upstream.
    : (stage === 'op'   ? "call_stage = 'opening_rejected'"
     : stage === 'csp'  ? "call_stage IN ('offering_rejected','post_offer') AND call_stage NOT IN ('offering_rejected','post_offer')"
     :                    "call_stage = 'offering_rejected'");

  const cacheRows = await queryMasmis<{ call_id: number }>(`
    SELECT call_id FROM db_masmis.magical_script_cache
    WHERE call_date BETWEEN ? AND ? AND ${whereExtra} ${cf}
    ORDER BY call_date DESC
    LIMIT 200
  `, params);

  return hydrateSaleDoneRows(cacheRows.map(r => Number(r.call_id)));
}

// Raw Data tab — every CallDetails column (same "all columns" set the CSV export uses — see
// CALL_DETAILS_EXPORT_COLUMNS / exportSelectExpr below), most-recent first, with id-based keyset
// pagination so "Load More" stays cheap regardless of how far back the user goes.
export async function getRawCallData(
  filters: QualityFilters, mobileNo: string | undefined, cursor: number | undefined, limit: number,
  campaignId?: string,
): Promise<{ columns: string[]; rows: Record<string, unknown>[]; nextCursor: number | null }> {
  const { startDate, endDate, clientId } = filters;
  const cf = clientId ? ' AND cd.client_id = ?' : '';
  const mf = mobileNo ? ' AND cd.MobileNo LIKE ?' : '';
  const campF = campaignId ? ' AND cd.campaign_id = ?' : '';
  const cursorClause = cursor ? ' AND cd.id < ?' : '';
  // A mobile-number search intentionally ignores the date range — the caller may be looking for a
  // call from before or after whatever window happens to be selected, so search all-time instead.
  const dateClause = mobileNo ? '' : ' AND cd.CallDate BETWEEN ? AND ?';
  const dateParams = mobileNo ? [] : [startDate, endDate];
  const params: (string | number)[] = [
    ...dateParams,
    ...(clientId ? [Number(clientId)] : []),
    ...(mobileNo ? [`%${mobileNo}%`] : []),
    ...(campaignId ? [campaignId] : []),
    ...(cursor ? [cursor] : []),
  ];

  // Same FORCE INDEX reasoning as streamOutboundExportCsv below — without it, MySQL can pick the
  // PRIMARY (id) index for this all-columns query and scan far more rows than the date/client
  // filter actually matches before reaching LIMIT, risking the query timeout on wide date ranges
  // or deep "Load More" pagination.
  const rows = await querySource<Record<string, unknown>>(`
    SELECT ${CALL_DETAILS_EXPORT_COLUMNS.map(c => exportSelectExpr(c, 'cd')).join(', ')}
    FROM db_external.CallDetails cd ${mobileNo ? '' : 'FORCE INDEX (Index_3)'}
    WHERE 1=1 ${dateClause} ${cf} ${mf} ${campF} ${cursorClause}
    ORDER BY cd.id DESC
    LIMIT ${limit}
  `, params);

  return {
    columns: CALL_DETAILS_EXPORT_COLUMNS,
    rows,
    nextCursor: rows.length === limit ? Number(rows[rows.length - 1].id) : null,
  };
}

// Distinct campaign_id values for a client — feeds the Raw Data tab's campaign filter dropdown,
// which only appears once a client actually runs more than one campaign (e.g. Lawyer Panel's
// "regional" / "non_regional" split).
export async function getRawDataCampaigns(clientId: string): Promise<string[]> {
  const rows = await querySource<{ campaign_id: string }>(
    `SELECT DISTINCT campaign_id FROM db_external.CallDetails WHERE client_id = ? AND campaign_id IS NOT NULL AND campaign_id != '' ORDER BY campaign_id`,
    [Number(clientId)],
  );
  return rows.map(r => r.campaign_id);
}

// ─── Fraud Call Detection (Outbound) ──────────────────────────────────────────
// Outbound fraud is driven ONLY by db_external.CallDetails.fraud_detected_sentence:
// a call counts as a fraud call when that column holds a real sentence value
// (non-empty, non-placeholder like 'None'/'NA'). The fraud_and_data_security_compliance
// column is intentionally ignored. Agent = AgentName (MAS ID), recording =
// FileName, transcript = TranscribeText. Shape mirrors the inbound fraud endpoint
// so the frontend FraudCallTab component is shared between both dashboards.

const OUTBOUND_FRAUD_SENTENCE_CHECK = `cd.fraud_detected_sentence IS NOT NULL
  AND TRIM(cd.fraud_detected_sentence) != ''
  AND LOWER(TRIM(cd.fraud_detected_sentence)) NOT IN ('none', 'na', 'n/a', 'null')`;

export interface FraudCallRow {
  lead_id:        string;
  agent_id:       string;
  mobile_no:      string;
  call_date:      string;
  scenario:       string;
  compliance:     number; // 0 = compliant, 1 = fraud detected
  sentence:       string;
  transcript:     string;
  call_recording: string;
}

export interface FraudAgentRow {
  agent_id:  string;
  client_id: string;
  flagged:   number;
  total:     number;
  risk:      number;
  last_date: string;
}

export interface FraudCallSummary {
  total:   number;
  flagged: number;
  clean:   number;
  agents:  FraudAgentRow[];
  rows:    FraudCallRow[];
}

export async function getOutboundFraudCalls(filters: QualityFilters): Promise<FraudCallSummary> {
  const { startDate, endDate } = filters;
  const { sql: cf, params: cfParams } = clientClause(filters);
  const { sql: campF, params: campParams } = campaignClause(filters);
  const params: (string | number)[] = [startDate, endDate, ...cfParams, ...campParams];

  const [rows, agentRows] = await Promise.all([
    querySource<{
      lead_id: string; agent_id: string; mobile_no: string; call_date: string;
      scenario: string; compliance: number; sentence: string; transcript: string; call_recording: string;
    }>(`
      SELECT
        COALESCE(CAST(cd.LeadID AS CHAR), '')                                 AS lead_id,
        COALESCE(NULLIF(TRIM(cd.AgentName), ''), 'Unknown')                   AS agent_id,
        COALESCE(cd.MobileNo, '')                                             AS mobile_no,
        DATE_FORMAT(cd.CallDate, '%Y-%m-%d %H:%i')                           AS call_date,
        COALESCE(NULLIF(TRIM(cd.CallDisposition), ''), 'Unknown')            AS scenario,
        CASE WHEN ${OUTBOUND_FRAUD_SENTENCE_CHECK} THEN 1 ELSE 0 END          AS compliance,
        COALESCE(cd.fraud_detected_sentence, '')                              AS sentence,
        COALESCE(cd.TranscribeText, '')                                       AS transcript,
        COALESCE(cd.FileName, '')                                             AS call_recording
      FROM db_external.CallDetails cd
      WHERE cd.CallDate BETWEEN ? AND ?
        AND ${OUTBOUND_FRAUD_SENTENCE_CHECK}
        ${cf}${campF}
      ORDER BY cd.CallDate DESC
      LIMIT 300
    `, params),

    querySource<{
      agent_id: string; client_id: string; flagged: number; total: number; last_date: string;
    }>(`
      SELECT
        COALESCE(NULLIF(TRIM(cd.AgentName), ''), 'Unknown')                   AS agent_id,
        cd.client_id                                                          AS client_id,
        SUM(CASE WHEN ${OUTBOUND_FRAUD_SENTENCE_CHECK} THEN 1 ELSE 0 END)     AS flagged,
        COUNT(*)                                                              AS total,
        DATE_FORMAT(MAX(cd.CallDate), '%Y-%m-%d %H:%i')                       AS last_date
      FROM db_external.CallDetails cd
      WHERE cd.CallDate BETWEEN ? AND ?
        AND ${OUTBOUND_FRAUD_SENTENCE_CHECK}
        ${cf}${campF}
      GROUP BY cd.AgentName, cd.client_id
      ORDER BY flagged DESC, total DESC
      LIMIT 100
    `, params),
  ]);

  const cleanRows: FraudCallRow[] = rows.map(r => ({
    lead_id:        String(r.lead_id),
    agent_id:       String(r.agent_id),
    mobile_no:      String(r.mobile_no ?? ''),
    call_date:      String(r.call_date),
    scenario:       String(r.scenario),
    compliance:     Number(r.compliance) === 1 ? 1 : 0,
    sentence:       String(r.sentence ?? ''),
    transcript:     String(r.transcript ?? ''),
    call_recording: String(r.call_recording ?? ''),
  }));

  const cleanAgents: FraudAgentRow[] = agentRows.map(r => {
    const total = Number(r.total) || 0;
    const flagged = Number(r.flagged) || 0;
    return {
      agent_id:  String(r.agent_id),
      client_id: String(r.client_id ?? ''),
      flagged,
      total,
      risk:      total > 0 ? Math.round((flagged / total) * 100) : 0,
      last_date: String(r.last_date ?? ''),
    };
  });

  return {
    total:   cleanRows.length,
    flagged: cleanRows.filter(r => r.compliance === 1).length,
    clean:   cleanRows.filter(r => r.compliance === 0).length,
    agents:  cleanAgents,
    rows:    cleanRows,
  };
}

export async function getDetailAnalysis(filters: QualityFilters): Promise<DetailAnalysisResponse> {
  const { startDate, endDate } = filters;
  const { sql: cf, params: cfParams } = clientClause(filters);
  const { sql: campF, params: campParams } = campaignClause(filters);
  const params = [startDate, endDate, ...cfParams, ...campParams];

  const REJ_STATUS_EXPR = `CASE
    WHEN cd.AfterListeningOfferRejected = 1 THEN 'Post Offer Rejected'
    WHEN cd.SaleDone = 1                    THEN 'Post Offer Rejected'
    WHEN cd.ObjectionHandlingContext = 'None' THEN 'Offering Rejected'
    WHEN cd.ContactSettingContext    = 'None' THEN 'Context Rejected'
    WHEN cd.OpeningRejected          = 1     THEN 'Opening Rejected'
    WHEN cd.OfferedPitchContext      = 'None' THEN 'Opening Rejected'
    ELSE 'Opening Rejected'
  END`;

  const opRaw = await querySource<{
    opening_category: string;
    total_calls: number;
    ops_count: number;
    or_count: number;
    sale_count: number;
  }>(`
    WITH base AS (
      SELECT cd.*,
        ${REJ_STATUS_EXPR} AS rej_status,
        TRIM(REPLACE(REPLACE(REPLACE(cd.OpeningPitchCategory, '[', ''), ']', ''), '"', '')) AS opening_category
      FROM db_external.CallDetails cd
      WHERE cd.MobileNo IS NOT NULL AND cd.MobileNo != ''
        AND cd.OpeningPitchCategory IS NOT NULL
        AND cd.OpeningPitchCategory != ''
        AND cd.CallDate BETWEEN ? AND ? ${cf}${campF}
    )
    SELECT
      opening_category,
      COUNT(*)                                                              AS total_calls,
      SUM(CASE WHEN rej_status != 'Opening Rejected'    THEN 1 ELSE 0 END) AS ops_count,
      SUM(CASE WHEN rej_status  = 'Opening Rejected'    THEN 1 ELSE 0 END) AS or_count,
      SUM(CASE WHEN COALESCE(SaleDone, 0) = 1           THEN 1 ELSE 0 END) AS sale_count
    FROM base
    WHERE opening_category IS NOT NULL
      AND opening_category != ''
      AND opening_category != 'None'
    GROUP BY 1
    ORDER BY total_calls DESC
  `, params);

  const csRaw = await querySource<{
    contact_group: string;
    total_calls: number;
    ops_count: number;
    or_count: number;
    sale_count: number;
  }>(`
    WITH base AS (
      SELECT cd.*,
        ${REJ_STATUS_EXPR} AS rej_status,
        CASE
          WHEN cd.ContactSettingCategory = 'Product Inquiry'                                                               THEN 'Dual Approach: Feedback & Offer at Once'
          WHEN cd.ContactSettingCategory = 'Feedback and Offer Introduction'                                               THEN 'Feedback-First Approach then Offer Pitched'
          WHEN cd.ContactSettingCategory = 'Feedback Call'                                                                 THEN 'Feedback-First Approach then Offer Pitched'
          WHEN cd.ContactSettingCategory = 'Setting Call Duration Expectation'                                             THEN 'Dual Approach: Feedback & Offer at Once'
          WHEN cd.ContactSettingCategory = 'Greeting'                                                                     THEN 'Feedback-First Approach then Offer Pitched'
          WHEN cd.ContactSettingCategory = 'Order Confirmation'                                                            THEN 'Order Confirmation'
          WHEN cd.ContactSettingCategory = 'Product Offering'                                                              THEN 'Feedback-First Approach then Offer Pitched'
          WHEN cd.ContactSettingCategory = 'Offer Explanation'                                                             THEN 'Dual Approach: Feedback & Offer at Once'
          WHEN cd.ContactSettingCategory = 'Informing about previous call disconnection and seeking to complete the conversation.' THEN 'Follow Up'
          WHEN cd.ContactSettingCategory = 'Direct Statement'                                                              THEN 'Dual Approach: Feedback & Offer at Once'
          WHEN cd.ContactSettingCategory = 'Feedback and Offer Inquiry'                                                    THEN 'Dual Approach: Feedback & Offer at Once'
          WHEN cd.ContactSettingCategory = 'Customer Counting & Offer Presentation'                                        THEN 'Dual Approach: Feedback & Offer at Once'
          WHEN cd.ContactSettingCategory = 'Professional and Polite'                                                       THEN 'Feedback-First Approach then Offer Pitched'
          WHEN cd.ContactSettingCategory = 'Customer Unavailability'                                                       THEN 'Feedback-First Approach then Offer Pitched'
          WHEN cd.ContactSettingCategory = 'Feedback and Offer'                                                            THEN 'Feedback-First Approach then Offer Pitched'
          WHEN cd.ContactSettingCategory = 'Customer Disinterest'                                                          THEN 'Feedback-First Approach then Offer Pitched'
          WHEN cd.ContactSettingCategory = 'Direct Approach'                                                               THEN 'Dual Approach: Feedback & Offer at Once'
          WHEN cd.ContactSettingCategory = 'Personalized Introduction'                                                     THEN 'Feedback-First Approach then Offer Pitched'
          WHEN cd.ContactSettingCategory = 'Informing about ongoing offer'                                                 THEN 'Dual Approach: Feedback & Offer at Once'
          WHEN cd.ContactSettingCategory = 'Direct and Informal'                                                           THEN 'Dual Approach: Feedback & Offer at Once'
          WHEN cd.ContactSettingCategory = 'Information Sharing'                                                           THEN 'Feedback-First Approach then Offer Pitched'
          WHEN cd.ContactSettingCategory = 'Feedback Request'                                                              THEN 'Feedback-First Approach then Offer Pitched'
          WHEN cd.ContactSettingCategory = 'Customer Appreciation'                                                         THEN 'Feedback-First Approach then Offer Pitched'
          WHEN cd.ContactSettingCategory = 'Customer Feedback Inquiry'                                                     THEN 'Feedback-First Approach then Offer Pitched'
          WHEN cd.ContactSettingCategory = 'Professional and Courteous'                                                    THEN 'Feedback-First Approach then Offer Pitched'
          WHEN cd.ContactSettingCategory = 'Respectful and Understanding'                                                  THEN 'Feedback-First Approach then Offer Pitched'
          WHEN cd.ContactSettingCategory = 'Feedback Inquiry'                                                              THEN 'Feedback-First Approach then Offer Pitched'
          WHEN cd.ContactSettingCategory = 'Product Price Introduction'                                                    THEN 'Feedback-First Approach then Offer Pitched'
          WHEN cd.ContactSettingCategory = 'Personalized Approach'                                                         THEN 'Feedback-First Approach then Offer Pitched'
          WHEN cd.ContactSettingCategory = 'Personalized Contact Setting'                                                  THEN 'Feedback-First Approach then Offer Pitched'
          WHEN cd.ContactSettingCategory = 'Formal Introduction'                                                           THEN 'Feedback-First Approach then Offer Pitched'
          WHEN cd.ContactSettingCategory = 'Product Recommendation'                                                        THEN 'Feedback-First Approach then Offer Pitched'
          WHEN cd.ContactSettingCategory = 'Friendly and Informal'                                                         THEN 'Dual Approach: Feedback & Offer at Once'
          WHEN cd.ContactSettingCategory = 'Building Rapport'                                                              THEN 'Dual Approach: Feedback & Offer at Once'
          WHEN cd.ContactSettingCategory = 'Offer Presentation'                                                            THEN 'Dual Approach: Feedback & Offer at Once'
          WHEN cd.ContactSettingCategory = 'Professional Introduction'                                                     THEN 'Feedback-First Approach then Offer Pitched'
          WHEN cd.ContactSettingCategory = 'Company Introduction'                                                          THEN 'Feedback-First Approach then Offer Pitched'
          WHEN cd.ContactSettingCategory = 'Informative'                                                                   THEN 'Feedback-First Approach then Offer Pitched'
          WHEN cd.ContactSettingCategory = 'Information Gathering'                                                         THEN 'Feedback-First Approach then Offer Pitched'
          WHEN cd.ContactSettingCategory = 'Personal Connection'                                                           THEN 'Feedback-First Approach then Offer Pitched'
          WHEN cd.ContactSettingCategory = 'Issue Resolution'                                                              THEN 'Feedback-First Approach then Offer Pitched'
          WHEN cd.ContactSettingCategory = 'Positive Engagement'                                                           THEN 'Feedback-First Approach then Offer Pitched'
          WHEN cd.ContactSettingCategory = 'Introduction and Purpose'                                                      THEN 'Feedback-First Approach then Offer Pitched'
          WHEN cd.ContactSettingCategory = 'Direct Rejection'                                                              THEN 'Feedback-First Approach then Offer Pitched'
          WHEN cd.ContactSettingCategory = 'Casual and Informal'                                                           THEN 'Dual Approach: Feedback & Offer at Once'
          WHEN cd.ContactSettingCategory = 'Positive Interaction'                                                          THEN 'Feedback-First Approach then Offer Pitched'
          WHEN cd.ContactSettingCategory = 'Feedback&Offer Pitch Same Time'                                                THEN 'Dual Approach: Feedback & Offer at Once'
          WHEN cd.ContactSettingCategory = 'Feedback before Offer Pitch'                                                   THEN 'Feedback-First Approach then Offer Pitched'
          WHEN cd.ContactSettingCategory = 'Feedback & Offer Pitch Same Time'                                              THEN 'Dual Approach: Feedback & Offer at Once'
          ELSE cd.ContactSettingCategory
        END AS contact_group
      FROM db_external.CallDetails cd
      WHERE cd.MobileNo IS NOT NULL AND cd.MobileNo != ''
        AND cd.ContactSettingCategory IS NOT NULL
        AND cd.ContactSettingCategory != ''
        AND cd.ContactSettingCategory != 'None'
        AND cd.CallDate BETWEEN ? AND ? ${cf}${campF}
    )
    SELECT
      contact_group,
      COUNT(*)                                                              AS total_calls,
      SUM(CASE WHEN rej_status != 'Opening Rejected'    THEN 1 ELSE 0 END) AS ops_count,
      SUM(CASE WHEN rej_status  = 'Opening Rejected'    THEN 1 ELSE 0 END) AS or_count,
      SUM(CASE WHEN COALESCE(SaleDone, 0) = 1           THEN 1 ELSE 0 END) AS sale_count
    FROM base
    WHERE contact_group IS NOT NULL AND contact_group != '' AND contact_group != 'None'
    GROUP BY 1
    ORDER BY total_calls DESC
  `, params);

  const opPitchRaw = await querySource<{
    discount_type: string;
    total_offer: number;
    or_count: number;
    os_count: number;
    sale_count: number;
  }>(`
    WITH base AS (
      SELECT cd.*,
        ${REJ_STATUS_EXPR} AS rej_status,
        TRIM(REPLACE(REPLACE(REPLACE(COALESCE(cd.OpeningPitchCategory,''), '[', ''), ']', ''), '"', '')) AS cleaned_op
      FROM db_external.CallDetails cd
      WHERE cd.MobileNo IS NOT NULL AND cd.MobileNo != ''
        AND cd.DiscountType IS NOT NULL
        AND cd.DiscountType != ''
        AND cd.DiscountType != 'None'
        AND cd.CallDate BETWEEN ? AND ? ${cf}${campF}
    )
    SELECT
      DiscountType                                                          AS discount_type,
      COUNT(*)                                                              AS total_offer,
      SUM(CASE WHEN rej_status  = 'Offering Rejected'   THEN 1 ELSE 0 END) AS or_count,
      SUM(CASE WHEN rej_status != 'Offering Rejected'   THEN 1 ELSE 0 END) AS os_count,
      SUM(CASE WHEN COALESCE(SaleDone, 0) = 1           THEN 1 ELSE 0 END) AS sale_count
    FROM base
    WHERE cleaned_op NOT IN (
      'Self-Introduction', 'Company Introduction',
      'Public Awareness', 'Greeting', 'Voice Check'
    )
    GROUP BY 1
    ORDER BY total_offer DESC
  `, params);

  return {
    opCategories: opRaw.map(r => ({
      openingCategory: String(r.opening_category),
      totalCalls:      Number(r.total_calls),
      opsCount:        Number(r.ops_count),
      orCount:         Number(r.or_count),
      saleCount:       Number(r.sale_count),
    })),
    csCategories: csRaw.map(r => ({
      contactGroup: String(r.contact_group),
      totalCalls:   Number(r.total_calls),
      opsCount:     Number(r.ops_count),
      orCount:      Number(r.or_count),
      saleCount:    Number(r.sale_count),
    })),
    offeredPitch: opPitchRaw.map(r => ({
      discountType: String(r.discount_type),
      totalOffer:   Number(r.total_offer),
      orCount:      Number(r.or_count),
      osCount:      Number(r.os_count),
      saleCount:    Number(r.sale_count),
    })),
  };
}

/* ─── Objection Analysis ──────────────────────────────────────────────────── */

export interface POSBreakdownRow {
  mainObjection:       string;
  objectionCount:      number;
  failedRebuttal:      number;
  successfulRebuttal:  number;
  saleCount:           number;
}

export interface POSSubcategoryRow {
  cxObjectionSubcat:   string;
  objectionCount:      number;
  failedRebuttal:      number;
  successfulRebuttal:  number;
  saleCount:           number;
}

export interface ObjectionAnalysisResponse {
  posBreakdown:   POSBreakdownRow[];
  posSubcategory: POSSubcategoryRow[];
}

export async function getObjectionAnalysis(filters: QualityFilters): Promise<ObjectionAnalysisResponse> {
  const { startDate, endDate } = filters;
  const { sql: cf, params: cfParams } = clientClause(filters);
  const { sql: campF, params: campParams } = campaignClause(filters);
  const baseParams = [startDate, endDate, ...cfParams, ...campParams];

  const BASE_FILTER = `
    AND cd.MobileNo IS NOT NULL AND cd.MobileNo != '' AND cd.MobileNo != '0'
    AND cd.CustomerObjectionCategory IS NOT NULL AND cd.CustomerObjectionCategory != '' AND cd.CustomerObjectionCategory != 'None'
    AND cd.CustomerObjectionSubCategory IS NOT NULL AND cd.CustomerObjectionSubCategory != '' AND cd.CustomerObjectionSubCategory != 'None'
    AND cd.AgentRebuttalCategory IS NOT NULL AND cd.AgentRebuttalCategory != '' AND cd.AgentRebuttalCategory != 'None'
  `;

  const MAIN_OBJECTION_CASE = `
    CASE
      WHEN cd.CustomerObjectionCategory = 'General Disinterest'  THEN 'Not Interested in Perfumes'
      WHEN cd.CustomerObjectionCategory = 'Purchase Readiness'   THEN 'Overstock/No Need for More'
      WHEN cd.CustomerObjectionCategory = 'Product issues'       THEN 'Negative Product Feedback'
      ELSE cd.CustomerObjectionCategory
    END`;

  const SUBCAT_CASE = `
    CASE
      WHEN cd.CustomerObjectionSubCategory = 'Didn''t like one of the perfumes' THEN 'Disappointed with perfume quality'
      WHEN cd.CustomerObjectionSubCategory = 'Already has enough perfumes'       THEN 'Already has too many perfumes'
      WHEN cd.CustomerObjectionSubCategory = 'Already has the same product'      THEN 'Already has too many perfumes'
      WHEN cd.CustomerObjectionSubCategory = 'Already has too many perfumes'     THEN 'Already has too many perfumes'
      WHEN cd.CustomerObjectionSubCategory = 'Already Owns Enough'               THEN 'Already has too many perfumes'
      WHEN cd.CustomerObjectionSubCategory = 'Overstock/No Need for More'        THEN 'Already has too many perfumes'
      ELSE cd.CustomerObjectionSubCategory
    END`;

  const posBreakdownRaw = await querySource<{
    main_objection: string;
    objection_count: number;
    failed_rebuttal: number;
    successful_rebuttal: number;
    sale_count: number;
  }>(`
    SELECT
      ${MAIN_OBJECTION_CASE}                                                      AS main_objection,
      COUNT(*)                                                                    AS objection_count,
      SUM(CASE WHEN COALESCE(cd.SaleDone, 0) = 0 THEN 1 ELSE 0 END)             AS failed_rebuttal,
      SUM(CASE WHEN COALESCE(cd.SaleDone, 0) = 1 THEN 1 ELSE 0 END)             AS successful_rebuttal,
      SUM(CASE WHEN COALESCE(cd.SaleDone, 0) = 1 THEN 1 ELSE 0 END)             AS sale_count
    FROM db_external.CallDetails cd
    WHERE cd.CallDate BETWEEN ? AND ? ${cf}${campF}
      ${BASE_FILTER}
    GROUP BY 1
    ORDER BY objection_count DESC
  `, baseParams);

  const posSubcategoryRaw = await querySource<{
    cx_objection_subcat: string;
    objection_count: number;
    failed_rebuttal: number;
    successful_rebuttal: number;
    sale_count: number;
  }>(`
    SELECT
      ${SUBCAT_CASE}                                                              AS cx_objection_subcat,
      COUNT(*)                                                                    AS objection_count,
      SUM(CASE WHEN COALESCE(cd.SaleDone, 0) = 0 THEN 1 ELSE 0 END)             AS failed_rebuttal,
      SUM(CASE WHEN COALESCE(cd.SaleDone, 0) = 1 THEN 1 ELSE 0 END)             AS successful_rebuttal,
      SUM(CASE WHEN COALESCE(cd.SaleDone, 0) = 1 THEN 1 ELSE 0 END)             AS sale_count
    FROM db_external.CallDetails cd
    WHERE cd.CallDate BETWEEN ? AND ? ${cf}${campF}
      ${BASE_FILTER}
    GROUP BY 1
    ORDER BY objection_count DESC
  `, baseParams);

  return {
    posBreakdown: posBreakdownRaw.map(r => ({
      mainObjection:      String(r.main_objection),
      objectionCount:     Number(r.objection_count),
      failedRebuttal:     Number(r.failed_rebuttal),
      successfulRebuttal: Number(r.successful_rebuttal),
      saleCount:          Number(r.sale_count),
    })),
    posSubcategory: posSubcategoryRaw.map(r => ({
      cxObjectionSubcat:  String(r.cx_objection_subcat),
      objectionCount:     Number(r.objection_count),
      failedRebuttal:     Number(r.failed_rebuttal),
      successfulRebuttal: Number(r.successful_rebuttal),
      saleCount:          Number(r.sale_count),
    })),
  };
}

/* ─── Clients Summary (KPIs per client, single query) ────────────────────── */

export interface ClientKPISummary {
  client_id:      number;
  client_name:    string;
  total_calls:    number;
  sales:          number;
  conversion_pct: number;
  total_feedback: number;
  promoters:      number;
  detractors:     number;
  nps_score:      number;
  positive_pct:   number;
  valid_calls:    number;
  ops:            number;
}

export async function getAgentNPSCSAT(filters: QualityFilters): Promise<AgentNPSRow[]> {
  const { startDate, endDate } = filters;
  const { sql: cf, params: cfParams } = clientClause(filters);
  const { sql: campF, params: campParams } = campaignClause(filters);
  const params = [startDate, endDate, ...cfParams, ...campParams];

  const rows = await querySource<{
    agent: string; agentId: string; calls: number;
    promoter: number; passive: number; detractor: number;
    csat: number | null; nps: number | null;
  }>(`
    SELECT
      COALESCE(am.AgentName, cd.AgentName) AS agent,
      cd.AgentName AS agentId,
      COUNT(*) AS calls,
      SUM(CASE WHEN cd.Feedback = 'Positive' THEN 1 ELSE 0 END) AS promoter,
      SUM(CASE WHEN cd.Feedback = 'Neutral'  THEN 1 ELSE 0 END) AS passive,
      SUM(CASE WHEN cd.Feedback = 'Negative' THEN 1 ELSE 0 END) AS detractor,
      ROUND(
        SUM(CASE WHEN cd.Feedback IN ('Positive','Neutral') THEN 1 ELSE 0 END) * 100.0 /
        NULLIF(SUM(CASE WHEN cd.Feedback IN ('Positive','Negative','Neutral') THEN 1 ELSE 0 END), 0),
        1
      ) AS csat,
      ROUND(
        (SUM(CASE WHEN cd.Feedback = 'Positive' THEN 1 ELSE 0 END) * 100.0 /
         NULLIF(SUM(CASE WHEN cd.Feedback IN ('Positive','Negative','Neutral') THEN 1 ELSE 0 END), 0))
        -
        (SUM(CASE WHEN cd.Feedback = 'Negative' THEN 1 ELSE 0 END) * 100.0 /
         NULLIF(SUM(CASE WHEN cd.Feedback IN ('Positive','Negative','Neutral') THEN 1 ELSE 0 END), 0)),
        1
      ) AS nps
    FROM db_external.CallDetails cd
    LEFT JOIN db_masmis.AgentMaster am ON am.MasId = cd.AgentName COLLATE utf8mb4_unicode_ci
    WHERE cd.Feedback IN ('Positive','Negative','Neutral')
      AND cd.CallDate BETWEEN ? AND ? ${cf}${campF}
      AND cd.AgentName IS NOT NULL AND cd.AgentName != ''
    GROUP BY cd.AgentName, am.AgentName
    HAVING calls >= 1
    ORDER BY csat DESC
  `, params);

  return rows.map(r => ({
    agent:     String(r.agent),
    agentId:   String(r.agentId),
    calls:     Number(r.calls),
    promoter:  Number(r.promoter),
    passive:   Number(r.passive),
    detractor: Number(r.detractor),
    csat:      Number(r.csat ?? 0),
    nps:       Number(r.nps ?? 0),
  }));
}

export async function getClientsSummary(filters: QualityFilters): Promise<ClientKPISummary[]> {
  const { startDate, endDate } = filters;
  const rows = await querySource<{
    client_id:      number;
    client_name:    string;
    total_calls:    number;
    sales:          number;
    conversion_pct: number | null;
    total_feedback: number;
    promoters:      number;
    detractors:     number;
    nps_score:      number | null;
    positive_pct:   number | null;
    valid_calls:    number;
    ops:            number;
  }>(`
    SELECT
      cd.client_id,
      COALESCE(c.name, CONCAT('Client ', cd.client_id))                              AS client_name,
      COUNT(*)                                                                         AS total_calls,
      SUM(CASE WHEN COALESCE(cd.SaleDone, 0) = 1 THEN 1 ELSE 0 END)                 AS sales,
      ROUND(
        SUM(CASE WHEN COALESCE(cd.SaleDone, 0) = 1 THEN 1 ELSE 0 END) * 100.0
        / NULLIF(COUNT(*), 0), 1
      )                                                                                AS conversion_pct,
      SUM(CASE WHEN cd.Feedback IN ('Positive','Negative','Neutral') THEN 1 ELSE 0 END) AS total_feedback,
      SUM(CASE WHEN cd.Feedback = 'Positive' THEN 1 ELSE 0 END)                     AS promoters,
      SUM(CASE WHEN cd.Feedback = 'Negative' THEN 1 ELSE 0 END)                     AS detractors,
      ROUND(
        (SUM(CASE WHEN cd.Feedback = 'Positive' THEN 1 ELSE 0 END) * 100.0
          / NULLIF(SUM(CASE WHEN cd.Feedback IN ('Positive','Negative','Neutral') THEN 1 ELSE 0 END), 0))
        - (SUM(CASE WHEN cd.Feedback = 'Negative' THEN 1 ELSE 0 END) * 100.0
          / NULLIF(SUM(CASE WHEN cd.Feedback IN ('Positive','Negative','Neutral') THEN 1 ELSE 0 END), 0)),
        1
      )                                                                                AS nps_score,
      ROUND(
        SUM(CASE WHEN cd.Feedback = 'Positive' THEN 1 ELSE 0 END) * 100.0
        / NULLIF(SUM(CASE WHEN cd.Feedback IN ('Positive','Negative','Neutral') THEN 1 ELSE 0 END), 0),
        1
      )                                                                                AS positive_pct,
      SUM(CASE WHEN cd.CustomerObjectionCategory IS NOT NULL
                AND cd.CustomerObjectionCategory != '' THEN 1 ELSE 0 END)            AS valid_calls,
      SUM(CASE WHEN cd.CustomerObjectionCategory IS NOT NULL
                AND cd.CustomerObjectionCategory != ''
                AND (cd.AfterListeningOfferRejected = 1
                     OR COALESCE(cd.SaleDone, 0) = 1
                     OR cd.ObjectionHandlingContext = 'None'
                     OR cd.ContactSettingContext = 'None')
               THEN 1 ELSE 0 END)                                                    AS ops
    FROM db_external.CallDetails cd
    LEFT JOIN shivamgiri.md_clients c ON c.dialdesk_client_id = cd.client_id
    WHERE cd.client_id IS NOT NULL AND cd.client_id != 0
      AND cd.MobileNo IS NOT NULL AND cd.MobileNo != ''
      AND cd.CallDate BETWEEN ? AND ?
    GROUP BY cd.client_id, c.name
    ORDER BY client_name ASC
  `, [startDate, endDate]);

  return rows.map(r => ({
    client_id:      Number(r.client_id),
    client_name:    String(r.client_name),
    total_calls:    Number(r.total_calls),
    sales:          Number(r.sales),
    conversion_pct: Number(r.conversion_pct ?? 0),
    total_feedback: Number(r.total_feedback),
    promoters:      Number(r.promoters),
    detractors:     Number(r.detractors),
    nps_score:      Number(r.nps_score ?? 0),
    positive_pct:   Number(r.positive_pct ?? 0),
    valid_calls:    Number(r.valid_calls),
    ops:            Number(r.ops),
  }));
}

// ─── Agent-wise NPS ────────────────────────────────────────────────────────────

export async function getAgentNPS(filters: QualityFilters): Promise<AgentNPSDetailRow[]> {
  const { startDate, endDate } = filters;
  const { sql: cf, params: cfParams } = clientClause(filters);
  const { sql: campF, params: campParams } = campaignClause(filters);
  const params = [startDate, endDate, ...cfParams, ...campParams];

  const rows = await querySource<{
    agent_id:   string;
    agent_name: string;
    detractor: number;
    passive: number;
    promoter: number;
    total: number;
    nps_score: number | null;
  }>(`
    SELECT
      cd.AgentName                                                                     AS agent_id,
      COALESCE(am.AgentName, cd.AgentName)                                            AS agent_name,
      SUM(CASE WHEN cd.Feedback = 'Negative' THEN 1 ELSE 0 END)                      AS detractor,
      SUM(CASE WHEN cd.Feedback = 'Neutral'  THEN 1 ELSE 0 END)                      AS passive,
      SUM(CASE WHEN cd.Feedback = 'Positive' THEN 1 ELSE 0 END)                      AS promoter,
      COUNT(*)                                                                          AS total,
      ROUND(
        (SUM(CASE WHEN cd.Feedback = 'Positive' THEN 1 ELSE 0 END) * 100.0 /
         NULLIF(COUNT(*), 0))
        -
        (SUM(CASE WHEN cd.Feedback = 'Negative' THEN 1 ELSE 0 END) * 100.0 /
         NULLIF(COUNT(*), 0)),
        2
      )                                                                                AS nps_score
    FROM db_external.CallDetails cd
    LEFT JOIN db_masmis.AgentMaster am ON am.MasId = cd.AgentName COLLATE utf8mb4_unicode_ci
    WHERE cd.Feedback IN ('Positive','Negative','Neutral')
      AND cd.AgentName IS NOT NULL AND TRIM(cd.AgentName) != ''
      AND cd.CallDate BETWEEN ? AND ? ${cf}${campF}
    GROUP BY cd.AgentName, am.AgentName
    ORDER BY nps_score DESC
  `, params);

  return rows.map(r => ({
    agentId:   String(r.agent_id),
    agentName: String(r.agent_name),
    detractor: Number(r.detractor),
    passive:   Number(r.passive),
    promoter:  Number(r.promoter),
    total:     Number(r.total),
    npsScore:  Number(r.nps_score ?? 0),
  }));
}

export interface OutboundMissingAgentRow {
  agentId:     string;
  total_count: number;
}

export interface ClapCard {
  clap: string;
  count: number;       // unique MobileNo for Customer, call count for others
  calls: number;
  avgQuality: number;
}

export interface ClapScenarioDrill {
  scenario: string;
  calls: number;
  pct: number;
  subScenarios: { name: string; calls: number; pct: number }[];
}

export interface ClapFeedbackDrill {
  feedbackType: string;
  calls: number;
  pct: number;
  reasons: { reason: string; calls: number; pct: number; avgQuality: number }[];
}

export interface ClapAnalysisResponse {
  cards: ClapCard[];
  drills: {
    customer: ClapScenarioDrill[];
    logistic: ClapFeedbackDrill[];
    agent: ClapFeedbackDrill[];
    product: ClapFeedbackDrill[];
  };
}

/**
 * Build a CLAP-category CASE expression (reused across queries).
 * No "Other" — everything maps to Customer / Logistic / Agent / Product.
 */
const CLAP_CASE = `
  CASE
    WHEN q.scenario IN ('Query','General Query','General Queries','Feedback','Unclear','Short Call/Blank Call','Repeat','Customer Profile','Brand','Marketing','Content','Collaboration Request') THEN 'Customer'
    WHEN q.scenario IN ('Return/Exchange','Return Request','Return & Exchange','Wrong product','Product Issue','Pricing','Refund Status','Refund issue','Refund Request','Tech issue','Policies and FAQs','Sale Done') THEN 'Product'
    WHEN q.scenario IN ('Delivery Issue','Post Order','Order Status','Reverse Pickup Issue','Pending payment','Payment issues','Wallet issue') THEN 'Logistic'
    WHEN q.scenario IN ('Needs Improvement','Hold Procedure','Transfer','') THEN 'Agent'
    WHEN q.scenario = 'Complaint' THEN
      CASE
        WHEN q.scenario1 IS NULL OR q.scenario1 = '' THEN 'Product'
        WHEN q.scenario1 LIKE '%Dispatch%' OR q.scenario1 LIKE '%Delivery%' OR q.scenario1 LIKE '%RTO%' OR q.scenario1 = 'Delivery Fail'
          OR q.scenario1 LIKE '%Late dispatch%' OR q.scenario1 LIKE '%No communication%' OR q.scenario1 LIKE '%Fake remark%'
          OR q.scenario1 LIKE '%Extra Charge%' OR q.scenario1 LIKE '%Misbehave%' OR q.scenario1 LIKE '%Delivery Boy%'
          OR q.scenario1 LIKE '%Delivery Delay%' OR q.scenario1 LIKE '%POD%' OR q.scenario1 LIKE '%Courier%' THEN 'Logistic'
        WHEN q.scenario1 LIKE '%Fraud%' THEN 'Agent'
        ELSE 'Product'
      END
    ELSE 'Agent'
  END`;

export async function getClapAnalysis(filters: QualityFilters): Promise<ClapAnalysisResponse> {
  const { startDate, endDate } = filters;
  const params: (string | number)[] = [startDate, endDate];
  const cf = filters.clientId ? ' AND q.ClientId = ?' : '';
  if (filters.clientId) params.push(filters.clientId);
  const whereDate = `q.CallDate BETWEEN ? AND ? ${cf} AND q.scenario IS NOT NULL AND q.scenario != ''`;

  const clap = CLAP_CASE;

  // ── 1) Card-level data: count (unique MobileNo for Customer) + calls + avgQuality ──
  const cards = await Promise.all(
    (['Customer', 'Logistic', 'Agent', 'Product'] as const).map(async (clapName) => {
      const p = [...params];
      const cardParams: (string | number)[] = [...p];
      const [row] = await querySource<{ count: number; calls: number; avgQuality: number }>(
        clapName === 'Customer'
          ? `SELECT COUNT(DISTINCT q.MobileNo) AS count, COUNT(*) AS calls,
                    ROUND(AVG(q.quality_percentage),2) AS avgQuality
             FROM db_audit.call_quality_assessment q
             WHERE ${whereDate} AND q.MobileNo IS NOT NULL AND q.MobileNo != '' AND ${clap} = 'Customer'`
          : `SELECT COUNT(*) AS count, COUNT(*) AS calls,
                    ROUND(AVG(q.quality_percentage),2) AS avgQuality
             FROM db_audit.call_quality_assessment q
             WHERE ${whereDate} AND ${clap} = '${clapName}'`,
        cardParams,
      );
      return { clap: clapName, count: Number(row.count), calls: Number(row.calls), avgQuality: Number(row.avgQuality) };
    }),
  );

  // ── 2) Customer drill: scenario → sub-scenario ──
  const customerScenarios = await querySource<{ scenario: string; calls: number }>(
    `SELECT q.scenario, COUNT(*) AS calls
     FROM db_audit.call_quality_assessment q
     WHERE ${whereDate} AND q.MobileNo IS NOT NULL AND q.MobileNo != '' AND ${clap} = 'Customer'
     GROUP BY q.scenario ORDER BY calls DESC`,
    params,
  );

  const customerDrill: ClapScenarioDrill[] = [];
  for (const s of customerScenarios) {
    const subs = await querySource<{ name: string; calls: number }>(
      `SELECT COALESCE(NULLIF(TRIM(q.scenario1),''),'—') AS name, COUNT(*) AS calls
       FROM db_audit.call_quality_assessment q
       WHERE ${whereDate} AND q.MobileNo IS NOT NULL AND q.MobileNo != ''
         AND ${clap} = 'Customer' AND q.scenario = ?
       GROUP BY q.scenario1 ORDER BY calls DESC LIMIT 10`,
      [...params, s.scenario],
    );
    const subList = subs.map(r => ({ name: String(r.name), calls: Number(r.calls), pct: Math.round(Number(r.calls) / Number(s.calls) * 100 * 10) / 10 }));
    customerDrill.push({
      scenario: String(s.scenario),
      calls: Number(s.calls),
      pct: 0,
      subScenarios: subList,
    });
  }
  const custTotal = customerDrill.reduce((a, b) => a + b.calls, 0);
  customerDrill.forEach(s => { s.pct = custTotal > 0 ? Math.round(s.calls / custTotal * 100 * 10) / 10 : 0; });

  // ── 3) Drill for Logistic, Agent, Product: feedbackType → reasons ──
  async function buildFeedbackDrill(clapName: string): Promise<ClapFeedbackDrill[]> {
    const fbRows = await querySource<{ feedbackType: string; calls: number }>(
      `SELECT
        CASE
          WHEN q.scenario = 'Complaint' THEN 'Complaint'
          WHEN q.scenario IN ('Request','Return Request','Return/Exchange','Return & Exchange','Refund Request','Pre Order','Collaboration Request') THEN 'Request'
          WHEN q.scenario IN ('Query','General Query','General Queries','Order Status','Post Order','Policies and FAQs') THEN 'Query'
          ELSE 'Other'
        END AS feedbackType,
        COUNT(*) AS calls
       FROM db_audit.call_quality_assessment q
       WHERE ${whereDate} AND ${clap} = '${clapName}'
       GROUP BY feedbackType ORDER BY calls DESC`,
      params,
    );
    const fbTotal = fbRows.reduce((a, b) => a + Number(b.calls), 0);
    const result: ClapFeedbackDrill[] = [];
    for (const fb of fbRows) {
      const ft = String(fb.feedbackType);
      const fc = Number(fb.calls);
      const reasons = await querySource<{ reason: string; calls: number; avgQuality: number }>(
        `SELECT COALESCE(NULLIF(TRIM(q.scenario1),''),'—') AS reason,
                COUNT(*) AS calls,
                ROUND(AVG(q.quality_percentage),2) AS avgQuality
         FROM db_audit.call_quality_assessment q
         WHERE ${whereDate} AND ${clap} = '${clapName}'
           AND CASE
             WHEN q.scenario = 'Complaint' THEN 'Complaint'
             WHEN q.scenario IN ('Request','Return Request','Return/Exchange','Return & Exchange','Refund Request','Pre Order','Collaboration Request') THEN 'Request'
             WHEN q.scenario IN ('Query','General Query','General Queries','Order Status','Post Order','Policies and FAQs') THEN 'Query'
             ELSE 'Other'
           END = ?
         GROUP BY q.scenario1 ORDER BY calls DESC LIMIT 15`,
        [...params, ft],
      );
      const rTotal = reasons.reduce((a, b) => a + Number(b.calls), 0);
      result.push({
        feedbackType: ft,
        calls: fc,
        pct: fbTotal > 0 ? Math.round(fc / fbTotal * 100 * 10) / 10 : 0,
        reasons: reasons.map(r => ({
          reason: String(r.reason),
          calls: Number(r.calls),
          pct: rTotal > 0 ? Math.round(Number(r.calls) / rTotal * 100 * 10) / 10 : 0,
          avgQuality: Number(r.avgQuality),
        })),
      });
    }
    return result;
  }

  const [logisticDrill, agentDrill, productDrill] = await Promise.all([
    buildFeedbackDrill('Logistic'),
    buildFeedbackDrill('Agent'),
    buildFeedbackDrill('Product'),
  ]);

  return {
    cards,
    drills: { customer: customerDrill, logistic: logisticDrill, agent: agentDrill, product: productDrill },
  };
}

export async function getOutboundMissingAgents(filters: QualityFilters): Promise<OutboundMissingAgentRow[]> {
  const { startDate, endDate } = filters;
  const { sql: cf, params: cfParams } = clientClause(filters);
  const { sql: campF, params: campParams } = campaignClause(filters);
  const params: (string | number)[] = [startDate, endDate, ...cfParams, ...campParams];

  const rows = await querySource<{ agentId: string; total_count: number }>(`
    SELECT
      cd.AgentName       AS agentId,
      COUNT(*)           AS total_count
    FROM db_external.CallDetails cd
    LEFT JOIN db_masmis.AgentMaster am ON am.MasId = cd.AgentName COLLATE utf8mb4_unicode_ci
    WHERE cd.Feedback IN ('Positive','Negative','Neutral')
      AND cd.AgentName IS NOT NULL AND TRIM(cd.AgentName) != ''
      AND cd.CallDate BETWEEN ? AND ?
      AND am.MasId IS NULL
      ${cf}${campF}
    GROUP BY cd.AgentName
    ORDER BY total_count DESC
  `, params);

  return rows.map(r => ({
    agentId:     String(r.agentId),
    total_count: Number(r.total_count),
  }));
}

export async function insertAgentMaster(agent: { masId: string; agentName: string; lob: string }): Promise<void> {
  await getSourcePool().execute(
    `INSERT INTO db_masmis.AgentMaster (MasId, AgentName, Lob)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE AgentName = VALUES(AgentName), Lob = VALUES(Lob)`,
    [agent.masId, agent.agentName, agent.lob],
  );
}

export interface LOBAgent {
  lob: string;
  agent_ids: string[];
}

// Bellavita LOB mapping — hardcoded because AgentMaster.Lob just says 'Outbound' for everyone.
// When AgentMaster is updated with correct LOB values, switch back to the DB query below.
const BELLAVITA_LOB_MAP: Record<string, string[]> = {
  'Repeat Customer LOB': [
    'MAS59391','MAS57009','MAS60695','MAS57081','MAS57075','MAS57102','MAS59390',
    'MAS61125','MAS61112','MAS61714','MAS61110','MAS57104','MAS61107','MAS57101',
    'MAS61392','MAS61692','MAS61700','MAS61395','MAS61713','MAS61393','MAS61685',
    'MAS59063','MAS61699','MAS61717','MAS61108',
  ],
  'Abandon Cart': [
    'MAS54531','MAS61389','MAS60705','MAS57076','MAS61111','MAS60702','MAS61113','MAS60701',
  ],
};

export async function getLOBOptions(filters: QualityFilters): Promise<LOBAgent[]> {
  const { startDate, endDate, clientId } = filters;

  // Only Bellavita (375) has the LOB split right now
  if (clientId && String(clientId) === '375') {
    // Narrow to agents who actually appear in CallDetails for this date range
    const { sql: cf, params: cfParams } = clientClause(filters);
    const params = [startDate, endDate, ...cfParams];
    const activeRows = await querySource<{ MasId: string }>(`
      SELECT DISTINCT cd.AgentName AS MasId
      FROM db_external.CallDetails cd
      WHERE cd.CallDate BETWEEN ? AND ?
        AND cd.AgentName IS NOT NULL AND TRIM(cd.AgentName) != ''
        ${cf}
    `, params);
    const activeSet = new Set(activeRows.map(r => String(r.MasId).trim()));

    const result: LOBAgent[] = [];
    for (const [lob, ids] of Object.entries(BELLAVITA_LOB_MAP)) {
      const activeIds = ids.filter(id => activeSet.has(id));
      if (activeIds.length > 0) result.push({ lob, agent_ids: activeIds });
    }
    return result;
  }

  // Fallback: query DB (works for clients whose AgentMaster has real LOB values)
  const { sql: cf, params: cfParams } = clientClause(filters);
  const params = [startDate, endDate, ...cfParams];
  const rows = await querySource<{ MasId: string; Lob: string }>(`
    SELECT DISTINCT am.MasId, COALESCE(am.Lob, 'Unknown') AS Lob
    FROM db_external.CallDetails cd
    JOIN db_masmis.AgentMaster am ON am.MasId = cd.AgentName COLLATE utf8mb4_unicode_ci
    WHERE cd.CallDate BETWEEN ? AND ?
      AND cd.AgentName IS NOT NULL AND TRIM(cd.AgentName) != ''
      ${cf}
    ORDER BY Lob, MasId
  `, params);

  const lobMap = new Map<string, string[]>();
  for (const r of rows) {
    const lob = String(r.Lob).trim() || 'Unknown';
    const id = String(r.MasId).trim();
    if (!lobMap.has(lob)) lobMap.set(lob, []);
    lobMap.get(lob)!.push(id);
  }
  return Array.from(lobMap.entries()).map(([lob, agent_ids]) => ({ lob, agent_ids }));
}

// ── Magical Script ────────────────────────────────────────────────────────────

// Bellavita's outbound funnel is driven by a different set of CallDetails columns (Opening,
// ContactSettingCategory, ContactSettingContext, OpeningPitchCategory, Offered, Category/
// SubCategory) than the generic AfterListeningOfferRejected/ObjectionHandlingContext-based flow
// every other client used to use — see getColumnBasedMagicalScript. GNC and Neemans' CallDetails
// data was verified to follow the exact same column conventions (same literal ContactSettingCategory
// values, same '0'/'1'/'None' Opening/Offered pattern), so they share this calculation path too.
// Bellavita's OP/CSP scripts stay hardcoded below (verbatim business copy given for it specifically);
// GNC/Neemans' scripts are stored in shivamgiri.md_magical_scripts, editable via the same "Edit
// Scripts" admin UI the generic flow uses.
const BELLAVITA_CLIENT_ID = '375';
const COLUMN_BASED_CLIENTS: Record<string, string> = {
  '375': 'Bellavita',
  '409': 'GNC',
  '475': "Neeman's",
  // Verified before adding (not assumed): Finnable's CallDetails rows populate Opening (5,050 of
  // 9,493 calls), Offered (4,683), ContactSettingContext (1,865) and Category/SubCategory with a
  // real, distinct taxonomy (General Disinterest, Eligibility Barrier, Requirement of Loan, ...) —
  // same column shape as Bellavita/GNC/Neeman's, just loan-domain content instead of retail.
  '497': 'Finnable',
  // Verified before adding: Reginald Men's CallDetails populate Opening/Offered/ContactSettingContext
  // (835 of 1,008 calls over Jul 1-Aug 6), and its magical_script_cache rows carry op_success/csp_success/
  // offer_success/sale_done/product_offering/resolved_category — same column shape as the other retail
  // clients (GNC/Neeman's), populated Aug 1-6 (140 calls, 10 sales).
  '481': 'Reginald Men',
  // Verified before adding: Bla Bli Blu's CallDetails populate Opening/Offered/ContactSettingContext
  // (985 of 1,288 calls over Aug 1-6) with a real perfume-domain taxonomy, and its magical_script_cache
  // rows carry op_success/csp_success/offer_success/sale_done/product_offering/resolved_category
  // (1,288 calls, 540 sales, 385 category rows) — same column shape as the other retail clients.
  '487': 'Bla Bli Blu',
  // Verified before adding: Housing Premium's CallDetails populate Opening (92/101), Offered
  // (93/101) and ContactSettingContext (57/101) with a real, distinct real-estate-domain
  // Category/SubCategory taxonomy (Service Requirement Issues, Pricing Concerns, Concern About
  // Brokerage, Need Time to Decide, ...) — same column shape as the other column-based clients.
  '419': 'Housing Premium',
};

// Reserved for excluding a specific stale/misconfigured campaign_id from a client's data, if one is
// ever confirmed. NOT populated: for Neemans (475), the two campaigns turned out to be sequential,
// not parallel — NEEMANSC ran Jan-Mar 2026 and was retired, NEEM_OUT has been the sole active
// campaign since Apr 2026 — so excluding either one hides real, current data rather than bad data.
// The mismatched product-offering text seen under NEEM_OUT is a genuine source data-quality issue
// (confirmed to exist in db_external.CallDetails itself), not something safe to filter out here.
const CAMPAIGN_ALLOWLIST: Record<string, string[]> = {};

const BELLAVITA_OP_SCRIPT =
  `Good Morning/Afternoon/Evening.\n\n` +
  `Thank you for choosing Bella Vita.\n\n` +
  `Am I speaking with Mr./Ms. {Customer Name}?\n\n` +
  `Is this a good time to talk for just two minutes?`;

const BELLAVITA_CSP_SCRIPTS: { category: string; label: string; text: string }[] = [
  {
    category: 'Feedback before Offer Pitch',
    label: 'Feedback before Offer Pitch',
    text:
      `I'm calling from Bella Vita regarding your recent purchase of {Product Name}.\n\n` +
      `We're calling to understand your experience with the product and to share an exclusive benefit available only for our existing customers.\n\n` +
      `Main bas yeh jaana chahta/chahti hoon ki aapka overall experience kaisa raha?\n\n` +
      `Kya aapko product ki quality, fragrance aur performance pasand aayi?`,
  },
  {
    category: 'Feedback&Offer Pitch Same Time',
    label: 'Feedback & Offer Pitch Same Time',
    text:
      `Sir/Ma'am, yeh call aapke recent purchase {Product Name} ke feedback ke liye hai. Mujhe umeed hai ki aapko product pasand aaya hoga. ` +
      `Saath hi, aaj hum aapke liye ek exclusive Bella Vita repeat customer offer bhi lekar aaye hain. Offer share karne se pehle, main aapka feedback jaana chahta/chahti hoon.`,
  },
];

// First-match-wins — mirrors the exact CASE the categories were specified with. Two entries key off
// SubCategory rather than Category (their real values happen to live in that column for Bellavita).
// Verified against live data (not guessed): the original 9-entry list was silently dropping
// 'General Disinterest' — Bellavita's single LARGEST category at 30,908 calls, more than every
// other category combined — plus 'Purchase Readiness' (18,937) and several smaller-but-real ones,
// because anything not matching a WHEN fell through to ELSE NULL and was excluded from the whole
// categories breakdown. Extended with every category confirmed to have meaningful, clean volume;
// left out one-off/inconsistent free-text variants (various "Feedback & Offer ..." labels, each
// under 20 occurrences) that look like agent typos rather than a real taxonomy entry.
const BELLAVITA_CATEGORY_CASE_SQL = `CASE
  WHEN cd.Category = 'General Disinterest' THEN 'General Disinterest'
  WHEN cd.Category = 'Purchase Readiness' THEN 'Purchase Readiness'
  WHEN cd.Category = 'Already Owns Enough' THEN 'Already Owns Enough'
  WHEN cd.Category = 'Delivery & Purchase Considerations' THEN 'Delivery & Purchase Considerations'
  WHEN cd.Category = 'Fragrance Concerns' THEN 'Fragrance Concerns'
  WHEN cd.SubCategory = 'Not Interested in Perfumes' THEN 'Not Interested in Perfumes'
  WHEN cd.Category = 'Pricing Concerns' THEN 'Pricing Concerns'
  WHEN cd.Category = 'Product Issues' THEN 'Product Issues'
  WHEN cd.SubCategory = 'Overstock/No Need for More' THEN 'Overstock/No Need for More'
  WHEN cd.Category = 'Service Issues' THEN 'Service Issues'
  WHEN cd.Category = 'Product Quality Concerns' THEN 'Product Quality Concerns'
  WHEN cd.Category = 'Satisfied but No Immediate Need' THEN 'Satisfied but No Immediate Need'
  WHEN cd.Category = 'No Immediate Action' THEN 'No Immediate Action'
  WHEN cd.Category = 'Gifting & Purchase Motivation' THEN 'Gifting & Purchase Motivation'
  WHEN cd.Category = 'Trust & Data Security Issues' THEN 'Trust & Data Security Issues'
  WHEN cd.Category = 'Trust & Payment Concerns' THEN 'Trust & Payment Concerns'
  WHEN cd.Category = 'Delivery Issues' THEN 'Delivery Issues'
  WHEN cd.Category = 'Financial & Timing Constraints' THEN 'Financial & Timing Constraints'
  ELSE NULL
END`;

// Bellavita keeps its exact hand-specified taxonomy (above) so its already-verified category
// breakdown never changes. Every other column-based client (GNC, Neemans, ...) gets a generic
// fallback: raw Category value, or SubCategory if Category is blank/None — no per-client CASE
// needed, since the objection-script editor lets you map a script to whatever real value shows up.
const RESOLVED_CATEGORY_CASE_SQL = `CASE
  WHEN cd.client_id = 375 THEN (${BELLAVITA_CATEGORY_CASE_SQL})
  ELSE (
    CASE
      WHEN cd.Category IS NOT NULL AND cd.Category NOT IN ('', 'None') THEN LEFT(cd.Category, 120)
      WHEN cd.SubCategory IS NOT NULL AND cd.SubCategory NOT IN ('', 'None') THEN LEFT(cd.SubCategory, 120)
      ELSE NULL
    END
  )
END`;

const BELLAVITA_CATEGORY_SCRIPTS: Record<string, string> = {
  'Already Owns Enough':
    `Ma'am, main samajh sakta hoon ki aapke paas already similar products hain. Lekin agar aap site se purchase karte hain, toh cost ₹1500-₹1600 hogi. ` +
    `Par main aapko sirf ₹999 mein 3 premium 100ml perfumes offer kar sakta hoon. Iske saath exclusive discounts aur additional gifts bhi milenge, jo sirf limited time ke liye available hain. ` +
    `Ye ek special deal hai jo aapko app par nahi milegi. Kya main aapke liye best fragrance options share karoon?`,
  'Delivery & Purchase Considerations':
    `Sir, main aapki concern bilkul samajh sakta hoon. Agar aapko payment mein koi issue ho raha hai, toh main aapki madad kar sakta hoon taaki transaction smoothly complete ho sake. ` +
    `Agar delivery ya order receive karne mein koi dikkat hai, toh main ensure karunga ki wo jaldi se resolve ho jaye. Saath hi, main aapko payment process guide kar sakta hoon aur turant aapko payment link share kar deta hoon. ` +
    `Aap chahein toh on-call hi apna order place kar sakte hain.`,
  'Fragrance Concerns':
    `Sir, I sincerely appreciate your feedback and apologize for any inconvenience you faced. I want to assure you that based on customer insights, we have upgraded our perfumes with an improved oil concentration, ` +
    `providing long-lasting fragrance for up to 7-8 hours. Additionally, we have recently launched four new premium perfumes, which offer a superior experience. As a valued customer, we also have an exclusive offer for you. ` +
    `Would you like me to share the details?`,
  'Not Interested in Perfumes':
    `Sir/Ma'am, 🔹 Gifting Angle – Samajhta hoon ki agar aap khud perfumes nahi use karte, toh aapke friends ya family mein koi aisa ho sakta hai jo fragrances ka fan ho. 👑 ` +
    `Aur haan, agar aapko body care ya skincare products chahiye, toh humare paas killer shower gels, body lotions, aur skincare options bhi hain jo gift ke liye always hit hote hain. Aapke loved ones ko definitely pasand aayenge! 🎁`,
  'Pricing Concerns':
    `Exclusive Limited-Time Offer Just for You! Sir/Ma'am, agar aap prepaid karte ho toh delivery charges free milenge plus ek ₹99 ke mast gift bhi milega! Aur haan, products humare totally high-quality, zero side-effect wale hain, ` +
    `bilkul daily use ke liye perfect. Samajh sakta hoon ki budget matter karta hai, lekin sach ye hai ki prices abhi stable hain par jaldi badh sakte hain aur stocks bhi tez sell ho rahe hain. ` +
    `Toh abhi le lo apne fave products, warna baad mein price zyada dena padega? 😊`,
  'Product Issues':
    `Sir, maafi chaahenge iske regarding. Main aapka feedback share kar doongi. Agar aap long-lasting fragrance chaahte hain, to hamari newly launched Uniquex category try kijiye. Iski fragrance aur lasting power dono hi kaafi demand mein hain. ` +
    `Agar aapko specific fragrance chaahiye, to main aapke preference ke according best option suggest kar sakti hoon. Saath hi, agar aap allow karein, to main aapke liye ek exclusive offer bhi add karwa sakti hoon, jo aapke last purchase se bhi better hoga. ` +
    `Aapko premium quality aur best discount dono milega. Kya main aapke order mein add kar doon?`,
  'Overstock/No Need for More':
    `Bilkul samajh sakta hoon! Waise bhi, jo deal main aaj de raha hoon, wo future mein mile, ye guaranteed nahi. Agar aap aaj lene ka decide karte hain toh aapko price bhi best milega. ` +
    `Aur haan, BellaVita products ki shelf life bhi kaafi lambi hoti hai, toh fresh stock mil jayega. Waise aapko bataun, skincare aur body care mein bhi hamare kuch killer products hain, jo aapke routine ko next level banayenge. Thoda suggest karoon?`,
  'Service Issues':
    `Sir/Ma'am, I completely understand your concerns, and I truly appreciate your time. I want to assure you that we are here to provide you with the best service. Regarding your previous concerns, we have improved our delivery process to ensure that parcels are handed directly to the customer with proper notification. ` +
    `Additionally, I understand that you've already been informed about our offers, but I just wanted to highlight a special deal that might interest you. We're offering an exclusive discount along with a hassle-free return policy and a secure payment method for your convenience. Let me know how I can assist you further!`,
  'Product Quality Concerns':
    `Maafi chaahoongi sir, jo bhi aapko concern raha. Kya aap mujhe bata sakte hain ki exact issue kya tha—long-lasting ya fragrance ka. Sir, aapke feedback ke liye dhanyavaad. Humne is concern par kaafi kaam kiya hai aur ab fragrances ko aur long-lasting aur premium quality ka banaya gaya hai. ` +
    `Iske saath hi, hum aaj ke liye sirf valuable customers ke liye ek exclusive offer bhi la rahe hain. Agar aap chahein to main aapko mild aur long-lasting category ke kuchh naye options suggest kar sakti hoon jo aapke preference ke according best rahenge. ` +
    `Is baar sir, ek special trial pack bhi diya ja raha hai jo aapke pasand ke fragrance ke saath aata hai. Kya main aapke liye is offer ka benefit check kar sakti hoon?`,
};

// ── Magical Script cache ────────────────────────────────────────────────────────
// Every query above (Bellavita's 5 + the generic flow's 2) was a live scan over CallDetails —
// none of Opening/ContactSettingContext/OpeningPitchCategory/Offered/Category/SubCategory/
// CustomerObjectionCategory/ObjectionHandlingContext/AfterListeningOfferRejected are indexed, so
// each one costs real per-row evaluation time. Measured at ~2.5 minutes for Bellavita alone
// (178K rows) even after parallelizing. Same fix as Outbound Customer Interaction Insights: a
// background job pre-classifies every call once into a small, fully-indexed cache table in
// db_masmis, and both getBellavitaMagicalScript/getMagicalScript read only from that cache.
//
// Unlike the Insights cache (which only needed a recent rolling window), Magical Script supports
// picking any historical date range, so this cache needs full-table coverage, not just "last 30
// days". The backfill walks id DESCENDING (newest calls classified first, so whatever date range
// a user is actually looking at right now — usually the current/last month — becomes fast almost
// immediately) and eventually reaches every historical row.
export async function initMagicalScriptCacheTables(): Promise<void> {
  const pool = getMasmisPool();
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS db_masmis.magical_script_cache (
        call_id             INT PRIMARY KEY,
        client_id           INT NOT NULL,
        call_date           DATETIME NOT NULL,
        op_success          TINYINT(1) NULL,
        csp_success         TINYINT(1) NOT NULL DEFAULT 0,
        csp_call_end        TINYINT(1) NOT NULL DEFAULT 0,
        csp_variant         VARCHAR(20) NULL,
        offer_success       TINYINT(1) NOT NULL DEFAULT 0,
        product_offering    VARCHAR(255) NULL,
        resolved_category   VARCHAR(120) NULL,
        sale_done           TINYINT(1) NOT NULL DEFAULT 0,
        call_stage          VARCHAR(20) NOT NULL DEFAULT 'opening_rejected',
        objection_category  VARCHAR(120) NULL,
        offered_pitch_context VARCHAR(500) NULL,
        campaign_id         VARCHAR(20) NULL,
        computed_at         DATETIME DEFAULT NOW(),
        INDEX idx_client_date (client_id, call_date)
      )
    `);

    // Migration for a table created before GNC/Neemans support widened resolved_category to hold
    // arbitrary real Category/SubCategory text (not just Bellavita's short hand-picked labels).
    const [colRows] = await pool.execute(`
      SELECT CHARACTER_MAXIMUM_LENGTH AS len FROM information_schema.columns
      WHERE TABLE_SCHEMA = 'db_masmis' AND TABLE_NAME = 'magical_script_cache' AND COLUMN_NAME = 'resolved_category'
    `);
    const currentLen = Number((colRows as { len: number }[])[0]?.len ?? 120);
    let migrated = false;
    if (currentLen < 120) {
      await pool.execute(`ALTER TABLE db_masmis.magical_script_cache MODIFY COLUMN resolved_category VARCHAR(120) NULL`);
      migrated = true;
    }

    // Migration for a table created before per-category offer-pitch text support.
    const [ctxColRows] = await pool.execute(`
      SELECT COLUMN_NAME FROM information_schema.columns
      WHERE TABLE_SCHEMA = 'db_masmis' AND TABLE_NAME = 'magical_script_cache' AND COLUMN_NAME = 'offered_pitch_context'
    `);
    if ((ctxColRows as unknown[]).length === 0) {
      await pool.execute(`ALTER TABLE db_masmis.magical_script_cache ADD COLUMN offered_pitch_context VARCHAR(500) NULL`);
      migrated = true;
    }

    // Migration for a table created before campaign-level filtering support (CAMPAIGN_ALLOWLIST).
    const [campColRows] = await pool.execute(`
      SELECT COLUMN_NAME FROM information_schema.columns
      WHERE TABLE_SCHEMA = 'db_masmis' AND TABLE_NAME = 'magical_script_cache' AND COLUMN_NAME = 'campaign_id'
    `);
    if ((campColRows as unknown[]).length === 0) {
      await pool.execute(`ALTER TABLE db_masmis.magical_script_cache ADD COLUMN campaign_id VARCHAR(20) NULL`);
      migrated = true;
    }

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS db_masmis.magical_script_cursor (
        id      TINYINT PRIMARY KEY DEFAULT 1,
        next_id INT NOT NULL DEFAULT 0
      )
    `);
    const [cursorRows] = await pool.execute(`SELECT next_id FROM db_masmis.magical_script_cursor WHERE id = 1`);
    // Re-seed a fully-consumed cursor (next_id = 0) to a 30-day lookback so it starts picking up
    // new rows again instead of staying dead forever — see processMagicalScriptBatch. A fresh table
    // seeds from 0 so the whole history gets classified, matching the original intent.
    if ((cursorRows as any[]).length === 0) {
      await pool.execute(`INSERT INTO db_masmis.magical_script_cursor (id, next_id) VALUES (1, 0)`);
    } else if (migrated || Number((cursorRows as { next_id: number }[])[0].next_id) === 0) {
      const seedRows = await querySource<{ minId: number }>(
        `SELECT COALESCE(MIN(id), 0) AS minId FROM db_external.CallDetails WHERE CallDate >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
      );
      const seedId = Math.max(0, Number(seedRows[0]?.minId ?? 0) - 1);
      await pool.execute(`UPDATE db_masmis.magical_script_cursor SET next_id = ? WHERE id = 1`, [seedId]);
    }
  } catch (err) {
    console.error('[quality] initMagicalScriptCacheTables warning:', (err as Error).message);
  }
}

async function processMagicalScriptBatch(batchSize = 1000): Promise<number> {
  const [cursorRow] = await queryMasmis<{ next_id: number }>(
    `SELECT next_id FROM db_masmis.magical_script_cursor WHERE id = 1`
  );
  const nextId = cursorRow?.next_id ?? 0;

  type Row = {
    id: number; client_id: number; CallDate: string;
    op_success: number | null; csp_success: number; csp_call_end: number; csp_variant: string | null;
    offer_success: number; product_offering: string | null; resolved_category: string | null;
    sale_done: number; call_stage: string; objection_category: string | null;
    offered_pitch_context: string | null; campaign_id: string | null;
  };

  const rows = await querySource<Row>(`
    SELECT
      cd.id, cd.client_id, cd.CallDate,
      CASE WHEN cd.Opening IS NULL OR cd.Opening = 'None' THEN NULL
           WHEN cd.Opening IN ('', '0') THEN 0 ELSE 1 END AS op_success,
      CASE WHEN cd.ContactSettingContext IS NOT NULL AND cd.ContactSettingContext NOT IN ('', 'None') THEN 1 ELSE 0 END AS csp_success,
      CASE WHEN
            (cd.OpeningPitchCategory IS NOT NULL AND cd.OpeningPitchCategory NOT IN ('', 'None', '["None"]', '[]'))
            AND (cd.ContactSettingContext IS NULL OR cd.ContactSettingContext = 'None')
          THEN 1 ELSE 0 END AS csp_call_end,
      CASE WHEN cd.ContactSettingCategory = 'Feedback before Offer Pitch' THEN 'before'
           WHEN cd.ContactSettingCategory IN ('Feedback&Offer Pitch Same Time', 'Feedback & Offer Pitch Same Time') THEN 'same'
           ELSE NULL END AS csp_variant,
      CASE WHEN cd.Offered = '1' THEN 1 ELSE 0 END AS offer_success,
      CASE WHEN cd.Offered = '1' AND cd.ProductOffering IS NOT NULL AND cd.ProductOffering NOT IN ('', 'None') THEN LEFT(cd.ProductOffering, 255) ELSE NULL END AS product_offering,
      ${RESOLVED_CATEGORY_CASE_SQL} AS resolved_category,
      CASE WHEN cd.SaleDone = '1' THEN 1 ELSE 0 END AS sale_done,
      CASE
        WHEN cd.AfterListeningOfferRejected = 1 OR cd.SaleDone = 1 THEN 'post_offer'
        WHEN cd.ObjectionHandlingContext = 'None'                   THEN 'offering_rejected'
        WHEN cd.ContactSettingContext    = 'None'                   THEN 'context_rejected'
        ELSE 'opening_rejected'
      END AS call_stage,
      CASE WHEN cd.CustomerObjectionCategory IS NOT NULL AND cd.CustomerObjectionCategory NOT IN ('', 'None') THEN cd.CustomerObjectionCategory ELSE NULL END AS objection_category,
      -- Excludes the leaked prompt-instruction artifact some AI-summarized calls carry when the
      -- summarizer had nothing to report ("Context of the product offer presented. If not
      -- mentioned, return 'None'.") — real question data, not a real pitch context.
      CASE WHEN cd.OfferedPitchContext IS NOT NULL
             AND cd.OfferedPitchContext NOT IN ('', 'None', "Context of the product offer presented. If not mentioned, return 'None'.")
           THEN LEFT(cd.OfferedPitchContext, 500) ELSE NULL END AS offered_pitch_context,
      cd.campaign_id
    FROM db_external.CallDetails cd
    WHERE cd.id > ? AND cd.MobileNo IS NOT NULL AND cd.MobileNo != ''
      AND cd.client_id IS NOT NULL
    ORDER BY cd.id ASC
    LIMIT ${Number(batchSize)}
  `, [nextId]);

  if (rows.length === 0) return 0;

  const cols = [
    'call_id', 'client_id', 'call_date',
    'op_success', 'csp_success', 'csp_call_end', 'csp_variant',
    'offer_success', 'product_offering', 'resolved_category',
    'sale_done', 'call_stage', 'objection_category', 'offered_pitch_context', 'campaign_id',
  ];
  const placeholders = rows.map(() => `(${cols.map(() => '?').join(',')},NOW())`).join(',');
  const flat = rows.flatMap(r => [
    r.id, r.client_id, r.CallDate,
    r.op_success, r.csp_success, r.csp_call_end, r.csp_variant,
    r.offer_success, r.product_offering, r.resolved_category,
    r.sale_done, r.call_stage, r.objection_category, r.offered_pitch_context, r.campaign_id,
  ]);
  const updateCols = cols.filter(c => c !== 'call_id').map(c => `${c} = VALUES(${c})`).join(', ');

  await queryMasmis(`
    INSERT INTO db_masmis.magical_script_cache (${cols.join(', ')}, computed_at)
    VALUES ${placeholders}
    ON DUPLICATE KEY UPDATE ${updateCols}, computed_at = NOW()
  `, flat);

  const newNextId = rows[rows.length - 1].id; // highest id in this ASC-ordered batch
  await queryMasmis(`UPDATE db_masmis.magical_script_cursor SET next_id = ? WHERE id = 1`, [newNextId]);

  return rows.length;
}

let magicalScriptCacheRunning = false;
async function runMagicalScriptCatchUp(): Promise<void> {
  if (magicalScriptCacheRunning) return;
  magicalScriptCacheRunning = true;
  try {
    let processed = 0;
    do {
      processed = await processMagicalScriptBatch(1000);
      if (processed > 0) await new Promise(r => setTimeout(r, 300));
    } while (processed > 0);
  } catch (err) {
    console.error('[quality] magical script cache batch error:', (err as Error).message);
  } finally {
    magicalScriptCacheRunning = false;
  }
}

export function startMagicalScriptCacheJob(): void {
  runMagicalScriptCatchUp().catch(() => {});
  const timer = setInterval(() => { runMagicalScriptCatchUp().catch(() => {}); }, 5 * 60 * 1000);
  if (typeof timer.unref === 'function') timer.unref();
}

async function magicalScriptCacheStatus(): Promise<{ cachedThrough: string | null }> {
  const [row] = await queryMasmis<{ last_computed: string | null }>(
    `SELECT MAX(computed_at) AS last_computed FROM db_masmis.magical_script_cache`
  );
  return { cachedThrough: row?.last_computed ? String(row.last_computed) : null };
}

export interface BellavitaStageMetrics {
  total_in: number;
  call_end: number;
  success: number;
  success_rate: number;
  contribution: number;
  contribution_rate: number;
}
export interface BellavitaMagicalScriptData {
  variant: 'bellavita';
  op: BellavitaStageMetrics & { script: string };
  csp: BellavitaStageMetrics & { scripts: { label: string; text: string; count: number }[] };
  offer: BellavitaStageMetrics & { script: string; topProduct: string | null; products: { product: string; count: number }[] };
  categories: {
    category: string; script: string; total: number; contribution_pct: number; call_end: number; sale_done: number; conv_pct: number;
    topContext: string | null; contexts: { text: string; count: number }[];
  }[];
  cachedThrough: string | null;
}

async function getColumnBasedMagicalScript(filters: QualityFilters): Promise<BellavitaMagicalScriptData> {
  const { startDate, endDate } = filters;
  const dialdeskClientId = Number(filters.clientId);
  const isBellavita = filters.clientId === BELLAVITA_CLIENT_ID;
  const baseParams = [startDate, endDate];
  const pct = (n: number, d: number) => d > 0 ? Math.round((n / d) * 1000) / 10 : 0;

  const allowedCampaigns = filters.clientId ? CAMPAIGN_ALLOWLIST[filters.clientId] : undefined;
  const campaignClause = allowedCampaigns ? ` AND campaign_id IN (${allowedCampaigns.map(() => '?').join(',')})` : '';
  const campaignParams: string[] = allowedCampaigns ?? [];
  const params = [...baseParams, ...campaignParams];

  // All 5 reads come from the pre-classified db_masmis cache (see initMagicalScriptCacheTables /
  // processMagicalScriptBatch above) instead of scanning CallDetails live — that's what cut this
  // from ~2.5 minutes down to near-instant.
  const [opRows, cspRows, offerRows, products, categoryRows, contextRows, status, configRows] = await Promise.all([
    // OP: op_success is NULL for the excluded population (Opening IS NULL/'None'); COUNT(op_success)
    // naturally skips those rows, matching "do not count None value".
    queryMasmis<{ total: number; call_end: number; success: number; sale_contrib: number }>(`
      SELECT
        COUNT(op_success) AS total,
        SUM(CASE WHEN op_success = 0 THEN 1 ELSE 0 END) AS call_end,
        SUM(CASE WHEN op_success = 1 THEN 1 ELSE 0 END) AS success,
        SUM(CASE WHEN op_success IS NOT NULL AND sale_done = 1 THEN 1 ELSE 0 END) AS sale_contrib
      FROM db_masmis.magical_script_cache
      WHERE client_id = ${dialdeskClientId} AND call_date BETWEEN ? AND ?${campaignClause}
    `, params),

    // CSP: population = calls that passed Opening.
    queryMasmis<{
      total: number; call_end: number; success: number; sale_contrib: number;
      feedback_before: number; feedback_same: number;
    }>(`
      SELECT
        COUNT(*) AS total,
        SUM(csp_call_end) AS call_end,
        SUM(csp_success) AS success,
        SUM(sale_done) AS sale_contrib,
        SUM(CASE WHEN csp_variant = 'before' THEN 1 ELSE 0 END) AS feedback_before,
        SUM(CASE WHEN csp_variant = 'same' THEN 1 ELSE 0 END) AS feedback_same
      FROM db_masmis.magical_script_cache
      WHERE client_id = ${dialdeskClientId} AND call_date BETWEEN ? AND ? AND op_success = 1${campaignClause}
    `, params),

    // Offer: population = calls that passed CSP.
    queryMasmis<{ total: number; call_end: number; success: number; sale_contrib: number }>(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN offer_success = 0 THEN 1 ELSE 0 END) AS call_end,
        SUM(offer_success) AS success,
        SUM(CASE WHEN offer_success = 1 AND sale_done = 1 THEN 1 ELSE 0 END) AS sale_contrib
      FROM db_masmis.magical_script_cache
      WHERE client_id = ${dialdeskClientId} AND call_date BETWEEN ? AND ? AND op_success = 1 AND csp_success = 1${campaignClause}
    `, params),

    queryMasmis<{ product: string; n: number }>(`
      SELECT product_offering AS product, COUNT(*) AS n
      FROM db_masmis.magical_script_cache
      WHERE client_id = ${dialdeskClientId} AND call_date BETWEEN ? AND ?
        AND offer_success = 1 AND product_offering IS NOT NULL${campaignClause}
      GROUP BY product_offering
      ORDER BY n DESC
    `, params),

    // Capped at 20 (not 4) so the frontend can show the top 4 by default and let the user expand to
    // see the rest, instead of silently hiding every category past the 4th.
    queryMasmis<{ resolved_category: string; total: number; sales: number }>(`
      SELECT resolved_category, COUNT(*) AS total, SUM(sale_done) AS sales
      FROM db_masmis.magical_script_cache
      WHERE client_id = ${dialdeskClientId} AND call_date BETWEEN ? AND ? AND resolved_category IS NOT NULL${campaignClause}
      GROUP BY resolved_category
      ORDER BY total DESC
      LIMIT 20
    `, params),

    // Real per-category pitch text (OfferedPitchContext, cached as offered_pitch_context) for
    // clients that don't have an admin-authored objection script yet — same idea as the top-product
    // surfacing above, grouped per category instead of globally. Capped per category in JS below
    // since these are full sentences (up to 500 chars), not short labels like product names.
    queryMasmis<{ resolved_category: string; context: string; n: number }>(`
      SELECT resolved_category, offered_pitch_context AS context, COUNT(*) AS n
      FROM db_masmis.magical_script_cache
      WHERE client_id = ${dialdeskClientId} AND call_date BETWEEN ? AND ?
        AND resolved_category IS NOT NULL AND offered_pitch_context IS NOT NULL${campaignClause}
      GROUP BY resolved_category, offered_pitch_context
      ORDER BY resolved_category, n DESC
      LIMIT 2000
    `, params),

    magicalScriptCacheStatus(),

    // Bellavita's OP/CSP scripts stay hardcoded (below) — everyone else's come from
    // shivamgiri.md_magical_scripts, editable via the same "Edit Scripts" admin UI the generic
    // flow uses, so a new column-based client never needs a code change to get real script text.
    isBellavita ? Promise.resolve([]) : getMagicalScriptConfig(dialdeskClientId),
  ]);
  const [opRow] = opRows;
  const [cspRow] = cspRows;
  const [offerRow] = offerRows;

  const stage = (r: { total: number; call_end: number; success: number; sale_contrib: number } | undefined): BellavitaStageMetrics => {
    const total = Number(r?.total ?? 0);
    const success = Number(r?.success ?? 0);
    const contribution = Number(r?.sale_contrib ?? 0);
    return {
      total_in: total,
      call_end: Number(r?.call_end ?? 0),
      success,
      success_rate: pct(success, total),
      contribution,
      contribution_rate: pct(contribution, total),
    };
  };

  const totalCategoryCalls = categoryRows.reduce((s, r) => s + Number(r.total), 0) || 1;

  const opConfig    = configRows.find(r => r.stage === 'op');
  const cspConfig    = configRows.find(r => r.stage === 'csp');
  const offerConfig = configRows.find(r => r.stage === 'offer');
  const objectionConfig = configRows.filter(r => r.stage === 'objection');

  return {
    variant: 'bellavita',
    op: {
      ...stage(opRow),
      script: isBellavita ? BELLAVITA_OP_SCRIPT : (opConfig?.scriptText ?? ''),
    },
    csp: {
      ...stage(cspRow),
      scripts: isBellavita
        ? BELLAVITA_CSP_SCRIPTS.map(s => ({
            label: s.label,
            text: s.text,
            count: s.category === 'Feedback before Offer Pitch' ? Number(cspRow?.feedback_before ?? 0) : Number(cspRow?.feedback_same ?? 0),
          }))
        : (cspConfig ? [{ label: cspConfig.stageTitle, text: cspConfig.scriptText ?? '', count: Number(cspRow?.total ?? 0) }] : []),
    },
    offer: {
      ...stage(offerRow),
      // Product-offering data (ProductOffering column, cached as product_offering) is captured for
      // every column-based client, not just Bellavita — surface the top-contributing product + full
      // list here so the frontend's existing "click to view all products" modal works for GNC/Neemans
      // too. Falls back to the configured offer script only when there's no product data at all.
      script: isBellavita ? '' : (offerConfig?.scriptText ?? ''),
      topProduct: products[0]?.product ?? null,
      products: products.map(p => ({ product: p.product, count: Number(p.n) })),
    },
    categories: categoryRows.map(r => {
      const total = Number(r.total);
      const sales = Number(r.sales);
      const script = isBellavita
        ? (BELLAVITA_CATEGORY_SCRIPTS[r.resolved_category] ?? '')
        : (objectionConfig.find(c => c.objectionCategory === r.resolved_category)?.scriptText ?? '');
      // contextRows is pre-sorted DESC by count within each category (see query above), so the
      // first match here is already the top context; cap the "view all" list at 30 since these are
      // full sentences, not short labels.
      const contexts = contextRows
        .filter(c => c.resolved_category === r.resolved_category)
        .slice(0, 30)
        .map(c => ({ text: c.context, count: Number(c.n) }));
      return {
        category: r.resolved_category,
        script,
        total,
        contribution_pct: pct(total, totalCategoryCalls),
        call_end: total - sales,
        sale_done: sales,
        conv_pct: pct(sales, total),
        topContext: contexts[0]?.text ?? null,
        contexts,
      };
    }),
    cachedThrough: status.cachedThrough,
  };
}

export async function getMagicalScript(filters: QualityFilters) {
  if (filters.clientId && COLUMN_BASED_CLIENTS[filters.clientId]) {
    return getColumnBasedMagicalScript(filters);
  }

  const { startDate, endDate, clientId } = filters;
  const cacheDateParams = [startDate, endDate];
  const cacheClientFilter = clientId ? ' AND client_id = ?' : '';
  const cacheParams = clientId ? [...cacheDateParams, Number(clientId)] : cacheDateParams;

  // Resolve internal client id for the scripts config table
  const internalRow = clientId
    ? (await querySource<{ id: number }>(
        'SELECT id FROM shivamgiri.md_clients WHERE dialdesk_client_id = ? LIMIT 1',
        [Number(clientId)]
      ))[0] ?? null
    : null;
  const internalClientId = internalRow?.id ?? null;

  // flow/objections read from the same pre-classified db_masmis cache Bellavita uses (see
  // initMagicalScriptCacheTables / processMagicalScriptBatch above) instead of scanning
  // CallDetails live — same fix, same reason.
  const [scripts, flowRaw, objRaw, status] = await Promise.all([
    internalClientId
      ? querySource<{ stage: string; stage_title: string; objection_category: string | null; script_text: string | null; display_order: number }>(
          `SELECT stage, stage_title, objection_category, script_text, display_order
           FROM shivamgiri.md_magical_scripts
           WHERE client_id = ? AND is_active = 1
           ORDER BY display_order`,
          [internalClientId]
        )
      : ([] as { stage: string; stage_title: string; objection_category: string | null; script_text: string | null; display_order: number }[]),

    queryMasmis<{ total: number; op_pass: number; csp_pass: number; offer_pass: number; sale_done: number }>(`
      SELECT
        COUNT(*)                                                             AS total,
        SUM(CASE WHEN call_stage != 'opening_rejected' THEN 1 ELSE 0 END)    AS op_pass,
        SUM(CASE WHEN call_stage IN ('offering_rejected','post_offer') THEN 1 ELSE 0 END) AS csp_pass,
        SUM(CASE WHEN call_stage = 'post_offer'        THEN 1 ELSE 0 END)    AS offer_pass,
        SUM(sale_done)                                                       AS sale_done
      FROM db_masmis.magical_script_cache
      WHERE call_date BETWEEN ? AND ? ${cacheClientFilter}
    `, cacheParams),

    queryMasmis<{ cat: string; total: number; sales: number; conv_pct: number }>(`
      SELECT
        objection_category                                            AS cat,
        COUNT(*)                                                       AS total,
        SUM(sale_done)                                                 AS sales,
        ROUND(SUM(sale_done) * 100.0 / NULLIF(COUNT(*), 0), 1)         AS conv_pct
      FROM db_masmis.magical_script_cache
      WHERE call_date BETWEEN ? AND ? AND objection_category IS NOT NULL ${cacheClientFilter}
      GROUP BY objection_category
      ORDER BY total DESC
    `, cacheParams),

    magicalScriptCacheStatus(),
  ]);

  const f       = flowRaw[0] ?? { total: 0, op_pass: 0, csp_pass: 0, offer_pass: 0, sale_done: 0 };
  const total   = Math.max(Number(f.total),   1);
  const opPass  = Number(f.op_pass);
  const cspPass = Number(f.csp_pass);
  const offPass = Number(f.offer_pass);
  const saleDone= Number(f.sale_done);

  const pct = (n: number, d: number) => d > 0 ? Math.round(n / d * 100) : 0;

  const flowStages = [
    {
      stage: 'op',   title: scripts.find(s => s.stage === 'op')?.stage_title   ?? 'Magical OP',
      script: scripts.find(s => s.stage === 'op')?.script_text   ?? null,
      total_in: total,  passed: opPass,  dropped: total - opPass,
      success_rate: pct(opPass, total),  drop_rate: pct(total - opPass, total),
    },
    {
      stage: 'csp',  title: scripts.find(s => s.stage === 'csp')?.stage_title  ?? 'Magical CSP',
      script: scripts.find(s => s.stage === 'csp')?.script_text  ?? null,
      total_in: opPass, passed: cspPass, dropped: opPass - cspPass,
      success_rate: pct(cspPass, opPass), drop_rate: pct(opPass - cspPass, opPass),
    },
    {
      stage: 'offer',title: scripts.find(s => s.stage === 'offer')?.stage_title ?? 'Magical Offer',
      script: scripts.find(s => s.stage === 'offer')?.script_text ?? null,
      total_in: cspPass, passed: offPass, dropped: cspPass - offPass,
      success_rate: pct(offPass, cspPass), drop_rate: pct(cspPass - offPass, cspPass),
    },
  ];

  const totalObjCalls = objRaw.reduce((s, r) => s + Number(r.total), 0) || 1;
  const objections = scripts
    .filter(s => s.stage === 'objection')
    .map(s => {
      const m = objRaw.find(r => r.cat === s.objection_category);
      const tot = m ? Number(m.total) : 0;
      return {
        title:        s.stage_title,
        category:     s.objection_category,
        script:       s.script_text,
        total:        tot,
        sales:        m ? Number(m.sales)    : 0,
        conv_pct:     m ? Number(m.conv_pct) : 0,
        contribution: pct(tot, totalObjCalls),
      };
    });

  return {
    variant: 'generic' as const,
    summary: {
      total_calls:   Number(f.total),
      op_pass:       opPass,
      csp_pass:      cspPass,
      offer_pass:    offPass,
      sale_done:     saleDone,
      overall_conv:  Math.round(saleDone / total * 1000) / 10,
    },
    flow:       flowStages,
    objections,
    cachedThrough: status.cachedThrough,
  };
}

// ── Magical Script config editor (admin) ───────────────────────────────────────
// Lets a manager/admin type each process's OP/CSP/Offer + objection-handling scripts straight into
// the dashboard instead of needing a code change per process — this is what getMagicalScript above
// reads via shivamgiri.md_magical_scripts for every non-Bellavita outbound client.
export interface MagicalScriptConfigRow {
  id: number;
  stage: 'op' | 'csp' | 'offer' | 'objection';
  stageTitle: string;
  objectionCategory: string | null;
  scriptText: string | null;
  displayOrder: number;
}

async function resolveInternalClientId(dialdeskClientId: number, createIfMissing: boolean): Promise<number | null> {
  const row = (await querySource<{ id: number }>(
    'SELECT id FROM shivamgiri.md_clients WHERE dialdesk_client_id = ? LIMIT 1', [dialdeskClientId]
  ))[0];
  if (row) return row.id;
  if (!createIfMissing) return null;
  const [result] = await getSourcePool().execute(
    'INSERT INTO shivamgiri.md_clients (name, dialdesk_client_id) VALUES (?, ?)',
    [`Client ${dialdeskClientId}`, dialdeskClientId],
  );
  return (result as { insertId: number }).insertId;
}

export async function getMagicalScriptConfig(dialdeskClientId: number): Promise<MagicalScriptConfigRow[]> {
  const internalClientId = await resolveInternalClientId(dialdeskClientId, false);
  if (!internalClientId) return [];
  const rows = await querySource<{
    id: number; stage: string; stage_title: string; objection_category: string | null;
    script_text: string | null; display_order: number;
  }>(`
    SELECT id, stage, stage_title, objection_category, script_text, display_order
    FROM shivamgiri.md_magical_scripts
    WHERE client_id = ? AND is_active = 1
    ORDER BY FIELD(stage, 'op', 'csp', 'offer', 'objection'), display_order, id
  `, [internalClientId]);
  return rows.map(r => ({
    id: r.id,
    stage: r.stage as MagicalScriptConfigRow['stage'],
    stageTitle: r.stage_title,
    objectionCategory: r.objection_category,
    scriptText: r.script_text,
    displayOrder: Number(r.display_order),
  }));
}

export async function getMagicalScriptObjectionOptions(dialdeskClientId: number): Promise<string[]> {
  const rows = await queryMasmis<{ objection_category: string }>(`
    SELECT DISTINCT objection_category
    FROM db_masmis.magical_script_cache
    WHERE client_id = ? AND objection_category IS NOT NULL
    ORDER BY objection_category
  `, [dialdeskClientId]);
  return rows.map(r => r.objection_category);
}

export async function saveMagicalScriptConfig(dialdeskClientId: number, input: {
  id?: number; stage: string; stageTitle: string; objectionCategory: string | null; scriptText: string; displayOrder: number;
}): Promise<MagicalScriptConfigRow> {
  const internalClientId = await resolveInternalClientId(dialdeskClientId, true);
  const objectionCategory = input.stage === 'objection' ? (input.objectionCategory || null) : null;

  if (input.id) {
    await getSourcePool().execute(
      `UPDATE shivamgiri.md_magical_scripts
       SET stage = ?, stage_title = ?, objection_category = ?, script_text = ?, display_order = ?, updated_at = NOW()
       WHERE id = ? AND client_id = ?`,
      [input.stage, input.stageTitle, objectionCategory, input.scriptText, input.displayOrder, input.id, internalClientId],
    );
    return { id: input.id, stage: input.stage as MagicalScriptConfigRow['stage'], stageTitle: input.stageTitle, objectionCategory, scriptText: input.scriptText, displayOrder: input.displayOrder };
  }

  const [result] = await getSourcePool().execute(
    `INSERT INTO shivamgiri.md_magical_scripts (client_id, stage, stage_title, objection_category, script_text, display_order, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [internalClientId, input.stage, input.stageTitle, objectionCategory, input.scriptText, input.displayOrder],
  );
  const id = (result as { insertId: number }).insertId;
  return { id, stage: input.stage as MagicalScriptConfigRow['stage'], stageTitle: input.stageTitle, objectionCategory, scriptText: input.scriptText, displayOrder: input.displayOrder };
}

export async function deleteMagicalScriptConfig(dialdeskClientId: number, id: number): Promise<void> {
  const internalClientId = await resolveInternalClientId(dialdeskClientId, false);
  if (!internalClientId) return;
  await getSourcePool().execute(
    `DELETE FROM shivamgiri.md_magical_scripts WHERE id = ? AND client_id = ?`,
    [id, internalClientId],
  );
}

// ─── Customer Interaction Insights (Outbound) ─────────────────────────────────
// Same idea as the Inbound "Customer Interaction Insights" panel, but Outbound's
// CallDetails table has no pre-computed sentiment/VOC columns — everything here is
// derived by keyword-matching the raw TranscribeText column directly.

// Word-boundary-safe keyword matching — MySQL 8's ICU regex engine supports \b. This replaces a
// prior plain LIKE '%...%' approach that produced real false positives: "fir" (meant as the legal
// term) matched as a substring inside unrelated words like "first", and even matched as a whole
// word it collides with the common Hindi filler "fir" ("then") — pure noise in Hinglish transcripts.
// Bare "court" similarly matched inside unrelated mentions like "Court Road" (a street name, not a
// threat). Fix is two-fold: (1) enforce word boundaries so short tokens can't match mid-word, and
// (2) prefer specific multi-word phrases ("consumer court", "fir karunga") over bare ambiguous
// single words in the lists below — word-boundaries alone don't stop "court" the address word from
// matching "court" the legal term, only the phrase does. Terms ending in "*" are prefix/stems (left
// boundary only, e.g. "frustrat*" also matches "frustrated"/"frustrating"); terms without "*" must
// match as a whole word/phrase (both boundaries).
const esc = (term: string) => term.toLowerCase().replace(/'/g, "\\'");
const against = (terms: string[]) => {
  const parts = terms.map(t => {
    const stem = t.endsWith('*');
    const body = esc(stem ? t.slice(0, -1) : t);
    return stem ? `\\\\b${body}` : `\\\\b${body}\\\\b`;
  });
  return `REGEXP_LIKE(LOWER(cd.TranscribeText), '(${parts.join('|')})')`;
};
const stripStar = (k: string) => k.endsWith('*') ? k.slice(0, -1) : k;

// ── Legal / Social / Financial escalation, Refund & Cancellation intent — each an independent
// flag (a call can be both "Frustration" AND "Legal Escalation" at once), surfaced as their own
// headline cards / Critical Signal chips instead of being folded together under one "Threat" bucket.
const LEGAL_ESCALATION_KEYWORDS = [
  'consumer court', 'consumer forum', 'court case', 'court me jaunga', 'court me milte hain',
  'legal action', 'legal notice', 'court notice', 'notice bhejunga',
  'advocate', 'lawyer', 'vakil',
  'case karunga', 'case kar dunga',
  'police complaint', 'fir karunga',
  'cyber cell', 'cyber crime',
  'sue', 'lawsuit', 'consumer protection', 'ipc', 'national consumer helpline',
];
const OUTBOUND_LEGAL_COND = against(LEGAL_ESCALATION_KEYWORDS);

const SOCIAL_ESCALATION_KEYWORDS = [
  'social media', 'facebook', 'instagram', 'twitter', 'youtube', 'linkedin',
  'google review', 'negative review', '1 star review', 'viral',
  'post karunga', 'tweet', 'reel', 'complaint online',
  'social media par dalunga', 'viral kar dunga', 'facebook par dalunga',
  'instagram par dalunga', 'youtube par video banaunga', 'review dunga',
];
const OUTBOUND_SOCIAL_COND = against(SOCIAL_ESCALATION_KEYWORDS);

const FRAUD_KEYWORDS = [
  'fraud', 'financial fraud', 'scam', 'fake', 'cheat', 'cheated', 'cheating', 'dhokha',
  'loot', 'money lost', 'upi fraud', 'bank fraud', 'credit card fraud', 'debit card fraud',
  'payment fraud', 'cyber fraud', 'otp fraud', 'fraud hai', 'fraud kar rahe ho', 'dhokha diya',
  'fake company', 'fake product', 'paisa le liya',
];
const OUTBOUND_SCAM_COND = against(FRAUD_KEYWORDS);

const REFUND_KEYWORDS = [
  'refund', 'return money', 'money back', 'refund my payment', 'return my amount',
  'paisa wapas', 'refund chahiye', 'refund nahi diya',
];
const OUTBOUND_REFUND_COND = against(REFUND_KEYWORDS);

const CANCELLATION_KEYWORDS = [
  'cancel my order', 'dont want', 'not interested', 'close my request',
  'cancel kar do', 'nahi chahiye',
];
const OUTBOUND_CANCELLATION_COND = against(CANCELLATION_KEYWORDS);

const OUTBOUND_GOLDEN_WORDS: { category: string; keywords: string[] }[] = [
  { category: 'Courtesy & Gratitude', keywords: [
    'thank you', 'thanks', 'thank you so much', 'much appreciated', 'appreciate it',
    'thanks for your help', 'thank you for calling', 'thanks for explaining',
    'dhanyawad', 'bahut dhanyawad', 'shukriya', 'thanks bhai', 'thanks sir', 'thanks madam',
  ] },
  { category: 'Support & Assistance', keywords: [
    'can you help me', 'please help', 'need your support', 'guide me', 'please explain',
    'can you check', 'please assist', 'can you verify', 'help me understand',
    'help kar dijiye', 'samjha dijiye', 'please check', 'support chahiye',
  ] },
  { category: 'Acknowledgement & Underst.', keywords: [
    'i understand', 'understood', 'got it', 'okay', 'makes sense', 'i agree', 'correct',
    'samajh gaya', 'samajh gayi', 'theek hai', 'achha', 'bilkul',
  ] },
  { category: 'Positive Reinforcement', keywords: [
    'sounds good', 'looks good', 'thats fine', 'perfect', 'excellent', 'great', 'awesome',
    'wonderful', 'nice', 'good service', 'impressive', 'best service', 'very helpful',
    'achha hai', 'badhiya hai', 'theek lag raha hai', 'pasand aaya',
  ] },
  { category: 'Customer Satisfaction', keywords: [
    'satisfied', 'happy', 'no issues', 'everything is fine', 'no complaints', 'resolved',
    'issue solved', 'very good experience', 'good experience',
    'problem solve ho gaya', 'sab theek hai', 'satisfied hoon',
  ] },
  { category: 'Buying Intent', keywords: [
    'ill buy', 'book it', 'confirm order', 'proceed', 'go ahead', 'place my order',
    'im interested', 'ill take it', 'yes confirm', 'lets do it',
    'order kar dijiye', 'book kar dijiye', 'le lunga', 'le leti hoon',
  ] },
  { category: 'Trust Signals', keywords: [
    'i trust your company', 'reliable', 'authentic', 'genuine', 'original', 'official',
    'verified', 'company par trust hai', 'original product',
  ] },
];

// First-match-wins, mirroring the Inbound NEG_CAT_EXPR priority ordering. Legal/Social/Financial
// escalation and Refund/Cancellation intent live above as their own flags, not here — folding them
// into "Threat" used to double-count the same call under two different cards.
const CRITICAL_SIGNAL_GROUPS: { label: string; keywords: string[] }[] = [
  { label: 'Abuse', keywords: [
    'abusive*', 'insult*', 'offensive*', 'rude*', 'misbehave*', 'harass*',
    'idiot', 'stupid', 'cheater', 'shut up', 'fraud company',
  ] },
  { label: 'Threat', keywords: [
    'ill complain', 'complaint karunga', 'manager se baat karao', 'disconnect',
    'never buy again', 'escalate',
  ] },
  { label: 'Slang', keywords: [
    'bakvaas*', 'ghatiya*', 'bullshit*', 'farzi*', 'paagal*', 'barbaad*', 'nonsense*',
  ] },
  { label: 'Sarcasm', keywords: [
    'sarcastic*', 'yeah right', 'whatever*', 'haan haan', 'bahut badhiya',
  ] },
  { label: 'Frustration', keywords: [
    'frustrat*', 'disappoint*', 'dissatisf*', 'pathetic*', 'terrible*', 'horrible*',
    'awful*', 'worst*', 'angry*', 'not happy', 'not satisfied', 'pareshaan*', 'inconvenien*',
    'irritat*', 'annoying*', 'fed up', 'still not solved', 'poor service', 'bad service',
    'waste of time', 'tang aa gaya', 'bahut problem hai', 'bekar service',
  ] },
];

const OUTBOUND_CRITICAL_SIGNAL_CASE = `CASE
  ${CRITICAL_SIGNAL_GROUPS.map(g => `WHEN ${against(g.keywords)}\n    THEN '${g.label}'`).join('\n  ')}
  ELSE 'No'
END`;

const GOLDEN_COLS = [
  'golden_courtesy', 'golden_support', 'golden_ack', 'golden_positive',
  'golden_satisfaction', 'golden_buying', 'golden_trust',
];

// ─── Cache tables (db_masmis — ours, safe to index/write freely) ──────────────
// Classifying every request live against raw TranscribeText was measured at 70s+ even for a single
// modest client/month — CallDetails has no usable index for keyword search, and building one
// (FULLTEXT) contended badly with the live insert pipeline. Instead, a background job below
// incrementally classifies new calls in small batches and stores per-call flags here; the
// dashboard reads only from this small, fully-indexed cache table, so it's fast regardless of
// how big CallDetails gets.
export async function initOutboundInsightsTables(): Promise<void> {
  const pool = getMasmisPool();
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS db_masmis.outbound_call_insights (
        call_id             INT PRIMARY KEY,
        client_id           INT NOT NULL,
        call_date           DATETIME NOT NULL,
        lead_id             VARCHAR(100),
        agent_name          VARCHAR(100),
        mobile_no           VARCHAR(50),
        legal_flag          TINYINT(1) NOT NULL DEFAULT 0,
        social_flag         TINYINT(1) NOT NULL DEFAULT 0,
        scam_flag           TINYINT(1) NOT NULL DEFAULT 0,
        refund_flag         TINYINT(1) NOT NULL DEFAULT 0,
        cancellation_flag   TINYINT(1) NOT NULL DEFAULT 0,
        golden_courtesy     TINYINT(1) NOT NULL DEFAULT 0,
        golden_support      TINYINT(1) NOT NULL DEFAULT 0,
        golden_ack          TINYINT(1) NOT NULL DEFAULT 0,
        golden_positive     TINYINT(1) NOT NULL DEFAULT 0,
        golden_satisfaction TINYINT(1) NOT NULL DEFAULT 0,
        golden_buying       TINYINT(1) NOT NULL DEFAULT 0,
        golden_trust        TINYINT(1) NOT NULL DEFAULT 0,
        critical_signal     VARCHAR(20) NOT NULL DEFAULT 'No',
        computed_at         DATETIME DEFAULT NOW(),
        INDEX idx_client_date   (client_id, call_date),
        INDEX idx_client_legal  (client_id, legal_flag),
        INDEX idx_client_social (client_id, social_flag),
        INDEX idx_client_scam   (client_id, scam_flag),
        INDEX idx_client_refund (client_id, refund_flag),
        INDEX idx_client_cancel (client_id, cancellation_flag),
        INDEX idx_client_signal (client_id, critical_signal)
      )
    `);

    // Migration path for a table created before this taxonomy expansion (legal_flag/social_flag
    // replacing the old merged social_court_flag; golden_buying/golden_trust new; refund_flag/
    // cancellation_flag new). MySQL 8.0 doesn't support "ADD COLUMN IF NOT EXISTS" — check
    // information_schema first, same pattern used for the Neemans monthly_target migration.
    const [existingCols] = await pool.execute(`
      SELECT COLUMN_NAME FROM information_schema.columns
      WHERE TABLE_SCHEMA = 'db_masmis' AND TABLE_NAME = 'outbound_call_insights'
    `);
    const colNames = new Set((existingCols as { COLUMN_NAME: string }[]).map(c => c.COLUMN_NAME));
    const newCols: [string, string][] = [
      ['legal_flag',        'TINYINT(1) NOT NULL DEFAULT 0'],
      ['social_flag',       'TINYINT(1) NOT NULL DEFAULT 0'],
      ['refund_flag',       'TINYINT(1) NOT NULL DEFAULT 0'],
      ['cancellation_flag', 'TINYINT(1) NOT NULL DEFAULT 0'],
      ['golden_buying',     'TINYINT(1) NOT NULL DEFAULT 0'],
      ['golden_trust',      'TINYINT(1) NOT NULL DEFAULT 0'],
    ];
    let migrated = false;
    for (const [col, def] of newCols) {
      if (!colNames.has(col)) {
        await pool.execute(`ALTER TABLE db_masmis.outbound_call_insights ADD COLUMN ${col} ${def}`);
        migrated = true;
      }
    }
    if (migrated) {
      for (const stmt of [
        `ALTER TABLE db_masmis.outbound_call_insights ADD INDEX idx_client_legal (client_id, legal_flag)`,
        `ALTER TABLE db_masmis.outbound_call_insights ADD INDEX idx_client_social (client_id, social_flag)`,
        `ALTER TABLE db_masmis.outbound_call_insights ADD INDEX idx_client_refund (client_id, refund_flag)`,
        `ALTER TABLE db_masmis.outbound_call_insights ADD INDEX idx_client_cancel (client_id, cancellation_flag)`,
      ]) {
        try { await pool.execute(stmt); } catch { /* index may already exist on a fresh table */ }
      }
    }

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS db_masmis.outbound_insights_cursor (
        id TINYINT PRIMARY KEY DEFAULT 1,
        last_call_id INT NOT NULL DEFAULT 0
      )
    `);
    const [cursorRows] = await pool.execute(`SELECT last_call_id FROM db_masmis.outbound_insights_cursor WHERE id = 1`);
    // Seed ~30 days back so recent (dashboard-relevant) data backfills first, instead of
    // starting the catch-up from the oldest row in a 400K+ row table.
    const seedRows = await querySource<{ minId: number }>(
      `SELECT COALESCE(MIN(id), 0) AS minId FROM db_external.CallDetails WHERE CallDate >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
    );
    const seedId = Math.max(0, Number(seedRows[0]?.minId ?? 0) - 1);
    if ((cursorRows as any[]).length === 0) {
      await pool.execute(`INSERT INTO db_masmis.outbound_insights_cursor (id, last_call_id) VALUES (1, ?)`, [seedId]);
    } else if (migrated) {
      // Rewind so the catch-up job reclassifies the whole cached window under the new keyword
      // lists — otherwise previously-cached rows would keep stale classifications forever.
      await pool.execute(`UPDATE db_masmis.outbound_insights_cursor SET last_call_id = ? WHERE id = 1`, [seedId]);
    }
  } catch (err) {
    console.error('[quality] initOutboundInsightsTables warning:', (err as Error).message);
  }
}

async function processOutboundInsightsBatch(batchSize = 300): Promise<number> {
  const [cursorRow] = await queryMasmis<{ last_call_id: number }>(
    `SELECT last_call_id FROM db_masmis.outbound_insights_cursor WHERE id = 1`
  );
  const lastId = cursorRow?.last_call_id ?? 0;

  const goldenSelect = OUTBOUND_GOLDEN_WORDS
    .map((g, i) => `${against(g.keywords)} AS golden_${i}`)
    .join(',\n      ');

  type Row = {
    id: number; client_id: number; CallDate: string; LeadID: string | null;
    AgentName: string | null; MobileNo: string | null;
    legal: number; social: number; scam: number; refund: number; cancellation: number;
    critical_signal: string;
  } & Record<string, number>;

  const rows = await querySource<Row>(`
    SELECT cd.id, cd.client_id, cd.CallDate, cd.LeadID, cd.AgentName, cd.MobileNo,
      ${OUTBOUND_LEGAL_COND} AS legal,
      ${OUTBOUND_SOCIAL_COND} AS social,
      ${OUTBOUND_SCAM_COND} AS scam,
      ${OUTBOUND_REFUND_COND} AS refund,
      ${OUTBOUND_CANCELLATION_COND} AS cancellation,
      ${goldenSelect},
      ${OUTBOUND_CRITICAL_SIGNAL_CASE} AS critical_signal
    FROM db_external.CallDetails cd
    WHERE cd.id > ? AND cd.TranscribeText IS NOT NULL AND cd.TranscribeText != ''
    ORDER BY cd.id ASC
    LIMIT ${Number(batchSize)}
  `, [lastId]);

  if (rows.length === 0) return 0;

  // Column list drives both the placeholder count and the ON DUPLICATE UPDATE clause — generated
  // rather than hand-counted, since a manual mismatch here has bitten this exact query before.
  const cols = [
    'call_id', 'client_id', 'call_date', 'lead_id', 'agent_name', 'mobile_no',
    'legal_flag', 'social_flag', 'scam_flag', 'refund_flag', 'cancellation_flag',
    'golden_courtesy', 'golden_support', 'golden_ack', 'golden_positive', 'golden_satisfaction',
    'golden_buying', 'golden_trust',
    'critical_signal',
  ];
  const placeholders = rows.map(() => `(${cols.map(() => '?').join(',')},NOW())`).join(',');
  const flat = rows.flatMap(r => [
    r.id, r.client_id, r.CallDate, r.LeadID, r.AgentName, r.MobileNo,
    r.legal, r.social, r.scam, r.refund, r.cancellation,
    r.golden_0, r.golden_1, r.golden_2, r.golden_3, r.golden_4, r.golden_5, r.golden_6,
    r.critical_signal,
  ]);
  const updateCols = cols.filter(c => c !== 'call_id').map(c => `${c} = VALUES(${c})`).join(', ');

  await queryMasmis(`
    INSERT INTO db_masmis.outbound_call_insights (${cols.join(', ')}, computed_at)
    VALUES ${placeholders}
    ON DUPLICATE KEY UPDATE ${updateCols}, computed_at = NOW()
  `, flat);

  const newLastId = rows[rows.length - 1].id;
  await queryMasmis(`UPDATE db_masmis.outbound_insights_cursor SET last_call_id = ? WHERE id = 1`, [newLastId]);

  return rows.length;
}

let outboundInsightsRunning = false;
async function runOutboundInsightsCatchUp(): Promise<void> {
  if (outboundInsightsRunning) return;
  outboundInsightsRunning = true;
  try {
    let processed = 0;
    do {
      processed = await processOutboundInsightsBatch(300);
      if (processed > 0) await new Promise(r => setTimeout(r, 500)); // be a good citizen on a shared DB
    } while (processed > 0);
  } catch (err) {
    console.error('[quality] outbound insights batch error:', (err as Error).message);
  } finally {
    outboundInsightsRunning = false;
  }
}

export function startOutboundInsightsJob(): void {
  runOutboundInsightsCatchUp().catch(() => {});
  const timer = setInterval(() => { runOutboundInsightsCatchUp().catch(() => {}); }, 5 * 60 * 1000);
  if (typeof timer.unref === 'function') timer.unref();
}

export interface OutboundCustomerInsights {
  audit_count: number;
  legal_escalation_count: number;
  social_escalation_count: number;
  potential_scam: number;
  refund_count: number;
  cancellation_count: number;
  frustration_count: number;
  threat_count: number;
  cuss_abuse_count: number;
  slang_count: number;
  sarcasm_count: number;
  golden_words: { category: string; count: number; keywords: string[] }[];
  cached_through: string | null;
}

export async function getCustomerInteractionInsights(filters: QualityFilters): Promise<OutboundCustomerInsights> {
  const { startDate, endDate, clientId } = filters;
  const cf = clientId ? ' AND client_id = ?' : '';
  const params: (string | number)[] = [startDate, endDate, ...(clientId ? [Number(clientId)] : [])];

  const goldenSelect = GOLDEN_COLS.map((c, i) => `SUM(${c}) AS gw_${i}`).join(',\n      ');

  const [[summary], signalRows, cursorRows] = await Promise.all([
    queryMasmis<{ audit_count: number; legal: number; social: number; scam: number; refund: number; cancellation: number } & Record<string, number>>(`
      SELECT
        COUNT(*) AS audit_count,
        SUM(legal_flag) AS legal,
        SUM(social_flag) AS social,
        SUM(scam_flag) AS scam,
        SUM(refund_flag) AS refund,
        SUM(cancellation_flag) AS cancellation,
        ${goldenSelect}
      FROM db_masmis.outbound_call_insights
      WHERE call_date BETWEEN ? AND ? ${cf}
    `, params),

    queryMasmis<{ critical_signal: string; cnt: number }>(`
      SELECT critical_signal, COUNT(*) AS cnt
      FROM db_masmis.outbound_call_insights
      WHERE call_date BETWEEN ? AND ? ${cf}
      GROUP BY critical_signal
    `, params),

    queryMasmis<{ last_computed: string | null }>(`
      SELECT MAX(computed_at) AS last_computed FROM db_masmis.outbound_call_insights
    `),
  ]);

  const signalMap = new Map(signalRows.map(r => [String(r.critical_signal), Number(r.cnt)]));

  return {
    audit_count:              Number(summary?.audit_count ?? 0),
    legal_escalation_count:   Number(summary?.legal ?? 0),
    social_escalation_count:  Number(summary?.social ?? 0),
    potential_scam:           Number(summary?.scam ?? 0),
    refund_count:             Number(summary?.refund ?? 0),
    cancellation_count:       Number(summary?.cancellation ?? 0),
    frustration_count:        signalMap.get('Frustration') ?? 0,
    threat_count:              signalMap.get('Threat')      ?? 0,
    cuss_abuse_count:          signalMap.get('Abuse')       ?? 0,
    slang_count:               signalMap.get('Slang')       ?? 0,
    sarcasm_count:              signalMap.get('Sarcasm')     ?? 0,
    golden_words: OUTBOUND_GOLDEN_WORDS.map((g, i) => ({
      category: g.category,
      count:    Number(summary?.[`gw_${i}`] ?? 0),
      keywords: g.keywords,
    })),
    cached_through: cursorRows[0]?.last_computed ? String(cursorRows[0].last_computed) : null,
  };
}

export interface OutboundInsightLead {
  callId: number; leadId: string; agentName: string; mobileNo: string; callDate: string;
  type: string; matchedWord: string;
}
export interface OutboundInsightDrillResponse { leads: OutboundInsightLead[]; }

const CATEGORY_TYPE_LABEL: Record<string, string> = {
  legal: 'Legal Escalation', social: 'Social Media', scam: 'Financial Fraud',
  refund: 'Refund Demand', cancellation: 'Cancellation Intent',
};

function keywordsForCategory(category: string): string[] {
  if (category === 'legal') return LEGAL_ESCALATION_KEYWORDS;
  if (category === 'social') return SOCIAL_ESCALATION_KEYWORDS;
  if (category === 'scam') return FRAUD_KEYWORDS;
  if (category === 'refund') return REFUND_KEYWORDS;
  if (category === 'cancellation') return CANCELLATION_KEYWORDS;
  if (category.startsWith('golden:')) {
    const idx = Number(category.split(':')[1]);
    return (OUTBOUND_GOLDEN_WORDS[idx]?.keywords ?? []).map(stripStar);
  }
  if (category.startsWith('signal:')) {
    const label = category.slice('signal:'.length);
    return (CRITICAL_SIGNAL_GROUPS.find(g => g.label === label)?.keywords ?? []).map(stripStar);
  }
  return [];
}

// category: 'legal' | 'social' | 'scam' | 'refund' | 'cancellation' | 'golden:0'..'golden:6' | 'signal:Frustration'|'signal:Threat'|...
export async function getOutboundInsightDrill(filters: QualityFilters, category: string): Promise<OutboundInsightDrillResponse> {
  const { startDate, endDate, clientId } = filters;
  const cf = clientId ? ' AND client_id = ?' : '';
  const params: (string | number)[] = [startDate, endDate, ...(clientId ? [Number(clientId)] : [])];

  let whereExtra = '1=0';
  const extraParams: (string | number)[] = [];
  if (category === 'legal') whereExtra = 'legal_flag = 1';
  else if (category === 'social') whereExtra = 'social_flag = 1';
  else if (category === 'scam') whereExtra = 'scam_flag = 1';
  else if (category === 'refund') whereExtra = 'refund_flag = 1';
  else if (category === 'cancellation') whereExtra = 'cancellation_flag = 1';
  else if (category.startsWith('golden:')) {
    const idx = Number(category.split(':')[1]);
    if (GOLDEN_COLS[idx]) whereExtra = `${GOLDEN_COLS[idx]} = 1`;
  } else if (category.startsWith('signal:')) {
    whereExtra = 'critical_signal = ?';
    extraParams.push(category.slice('signal:'.length));
  }

  const rows = await queryMasmis<{ call_id: number; lead_id: string | null; agent_name: string | null; mobile_no: string | null; call_date: string }>(`
    SELECT call_id, lead_id, agent_name, mobile_no, call_date
    FROM db_masmis.outbound_call_insights
    WHERE call_date BETWEEN ? AND ? ${cf} AND ${whereExtra}
    ORDER BY call_date DESC
    LIMIT 200
  `, [...params, ...extraParams]);

  // The cache only stores boolean flags — pull transcripts for this (small, already-filtered)
  // set of calls to surface which specific word/phrase triggered the match.
  const callIds = rows.map(r => Number(r.call_id));
  const transcriptMap = new Map<number, string>();
  if (callIds.length > 0) {
    const placeholders = callIds.map(() => '?').join(',');
    const tRows = await querySource<{ id: number; TranscribeText: string | null }>(
      `SELECT id, TranscribeText FROM db_external.CallDetails WHERE id IN (${placeholders})`,
      callIds,
    );
    for (const t of tRows) transcriptMap.set(Number(t.id), String(t.TranscribeText ?? '').toLowerCase());
  }

  const keywords = keywordsForCategory(category);
  const typeLabel = CATEGORY_TYPE_LABEL[category] ?? '';

  return {
    leads: rows.map(r => {
      const text = transcriptMap.get(Number(r.call_id)) ?? '';
      const matchedWord = keywords.find(k => text.includes(k.toLowerCase())) ?? '';
      return {
        callId:      Number(r.call_id),
        leadId:      String(r.lead_id ?? ''),
        agentName:   String(r.agent_name ?? 'Unknown'),
        mobileNo:    String(r.mobile_no ?? ''),
        callDate:    String(r.call_date),
        type:        typeLabel,
        matchedWord,
      };
    }),
  };
}

export interface OutboundCallTranscript {
  callId: number; leadId: string; agentName: string; mobileNo: string; callDate: string; transcript: string;
}

export async function getOutboundCallTranscript(callId: number): Promise<OutboundCallTranscript | null> {
  const rows = await querySource<{ id: number; TranscribeText: string; LeadID: string | null; AgentName: string | null; MobileNo: string | null; CallDate: string }>(
    `SELECT id, TranscribeText, LeadID, AgentName, MobileNo, CallDate FROM db_external.CallDetails WHERE id = ?`,
    [callId],
  );
  if (!rows.length) return null;
  const r = rows[0];
  return {
    callId:    Number(r.id),
    leadId:    String(r.LeadID ?? ''),
    agentName: String(r.AgentName ?? 'Unknown'),
    mobileNo:  String(r.MobileNo ?? ''),
    callDate:  String(r.CallDate),
    transcript: String(r.TranscribeText ?? ''),
  };
}

// ─── Full raw export — every column, every client the requester can see ──────────
// "All columns" genuinely means all 80 (verified via information_schema, not guessed).
// Streamed in keyset-paginated batches (not one big query) so memory stays bounded and the
// browser starts receiving bytes immediately, regardless of how many rows match the date range.
const CALL_DETAILS_EXPORT_COLUMNS = [
  'id', 'client_id', 'campaign_id', 'length_in_sec', 'start_epoch', 'end_epoch', 'CallDate', 'LeadID', 'AgentName', 'MobileNo',
  'CompetitorName', 'Opening', 'Offered', 'ObjectionHandling', 'PrepaidPitch', 'UpsellingEfforts', 'OfferUrgency',
  'SensitiveWordUsed', 'SensitiveWordContext', 'AreaForImprovement', 'TranscribeText', 'TopNegativeWordsByAgent',
  'TopNegativeWordsByCustomer', 'LengthSec', 'StartTime', 'EndTime', 'CallDisposition', 'OpeningRejected', 'OfferingRejected',
  'AfterListeningOfferRejected', 'SaleDone', 'NotInterestedReasonCallContext', 'NotInterestedBucketReason',
  'OpeningPitchContext', 'OfferedPitchContext', 'ObjectionHandlingContext', 'PrepaidPitchContext', 'FileName', 'Status',
  'Category', 'SubCategory', 'CustomerObjectionCategory', 'CustomerObjectionSubCategory', 'AgentRebuttalCategory',
  'AgentRebuttalSubCategory', 'ProductOffering', 'DiscountType', 'OpeningPitchCategory', 'ContactSettingContext',
  'ContactSettingCategory', 'ContactSetting2', 'Feedback_Category', 'FeedbackContext', 'Feedback', 'Age', 'ConsumptionType',
  'AgeofConsumption', 'ReasonforQuitting', 'entrydate', 'Sale_Pitch_Discount_Structure', 'Limited_Time_Offer',
  'Snapmint_Pitch', 'Feedback_Capture', 'Acknowledgement', 'Apology_Assurance', 'Pronunciation_Skills_Checklist',
  'Product_Appreciation', 'Customer_Details_Confirmation', 'Delivery_TAT', 'Order_Consent', 'Reconfirmation',
  'Order_Summary', 'Further_Assistance', 'Call_Closing', 'Product_Description_Guideline', 'Alternative_Suggestion',
  'Reason_for_Not_Placing_Order', 'Pricing_and_Discount_Structure',
  'fraud_and_data_security_compliance', 'fraud_detected_sentence',
];

// CallDate needs an explicit SQL-side format (dd-mm-yyyy hh:mm:ss) rather than the raw DATETIME —
// letting mysql2/CSV serialize a Date object directly produces a locale/timezone-dependent string.
function exportSelectExpr(col: string, tableAlias: string): string {
  if (col === 'CallDate') return `DATE_FORMAT(${tableAlias}.CallDate, '%d-%m-%Y %H:%i:%s') AS CallDate`;
  return `${tableAlias}.${col}`;
}

export async function streamOutboundExportCsv(
  res: Response, startDate: string, endDate: string, clientIds: number[] | null,
): Promise<void> {
  const fname = `outbound-export-${startDate.slice(0, 10)}_to_${endDate.slice(0, 10)}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
  // UTF-8 BOM — without it, Excel misdetects the encoding and garbles the Hindi/Hinglish text that
  // shows up throughout TranscribeText and the other free-text columns (what looked like "wrong"
  // transcript content was actually a mojibake rendering issue, not bad data).
  res.write(Buffer.from([0xEF, 0xBB, 0xBF]));
  res.write(CALL_DETAILS_EXPORT_COLUMNS.join(',') + '\n');

  // clientIds === null → unrestricted (super_admin); [] → no accessible clients at all → empty export
  const clientFilter = clientIds !== null
    ? (clientIds.length ? ` AND cd.client_id IN (${clientIds.map(() => '?').join(',')})` : ' AND 1 = 0')
    : '';
  const clientParams: number[] = clientIds ?? [];

  const BATCH = 2000;
  let lastId = 0;
  for (;;) {
    // FORCE INDEX (Index_3) is load-bearing, not an optimization: without it MySQL picks the
    // PRIMARY (id) index for this id-ordered query and scans hundreds of thousands of rows from
    // the start of the table — filtering CallDate/client_id row-by-row — before it finds enough
    // matches (confirmed via EXPLAIN: 183K+ rows examined, 0.48% actually matching). With ~80
    // columns including large text fields, that scan alone blows the 20s query timeout on the
    // first batch, so the export silently returns just the header row. Forcing the CallDate
    // index turns it into a cheap index-range scan (~33K rows examined) instead.
    const rows = await querySource<Record<string, unknown>>(`
      SELECT ${CALL_DETAILS_EXPORT_COLUMNS.map(c => exportSelectExpr(c, 'cd')).join(', ')}
      FROM db_external.CallDetails cd FORCE INDEX (Index_3)
      WHERE cd.id > ? AND cd.CallDate BETWEEN ? AND ? ${clientFilter}
      ORDER BY cd.id ASC
      LIMIT ${BATCH}
    `, [lastId, startDate, endDate, ...clientParams]);

    if (rows.length === 0) break;
    for (const r of rows) {
      res.write(CALL_DETAILS_EXPORT_COLUMNS.map(c => csvEscape(r[c])).join(',') + '\n');
    }
    lastId = Number(rows[rows.length - 1].id);
    if (rows.length < BATCH) break;
    await new Promise(r => setTimeout(r, 150)); // stay gentle on the shared DB server between batches
  }
  res.end();
}
