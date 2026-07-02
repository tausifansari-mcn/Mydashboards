import { querySource } from '../../lib/sourceDb';

export interface QualityFilters {
  startDate: string;
  endDate: string;
  clientId?: string;
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
  calls: number;
  promoter: number;
  passive: number;
  detractor: number;
  csat: number;
  nps: number;
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

export interface KPIResponse {
  cst: CSTData;
  crt: CRTData;
  rejectedPie: PieSlice[];
  cstFunnel: FunnelStep[];
  crtFunnel: FunnelStep[];
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

export async function getKPIs(filters: QualityFilters): Promise<KPIResponse> {
  const { startDate, endDate } = filters;
  const { sql: cf, params: cfParams } = clientClause(filters);
  const params = [startDate, endDate, ...cfParams];

  const rejectedBreakdown = await querySource<PieSlice>(`
    WITH base AS (
      SELECT cd.*,
        CASE
          WHEN cd.AfterListeningOfferRejected = 1 OR cd.SaleDone = 1 THEN 'Post Offer Rejected'
          WHEN cd.ObjectionHandlingContext = 'None' THEN 'Offering Rejected'
          WHEN cd.ContactSettingContext = 'None' THEN 'Context Rejected'
          ELSE 'Opening Rejected'
        END AS rejected_status
      FROM db_external.CallDetails cd
      WHERE cd.MobileNo IS NOT NULL AND cd.MobileNo != ''
        AND cd.CallDate BETWEEN ? AND ? ${cf}
    ),
    valid AS (
      SELECT * FROM base
      WHERE CustomerObjectionCategory IS NOT NULL AND CustomerObjectionCategory != ''
    )
    SELECT rejected_status AS name, COUNT(*) AS value
    FROM valid
    GROUP BY rejected_status
    ORDER BY value DESC
  `, params);

  const row = await querySource<{
    total: number;
    ops: number;
    cps: number;
    offered: number;
    sale: number;
    or_cnt: number;
    cr_cnt: number;
    opr_cnt: number;
    por_cnt: number;
  }>(`
    WITH base AS (
      SELECT cd.*,
        CASE
          WHEN cd.AfterListeningOfferRejected = 1 OR cd.SaleDone = 1 THEN 'Post Offer Rejected'
          WHEN cd.ObjectionHandlingContext = 'None' THEN 'Offering Rejected'
          WHEN cd.ContactSettingContext = 'None' THEN 'Context Rejected'
          ELSE 'Opening Rejected'
        END AS rejected_status
      FROM db_external.CallDetails cd
      WHERE cd.MobileNo IS NOT NULL AND cd.MobileNo != ''
        AND cd.CallDate BETWEEN ? AND ? ${cf}
    ),
    valid AS (
      SELECT * FROM base
      WHERE CustomerObjectionCategory IS NOT NULL AND CustomerObjectionCategory != ''
    )
    SELECT
      (SELECT COUNT(*) FROM valid) AS total,
      (SELECT COUNT(*) FROM valid WHERE rejected_status != 'Opening Rejected') AS ops,
      (SELECT COUNT(*) FROM valid WHERE rejected_status NOT IN ('Opening Rejected','Context Rejected')) AS cps,
      (SELECT COUNT(*) FROM base  WHERE rejected_status NOT IN ('Opening Rejected','Offering Rejected')) AS offered,
      (SELECT COUNT(*) FROM valid WHERE COALESCE(SaleDone,0) = 1) AS sale,
      (SELECT COUNT(*) FROM valid WHERE rejected_status = 'Opening Rejected') AS or_cnt,
      (SELECT COUNT(*) FROM valid WHERE rejected_status = 'Context Rejected') AS cr_cnt,
      (SELECT COUNT(*) FROM valid WHERE rejected_status = 'Offering Rejected') AS opr_cnt,
      (SELECT COUNT(*) FROM valid WHERE rejected_status NOT IN ('Offering Rejected','Opening Rejected','Context Rejected')) AS por_cnt
  `, params);

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

  /* ─── Opportunity Analysis ─────────────────────────────────────────────── */
  const oppRow = await querySource<{ total_opp: number; mo_count: number }>(`
    WITH base AS (
      SELECT cd.*,
        CASE
          WHEN cd.AfterListeningOfferRejected = 1 OR cd.SaleDone = 1 THEN 'Post Offer Rejected'
          WHEN cd.ObjectionHandlingContext = 'None' THEN 'Offering Rejected'
          WHEN cd.ContactSettingContext = 'None' THEN 'Context Rejected'
          ELSE 'Opening Rejected'
        END AS rejected_status
      FROM db_external.CallDetails cd
      WHERE cd.MobileNo IS NOT NULL AND cd.MobileNo != ''
        AND cd.CallDate BETWEEN ? AND ? ${cf}
    )
    SELECT
      (SELECT COUNT(*) FROM base WHERE rejected_status NOT IN ('Opening Rejected','Offering Rejected','Context Rejected')) AS total_opp,
      (SELECT COUNT(*) FROM base WHERE rejected_status NOT IN ('Opening Rejected','Offering Rejected','Context Rejected')
        AND CustomerObjectionCategory IS NOT NULL AND CustomerObjectionCategory != ''
        AND COALESCE(SaleDone,0) = 1) AS mo_count
  `, params);
  const totalOpp = Number(oppRow[0]?.total_opp ?? 0);
  const moCount = Number(oppRow[0]?.mo_count ?? 0);

  const oppLossPie = await querySource<PieSlice>(`
    WITH base AS (
      SELECT cd.*,
        CASE
          WHEN cd.AfterListeningOfferRejected = 1 OR cd.SaleDone = 1 THEN 'Post Offer Rejected'
          WHEN cd.ObjectionHandlingContext = 'None'  THEN 'Offering Rejected'
          WHEN cd.ContactSettingContext = 'None'     THEN 'Context Rejected'
          WHEN cd.OpeningRejected = 1                THEN 'Opening Rejected'
          WHEN cd.OfferedPitchContext = 'None'       THEN 'Opening Rejected'
          ELSE 'Other'
        END AS rejected_status
      FROM db_external.CallDetails cd
      WHERE cd.MobileNo IS NOT NULL AND cd.MobileNo != ''
        AND cd.CallDate BETWEEN ? AND ? ${cf}
    )
    SELECT
      CASE
        WHEN CustomerObjectionSubCategory IN (
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
    WHERE COALESCE(SaleDone, 0) = 0
      AND rejected_status NOT IN ('Opening Rejected', 'Offering Rejected')
    GROUP BY 1
  `, params);

  const oppCatPie = await querySource<PieSlice>(`
    WITH base AS (
      SELECT cd.*,
        CASE
          WHEN cd.AfterListeningOfferRejected = 1 OR cd.SaleDone = 1 THEN 'Post Offer Rejected'
          WHEN cd.ObjectionHandlingContext = 'None' THEN 'Offering Rejected'
          WHEN cd.ContactSettingContext = 'None' THEN 'Context Rejected'
          ELSE 'Opening Rejected'
        END AS rejected_status
      FROM db_external.CallDetails cd
      WHERE cd.MobileNo IS NOT NULL AND cd.MobileNo != ''
        AND cd.CallDate BETWEEN ? AND ? ${cf}
    ),
    opp AS (
      SELECT * FROM base
      WHERE rejected_status NOT IN ('Opening Rejected','Offering Rejected')
        AND CustomerObjectionCategory IS NOT NULL AND CustomerObjectionCategory != ''
        AND COALESCE(SaleDone,0) != 1
    )
    SELECT
      CASE
        WHEN CustomerObjectionSubCategory IN ('Already has the same product','Already has enough perfumes','Overstock / No Need for More','Already Owns Enough','Already has too many perfumes','Happy with the product but not interested in buying more') THEN 'No Need'
        WHEN CustomerObjectionSubCategory = 'Already has another preferred brand' THEN 'Brand Preference'
        WHEN CustomerObjectionSubCategory = 'Liked the product but wants a better deal' THEN 'Price Sensitivity'
        WHEN CustomerObjectionSubCategory = 'Wants to buy later' THEN 'Budget Constraint'
        WHEN CustomerObjectionSubCategory = 'Not Interested in Perfumes' THEN 'Product Disinterest'
        WHEN CustomerObjectionSubCategory IN ('Didn''t like one of the perfumes','Disappointed with perfume quality','Perfume Longevity Issue','Perfume too strong') THEN 'Negative Experience'
        WHEN CustomerObjectionSubCategory IN ('Damaged Product Received','Wrong Product Received') THEN 'Logistic Concern'
        WHEN CustomerObjectionSubCategory = 'Doesn''t trust online payments' THEN 'Trust Concerns'
        ELSE ''
      END AS name,
      COUNT(*) AS value
    FROM opp
    GROUP BY name
    HAVING name != '' AND name != 'Negative Experience'
  `, params);

  const moBreaksPie = await querySource<PieSlice>(`
    WITH base AS (
      SELECT cd.*,
        CASE
          WHEN cd.AfterListeningOfferRejected = 1 OR cd.SaleDone = 1 THEN 'Post Offer Rejected'
          WHEN cd.ObjectionHandlingContext = 'None' THEN 'Offering Rejected'
          WHEN cd.ContactSettingContext = 'None' THEN 'Context Rejected'
          ELSE 'Opening Rejected'
        END AS rejected_status
      FROM db_external.CallDetails cd
      WHERE cd.MobileNo IS NOT NULL AND cd.MobileNo != ''
        AND cd.CallDate BETWEEN ? AND ? ${cf}
    ),
    mo AS (
      SELECT * FROM base
      WHERE rejected_status NOT IN ('Opening Rejected','Offering Rejected','Context Rejected')
        AND CustomerObjectionCategory IS NOT NULL AND CustomerObjectionCategory != ''
        AND COALESCE(SaleDone,0) = 1
    )
    SELECT
      CASE
        WHEN CustomerObjectionSubCategory IN ('Already has the same product','Already has enough perfumes','Overstock / No Need for More','Already Owns Enough','Already has too many perfumes','Happy with the product but not interested in buying more') THEN 'No Need'
        WHEN CustomerObjectionSubCategory = 'Already has another preferred brand' THEN 'Brand Preference'
        WHEN CustomerObjectionSubCategory = 'Liked the product but wants a better deal' THEN 'Price Sensitivity'
        WHEN CustomerObjectionSubCategory = 'Wants to buy later' THEN 'Budget Constraint'
        WHEN CustomerObjectionSubCategory = 'Not Interested in Perfumes' THEN 'Product Disinterest'
        WHEN CustomerObjectionSubCategory IN ('Didn''t like one of the perfumes','Disappointed with perfume quality','Perfume Longevity Issue','Perfume too strong') THEN 'Negative Experience'
        WHEN CustomerObjectionSubCategory IN ('Damaged Product Received','Wrong Product Received') THEN 'Logistic Concern'
        WHEN CustomerObjectionSubCategory = 'Doesn''t trust online payments' THEN 'Trust Concerns'
        ELSE ''
      END AS name,
      COUNT(*) AS value
    FROM mo
    GROUP BY name
    HAVING name != ''
  `, params);

  const moCategoryRaw = await querySource<{ category: string; insight: string; cnt: number }>(`
    WITH base AS (
      SELECT cd.*,
        CASE
          WHEN cd.AfterListeningOfferRejected = 1 OR cd.SaleDone = 1 THEN 'Post Offer Rejected'
          WHEN cd.ObjectionHandlingContext = 'None'  THEN 'Offering Rejected'
          WHEN cd.ContactSettingContext = 'None'     THEN 'Context Rejected'
          WHEN cd.OpeningRejected = 1                THEN 'Opening Rejected'
          WHEN cd.OfferedPitchContext = 'None'       THEN 'Opening Rejected'
          ELSE 'Other'
        END AS rejected_status
      FROM db_external.CallDetails cd
      WHERE cd.MobileNo IS NOT NULL AND cd.MobileNo != ''
        AND cd.CallDate BETWEEN ? AND ? ${cf}
    )
    SELECT
      CASE
        WHEN CustomerObjectionSubCategory = 'Already has the same product'                        THEN 'No Need'
        WHEN CustomerObjectionSubCategory = 'Already has enough perfumes'                          THEN 'No Need'
        WHEN CustomerObjectionSubCategory = 'Overstock / No Need for More'                        THEN 'No Need'
        WHEN CustomerObjectionSubCategory = 'Already Owns Enough'                                 THEN 'No Need'
        WHEN CustomerObjectionSubCategory = 'Already has too many perfumes'                        THEN 'No Need'
        WHEN CustomerObjectionSubCategory = 'Already has another preferred brand'                  THEN 'Brand Preference'
        WHEN CustomerObjectionSubCategory = 'Liked the product but wants a better deal'            THEN 'Price Sensitivity'
        WHEN CustomerObjectionSubCategory = 'Wants to buy later'                                  THEN 'Budget Constraint'
        WHEN CustomerObjectionSubCategory = 'Not Interested in Perfumes'                          THEN 'Product Disinterest'
        WHEN CustomerObjectionSubCategory = 'Happy with the product but not interested in buying more' THEN 'No Need'
        WHEN CustomerObjectionSubCategory = 'Didn''t like one of the perfumes'                    THEN 'Negative Experience'
        WHEN CustomerObjectionSubCategory = 'Disappointed with perfume quality'                   THEN 'Negative Experience'
        WHEN CustomerObjectionSubCategory = 'Perfume Longevity Issue'                             THEN 'Negative Experience'
        WHEN CustomerObjectionSubCategory = 'Perfume too strong'                                  THEN 'Negative Experience'
        WHEN CustomerObjectionSubCategory = 'Damaged Product Received'                            THEN 'Logistic Concern'
        WHEN CustomerObjectionSubCategory = 'Wrong Product Received'                              THEN 'Logistic Concern'
        WHEN CustomerObjectionSubCategory = 'Doesn''t trust online payments'                      THEN 'Trust Concerns'
        ELSE ''
      END AS category,
      CASE
        WHEN CustomerObjectionSubCategory = 'Already has the same product'                        THEN 'Customer already has same product; no need to buy.'
        WHEN CustomerObjectionSubCategory = 'Already has enough perfumes'                          THEN 'Fully stocked; low chance of purchase.'
        WHEN CustomerObjectionSubCategory = 'Overstock / No Need for More'                        THEN 'No immediate need; possible future purchase.'
        WHEN CustomerObjectionSubCategory = 'Already Owns Enough'                                 THEN 'No need for additional purchases now.'
        WHEN CustomerObjectionSubCategory = 'Already has too many perfumes'                        THEN 'Similar to overstocked; minimal conversion potential.'
        WHEN CustomerObjectionSubCategory = 'Already has another preferred brand'                  THEN 'Prefers another brand; difficult to convert.'
        WHEN CustomerObjectionSubCategory = 'Liked the product but wants a better deal'            THEN 'Possible to convert with discounts or offers.'
        WHEN CustomerObjectionSubCategory = 'Wants to buy later'                                  THEN 'Future potential lead; needs follow-up.'
        WHEN CustomerObjectionSubCategory = 'Not Interested in Perfumes'                          THEN 'No interest at all; unlikely to convert.'
        WHEN CustomerObjectionSubCategory = 'Happy with the product but not interested in buying more' THEN 'No further purchase intent; hard to upsell.'
        WHEN CustomerObjectionSubCategory = 'Didn''t like one of the perfumes'                    THEN 'A bad experience with one variant; can recommend others.'
        WHEN CustomerObjectionSubCategory = 'Disappointed with perfume quality'                   THEN 'Concerns about quality; provide product assurance.'
        WHEN CustomerObjectionSubCategory = 'Perfume Longevity Issue'                             THEN 'Customer finds longevity lacking; suggest long-lasting alternatives.'
        WHEN CustomerObjectionSubCategory = 'Perfume too strong'                                  THEN 'Scent preference issue; suggest milder alternatives.'
        WHEN CustomerObjectionSubCategory = 'Damaged Product Received'                            THEN 'A serious issue; needs strong resolution to regain trust.'
        WHEN CustomerObjectionSubCategory = 'Wrong Product Received'                              THEN 'Fulfillment error; needs rectification and trust-building.'
        WHEN CustomerObjectionSubCategory = 'Doesn''t trust online payments'                      THEN 'Major barrier; provide secure payment options and reassurance.'
        ELSE ''
      END AS insight,
      COUNT(*) AS cnt
    FROM base
    WHERE COALESCE(SaleDone, 0) = 0
      AND rejected_status NOT IN ('Opening Rejected', 'Offering Rejected')
    GROUP BY 1, 2
    HAVING category != ''
    ORDER BY cnt DESC
  `, params);

  const moTotal = moCategoryRaw.reduce((s, r) => s + Number(r.cnt), 0);
  const moCategoryTable: MOCategoryRow[] = moCategoryRaw.map(r => ({
    category: r.category,
    insight: r.insight,
    count: Number(r.cnt),
    pct: moTotal > 0 ? Number(((Number(r.cnt) / moTotal) * 100).toFixed(1)) : 0,
  }));

  const nedRaw = await querySource<{ ned_category: string; ned_qs: string; ned_status: string; cnt: number }>(`
    WITH base AS (
      SELECT cd.*,
        CASE
          WHEN cd.AfterListeningOfferRejected = 1 OR cd.SaleDone = 1 THEN 'Post Offer Rejected'
          WHEN cd.ObjectionHandlingContext = 'None'  THEN 'Offering Rejected'
          WHEN cd.ContactSettingContext = 'None'     THEN 'Context Rejected'
          WHEN cd.OpeningRejected = 1                THEN 'Opening Rejected'
          WHEN cd.OfferedPitchContext = 'None'       THEN 'Opening Rejected'
          ELSE 'Other'
        END AS rejected_status
      FROM db_external.CallDetails cd
      WHERE cd.MobileNo IS NOT NULL AND cd.MobileNo != ''
        AND cd.CallDate BETWEEN ? AND ? ${cf}
    )
    SELECT
      CASE
        WHEN CustomerObjectionSubCategory = 'Already has the same product'                        THEN 'No Need'
        WHEN CustomerObjectionSubCategory = 'Already has enough perfumes'                         THEN 'No Need'
        WHEN CustomerObjectionSubCategory = 'Overstock / No Need for More'                       THEN 'No Need'
        WHEN CustomerObjectionSubCategory = 'Already Owns Enough'                                THEN 'No Need'
        WHEN CustomerObjectionSubCategory = 'Already has too many perfumes'                      THEN 'No Need'
        WHEN CustomerObjectionSubCategory = 'Already has another preferred brand'                THEN 'Brand Preference'
        WHEN CustomerObjectionSubCategory = 'Liked the product but wants a better deal'          THEN 'Price Sensitivity'
        WHEN CustomerObjectionSubCategory = 'Wants to buy later'                                 THEN 'Budget Constraint'
        WHEN CustomerObjectionSubCategory = 'Not Interested in Perfumes'                         THEN 'Product Disinterest'
        WHEN CustomerObjectionSubCategory = 'Happy with the product but not interested in buying more' THEN 'No Need'
        WHEN CustomerObjectionSubCategory = 'Didn''t like one of the perfumes'                   THEN 'Negative Experience'
        WHEN CustomerObjectionSubCategory = 'Disappointed with perfume quality'                  THEN 'Negative Experience'
        WHEN CustomerObjectionSubCategory = 'Perfume Longevity Issue'                            THEN 'Negative Experience'
        WHEN CustomerObjectionSubCategory = 'Perfume too strong'                                 THEN 'Negative Experience'
        WHEN CustomerObjectionSubCategory = 'Damaged Product Received'                           THEN 'Logistic Concern'
        WHEN CustomerObjectionSubCategory = 'Wrong Product Received'                             THEN 'Logistic Concern'
        WHEN CustomerObjectionSubCategory = 'Doesn''t trust online payments'                     THEN 'Trust Concerns'
        ELSE ''
      END AS ned_category,
      CASE
        WHEN CustomerObjectionSubCategory = 'Didn''t like one of the perfumes'   THEN 'Disappointed with perfume quality'
        WHEN CustomerObjectionSubCategory = 'Already has enough perfumes'         THEN 'Already has too many perfumes'
        WHEN CustomerObjectionSubCategory = 'Already has the same product'        THEN 'Already has too many perfumes'
        WHEN CustomerObjectionSubCategory = 'Already has too many perfumes'       THEN 'Already has too many perfumes'
        WHEN CustomerObjectionSubCategory = 'Already Owns Enough'                 THEN 'Already has too many perfumes'
        WHEN CustomerObjectionSubCategory = 'Overstock/No Need for More'          THEN 'Already has too many perfumes'
        ELSE COALESCE(CustomerObjectionSubCategory, '')
      END AS ned_qs,
      CASE
        WHEN CustomerObjectionSubCategory IN (
          'Already has the same product','Already has enough perfumes','Overstock / No Need for More',
          'Already Owns Enough','Already has too many perfumes','Already has another preferred brand',
          'Not Interested in Perfumes','Happy with the product but not interested in buying more',
          'Didn''t like one of the perfumes','Disappointed with perfume quality'
        ) THEN 'Non Workable'
        WHEN CustomerObjectionSubCategory IN (
          'Liked the product but wants a better deal','Wants to buy later',
          'Perfume Longevity Issue','Perfume too strong',
          'Damaged Product Received','Wrong Product Received',
          'Doesn''t trust online payments'
        ) THEN 'Workable'
        ELSE ''
      END AS ned_status,
      COUNT(*) AS cnt
    FROM base
    WHERE COALESCE(SaleDone, 0) = 0
      AND rejected_status NOT IN ('Opening Rejected', 'Offering Rejected')
    GROUP BY 1, 2, 3
    HAVING ned_category != '' AND ned_status != ''
    ORDER BY cnt DESC
  `, params);

  const nedTotal = nedRaw.reduce((s, r) => s + Number(r.cnt), 0);
  const nedTable: NEDRow[] = nedRaw.map(r => ({
    nedCategory: r.ned_category,
    nedQS:       r.ned_qs,
    nedStatus:   r.ned_status,
    count:       Number(r.cnt),
    pct:         nedTotal > 0 ? Number(((Number(r.cnt) / nedTotal) * 100).toFixed(1)) : 0,
  }));

  const objectionCategoryPie = await querySource<PieSlice>(`
    WITH base AS (
      SELECT cd.*,
        CASE
          WHEN cd.AfterListeningOfferRejected = 1 OR cd.SaleDone = 1 THEN 'Post Offer Rejected'
          WHEN cd.ObjectionHandlingContext = 'None'  THEN 'Offering Rejected'
          WHEN cd.ContactSettingContext = 'None'     THEN 'Context Rejected'
          WHEN cd.OpeningRejected = 1                THEN 'Opening Rejected'
          WHEN cd.OfferedPitchContext = 'None'       THEN 'Opening Rejected'
          ELSE 'Other'
        END AS rejected_status
      FROM db_external.CallDetails cd
      WHERE cd.MobileNo IS NOT NULL AND cd.MobileNo != ''
        AND cd.CallDate BETWEEN ? AND ? ${cf}
    )
    SELECT
      CASE
        WHEN CustomerObjectionSubCategory IS NULL
             OR CustomerObjectionSubCategory = ''
             OR CustomerObjectionSubCategory IN (
               'Already has the same product','Already has enough perfumes',
               'Overstock / No Need for More','Already Owns Enough',
               'Already has too many perfumes',
               'Happy with the product but not interested in buying more'
             ) THEN 'No Need'
        WHEN CustomerObjectionSubCategory = 'Already has another preferred brand'          THEN 'Brand Preference'
        WHEN CustomerObjectionSubCategory = 'Liked the product but wants a better deal'   THEN 'Price Sensitivity'
        WHEN CustomerObjectionSubCategory = 'Wants to buy later'                          THEN 'Budget Constraint'
        WHEN CustomerObjectionSubCategory = 'Not Interested in Perfumes'                  THEN 'Product Disinterest'
        WHEN CustomerObjectionSubCategory IN (
          'Didn''t like one of the perfumes','Disappointed with perfume quality',
          'Perfume Longevity Issue','Perfume too strong'
        ) THEN 'Negative Experience'
        WHEN CustomerObjectionSubCategory IN ('Damaged Product Received','Wrong Product Received') THEN 'Logistic Concern'
        WHEN CustomerObjectionSubCategory = 'Doesn''t trust online payments'              THEN 'Trust Concerns'
        ELSE 'No Need'
      END AS name,
      COUNT(*) AS value
    FROM base
    WHERE rejected_status NOT IN ('Opening Rejected', 'Offering Rejected')
    GROUP BY 1
    ORDER BY value DESC
  `, params);

  const npsRaw = await querySource<{
    total: number; promoter: number; detractor: number; passive: number;
    nps_score: number | null; csat_score: number | null;
  }>(`
    SELECT
      SUM(CASE WHEN cd.Feedback IN ('Positive','Negative','Neutral') THEN 1 ELSE 0 END) AS total,
      SUM(CASE WHEN cd.Feedback = 'Positive' THEN 1 ELSE 0 END) AS promoter,
      SUM(CASE WHEN cd.Feedback = 'Negative' THEN 1 ELSE 0 END) AS detractor,
      SUM(CASE WHEN cd.Feedback = 'Neutral'  THEN 1 ELSE 0 END) AS passive,
      ROUND(
        (SUM(CASE WHEN cd.Feedback = 'Positive' THEN 1 ELSE 0 END) * 100.0 /
         NULLIF(SUM(CASE WHEN cd.Feedback IN ('Positive','Negative','Neutral') THEN 1 ELSE 0 END), 0))
        -
        (SUM(CASE WHEN cd.Feedback = 'Negative' THEN 1 ELSE 0 END) * 100.0 /
         NULLIF(SUM(CASE WHEN cd.Feedback IN ('Positive','Negative','Neutral') THEN 1 ELSE 0 END), 0)),
        2
      ) AS nps_score,
      ROUND(
        (SUM(CASE WHEN cd.Feedback IN ('Positive','Neutral') THEN 1 ELSE 0 END) * 100.0 /
         NULLIF(SUM(CASE WHEN cd.Feedback IN ('Positive','Negative','Neutral') THEN 1 ELSE 0 END), 0)) / 100,
        4
      ) AS csat_score
    FROM db_external.CallDetails cd
    WHERE cd.Feedback IN ('Positive','Negative','Neutral')
      AND cd.CallDate BETWEEN ? AND ? ${cf}
  `, params);

  const npsR = npsRaw[0] ?? { total: 0, promoter: 0, detractor: 0, passive: 0, nps_score: 0, csat_score: 0 };
  const npsTotal = Number(npsR.total);

  const npsDaysRaw = await querySource<{
    calldate: string; total_feedbacks: number;
    promoter: number; detractor: number; passive: number; nps_score: number | null;
  }>(`
    SELECT
      DATE_FORMAT(cd.CallDate, '%Y-%m-%d') AS calldate,
      COUNT(*) AS total_feedbacks,
      SUM(CASE WHEN cd.Feedback = 'Positive' THEN 1 ELSE 0 END) AS promoter,
      SUM(CASE WHEN cd.Feedback = 'Negative' THEN 1 ELSE 0 END) AS detractor,
      SUM(CASE WHEN cd.Feedback = 'Neutral'  THEN 1 ELSE 0 END) AS passive,
      ROUND(
        (SUM(CASE WHEN cd.Feedback = 'Positive' THEN 1 ELSE 0 END) * 100.0 /
         NULLIF(SUM(CASE WHEN cd.Feedback IN ('Positive','Negative','Neutral') THEN 1 ELSE 0 END), 0))
        -
        (SUM(CASE WHEN cd.Feedback = 'Negative' THEN 1 ELSE 0 END) * 100.0 /
         NULLIF(SUM(CASE WHEN cd.Feedback IN ('Positive','Negative','Neutral') THEN 1 ELSE 0 END), 0)),
        2
      ) AS nps_score
    FROM db_external.CallDetails cd
    WHERE cd.Feedback IN ('Positive','Negative','Neutral')
      AND cd.CallDate BETWEEN ? AND ? ${cf}
    GROUP BY 1
    ORDER BY 1
  `, params);

  const npsDays: NPSDayRow[] = npsDaysRaw.map(r => ({
    calldate:       String(r.calldate),
    totalFeedbacks: Number(r.total_feedbacks),
    promoter:       Number(r.promoter),
    detractor:      Number(r.detractor),
    passive:        Number(r.passive),
    npsScore:       Number(r.nps_score ?? 0),
  }));

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

export async function getDetailAnalysis(filters: QualityFilters): Promise<DetailAnalysisResponse> {
  const { startDate, endDate } = filters;
  const { sql: cf, params: cfParams } = clientClause(filters);
  const params = [startDate, endDate, ...cfParams];

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
        AND cd.CallDate BETWEEN ? AND ? ${cf}
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
        AND cd.CallDate BETWEEN ? AND ? ${cf}
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
        AND cd.CallDate BETWEEN ? AND ? ${cf}
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
  const baseParams = [startDate, endDate, ...cfParams];

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
    WHERE cd.CallDate BETWEEN ? AND ? ${cf}
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
    WHERE cd.CallDate BETWEEN ? AND ? ${cf}
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
  const params = [startDate, endDate, ...cfParams];

  const rows = await querySource<{
    agent: string; calls: number;
    promoter: number; passive: number; detractor: number;
    csat: number | null; nps: number | null;
  }>(`
    SELECT
      COALESCE(am.AgentName, cd.AgentName) AS agent,
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
    LEFT JOIN Shivamgiri.AgentMaster am ON am.MasId = cd.AgentName COLLATE utf8mb4_unicode_ci
    WHERE cd.Feedback IN ('Positive','Negative','Neutral')
      AND cd.CallDate BETWEEN ? AND ? ${cf}
      AND cd.AgentName IS NOT NULL AND cd.AgentName != ''
    GROUP BY cd.AgentName
    HAVING calls >= 1
    ORDER BY csat DESC
  `, params);

  return rows.map(r => ({
    agent:     String(r.agent),
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
