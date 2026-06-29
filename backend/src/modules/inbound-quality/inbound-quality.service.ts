import { querySource } from '../../lib/sourceDb';

// ─── Negative signal categorisation CASE expression ──────────────────────────
// First: exact matches (highest priority, first match wins in SQL CASE)
// Then:  LIKE-based keyword fallbacks for unrecognised values
const NEG_CAT = `CASE
  WHEN q.top_negative_words = 'discontinuing, pathetic, negative feedback' THEN 'Frustration'
  WHEN q.top_negative_words = 'fraud, pressure, complaint' THEN 'Threat'
  WHEN q.top_negative_words = 'frustrated, delayed, lack of communication' THEN 'Frustration'
  WHEN q.top_negative_words = 'delay, disappointed, bad experience, very bad impression' THEN 'Threat'
  WHEN q.top_negative_words = 'cancel, problem, wait, frustration, delay' THEN 'Frustration'
  WHEN q.top_negative_words = 'time pass, naalaayak' THEN 'Slang'
  WHEN q.top_negative_words = 'inconvenience, problem, face, short, video' THEN 'Threat'
  WHEN q.top_negative_words = 'Frustrated, Spilled, Damage, Inconvenience' THEN 'Frustration'
  WHEN q.top_negative_words = 'pathetic, harassment, stupid' THEN 'Abuse'
  WHEN q.top_negative_words = 'damage, used, less quantity' THEN 'Frustration'
  WHEN q.top_negative_words = 'bakvaas, third class, bakvaas experience' THEN 'Threat'
  WHEN q.top_negative_words = 'harass' THEN 'Abuse'
  WHEN q.top_negative_words = 'embarrassment' THEN 'Frustration'
  WHEN q.top_negative_words = 'frustration' THEN 'Frustration'
  WHEN q.top_negative_words = 'cheat, fraud, complaint' THEN 'Threat'
  WHEN q.top_negative_words = 'frustration, threatened legal action' THEN 'Threat'
  WHEN q.top_negative_words = 'scam' THEN 'Threat'
  WHEN q.top_negative_words = 'missing, frustrated, requesting, refund' THEN 'Frustration'
  WHEN q.top_negative_words = 'spam calls, lottery scam' THEN 'Threat'
  WHEN q.top_negative_words = 'inconvenience, costly, smell' THEN 'Sarcasm'
  WHEN q.top_negative_words = 'gutka paan' THEN 'Slang'
  WHEN q.top_negative_words = 'bigad gaya, bura impression, fake remarks, maafi chaahoongi' THEN 'Frustration'
  WHEN q.top_negative_words = 'inconvenience, not satisfying' THEN 'Threat'
  WHEN q.top_negative_words = 'damage, inconvenience' THEN 'Threat'
  WHEN q.top_negative_words = 'missing, incomplete, inconvenience' THEN 'Threat'
  WHEN q.top_negative_words = 'faulty, issue' THEN 'Threat'
  WHEN q.top_negative_words = 'fake website' THEN 'Threat'
  WHEN q.top_negative_words = 'Scam, Spam, Loot' THEN 'Threat'
  WHEN q.top_negative_words = 'harass, mental harassment, fake, warning, court case' THEN 'Threat'
  WHEN q.top_negative_words = 'inconvenience, missing, disappointing, unexpected' THEN 'Threat'
  WHEN q.top_negative_words = 'damage, leaked, inconvenience' THEN 'Threat'
  WHEN q.top_negative_words = 'frustrated, delay, expiration, unavailable' THEN 'Frustration'
  WHEN q.top_negative_words = 'bullshit, irritating, ridiculous' THEN 'Slang'
  WHEN q.top_negative_words = 'frustrated, inconvenience' THEN 'Frustration'
  WHEN q.top_negative_words = 'Inconvenience, Delay' THEN 'Frustration'
  WHEN q.top_negative_words = 'fraud' THEN 'Threat'
  WHEN q.top_negative_words = 'security concerns' THEN 'Threat'
  WHEN q.top_negative_words = 'frustrated, dissatisfied, threatens, negative feedback' THEN 'Frustration'
  WHEN q.top_negative_words = 'gatia, locha, gatiya' THEN 'Slang'
  WHEN q.top_negative_words = 'fraud, jooth, reject, cheat' THEN 'Threat'
  WHEN q.top_negative_words = 'tampered, missing, used' THEN 'Frustration'
  WHEN q.top_negative_words = 'fraud, scam, fraudulent, fraudster' THEN 'Threat'
  WHEN q.top_negative_words = 'contradicting, frustration, delay, confusion' THEN 'Frustration'
  WHEN q.top_negative_words = 'bad, very bad, demand, frustration, dissatisfied' THEN 'Frustration'
  WHEN q.top_negative_words = 'fraud, spam, data leak' THEN 'Threat'
  WHEN q.top_negative_words = 'upset, don''t trust, mad' THEN 'Frustration'
  WHEN q.top_negative_words = 'irritating, spamming, annoying' THEN 'Threat'
  WHEN q.top_negative_words = 'compromise, scammers, fishing site' THEN 'Threat'
  WHEN q.top_negative_words = 'frustrating, poor, panicking, frustrating' THEN 'Frustration'
  WHEN q.top_negative_words = 'zero star, rare' THEN 'Threat'
  WHEN q.top_negative_words = 'fake call, fraud call, avoid' THEN 'Threat'
  WHEN q.top_negative_words = 'low quality, illegal business, misleading' THEN 'Threat'
  WHEN q.top_negative_words = 'fraudulent, fake, scam' THEN 'Threat'
  WHEN q.top_negative_words = 'frustrated, dissatisfaction' THEN 'Frustration'
  WHEN q.top_negative_words = 'Bakvaas' THEN 'Slang'
  WHEN q.top_negative_words = 'dissatisfied, frustration, negative review' THEN 'Frustration'
  WHEN q.top_negative_words = 'delay, issue, complaint' THEN 'Frustration'
  WHEN q.top_negative_words = 'leak, damage' THEN 'Threat'
  WHEN q.top_negative_words = 'inconvenience, frustrated, delay' THEN 'Frustration'
  WHEN q.top_negative_words = 'misguide' THEN 'Threat'
  WHEN q.top_negative_words = 'shocked, leak' THEN 'Threat'
  WHEN q.top_negative_words = 'fraud call' THEN 'Threat'
  WHEN q.top_negative_words = 'damaged, broken, cannot, forgot' THEN 'Threat'
  WHEN q.top_negative_words = 'damaged' THEN 'Threat'
  WHEN q.top_negative_words = 'frustrated, delay, missing' THEN 'Threat'
  WHEN q.top_negative_words = 'smell' THEN 'Sarcasm'
  WHEN q.top_negative_words = 'heavy, issue, problem, allergy' THEN 'Threat'
  WHEN q.top_negative_words = 'complicated, fed up, private, reluctance' THEN 'Threat'
  WHEN q.top_negative_words = 'discontinued, unavailable, disappointing, not available, out of stock' THEN 'Frustration'
  WHEN q.top_negative_words = 'dissatisfaction, fraudulent, loss' THEN 'Threat'
  WHEN q.top_negative_words = 'confuse, force, chutiya' THEN 'Abuse'
  WHEN q.top_negative_words = 'Misbehave by Delivery boy' THEN 'Abuse'
  WHEN q.top_negative_words = 'Mat lagao idhar idhar, sokira' THEN 'Sarcasm'
  WHEN q.top_negative_words = 'Inconvenience, Wrong, Return, Not received' THEN 'Frustration'
  WHEN q.top_negative_words = 'reviews, fraud, problem' THEN 'Threat'
  WHEN q.top_negative_words = 'Frustration, Wrong with service, Frustration' THEN 'Frustration'
  WHEN q.top_negative_words = 'lost, delay, inconvenience, issue, complaint' THEN 'Threat'
  WHEN q.top_negative_words = 'missing, missing item' THEN 'Threat'
  WHEN q.top_negative_words = 'Badtamizi' THEN 'Slang'
  WHEN q.top_negative_words = 'missing, wrong, dissatisfaction, inconvenience' THEN 'Frustration'
  WHEN q.top_negative_words = 'fake rewards, unavailable, frustration, dissatisfaction' THEN 'Threat'
  WHEN q.top_negative_words = 'half, fraud, incorrect, concerns, frustration' THEN 'Threat'
  WHEN q.top_negative_words = 'frustrated, lack of resolution, delivery issues' THEN 'Frustration'
  WHEN q.top_negative_words = 'delay, complaint, frustrated, escalate' THEN 'Frustration'
  WHEN q.top_negative_words = 'Chor, Thag, Kutton' THEN 'Threat'
  WHEN q.top_negative_words = 'frustration, disconnecting' THEN 'Frustration'
  WHEN q.top_negative_words = 'frustrated, loss, harassment' THEN 'Frustration'
  WHEN q.top_negative_words = 'frustrated, reluctant, uncooperative' THEN 'Frustration'
  WHEN q.top_negative_words = 'scam, waste of time, ghatiya, shame, shit' THEN 'Threat'
  WHEN q.top_negative_words = 'pathetic' THEN 'Frustration'
  WHEN q.top_negative_words = 'fraud, water instead of perfume' THEN 'Threat'
  WHEN q.top_negative_words = 'trouble, inconvenience, frustration' THEN 'Frustration'
  WHEN q.top_negative_words = 'ladai, phaahi, karvai, misbehave' THEN 'Abuse'
  WHEN q.top_negative_words = 'daadoo, ukhaadoo' THEN 'Slang'
  WHEN q.top_negative_words = 'wait, check, concern, delay' THEN 'Frustration'
  WHEN q.top_negative_words = 'inconvenience, mistake, refund, initiated, incorrect' THEN 'Frustration'
  WHEN q.top_negative_words = 'inconvenience' THEN 'Frustration'
  WHEN q.top_negative_words = 'none' THEN 'No'
  WHEN q.top_negative_words = 'samajh nahin pa rahi hai' THEN 'Frustration'
  WHEN q.top_negative_words = 'fake, market, fake, market' THEN 'Threat'
  WHEN q.top_negative_words = 'slow, frustration, nonsense' THEN 'Frustration'
  WHEN q.top_negative_words = 'refund, wait, complaint' THEN 'Frustration'
  WHEN q.top_negative_words = 'Fake, Review, Ganda' THEN 'Abuse'
  WHEN q.top_negative_words = 'received different, wrong one, apologize, inconvenience' THEN 'Frustration'
  WHEN q.top_negative_words = 'inconvenience, missing, leakage, not working' THEN 'Threat'
  WHEN q.top_negative_words = 'concern, inconvenience' THEN 'Threat'
  WHEN q.top_negative_words = 'Unreachable, Blood boils' THEN 'Slang'
  WHEN q.top_negative_words = 'defected, old, leakage' THEN 'Threat'
  WHEN q.top_negative_words = 'inconvenience, damaged, disappointed' THEN 'Threat'
  WHEN q.top_negative_words = 'rude behavior, inconvenience' THEN 'Abuse'
  WHEN q.top_negative_words = 'irritate, frustrated' THEN 'Frustration'
  WHEN q.top_negative_words = 'loss one customer, dissatisfaction' THEN 'Threat'
  WHEN q.top_negative_words = 'Unavailable, Restricted, Unavailable, Unreachable, Issue' THEN 'Frustration'
  WHEN q.top_negative_words = 'ridiculous, inconvenience, too long' THEN 'Frustration'
  WHEN q.top_negative_words = 'complaint, dissatisfied, frustration, delay, missing' THEN 'Frustration'
  WHEN q.top_negative_words = 'I don''t like this product.' THEN 'Sarcasm'
  WHEN q.top_negative_words = 'fraud, missing, inconvenience' THEN 'Threat'
  WHEN q.top_negative_words = 'complaint, dissatisfied, wrong product, replacement, limitations' THEN 'Frustration'
  WHEN q.top_negative_words = 'fraud, police' THEN 'Threat'
  WHEN q.top_negative_words = 'frustrated, delays, lack of response' THEN 'Frustration'
  WHEN q.top_negative_words = 'ridiculous' THEN 'Slang'
  WHEN q.top_negative_words = 'broken, dissatisfied, complaining, demanding' THEN 'Frustration'
  WHEN q.top_negative_words = 'half order, wrong, missing, dissatisfied' THEN 'Frustration'
  WHEN q.top_negative_words = 'penalty, CIBIL, frustration' THEN 'Threat'
  WHEN q.top_negative_words = 'frustrating, annoying, disappointing' THEN 'Frustration'
  WHEN q.top_negative_words = 'Ghatiya' THEN 'Frustration'
  WHEN q.top_negative_words = 'irritated, fucking, thak gaya' THEN 'Frustration'
  WHEN q.top_negative_words = 'irritated, least interested, struggled' THEN 'Frustration'
  WHEN q.top_negative_words = 'dubaara, kuchh nahin aaya, solah, koi faayda hi nahin, cash on delivery order, koi free gift receive nahin hota' THEN 'Frustration'
  WHEN q.top_negative_words = 'frustration, delay, inconvenience, not responding' THEN 'Frustration'
  WHEN q.top_negative_words = 'psycho' THEN 'Frustration'
  WHEN q.top_negative_words = 'refund, dissatisfaction, confusion' THEN 'Frustration'
  WHEN q.top_negative_words = 'fraud, poor' THEN 'Threat'
  WHEN q.top_negative_words = 'wasted, fake, bad, complaint, unsatisfied' THEN 'Frustration'
  WHEN q.top_negative_words = 'mislead, crime, unfair practices, consumer court' THEN 'Threat'
  WHEN LOWER(q.top_negative_words) LIKE '%frustration%' THEN 'Frustration'
  WHEN LOWER(q.top_negative_words) LIKE '%frustrated%' THEN 'Frustration'
  WHEN LOWER(q.top_negative_words) LIKE '%fir%' THEN 'Threat'
  WHEN LOWER(q.top_negative_words) LIKE '%gatia%' THEN 'Threat'
  WHEN LOWER(q.top_negative_words) LIKE '%fraud%' THEN 'Threat'
  WHEN LOWER(q.top_negative_words) LIKE '%bakvaas%' THEN 'Slang'
  WHEN LOWER(q.top_negative_words) LIKE '%scam%' THEN 'Threat'
  WHEN LOWER(q.top_negative_words) LIKE '%pathetic%' THEN 'Threat'
  WHEN LOWER(q.top_negative_words) LIKE '%dissatisfaction%' THEN 'Frustration'
  WHEN LOWER(q.top_negative_words) LIKE '%inconvenience%' THEN 'Frustration'
  WHEN LOWER(q.top_negative_words) LIKE '%fake%' THEN 'Threat'
  WHEN LOWER(q.top_negative_words) LIKE '%disappointed%' THEN 'Frustration'
  WHEN LOWER(q.top_negative_words) LIKE '%pareshaan%' THEN 'Frustration'
  WHEN LOWER(q.top_negative_words) LIKE '%misbehave%' THEN 'Abuse'
  WHEN LOWER(q.top_negative_words) LIKE '%frustrating%' THEN 'Frustration'
  WHEN LOWER(q.top_negative_words) LIKE '%unpleasant%' THEN 'Slang'
  WHEN LOWER(q.top_negative_words) LIKE '%angry%' THEN 'Frustration'
  WHEN LOWER(q.top_negative_words) LIKE '%mahanga%' THEN 'Slang'
  WHEN LOWER(q.top_negative_words) LIKE '%band kar do%' THEN 'Slang'
  WHEN LOWER(q.top_negative_words) LIKE '%disappointing%' THEN 'Frustration'
  WHEN LOWER(q.top_negative_words) LIKE '%dissatisfied%' THEN 'Threat'
  WHEN LOWER(q.top_negative_words) LIKE '%loot%' THEN 'Slang'
  WHEN LOWER(q.top_negative_words) LIKE '%irritating%' THEN 'Frustration'
  WHEN LOWER(q.top_negative_words) LIKE '%farzi%' THEN 'Slang'
  WHEN LOWER(q.top_negative_words) LIKE '%unsatisfied%' THEN 'Frustration'
  WHEN LOWER(q.top_negative_words) LIKE '%barbaad%' THEN 'Slang'
  WHEN LOWER(q.top_negative_words) LIKE '%unsatisfactory%' THEN 'Threat'
  WHEN LOWER(q.top_negative_words) LIKE '%ghatiya%' THEN 'Slang'
  WHEN LOWER(q.top_negative_words) LIKE '%cheating%' THEN 'Threat'
  WHEN LOWER(q.top_negative_words) LIKE '%paagal%' THEN 'Slang'
  WHEN LOWER(q.top_negative_words) LIKE '%badboo%' THEN 'Frustration'
  WHEN LOWER(q.top_negative_words) LIKE '%shut up%' THEN 'Frustration'
  WHEN LOWER(q.top_negative_words) LIKE '%randipana%' THEN 'Abuse'
  WHEN LOWER(q.top_negative_words) LIKE '%bullshit%' THEN 'Frustration'
  ELSE 'No'
END`;

export interface InboundQualityFilters {
  startDate: string;
  endDate:   string;
  clientId?: string;
}

// ─── Client list (for the process grid) ──────────────────────────────────────

export interface InboundClientSummary {
  client_id:         string;
  client_name:       string;
  audit_count:       number;
  cq_score:          number;
  cq_score_no_fatal: number;
  excellent:         number;
  good:              number;
  average_count:     number;
  below_average:     number;
  fatal_count:       number;
}

export async function getInboundClients(filters: InboundQualityFilters): Promise<InboundClientSummary[]> {
  const { startDate, endDate } = filters;

  const rows = await querySource<{
    client_id:         string;
    client_name:       string;
    audit_count:       number;
    cq_score:          number | null;
    cq_score_no_fatal: number | null;
    excellent:         number;
    good:              number;
    average_count:     number;
    below_average:     number;
    fatal_count:       number;
  }>(`
    SELECT
      q.ClientId                                                                   AS client_id,
      COALESCE(c.name, CONCAT('Client ', q.ClientId))                             AS client_name,
      COUNT(*)                                                                     AS audit_count,
      ROUND(AVG(q.quality_percentage), 1)                                         AS cq_score,
      ROUND(AVG(CASE WHEN q.quality_percentage > 0 THEN q.quality_percentage END), 1) AS cq_score_no_fatal,
      SUM(CASE WHEN q.quality_percentage >= 98                                  THEN 1 ELSE 0 END) AS excellent,
      SUM(CASE WHEN q.quality_percentage >= 90 AND q.quality_percentage < 98    THEN 1 ELSE 0 END) AS good,
      SUM(CASE WHEN q.quality_percentage >= 85 AND q.quality_percentage < 90    THEN 1 ELSE 0 END) AS average_count,
      SUM(CASE WHEN q.quality_percentage > 0  AND q.quality_percentage < 85     THEN 1 ELSE 0 END) AS below_average,
      SUM(CASE WHEN q.quality_percentage = 0                                    THEN 1 ELSE 0 END) AS fatal_count
    FROM db_audit.call_quality_assessment q
    LEFT JOIN shivamgiri.md_clients c ON c.dialdesk_client_id = CAST(q.ClientId AS UNSIGNED)
    WHERE q.CallDate BETWEEN ? AND ?
      AND q.quality_percentage IS NOT NULL
    GROUP BY q.ClientId, c.name
    ORDER BY client_name ASC
  `, [startDate, endDate]);

  return rows.map(r => ({
    client_id:         String(r.client_id),
    client_name:       String(r.client_name),
    audit_count:       Number(r.audit_count),
    cq_score:          Number(r.cq_score          ?? 0),
    cq_score_no_fatal: Number(r.cq_score_no_fatal ?? 0),
    excellent:         Number(r.excellent),
    good:              Number(r.good),
    average_count:     Number(r.average_count),
    below_average:     Number(r.below_average),
    fatal_count:       Number(r.fatal_count),
  }));
}

// ─── Process KPIs (for the process detail page) ───────────────────────────────

export interface PieSlice { name: string; value: number; color: string; }

export interface AchtRow {
  category:    string;
  audit_count: number;
  score_pct:   number;
  fatal_count: number;
  fatal_pct:   number;
}

export interface InboundProcessKPIs {
  client_id:         string;
  client_name:       string;
  audit_count:       number;
  cq_score:          number;
  cq_score_no_fatal: number;
  excellent:         number;
  good:              number;
  average_count:     number;
  below_average:     number;
  fatal_count:       number;
  opening_skill:     number;
  soft_skill:        number;
  hold_procedure:    number;
  resolution:        number;
  closing:                    number;
  avg_score:                  number;
  social_media_court_threat:  number;
  potential_scam:             number;
  frustration_count:          number;
  threat_count:               number;
  abuse_count:                number;
  slang_count:                number;
  sarcasm_count:              number;
  pie_data:                   PieSlice[];
  acht_data:                  AchtRow[];
}

export async function getInboundProcessKPIs(filters: InboundQualityFilters): Promise<InboundProcessKPIs> {
  const { startDate, endDate, clientId } = filters;
  const clientFilter = clientId ? ' AND q.ClientId = ?' : '';
  const params: (string | number)[] = [startDate, endDate, ...(clientId ? [clientId] : [])];

  const [row] = await querySource<{
    client_id:                  string;
    client_name:                string;
    audit_count:                number;
    cq_score:                   number | null;
    cq_score_no_fatal:          number | null;
    excellent:                  number;
    good:                       number;
    average_count:              number;
    below_average:              number;
    fatal_count:                number;
    opening_skill:              number | null;
    soft_skill:                 number | null;
    hold_procedure:             number | null;
    resolution:                 number | null;
    closing:                    number | null;
    social_media_court_threat:  number;
    potential_scam:             number;
  }>(`
    SELECT
      q.ClientId                                                                   AS client_id,
      COALESCE(c.name, CONCAT('Client ', q.ClientId))                             AS client_name,
      COUNT(*)                                                                     AS audit_count,
      ROUND(AVG(q.quality_percentage), 1)                                         AS cq_score,
      ROUND(AVG(CASE WHEN q.quality_percentage > 0 THEN q.quality_percentage END), 1) AS cq_score_no_fatal,
      SUM(CASE WHEN q.quality_percentage >= 98                                  THEN 1 ELSE 0 END) AS excellent,
      SUM(CASE WHEN q.quality_percentage >= 90 AND q.quality_percentage < 98    THEN 1 ELSE 0 END) AS good,
      SUM(CASE WHEN q.quality_percentage >= 85 AND q.quality_percentage < 90    THEN 1 ELSE 0 END) AS average_count,
      SUM(CASE WHEN q.quality_percentage > 0  AND q.quality_percentage < 85     THEN 1 ELSE 0 END) AS below_average,
      SUM(CASE WHEN q.quality_percentage = 0                                    THEN 1 ELSE 0 END) AS fatal_count,
      ROUND(AVG(
        CASE WHEN q.scenario1 IN ('Call Drop in between','Short Call/Blank Call') THEN 1
        ELSE COALESCE(q.customer_concern_acknowledged, 0) END
      ) * 100, 1) AS opening_skill,
      ROUND(AVG(
        CASE WHEN q.scenario1 IN ('Call Drop in between','Short Call/Blank Call') THEN 1
        ELSE (
          IF(q.professionalism_maintained        = 1, 0.111111111111111, 0) +
          IF(q.assurance_or_appreciation_provided= 1, 0.111111111111111, 0) +
          IF(q.express_empathy                   = 1, 0.111111111111111, 0) +
          IF(q.pronunciation_and_clarity         = 1, 0.111111111111111, 0) +
          IF(q.enthusiasm_and_no_fumbling        = 1, 0.111111111111111, 0) +
          IF(q.active_listening                  = 1, 0.111111111111111, 0) +
          IF(q.politeness_and_no_sarcasm         = 1, 0.111111111111111, 0) +
          IF(q.proper_grammar                    = 1, 0.111111111111111, 0) +
          IF(q.accurate_issue_probing            = 1, 0.111111111111111, 0)
        ) END
      ) * 100, 1) AS soft_skill,
      ROUND(AVG(
        CASE WHEN q.scenario1 IN ('Call Drop in between','Short Call/Blank Call') THEN 1
        ELSE (
          IF(q.proper_hold_procedure         = 1, 0.5, 0) +
          IF(q.proper_transfer_and_language  = 1, 0.5, 0)
        ) END
      ) * 100, 1) AS hold_procedure,
      ROUND(AVG(
        CASE WHEN q.scenario1 IN ('Call Drop in between','Short Call/Blank Call') THEN 1
        ELSE (
          IF(q.address_recorded_completely       = 1, 0.5, 0) +
          IF(q.correct_and_complete_information  = 1, 0.5, 0)
        ) END
      ) * 100, 1) AS resolution,
      ROUND(AVG(
        CASE WHEN q.scenario1 IN ('Call Drop in between','Short Call/Blank Call') THEN 1
        ELSE COALESCE(q.professionalism_maintained, 0) END
      ) * 100, 1) AS closing,
      SUM(CASE WHEN
        (CASE WHEN LOWER(TRIM(q.system_manipulation))         = 'yes' THEN 1 ELSE 0 END +
         CASE WHEN LOWER(TRIM(q.financial_fraud))             = 'yes' THEN 1 ELSE 0 END +
         CASE WHEN LOWER(TRIM(q.collusion))                   = 'yes' THEN 1 ELSE 0 END +
         CASE WHEN LOWER(TRIM(q.policy_communication_failure))= 'yes' THEN 1 ELSE 0 END) = 0
        AND (
          LOWER(q.sensetive_word) LIKE '%social%'   OR
          LOWER(q.sensetive_word) LIKE '%court%'    OR
          LOWER(q.sensetive_word) LIKE '%consumer%' OR
          LOWER(q.sensetive_word) LIKE '%legal%'    OR
          LOWER(q.sensetive_word) LIKE '%fir%'
        )
      THEN 1 ELSE 0 END) AS social_media_court_threat,
      SUM(CASE WHEN
        (CASE WHEN LOWER(TRIM(q.system_manipulation))         = 'yes' THEN 1 ELSE 0 END +
         CASE WHEN LOWER(TRIM(q.financial_fraud))             = 'yes' THEN 1 ELSE 0 END +
         CASE WHEN LOWER(TRIM(q.collusion))                   = 'yes' THEN 1 ELSE 0 END +
         CASE WHEN LOWER(TRIM(q.policy_communication_failure))= 'yes' THEN 1 ELSE 0 END) > 0
      THEN 1 ELSE 0 END) AS potential_scam
    FROM db_audit.call_quality_assessment q
    LEFT JOIN shivamgiri.md_clients c ON c.dialdesk_client_id = CAST(q.ClientId AS UNSIGNED)
    WHERE q.CallDate BETWEEN ? AND ?
      AND q.quality_percentage IS NOT NULL
      ${clientFilter}
    GROUP BY q.ClientId, c.name
  `, params);

  const r = row ?? {
    client_id: clientId ?? '', client_name: '',
    audit_count: 0, cq_score: null, cq_score_no_fatal: null,
    excellent: 0, good: 0, average_count: 0, below_average: 0, fatal_count: 0,
    opening_skill: null, soft_skill: null, hold_procedure: null, resolution: null, closing: null,
    social_media_court_threat: 0, potential_scam: 0,
  };

  const excellent     = Number(r.excellent);
  const good          = Number(r.good);
  const average_count = Number(r.average_count);
  const below_average = Number(r.below_average);

  // ── ACHT Categorization ─────────────────────────────────────────────────────
  const achtRaw = await querySource<{
    category:    string;
    audit_count: number;
    score_pct:   number | null;
    fatal_count: number;
    fatal_pct:   number | null;
  }>(`
    SELECT
      CASE
        WHEN length_in_sec < 60  THEN 'Short(<60sec)'
        WHEN length_in_sec < 301 THEN 'Average(1min-5min)'
        WHEN length_in_sec < 600 THEN 'Long(5min-10min)'
        ELSE 'Extremely Long(>10min)'
      END                                                                         AS category,
      COUNT(*)                                                                    AS audit_count,
      ROUND(AVG(quality_percentage), 1)                                          AS score_pct,
      SUM(CASE WHEN quality_percentage = 0 THEN 1 ELSE 0 END)                   AS fatal_count,
      ROUND(
        SUM(CASE WHEN quality_percentage = 0 THEN 1 ELSE 0 END) * 100.0
        / NULLIF(COUNT(*), 0), 1
      )                                                                           AS fatal_pct
    FROM db_audit.call_quality_assessment q
    WHERE q.CallDate BETWEEN ? AND ?
      AND q.quality_percentage IS NOT NULL
      AND q.length_in_sec IS NOT NULL
      ${clientFilter}
    GROUP BY category
    ORDER BY
      CASE category
        WHEN 'Short(<60sec)'          THEN 1
        WHEN 'Average(1min-5min)'     THEN 2
        WHEN 'Long(5min-10min)'       THEN 3
        WHEN 'Extremely Long(>10min)' THEN 4
      END
  `, params);

  const acht_data: AchtRow[] = achtRaw.map(a => ({
    category:    String(a.category),
    audit_count: Number(a.audit_count),
    score_pct:   Number(a.score_pct   ?? 0),
    fatal_count: Number(a.fatal_count),
    fatal_pct:   Number(a.fatal_pct   ?? 0),
  }));

  const opening_skill  = Number(r.opening_skill  ?? 0);
  const soft_skill     = Number(r.soft_skill     ?? 0);
  const hold_procedure = Number(r.hold_procedure ?? 0);
  const resolution     = Number(r.resolution     ?? 0);
  const closing        = Number(r.closing        ?? 0);
  const avg_score      = Number(((opening_skill + soft_skill + hold_procedure + resolution + closing) / 5).toFixed(1));

  // ── Negative signal categorisation ──────────────────────────────────────────
  const negRows = await querySource<{ neg_cat: string; cnt: number }>(`
    SELECT ${NEG_CAT} AS neg_cat, COUNT(*) AS cnt
    FROM db_audit.call_quality_assessment q
    WHERE q.CallDate BETWEEN ? AND ?
      AND q.quality_percentage IS NOT NULL
      ${clientFilter}
    GROUP BY neg_cat
  `, params);

  const negMap: Record<string, number> = {};
  for (const row of negRows) negMap[String(row.neg_cat)] = Number(row.cnt);

  return {
    client_id:         String(r.client_id),
    client_name:       String(r.client_name),
    audit_count:       Number(r.audit_count),
    cq_score:          Number(r.cq_score          ?? 0),
    cq_score_no_fatal: Number(r.cq_score_no_fatal ?? 0),
    excellent,
    good,
    average_count,
    below_average,
    fatal_count:       Number(r.fatal_count),
    opening_skill,
    soft_skill,
    hold_procedure,
    resolution,
    closing,
    avg_score,
    social_media_court_threat: Number(r.social_media_court_threat),
    potential_scam:             Number(r.potential_scam),
    frustration_count:          negMap['Frustration'] ?? 0,
    threat_count:               negMap['Threat']      ?? 0,
    abuse_count:                negMap['Abuse']       ?? 0,
    slang_count:                negMap['Slang']       ?? 0,
    sarcasm_count:              negMap['Sarcasm']     ?? 0,
    pie_data: [
      { name: 'Excellent',   value: excellent,     color: '#22C55E' },
      { name: 'Good',        value: good,          color: '#3B82F6' },
      { name: 'Average',     value: average_count, color: '#F59E0B' },
      { name: 'Below Avg',   value: below_average, color: '#EF4444' },
    ].filter(d => d.value > 0),
    acht_data,
  };
}

// ─── Top 5 Performers ────────────────────────────────────────────────────────

export interface TopPerformer {
  user:        string;
  audit_count: number;
  avg_score:   number;
}

export async function getTopPerformers(filters: InboundQualityFilters): Promise<TopPerformer[]> {
  const { startDate, endDate, clientId } = filters;
  const clientFilter = clientId ? ' AND q.ClientId = ?' : '';
  const params: (string | number)[] = [startDate, endDate, ...(clientId ? [clientId] : [])];

  const rows = await querySource<{ user: string; audit_count: number; avg_score: number | null }>(`
    SELECT
      q.User                                  AS user,
      COUNT(*)                                AS audit_count,
      ROUND(AVG(q.quality_percentage), 1)     AS avg_score
    FROM db_audit.call_quality_assessment q
    WHERE q.CallDate BETWEEN ? AND ?
      AND q.quality_percentage IS NOT NULL
      AND q.User IS NOT NULL
      AND TRIM(q.User) != ''
      ${clientFilter}
    GROUP BY q.User
    ORDER BY avg_score DESC
    LIMIT 5
  `, params);

  return rows.map(r => ({
    user:        String(r.user),
    audit_count: Number(r.audit_count),
    avg_score:   Number(r.avg_score ?? 0),
  }));
}

// ─── Last 7 Days Daily Scores ─────────────────────────────────────────────────

export interface DailyScore {
  call_date:   string;
  avg_score:   number;
  audit_count: number;
}

export async function getDailyScores(filters: InboundQualityFilters): Promise<DailyScore[]> {
  const { endDate, clientId } = filters;
  const clientFilter = clientId ? ' AND q.ClientId = ?' : '';
  const params: (string | number)[] = [endDate, endDate, ...(clientId ? [clientId] : [])];

  const rows = await querySource<{ call_date: string; avg_score: number | null; audit_count: number }>(`
    SELECT
      DATE_FORMAT(q.CallDate, '%Y-%m-%d')        AS call_date,
      ROUND(AVG(q.quality_percentage), 1)        AS avg_score,
      COUNT(*)                                   AS audit_count
    FROM db_audit.call_quality_assessment q
    WHERE q.CallDate >= DATE_SUB(DATE(?), INTERVAL 6 DAY)
      AND q.CallDate <  DATE_ADD(DATE(?), INTERVAL 1 DAY)
      AND q.quality_percentage IS NOT NULL
      ${clientFilter}
    GROUP BY DATE_FORMAT(q.CallDate, '%Y-%m-%d')
    ORDER BY call_date ASC
  `, params);

  return rows.map(r => ({
    call_date:   String(r.call_date),
    avg_score:   Number(r.avg_score ?? 0),
    audit_count: Number(r.audit_count),
  }));
}

// ─── New Alert Field CASE expression ─────────────────────────────────────────
// Priority: Scam Leads > Social Media/Court Threat > Top Negative Signals > Not
const ALERT_FIELD = `CASE
  WHEN (CASE WHEN LOWER(TRIM(q.system_manipulation))         = 'yes' THEN 1 ELSE 0 END +
        CASE WHEN LOWER(TRIM(q.financial_fraud))             = 'yes' THEN 1 ELSE 0 END +
        CASE WHEN LOWER(TRIM(q.collusion))                   = 'yes' THEN 1 ELSE 0 END +
        CASE WHEN LOWER(TRIM(q.policy_communication_failure))= 'yes' THEN 1 ELSE 0 END) > 0
  THEN 'Scam Leads'
  WHEN (LOWER(q.sensetive_word) LIKE '%court%'    OR
        LOWER(q.sensetive_word) LIKE '%consumer%' OR
        LOWER(q.sensetive_word) LIKE '%legal%'    OR
        LOWER(q.sensetive_word) LIKE '%fir%'      OR
        LOWER(q.sensetive_word) LIKE '%social%')
  THEN 'Social Media and Consumer Court Threat'
  WHEN (q.top_negative_words IS NOT NULL AND TRIM(q.top_negative_words) != ''
        AND LOWER(TRIM(q.top_negative_words)) != 'none')
  THEN 'Top Negative Signals'
  ELSE 'Not'
END`;

// ─── Scenario / Scenario1 Distribution ───────────────────────────────────────

export interface Scenario1Item { scenario1: string; count: number; pct: number; }
export interface ScenarioItem  { scenario: string; count: number; pct: number; children: Scenario1Item[]; }

export async function getScenarios(filters: InboundQualityFilters): Promise<ScenarioItem[]> {
  const { startDate, endDate, clientId } = filters;
  const clientFilter = clientId ? ' AND q.ClientId = ?' : '';
  const params: (string | number)[] = [startDate, endDate, ...(clientId ? [clientId] : [])];

  const rows = await querySource<{ scenario: string; scenario1: string; cnt: number }>(`
    SELECT
      CASE WHEN TRIM(q.scenario)  = '' OR q.scenario  IS NULL THEN 'Unknown' ELSE TRIM(q.scenario)  END AS scenario,
      CASE WHEN TRIM(q.scenario1) = '' OR q.scenario1 IS NULL THEN 'Unknown' ELSE TRIM(q.scenario1) END AS scenario1,
      COUNT(*) AS cnt
    FROM db_audit.call_quality_assessment q
    WHERE q.CallDate BETWEEN ? AND ?
      AND q.quality_percentage IS NOT NULL
      ${clientFilter}
    GROUP BY scenario, scenario1
    ORDER BY scenario, cnt DESC
  `, params);

  const total = rows.reduce((s, r) => s + Number(r.cnt), 0);

  const scenMap: Record<string, { children: Scenario1Item[]; total: number }> = {};
  for (const r of rows) {
    const scen  = String(r.scenario);
    const cnt   = Number(r.cnt);
    if (!scenMap[scen]) scenMap[scen] = { children: [], total: 0 };
    scenMap[scen].total += cnt;
    scenMap[scen].children.push({ scenario1: String(r.scenario1), count: cnt, pct: 0 });
  }

  return Object.entries(scenMap)
    .map(([scenario, { children, total: scenTotal }]) => ({
      scenario,
      count: scenTotal,
      pct: total > 0 ? Math.round((scenTotal / total) * 1000) / 10 : 0,
      children: children.map(c => ({
        ...c,
        pct: scenTotal > 0 ? Math.round((c.count / scenTotal) * 1000) / 10 : 0,
      })),
    }))
    .sort((a, b) => b.count - a.count);
}

// ─── Sensitive Word Analysis constants ───────────────────────────────────────
// Rows that have any sensitive word but are NOT scam leads
const SCAM_EXCLUSION = `(CASE WHEN LOWER(TRIM(q.system_manipulation))='yes' THEN 1 ELSE 0 END +
    CASE WHEN LOWER(TRIM(q.financial_fraud))='yes' THEN 1 ELSE 0 END +
    CASE WHEN LOWER(TRIM(q.collusion))='yes' THEN 1 ELSE 0 END +
    CASE WHEN LOWER(TRIM(q.policy_communication_failure))='yes' THEN 1 ELSE 0 END) = 0`;

const HAS_SENSITIVE_WORD = `(LOWER(q.sensetive_word) LIKE '%akash%'
    OR LOWER(q.sensetive_word) LIKE '%social%'
    OR LOWER(q.sensetive_word) LIKE '%court%'
    OR LOWER(q.sensetive_word) LIKE '%consumer%'
    OR LOWER(q.sensetive_word) LIKE '%legal%'
    OR LOWER(q.sensetive_word) LIKE '%fir%')`;

// Priority IF formula → Sensitive Word Use label
const SENSITIVE_WORD_USE = `CASE
  WHEN (CASE WHEN LOWER(q.sensetive_word) LIKE '%akash%' THEN 1 ELSE 0 END +
        CASE WHEN LOWER(q.sensetive_word) LIKE '%social%' THEN 1 ELSE 0 END +
        CASE WHEN (LOWER(q.sensetive_word) LIKE '%court%'    OR
                   LOWER(q.sensetive_word) LIKE '%consumer%' OR
                   LOWER(q.sensetive_word) LIKE '%legal%'    OR
                   LOWER(q.sensetive_word) LIKE '%fir%') THEN 1 ELSE 0 END
       ) = 3
  THEN 'All Sensitive Word Used by CX'
  WHEN LOWER(q.sensetive_word) LIKE '%akash%'
  THEN 'CX Said Co Founders Name to Escalate'
  WHEN LOWER(q.sensetive_word) LIKE '%social%'
  THEN 'CX said he/she will escalate this on Social Media'
  WHEN (LOWER(q.sensetive_word) LIKE '%court%'    OR
        LOWER(q.sensetive_word) LIKE '%consumer%' OR
        LOWER(q.sensetive_word) LIKE '%legal%'    OR
        LOWER(q.sensetive_word) LIKE '%fir%')
  THEN 'CX said they will go to Consumer Court'
  ELSE ''
END`;

// ─── Alert Field detail tables ────────────────────────────────────────────────

export interface AlertScenarioRow {
  scenario:  string;
  scenario1: string;
  count:     number;
  pct:       number;
}

export interface NegSignalDetailRow {
  scenario:   string;
  scenario1:  string;
  neg_signal: string;
  count:      number;
  pct:        number;
}

export async function getSocialMediaThreats(filters: InboundQualityFilters): Promise<AlertScenarioRow[]> {
  const { startDate, endDate, clientId } = filters;
  const clientFilter = clientId ? ' AND q.ClientId = ?' : '';
  const params: (string | number)[] = [startDate, endDate, ...(clientId ? [clientId] : [])];

  const rows = await querySource<{ scenario: string; scenario1: string; cnt: number }>(`
    SELECT
      CASE WHEN TRIM(q.scenario)  = '' OR q.scenario  IS NULL THEN 'Unknown' ELSE TRIM(q.scenario)  END AS scenario,
      CASE WHEN TRIM(q.scenario1) = '' OR q.scenario1 IS NULL THEN 'Unknown' ELSE TRIM(q.scenario1) END AS scenario1,
      COUNT(*) AS cnt
    FROM db_audit.call_quality_assessment q
    WHERE q.CallDate BETWEEN ? AND ?
      AND q.quality_percentage IS NOT NULL
      ${clientFilter}
      AND (${ALERT_FIELD}) = 'Social Media and Consumer Court Threat'
    GROUP BY scenario, scenario1
    ORDER BY cnt DESC
  `, params);

  const total = rows.reduce((s, r) => s + Number(r.cnt), 0);
  return rows.map(r => ({
    scenario:  String(r.scenario),
    scenario1: String(r.scenario1),
    count:     Number(r.cnt),
    pct:       total > 0 ? Math.round((Number(r.cnt) / total) * 1000) / 10 : 0,
  }));
}

export async function getTopNegativeSignalDetails(filters: InboundQualityFilters): Promise<NegSignalDetailRow[]> {
  const { startDate, endDate, clientId } = filters;
  const clientFilter = clientId ? ' AND q.ClientId = ?' : '';
  const params: (string | number)[] = [startDate, endDate, ...(clientId ? [clientId] : [])];

  const rows = await querySource<{ scenario: string; scenario1: string; neg_signal: string; cnt: number }>(`
    SELECT
      CASE WHEN TRIM(q.scenario)  = '' OR q.scenario  IS NULL THEN 'Unknown' ELSE TRIM(q.scenario)  END AS scenario,
      CASE WHEN TRIM(q.scenario1) = '' OR q.scenario1 IS NULL THEN 'Unknown' ELSE TRIM(q.scenario1) END AS scenario1,
      ${NEG_CAT} AS neg_signal,
      COUNT(*) AS cnt
    FROM db_audit.call_quality_assessment q
    WHERE q.CallDate BETWEEN ? AND ?
      AND q.quality_percentage IS NOT NULL
      ${clientFilter}
      AND (${ALERT_FIELD}) = 'Top Negative Signals'
    GROUP BY scenario, scenario1, neg_signal
    HAVING neg_signal != 'No' AND neg_signal != ''
    ORDER BY cnt DESC
  `, params);

  const total = rows.reduce((s, r) => s + Number(r.cnt), 0);
  return rows.map(r => ({
    scenario:   String(r.scenario),
    scenario1:  String(r.scenario1),
    neg_signal: String(r.neg_signal),
    count:      Number(r.cnt),
    pct:        total > 0 ? Math.round((Number(r.cnt) / total) * 1000) / 10 : 0,
  }));
}

export async function getPotentialScams(filters: InboundQualityFilters): Promise<AlertScenarioRow[]> {
  const { startDate, endDate, clientId } = filters;
  const clientFilter = clientId ? ' AND q.ClientId = ?' : '';
  const params: (string | number)[] = [startDate, endDate, ...(clientId ? [clientId] : [])];

  const rows = await querySource<{ scenario: string; scenario1: string; cnt: number }>(`
    SELECT
      CASE WHEN TRIM(q.scenario)  = '' OR q.scenario  IS NULL THEN 'Unknown' ELSE TRIM(q.scenario)  END AS scenario,
      CASE WHEN TRIM(q.scenario1) = '' OR q.scenario1 IS NULL THEN 'Unknown' ELSE TRIM(q.scenario1) END AS scenario1,
      COUNT(*) AS cnt
    FROM db_audit.call_quality_assessment q
    WHERE q.CallDate BETWEEN ? AND ?
      AND q.quality_percentage IS NOT NULL
      ${clientFilter}
      AND (${ALERT_FIELD}) = 'Scam Leads'
    GROUP BY scenario, scenario1
    ORDER BY cnt DESC
  `, params);

  const total = rows.reduce((s, r) => s + Number(r.cnt), 0);
  return rows.map(r => ({
    scenario:  String(r.scenario),
    scenario1: String(r.scenario1),
    count:     Number(r.cnt),
    pct:       total > 0 ? Math.round((Number(r.cnt) / total) * 1000) / 10 : 0,
  }));
}

// ─── Sensitive Word Analysis ───────────────────────────────────────────────────

export interface SensitiveWordUseRow { label: string; count: number; pct: number; }
export interface SensitiveWordAnalysis {
  distribution:  SensitiveWordUseRow[];
  akash_count:   number;
  akash_label:   string;
  social_count:  number;
  court_count:   number;
}

export async function getSensitiveWordAnalysis(filters: InboundQualityFilters): Promise<SensitiveWordAnalysis> {
  const { startDate, endDate, clientId } = filters;
  const clientFilter = clientId ? ' AND q.ClientId = ?' : '';
  const params: (string | number)[] = [startDate, endDate, ...(clientId ? [clientId] : [])];

  const [distRows, dimRows, akashRows] = await Promise.all([
    querySource<{ label: string; cnt: number }>(`
      SELECT
        ${SENSITIVE_WORD_USE} AS label,
        COUNT(*) AS cnt
      FROM db_audit.call_quality_assessment q
      WHERE q.CallDate BETWEEN ? AND ?
        AND q.quality_percentage IS NOT NULL
        ${clientFilter}
        AND ${SCAM_EXCLUSION}
        AND ${HAS_SENSITIVE_WORD}
      GROUP BY label
      ORDER BY cnt DESC
    `, params),
    querySource<{ akash_count: number; social_count: number; court_count: number }>(`
      SELECT
        SUM(CASE WHEN LOWER(q.sensetive_word) LIKE '%akash%' THEN 1 ELSE 0 END) AS akash_count,
        SUM(CASE WHEN LOWER(q.sensetive_word) LIKE '%social%' THEN 1 ELSE 0 END) AS social_count,
        SUM(CASE WHEN (LOWER(q.sensetive_word) LIKE '%court%'    OR
                       LOWER(q.sensetive_word) LIKE '%consumer%' OR
                       LOWER(q.sensetive_word) LIKE '%legal%'    OR
                       LOWER(q.sensetive_word) LIKE '%fir%') THEN 1 ELSE 0 END) AS court_count
      FROM db_audit.call_quality_assessment q
      WHERE q.CallDate BETWEEN ? AND ?
        AND q.quality_percentage IS NOT NULL
        ${clientFilter}
        AND ${SCAM_EXCLUSION}
        AND ${HAS_SENSITIVE_WORD}
    `, params),
    // Fetch the most frequent short sensetive_word value containing 'akash'
    // to use as a dynamic label instead of a hardcoded name
    querySource<{ name: string; cnt: number }>(`
      SELECT
        TRIM(q.sensetive_word) AS name,
        COUNT(*) AS cnt
      FROM db_audit.call_quality_assessment q
      WHERE q.CallDate BETWEEN ? AND ?
        AND q.quality_percentage IS NOT NULL
        ${clientFilter}
        AND ${SCAM_EXCLUSION}
        AND LOWER(q.sensetive_word) LIKE '%akash%'
        AND LENGTH(TRIM(q.sensetive_word)) <= 50
      GROUP BY TRIM(q.sensetive_word)
      ORDER BY cnt DESC
      LIMIT 1
    `, params),
  ]);

  const total = distRows.reduce((s, r) => s + Number(r.cnt), 0);
  const dim   = dimRows[0]  ?? { akash_count: 0, social_count: 0, court_count: 0 };
  const akashLabel = akashRows[0] ? String(akashRows[0].name) : 'Co-Founder Mention';

  return {
    distribution: distRows.map(r => ({
      label: String(r.label) || '(Other)',
      count: Number(r.cnt),
      pct:   total > 0 ? Math.round((Number(r.cnt) / total) * 1000) / 10 : 0,
    })),
    akash_count:  Number(dim.akash_count),
    akash_label:  akashLabel,
    social_count: Number(dim.social_count),
    court_count:  Number(dim.court_count),
  };
}

// ─── Fatal Analysis ──────────────────────────────────────────────────────────

export interface FatalContributorRow {
  agent_name:  string;
  audit_count: number;
  fatal_count: number;
  fatal_pct:   number;
}

export interface DayWiseFatalRow {
  call_date:       string;
  total_count:     number;
  total_fatal:     number;
  fatal_pct:       number;
  null_fatal:      number;
  query_fatal:     number;
  complaint_fatal: number;
  request_fatal:   number;
}

export interface WeekScenarioFatalRow {
  week_label:           string;
  query_fatal_pct:      number;
  complaint_fatal_pct:  number;
  request_fatal_pct:    number;
  sale_done_fatal_pct:  number;
  total_fatal:          number;
}

export interface AgentPerformanceRow {
  agent_name:    string;
  audit_count:   number;
  cq_score:      number;
  fatal_count:   number;
  fatal_pct:     number;
  below_avg_pct: number;
  avg_pct:       number;
  good_pct:      number;
  excellent_pct: number;
}

export interface FatalAnalysis {
  audit_count:       number;
  cq_score:          number;
  fatal_count:       number;
  fatal_pct:         number;
  query_fatal:       number;
  complaint_fatal:   number;
  request_fatal:     number;
  sale_done_fatal:   number;
  top_contributors:  FatalContributorRow[];
  day_wise:          DayWiseFatalRow[];
  week_scenario:     WeekScenarioFatalRow[];
  agent_performance: AgentPerformanceRow[];
}

export async function getFatalAnalysis(filters: InboundQualityFilters): Promise<FatalAnalysis> {
  const { startDate, endDate, clientId } = filters;
  const clientFilter = clientId ? ' AND q.ClientId = ?' : '';
  const params: (string | number)[] = [startDate, endDate, ...(clientId ? [clientId] : [])];

  const [kpiRows, topRows, dayRows, weekRows, agentRows] = await Promise.all([

    querySource<{
      audit_count: number; cq_score: number | null; fatal_count: number; fatal_pct: number | null;
      query_fatal: number; complaint_fatal: number; request_fatal: number; sale_done_fatal: number;
    }>(`
      SELECT
        COUNT(*) AS audit_count,
        ROUND(AVG(q.quality_percentage), 1) AS cq_score,
        SUM(CASE WHEN q.quality_percentage = 0 THEN 1 ELSE 0 END) AS fatal_count,
        ROUND(SUM(CASE WHEN q.quality_percentage = 0 THEN 1 ELSE 0 END)*100.0/COUNT(*), 1) AS fatal_pct,
        SUM(CASE WHEN TRIM(q.scenario)='Query'     AND q.quality_percentage=0 THEN 1 ELSE 0 END) AS query_fatal,
        SUM(CASE WHEN TRIM(q.scenario)='Complaint' AND q.quality_percentage=0 THEN 1 ELSE 0 END) AS complaint_fatal,
        SUM(CASE WHEN TRIM(q.scenario)='Request'   AND q.quality_percentage=0 THEN 1 ELSE 0 END) AS request_fatal,
        SUM(CASE WHEN TRIM(q.scenario)='Sale Done' AND q.quality_percentage=0 THEN 1 ELSE 0 END) AS sale_done_fatal
      FROM db_audit.call_quality_assessment q
      WHERE q.CallDate BETWEEN ? AND ? AND q.quality_percentage IS NOT NULL ${clientFilter}
    `, params),

    querySource<{ agent_name: string; audit_count: number; fatal_count: number; fatal_pct: number | null }>(`
      SELECT q.User AS agent_name, COUNT(*) AS audit_count,
        SUM(CASE WHEN q.quality_percentage=0 THEN 1 ELSE 0 END) AS fatal_count,
        ROUND(SUM(CASE WHEN q.quality_percentage=0 THEN 1 ELSE 0 END)*100.0/COUNT(*), 1) AS fatal_pct
      FROM db_audit.call_quality_assessment q
      WHERE q.CallDate BETWEEN ? AND ? AND q.quality_percentage IS NOT NULL
        AND q.User IS NOT NULL AND TRIM(q.User) != '' ${clientFilter}
      GROUP BY q.User ORDER BY fatal_count DESC, fatal_pct DESC LIMIT 5
    `, params),

    querySource<{
      call_date: string; total_count: number; total_fatal: number;
      null_fatal: number; query_fatal: number; complaint_fatal: number; request_fatal: number;
    }>(`
      SELECT
        DATE_FORMAT(q.CallDate,'%Y-%m-%d') AS call_date,
        COUNT(*) AS total_count,
        SUM(CASE WHEN q.quality_percentage=0 THEN 1 ELSE 0 END) AS total_fatal,
        SUM(CASE WHEN (q.scenario IS NULL OR TRIM(q.scenario)='') AND q.quality_percentage=0 THEN 1 ELSE 0 END) AS null_fatal,
        SUM(CASE WHEN TRIM(q.scenario)='Query'     AND q.quality_percentage=0 THEN 1 ELSE 0 END) AS query_fatal,
        SUM(CASE WHEN TRIM(q.scenario)='Complaint' AND q.quality_percentage=0 THEN 1 ELSE 0 END) AS complaint_fatal,
        SUM(CASE WHEN TRIM(q.scenario)='Request'   AND q.quality_percentage=0 THEN 1 ELSE 0 END) AS request_fatal
      FROM db_audit.call_quality_assessment q
      WHERE q.CallDate BETWEEN ? AND ? AND q.quality_percentage IS NOT NULL ${clientFilter}
      GROUP BY DATE_FORMAT(q.CallDate,'%Y-%m-%d')
      HAVING total_fatal > 0 ORDER BY call_date DESC
    `, params),

    querySource<{
      week_label: string;
      query_fatal_pct: number | null; complaint_fatal_pct: number | null;
      request_fatal_pct: number | null; sale_done_fatal_pct: number | null;
      total_fatal: number;
    }>(`
      SELECT
        CASE
          WHEN DAYOFMONTH(q.CallDate) BETWEEN 1  AND 7  THEN 'Week 1'
          WHEN DAYOFMONTH(q.CallDate) BETWEEN 8  AND 14 THEN 'Week 2'
          WHEN DAYOFMONTH(q.CallDate) BETWEEN 15 AND 21 THEN 'Week 3'
          ELSE 'Week 4'
        END AS week_label,
        ROUND(SUM(CASE WHEN TRIM(q.scenario)='Query'     AND q.quality_percentage=0 THEN 1 ELSE 0 END)*100.0/
              NULLIF(SUM(CASE WHEN TRIM(q.scenario)='Query'     THEN 1 ELSE 0 END),0),0) AS query_fatal_pct,
        ROUND(SUM(CASE WHEN TRIM(q.scenario)='Complaint' AND q.quality_percentage=0 THEN 1 ELSE 0 END)*100.0/
              NULLIF(SUM(CASE WHEN TRIM(q.scenario)='Complaint' THEN 1 ELSE 0 END),0),0) AS complaint_fatal_pct,
        ROUND(SUM(CASE WHEN TRIM(q.scenario)='Request'   AND q.quality_percentage=0 THEN 1 ELSE 0 END)*100.0/
              NULLIF(SUM(CASE WHEN TRIM(q.scenario)='Request'   THEN 1 ELSE 0 END),0),0) AS request_fatal_pct,
        ROUND(SUM(CASE WHEN TRIM(q.scenario)='Sale Done' AND q.quality_percentage=0 THEN 1 ELSE 0 END)*100.0/
              NULLIF(SUM(CASE WHEN TRIM(q.scenario)='Sale Done' THEN 1 ELSE 0 END),0),0) AS sale_done_fatal_pct,
        SUM(CASE WHEN q.quality_percentage=0 THEN 1 ELSE 0 END) AS total_fatal
      FROM db_audit.call_quality_assessment q
      WHERE q.CallDate BETWEEN ? AND ? AND q.quality_percentage IS NOT NULL ${clientFilter}
      GROUP BY week_label ORDER BY week_label ASC
    `, params),

    querySource<{
      agent_name: string; audit_count: number; cq_score: number | null;
      fatal_count: number; fatal_pct: number | null;
      below_avg_pct: number | null; avg_pct: number | null;
      good_pct: number | null; excellent_pct: number | null;
    }>(`
      SELECT
        q.User AS agent_name, COUNT(*) AS audit_count,
        ROUND(AVG(q.quality_percentage),1) AS cq_score,
        SUM(CASE WHEN q.quality_percentage=0 THEN 1 ELSE 0 END) AS fatal_count,
        ROUND(SUM(CASE WHEN q.quality_percentage=0 THEN 1 ELSE 0 END)*100.0/COUNT(*),1) AS fatal_pct,
        ROUND(SUM(CASE WHEN q.quality_percentage>0 AND q.quality_percentage<85  THEN 1 ELSE 0 END)*100.0/COUNT(*),1) AS below_avg_pct,
        ROUND(SUM(CASE WHEN q.quality_percentage>=85 AND q.quality_percentage<90 THEN 1 ELSE 0 END)*100.0/COUNT(*),1) AS avg_pct,
        ROUND(SUM(CASE WHEN q.quality_percentage>=90 AND q.quality_percentage<98 THEN 1 ELSE 0 END)*100.0/COUNT(*),1) AS good_pct,
        ROUND(SUM(CASE WHEN q.quality_percentage>=98  THEN 1 ELSE 0 END)*100.0/COUNT(*),1) AS excellent_pct
      FROM db_audit.call_quality_assessment q
      WHERE q.CallDate BETWEEN ? AND ? AND q.quality_percentage IS NOT NULL
        AND q.User IS NOT NULL AND TRIM(q.User) != '' ${clientFilter}
      GROUP BY q.User ORDER BY fatal_count DESC, fatal_pct DESC
    `, params),
  ]);

  const k = kpiRows[0] ?? { audit_count:0, cq_score:null, fatal_count:0, fatal_pct:null, query_fatal:0, complaint_fatal:0, request_fatal:0, sale_done_fatal:0 };

  return {
    audit_count:     Number(k.audit_count),
    cq_score:        Number(k.cq_score    ?? 0),
    fatal_count:     Number(k.fatal_count),
    fatal_pct:       Number(k.fatal_pct   ?? 0),
    query_fatal:     Number(k.query_fatal),
    complaint_fatal: Number(k.complaint_fatal),
    request_fatal:   Number(k.request_fatal),
    sale_done_fatal: Number(k.sale_done_fatal),
    top_contributors: topRows.map(r => ({
      agent_name:  String(r.agent_name),
      audit_count: Number(r.audit_count),
      fatal_count: Number(r.fatal_count),
      fatal_pct:   Number(r.fatal_pct ?? 0),
    })),
    day_wise: dayRows.map(r => ({
      call_date:       String(r.call_date),
      total_count:     Number(r.total_count),
      total_fatal:     Number(r.total_fatal),
      fatal_pct:       Number(r.total_count) > 0
        ? Math.round(Number(r.total_fatal) / Number(r.total_count) * 1000) / 10
        : 0,
      null_fatal:      Number(r.null_fatal),
      query_fatal:     Number(r.query_fatal),
      complaint_fatal: Number(r.complaint_fatal),
      request_fatal:   Number(r.request_fatal),
    })),
    week_scenario: weekRows.map(r => ({
      week_label:          String(r.week_label),
      query_fatal_pct:     Number(r.query_fatal_pct    ?? 0),
      complaint_fatal_pct: Number(r.complaint_fatal_pct ?? 0),
      request_fatal_pct:   Number(r.request_fatal_pct   ?? 0),
      sale_done_fatal_pct: Number(r.sale_done_fatal_pct ?? 0),
      total_fatal:         Number(r.total_fatal),
    })),
    agent_performance: agentRows.map(r => ({
      agent_name:    String(r.agent_name),
      audit_count:   Number(r.audit_count),
      cq_score:      Number(r.cq_score      ?? 0),
      fatal_count:   Number(r.fatal_count),
      fatal_pct:     Number(r.fatal_pct     ?? 0),
      below_avg_pct: Number(r.below_avg_pct ?? 0),
      avg_pct:       Number(r.avg_pct       ?? 0),
      good_pct:      Number(r.good_pct      ?? 0),
      excellent_pct: Number(r.excellent_pct ?? 0),
    })),
  };
}

// ─── Detail Analysis ──────────────────────────────────────────────────────────

export interface DetailScenario1Item { scenario1: string; count: number; pct: number; }
export interface DetailScenarioPanel  { scenario: string; total_count: number; items: DetailScenario1Item[]; }

export interface DayWiseAuditRow {
  call_date:  string;
  complaint:  number;
  null_count: number;
  request:    number;
  query:      number;
  total:      number;
}

export interface WeekScenarioAuditRow {
  week_label:      string;
  query_pct:       number;
  complaint_pct:   number;
  request_pct:     number;
  sale_done_pct:   number;
  total:           number;
}

export interface DetailAnalysis {
  cq_score:          number;
  audit_count:       number;
  fatal_count:       number;
  fatal_pct:         number;
  query_count:       number;
  complaint_count:   number;
  request_count:     number;
  sale_done_count:   number;
  scenario_panels:   DetailScenarioPanel[];
  day_wise_audit:    DayWiseAuditRow[];
  week_scenario_audit: WeekScenarioAuditRow[];
}

export async function getDetailAnalysis(filters: InboundQualityFilters): Promise<DetailAnalysis> {
  const { startDate, endDate, clientId } = filters;
  const clientFilter = clientId ? ' AND q.ClientId = ?' : '';
  const params: (string | number)[] = [startDate, endDate, ...(clientId ? [clientId] : [])];

  const [kpiRows, scenRows, dayRows, weekRows] = await Promise.all([

    querySource<{
      audit_count: number; cq_score: number | null; fatal_count: number; fatal_pct: number | null;
      query_count: number; complaint_count: number; request_count: number; sale_done_count: number;
    }>(`
      SELECT COUNT(*) AS audit_count,
        ROUND(AVG(q.quality_percentage),1) AS cq_score,
        SUM(CASE WHEN q.quality_percentage=0 THEN 1 ELSE 0 END) AS fatal_count,
        ROUND(SUM(CASE WHEN q.quality_percentage=0 THEN 1 ELSE 0 END)*100.0/COUNT(*),1) AS fatal_pct,
        SUM(CASE WHEN TRIM(q.scenario)='Query'     THEN 1 ELSE 0 END) AS query_count,
        SUM(CASE WHEN TRIM(q.scenario)='Complaint' THEN 1 ELSE 0 END) AS complaint_count,
        SUM(CASE WHEN TRIM(q.scenario)='Request'   THEN 1 ELSE 0 END) AS request_count,
        SUM(CASE WHEN TRIM(q.scenario)='Sale Done' THEN 1 ELSE 0 END) AS sale_done_count
      FROM db_audit.call_quality_assessment q
      WHERE q.CallDate BETWEEN ? AND ? AND q.quality_percentage IS NOT NULL ${clientFilter}
    `, params),

    querySource<{ scenario: string; scenario1: string; cnt: number }>(`
      SELECT
        TRIM(q.scenario) AS scenario,
        CASE WHEN TRIM(q.scenario1)='' OR q.scenario1 IS NULL THEN 'Unknown' ELSE TRIM(q.scenario1) END AS scenario1,
        COUNT(*) AS cnt
      FROM db_audit.call_quality_assessment q
      WHERE q.CallDate BETWEEN ? AND ? AND q.quality_percentage IS NOT NULL ${clientFilter}
        AND q.scenario IS NOT NULL AND TRIM(q.scenario) != ''
      GROUP BY TRIM(q.scenario), scenario1
      ORDER BY TRIM(q.scenario), cnt DESC
    `, params),

    querySource<{ call_date: string; complaint: number; null_count: number; request_c: number; query_c: number; total: number }>(`
      SELECT
        DATE_FORMAT(q.CallDate,'%Y-%m-%d') AS call_date,
        SUM(CASE WHEN TRIM(q.scenario)='Complaint' THEN 1 ELSE 0 END) AS complaint,
        SUM(CASE WHEN q.scenario IS NULL OR TRIM(q.scenario)='' THEN 1 ELSE 0 END) AS null_count,
        SUM(CASE WHEN TRIM(q.scenario)='Request'   THEN 1 ELSE 0 END) AS request_c,
        SUM(CASE WHEN TRIM(q.scenario)='Query'     THEN 1 ELSE 0 END) AS query_c,
        COUNT(*) AS total
      FROM db_audit.call_quality_assessment q
      WHERE q.CallDate BETWEEN ? AND ? AND q.quality_percentage IS NOT NULL ${clientFilter}
      GROUP BY DATE_FORMAT(q.CallDate,'%Y-%m-%d')
      ORDER BY call_date DESC
    `, params),

    querySource<{
      week_label: string;
      query_pct: number | null; complaint_pct: number | null;
      request_pct: number | null; sale_done_pct: number | null;
      total: number;
    }>(`
      SELECT
        CASE
          WHEN DAYOFMONTH(q.CallDate) BETWEEN 1  AND 7  THEN 'Week 1'
          WHEN DAYOFMONTH(q.CallDate) BETWEEN 8  AND 14 THEN 'Week 2'
          WHEN DAYOFMONTH(q.CallDate) BETWEEN 15 AND 21 THEN 'Week 3'
          ELSE 'Week 4'
        END AS week_label,
        ROUND(SUM(CASE WHEN TRIM(q.scenario)='Query'     THEN 1 ELSE 0 END)*100.0/COUNT(*),0) AS query_pct,
        ROUND(SUM(CASE WHEN TRIM(q.scenario)='Complaint' THEN 1 ELSE 0 END)*100.0/COUNT(*),0) AS complaint_pct,
        ROUND(SUM(CASE WHEN TRIM(q.scenario)='Request'   THEN 1 ELSE 0 END)*100.0/COUNT(*),0) AS request_pct,
        ROUND(SUM(CASE WHEN TRIM(q.scenario)='Sale Done' THEN 1 ELSE 0 END)*100.0/COUNT(*),0) AS sale_done_pct,
        COUNT(*) AS total
      FROM db_audit.call_quality_assessment q
      WHERE q.CallDate BETWEEN ? AND ? AND q.quality_percentage IS NOT NULL ${clientFilter}
      GROUP BY week_label
      ORDER BY total DESC
    `, params),
  ]);

  const k = kpiRows[0] ?? { audit_count:0, cq_score:null, fatal_count:0, fatal_pct:null, query_count:0, complaint_count:0, request_count:0, sale_done_count:0 };

  // Build scenario panels (grouped by scenario, top-5 scenario1 items, fixed order)
  const scenMap: Record<string, { items: DetailScenario1Item[]; total: number }> = {};
  for (const r of scenRows) {
    const sc = String(r.scenario);
    if (!scenMap[sc]) scenMap[sc] = { items: [], total: 0 };
    scenMap[sc].total += Number(r.cnt);
    scenMap[sc].items.push({ scenario1: String(r.scenario1), count: Number(r.cnt), pct: 0 });
  }
  const SCEN_ORDER = ['Query', 'Complaint', 'Request', 'Sale Done'];
  const allScenarios = Object.keys(scenMap);
  const orderedKeys = [
    ...SCEN_ORDER.filter(s => allScenarios.includes(s)),
    ...allScenarios.filter(s => !SCEN_ORDER.includes(s)).sort(),
  ];
  const scenario_panels: DetailScenarioPanel[] = orderedKeys.map(scenario => {
    const { items, total } = scenMap[scenario];
    const top5 = items.slice(0, 5).map(it => ({
      ...it,
      pct: total > 0 ? Math.round(it.count / total * 1000) / 10 : 0,
    }));
    return { scenario, total_count: total, items: top5 };
  });

  return {
    cq_score:        Number(k.cq_score    ?? 0),
    audit_count:     Number(k.audit_count),
    fatal_count:     Number(k.fatal_count),
    fatal_pct:       Number(k.fatal_pct   ?? 0),
    query_count:     Number(k.query_count),
    complaint_count: Number(k.complaint_count),
    request_count:   Number(k.request_count),
    sale_done_count: Number(k.sale_done_count),
    scenario_panels,
    day_wise_audit: dayRows.map(r => ({
      call_date:  String(r.call_date),
      complaint:  Number(r.complaint),
      null_count: Number(r.null_count),
      request:    Number(r.request_c),
      query:      Number(r.query_c),
      total:      Number(r.total),
    })),
    week_scenario_audit: weekRows.map(r => ({
      week_label:    String(r.week_label),
      query_pct:     Number(r.query_pct     ?? 0),
      complaint_pct: Number(r.complaint_pct ?? 0),
      request_pct:   Number(r.request_pct   ?? 0),
      sale_done_pct: Number(r.sale_done_pct ?? 0),
      total:         Number(r.total),
    })),
  };
}

// ─── Shared score SQL fragments ───────────────────────────────────────────────
const _OPENING = `ROUND(AVG(
  CASE WHEN q.scenario1 IN ('Call Drop in between','Short Call/Blank Call') THEN 1
  ELSE COALESCE(q.customer_concern_acknowledged,0) END
)*100,1)`;

const _SOFT = `ROUND(AVG(
  CASE WHEN q.scenario1 IN ('Call Drop in between','Short Call/Blank Call') THEN 1
  ELSE (
    IF(q.professionalism_maintained        =1,0.111111111111111,0)+
    IF(q.assurance_or_appreciation_provided=1,0.111111111111111,0)+
    IF(q.express_empathy                   =1,0.111111111111111,0)+
    IF(q.pronunciation_and_clarity         =1,0.111111111111111,0)+
    IF(q.enthusiasm_and_no_fumbling        =1,0.111111111111111,0)+
    IF(q.active_listening                  =1,0.111111111111111,0)+
    IF(q.politeness_and_no_sarcasm         =1,0.111111111111111,0)+
    IF(q.proper_grammar                    =1,0.111111111111111,0)+
    IF(q.accurate_issue_probing            =1,0.111111111111111,0)
  ) END
)*100,1)`;

const _HOLD = `ROUND(AVG(
  CASE WHEN q.scenario1 IN ('Call Drop in between','Short Call/Blank Call') THEN 1
  ELSE (IF(q.proper_hold_procedure=1,0.5,0)+IF(q.proper_transfer_and_language=1,0.5,0)) END
)*100,1)`;

const _RESOLUTION = `ROUND(AVG(
  CASE WHEN q.scenario1 IN ('Call Drop in between','Short Call/Blank Call') THEN 1
  ELSE (IF(q.address_recorded_completely=1,0.5,0)+IF(q.correct_and_complete_information=1,0.5,0)) END
)*100,1)`;

const _CLOSING = `ROUND(AVG(
  CASE WHEN q.scenario1 IN ('Call Drop in between','Short Call/Blank Call') THEN 1
  ELSE COALESCE(q.professionalism_maintained,0) END
)*100,1)`;

// ─── Agent & Parameter Wise CQ Score% ────────────────────────────────────────

export interface AgentParamRow {
  agent_name:     string;
  tq_mq_bq:       string;
  audit_count:    number;
  cq_score:       number;
  fatal_count:    number;
  fatal_pct:      number;
  opening_skill:  number;
  soft_skill:     number;
  hold_procedure: number;
  resolution:     number;
  closing:        number;
}

export async function getAgentParameterWise(filters: InboundQualityFilters & { scenario?: string }): Promise<AgentParamRow[]> {
  const { startDate, endDate, clientId, scenario } = filters;
  const params: (string | number)[] = [startDate, endDate];
  let extra = '';
  if (clientId) { extra += ' AND q.ClientId = ?'; params.push(clientId); }
  if (scenario) { extra += ' AND TRIM(q.scenario) = ?'; params.push(scenario); }

  const rows = await querySource<{
    agent_name: string; tq_mq_bq: string;
    audit_count: number; cq_score: number | null;
    fatal_count: number; fatal_pct: number | null;
    opening_skill: number | null; soft_skill: number | null;
    hold_procedure: number | null; resolution: number | null; closing: number | null;
  }>(`
    SELECT
      q.User                                       AS agent_name,
      IFNULL(NULLIF(TRIM(q.Campaign),''),'-')      AS tq_mq_bq,
      COUNT(*)                                     AS audit_count,
      ROUND(AVG(q.quality_percentage),1)           AS cq_score,
      SUM(CASE WHEN q.quality_percentage=0 THEN 1 ELSE 0 END) AS fatal_count,
      ROUND(SUM(CASE WHEN q.quality_percentage=0 THEN 1 ELSE 0 END)*100.0/COUNT(*),1) AS fatal_pct,
      ${_OPENING}    AS opening_skill,
      ${_SOFT}       AS soft_skill,
      ${_HOLD}       AS hold_procedure,
      ${_RESOLUTION} AS resolution,
      ${_CLOSING}    AS closing
    FROM db_audit.call_quality_assessment q
    WHERE q.CallDate BETWEEN ? AND ?
      AND q.quality_percentage IS NOT NULL
      AND q.User IS NOT NULL AND TRIM(q.User) != ''
      ${extra}
    GROUP BY q.User, q.Campaign
    ORDER BY q.User ASC
  `, params);

  return rows.map(r => ({
    agent_name:     String(r.agent_name),
    tq_mq_bq:       String(r.tq_mq_bq),
    audit_count:    Number(r.audit_count),
    cq_score:       Number(r.cq_score      ?? 0),
    fatal_count:    Number(r.fatal_count),
    fatal_pct:      Number(r.fatal_pct     ?? 0),
    opening_skill:  Number(r.opening_skill  ?? 0),
    soft_skill:     Number(r.soft_skill     ?? 0),
    hold_procedure: Number(r.hold_procedure ?? 0),
    resolution:     Number(r.resolution     ?? 0),
    closing:        Number(r.closing        ?? 0),
  }));
}

// ─── Day Wise Quality Performance ─────────────────────────────────────────────

export interface DayWiseQualityRow {
  call_date:      string;
  audit_count:    number;
  cq_score:       number;
  fatal_count:    number;
  fatal_pct:      number;
  opening_skill:  number;
  soft_skill:     number;
  hold_procedure: number;
  resolution:     number;
  closing:        number;
}

// ─── Week Wise Quality Performance ───────────────────────────────────────────

export interface WeekWiseQualityRow {
  week_label:     string;
  audit_count:    number;
  cq_score:       number;
  fatal_count:    number;
  fatal_pct:      number;
  opening_skill:  number;
  soft_skill:     number;
  hold_procedure: number;
  resolution:     number;
  closing:        number;
}

// ─── Repeat Analysis ──────────────────────────────────────────────────────────

export interface DayWiseRepeatRow {
  call_date:    string;
  unique_calls: number;
  repeat_calls: number;
  repeat_pct:   number;
}

export interface RepeatPivotRow {
  mobile_no:   string;
  by_date:     Record<string, number>;
  grand_total: number;
}

export interface RepeatAnalysis {
  grand_unique: number;
  grand_repeat: number;
  grand_pct:    number;
  day_wise:     DayWiseRepeatRow[];
  pivot_dates:  string[];
  pivot_rows:   RepeatPivotRow[];
}

export async function getRepeatAnalysis(filters: InboundQualityFilters): Promise<RepeatAnalysis> {
  const { startDate, endDate, clientId } = filters;
  const subClient  = clientId ? ' AND ClientId = ?'   : '';
  const mainClient = clientId ? ' AND q.ClientId = ?' : '';
  const base  = [startDate, endDate, ...(clientId ? [clientId] : [])];

  const [dayRows, grandRows, pivotRaw] = await Promise.all([

    // Day-wise: unique phones and repeat-caller phones per day
    querySource<{ call_date: string; unique_calls: number; repeat_calls: number }>(`
      SELECT
        DATE_FORMAT(q.CallDate, '%Y-%m-%d') AS call_date,
        COUNT(DISTINCT q.MobileNo) AS unique_calls,
        COUNT(DISTINCT CASE WHEN r.MobileNo IS NOT NULL THEN q.MobileNo END) AS repeat_calls
      FROM db_audit.call_quality_assessment q
      LEFT JOIN (
        SELECT MobileNo
        FROM db_audit.call_quality_assessment
        WHERE CallDate BETWEEN ? AND ? ${subClient}
          AND MobileNo IS NOT NULL AND TRIM(MobileNo) != ''
        GROUP BY MobileNo
        HAVING COUNT(DISTINCT DATE(CallDate)) > 1
      ) r ON q.MobileNo = r.MobileNo
      WHERE q.CallDate BETWEEN ? AND ? ${mainClient}
        AND q.MobileNo IS NOT NULL AND TRIM(q.MobileNo) != ''
      GROUP BY DATE_FORMAT(q.CallDate, '%Y-%m-%d')
      ORDER BY call_date ASC
    `, [...base, ...base]),

    // Grand totals
    querySource<{ grand_unique: number; grand_repeat: number }>(`
      SELECT
        COUNT(DISTINCT MobileNo) AS grand_unique,
        SUM(CASE WHEN day_cnt > 1 THEN 1 ELSE 0 END) AS grand_repeat
      FROM (
        SELECT MobileNo, COUNT(DISTINCT DATE(CallDate)) AS day_cnt
        FROM db_audit.call_quality_assessment
        WHERE CallDate BETWEEN ? AND ? ${subClient}
          AND MobileNo IS NOT NULL AND TRIM(MobileNo) != ''
        GROUP BY MobileNo
      ) sub
    `, base),

    // Pivot: all phones × all dates (call count per combination)
    querySource<{ mobile_no: string; call_date: string; call_count: number }>(`
      SELECT
        q.MobileNo                               AS mobile_no,
        DATE_FORMAT(q.CallDate, '%Y-%m-%d')      AS call_date,
        COUNT(*)                                  AS call_count
      FROM db_audit.call_quality_assessment q
      WHERE q.CallDate BETWEEN ? AND ? ${mainClient}
        AND q.MobileNo IS NOT NULL AND TRIM(q.MobileNo) != ''
      GROUP BY q.MobileNo, DATE_FORMAT(q.CallDate, '%Y-%m-%d')
      ORDER BY q.MobileNo ASC, call_date ASC
    `, base),
  ]);

  const g = grandRows[0] ?? { grand_unique: 0, grand_repeat: 0 };
  const grand_unique = Number(g.grand_unique);
  const grand_repeat = Number(g.grand_repeat);

  const day_wise: DayWiseRepeatRow[] = dayRows.map(r => {
    const unique_calls = Number(r.unique_calls);
    const repeat_calls = Number(r.repeat_calls);
    return {
      call_date: String(r.call_date),
      unique_calls,
      repeat_calls,
      repeat_pct: unique_calls > 0 ? Math.round(repeat_calls / unique_calls * 100) : 0,
    };
  });

  // Build pivot map
  const phoneMap: Record<string, { by_date: Record<string, number>; grand_total: number }> = {};
  const dateSet = new Set<string>();
  for (const r of pivotRaw) {
    const phone = String(r.mobile_no);
    const date  = String(r.call_date);
    const count = Number(r.call_count);
    dateSet.add(date);
    if (!phoneMap[phone]) phoneMap[phone] = { by_date: {}, grand_total: 0 };
    phoneMap[phone].by_date[date] = count;
    phoneMap[phone].grand_total  += count;
  }

  const pivot_dates = [...dateSet].sort();
  const pivot_rows: RepeatPivotRow[] = Object.entries(phoneMap)
    .map(([mobile_no, { by_date, grand_total }]) => ({ mobile_no, by_date, grand_total }))
    .sort((a, b) => b.grand_total - a.grand_total || a.mobile_no.localeCompare(b.mobile_no));

  return {
    grand_unique,
    grand_repeat,
    grand_pct: grand_unique > 0 ? Math.round(grand_repeat / grand_unique * 100) : 0,
    day_wise,
    pivot_dates,
    pivot_rows,
  };
}

// ─── Quality Parameters ────────────────────────────────────────────────────────

export interface QualityParameterRow {
  parameter:   string;
  hit_count:   number;
  total_count: number;
  score_pct:   number;
}

export async function getQualityParameters(filters: InboundQualityFilters & { scenario?: string; agentName?: string }): Promise<QualityParameterRow[]> {
  const { startDate, endDate, clientId, scenario, agentName } = filters;
  const params: (string | number)[] = [startDate, endDate];
  let extra = '';
  if (clientId)  { extra += ' AND q.ClientId = ?';  params.push(clientId); }
  if (scenario)  { extra += ' AND TRIM(q.scenario) = ?'; params.push(scenario); }
  if (agentName) { extra += ' AND q.User = ?'; params.push(agentName); }

  const [row] = await querySource<Record<string, number>>(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN call_answered_within_5_seconds    IS NOT NULL THEN 1 ELSE 0 END) AS t_call_ans,
      SUM(COALESCE(call_answered_within_5_seconds,0))                                 AS h_call_ans,
      SUM(CASE WHEN customer_concern_acknowledged     IS NOT NULL THEN 1 ELSE 0 END) AS t_cca,
      SUM(COALESCE(customer_concern_acknowledged,0))                                  AS h_cca,
      SUM(CASE WHEN professionalism_maintained        IS NOT NULL THEN 1 ELSE 0 END) AS t_prof,
      SUM(COALESCE(professionalism_maintained,0))                                     AS h_prof,
      SUM(CASE WHEN assurance_or_appreciation_provided IS NOT NULL THEN 1 ELSE 0 END) AS t_assur,
      SUM(COALESCE(assurance_or_appreciation_provided,0))                              AS h_assur,
      SUM(CASE WHEN pronunciation_and_clarity        IS NOT NULL THEN 1 ELSE 0 END) AS t_pron,
      SUM(COALESCE(pronunciation_and_clarity,0))                                      AS h_pron,
      SUM(CASE WHEN enthusiasm_and_no_fumbling       IS NOT NULL THEN 1 ELSE 0 END) AS t_enth,
      SUM(COALESCE(enthusiasm_and_no_fumbling,0))                                     AS h_enth,
      SUM(CASE WHEN active_listening                 IS NOT NULL THEN 1 ELSE 0 END) AS t_al,
      SUM(COALESCE(active_listening,0))                                               AS h_al,
      SUM(CASE WHEN politeness_and_no_sarcasm        IS NOT NULL THEN 1 ELSE 0 END) AS t_pol,
      SUM(COALESCE(politeness_and_no_sarcasm,0))                                      AS h_pol,
      SUM(CASE WHEN proper_grammar                   IS NOT NULL THEN 1 ELSE 0 END) AS t_gram,
      SUM(COALESCE(proper_grammar,0))                                                  AS h_gram,
      SUM(CASE WHEN accurate_issue_probing           IS NOT NULL THEN 1 ELSE 0 END) AS t_probe,
      SUM(COALESCE(accurate_issue_probing,0))                                          AS h_probe,
      SUM(CASE WHEN proper_hold_procedure            IS NOT NULL THEN 1 ELSE 0 END) AS t_hold,
      SUM(COALESCE(proper_hold_procedure,0))                                           AS h_hold,
      SUM(CASE WHEN proper_transfer_and_language     IS NOT NULL THEN 1 ELSE 0 END) AS t_trans,
      SUM(COALESCE(proper_transfer_and_language,0))                                    AS h_trans,
      SUM(CASE WHEN dead_air_under_10_seconds        IS NOT NULL THEN 1 ELSE 0 END) AS t_dead,
      SUM(COALESCE(dead_air_under_10_seconds,0))                                       AS h_dead,
      SUM(CASE WHEN case_escalated_correctly         IS NOT NULL THEN 1 ELSE 0 END) AS t_esc,
      SUM(COALESCE(case_escalated_correctly,0))                                        AS h_esc,
      SUM(CASE WHEN address_recorded_completely      IS NOT NULL THEN 1 ELSE 0 END) AS t_addr,
      SUM(COALESCE(address_recorded_completely,0))                                     AS h_addr,
      SUM(CASE WHEN correct_and_complete_information IS NOT NULL THEN 1 ELSE 0 END) AS t_info,
      SUM(COALESCE(correct_and_complete_information,0))                                AS h_info,
      SUM(CASE WHEN upselling_or_offers_suggested    IS NOT NULL THEN 1 ELSE 0 END) AS t_ups,
      SUM(COALESCE(upselling_or_offers_suggested,0))                                   AS h_ups,
      SUM(CASE WHEN further_assistance_offered       IS NOT NULL THEN 1 ELSE 0 END) AS t_fao,
      SUM(COALESCE(further_assistance_offered,0))                                      AS h_fao,
      SUM(CASE WHEN proper_call_closure              IS NOT NULL THEN 1 ELSE 0 END) AS t_closure,
      SUM(COALESCE(proper_call_closure,0))                                             AS h_closure,
      SUM(CASE WHEN express_empathy                  IS NOT NULL THEN 1 ELSE 0 END) AS t_empathy,
      SUM(COALESCE(express_empathy,0))                                                 AS h_empathy
    FROM db_audit.call_quality_assessment q
    WHERE q.CallDate BETWEEN ? AND ?
      AND q.quality_percentage IS NOT NULL
      ${extra}
  `, params);

  if (!row) return [];

  const def: Array<{ label: string; hKey: string; tKey: string }> = [
    { label: 'Call Answered Within 5 Sec',      hKey: 'h_call_ans', tKey: 't_call_ans' },
    { label: 'Customer Concern Acknowledged',    hKey: 'h_cca',      tKey: 't_cca'      },
    { label: 'Professionalism Maintained',       hKey: 'h_prof',     tKey: 't_prof'     },
    { label: 'Assurance / Appreciation Provided',hKey: 'h_assur',    tKey: 't_assur'    },
    { label: 'Pronunciation and Clarity',        hKey: 'h_pron',     tKey: 't_pron'     },
    { label: 'Enthusiasm and No Fumbling',       hKey: 'h_enth',     tKey: 't_enth'     },
    { label: 'Active Listening',                 hKey: 'h_al',       tKey: 't_al'       },
    { label: 'Politeness and No Sarcasm',        hKey: 'h_pol',      tKey: 't_pol'      },
    { label: 'Proper Grammar',                   hKey: 'h_gram',     tKey: 't_gram'     },
    { label: 'Accurate Issue Probing',           hKey: 'h_probe',    tKey: 't_probe'    },
    { label: 'Proper Hold Procedure',            hKey: 'h_hold',     tKey: 't_hold'     },
    { label: 'Proper Transfer and Language',     hKey: 'h_trans',    tKey: 't_trans'    },
    { label: 'Dead Air Under 10 Seconds',        hKey: 'h_dead',     tKey: 't_dead'     },
    { label: 'Case Escalated Correctly',         hKey: 'h_esc',      tKey: 't_esc'      },
    { label: 'Address Recorded Completely',      hKey: 'h_addr',     tKey: 't_addr'     },
    { label: 'Correct and Complete Information', hKey: 'h_info',     tKey: 't_info'     },
    { label: 'Upselling / Offers Suggested',     hKey: 'h_ups',      tKey: 't_ups'      },
    { label: 'Further Assistance Offered',       hKey: 'h_fao',      tKey: 't_fao'      },
    { label: 'Proper Call Closure',              hKey: 'h_closure',  tKey: 't_closure'  },
    { label: 'Express Empathy',                  hKey: 'h_empathy',  tKey: 't_empathy'  },
  ];

  return def
    .map(({ label, hKey, tKey }) => {
      const hit   = Number(row[hKey] ?? 0);
      const total = Number(row[tKey] ?? 0);
      return {
        parameter:   label,
        hit_count:   hit,
        total_count: total,
        score_pct:   total > 0 ? Math.round(hit / total * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.hit_count - a.hit_count);
}

export async function getWeekWiseQuality(filters: InboundQualityFilters & { scenario?: string; agentName?: string }): Promise<WeekWiseQualityRow[]> {
  const { startDate, endDate, clientId, scenario, agentName } = filters;
  const params: (string | number)[] = [startDate, endDate];
  let extra = '';
  if (clientId)  { extra += ' AND q.ClientId = ?';  params.push(clientId); }
  if (scenario)  { extra += ' AND TRIM(q.scenario) = ?'; params.push(scenario); }
  if (agentName) { extra += ' AND q.User = ?'; params.push(agentName); }

  const rows = await querySource<{
    week_label: string; audit_count: number; cq_score: number | null;
    fatal_count: number; fatal_pct: number | null;
    opening_skill: number | null; soft_skill: number | null;
    hold_procedure: number | null; resolution: number | null; closing: number | null;
  }>(`
    SELECT
      CASE
        WHEN DAYOFMONTH(q.CallDate) BETWEEN 1  AND 7  THEN 'Week 1'
        WHEN DAYOFMONTH(q.CallDate) BETWEEN 8  AND 14 THEN 'Week 2'
        WHEN DAYOFMONTH(q.CallDate) BETWEEN 15 AND 21 THEN 'Week 3'
        ELSE 'Week 4'
      END                                              AS week_label,
      COUNT(*)                                         AS audit_count,
      ROUND(AVG(q.quality_percentage),1)               AS cq_score,
      SUM(CASE WHEN q.quality_percentage=0 THEN 1 ELSE 0 END) AS fatal_count,
      ROUND(SUM(CASE WHEN q.quality_percentage=0 THEN 1 ELSE 0 END)*100.0/COUNT(*),1) AS fatal_pct,
      ${_OPENING}    AS opening_skill,
      ${_SOFT}       AS soft_skill,
      ${_HOLD}       AS hold_procedure,
      ${_RESOLUTION} AS resolution,
      ${_CLOSING}    AS closing
    FROM db_audit.call_quality_assessment q
    WHERE q.CallDate BETWEEN ? AND ?
      AND q.quality_percentage IS NOT NULL
      ${extra}
    GROUP BY week_label
    ORDER BY MIN(q.CallDate) ASC
  `, params);

  return rows.map(r => ({
    week_label:     String(r.week_label),
    audit_count:    Number(r.audit_count),
    cq_score:       Number(r.cq_score      ?? 0),
    fatal_count:    Number(r.fatal_count),
    fatal_pct:      Number(r.fatal_pct     ?? 0),
    opening_skill:  Number(r.opening_skill  ?? 0),
    soft_skill:     Number(r.soft_skill     ?? 0),
    hold_procedure: Number(r.hold_procedure ?? 0),
    resolution:     Number(r.resolution     ?? 0),
    closing:        Number(r.closing        ?? 0),
  }));
}

export async function getDayWiseQuality(filters: InboundQualityFilters & { scenario?: string; agentName?: string }): Promise<DayWiseQualityRow[]> {
  const { startDate, endDate, clientId, scenario, agentName } = filters;
  const params: (string | number)[] = [startDate, endDate];
  let extra = '';
  if (clientId)  { extra += ' AND q.ClientId = ?';  params.push(clientId); }
  if (scenario)  { extra += ' AND TRIM(q.scenario) = ?'; params.push(scenario); }
  if (agentName) { extra += ' AND q.User = ?'; params.push(agentName); }

  const rows = await querySource<{
    call_date: string; audit_count: number; cq_score: number | null;
    fatal_count: number; fatal_pct: number | null;
    opening_skill: number | null; soft_skill: number | null;
    hold_procedure: number | null; resolution: number | null; closing: number | null;
  }>(`
    SELECT
      DATE_FORMAT(q.CallDate,'%Y-%m-%d')           AS call_date,
      COUNT(*)                                     AS audit_count,
      ROUND(AVG(q.quality_percentage),1)           AS cq_score,
      SUM(CASE WHEN q.quality_percentage=0 THEN 1 ELSE 0 END) AS fatal_count,
      ROUND(SUM(CASE WHEN q.quality_percentage=0 THEN 1 ELSE 0 END)*100.0/COUNT(*),1) AS fatal_pct,
      ${_OPENING}    AS opening_skill,
      ${_SOFT}       AS soft_skill,
      ${_HOLD}       AS hold_procedure,
      ${_RESOLUTION} AS resolution,
      ${_CLOSING}    AS closing
    FROM db_audit.call_quality_assessment q
    WHERE q.CallDate BETWEEN ? AND ?
      AND q.quality_percentage IS NOT NULL
      ${extra}
    GROUP BY DATE_FORMAT(q.CallDate,'%Y-%m-%d')
    ORDER BY call_date DESC
  `, params);

  return rows.map(r => ({
    call_date:      String(r.call_date),
    audit_count:    Number(r.audit_count),
    cq_score:       Number(r.cq_score      ?? 0),
    fatal_count:    Number(r.fatal_count),
    fatal_pct:      Number(r.fatal_pct     ?? 0),
    opening_skill:  Number(r.opening_skill  ?? 0),
    soft_skill:     Number(r.soft_skill     ?? 0),
    hold_procedure: Number(r.hold_procedure ?? 0),
    resolution:     Number(r.resolution     ?? 0),
    closing:        Number(r.closing        ?? 0),
  }));
}
