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

  const [rejectedBreakdown, row, oppRow, oppLossPie, oppCatPie, moBreaksPie, moCategoryRaw, nedRaw, objectionCategoryPie, npsRaw, npsDaysRaw] = await Promise.all([
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

export async function getMagicalScript(filters: QualityFilters) {
  const { startDate, endDate, clientId } = filters;
  const { sql: cf, params: cfParams } = clientClause(filters);
  const dateParams = [startDate, endDate, ...cfParams];

  // Resolve internal client id for the scripts config table
  const internalRow = clientId
    ? (await querySource<{ id: number }>(
        'SELECT id FROM shivamgiri.md_clients WHERE dialdesk_client_id = ? LIMIT 1',
        [Number(clientId)]
      ))[0] ?? null
    : null;
  const internalClientId = internalRow?.id ?? null;

  const [scripts, flowRaw, objRaw] = await Promise.all([
    internalClientId
      ? querySource<{ stage: string; stage_title: string; objection_category: string | null; script_text: string | null; display_order: number }>(
          `SELECT stage, stage_title, objection_category, script_text, display_order
           FROM shivamgiri.md_magical_scripts
           WHERE client_id = ? AND is_active = 1
           ORDER BY display_order`,
          [internalClientId]
        )
      : ([] as { stage: string; stage_title: string; objection_category: string | null; script_text: string | null; display_order: number }[]),

    querySource<{ total: number; op_pass: number; csp_pass: number; offer_pass: number; sale_done: number }>(`
      WITH base AS (
        SELECT
          CASE
            WHEN cd.AfterListeningOfferRejected = 1 OR cd.SaleDone = 1 THEN 'post_offer'
            WHEN cd.ObjectionHandlingContext = 'None'                   THEN 'offering_rejected'
            WHEN cd.ContactSettingContext    = 'None'                   THEN 'context_rejected'
            ELSE 'opening_rejected'
          END AS call_stage,
          COALESCE(cd.SaleDone, 0) AS is_sale
        FROM db_external.CallDetails cd
        WHERE cd.MobileNo IS NOT NULL AND cd.MobileNo != ''
          AND cd.CallDate BETWEEN ? AND ? ${cf}
      )
      SELECT
        COUNT(*)                                                                   AS total,
        SUM(CASE WHEN call_stage != 'opening_rejected' THEN 1 ELSE 0 END)          AS op_pass,
        SUM(CASE WHEN call_stage IN ('offering_rejected','post_offer') THEN 1 ELSE 0 END) AS csp_pass,
        SUM(CASE WHEN call_stage = 'post_offer'        THEN 1 ELSE 0 END)          AS offer_pass,
        SUM(is_sale)                                                               AS sale_done
      FROM base
    `, dateParams),

    querySource<{ cat: string; total: number; sales: number; conv_pct: number }>(`
      SELECT
        cd.CustomerObjectionCategory                                                            AS cat,
        COUNT(*)                                                                                AS total,
        SUM(CASE WHEN COALESCE(cd.SaleDone,0)=1 THEN 1 ELSE 0 END)                            AS sales,
        ROUND(SUM(CASE WHEN COALESCE(cd.SaleDone,0)=1 THEN 1 ELSE 0 END)*100.0/NULLIF(COUNT(*),0),1) AS conv_pct
      FROM db_external.CallDetails cd
      WHERE cd.MobileNo IS NOT NULL AND cd.MobileNo != ''
        AND cd.CallDate BETWEEN ? AND ?
        AND cd.CustomerObjectionCategory IS NOT NULL
        AND cd.CustomerObjectionCategory != ''
        AND cd.CustomerObjectionCategory != 'None' ${cf}
      GROUP BY cd.CustomerObjectionCategory
      ORDER BY total DESC
    `, dateParams),
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
  };
}

// ─── Customer Interaction Insights (Outbound) ─────────────────────────────────
// Same idea as the Inbound "Customer Interaction Insights" panel, but Outbound's
// CallDetails table has no pre-computed sentiment/VOC columns — everything here is
// derived by keyword-matching the raw TranscribeText column directly.

// Plain LIKE '%...%' substring matching — no FULLTEXT index exists on TranscribeText (a live
// insert pipeline writes to this table and building one caused real contention; see project notes).
// Terms may carry MATCH...AGAINST-style decoration ("phrase", word*) from when this used FULLTEXT —
// stripped here so the keyword lists below didn't need to change.
const against = (terms: string[]) => {
  const clean = terms.map(t => t.replace(/^"|"$/g, '').replace(/\*$/, '').toLowerCase());
  return '(' + clean.map(k => `LOWER(cd.TranscribeText) LIKE '%${k}%'`).join(' OR ') + ')';
};

const SOCIAL_COURT_KEYWORDS = [
  'social media', 'consumer court', 'consumer forum', 'legal action',
  'lawyer', 'fir', 'police complaint', 'blackmail', 'court case', 'legal notice',
];
const OUTBOUND_SOCIAL_COURT_COND = against(SOCIAL_COURT_KEYWORDS.map(k => `"${k}"`));

const SCAM_KEYWORDS = ['scam', 'fraud', 'cheat', 'fake', 'loot'];
const OUTBOUND_SCAM_COND = against(SCAM_KEYWORDS.map(k => `${k}*`));

const OUTBOUND_GOLDEN_WORDS: { category: string; keywords: string[] }[] = [
  { category: 'Courtesy & Gratitude',      keywords: ['thank', 'appreciat'] },
  { category: 'Support & Assistance',      keywords: ['help', 'assist'] },
  { category: 'Acknowledgement & Underst.', keywords: ['understand'] },
  { category: 'Positive Reinforcement',    keywords: ['nice', 'good', 'great'] },
  { category: 'Customer Satisfaction',     keywords: ['satisf'] },
  { category: 'Other Keywords',            keywords: ['patient', 'happy', 'excellent', 'wonder'] },
];

// First-match-wins, mirroring the Inbound NEG_CAT_EXPR priority ordering.
const CRITICAL_SIGNAL_GROUPS: { label: string; keywords: string[] }[] = [
  { label: 'Abuse',       keywords: ['abusive', 'insult', 'offensive', 'rude', 'misbehave', 'harass'] },
  { label: 'Threat',      keywords: ['fraud', 'scam', 'cheat', 'legal action', 'consumer court', 'police complaint', 'blackmail', 'lawyer', 'social media'] },
  { label: 'Slang',       keywords: ['bakvaas', 'ghatiya', 'bullshit', 'farzi', 'paagal', 'barbaad', 'nonsense'] },
  { label: 'Sarcasm',     keywords: ['sarcastic', 'yeah right', 'whatever'] },
  { label: 'Frustration', keywords: ['frustrat', 'disappoint', 'dissatisf', 'pathetic', 'terrible', 'horrible',
    'awful', 'worst', 'angry', 'not happy', 'not satisfied', 'pareshaan', 'inconvenien', 'irritat', 'annoying'] },
];

const OUTBOUND_CRITICAL_SIGNAL_CASE = `CASE
  ${CRITICAL_SIGNAL_GROUPS.map(g => `WHEN ${against(g.keywords.map(k => k.includes(' ') ? `"${k}"` : `${k}*`))}\n    THEN '${g.label}'`).join('\n  ')}
  ELSE 'No'
END`;

const GOLDEN_COLS = ['golden_courtesy', 'golden_support', 'golden_ack', 'golden_positive', 'golden_satisfaction', 'golden_other'];

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
        social_court_flag   TINYINT(1) NOT NULL DEFAULT 0,
        scam_flag           TINYINT(1) NOT NULL DEFAULT 0,
        golden_courtesy     TINYINT(1) NOT NULL DEFAULT 0,
        golden_support      TINYINT(1) NOT NULL DEFAULT 0,
        golden_ack          TINYINT(1) NOT NULL DEFAULT 0,
        golden_positive     TINYINT(1) NOT NULL DEFAULT 0,
        golden_satisfaction TINYINT(1) NOT NULL DEFAULT 0,
        golden_other        TINYINT(1) NOT NULL DEFAULT 0,
        critical_signal     VARCHAR(20) NOT NULL DEFAULT 'No',
        computed_at         DATETIME DEFAULT NOW(),
        INDEX idx_client_date   (client_id, call_date),
        INDEX idx_client_social (client_id, social_court_flag),
        INDEX idx_client_scam   (client_id, scam_flag),
        INDEX idx_client_signal (client_id, critical_signal)
      )
    `);
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS db_masmis.outbound_insights_cursor (
        id TINYINT PRIMARY KEY DEFAULT 1,
        last_call_id INT NOT NULL DEFAULT 0
      )
    `);
    const [cursorRows] = await pool.execute(`SELECT last_call_id FROM db_masmis.outbound_insights_cursor WHERE id = 1`);
    if ((cursorRows as any[]).length === 0) {
      // Seed ~30 days back so recent (dashboard-relevant) data backfills first, instead of
      // starting the catch-up from the oldest row in a 400K+ row table.
      const seedRows = await querySource<{ minId: number }>(
        `SELECT COALESCE(MIN(id), 0) AS minId FROM db_external.CallDetails WHERE CallDate >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
      );
      const seedId = Math.max(0, Number(seedRows[0]?.minId ?? 0) - 1);
      await pool.execute(`INSERT INTO db_masmis.outbound_insights_cursor (id, last_call_id) VALUES (1, ?)`, [seedId]);
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
    .map((g, i) => `${against(g.keywords.map(k => `${k}*`))} AS golden_${i}`)
    .join(',\n      ');

  type Row = {
    id: number; client_id: number; CallDate: string; LeadID: string | null;
    AgentName: string | null; MobileNo: string | null;
    social_court: number; scam: number; critical_signal: string;
  } & Record<string, number>;

  const rows = await querySource<Row>(`
    SELECT cd.id, cd.client_id, cd.CallDate, cd.LeadID, cd.AgentName, cd.MobileNo,
      ${OUTBOUND_SOCIAL_COURT_COND} AS social_court,
      ${OUTBOUND_SCAM_COND} AS scam,
      ${goldenSelect},
      ${OUTBOUND_CRITICAL_SIGNAL_CASE} AS critical_signal
    FROM db_external.CallDetails cd
    WHERE cd.id > ? AND cd.TranscribeText IS NOT NULL AND cd.TranscribeText != ''
    ORDER BY cd.id ASC
    LIMIT ${Number(batchSize)}
  `, [lastId]);

  if (rows.length === 0) return 0;

  const placeholders = rows.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())').join(',');
  const flat = rows.flatMap(r => [
    r.id, r.client_id, r.CallDate, r.LeadID, r.AgentName, r.MobileNo,
    r.social_court, r.scam,
    r.golden_0, r.golden_1, r.golden_2, r.golden_3, r.golden_4, r.golden_5,
    r.critical_signal,
  ]);

  await queryMasmis(`
    INSERT INTO db_masmis.outbound_call_insights
      (call_id, client_id, call_date, lead_id, agent_name, mobile_no,
       social_court_flag, scam_flag,
       golden_courtesy, golden_support, golden_ack, golden_positive, golden_satisfaction, golden_other,
       critical_signal, computed_at)
    VALUES ${placeholders}
    ON DUPLICATE KEY UPDATE computed_at = VALUES(computed_at)
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
  social_media_court_threat: number;
  potential_scam: number;
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
    queryMasmis<{ audit_count: number; social: number; scam: number } & Record<string, number>>(`
      SELECT
        COUNT(*) AS audit_count,
        SUM(social_court_flag) AS social,
        SUM(scam_flag) AS scam,
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
    audit_count:                Number(summary?.audit_count ?? 0),
    social_media_court_threat:  Number(summary?.social ?? 0),
    potential_scam:              Number(summary?.scam ?? 0),
    frustration_count:          signalMap.get('Frustration') ?? 0,
    threat_count:                signalMap.get('Threat')      ?? 0,
    cuss_abuse_count:            signalMap.get('Abuse')       ?? 0,
    slang_count:                signalMap.get('Slang')       ?? 0,
    sarcasm_count:                signalMap.get('Sarcasm')     ?? 0,
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

function keywordsForCategory(category: string): string[] {
  if (category === 'social') return SOCIAL_COURT_KEYWORDS;
  if (category === 'scam') return SCAM_KEYWORDS;
  if (category.startsWith('golden:')) {
    const idx = Number(category.split(':')[1]);
    return OUTBOUND_GOLDEN_WORDS[idx]?.keywords ?? [];
  }
  if (category.startsWith('signal:')) {
    const label = category.slice('signal:'.length);
    return CRITICAL_SIGNAL_GROUPS.find(g => g.label === label)?.keywords ?? [];
  }
  return [];
}

// category: 'social' | 'scam' | 'golden:0'..'golden:5' | 'signal:Frustration'|'signal:Threat'|...
export async function getOutboundInsightDrill(filters: QualityFilters, category: string): Promise<OutboundInsightDrillResponse> {
  const { startDate, endDate, clientId } = filters;
  const cf = clientId ? ' AND client_id = ?' : '';
  const params: (string | number)[] = [startDate, endDate, ...(clientId ? [Number(clientId)] : [])];

  let whereExtra = '1=0';
  const extraParams: (string | number)[] = [];
  if (category === 'social') whereExtra = 'social_court_flag = 1';
  else if (category === 'scam') whereExtra = 'scam_flag = 1';
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
  // set of calls to surface which specific word/phrase triggered the match, and (for the social
  // category) whether it was a social-media mention or a court/legal one.
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
  const isSocial = category === 'social';

  return {
    leads: rows.map(r => {
      const text = transcriptMap.get(Number(r.call_id)) ?? '';
      const matchedWord = keywords.find(k => text.includes(k.toLowerCase())) ?? '';
      const type = isSocial ? (text.includes('social media') ? 'Social Media' : 'Court & Legal') : '';
      return {
        callId:      Number(r.call_id),
        leadId:      String(r.lead_id ?? ''),
        agentName:   String(r.agent_name ?? 'Unknown'),
        mobileNo:    String(r.mobile_no ?? ''),
        callDate:    String(r.call_date),
        type,
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
