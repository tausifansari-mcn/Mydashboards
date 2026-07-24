import { querySource, getSourcePool } from '../../lib/sourceDb';
import { queryMasmis, getMasmisPool } from '../../lib/masmisDb';

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

  const [rejectedBreakdown, row, oppRow, oppLossPie, oppCatPie, moBreaksPie, moCategoryRaw, nedRaw, objectionCategoryPie, npsRaw, npsDaysRaw, auditCountRaw] = await Promise.all([
    querySource<PieSlice>(`
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
    `, params),

    querySource<{
      total: number; ops: number; cps: number; offered: number; sale: number;
      or_cnt: number; cr_cnt: number; opr_cnt: number; por_cnt: number;
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
    `, params),

    querySource<{ total_opp: number; mo_count: number }>(`
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
    `, params),

    querySource<PieSlice>(`
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
    `, params),

    querySource<PieSlice>(`
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
    `, params),

    querySource<PieSlice>(`
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
    `, params),

    querySource<{ category: string; insight: string; cnt: number }>(`
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
    `, params),

    querySource<{ ned_category: string; ned_qs: string; ned_status: string; cnt: number }>(`
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
    `, params),

    querySource<PieSlice>(`
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
    `, params),

    querySource<{
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
    `, params),

    querySource<{
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
    `, params),

    // Date-wise audit count — same "valid call" definition as the CST/CRT total above
    // (MobileNo present, CustomerObjectionCategory tagged), just broken out per day.
    querySource<{ calldate: string; cnt: number }>(`
      SELECT DATE_FORMAT(cd.CallDate, '%Y-%m-%d') AS calldate, COUNT(*) AS cnt
      FROM db_external.CallDetails cd
      WHERE cd.MobileNo IS NOT NULL AND cd.MobileNo != ''
        AND cd.CustomerObjectionCategory IS NOT NULL AND cd.CustomerObjectionCategory != ''
        AND cd.CallDate BETWEEN ? AND ? ${cf}
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
  const params = [startDate, endDate, ...cfParams];

  const rows = await querySource<{ id: number; CallDate: string; AgentName: string | null; MobileNo: string | null; FileName: string | null }>(`
    SELECT cd.id, cd.CallDate, cd.AgentName, cd.MobileNo, cd.FileName
    FROM db_external.CallDetails cd
    WHERE cd.MobileNo IS NOT NULL AND cd.MobileNo != ''
      AND cd.CustomerObjectionCategory IS NOT NULL AND cd.CustomerObjectionCategory != ''
      AND COALESCE(cd.SaleDone, 0) = 1
      AND cd.CallDate BETWEEN ? AND ? ${cf}
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
  const params = [startDate, endDate, ...cfParams];

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
    LEFT JOIN Shivamgiri.AgentMaster am ON am.MasId = cd.AgentName COLLATE utf8mb4_unicode_ci
    WHERE cd.Feedback IN ('Positive','Negative','Neutral')
      AND cd.AgentName IS NOT NULL AND TRIM(cd.AgentName) != ''
      AND cd.CallDate BETWEEN ? AND ? ${cf}
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
  const params: (string | number)[] = [startDate, endDate, ...cfParams];

  const rows = await querySource<{ agentId: string; total_count: number }>(`
    SELECT
      cd.AgentName       AS agentId,
      COUNT(*)           AS total_count
    FROM db_external.CallDetails cd
    LEFT JOIN Shivamgiri.AgentMaster am ON am.MasId = cd.AgentName COLLATE utf8mb4_unicode_ci
    WHERE cd.Feedback IN ('Positive','Negative','Neutral')
      AND cd.AgentName IS NOT NULL AND TRIM(cd.AgentName) != ''
      AND cd.CallDate BETWEEN ? AND ?
      AND am.MasId IS NULL
      ${cf}
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
    `INSERT INTO Shivamgiri.AgentMaster (MasId, AgentName, Lob)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE AgentName = VALUES(AgentName), Lob = VALUES(Lob)`,
    [agent.masId, agent.agentName, agent.lob],
  );
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
};

const BELLAVITA_OP_SCRIPT =
  `Good Morning/Afternoon/Evening.\n\n` +
  `Thank you for choosing Bella Vita Organic.\n\n` +
  `Am I speaking with Mr./Ms. {Customer Name}?\n\n` +
  `We're calling regarding your recent Bella Vita purchase to understand your experience and to share an exclusive benefit available only for our existing customers.\n\n` +
  `Is this a good time to talk for two minutes?`;

const BELLAVITA_CSP_SCRIPTS: { category: string; label: string; text: string }[] = [
  {
    category: 'Feedback before Offer Pitch',
    label: 'Feedback before Offer Pitch',
    text:
      `Sir/Ma'am, yeh call aapke recent purchase {Product Name} ke feedback ke liye hai.\n\n` +
      `Mujhe umeed hai ki aapko product use karne ka mauka mila hoga.\n\n` +
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
const BELLAVITA_CATEGORY_CASE_SQL = `CASE
  WHEN cd.Category = 'Already Owns Enough' THEN 'Already Owns Enough'
  WHEN cd.Category = 'Delivery & Purchase Considerations' THEN 'Delivery & Purchase Considerations'
  WHEN cd.Category = 'Fragrance Concerns' THEN 'Fragrance Concerns'
  WHEN cd.SubCategory = 'Not Interested in Perfumes' THEN 'Not Interested in Perfumes'
  WHEN cd.Category = 'Pricing Concerns' THEN 'Pricing Concerns'
  WHEN cd.Category = 'Product Issues' THEN 'Product Issues'
  WHEN cd.SubCategory = 'Overstock/No Need for More' THEN 'Overstock/No Need for More'
  WHEN cd.Category = 'Service Issues' THEN 'Service Issues'
  WHEN cd.Category = 'Product Quality Concerns' THEN 'Product Quality Concerns'
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

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS db_masmis.magical_script_cursor (
        id      TINYINT PRIMARY KEY DEFAULT 1,
        next_id INT NOT NULL DEFAULT 0
      )
    `);
    const [cursorRows] = await pool.execute(`SELECT next_id FROM db_masmis.magical_script_cursor WHERE id = 1`);
    if ((cursorRows as any[]).length === 0) {
      const seedRows = await querySource<{ maxId: number }>(`SELECT COALESCE(MAX(id), 0) AS maxId FROM db_external.CallDetails`);
      const seedId = Number(seedRows[0]?.maxId ?? 0) + 1;
      await pool.execute(`INSERT INTO db_masmis.magical_script_cursor (id, next_id) VALUES (1, ?)`, [seedId]);
    } else if (migrated) {
      const seedRows = await querySource<{ maxId: number }>(`SELECT COALESCE(MAX(id), 0) AS maxId FROM db_external.CallDetails`);
      const seedId = Number(seedRows[0]?.maxId ?? 0) + 1;
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
  if (nextId <= 0) return 0; // fully backfilled — nothing older left to classify

  type Row = {
    id: number; client_id: number; CallDate: string;
    op_success: number | null; csp_success: number; csp_call_end: number; csp_variant: string | null;
    offer_success: number; product_offering: string | null; resolved_category: string | null;
    sale_done: number; call_stage: string; objection_category: string | null;
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
      CASE WHEN cd.CustomerObjectionCategory IS NOT NULL AND cd.CustomerObjectionCategory NOT IN ('', 'None') THEN cd.CustomerObjectionCategory ELSE NULL END AS objection_category
    FROM db_external.CallDetails cd
    WHERE cd.id < ? AND cd.MobileNo IS NOT NULL AND cd.MobileNo != ''
      AND cd.client_id IS NOT NULL
    ORDER BY cd.id DESC
    LIMIT ${Number(batchSize)}
  `, [nextId]);

  if (rows.length === 0) {
    await queryMasmis(`UPDATE db_masmis.magical_script_cursor SET next_id = 0 WHERE id = 1`);
    return 0;
  }

  const cols = [
    'call_id', 'client_id', 'call_date',
    'op_success', 'csp_success', 'csp_call_end', 'csp_variant',
    'offer_success', 'product_offering', 'resolved_category',
    'sale_done', 'call_stage', 'objection_category',
  ];
  const placeholders = rows.map(() => `(${cols.map(() => '?').join(',')},NOW())`).join(',');
  const flat = rows.flatMap(r => [
    r.id, r.client_id, r.CallDate,
    r.op_success, r.csp_success, r.csp_call_end, r.csp_variant,
    r.offer_success, r.product_offering, r.resolved_category,
    r.sale_done, r.call_stage, r.objection_category,
  ]);
  const updateCols = cols.filter(c => c !== 'call_id').map(c => `${c} = VALUES(${c})`).join(', ');

  await queryMasmis(`
    INSERT INTO db_masmis.magical_script_cache (${cols.join(', ')}, computed_at)
    VALUES ${placeholders}
    ON DUPLICATE KEY UPDATE ${updateCols}, computed_at = NOW()
  `, flat);

  const newNextId = rows[rows.length - 1].id; // smallest id in this DESC-ordered batch
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
  categories: { category: string; script: string; total: number; contribution_pct: number; call_end: number; sale_done: number; conv_pct: number }[];
  cachedThrough: string | null;
}

async function getColumnBasedMagicalScript(filters: QualityFilters): Promise<BellavitaMagicalScriptData> {
  const { startDate, endDate } = filters;
  const dialdeskClientId = Number(filters.clientId);
  const isBellavita = filters.clientId === BELLAVITA_CLIENT_ID;
  const baseParams = [startDate, endDate];
  const pct = (n: number, d: number) => d > 0 ? Math.round((n / d) * 1000) / 10 : 0;

  // All 5 reads come from the pre-classified db_masmis cache (see initMagicalScriptCacheTables /
  // processMagicalScriptBatch above) instead of scanning CallDetails live — that's what cut this
  // from ~2.5 minutes down to near-instant.
  const [opRows, cspRows, offerRows, products, categoryRows, status, configRows] = await Promise.all([
    // OP: op_success is NULL for the excluded population (Opening IS NULL/'None'); COUNT(op_success)
    // naturally skips those rows, matching "do not count None value".
    queryMasmis<{ total: number; call_end: number; success: number; sale_contrib: number }>(`
      SELECT
        COUNT(op_success) AS total,
        SUM(CASE WHEN op_success = 0 THEN 1 ELSE 0 END) AS call_end,
        SUM(CASE WHEN op_success = 1 THEN 1 ELSE 0 END) AS success,
        SUM(CASE WHEN op_success IS NOT NULL AND sale_done = 1 THEN 1 ELSE 0 END) AS sale_contrib
      FROM db_masmis.magical_script_cache
      WHERE client_id = ${dialdeskClientId} AND call_date BETWEEN ? AND ?
    `, baseParams),

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
      WHERE client_id = ${dialdeskClientId} AND call_date BETWEEN ? AND ? AND op_success = 1
    `, baseParams),

    // Offer: population = calls that passed CSP.
    queryMasmis<{ total: number; call_end: number; success: number; sale_contrib: number }>(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN offer_success = 0 THEN 1 ELSE 0 END) AS call_end,
        SUM(offer_success) AS success,
        SUM(CASE WHEN offer_success = 1 AND sale_done = 1 THEN 1 ELSE 0 END) AS sale_contrib
      FROM db_masmis.magical_script_cache
      WHERE client_id = ${dialdeskClientId} AND call_date BETWEEN ? AND ? AND op_success = 1 AND csp_success = 1
    `, baseParams),

    queryMasmis<{ product: string; n: number }>(`
      SELECT product_offering AS product, COUNT(*) AS n
      FROM db_masmis.magical_script_cache
      WHERE client_id = ${dialdeskClientId} AND call_date BETWEEN ? AND ?
        AND offer_success = 1 AND product_offering IS NOT NULL
      GROUP BY product_offering
      ORDER BY n DESC
    `, baseParams),

    queryMasmis<{ resolved_category: string; total: number; sales: number }>(`
      SELECT resolved_category, COUNT(*) AS total, SUM(sale_done) AS sales
      FROM db_masmis.magical_script_cache
      WHERE client_id = ${dialdeskClientId} AND call_date BETWEEN ? AND ? AND resolved_category IS NOT NULL
      GROUP BY resolved_category
      ORDER BY total DESC
      LIMIT 4
    `, baseParams),

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
      script: isBellavita ? '' : (offerConfig?.scriptText ?? ''),
      topProduct: isBellavita ? (products[0]?.product ?? null) : null,
      products: isBellavita ? products.map(p => ({ product: p.product, count: Number(p.n) })) : [],
    },
    categories: categoryRows.map(r => {
      const total = Number(r.total);
      const sales = Number(r.sales);
      const script = isBellavita
        ? (BELLAVITA_CATEGORY_SCRIPTS[r.resolved_category] ?? '')
        : (objectionConfig.find(c => c.objectionCategory === r.resolved_category)?.scriptText ?? '');
      return {
        category: r.resolved_category,
        script,
        total,
        contribution_pct: pct(total, totalCategoryCalls),
        call_end: total - sales,
        sale_done: sales,
        conv_pct: pct(sales, total),
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
