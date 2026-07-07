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
  WHEN LOWER(q.top_negative_words) LIKE '%unhappy%' THEN 'Frustration'
  WHEN LOWER(q.top_negative_words) LIKE '%terrible%' THEN 'Frustration'
  WHEN LOWER(q.top_negative_words) LIKE '%horrible%' THEN 'Frustration'
  WHEN LOWER(q.top_negative_words) LIKE '%awful%' THEN 'Frustration'
  WHEN LOWER(q.top_negative_words) LIKE '%very bad%' THEN 'Frustration'
  WHEN LOWER(q.top_negative_words) LIKE '%bad experience%' THEN 'Frustration'
  WHEN LOWER(q.top_negative_words) LIKE '%worst%' THEN 'Frustration'
  WHEN LOWER(q.top_negative_words) LIKE '%not satisfied%' THEN 'Frustration'
  WHEN LOWER(q.top_negative_words) LIKE '%not happy%' THEN 'Frustration'
  WHEN LOWER(q.top_negative_words) LIKE '%rude%' THEN 'Abuse'
  WHEN LOWER(q.top_negative_words) LIKE '%abusive%' THEN 'Abuse'
  WHEN LOWER(q.top_negative_words) LIKE '%insult%' THEN 'Abuse'
  WHEN LOWER(q.top_negative_words) LIKE '%offensive%' THEN 'Abuse'
  WHEN LOWER(q.top_negative_words) LIKE '%consumer court%' THEN 'Threat'
  WHEN LOWER(q.top_negative_words) LIKE '%social media%' THEN 'Threat'
  WHEN LOWER(q.top_negative_words) LIKE '%lawyer%' THEN 'Threat'
  WHEN LOWER(q.top_negative_words) LIKE '%blackmail%' THEN 'Threat'
  WHEN LOWER(q.top_negative_words) LIKE '%police complaint%' THEN 'Threat'
  WHEN LOWER(q.top_negative_words) LIKE '%legal action%' THEN 'Threat'
  WHEN LOWER(q.top_negative_words) LIKE '%consumer forum%' THEN 'Threat'
  ELSE 'No'
END`;

// ─── Dynamic NEG_CAT extension via DB keyword rules ───────────────────────────
// Starts with the static CASE; DB rules are appended (refreshed hourly).
// Admins add rows to db_audit.neg_category_keywords — picked up without a code deploy.
let NEG_CAT_EXPR = NEG_CAT;

async function refreshNegCatExpr(): Promise<void> {
  try {
    await querySource(`
      CREATE TABLE IF NOT EXISTS db_audit.neg_category_keywords (
        id       INT AUTO_INCREMENT PRIMARY KEY,
        pattern  VARCHAR(500) NOT NULL COMMENT 'keyword to LIKE-match (case-insensitive)',
        category VARCHAR(50)  NOT NULL COMMENT 'Frustration|Threat|Abuse|Slang|Sarcasm',
        enabled  TINYINT(1)   NOT NULL DEFAULT 1,
        INDEX idx_enabled (enabled)
      )
    `, []);

    // Seed default patterns on first run
    const [cntRow] = await querySource<{ c: number }>(
      'SELECT COUNT(*) AS c FROM db_audit.neg_category_keywords', [],
    );
    if ((cntRow?.c ?? 0) === 0) {
      await querySource(`
        INSERT INTO db_audit.neg_category_keywords (pattern, category) VALUES
        ('tampered','Threat'),('expired','Frustration'),('outdated','Frustration'),
        ('not working','Frustration'),('broken','Frustration'),('defective','Frustration'),
        ('complain','Frustration'),('overcharged','Threat'),('defraud','Threat'),
        ('cheated','Threat'),('baar baar','Frustration'),('pareshaan','Frustration'),
        ('nuksan','Threat'),('haani','Threat'),('badnaam','Threat'),
        ('galat','Frustration'),('jhooth','Threat'),('bewakoof','Abuse'),
        ('gaali','Abuse'),('band karo','Frustration'),('waste','Frustration')
      `, []);
    }

    const rules = await querySource<{ pattern: string; category: string }>(
      'SELECT pattern, category FROM db_audit.neg_category_keywords WHERE enabled = 1 ORDER BY id ASC',
      [],
    );
    if (!rules.length) return;

    const esc = (s: string) => s.replace(/'/g, "''");
    const dynamicWhens = rules
      .map(r => `  WHEN LOWER(q.top_negative_words) LIKE '%${esc(r.pattern.toLowerCase())}%' THEN '${esc(r.category)}'`)
      .join('\n');

    const cutIdx = NEG_CAT.lastIndexOf("\n  ELSE 'No'\nEND");
    const coreWhens = NEG_CAT.slice(0, cutIdx);
    NEG_CAT_EXPR = `${coreWhens}\n${dynamicWhens}\n  ELSE 'No'\nEND`;
  } catch (err) {
    NEG_CAT_EXPR = NEG_CAT; // keep static on error
  }
}

// Initial load + hourly refresh (unref so it doesn't block process exit)
refreshNegCatExpr().catch(() => {});
const _negCatTimer = setInterval(() => refreshNegCatExpr().catch(() => {}), 60 * 60 * 1000);
if (typeof _negCatTimer.unref === 'function') _negCatTimer.unref();

// ─── Keyword management ───────────────────────────────────────────────────────
export interface NegKeywordRow { id: number; pattern: string; category: string; enabled: boolean; }

export async function getNegKeywords(): Promise<NegKeywordRow[]> {
  return querySource<NegKeywordRow>(
    'SELECT id, pattern, category, enabled FROM db_audit.neg_category_keywords ORDER BY category, id',
    [],
  );
}

export async function addNegKeyword(pattern: string, category: string): Promise<void> {
  await querySource(
    'INSERT INTO db_audit.neg_category_keywords (pattern, category) VALUES (?, ?)',
    [pattern, category],
  );
  await refreshNegCatExpr(); // Apply immediately
}

export async function updateNegKeyword(id: number, enabled: boolean): Promise<void> {
  await querySource(
    'UPDATE db_audit.neg_category_keywords SET enabled = ? WHERE id = ?',
    [enabled ? 1 : 0, id],
  );
  await refreshNegCatExpr();
}

export async function reloadNegRules(): Promise<void> {
  await refreshNegCatExpr();
}

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
  cuss_abuse_count:           number;
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
    cuss_abuse_count:           number;
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
        ELSE IF(q.call_answered_within_5_seconds = 1, 1, 0) END
      ) * 100, 1) AS opening_skill,
      ROUND(AVG(
        CASE WHEN q.scenario1 IN ('Call Drop in between','Short Call/Blank Call') THEN 1
        ELSE (
          IF(q.professionalism_maintained         = 1, 0.125, 0) +
          IF(q.assurance_or_appreciation_provided = 1, 0.125, 0) +
          IF(q.pronunciation_and_clarity          = 1, 0.125, 0) +
          IF(q.enthusiasm_and_no_fumbling         = 1, 0.125, 0) +
          IF(q.active_listening                   = 1, 0.125, 0) +
          IF(q.politeness_and_no_sarcasm          = 1, 0.125, 0) +
          IF(q.proper_grammar                     = 1, 0.125, 0) +
          IF(q.accurate_issue_probing             = 1, 0.125, 0)
        ) END
      ) * 100, 1) AS soft_skill,
      ROUND(AVG(
        CASE WHEN q.scenario1 IN ('Call Drop in between','Short Call/Blank Call') THEN 1
        ELSE (
          IF(q.proper_hold_procedure       = 1, 0.333, 0) +
          IF(q.proper_transfer_and_language= 1, 0.333, 0) +
          IF(q.dead_air_under_10_seconds   = 1, 0.334, 0)
        ) END
      ) * 100, 1) AS hold_procedure,
      ROUND(AVG(
        CASE WHEN q.scenario1 IN ('Call Drop in between','Short Call/Blank Call') THEN 1
        ELSE (
          IF(q.case_escalated_correctly         = 1, 0.25, 0) +
          IF(q.address_recorded_completely      = 1, 0.25, 0) +
          IF(q.correct_and_complete_information = 1, 0.25, 0) +
          IF(q.upselling_or_offers_suggested    = 1, 0.25, 0)
        ) END
      ) * 100, 1) AS resolution,
      ROUND(AVG(
        CASE WHEN q.scenario1 IN ('Call Drop in between','Short Call/Blank Call') THEN 1
        ELSE (
          IF(q.further_assistance_offered = 1, 0.5, 0) +
          IF(q.proper_call_closure        = 1, 0.5, 0)
        ) END
      ) * 100, 1) AS closing,
      SUM(CASE WHEN
        NOT (
          LOWER(TRIM(q.financial_fraud)) = 'yes'
          OR LOWER(q.top_negative_words) LIKE '%scam%'
          OR LOWER(q.top_negative_words) LIKE '%fraud%'
          OR LOWER(q.top_negative_words) LIKE '%cheat%'
          OR LOWER(q.top_negative_words) LIKE '%fake%'
          OR LOWER(q.top_negative_words) LIKE '%loot%'
        )
        AND (
          LOWER(q.sensetive_word) LIKE '%social%'   OR
          LOWER(q.sensetive_word) LIKE '%court%'    OR
          LOWER(q.sensetive_word) LIKE '%consumer%' OR
          LOWER(q.sensetive_word) LIKE '%legal%'    OR
          LOWER(q.sensetive_word) LIKE '%fir%'
        )
      THEN 1 ELSE 0 END) AS social_media_court_threat,
      SUM(CASE WHEN
        LOWER(TRIM(q.financial_fraud)) = 'yes'
        OR LOWER(q.top_negative_words) LIKE '%scam%'
        OR LOWER(q.top_negative_words) LIKE '%fraud%'
        OR LOWER(q.top_negative_words) LIKE '%cheat%'
        OR LOWER(q.top_negative_words) LIKE '%fake%'
        OR LOWER(q.top_negative_words) LIKE '%loot%'
      THEN 1 ELSE 0 END) AS potential_scam,
      SUM(CASE WHEN
        (COALESCE(q.agent_english_cuss_count,   0) +
         COALESCE(q.agent_hindi_cuss_count,     0) +
         COALESCE(q.customer_english_cuss_count,0) +
         COALESCE(q.customer_hindi_cuss_count,  0)) > 0
      THEN 1 ELSE 0 END) AS cuss_abuse_count
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
    social_media_court_threat: 0, potential_scam: 0, cuss_abuse_count: 0,
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
        WHEN CAST(q.length_in_sec AS UNSIGNED) < 60  THEN 'Short(<1min)'
        WHEN CAST(q.length_in_sec AS UNSIGNED) < 301 THEN 'Average(1min-5min)'
        WHEN CAST(q.length_in_sec AS UNSIGNED) < 600 THEN 'Long(5min-10min)'
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
      AND TRIM(q.length_in_sec) != ''
      ${clientFilter}
    GROUP BY category
    ORDER BY
      CASE category
        WHEN 'Short(<1min)'           THEN 1
        WHEN 'Average(1min-5min)'     THEN 2
        WHEN 'Long(5min-10min)'       THEN 3
        WHEN 'Extremely Long(>10min)' THEN 4
      END
  `, params);

  // Always include all 4 categories (fill missing with zeros so UI always shows them)
  const ACHT_CATEGORIES = ['Short(<1min)', 'Average(1min-5min)', 'Long(5min-10min)', 'Extremely Long(>10min)'];
  const achtMap = new Map(achtRaw.map(a => [String(a.category), a]));
  const acht_data: AchtRow[] = ACHT_CATEGORIES.map(cat => {
    const a = achtMap.get(cat);
    return {
      category:    cat,
      audit_count: a ? Number(a.audit_count) : 0,
      score_pct:   a ? Number(a.score_pct ?? 0) : 0,
      fatal_count: a ? Number(a.fatal_count) : 0,
      fatal_pct:   a ? Number(a.fatal_pct ?? 0) : 0,
    };
  });

  const opening_skill  = Number(r.opening_skill  ?? 0);
  const soft_skill     = Number(r.soft_skill     ?? 0);
  const hold_procedure = Number(r.hold_procedure ?? 0);
  const resolution     = Number(r.resolution     ?? 0);
  const closing        = Number(r.closing        ?? 0);
  const avg_score      = Number(((opening_skill + soft_skill + hold_procedure + resolution + closing) / 5).toFixed(1));

  // ── Negative signal categorisation ──────────────────────────────────────────
  const negRows = await querySource<{ neg_cat: string; cnt: number }>(`
    SELECT ${NEG_CAT_EXPR} AS neg_cat, COUNT(*) AS cnt
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
    cuss_abuse_count:           Number(r.cuss_abuse_count),
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
      COALESCE(am.AgentName, q.User) AS user,
      COUNT(*)                                AS audit_count,
      ROUND(AVG(q.quality_percentage), 1)     AS avg_score
    FROM db_audit.call_quality_assessment q
    LEFT JOIN Shivamgiri.AgentMaster am ON am.MasId = q.User COLLATE utf8mb4_unicode_ci
    WHERE q.CallDate BETWEEN ? AND ?
      AND q.quality_percentage IS NOT NULL
      AND q.User IS NOT NULL
      AND TRIM(q.User) != ''
      ${clientFilter}
    GROUP BY q.User, am.AgentName
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
  WHEN (
    LOWER(TRIM(q.financial_fraud)) = 'yes'
    OR LOWER(q.top_negative_words) LIKE '%scam%'
    OR LOWER(q.top_negative_words) LIKE '%fraud%'
    OR LOWER(q.top_negative_words) LIKE '%cheat%'
    OR LOWER(q.top_negative_words) LIKE '%fake%'
    OR LOWER(q.top_negative_words) LIKE '%loot%'
  )
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
const SCAM_EXCLUSION = `NOT (
    LOWER(TRIM(q.financial_fraud)) = 'yes'
    OR LOWER(q.top_negative_words) LIKE '%scam%'
    OR LOWER(q.top_negative_words) LIKE '%fraud%'
    OR LOWER(q.top_negative_words) LIKE '%cheat%'
    OR LOWER(q.top_negative_words) LIKE '%fake%'
    OR LOWER(q.top_negative_words) LIKE '%loot%'
  )`;

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

export interface SocialThreatDetailRow {
  lead_id:      string;
  agent_id:     string;
  threat_word:  string;
  threat_type:  'Social Media' | 'Court & Legal';
  scenario:     string;
  scenario1:    string;
  date:         string;
  client_id:    string;
}

export async function getSocialThreatDetail(
  filters: InboundQualityFilters,
): Promise<{ total: number; rows: SocialThreatDetailRow[] }> {
  const { startDate, endDate, clientId } = filters;
  const clientFilter = clientId ? ' AND q.ClientId = ?' : '';
  const params: (string | number)[] = [startDate, endDate, ...(clientId ? [clientId] : [])];

  const rows = await querySource<{
    lead_id: string; agent_id: string; threat_word: string;
    threat_type: string; scenario: string; scenario1: string;
    date: string; client_id: string;
  }>(`
    SELECT
      COALESCE(q.lead_id, '')                                                 AS lead_id,
      q.User                                                                  AS agent_id,
      COALESCE(NULLIF(TRIM(q.sensetive_word), ''), '—')                       AS threat_word,
      CASE
        WHEN LOWER(q.sensetive_word) LIKE '%social%' THEN 'Social Media'
        ELSE 'Court & Legal'
      END                                                                     AS threat_type,
      COALESCE(NULLIF(TRIM(q.scenario),  ''), 'Unknown')                     AS scenario,
      COALESCE(NULLIF(TRIM(q.scenario1), ''), 'Unknown')                     AS scenario1,
      DATE_FORMAT(q.CallDate, '%Y-%m-%d %H:%i')                              AS date,
      q.ClientId                                                              AS client_id
    FROM db_audit.call_quality_assessment q
    WHERE q.CallDate BETWEEN ? AND ?
      AND q.quality_percentage IS NOT NULL
      ${clientFilter}
      AND NOT (
        LOWER(TRIM(q.financial_fraud)) = 'yes'
        OR LOWER(q.top_negative_words) LIKE '%scam%'
        OR LOWER(q.top_negative_words) LIKE '%fraud%'
        OR LOWER(q.top_negative_words) LIKE '%cheat%'
        OR LOWER(q.top_negative_words) LIKE '%fake%'
        OR LOWER(q.top_negative_words) LIKE '%loot%'
      )
      AND (
        LOWER(q.sensetive_word) LIKE '%social%'   OR
        LOWER(q.sensetive_word) LIKE '%court%'    OR
        LOWER(q.sensetive_word) LIKE '%consumer%' OR
        LOWER(q.sensetive_word) LIKE '%legal%'    OR
        LOWER(q.sensetive_word) LIKE '%fir%'
      )
    ORDER BY q.CallDate DESC
    LIMIT 500
  `, params);

  return {
    total: rows.length,
    rows: rows.map(r => ({
      lead_id:     String(r.lead_id),
      agent_id:    String(r.agent_id),
      threat_word: String(r.threat_word),
      threat_type: (r.threat_type === 'Social Media' ? 'Social Media' : 'Court & Legal') as SocialThreatDetailRow['threat_type'],
      scenario:    String(r.scenario),
      scenario1:   String(r.scenario1),
      date:        String(r.date),
      client_id:   String(r.client_id),
    })),
  };
}

// ─── Top Positive Signals ─────────────────────────────────────────────────────
export interface PosKeywordRow {
  keyword:        string;
  customer_count: number;
  agent_count:    number;
  total:          number;
}

export async function getTopPositiveSignals(filters: InboundQualityFilters): Promise<PosKeywordRow[]> {
  const { startDate, endDate, clientId } = filters;
  const clientFilter = clientId ? ' AND q.ClientId = ?' : '';
  const params: (string | number)[] = [startDate, endDate, ...(clientId ? [clientId] : [])];

  const rows = await querySource<{ keyword: string; total_count: number }>(`
    SELECT
      kw.keyword,
      SUM(CASE WHEN LOWER(q.top_positive_words)       LIKE CONCAT('%', kw.pattern, '%')
                 OR LOWER(q.top_positive_words_agent) LIKE CONCAT('%', kw.pattern, '%')
               THEN 1 ELSE 0 END) AS total_count
    FROM db_audit.call_quality_assessment q
    CROSS JOIN (
      SELECT 'Thank You'     AS keyword, 'thank'      AS pattern UNION ALL
      SELECT 'Appreciate',               'appreciat'             UNION ALL
      SELECT 'Great',                    'great'                 UNION ALL
      SELECT 'Good',                     'good'                  UNION ALL
      SELECT 'Help / Assist',            'help'                  UNION ALL
      SELECT 'Understanding',            'understand'            UNION ALL
      SELECT 'Patience',                 'patient'               UNION ALL
      SELECT 'Happy',                    'happy'                 UNION ALL
      SELECT 'Satisfied',                'satisf'                UNION ALL
      SELECT 'Excellent',                'excellent'             UNION ALL
      SELECT 'Nice',                     'nice'                  UNION ALL
      SELECT 'Wonderful',                'wonder'
    ) kw
    WHERE q.CallDate BETWEEN ? AND ?
      AND q.quality_percentage IS NOT NULL
      ${clientFilter}
    GROUP BY kw.keyword, kw.pattern
    ORDER BY total_count DESC
  `, params);

  return rows
    .map(r => ({
      keyword:        String(r.keyword),
      customer_count: 0,
      agent_count:    0,
      total:          Number(r.total_count),
    }))
    .filter(r => r.total > 0)
    .sort((a, b) => b.total - a.total);
}

export interface PosKeywordPhraseRow {
  source: 'Customer' | 'Agent';
  phrase: string;
  count:  number;
}

export async function getPosKeywordPhrases(
  filters: InboundQualityFilters,
  pattern: string,
): Promise<PosKeywordPhraseRow[]> {
  const { startDate, endDate, clientId } = filters;
  const clientFilter = clientId ? ' AND q.ClientId = ?' : '';
  const likePattern  = `%${pattern.toLowerCase()}%`;
  const params       = [startDate, endDate, ...(clientId ? [clientId] : []), likePattern];

  const [custRows, agentRows] = await Promise.all([
    querySource<{ phrase: string; cnt: number }>(`
      SELECT TRIM(q.top_positive_words) AS phrase, COUNT(*) AS cnt
      FROM db_audit.call_quality_assessment q
      WHERE q.CallDate BETWEEN ? AND ?
        AND q.quality_percentage IS NOT NULL
        ${clientFilter}
        AND LOWER(q.top_positive_words) LIKE ?
        AND TRIM(q.top_positive_words) NOT IN ('','None','N/A')
      GROUP BY phrase ORDER BY cnt DESC LIMIT 12
    `, params),
    querySource<{ phrase: string; cnt: number }>(`
      SELECT TRIM(q.top_positive_words_agent) AS phrase, COUNT(*) AS cnt
      FROM db_audit.call_quality_assessment q
      WHERE q.CallDate BETWEEN ? AND ?
        AND q.quality_percentage IS NOT NULL
        ${clientFilter}
        AND LOWER(q.top_positive_words_agent) LIKE ?
        AND TRIM(q.top_positive_words_agent) NOT IN ('','None','N/A','Not applicable','Not Available')
      GROUP BY phrase ORDER BY cnt DESC LIMIT 12
    `, params),
  ]);

  return [
    ...custRows.map(r  => ({ source: 'Customer' as const, phrase: String(r.phrase), count: Number(r.cnt) })),
    ...agentRows.map(r => ({ source: 'Agent'    as const, phrase: String(r.phrase), count: Number(r.cnt) })),
  ].sort((a, b) => b.count - a.count);
}

// ─── Transcript fetch ─────────────────────────────────────────────────────────
export async function getTranscript(leadId: string): Promise<{ lead_id: string; agent_id: string; date: string; transcript: string } | null> {
  const rows = await querySource<{ lead_id: string; agent_id: string; date: string; transcript: string }>(`
    SELECT
      COALESCE(lead_id, '')                               AS lead_id,
      COALESCE(NULLIF(TRIM(User), ''), 'Unknown')         AS agent_id,
      DATE_FORMAT(CallDate, '%Y-%m-%d %H:%i')             AS date,
      COALESCE(Transcribe_Text, '')                       AS transcript
    FROM db_audit.call_quality_assessment
    WHERE lead_id = ?
    LIMIT 1
  `, [leadId]);
  if (!rows.length) return null;
  const r = rows[0];
  return {
    lead_id:    String(r.lead_id),
    agent_id:   String(r.agent_id),
    date:       String(r.date),
    transcript: String(r.transcript),
  };
}

// ─── Score Component Detail ───────────────────────────────────────────────────
export interface ScoreParamDetail {
  column: string;
  label:  string;
  pct:    number;
}
export interface ScoreComponentData {
  total:         number;
  opening_skill: ScoreParamDetail[];
  soft_skill:    ScoreParamDetail[];
  hold_procedure:ScoreParamDetail[];
  resolution:    ScoreParamDetail[];
  closing:       ScoreParamDetail[];
}

const SCORE_LABEL: Record<string, string> = {
  call_answered_within_5_seconds:     'Call Answered Within 5s',
  customer_concern_acknowledged:      'Customer Concern Acknowledged',
  professionalism_maintained:         'Professionalism Maintained',
  assurance_or_appreciation_provided: 'Assurance / Appreciation',
  pronunciation_and_clarity:          'Pronunciation & Clarity',
  enthusiasm_and_no_fumbling:         'Enthusiasm & No Fumbling',
  active_listening:                   'Active Listening',
  politeness_and_no_sarcasm:          'Politeness & No Sarcasm',
  proper_grammar:                     'Proper Grammar',
  accurate_issue_probing:             'Accurate Issue Probing',
  proper_hold_procedure:              'Proper Hold Procedure',
  proper_transfer_and_language:       'Proper Transfer & Language',
  dead_air_under_10_seconds:          'Dead Air Under 10s',
  case_escalated_correctly:           'Case Escalated Correctly',
  address_recorded_completely:        'Address Recorded Completely',
  correct_and_complete_information:   'Correct & Complete Info',
  upselling_or_offers_suggested:      'Upselling / Offers Suggested',
  further_assistance_offered:         'Further Assistance Offered',
  proper_call_closure:                'Proper Call Closure',
};

export async function getScoreComponentDetail(filters: InboundQualityFilters): Promise<ScoreComponentData> {
  const { startDate, endDate, clientId } = filters;
  const clientFilter = clientId ? 'AND q.ClientId = ?' : '';
  const params: (string | number)[] = clientId
    ? [startDate, endDate, clientId]
    : [startDate, endDate];

  const rows = await querySource<Record<string, unknown>>(`
    SELECT
      COUNT(*) AS total,
      ROUND(100.0 * SUM(CASE WHEN COALESCE(q.call_answered_within_5_seconds,0)     = 1 THEN 1 ELSE 0 END) / COUNT(*), 1) AS call_answered_within_5_seconds,
      ROUND(100.0 * SUM(CASE WHEN COALESCE(q.customer_concern_acknowledged,0)      = 1 THEN 1 ELSE 0 END) / COUNT(*), 1) AS customer_concern_acknowledged,
      ROUND(100.0 * SUM(CASE WHEN COALESCE(q.professionalism_maintained,0)         = 1 THEN 1 ELSE 0 END) / COUNT(*), 1) AS professionalism_maintained,
      ROUND(100.0 * SUM(CASE WHEN COALESCE(q.assurance_or_appreciation_provided,0) = 1 THEN 1 ELSE 0 END) / COUNT(*), 1) AS assurance_or_appreciation_provided,
      ROUND(100.0 * SUM(CASE WHEN COALESCE(q.pronunciation_and_clarity,0)          = 1 THEN 1 ELSE 0 END) / COUNT(*), 1) AS pronunciation_and_clarity,
      ROUND(100.0 * SUM(CASE WHEN COALESCE(q.enthusiasm_and_no_fumbling,0)         = 1 THEN 1 ELSE 0 END) / COUNT(*), 1) AS enthusiasm_and_no_fumbling,
      ROUND(100.0 * SUM(CASE WHEN COALESCE(q.active_listening,0)                   = 1 THEN 1 ELSE 0 END) / COUNT(*), 1) AS active_listening,
      ROUND(100.0 * SUM(CASE WHEN COALESCE(q.politeness_and_no_sarcasm,0)          = 1 THEN 1 ELSE 0 END) / COUNT(*), 1) AS politeness_and_no_sarcasm,
      ROUND(100.0 * SUM(CASE WHEN COALESCE(q.proper_grammar,0)                     = 1 THEN 1 ELSE 0 END) / COUNT(*), 1) AS proper_grammar,
      ROUND(100.0 * SUM(CASE WHEN COALESCE(q.accurate_issue_probing,0)             = 1 THEN 1 ELSE 0 END) / COUNT(*), 1) AS accurate_issue_probing,
      ROUND(100.0 * SUM(CASE WHEN COALESCE(q.proper_hold_procedure,0)              = 1 THEN 1 ELSE 0 END) / COUNT(*), 1) AS proper_hold_procedure,
      ROUND(100.0 * SUM(CASE WHEN COALESCE(q.proper_transfer_and_language,0)       = 1 THEN 1 ELSE 0 END) / COUNT(*), 1) AS proper_transfer_and_language,
      ROUND(100.0 * SUM(CASE WHEN COALESCE(q.dead_air_under_10_seconds,0)          = 1 THEN 1 ELSE 0 END) / COUNT(*), 1) AS dead_air_under_10_seconds,
      ROUND(100.0 * SUM(CASE WHEN COALESCE(q.case_escalated_correctly,0)           = 1 THEN 1 ELSE 0 END) / COUNT(*), 1) AS case_escalated_correctly,
      ROUND(100.0 * SUM(CASE WHEN COALESCE(q.address_recorded_completely,0)        = 1 THEN 1 ELSE 0 END) / COUNT(*), 1) AS address_recorded_completely,
      ROUND(100.0 * SUM(CASE WHEN COALESCE(q.correct_and_complete_information,0)   = 1 THEN 1 ELSE 0 END) / COUNT(*), 1) AS correct_and_complete_information,
      ROUND(100.0 * SUM(CASE WHEN COALESCE(q.upselling_or_offers_suggested,0)      = 1 THEN 1 ELSE 0 END) / COUNT(*), 1) AS upselling_or_offers_suggested,
      ROUND(100.0 * SUM(CASE WHEN COALESCE(q.further_assistance_offered,0)         = 1 THEN 1 ELSE 0 END) / COUNT(*), 1) AS further_assistance_offered,
      ROUND(100.0 * SUM(CASE WHEN COALESCE(q.proper_call_closure,0)                = 1 THEN 1 ELSE 0 END) / COUNT(*), 1) AS proper_call_closure
    FROM db_audit.call_quality_assessment q
    WHERE q.CallDate BETWEEN ? AND ?
      AND q.quality_percentage IS NOT NULL
      ${clientFilter}
  `, params);

  const empty: ScoreComponentData = { total: 0, opening_skill: [], soft_skill: [], hold_procedure: [], resolution: [], closing: [] };
  if (!rows.length) return empty;

  const r = rows[0];
  const p = (col: string): ScoreParamDetail => ({ column: col, label: SCORE_LABEL[col] ?? col, pct: Number(r[col] ?? 0) });

  return {
    total:          Number(r.total ?? 0),
    opening_skill:  [
      p('call_answered_within_5_seconds'),
    ],
    soft_skill:     [
      p('professionalism_maintained'),
      p('assurance_or_appreciation_provided'),
      p('pronunciation_and_clarity'),
      p('enthusiasm_and_no_fumbling'),
      p('active_listening'),
      p('politeness_and_no_sarcasm'),
      p('proper_grammar'),
      p('accurate_issue_probing'),
    ],
    hold_procedure: [
      p('proper_hold_procedure'),
      p('proper_transfer_and_language'),
      p('dead_air_under_10_seconds'),
    ],
    resolution:     [
      p('case_escalated_correctly'),
      p('address_recorded_completely'),
      p('correct_and_complete_information'),
      p('upselling_or_offers_suggested'),
    ],
    closing:        [
      p('further_assistance_offered'),
      p('proper_call_closure'),
    ],
  };
}

// ─── CLAP CASE expression (reused across drill queries) ─────────────────────
const CLAP_CASE_INBOUND = `
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

export interface ClapDrillResponse {
  claps: { clap: string; count: number }[];
  scenarios: { scenario: string; count: number; pct: number }[];
  subScenarios: { subScenario: string; count: number; pct: number }[];
  leads: { leadId: string; agentId: string; agentName: string; callDate: string; scenario: string; scenario1: string }[];
  words: string[];
}

/**
 * Hierarchical CLAP drill for any keyword/signal type.
 *
 * @param type  'pos' = positive keywords, 'neg' = negative signals,
 *              'social' = social/court threats, 'scam' = potential scams
 * @param pattern  LIKE pattern (required for pos/neg, ignored for social/scam)
 * @param clap  filter by CLAP category (null = just return clap counts)
 * @param scenario  filter by scenario (null = return scenarios for clap)
 * @param subScenario  filter by sub-scenario (null = return sub-scenarios for scenario)
 */
export async function getClapKeywordDrill(
  filters: InboundQualityFilters,
  type: 'pos' | 'neg' | 'social' | 'scam',
  pattern: string,
  clap?: string,
  scenario?: string,
  subScenario?: string,
): Promise<ClapDrillResponse> {
  const { startDate, endDate, clientId } = filters;
  const clientFilter = clientId ? ' AND q.ClientId = ?' : '';
  const baseParams: (string | number)[] = [startDate, endDate];
  if (clientId) baseParams.push(clientId);

  // Build WHERE clause based on type
  let typeClause: string;
  let typeParams: (string | number)[] = [];
  if (type === 'pos') {
    if (pattern) {
      const parts = pattern.split('|').map(p => p.trim()).filter(Boolean);
      if (parts.length === 1) {
        const like = `%${parts[0].toLowerCase()}%`;
        typeClause = `(LOWER(q.top_positive_words) LIKE ? OR LOWER(q.top_positive_words_agent) LIKE ?)`;
        typeParams = [like, like];
      } else {
        const clauses = parts.map(() => `(LOWER(q.top_positive_words) LIKE ? OR LOWER(q.top_positive_words_agent) LIKE ?)`);
        typeClause = `(${clauses.join(' OR ')})`;
        typeParams = parts.flatMap(p => { const like = `%${p.toLowerCase()}%`; return [like, like]; });
      }
    } else {
      typeClause = `(COALESCE(TRIM(q.top_positive_words),'') != '' OR COALESCE(TRIM(q.top_positive_words_agent),'') != '')`;
    }
  } else if (type === 'neg') {
    if (pattern) {
      const like = `%${pattern.toLowerCase()}%`;
      typeClause = `LOWER(q.top_negative_words) LIKE ?`;
      typeParams = [like];
    } else {
      typeClause = `COALESCE(TRIM(q.top_negative_words),'') != ''`;
    }
  } else if (type === 'social') {
    typeClause = `(q.sensetive_word IS NOT NULL AND TRIM(q.sensetive_word) != ''
      AND (LOWER(q.sensetive_word) LIKE '%social%' OR LOWER(q.sensetive_word) LIKE '%court%'
        OR LOWER(q.sensetive_word) LIKE '%consumer%' OR LOWER(q.sensetive_word) LIKE '%legal%'
        OR LOWER(q.sensetive_word) LIKE '%fir%' OR LOWER(q.sensetive_word) LIKE '%threat%'))`;
  } else {
    typeClause = `(LOWER(TRIM(q.financial_fraud)) = 'yes' OR LOWER(q.top_negative_words) LIKE '%scam%' OR LOWER(q.top_negative_words) LIKE '%fraud%' OR LOWER(q.top_negative_words) LIKE '%cheat%' OR LOWER(q.top_negative_words) LIKE '%fake%' OR LOWER(q.top_negative_words) LIKE '%loot%')`;
  }

  const clapFilter = clap ? ` AND ${CLAP_CASE_INBOUND} = ?` : '';
  const scenarioFilter = scenario ? ` AND q.scenario = ?` : '';
  const subScenarioFilter = subScenario ? ` AND COALESCE(NULLIF(TRIM(q.scenario1),''),'—') = ?` : '';

  // Build params for drill levels
  const drillParams = [...baseParams, ...typeParams];
  if (clap) drillParams.push(clap);
  if (scenario) drillParams.push(scenario);
  if (subScenario) drillParams.push(subScenario);

  const where = `CallDate BETWEEN ? AND ? AND quality_percentage IS NOT NULL ${clientFilter} AND ${typeClause}`;
  const fullWhere = where + clapFilter + scenarioFilter + subScenarioFilter;

  const baseParamsForWhere = [...baseParams, ...typeParams];

  // Always return clap-level counts (unless a specific clap is already chosen)
  const claps = await querySource<{ clap: string; count: number }>(
    `SELECT ${CLAP_CASE_INBOUND} AS clap, COUNT(*) AS count
     FROM db_audit.call_quality_assessment q
     WHERE ${where}
     GROUP BY clap ORDER BY count DESC`,
    baseParamsForWhere,
  );

  let scenarios: { scenario: string; count: number; pct: number }[] = [];
  let subScenarios: { subScenario: string; count: number; pct: number }[] = [];
  let leads: { leadId: string; agentId: string; agentName: string; callDate: string; scenario: string; scenario1: string }[] = [];
  let words: string[] = [];

  if (clap) {
    // Level 2: Return scenario breakdown for this CLAP
    const rawScenarios = await querySource<{ scenario: string; count: number }>(
      `SELECT COALESCE(NULLIF(TRIM(q.scenario),''),'Unknown') AS scenario, COUNT(*) AS count
       FROM db_audit.call_quality_assessment q
       WHERE ${where} AND ${CLAP_CASE_INBOUND} = ?
       GROUP BY q.scenario ORDER BY count DESC LIMIT 20`,
      [...baseParamsForWhere, clap],
    );
    const totalScenarios = rawScenarios.reduce((s, r) => s + Number(r.count), 0) || 1;
    scenarios = rawScenarios.map(r => ({ scenario: String(r.scenario), count: Number(r.count), pct: Math.round(Number(r.count) / totalScenarios * 100) }));
  }

  if (clap && scenario) {
    // Level 3: Return sub-scenario breakdown
    const rawSubs = await querySource<{ subScenario: string; count: number }>(
      `SELECT COALESCE(NULLIF(TRIM(q.scenario1),''),'—') AS subScenario, COUNT(*) AS count
       FROM db_audit.call_quality_assessment q
       WHERE ${where} AND ${CLAP_CASE_INBOUND} = ? AND q.scenario = ?
       GROUP BY q.scenario1 ORDER BY count DESC LIMIT 15`,
      [...baseParamsForWhere, clap, scenario],
    );
    const totalSubs = rawSubs.reduce((s, r) => s + Number(r.count), 0) || 1;
    subScenarios = rawSubs.map(r => ({ subScenario: String(r.subScenario), count: Number(r.count), pct: Math.round(Number(r.count) / totalSubs * 100) }));
  }

  if (clap && scenario && subScenario) {
    // Level 4: Return leads with agent name
    leads = await querySource<{ leadId: string; agentId: string; agentName: string; callDate: string; scenario: string; scenario1: string }>(
      `SELECT q.lead_id AS leadId, COALESCE(NULLIF(TRIM(q.User),''),'Unknown') AS agentId,
              COALESCE(am.AgentName, q.User) AS agentName,
              DATE_FORMAT(q.CallDate, '%Y-%m-%d %H:%i') AS callDate,
              COALESCE(NULLIF(TRIM(q.scenario),''),'Unknown') AS scenario,
              COALESCE(NULLIF(TRIM(q.scenario1),''),'—') AS scenario1
       FROM db_audit.call_quality_assessment q
       LEFT JOIN Shivamgiri.AgentMaster am ON am.MasId = q.User COLLATE utf8mb4_unicode_ci
       WHERE ${where} AND ${CLAP_CASE_INBOUND} = ? AND q.scenario = ? AND COALESCE(NULLIF(TRIM(q.scenario1),''),'—') = ?
       ORDER BY q.CallDate DESC
       LIMIT 200`,
      [...baseParamsForWhere, clap, scenario, subScenario],
    );
  }

  // Collect matched words (at any drill level)
  let wordRows: { w: string }[] = [];
  if (type === 'scam') {
    const [negRows, fraudRows] = await Promise.all([
      querySource<{ w: string }>(
        `SELECT DISTINCT top_negative_words AS w FROM db_audit.call_quality_assessment q WHERE ${where} ${clap ? clapFilter : ''} ${scenario ? scenarioFilter : ''} AND top_negative_words IS NOT NULL AND TRIM(top_negative_words) != '' LIMIT 20`,
        [...baseParamsForWhere, ...(clap ? [clap] : []), ...(scenario ? [scenario] : [])],
      ),
      querySource<{ w: string }>(
        `SELECT DISTINCT financial_fraud AS w FROM db_audit.call_quality_assessment q WHERE ${where} ${clap ? clapFilter : ''} ${scenario ? scenarioFilter : ''} AND financial_fraud IS NOT NULL AND TRIM(financial_fraud) != '' LIMIT 10`,
        [...baseParamsForWhere, ...(clap ? [clap] : []), ...(scenario ? [scenario] : [])],
      ),
    ]);
    wordRows = [...negRows, ...fraudRows];
  } else {
    const wordField = type === 'pos' ? 'top_positive_words' : type === 'neg' ? 'top_negative_words' : 'sensetive_word';
    wordRows = await querySource<{ w: string }>(
      `SELECT DISTINCT ${wordField} AS w
       FROM db_audit.call_quality_assessment q
       WHERE ${where} ${clap ? clapFilter : ''} ${scenario ? scenarioFilter : ''} AND ${wordField} IS NOT NULL AND TRIM(${wordField}) != ''
       LIMIT 20`,
      [...baseParamsForWhere, ...(clap ? [clap] : []), ...(scenario ? [scenario] : [])],
    );
  }
  words = [...new Set(wordRows.map(r => String(r.w)).flatMap(w => w.split(',').map(s => s.trim())).filter(Boolean))].slice(0, 30);

  return {
    claps: claps.map(r => ({ clap: String(r.clap), count: Number(r.count) })),
    scenarios,
    subScenarios,
    leads: leads.map(r => ({ leadId: String(r.leadId), agentId: String(r.agentId), agentName: r.agentName || String(r.agentId), callDate: String(r.callDate), scenario: String(r.scenario), scenario1: String(r.scenario1) })),
    words,
  };
}

// ─── CLAP Word Analysis (Customer/Logistic/Agent/Product ± words) ──────────
export interface ClapWordAnalysisResponse {
  claps: {
    clap: string;
    positive: { word: string; count: number }[];
    negative: { word: string; count: number }[];
  }[];
}

function aggregateWords(rows: { words: string; cnt: number }[]): { word: string; count: number }[] {
  const freq: Record<string, number> = {};
  for (const r of rows) {
    if (!r.words) continue;
    r.words.split(',').map(w => w.trim().toLowerCase()).filter(Boolean).forEach(w => { freq[w] = (freq[w] ?? 0) + Number(r.cnt); });
  }
  return Object.entries(freq)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

export async function getClapWords(filters: InboundQualityFilters): Promise<ClapWordAnalysisResponse> {
  const { startDate, endDate, clientId } = filters;
  const clientFilter = clientId ? ' AND q.ClientId = ?' : '';
  const base = [startDate, endDate];
  if (clientId) base.push(clientId);

  // For each CLAP, get positive and negative word combinations
  // Customer: top_positive_words / top_negative_words
  // Agent: top_positive_words_agent / top_negative_words_agent
  // Logistic & Product: same as Customer columns but filtered by CLAP
  const CLAP_LABELS = ['Customer', 'Logistic', 'Agent', 'Product'] as const;
  type ClapName = typeof CLAP_LABELS[number];

  const clapQueries: { clap: ClapName; posField: string; negField: string }[] = [
    { clap: 'Customer', posField: 'top_positive_words', negField: 'top_negative_words' },
    { clap: 'Logistic', posField: 'top_positive_words', negField: 'top_negative_words' },
    { clap: 'Agent',    posField: 'top_positive_words_agent', negField: 'top_negative_words_agent' },
    { clap: 'Product',  posField: 'top_positive_words', negField: 'top_negative_words' },
  ];

  const results = await Promise.all(
    clapQueries.map(q =>
      Promise.all([
        querySource<{ words: string; cnt: number }>(
          `SELECT ${q.posField} AS words, COUNT(*) AS cnt
           FROM db_audit.call_quality_assessment q
           WHERE CallDate BETWEEN ? AND ? AND quality_percentage IS NOT NULL ${clientFilter}
             AND ${CLAP_CASE_INBOUND} = ? AND ${q.posField} IS NOT NULL AND TRIM(${q.posField}) != ''
           GROUP BY ${q.posField} ORDER BY cnt DESC LIMIT 30`,
          [...base, q.clap],
        ),
        querySource<{ words: string; cnt: number }>(
          `SELECT ${q.negField} AS words, COUNT(*) AS cnt
           FROM db_audit.call_quality_assessment q
           WHERE CallDate BETWEEN ? AND ? AND quality_percentage IS NOT NULL ${clientFilter}
             AND ${CLAP_CASE_INBOUND} = ? AND ${q.negField} IS NOT NULL AND TRIM(${q.negField}) != ''
           GROUP BY ${q.negField} ORDER BY cnt DESC LIMIT 30`,
          [...base, q.clap],
        ),
      ])
    )
  );

  return {
    claps: results.map(([posRows, negRows], i) => ({
      clap: clapQueries[i].clap,
      positive: aggregateWords(posRows),
      negative: aggregateWords(negRows),
    })),
  };
}

// ─── Per-call leads for a positive keyword ───────────────────────────────────
export interface PosKeywordLeadRow {
  lead_id:   string;
  agent_id:  string;
  source:    'Customer' | 'Agent';
  phrase:    string;
  scenario:  string;
  scenario1: string;
  date:      string;
}

export async function getPosKeywordLeads(
  filters: InboundQualityFilters,
  pattern: string,
): Promise<PosKeywordLeadRow[]> {
  const { startDate, endDate, clientId } = filters;
  const clientFilter = clientId ? ' AND ClientId = ?' : '';
  const likePattern  = `%${pattern.toLowerCase()}%`;
  const params       = [startDate, endDate, ...(clientId ? [clientId] : []), likePattern];

  const [custRows, agentRows] = await Promise.all([
    querySource<{ lead_id: string; agent_id: string; phrase: string; scenario: string; scenario1: string; date: string }>(`
      SELECT
        COALESCE(lead_id, '')                               AS lead_id,
        COALESCE(NULLIF(TRIM(User), ''), 'Unknown')         AS agent_id,
        COALESCE(top_positive_words, '')                    AS phrase,
        COALESCE(NULLIF(TRIM(scenario),  ''), 'Unknown')    AS scenario,
        COALESCE(NULLIF(TRIM(scenario1), ''), '')           AS scenario1,
        DATE_FORMAT(CallDate, '%Y-%m-%d')                   AS date
      FROM db_audit.call_quality_assessment
      WHERE CallDate BETWEEN ? AND ?
        AND quality_percentage IS NOT NULL
        ${clientFilter}
        AND LOWER(top_positive_words) LIKE ?
      ORDER BY CallDate DESC
      LIMIT 200
    `, params),
    querySource<{ lead_id: string; agent_id: string; phrase: string; scenario: string; scenario1: string; date: string }>(`
      SELECT
        COALESCE(lead_id, '')                               AS lead_id,
        COALESCE(NULLIF(TRIM(User), ''), 'Unknown')         AS agent_id,
        COALESCE(top_positive_words_agent, '')              AS phrase,
        COALESCE(NULLIF(TRIM(scenario),  ''), 'Unknown')    AS scenario,
        COALESCE(NULLIF(TRIM(scenario1), ''), '')           AS scenario1,
        DATE_FORMAT(CallDate, '%Y-%m-%d')                   AS date
      FROM db_audit.call_quality_assessment
      WHERE CallDate BETWEEN ? AND ?
        AND quality_percentage IS NOT NULL
        ${clientFilter}
        AND LOWER(top_positive_words_agent) LIKE ?
      ORDER BY CallDate DESC
      LIMIT 200
    `, params),
  ]);

  return [
    ...custRows.map(r => ({
      lead_id:   String(r.lead_id),
      agent_id:  String(r.agent_id),
      source:    'Customer' as const,
      phrase:    String(r.phrase),
      scenario:  String(r.scenario),
      scenario1: String(r.scenario1),
      date:      String(r.date),
    })),
    ...agentRows.map(r => ({
      lead_id:   String(r.lead_id),
      agent_id:  String(r.agent_id),
      source:    'Agent' as const,
      phrase:    String(r.phrase),
      scenario:  String(r.scenario),
      scenario1: String(r.scenario1),
      date:      String(r.date),
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));
}

export async function getTopNegativeSignalDetails(filters: InboundQualityFilters): Promise<NegSignalDetailRow[]> {
  const { startDate, endDate, clientId } = filters;
  const clientFilter = clientId ? ' AND q.ClientId = ?' : '';
  const params: (string | number)[] = [startDate, endDate, ...(clientId ? [clientId] : [])];

  const rows = await querySource<{ scenario: string; scenario1: string; neg_signal: string; cnt: number }>(`
    SELECT
      CASE WHEN TRIM(q.scenario)  = '' OR q.scenario  IS NULL THEN 'Unknown' ELSE TRIM(q.scenario)  END AS scenario,
      CASE WHEN TRIM(q.scenario1) = '' OR q.scenario1 IS NULL THEN 'Unknown' ELSE TRIM(q.scenario1) END AS scenario1,
      ${NEG_CAT_EXPR} AS neg_signal,
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

// ─── Abuse Detail ─────────────────────────────────────────────────────────────

const ABUSE_MEANING: Record<string, string> = {
  // Hindi — Devanagari
  'चूतिया': 'Very strong profanity',
  'साले':   'Abusive insult (brother-in-law)',
  'साला':   'Abusive insult (brother-in-law)',
  'बेवकूफ': 'Idiot / Fool',
  'बमडा':   'Abusive slang',
  'चोर':    'Thief',
  'गंदी':   'Dirty / Filthy',
  'घटिया':  'Inferior / Low quality (rude)',
  'फ़ालतू': 'Useless / Worthless',
  'बदतमीज़ी': 'Rude behaviour',
  'कुत्ते हो': 'You are a dog (insult)',
  'स्कैम':   'Scam',
  // Hindi — Romanized
  'bevakuf':    'Idiot / Fool',
  'bevakoof':   'Idiot / Fool',
  'ullu':       'Owl (fool) — insult',
  'pagal':      'Crazy / Mad',
  'bakwass':    'Nonsense / Rubbish',
  'saala':      'Abusive insult',
  'saale':      'Abusive insult',
  'chutiya':    'Very strong profanity',
  'chor':       'Thief',
  'harami':     'Bastard',
  'kamina':     'Scoundrel',
  'gadha':      'Donkey (fool)',
  // English
  'fuck':       'Strong profanity',
  'fucking':    'Strong profanity',
  'Fuck':       'Strong profanity',
  'bullshit':   'Profanity / Nonsense',
  'bloody':     'Mild profanity',
  'bastard':    'Strong insult',
  'idiot':      'Fool / Stupid',
  'stupid':     'Foolish',
  'damn':       'Mild profanity',
  'shit':       'Profanity',
  'scammer':    'Fraudster',
  'scammo':     'Fraudster (slang)',
  'fraud':      'Fraudster / Cheat',
  'bogus':      'Fake / False',
  'cheat':      'Cheater',
  'man':        'Casual (context-dependent)',
  'crazy':      'Crazy / Mad',
  'third class':'Very low quality (insult)',
};

function abuseMeaning(word: string): string {
  return ABUSE_MEANING[word.trim()] ?? ABUSE_MEANING[word.trim().toLowerCase()] ?? '—';
}

export interface AbuseDetailRow {
  speaker:   'Agent' | 'Customer';
  lead_id:   string;
  agent_id:  string;
  word:      string;
  meaning:   string;
  scenario:  string;
  scenario1: string;
  date:      string;
  client_id: string;
}

export async function getAbuseDetail(filters: InboundQualityFilters): Promise<{ total: number; rows: AbuseDetailRow[] }> {
  const { startDate, endDate, clientId } = filters;
  const clientFilter = clientId ? ' AND q.ClientId = ?' : '';
  const params: (string | number)[] = [startDate, endDate, ...(clientId ? [clientId] : [])];

  const [agentRows, custRows] = await Promise.all([
    querySource<{ word: string; count: number; scenario: string; scenario1: string; user: string; lead_id: string; date: string; client_id: string }>(`
      SELECT
        TRIM(q.agent_hindi_cuss_words)  AS word,
        q.agent_hindi_cuss_count        AS count,
        COALESCE(NULLIF(TRIM(q.scenario),  ''), 'Unknown') AS scenario,
        COALESCE(NULLIF(TRIM(q.scenario1), ''), 'Unknown') AS scenario1,
        q.User                          AS user,
        COALESCE(q.lead_id, '')         AS lead_id,
        DATE_FORMAT(q.CallDate, '%Y-%m-%d %H:%i') AS date,
        q.ClientId                      AS client_id
      FROM db_audit.call_quality_assessment q
      WHERE q.CallDate BETWEEN ? AND ?
        AND q.quality_percentage IS NOT NULL
        ${clientFilter}
        AND q.agent_hindi_cuss_count > 0
        AND q.agent_hindi_cuss_words IS NOT NULL
        AND TRIM(q.agent_hindi_cuss_words) != ''
      UNION ALL
      SELECT
        TRIM(q.agent_english_cuss_words) AS word,
        q.agent_english_cuss_count       AS count,
        COALESCE(NULLIF(TRIM(q.scenario),  ''), 'Unknown') AS scenario,
        COALESCE(NULLIF(TRIM(q.scenario1), ''), 'Unknown') AS scenario1,
        q.User AS user,
        COALESCE(q.lead_id, '') AS lead_id,
        DATE_FORMAT(q.CallDate, '%Y-%m-%d %H:%i') AS date,
        q.ClientId AS client_id
      FROM db_audit.call_quality_assessment q
      WHERE q.CallDate BETWEEN ? AND ?
        AND q.quality_percentage IS NOT NULL
        ${clientFilter}
        AND q.agent_english_cuss_count > 0
        AND q.agent_english_cuss_words IS NOT NULL
        AND TRIM(q.agent_english_cuss_words) != ''
      ORDER BY date DESC
    `, [...params, ...params]),

    querySource<{ word: string; count: number; scenario: string; scenario1: string; user: string; lead_id: string; date: string; client_id: string }>(`
      SELECT
        TRIM(q.customer_hindi_cuss_words)  AS word,
        q.customer_hindi_cuss_count        AS count,
        COALESCE(NULLIF(TRIM(q.scenario),  ''), 'Unknown') AS scenario,
        COALESCE(NULLIF(TRIM(q.scenario1), ''), 'Unknown') AS scenario1,
        q.User AS user,
        COALESCE(q.lead_id, '') AS lead_id,
        DATE_FORMAT(q.CallDate, '%Y-%m-%d %H:%i') AS date,
        q.ClientId AS client_id
      FROM db_audit.call_quality_assessment q
      WHERE q.CallDate BETWEEN ? AND ?
        AND q.quality_percentage IS NOT NULL
        ${clientFilter}
        AND q.customer_hindi_cuss_count > 0
        AND q.customer_hindi_cuss_words IS NOT NULL
        AND TRIM(q.customer_hindi_cuss_words) != ''
      UNION ALL
      SELECT
        TRIM(q.customer_english_cuss_words) AS word,
        q.customer_english_cuss_count       AS count,
        COALESCE(NULLIF(TRIM(q.scenario),  ''), 'Unknown') AS scenario,
        COALESCE(NULLIF(TRIM(q.scenario1), ''), 'Unknown') AS scenario1,
        q.User AS user,
        COALESCE(q.lead_id, '') AS lead_id,
        DATE_FORMAT(q.CallDate, '%Y-%m-%d %H:%i') AS date,
        q.ClientId AS client_id
      FROM db_audit.call_quality_assessment q
      WHERE q.CallDate BETWEEN ? AND ?
        AND q.quality_percentage IS NOT NULL
        ${clientFilter}
        AND q.customer_english_cuss_count > 0
        AND q.customer_english_cuss_words IS NOT NULL
        AND TRIM(q.customer_english_cuss_words) != ''
      ORDER BY date DESC
    `, [...params, ...params]),
  ]);

  const rows: AbuseDetailRow[] = [
    ...agentRows.map(r => ({
      speaker:   'Agent' as const,
      lead_id:   String(r.lead_id ?? ''),
      agent_id:  String(r.user),
      word:      String(r.word),
      meaning:   abuseMeaning(String(r.word)),
      scenario:  String(r.scenario),
      scenario1: String(r.scenario1),
      date:      String(r.date),
      client_id: String(r.client_id),
    })),
    ...custRows.map(r => ({
      speaker:   'Customer' as const,
      lead_id:   String(r.lead_id ?? ''),
      agent_id:  String(r.user),
      word:      String(r.word),
      meaning:   abuseMeaning(String(r.word)),
      scenario:  String(r.scenario),
      scenario1: String(r.scenario1),
      date:      String(r.date),
      client_id: String(r.client_id),
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return { total: rows.length, rows };
}

// ─── Threat / Frustration Detail ─────────────────────────────────────────────

export interface NegCallDetailRow {
  lead_id:   string;
  agent_id:  string;
  word:      string;
  scenario:  string;
  scenario1: string;
  date:      string;
  client_id: string;
}

export async function getNegSignalDetail(
  filters: InboundQualityFilters,
  signal: 'Threat' | 'Frustration',
): Promise<{ total: number; rows: NegCallDetailRow[] }> {
  const { startDate, endDate, clientId } = filters;
  const clientFilter = clientId ? ' AND q.ClientId = ?' : '';
  const params: (string | number)[] = [
    startDate, endDate,
    ...(clientId ? [clientId] : []),
    signal,
  ];

  const rows = await querySource<{
    lead_id: string; agent_id: string; word: string;
    scenario: string; scenario1: string; date: string; client_id: string;
  }>(`
    SELECT
      COALESCE(q.lead_id, '') AS lead_id,
      q.User                  AS agent_id,
      q.top_negative_words    AS word,
      COALESCE(NULLIF(TRIM(q.scenario),  ''), 'Unknown') AS scenario,
      COALESCE(NULLIF(TRIM(q.scenario1), ''), 'Unknown') AS scenario1,
      DATE_FORMAT(q.CallDate, '%Y-%m-%d %H:%i') AS date,
      q.ClientId              AS client_id
    FROM db_audit.call_quality_assessment q
    WHERE q.CallDate BETWEEN ? AND ?
      AND q.quality_percentage IS NOT NULL
      ${clientFilter}
      AND q.top_negative_words IS NOT NULL
      AND TRIM(q.top_negative_words) != ''
      AND LOWER(TRIM(q.top_negative_words)) != 'none'
      AND (${NEG_CAT_EXPR}) = ?
    ORDER BY q.CallDate DESC
    LIMIT 500
  `, params);

  return {
    total: rows.length,
    rows: rows.map(r => ({
      lead_id:   String(r.lead_id),
      agent_id:  String(r.agent_id),
      word:      String(r.word),
      scenario:  String(r.scenario),
      scenario1: String(r.scenario1),
      date:      String(r.date),
      client_id: String(r.client_id),
    })),
  };
}

// ─── Potential Scam Detail ────────────────────────────────────────────────────

const SCAM_CONDITION = `(
  LOWER(TRIM(q.financial_fraud)) = 'yes'
  OR LOWER(q.top_negative_words) LIKE '%scam%'
  OR LOWER(q.top_negative_words) LIKE '%fraud%'
  OR LOWER(q.top_negative_words) LIKE '%cheat%'
  OR LOWER(q.top_negative_words) LIKE '%fake%'
  OR LOWER(q.top_negative_words) LIKE '%loot%'
)`;

export interface ScamFlagCounts {
  financial_fraud: number;
  scam_words:      number;
}

export interface ScamWordRow {
  word:      string;
  scenario:  string;
  scenario1: string;
  count:     number;
  pct:       number;
  lead_id?:  string;
  agent_id?: string;
  date?:     string;
  flag?:     string;
}

export interface PotentialScamDetail {
  flags:    ScamFlagCounts;
  wordRows: ScamWordRow[];
}

export async function getPotentialScamsDetail(filters: InboundQualityFilters): Promise<PotentialScamDetail> {
  const { startDate, endDate, clientId } = filters;
  const clientFilter = clientId ? ' AND q.ClientId = ?' : '';
  const params: (string | number)[] = [startDate, endDate, ...(clientId ? [clientId] : [])];

  const [flagRows, wordRows] = await Promise.all([
    querySource<{ financial_fraud: string; scam_words: string }>(`
      SELECT
        SUM(CASE WHEN LOWER(TRIM(q.financial_fraud)) = 'yes' THEN 1 ELSE 0 END) AS financial_fraud,
        SUM(CASE WHEN
          LOWER(TRIM(q.financial_fraud)) != 'yes'
          AND (
            LOWER(q.top_negative_words) LIKE '%scam%'  OR
            LOWER(q.top_negative_words) LIKE '%fraud%' OR
            LOWER(q.top_negative_words) LIKE '%cheat%' OR
            LOWER(q.top_negative_words) LIKE '%fake%'  OR
            LOWER(q.top_negative_words) LIKE '%loot%'
          )
        THEN 1 ELSE 0 END) AS scam_words
      FROM db_audit.call_quality_assessment q
      WHERE q.CallDate BETWEEN ? AND ?
        AND q.quality_percentage IS NOT NULL
        ${clientFilter}
        AND ${SCAM_CONDITION}
    `, params),

    querySource<{ lead_id: string; agent_id: string; word: string; scenario: string; scenario1: string; date: string; flag: string }>(`
      SELECT
        COALESCE(q.lead_id, '')       AS lead_id,
        q.User                         AS agent_id,
        COALESCE(NULLIF(TRIM(q.top_negative_words), ''), '—') AS word,
        COALESCE(NULLIF(TRIM(q.scenario),  ''), 'Unknown')    AS scenario,
        COALESCE(NULLIF(TRIM(q.scenario1), ''), 'Unknown')    AS scenario1,
        DATE_FORMAT(q.CallDate, '%Y-%m-%d %H:%i')             AS date,
        CASE WHEN LOWER(TRIM(q.financial_fraud)) = 'yes'
             THEN 'Financial Fraud'
             ELSE 'Scam' END AS flag
      FROM db_audit.call_quality_assessment q
      WHERE q.CallDate BETWEEN ? AND ?
        AND q.quality_percentage IS NOT NULL
        ${clientFilter}
        AND ${SCAM_CONDITION}
      ORDER BY q.CallDate DESC
      LIMIT 300
    `, params),
  ]);

  const f = flagRows[0] ?? { financial_fraud: '0', scam_words: '0' };

  return {
    flags: {
      financial_fraud: Number(f.financial_fraud),
      scam_words:      Number(f.scam_words),
    },
    wordRows: wordRows.map(r => ({
      word:      String(r.word),
      scenario:  String(r.scenario),
      scenario1: String(r.scenario1),
      count:     1,
      pct:       0,
      lead_id:   String(r.lead_id),
      agent_id:  String(r.agent_id),
      date:      String(r.date),
      flag:      String(r.flag),
    })),
  };
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
      SELECT COALESCE(am.AgentName, q.User) AS agent_name, COUNT(*) AS audit_count,
        SUM(CASE WHEN q.quality_percentage=0 THEN 1 ELSE 0 END) AS fatal_count,
        ROUND(SUM(CASE WHEN q.quality_percentage=0 THEN 1 ELSE 0 END)*100.0/COUNT(*), 1) AS fatal_pct
      FROM db_audit.call_quality_assessment q
      LEFT JOIN Shivamgiri.AgentMaster am ON am.MasId = q.User COLLATE utf8mb4_unicode_ci
      WHERE q.CallDate BETWEEN ? AND ? AND q.quality_percentage IS NOT NULL
        AND q.User IS NOT NULL AND TRIM(q.User) != '' ${clientFilter}
      GROUP BY q.User, am.AgentName ORDER BY fatal_count DESC, fatal_pct DESC LIMIT 5
    `, params),

    querySource<{
      call_date: string; total_count: number; total_fatal: number;
      query_fatal: number; complaint_fatal: number; request_fatal: number;
    }>(`
      SELECT
        DATE_FORMAT(q.CallDate,'%Y-%m-%d') AS call_date,
        COUNT(*) AS total_count,
        SUM(CASE WHEN q.quality_percentage=0 AND q.scenario IS NOT NULL AND TRIM(q.scenario)!='' THEN 1 ELSE 0 END) AS total_fatal,
        SUM(CASE WHEN TRIM(q.scenario)='Query'     AND q.quality_percentage=0 THEN 1 ELSE 0 END) AS query_fatal,
        SUM(CASE WHEN TRIM(q.scenario)='Complaint' AND q.quality_percentage=0 THEN 1 ELSE 0 END) AS complaint_fatal,
        SUM(CASE WHEN TRIM(q.scenario)='Request'   AND q.quality_percentage=0 THEN 1 ELSE 0 END) AS request_fatal
      FROM db_audit.call_quality_assessment q
      WHERE q.CallDate BETWEEN ? AND ? AND q.quality_percentage IS NOT NULL
        AND q.scenario IS NOT NULL AND TRIM(q.scenario) != ''
        ${clientFilter}
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
        COALESCE(am.AgentName, q.User) AS agent_name, COUNT(*) AS audit_count,
        ROUND(AVG(q.quality_percentage),1) AS cq_score,
        SUM(CASE WHEN q.quality_percentage=0 THEN 1 ELSE 0 END) AS fatal_count,
        ROUND(SUM(CASE WHEN q.quality_percentage=0 THEN 1 ELSE 0 END)*100.0/COUNT(*),1) AS fatal_pct,
        ROUND(SUM(CASE WHEN q.quality_percentage>0 AND q.quality_percentage<85  THEN 1 ELSE 0 END)*100.0/COUNT(*),1) AS below_avg_pct,
        ROUND(SUM(CASE WHEN q.quality_percentage>=85 AND q.quality_percentage<90 THEN 1 ELSE 0 END)*100.0/COUNT(*),1) AS avg_pct,
        ROUND(SUM(CASE WHEN q.quality_percentage>=90 AND q.quality_percentage<98 THEN 1 ELSE 0 END)*100.0/COUNT(*),1) AS good_pct,
        ROUND(SUM(CASE WHEN q.quality_percentage>=98  THEN 1 ELSE 0 END)*100.0/COUNT(*),1) AS excellent_pct
      FROM db_audit.call_quality_assessment q
      LEFT JOIN Shivamgiri.AgentMaster am ON am.MasId = q.User COLLATE utf8mb4_unicode_ci
      WHERE q.CallDate BETWEEN ? AND ? AND q.quality_percentage IS NOT NULL
        AND q.User IS NOT NULL AND TRIM(q.User) != '' ${clientFilter}
      GROUP BY q.User, am.AgentName ORDER BY fatal_count DESC, fatal_pct DESC
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
  ELSE COALESCE(q.call_answered_within_5_seconds,0) END
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
      COALESCE(am.AgentName, q.User) AS agent_name,
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
    LEFT JOIN Shivamgiri.AgentMaster am ON am.MasId = q.User COLLATE utf8mb4_unicode_ci
    WHERE q.CallDate BETWEEN ? AND ?
      AND q.quality_percentage IS NOT NULL
      AND q.User IS NOT NULL AND TRIM(q.User) != ''
      ${extra}
    GROUP BY q.User, q.Campaign, am.AgentName
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

// ─── Agent Guidance ───────────────────────────────────────────────────────────

const GUIDANCE_PARAMS = [
  { col: 'call_answered_within_5_seconds',     label: 'Call Answered Within 5s',     cat: 'Opening Skill' },
  { col: 'customer_concern_acknowledged',      label: 'Customer Concern Acknowledged', cat: 'Opening Skill' },
  { col: 'professionalism_maintained',         label: 'Professionalism Maintained',   cat: 'Soft Skill' },
  { col: 'assurance_or_appreciation_provided', label: 'Assurance / Appreciation',     cat: 'Soft Skill' },
  { col: 'pronunciation_and_clarity',          label: 'Pronunciation & Clarity',      cat: 'Soft Skill' },
  { col: 'enthusiasm_and_no_fumbling',         label: 'Enthusiasm & No Fumbling',     cat: 'Soft Skill' },
  { col: 'active_listening',                   label: 'Active Listening',             cat: 'Soft Skill' },
  { col: 'politeness_and_no_sarcasm',          label: 'Politeness & No Sarcasm',      cat: 'Soft Skill' },
  { col: 'proper_grammar',                     label: 'Proper Grammar',               cat: 'Soft Skill' },
  { col: 'accurate_issue_probing',             label: 'Accurate Issue Probing',       cat: 'Soft Skill' },
  { col: 'proper_hold_procedure',              label: 'Proper Hold Procedure',        cat: 'Hold Procedure' },
  { col: 'proper_transfer_and_language',       label: 'Proper Transfer & Language',   cat: 'Hold Procedure' },
  { col: 'dead_air_under_10_seconds',          label: 'Dead Air Under 10s',           cat: 'Hold Procedure' },
  { col: 'case_escalated_correctly',           label: 'Case Escalated Correctly',     cat: 'Resolution' },
  { col: 'address_recorded_completely',        label: 'Address Recorded Completely',  cat: 'Resolution' },
  { col: 'correct_and_complete_information',   label: 'Correct & Complete Info',      cat: 'Resolution' },
  { col: 'upselling_or_offers_suggested',      label: 'Upselling / Offers Suggested', cat: 'Resolution' },
  { col: 'further_assistance_offered',         label: 'Further Assistance Offered',   cat: 'Closing' },
  { col: 'proper_call_closure',                label: 'Proper Call Closure',          cat: 'Closing' },
] as const;

export interface AgentGuidanceParam {
  column: string; label: string; pct: number; team_avg: number; category: string;
}
export interface AgentGuidanceAgent {
  agent_id: string; agent_name: string; audit_count: number; cq_score: number;
  params: AgentGuidanceParam[];
}
export interface AgentGuidanceResult {
  agents: AgentGuidanceAgent[];
  team_params: { column: string; label: string; avg: number; category: string }[];
}

export async function getAgentGuidance(filters: InboundQualityFilters): Promise<AgentGuidanceResult> {
  const { startDate, endDate, clientId } = filters;
  const clientFilter = clientId ? 'AND q.ClientId = ?' : '';
  const baseParams: (string | number)[] = clientId
    ? [startDate, endDate, clientId]
    : [startDate, endDate];

  const paramSelect = GUIDANCE_PARAMS.map(p =>
    `ROUND(100.0 * SUM(CASE WHEN COALESCE(q.${p.col},0) = 1 THEN 1 ELSE 0 END) / COUNT(*), 1) AS ${p.col}`
  ).join(',\n      ');

  const [teamRows, agentRows] = await Promise.all([
    querySource<Record<string, unknown>>(`
      SELECT ${paramSelect}
      FROM db_audit.call_quality_assessment q
      WHERE q.CallDate BETWEEN ? AND ?
        AND q.quality_percentage IS NOT NULL
        ${clientFilter}
    `, baseParams),
    querySource<Record<string, unknown>>(`
      SELECT
        q.User AS agent_id,
        COALESCE(am.AgentName, q.User) AS agent_name,
        COUNT(*) AS audit_count,
        ROUND(AVG(q.quality_percentage), 1) AS cq_score,
        ${paramSelect}
      FROM db_audit.call_quality_assessment q
      LEFT JOIN Shivamgiri.AgentMaster am ON am.MasId = q.User COLLATE utf8mb4_unicode_ci
      WHERE q.CallDate BETWEEN ? AND ?
        AND q.quality_percentage IS NOT NULL
        AND q.User IS NOT NULL AND TRIM(q.User) != ''
        ${clientFilter}
      GROUP BY q.User, am.AgentName
      HAVING COUNT(*) >= 3
      ORDER BY cq_score ASC
      LIMIT 5
    `, baseParams),
  ]);

  const teamRow = teamRows[0] ?? {};
  const teamAvg: Record<string, number> = {};
  for (const p of GUIDANCE_PARAMS) teamAvg[p.col] = Number(teamRow[p.col] ?? 0);

  const agents: AgentGuidanceAgent[] = agentRows.map(r => ({
    agent_id:    String(r.agent_id),
    agent_name:  String(r.agent_name),
    audit_count: Number(r.audit_count),
    cq_score:    Number(r.cq_score ?? 0),
    params: GUIDANCE_PARAMS.map(p => ({
      column:   p.col,
      label:    p.label,
      pct:      Number(r[p.col] ?? 0),
      team_avg: teamAvg[p.col],
      category: p.cat,
    })),
  }));

  const team_params = GUIDANCE_PARAMS.map(p => ({
    column: p.col, label: p.label, avg: teamAvg[p.col], category: p.cat,
  })).sort((a, b) => a.avg - b.avg);

  return { agents, team_params };
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
          AND quality_percentage IS NOT NULL
        GROUP BY MobileNo
        HAVING COUNT(*) > 1
      ) r ON q.MobileNo = r.MobileNo
      WHERE q.CallDate BETWEEN ? AND ? ${mainClient}
        AND q.MobileNo IS NOT NULL AND TRIM(q.MobileNo) != ''
        AND q.quality_percentage IS NOT NULL
      GROUP BY DATE_FORMAT(q.CallDate, '%Y-%m-%d')
      ORDER BY call_date ASC
    `, [...base, ...base]),

    // Grand totals:
    //   grand_unique = COUNT(DISTINCT MobileNo)        — first-occurrence rows (like COUNTIF=1)
    //   grand_repeat = COUNT(*) - COUNT(DISTINCT MobileNo) — subsequent calls (like COUNTIF>1)
    querySource<{ grand_unique: number; grand_repeat: number }>(`
      SELECT
        COUNT(DISTINCT MobileNo)                       AS grand_unique,
        COUNT(*) - COUNT(DISTINCT MobileNo)            AS grand_repeat
      FROM db_audit.call_quality_assessment
      WHERE CallDate BETWEEN ? AND ? ${subClient}
        AND MobileNo IS NOT NULL AND TRIM(MobileNo) != ''
        AND quality_percentage IS NOT NULL
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
        AND q.quality_percentage IS NOT NULL
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

// ─── Repeat Call Detail (pivot cell drill-down) ───────────────────────────────

export interface RepeatCallDetailRow {
  CallDate:           string;
  scenario:           string;
  scenario1:          string;
  quality_percentage: number;
}

export async function getRepeatCallDetail(
  filters: InboundQualityFilters & { mobileNo: string; callDate?: string }
): Promise<RepeatCallDetailRow[]> {
  const { startDate, endDate, clientId, mobileNo, callDate } = filters;
  const params: (string | number)[] = [startDate, endDate, mobileNo];
  let extra = '';
  if (clientId) { extra += ' AND q.ClientId = ?'; params.push(clientId); }
  if (callDate) { extra += ' AND DATE(q.CallDate) = ?'; params.push(callDate); }

  const rows = await querySource<{
    CallDate: string; scenario: string; scenario1: string; quality_percentage: number;
  }>(`
    SELECT
      DATE_FORMAT(q.CallDate, '%Y-%m-%d')                         AS CallDate,
      COALESCE(NULLIF(TRIM(q.scenario),  ''), 'Unknown')          AS scenario,
      COALESCE(NULLIF(TRIM(q.scenario1), ''), 'Unknown')          AS scenario1,
      COALESCE(q.quality_percentage, 0)                           AS quality_percentage
    FROM db_audit.call_quality_assessment q
    WHERE q.CallDate BETWEEN ? AND ?
      AND q.MobileNo = ?
      AND q.quality_percentage IS NOT NULL
      ${extra}
    ORDER BY q.CallDate ASC
  `, params);

  return rows.map(r => ({
    CallDate:           String(r.CallDate),
    scenario:           String(r.scenario),
    scenario1:          String(r.scenario1),
    quality_percentage: Number(r.quality_percentage),
  }));
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

// ─── Agent Audit Band Summary (TQ / MQ / BQ counts per agent) ────────────────

export interface AgentAuditBandRow {
  agent:       string;
  audit_count: number;
  cq_score:    number;
  fatal_count: number;
  fatal_pct:   number;
  tq_count:    number;
  mq_count:    number;
  bq_count:    number;
}

// ─── Score Band Detail (agent × scenario breakdown for a given score band) ────

export interface BandDetailRow {
  agent:     string;
  scenario:  string;
  count:     number;
  avg_score: number;
}

export async function getBandDetail(
  filters: InboundQualityFilters & { band?: string; agentId?: string }
): Promise<BandDetailRow[]> {
  const { startDate, endDate, clientId, band, agentId } = filters;
  const params: (string | number)[] = [startDate, endDate];

  const bandCondition =
    band === 'excellent'     ? 'q.quality_percentage >= 98'
    : band === 'good'        ? 'q.quality_percentage >= 90 AND q.quality_percentage < 98'
    : band === 'average'     ? 'q.quality_percentage >= 85 AND q.quality_percentage < 90'
    : band === 'below_average' ? 'q.quality_percentage > 0 AND q.quality_percentage < 85'
    : band === 'fatal'       ? 'q.quality_percentage = 0'
    : band === 'no_fatal'    ? 'q.quality_percentage > 0'
    : 'q.quality_percentage IS NOT NULL';

  let extra = '';
  if (clientId) { extra += ' AND q.ClientId = ?'; params.push(clientId); }
  if (agentId)  { extra += ' AND TRIM(q.User) = ?'; params.push(agentId); }

  const rows = await querySource<{
    agent: string; scenario: string; count: number; avg_score: number | null;
  }>(`
    SELECT
      COALESCE(NULLIF(TRIM(q.User),     ''), 'Unknown') AS agent,
      COALESCE(NULLIF(TRIM(q.scenario), ''), 'Unknown') AS scenario,
      COUNT(*)                                           AS count,
      ROUND(AVG(q.quality_percentage),  1)              AS avg_score
    FROM db_audit.call_quality_assessment q
    WHERE q.CallDate BETWEEN ? AND ?
      AND q.quality_percentage IS NOT NULL
      AND (${bandCondition})
      ${extra}
    GROUP BY q.User, q.scenario
    ORDER BY count DESC
    LIMIT 300
  `, params);

  return rows.map(r => ({
    agent:     String(r.agent),
    scenario:  String(r.scenario),
    count:     Number(r.count),
    avg_score: parseFloat(String(r.avg_score ?? 0)) || 0,
  }));
}

export async function getAgentAuditBandSummary(filters: InboundQualityFilters): Promise<AgentAuditBandRow[]> {
  const { startDate, endDate, clientId } = filters;
  const params: (string | number)[] = [startDate, endDate];
  let extra = '';
  if (clientId) { extra += ' AND q.ClientId = ?'; params.push(clientId); }

  const rows = await querySource<{
    agent: string; audit_count: number; cq_score: number | null;
    fatal_count: number; fatal_pct: number | null;
    tq_count: number; mq_count: number; bq_count: number;
  }>(`
    SELECT
      COALESCE(am.AgentName, q.User)                                        AS agent,
      COUNT(*)                                                                                     AS audit_count,
      ROUND(AVG(q.quality_percentage), 1)                                                          AS cq_score,
      SUM(CASE WHEN q.quality_percentage = 0  THEN 1 ELSE 0 END)                                 AS fatal_count,
      ROUND(SUM(CASE WHEN q.quality_percentage = 0 THEN 1 ELSE 0 END)*100.0/NULLIF(COUNT(*),0), 1) AS fatal_pct,
      SUM(CASE WHEN q.quality_percentage >= 80 THEN 1 ELSE 0 END)                                AS tq_count,
      SUM(CASE WHEN q.quality_percentage >= 60 AND q.quality_percentage < 80 THEN 1 ELSE 0 END)   AS mq_count,
      SUM(CASE WHEN q.quality_percentage >  0  AND q.quality_percentage < 60 THEN 1 ELSE 0 END)   AS bq_count
    FROM db_audit.call_quality_assessment q
    LEFT JOIN Shivamgiri.AgentMaster am ON am.MasId = q.User COLLATE utf8mb4_unicode_ci
    WHERE q.CallDate BETWEEN ? AND ? ${extra}
    GROUP BY q.User, am.AgentName
    ORDER BY cq_score DESC
  `, params);

  return rows.map(r => ({
    agent:       String(r.agent),
    audit_count: Number(r.audit_count) || 0,
    cq_score:    parseFloat(String(r.cq_score ?? 0)) || 0,
    fatal_count: Number(r.fatal_count) || 0,
    fatal_pct:   parseFloat(String(r.fatal_pct ?? 0)) || 0,
    tq_count:    Number(r.tq_count) || 0,
    mq_count:    Number(r.mq_count) || 0,
    bq_count:    Number(r.bq_count) || 0,
  }));
}

// ─── Raw Data Export ──────────────────────────────────────────────────────────

export interface RawDataRow {
  CallDate: string;
  User: string;
  ClientId: string;
  MobileNo: string;
  scenario: string;
  scenario1: string;
  quality_percentage: number;
  top_negative_words: string;
  top_positive_words: string;
  Transcribe_Text: string;
  call_answered_within_5_seconds: string;
  customer_concern_acknowledged: string;
  professionalism_maintained: string;
  assurance_or_appreciation_provided: string;
  pronunciation_and_clarity: string;
  enthusiasm_and_no_fumbling: string;
  active_listening: string;
  politeness_and_no_sarcasm: string;
  proper_grammar: string;
  accurate_issue_probing: string;
  proper_hold_procedure: string;
  proper_transfer_and_language: string;
  dead_air_under_10_seconds: string;
  case_escalated_correctly: string;
  address_recorded_completely: string;
  correct_and_complete_information: string;
  upselling_or_offers_suggested: string;
  further_assistance_offered: string;
  proper_call_closure: string;
  express_empathy: string;
}

export async function getRawData(filters: InboundQualityFilters): Promise<RawDataRow[]> {
  const { startDate, endDate, clientId } = filters;
  const params: (string | number)[] = [startDate, endDate];
  const extra = clientId ? ' AND q.ClientId = ?' : '';
  if (clientId) params.push(clientId);

  const rows = await querySource<RawDataRow>(`
    SELECT
      DATE_FORMAT(q.CallDate, '%Y-%m-%d')                         AS CallDate,
      COALESCE(NULLIF(TRIM(q.User),''), 'Unknown')                AS User,
      COALESCE(q.ClientId, '')                                    AS ClientId,
      COALESCE(q.MobileNo, '')                                    AS MobileNo,
      COALESCE(NULLIF(TRIM(q.scenario),''), 'Unknown')            AS scenario,
      COALESCE(NULLIF(TRIM(q.scenario1),''), 'Unknown')           AS scenario1,
      COALESCE(q.quality_percentage, 0)                           AS quality_percentage,
      COALESCE(q.top_negative_words, '')                          AS top_negative_words,
      COALESCE(q.top_positive_words, '')                          AS top_positive_words,
      COALESCE(q.Transcribe_Text, '')                             AS Transcribe_Text,
      COALESCE(q.call_answered_within_5_seconds, '')              AS call_answered_within_5_seconds,
      COALESCE(q.customer_concern_acknowledged, '')               AS customer_concern_acknowledged,
      COALESCE(q.professionalism_maintained, '')                  AS professionalism_maintained,
      COALESCE(q.assurance_or_appreciation_provided, '')          AS assurance_or_appreciation_provided,
      COALESCE(q.pronunciation_and_clarity, '')                   AS pronunciation_and_clarity,
      COALESCE(q.enthusiasm_and_no_fumbling, '')                  AS enthusiasm_and_no_fumbling,
      COALESCE(q.active_listening, '')                            AS active_listening,
      COALESCE(q.politeness_and_no_sarcasm, '')                   AS politeness_and_no_sarcasm,
      COALESCE(q.proper_grammar, '')                              AS proper_grammar,
      COALESCE(q.accurate_issue_probing, '')                      AS accurate_issue_probing,
      COALESCE(q.proper_hold_procedure, '')                       AS proper_hold_procedure,
      COALESCE(q.proper_transfer_and_language, '')                AS proper_transfer_and_language,
      COALESCE(q.dead_air_under_10_seconds, '')                   AS dead_air_under_10_seconds,
      COALESCE(q.case_escalated_correctly, '')                    AS case_escalated_correctly,
      COALESCE(q.address_recorded_completely, '')                 AS address_recorded_completely,
      COALESCE(q.correct_and_complete_information, '')            AS correct_and_complete_information,
      COALESCE(q.upselling_or_offers_suggested, '')               AS upselling_or_offers_suggested,
      COALESCE(q.further_assistance_offered, '')                  AS further_assistance_offered,
      COALESCE(q.proper_call_closure, '')                         AS proper_call_closure,
      COALESCE(q.express_empathy, '')                             AS express_empathy
    FROM db_audit.call_quality_assessment q
    WHERE q.CallDate BETWEEN ? AND ?
      AND q.quality_percentage IS NOT NULL
      ${extra}
    ORDER BY q.CallDate DESC
    LIMIT 10000
  `, params);

  return rows.map(r => ({
    CallDate:                           String(r.CallDate),
    User:                               String(r.User),
    ClientId:                           String(r.ClientId),
    MobileNo:                           String(r.MobileNo),
    scenario:                           String(r.scenario),
    scenario1:                          String(r.scenario1),
    quality_percentage:                 Number(r.quality_percentage),
    top_negative_words:                 String(r.top_negative_words),
    top_positive_words:                 String(r.top_positive_words),
    Transcribe_Text:                    String(r.Transcribe_Text),
    call_answered_within_5_seconds:     String(r.call_answered_within_5_seconds),
    customer_concern_acknowledged:      String(r.customer_concern_acknowledged),
    professionalism_maintained:         String(r.professionalism_maintained),
    assurance_or_appreciation_provided: String(r.assurance_or_appreciation_provided),
    pronunciation_and_clarity:          String(r.pronunciation_and_clarity),
    enthusiasm_and_no_fumbling:         String(r.enthusiasm_and_no_fumbling),
    active_listening:                   String(r.active_listening),
    politeness_and_no_sarcasm:          String(r.politeness_and_no_sarcasm),
    proper_grammar:                     String(r.proper_grammar),
    accurate_issue_probing:             String(r.accurate_issue_probing),
    proper_hold_procedure:              String(r.proper_hold_procedure),
    proper_transfer_and_language:       String(r.proper_transfer_and_language),
    dead_air_under_10_seconds:          String(r.dead_air_under_10_seconds),
    case_escalated_correctly:           String(r.case_escalated_correctly),
    address_recorded_completely:        String(r.address_recorded_completely),
    correct_and_complete_information:   String(r.correct_and_complete_information),
    upselling_or_offers_suggested:      String(r.upselling_or_offers_suggested),
    further_assistance_offered:         String(r.further_assistance_offered),
    proper_call_closure:                String(r.proper_call_closure),
    express_empathy:                    String(r.express_empathy),
  }));
}

// ─── Agent Master ──────────────────────────────────────────────────────────────

export interface AgentMasterRow {
  masId:     string;
  agentName: string;
  lob:       string;
}

export async function getAgentMaster(): Promise<AgentMasterRow[]> {
  const rows = await querySource<{ MasId: string; AgentName: string; Lob: string }>(`
    SELECT MasId, AgentName, Lob
    FROM shivamgiri.AgentsMaster
    ORDER BY AgentName ASC
  `);
  return rows.map(r => ({
    masId:     String(r.MasId),
    agentName: String(r.AgentName),
    lob:       String(r.Lob ?? ''),
  }));
}

export interface MissingAgentRow {
  masId:       string;
  audit_count: number;
}

export async function getMissingAgents(filters: InboundQualityFilters): Promise<MissingAgentRow[]> {
  const { startDate, endDate, clientId } = filters;
  const params: (string | number)[] = [startDate, endDate];
  const extra = clientId ? ' AND q.ClientId = ?' : '';
  if (clientId) params.push(clientId);

  const rows = await querySource<{ masId: string; audit_count: number }>(`
    SELECT
      q.User                AS masId,
      COUNT(*)              AS audit_count
    FROM db_audit.call_quality_assessment q
    LEFT JOIN shivamgiri.AgentsMaster am ON am.MasId = q.User
    WHERE q.CallDate BETWEEN ? AND ?
      AND q.quality_percentage IS NOT NULL
      AND q.User IS NOT NULL AND TRIM(q.User) != ''
      AND am.MasId IS NULL
      ${extra}
    GROUP BY q.User
    ORDER BY audit_count DESC
  `, params);

  return rows.map(r => ({
    masId:       String(r.masId),
    audit_count: Number(r.audit_count),
  }));
}

export async function insertAgentMaster(data: {
  masId: string; agentName: string; lob: string; process?: string;
}): Promise<void> {
  await querySource(`
    INSERT INTO shivamgiri.AgentsMaster (MasId, AgentName, Lob, CreatedAt)
    VALUES (?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE AgentName = VALUES(AgentName), Lob = VALUES(Lob)
  `, [data.masId, data.agentName, data.lob]);
}

// ─── TNI Detection Analysis ───────────────────────────────────────────────────

export interface TNIAgentRow {
  agent_id:          string;
  audit_count:       number;
  soft_skills:       number;
  process_knowledge: number;
  communication:     number;
  tni_score:         number;
}

export interface TNIWeekRow {
  agent_id:          string;
  week_label:        string;
  soft_skills:       number;
  process_knowledge: number;
  communication:     number;
}

export interface TNISummary {
  active_agents:          number;
  total_audits:           number;
  avg_soft_skills:        number;
  avg_process_knowledge:  number;
  avg_communication:      number;
}

export interface TNIResult {
  summary: TNISummary;
  agents:  TNIAgentRow[];
  weeks:   TNIWeekRow[];
}

const _TNI_SS = `ROUND(AVG(
    (COALESCE(q.customer_concern_acknowledged,0) +
     COALESCE(q.professionalism_maintained,0) +
     COALESCE(q.assurance_or_appreciation_provided,0) +
     COALESCE(q.express_empathy,0) +
     COALESCE(q.enthusiasm_and_no_fumbling,0) +
     COALESCE(q.active_listening,0) +
     COALESCE(q.politeness_and_no_sarcasm,0) +
     COALESCE(q.proper_call_closure,0)
    ) / 8.0 * 100
  ), 1)`;

const _TNI_PK = `ROUND(AVG(
    (COALESCE(q.accurate_issue_probing,0) +
     COALESCE(q.proper_hold_procedure,0) +
     COALESCE(q.proper_transfer_and_language,0) +
     COALESCE(q.address_recorded_completely,0) +
     COALESCE(q.correct_and_complete_information,0)
    ) / 5.0 * 100
  ), 1)`;

const _TNI_CS = `ROUND(AVG(
    (COALESCE(q.pronunciation_and_clarity,0) +
     COALESCE(q.proper_grammar,0)
    ) / 2.0 * 100
  ), 1)`;

export async function getTNIAnalysis(filters: InboundQualityFilters): Promise<TNIResult> {
  const { startDate, endDate, clientId } = filters;
  const params: (string | number)[] = [startDate, endDate];
  const extra = clientId ? ' AND q.ClientId = ?' : '';
  if (clientId) params.push(clientId);

  const agentRows = await querySource<{
    agent_id: string; audit_count: number;
    soft_skills: number | null; process_knowledge: number | null; communication: number | null;
  }>(`
    SELECT
      COALESCE(NULLIF(TRIM(q.User), ''), 'Unknown') AS agent_id,
      COUNT(*)                                       AS audit_count,
      ${_TNI_SS}                                     AS soft_skills,
      ${_TNI_PK}                                     AS process_knowledge,
      ${_TNI_CS}                                     AS communication
    FROM db_audit.call_quality_assessment q
    WHERE q.CallDate BETWEEN ? AND ?
      AND q.quality_percentage IS NOT NULL
      ${extra}
    GROUP BY q.User
    ORDER BY soft_skills ASC
  `, params);

  const weekRows = await querySource<{
    agent_id: string; week_label: string;
    soft_skills: number | null; process_knowledge: number | null; communication: number | null;
  }>(`
    SELECT
      COALESCE(NULLIF(TRIM(q.User), ''), 'Unknown') AS agent_id,
      CASE
        WHEN DAYOFMONTH(q.CallDate) BETWEEN 1  AND 7  THEN 'Week-1'
        WHEN DAYOFMONTH(q.CallDate) BETWEEN 8  AND 14 THEN 'Week-2'
        WHEN DAYOFMONTH(q.CallDate) BETWEEN 15 AND 21 THEN 'Week-3'
        ELSE 'Week-4'
      END                                            AS week_label,
      ${_TNI_SS}                                     AS soft_skills,
      ${_TNI_PK}                                     AS process_knowledge,
      ${_TNI_CS}                                     AS communication
    FROM db_audit.call_quality_assessment q
    WHERE q.CallDate BETWEEN ? AND ?
      AND q.quality_percentage IS NOT NULL
      ${extra}
    GROUP BY q.User, week_label
    ORDER BY q.User ASC, MIN(q.CallDate) ASC
  `, params);

  const agents = agentRows.map(r => {
    const ss   = Number(r.soft_skills       ?? 0);
    const pk   = Number(r.process_knowledge ?? 0);
    const comm = Number(r.communication     ?? 0);
    return {
      agent_id:          String(r.agent_id),
      audit_count:       Number(r.audit_count),
      soft_skills:       ss,
      process_knowledge: pk,
      communication:     comm,
      tni_score:         Math.round((ss * 8 + pk * 5 + comm * 2) / 15 * 10) / 10,
    };
  });

  const n = agents.length || 1;
  return {
    summary: {
      active_agents:         agents.length,
      total_audits:          agents.reduce((s, a) => s + a.audit_count, 0),
      avg_soft_skills:       Math.round(agents.reduce((s, a) => s + a.soft_skills,       0) / n * 10) / 10,
      avg_process_knowledge: Math.round(agents.reduce((s, a) => s + a.process_knowledge, 0) / n * 10) / 10,
      avg_communication:     Math.round(agents.reduce((s, a) => s + a.communication,     0) / n * 10) / 10,
    },
    agents,
    weeks: weekRows.map(r => ({
      agent_id:          String(r.agent_id),
      week_label:        String(r.week_label),
      soft_skills:       Number(r.soft_skills       ?? 0),
      process_knowledge: Number(r.process_knowledge ?? 0),
      communication:     Number(r.communication     ?? 0),
    })),
  };
}

// ─── TNI Agent Parameter Drill ────────────────────────────────────────────────

export interface TNIAgentParamRow {
  customer_concern_acknowledged:      number;
  professionalism_maintained:         number;
  assurance_or_appreciation_provided: number;
  express_empathy:                    number;
  enthusiasm_and_no_fumbling:         number;
  active_listening:                   number;
  politeness_and_no_sarcasm:          number;
  proper_call_closure:                number;
  accurate_issue_probing:             number;
  proper_hold_procedure:              number;
  proper_transfer_and_language:       number;
  address_recorded_completely:        number;
  correct_and_complete_information:   number;
  pronunciation_and_clarity:          number;
  proper_grammar:                     number;
}

export async function getTNIAgentParams(
  filters: InboundQualityFilters & { agentId: string }
): Promise<TNIAgentParamRow> {
  const { startDate, endDate, clientId, agentId } = filters;
  const params: (string | number)[] = [startDate, endDate, agentId];
  const extra = clientId ? ' AND q.ClientId = ?' : '';
  if (clientId) params.push(clientId);

  const [row] = await querySource<Record<string, number | null>>(`
    SELECT
      ROUND(AVG(COALESCE(q.customer_concern_acknowledged,0))      * 100, 1) AS customer_concern_acknowledged,
      ROUND(AVG(COALESCE(q.professionalism_maintained,0))         * 100, 1) AS professionalism_maintained,
      ROUND(AVG(COALESCE(q.assurance_or_appreciation_provided,0)) * 100, 1) AS assurance_or_appreciation_provided,
      ROUND(AVG(COALESCE(q.express_empathy,0))                    * 100, 1) AS express_empathy,
      ROUND(AVG(COALESCE(q.enthusiasm_and_no_fumbling,0))         * 100, 1) AS enthusiasm_and_no_fumbling,
      ROUND(AVG(COALESCE(q.active_listening,0))                   * 100, 1) AS active_listening,
      ROUND(AVG(COALESCE(q.politeness_and_no_sarcasm,0))          * 100, 1) AS politeness_and_no_sarcasm,
      ROUND(AVG(COALESCE(q.proper_call_closure,0))                * 100, 1) AS proper_call_closure,
      ROUND(AVG(COALESCE(q.accurate_issue_probing,0))             * 100, 1) AS accurate_issue_probing,
      ROUND(AVG(COALESCE(q.proper_hold_procedure,0))              * 100, 1) AS proper_hold_procedure,
      ROUND(AVG(COALESCE(q.proper_transfer_and_language,0))       * 100, 1) AS proper_transfer_and_language,
      ROUND(AVG(COALESCE(q.address_recorded_completely,0))        * 100, 1) AS address_recorded_completely,
      ROUND(AVG(COALESCE(q.correct_and_complete_information,0))   * 100, 1) AS correct_and_complete_information,
      ROUND(AVG(COALESCE(q.pronunciation_and_clarity,0))          * 100, 1) AS pronunciation_and_clarity,
      ROUND(AVG(COALESCE(q.proper_grammar,0))                     * 100, 1) AS proper_grammar
    FROM db_audit.call_quality_assessment q
    WHERE q.CallDate BETWEEN ? AND ?
      AND TRIM(q.User) = ?
      AND q.quality_percentage IS NOT NULL
      ${extra}
  `, params);

  const n = (k: string) => Number(row?.[k] ?? 0);
  return {
    customer_concern_acknowledged:      n('customer_concern_acknowledged'),
    professionalism_maintained:         n('professionalism_maintained'),
    assurance_or_appreciation_provided: n('assurance_or_appreciation_provided'),
    express_empathy:                    n('express_empathy'),
    enthusiasm_and_no_fumbling:         n('enthusiasm_and_no_fumbling'),
    active_listening:                   n('active_listening'),
    politeness_and_no_sarcasm:          n('politeness_and_no_sarcasm'),
    proper_call_closure:                n('proper_call_closure'),
    accurate_issue_probing:             n('accurate_issue_probing'),
    proper_hold_procedure:              n('proper_hold_procedure'),
    proper_transfer_and_language:       n('proper_transfer_and_language'),
    address_recorded_completely:        n('address_recorded_completely'),
    correct_and_complete_information:   n('correct_and_complete_information'),
    pronunciation_and_clarity:          n('pronunciation_and_clarity'),
    proper_grammar:                     n('proper_grammar'),
  };
}

// ─── TNI Manager Comments ─────────────────────────────────────────────────────

export interface TNICommentRow {
  agent_id:    string;
  client_id:   string;
  comment:     string;
  updated_by:  string;
  updated_at:  string;
}

async function ensureTNICommentsTable(): Promise<void> {
  await querySource(`
    CREATE TABLE IF NOT EXISTS db_audit.tni_manager_comments (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      agent_id   VARCHAR(50)  NOT NULL,
      client_id  VARCHAR(50)  NOT NULL DEFAULT '',
      comment    TEXT         DEFAULT '',
      updated_by VARCHAR(100) DEFAULT '',
      updated_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_agent_client (agent_id, client_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

export async function getTNIComments(clientId?: string): Promise<TNICommentRow[]> {
  await ensureTNICommentsTable();
  const extra = clientId ? ' WHERE client_id = ?' : '';
  const params = clientId ? [clientId] : [];
  const rows = await querySource<{ agent_id: string; client_id: string; comment: string; updated_by: string; updated_at: Date }>(`
    SELECT agent_id, client_id, comment, updated_by, updated_at
    FROM db_audit.tni_manager_comments${extra}
  `, params);
  return rows.map(r => ({
    agent_id:   String(r.agent_id),
    client_id:  String(r.client_id),
    comment:    String(r.comment ?? ''),
    updated_by: String(r.updated_by ?? ''),
    updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : '',
  }));
}

export async function upsertTNIComment(
  agentId: string, clientId: string, comment: string, updatedBy: string
): Promise<void> {
  await ensureTNICommentsTable();
  await querySource(`
    INSERT INTO db_audit.tni_manager_comments (agent_id, client_id, comment, updated_by)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE comment = VALUES(comment), updated_by = VALUES(updated_by), updated_at = CURRENT_TIMESTAMP
  `, [agentId, clientId, comment, updatedBy]);
}

// ─── Fatal Calls List ─────────────────────────────────────────────────────────
export interface FatalCallItem {
  lead_id:        string;
  agent_id:       string;
  call_date:      string;
  scenario:       string;
  scenario1:      string;
  failed_params:  string[];
  negative_words: string;
  score?:         number;
}

const FATAL_PARAM_LABELS: Record<string, string> = {
  call_answered_within_5_seconds:     'Call Answered Within 5s',
  customer_concern_acknowledged:      'Customer Concern Acknowledged',
  professionalism_maintained:         'Professionalism Maintained',
  assurance_or_appreciation_provided: 'Assurance / Appreciation',
  pronunciation_and_clarity:          'Pronunciation & Clarity',
  enthusiasm_and_no_fumbling:         'Enthusiasm & No Fumbling',
  active_listening:                   'Active Listening',
  politeness_and_no_sarcasm:          'Politeness & No Sarcasm',
  proper_grammar:                     'Proper Grammar',
  accurate_issue_probing:             'Accurate Issue Probing',
  proper_hold_procedure:              'Proper Hold Procedure',
  proper_transfer_and_language:       'Proper Transfer & Language',
  dead_air_under_10_seconds:          'Dead Air Under 10s',
  case_escalated_correctly:           'Case Escalated Correctly',
  address_recorded_completely:        'Address Recorded Completely',
  correct_and_complete_information:   'Correct & Complete Info',
  upselling_or_offers_suggested:      'Upselling / Offers Suggested',
  further_assistance_offered:         'Further Assistance Offered',
  proper_call_closure:                'Proper Call Closure',
};

export async function getAgentCalls(filters: InboundQualityFilters & { agentId: string }): Promise<FatalCallItem[]> {
  const { startDate, endDate, clientId, agentId } = filters;
  const clientFilter = clientId ? ' AND q.ClientId = ?' : '';
  const params: (string | number)[] = [startDate, endDate, ...(clientId ? [clientId] : [])];

  const rows = await querySource<{
    lead_id: string; agent_id: string; call_date: string;
    scenario: string; scenario1: string; score: number;
  }>(`
    SELECT
      COALESCE(q.lead_id, '')                                       AS lead_id,
      COALESCE(NULLIF(TRIM(q.User), ''), 'Unknown')                 AS agent_id,
      DATE_FORMAT(q.CallDate, '%Y-%m-%d %H:%i')                     AS call_date,
      COALESCE(NULLIF(TRIM(q.scenario),  ''), 'Unknown')            AS scenario,
      COALESCE(NULLIF(TRIM(q.scenario1), ''), '—')                  AS scenario1,
      ROUND(q.quality_percentage, 1)                                AS score
    FROM db_audit.call_quality_assessment q
    WHERE q.CallDate BETWEEN ? AND ?
      AND q.quality_percentage IS NOT NULL
      AND TRIM(q.User) = ?
      ${clientFilter}
    ORDER BY q.CallDate DESC
    LIMIT 300
  `, [...params, agentId]);

  return rows.map(r => ({
    lead_id:        String(r.lead_id),
    agent_id:       String(r.agent_id),
    call_date:      String(r.call_date),
    scenario:       String(r.scenario),
    scenario1:      String(r.scenario1),
    score:          Number(r.score),
    failed_params:  [],
    negative_words: '',
  }));
}

export async function getFatalCallsList(filters: InboundQualityFilters): Promise<FatalCallItem[]> {
  const { startDate, endDate, clientId } = filters;
  const clientFilter = clientId ? ' AND q.ClientId = ?' : '';
  const params: (string | number)[] = [startDate, endDate, ...(clientId ? [clientId] : [])];

  type RawRow = {
    lead_id: string; agent_id: string; call_date: string;
    scenario: string; scenario1: string; negative_words: string;
    [key: string]: unknown;
  };

  const rows = await querySource<RawRow>(`
    SELECT
      COALESCE(q.lead_id, '')                                     AS lead_id,
      COALESCE(NULLIF(TRIM(q.User), ''), 'Unknown')               AS agent_id,
      DATE_FORMAT(q.CallDate, '%Y-%m-%d %H:%i')                   AS call_date,
      COALESCE(NULLIF(TRIM(q.scenario),  ''), 'Unknown')          AS scenario,
      COALESCE(NULLIF(TRIM(q.scenario1), ''), 'Unknown')          AS scenario1,
      COALESCE(q.top_negative_words, '')                          AS negative_words,
      COALESCE(q.call_answered_within_5_seconds,     0) AS call_answered_within_5_seconds,
      COALESCE(q.customer_concern_acknowledged,      0) AS customer_concern_acknowledged,
      COALESCE(q.professionalism_maintained,         0) AS professionalism_maintained,
      COALESCE(q.assurance_or_appreciation_provided, 0) AS assurance_or_appreciation_provided,
      COALESCE(q.pronunciation_and_clarity,          0) AS pronunciation_and_clarity,
      COALESCE(q.enthusiasm_and_no_fumbling,         0) AS enthusiasm_and_no_fumbling,
      COALESCE(q.active_listening,                   0) AS active_listening,
      COALESCE(q.politeness_and_no_sarcasm,          0) AS politeness_and_no_sarcasm,
      COALESCE(q.proper_grammar,                     0) AS proper_grammar,
      COALESCE(q.accurate_issue_probing,             0) AS accurate_issue_probing,
      COALESCE(q.proper_hold_procedure,              0) AS proper_hold_procedure,
      COALESCE(q.proper_transfer_and_language,       0) AS proper_transfer_and_language,
      COALESCE(q.dead_air_under_10_seconds,          0) AS dead_air_under_10_seconds,
      COALESCE(q.case_escalated_correctly,           0) AS case_escalated_correctly,
      COALESCE(q.address_recorded_completely,        0) AS address_recorded_completely,
      COALESCE(q.correct_and_complete_information,   0) AS correct_and_complete_information,
      COALESCE(q.upselling_or_offers_suggested,      0) AS upselling_or_offers_suggested,
      COALESCE(q.further_assistance_offered,         0) AS further_assistance_offered,
      COALESCE(q.proper_call_closure,                0) AS proper_call_closure
    FROM db_audit.call_quality_assessment q
    WHERE q.CallDate BETWEEN ? AND ?
      AND q.quality_percentage = 0
      AND q.quality_percentage IS NOT NULL
      ${clientFilter}
    ORDER BY q.CallDate DESC
    LIMIT 300
  `, params);

  const paramKeys = Object.keys(FATAL_PARAM_LABELS);

  return rows.map(r => {
    const failed = paramKeys
      .filter(k => Number(r[k]) === 0)
      .map(k => FATAL_PARAM_LABELS[k]);
    return {
      lead_id:        String(r.lead_id),
      agent_id:       String(r.agent_id),
      call_date:      String(r.call_date),
      scenario:       String(r.scenario),
      scenario1:      String(r.scenario1),
      failed_params:  failed,
      negative_words: String(r.negative_words),
    };
  });
}

// ── CLAP Customer Product Analysis ─────────────────────────────────────────

const PRODUCT_KEYWORDS: [string, string][] = [
  ['ceo man',          'CEO Man Perfume'],
  ['date woman',       'DATE Woman Perfume'],
  ['skai',             'SKAI Aquatic Perfume'],
  ['klub',             'KLUB Man Perfume'],
  ['g.o.a.t',          'G.O.A.T. Man Perfume'],
  ['hot mess',         'HOT Mess Perfume'],
  ['night fever',      'Night Fever Perfume'],
  ['dynamite',         'Dynamite Perfume'],
  ['oud white',        'OUD WHITE Perfume'],
  ['white oud',        'WHITE Oud Perfume'],
  ['honey oud',        'HONEY Oud Perfume'],
  ['dark oud',         'DARK Oud Perfume'],
  ['narco',            'Narco Perfume'],
  ['senorita',         'SENORITA Woman Perfume'],
  ['glam woman',       'GLAM Woman Perfume'],
  ['ghost',            'Ghost Perfume'],
  ['impact man',       'IMPACT Man Perfume'],
  ['blush parfum',     'Blush Parfum'],
  ['beast',            'Beast Perfume'],
  ['ocean man',        'OCEAN Man Perfume'],
  ['blu man',          'BLU Man Perfume'],
  ['growbrow',         'Growbrow'],
  ['deo pack',         'Deo Pack'],
  ['niacinamide',      'Niacinamide Face Wash'],
  ['sunscreen',        'Sunscreen SPF 50'],
  ['rose woman',       'ROSE Woman Perfume'],
  ['mood collection',  'Mood Collection Gift Set'],
  ['luxury perfume',   'Luxury Perfume Gift Set'],
  ['discovery gift',   'Discovery Gift Set'],
];

function buildProductCaseInbound(): string {
  const whens = PRODUCT_KEYWORDS
    .map(([kw, name]) => `WHEN LOWER(q.Transcribe_Text) LIKE '%${kw}%' THEN '${name}'`)
    .join('\n        ');
  return `CASE\n        ${whens}\n        ELSE NULL\n      END`;
}

function wordListFromRaw(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const freq: Record<string, number> = {};
  raw.split('|').forEach(phrase => {
    phrase.split(',').map(w => w.trim().toLowerCase()).filter(w => w.length > 2).forEach(w => {
      freq[w] = (freq[w] ?? 0) + 1;
    });
  });
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([w]) => w);
}

export interface ClapScenarioCount { scenario: string; count: number; }
export interface ClapCustomerProduct {
  name: string;
  total: number;
  pos: number;
  neg: number;
  posWords: string[];
  negWords: string[];
  scenarioBreakdown: ClapScenarioCount[];
}
export interface ClapCustomerBranch {
  clap: string;
  total: number;
  pos: number;
  neg: number;
  posWords: string[];
  negWords: string[];
  scenarioBreakdown: ClapScenarioCount[];
  products: ClapCustomerProduct[];
}
export interface ClapCustomerAnalysis {
  overall: { total: number; pos: number; neg: number };
  branches: ClapCustomerBranch[];
}

export async function getClapCustomerAnalysis(filters: InboundQualityFilters): Promise<ClapCustomerAnalysis> {
  const { startDate, endDate, clientId } = filters;
  const cf = clientId ? ' AND q.ClientId = ?' : '';
  const base: (string | number)[] = [startDate, endDate, ...(clientId ? [clientId] : [])];
  const productCase = buildProductCaseInbound();

  const [overallRows, branchRows, productRows, productScenRows, logisticScenRows] = await Promise.all([
    // 1. Overall totals
    querySource<{ total: number; pos: number; neg: number }>(`
      SELECT COUNT(*) AS total,
        SUM(CASE WHEN q.top_positive_words IS NOT NULL AND q.top_positive_words != '' THEN 1 ELSE 0 END) AS pos,
        SUM(CASE WHEN q.top_negative_words IS NOT NULL AND q.top_negative_words != '' THEN 1 ELSE 0 END) AS neg
      FROM db_audit.call_quality_assessment q
      WHERE q.CallDate BETWEEN ? AND ? AND q.quality_percentage IS NOT NULL ${cf}
    `, base),

    // 2. Per-branch totals — Agent uses agent-specific word columns
    querySource<{ clap: string; total: number; pos: number; neg: number; pw: string; nw: string; apw: string; anw: string }>(`
      SELECT ${CLAP_CASE_INBOUND} AS clap,
        COUNT(*) AS total,
        SUM(CASE WHEN q.top_positive_words IS NOT NULL AND q.top_positive_words != '' THEN 1 ELSE 0 END) AS pos,
        SUM(CASE WHEN q.top_negative_words IS NOT NULL AND q.top_negative_words != '' THEN 1 ELSE 0 END) AS neg,
        LEFT(GROUP_CONCAT(q.top_positive_words      SEPARATOR '|'), 3000) AS pw,
        LEFT(GROUP_CONCAT(q.top_negative_words      SEPARATOR '|'), 3000) AS nw,
        LEFT(GROUP_CONCAT(NULLIF(q.top_positive_words_agent,'') SEPARATOR '|'), 3000) AS apw,
        LEFT(GROUP_CONCAT(NULLIF(q.top_negative_words_agent,'') SEPARATOR '|'), 3000) AS anw
      FROM db_audit.call_quality_assessment q
      WHERE q.CallDate BETWEEN ? AND ? AND q.quality_percentage IS NOT NULL ${cf}
        AND ${CLAP_CASE_INBOUND} IN ('Logistic','Agent','Product')
      GROUP BY clap ORDER BY total DESC
    `, base),

    // 3. Per-product totals (all three branches, product detected via Transcribe_Text)
    querySource<{ clap: string; product: string; total: number; pos: number; neg: number; pw: string; nw: string }>(`
      SELECT ${CLAP_CASE_INBOUND} AS clap,
        ${productCase} AS product,
        COUNT(*) AS total,
        SUM(CASE WHEN q.top_positive_words IS NOT NULL AND q.top_positive_words != '' THEN 1 ELSE 0 END) AS pos,
        SUM(CASE WHEN q.top_negative_words IS NOT NULL AND q.top_negative_words != '' THEN 1 ELSE 0 END) AS neg,
        LEFT(GROUP_CONCAT(q.top_positive_words SEPARATOR '|'), 2000) AS pw,
        LEFT(GROUP_CONCAT(q.top_negative_words SEPARATOR '|'), 2000) AS nw
      FROM db_audit.call_quality_assessment q
      WHERE q.CallDate BETWEEN ? AND ? AND q.quality_percentage IS NOT NULL ${cf}
        AND ${CLAP_CASE_INBOUND} IN ('Logistic','Agent','Product')
        AND q.Transcribe_Text IS NOT NULL AND q.Transcribe_Text != ''
        AND ${productCase} IS NOT NULL
      GROUP BY clap, product ORDER BY clap, total DESC
    `, base),

    // 4. Per-product per-scenario counts (for Product & Logistic drill)
    querySource<{ clap: string; product: string; scenario: string; cnt: number }>(`
      SELECT ${CLAP_CASE_INBOUND} AS clap,
        ${productCase} AS product,
        q.scenario,
        COUNT(*) AS cnt
      FROM db_audit.call_quality_assessment q
      WHERE q.CallDate BETWEEN ? AND ? AND q.quality_percentage IS NOT NULL ${cf}
        AND ${CLAP_CASE_INBOUND} IN ('Logistic','Agent','Product')
        AND q.Transcribe_Text IS NOT NULL AND q.Transcribe_Text != ''
        AND ${productCase} IS NOT NULL
      GROUP BY clap, product, q.scenario ORDER BY clap, product, cnt DESC
    `, base),

    // 5. Logistic overall scenario breakdown (all calls, not filtered by product)
    querySource<{ scenario: string; cnt: number }>(`
      SELECT q.scenario, COUNT(*) AS cnt
      FROM db_audit.call_quality_assessment q
      WHERE q.CallDate BETWEEN ? AND ? AND q.quality_percentage IS NOT NULL ${cf}
        AND ${CLAP_CASE_INBOUND} = 'Logistic'
      GROUP BY q.scenario ORDER BY cnt DESC
    `, base),
  ]);

  const overall = overallRows[0] ?? { total: 0, pos: 0, neg: 0 };

  const branches: ClapCustomerBranch[] = branchRows.map(br => {
    const clap = String(br.clap);
    const isAgent = clap === 'Agent';
    return {
      clap,
      total: Number(br.total),
      pos:   Number(br.pos),
      neg:   Number(br.neg),
      posWords: wordListFromRaw(isAgent ? (br.apw as unknown as string) : (br.pw as unknown as string)),
      negWords: wordListFromRaw(isAgent ? (br.anw as unknown as string) : (br.nw as unknown as string)),
      scenarioBreakdown: clap === 'Logistic'
        ? logisticScenRows.map(r => ({ scenario: String(r.scenario), count: Number(r.cnt) }))
        : [],
      products: productRows
        .filter(pr => pr.clap === clap && pr.product)
        .map(pr => ({
          name:     String(pr.product),
          total:    Number(pr.total),
          pos:      Number(pr.pos),
          neg:      Number(pr.neg),
          posWords: wordListFromRaw(pr.pw as unknown as string),
          negWords: wordListFromRaw(pr.nw as unknown as string),
          scenarioBreakdown: productScenRows
            .filter(s => s.clap === clap && s.product === pr.product)
            .map(s => ({ scenario: String(s.scenario), count: Number(s.cnt) })),
        })),
    };
  });

  return { overall: { total: Number(overall.total), pos: Number(overall.pos), neg: Number(overall.neg) }, branches };
}
