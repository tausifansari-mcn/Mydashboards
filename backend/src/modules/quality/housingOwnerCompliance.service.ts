import { querySource } from '../../lib/sourceDb';
import { queryMasmis, getMasmisPool } from '../../lib/masmisDb';
import { against } from './quality.service';
import type { QualityFilters } from './quality.service';

// ─── Housing Owner Script Compliance Checklist ─────────────────────────────────
// Detects the 26 compliance parameters from Housing Owner's QA checklist by keyword-matching
// TranscribeText, client_id 496 only. Follows the exact pattern of Customer Interaction Insights
// (outbound_call_insights): live REGEXP_LIKE scans over raw TranscribeText are too slow for a
// per-request query (measured 70s+ elsewhere in this file for one client-month), so results are
// precomputed into a cache table by a background batch job and the dashboard reads only the cache.
//
// Real Housing Owner transcripts (sampled directly from db_external.CallDetails before writing
// these lists) are NOT the Latin-script "Hinglish" used by the other keyword lists in
// quality.service.ts (e.g. "fir karunga") — they're actual Devanagari Hindi with English
// technical/brand terms code-switched in mid-sentence ("housing dot com से बात कर रहा हूं",
// "sir आपकी property residential है commercial है"). Phrase lists below mix both scripts
// accordingly. There is also no speaker diarization (no "Agent:"/"Customer:" tags) — every check
// here answers "was this phrase said anywhere in the call," not "did the agent specifically say
// this," which is weaker evidence for the conduct-focused parameters (Professional Communication,
// No Background Chitchat, Mandatory Call Opening, Proper Call Closure) in particular.
//
// Detection is inherently a heuristic, not a certified audit. For "must do X" parameters, presence
// of the expected phrase is a reasonable pass signal. For "must NOT do X" parameters, only a
// red-flag phrase is reliably detectable — its absence means "no violation caught," not proof the
// agent behaved correctly. Each parameter below is commented with its type.

const HOUSING_OWNER_CLIENT_ID = 496;

// ── Phrase lists ────────────────────────────────────────────────────────────────

// 1. Mandatory Call Opening (AND) — brand/role mention + a name-confirmation phrase.
const OPENING_BRAND = ['housing dot com', 'housing.com', 'housing dom com', 'housing se baat', 'housing की तरफ से', 'property advisor'];
const OPENING_NAME_CONFIRM = [
  'बात कर रहे हैं', 'से बात हो रही है', 'से मेरी बात हो रही है', 'बात हो रही है',
  'am i speaking with', 'is this', 'kya main baat kar raha hoon',
];

// 2. Property/Lead Details Handled as per Process (presence).
const PROPERTY_DETAILS_KEYWORDS = [
  'bhk', 'residential', 'commercial', 'independent', 'floor', 'duplex', 'apartment',
  'location', 'property type', 'configuration', 'listed price', 'listing price',
  'property* address', 'फ्लैट',
];

// 3. Requirement & Property Probing (presence) — probing questions about intent/urgency/budget.
const REQUIREMENT_PROBING_KEYWORDS = [
  'sell out या rent out', 'sale या rent', 'sell या rent', 'sale or rent', 'rent out करने के लिए',
  'क्या आपका requirement है', 'requirement क्या है', 'budget क्या है', 'kab tak', 'कितने में',
  'available है आपके पास', 'what is your requirement',
];

// 4. Free Listing vs Paid Plan Explanation (AND) — must mention BOTH the free/existing listing
// and the paid/premium plan to count as an actual comparison, not just a random mention of one.
const FREE_LISTING_TERMS = ['free listing', 'fre* listing', 'existing listing', 'पहले से listing', 'पहले listing'];
const PAID_PLAN_TERMS = ['paid listing', 'paid plan', 'premium', 'premium plus', 'upgrade', 'package'];

// 5. Correct Plan Information (presence) — plan + a concrete benefit/validity/visibility term.
const PLAN_INFO_KEYWORDS = [
  'plan के benefit', 'benefit* बताना', 'validity', 'visibility', 'leads provide', 'unlimited lead',
  'plan benefits', 'package में क्या', 'इस plan में',
];

// 6. Plan Recommendation Based on Requirement (presence, weak — hard to verify tailoring via
// keywords alone; genuinely a lower-confidence parameter).
const PLAN_RECOMMENDATION_KEYWORDS = [
  'आपकी requirement के हिसाब से', 'according to your requirement', 'aapki requirement ke hisab se',
  'आपके लिए best रहेगा', 'suit करेगा', 'recommend करूंगा',
];

// 7. Pricing & Discount Compliance (violation) — red flags: discount language NOT paired with an
// approved/official qualifier nearby.
const PRICING_DISCOUNT_RED_FLAGS = [
  'sirf aapke liye discount', 'सिर्फ़ आपके लिए discount', 'special discount', 'extra discount दे दूंगा',
  'khud se discount', 'मैं खुद discount', 'off the record',
];

// 8. Offer Communication Compliance (violation) — fake/unapproved urgency.
const OFFER_URGENCY_RED_FLAGS = [
  'abhi ya kabhi nahi', 'अभी नहीं तो कभी नहीं', 'sirf aaj ke liye offer', 'last chance offer',
  'yeh offer sirf abhi hai', 'offer khatam ho jayega abhi',
];

// 9. Correct Plan & Amount Confirmation (presence) — reconfirming plan + final amount before close.
const PLAN_AMOUNT_CONFIRM_KEYWORDS = [
  'final amount', 'total payable', 'confirm karte hain', 'confirm करते हैं', 'तो यह plan फाइनल',
  'amount confirm', 'total price',
];

// 10. No False Commitment Regarding Leads (violation).
const FALSE_COMMITMENT_LEADS_RED_FLAGS = [
  'guarantee* lead', 'guaranteed buyer', 'guaranteed tenant', 'pakka bik jayega', 'पक्का बिक जाएगी',
  '100% sale', 'guaranteed sale', 'pakka rent ho jayega',
];

// 11. No False Commitment Regarding Visibility/Position (violation).
const FALSE_COMMITMENT_VISIBILITY_RED_FLAGS = [
  'number 1 pe', 'number one par', 'guaranteed views', 'top पर ही रहेगी', 'हमेशा top पर',
  'guaranteed ranking', 'guaranteed position',
];

// 12. No Manipulation of Customer Information (violation, lowest-confidence) — best-effort, no
// reliable phrase signature exists for this; kept narrow on purpose.
const MANIPULATION_RED_FLAGS = [
  'requirement change kar dete hain', 'हम बदल देते हैं', 'ऐसा बोल देते हैं system में',
];

// 13. No Misleading Information (violation).
const MISLEADING_INFO_RED_FLAGS = [
  'koi condition nahi', 'कोई condition नहीं है', 'no conditions apply', 'bina kisi shart ke',
  'sab kuch free hai isme',
];

// 14. Customer Objection Handling (presence) — acknowledgement phrase.
const OBJECTION_HANDLING_KEYWORDS = [
  'i understand your concern', 'समझ सकता हूं', 'समझ सकती हूं', 'main samajh sakta hoon',
  'आपकी बात समझ रहा हूं', 'aapki baat samajh raha hoon',
];

// 15. Active Listening & Relevant Pitch (presence, weak) — paraphrase-back phrasing.
const ACTIVE_LISTENING_KEYWORDS = [
  'so what you are saying', 'aap keh rahe hain ki', 'आप कह रहे हैं कि', 'जैसा आपने बताया',
  'jaisa aapne bataya',
];

// 16. No Unnecessary Pressure / Mis-selling (violation).
const PRESSURE_MISSELLING_RED_FLAGS = [
  'abhi lena hi hoga', 'अभी लेना ही होगा', 'you must buy', 'lena padega', 'लेना पड़ेगा',
  'nahi liya to nuksan', 'नहीं तो नुकसान होगा',
];

// 17. Payment/Transaction Information Compliance (violation) — personal payment instruction.
const PAYMENT_INFO_RED_FLAGS = [
  'mere account mein bhej do', 'मेरे account में भेज दो', 'personal upi', 'mere personal number pe payment',
  'mujhe cash de dena',
];

// 18. Sale Confirmation (presence).
const SALE_CONFIRMATION_KEYWORDS = [
  'so you confirm', 'aap confirm karte hain', 'आप confirm करते हैं', 'haan main lena chahta hoon',
  'हां मुझे लेना है', 'ok le leta hoon', 'ठीक है ले लेता हूं',
];

// 19. Correct Sale Tagging / Disposition — NOT phrase-based; computed as a cross-check against
// sale_confirmation and cd.SaleDone in the batch query (see below).

// 20. Callback Commitment Compliance (presence) — callback promise with a time reference.
const CALLBACK_COMMITMENT_KEYWORDS = [
  'i will call you back', 'callback kar dunga', 'call back करूंगा', 'wapas call karunga',
  'वापस call करूंगा', 'thodi der mein call karta hoon',
];

// 21. Proper Call Closure (presence).
const CALL_CLOSURE_KEYWORDS = [
  'thank you for your time', 'have a good day', 'dhanyawad', 'धन्यवाद', 'shukriya', 'शुक्रिया',
  'thank you sir', 'thank you ma\'am',
];

// 22. Professional Communication (violation) — reuse the same abuse/slang style already
// established elsewhere in this file rather than inventing a parallel list.
const UNPROFESSIONAL_RED_FLAGS = [
  'chup*', 'बकवास*', 'bakwaas*', 'stupid', 'idiot', 'pagal*', 'पागल*', 'nonsense*',
];

// 23. No Background Chitchat (violation, lowest-confidence) — off-topic small talk markers; the
// hardest parameter to keyword-detect reliably, kept intentionally narrow.
const CHITCHAT_RED_FLAGS = [
  'family kaisi hai', 'फैमिली कैसी है', 'weather kaisa hai', 'बाकी सब ठीक', 'aapka din kaisa raha',
];

// 24. Call Recording Compliance — NOT phrase-based; proxy via CallDetails.FileName (no dedicated
// recording-URL column exists on this table; FileName is the closest real signal).

// 25. No Unauthorized Commitment (violation).
const UNAUTHORIZED_COMMITMENT_RED_FLAGS = [
  'free refund kar dunga', 'फ्री refund कर दूंगा', 'extra service free', 'मैं manage कर दूंगा',
  'main manage kar dunga', 'koi charge nahi lagega iska',
];

// Smart Tool Compliance is intentionally NOT included — no usable signal exists in any available
// data source (it's about on-screen tool usage during the call, invisible in a voice transcript).
// The frontend renders it as a static "Not tracked" row.

function andConds(...lists: string[][]): string {
  return lists.map(l => `(${against(l)})`).join(' AND ');
}

// ── Cache table ──────────────────────────────────────────────────────────────────

const CACHE_COLS = [
  'call_opening', 'property_lead_details', 'requirement_probing', 'free_vs_paid_explanation',
  'correct_plan_info', 'plan_recommendation', 'pricing_discount_compliance',
  'offer_communication_compliance', 'plan_amount_confirmation', 'no_false_commitment_leads',
  'no_false_commitment_visibility', 'no_manipulation_info', 'no_misleading_info',
  'objection_handling', 'active_listening', 'no_pressure_misselling', 'payment_info_compliance',
  'sale_confirmation', 'correct_sale_tagging', 'callback_commitment_compliance',
  'proper_call_closure', 'professional_communication', 'no_background_chitchat',
  'call_recording_compliance', 'no_unauthorized_commitment',
] as const;
export type ComplianceParamKey = (typeof CACHE_COLS)[number];

export async function initHousingOwnerComplianceTables(): Promise<void> {
  const pool = getMasmisPool();
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS db_masmis.housing_owner_compliance_cache (
        call_id     INT PRIMARY KEY,
        call_date   DATETIME NOT NULL,
        agent_name  VARCHAR(100),
        ${CACHE_COLS.map(c => `${c} TINYINT(1)`).join(',\n        ')},
        overall_score DECIMAL(5,2),
        computed_at DATETIME DEFAULT NOW(),
        INDEX idx_call_date (call_date),
        INDEX idx_agent_date (agent_name, call_date)
      )
    `);

    const [existingCols] = await pool.execute(`
      SELECT COLUMN_NAME FROM information_schema.columns
      WHERE TABLE_SCHEMA = 'db_masmis' AND TABLE_NAME = 'housing_owner_compliance_cache'
    `);
    const colNames = new Set((existingCols as { COLUMN_NAME: string }[]).map(c => c.COLUMN_NAME));
    let migrated = false;
    for (const col of CACHE_COLS) {
      if (!colNames.has(col)) {
        await pool.execute(`ALTER TABLE db_masmis.housing_owner_compliance_cache ADD COLUMN ${col} TINYINT(1)`);
        migrated = true;
      }
    }

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS db_masmis.housing_owner_compliance_cursor (
        id TINYINT PRIMARY KEY DEFAULT 1,
        last_call_id INT NOT NULL DEFAULT 0
      )
    `);
    const [cursorRows] = await pool.execute(
      `SELECT last_call_id FROM db_masmis.housing_owner_compliance_cursor WHERE id = 1`
    );
    // Housing Owner's total volume is small (~1,400 calls) — no need for the 30-day partial seed
    // the much larger outbound_insights job uses; start from the client's oldest row.
    const seedRows = await querySource<{ minId: number }>(
      `SELECT COALESCE(MIN(id), 0) AS minId FROM db_external.CallDetails WHERE client_id = ${HOUSING_OWNER_CLIENT_ID}`
    );
    const seedId = Math.max(0, Number(seedRows[0]?.minId ?? 0) - 1);
    if ((cursorRows as unknown[]).length === 0) {
      await pool.execute(`INSERT INTO db_masmis.housing_owner_compliance_cursor (id, last_call_id) VALUES (1, ?)`, [seedId]);
    } else if (migrated) {
      // Rewind so the catch-up job reclassifies the whole cached window under the new keyword
      // lists — otherwise previously-cached rows would keep stale/missing classifications forever.
      await pool.execute(`UPDATE db_masmis.housing_owner_compliance_cursor SET last_call_id = ? WHERE id = 1`, [seedId]);
    }
  } catch (err) {
    console.error('[quality] initHousingOwnerComplianceTables warning:', (err as Error).message);
  }
}

// Batch size is much smaller than the sibling outbound_call_insights job's 300 — this checklist
// runs ~25 REGEXP_LIKE conditions per call (several AND-combined, so closer to ~30 regex scans per
// row) vs Insights' ~13, and was measured to time out (20s) at 300 rows; 50 rows completes in ~4-5s,
// leaving comfortable margin. Housing Owner's total volume (~1,400-2,200 calls) means the extra
// round trips are cheap — a full backfill still finishes in a few minutes.
async function processHousingOwnerComplianceBatch(batchSize = 50): Promise<number> {
  const [cursorRow] = await queryMasmis<{ last_call_id: number }>(
    `SELECT last_call_id FROM db_masmis.housing_owner_compliance_cursor WHERE id = 1`
  );
  const lastId = cursorRow?.last_call_id ?? 0;

  type Row = { id: number; CallDate: string; AgentName: string | null; SaleDone: number | null } & Record<ComplianceParamKey, number>;

  const rows = await querySource<Row>(`
    SELECT cd.id, cd.CallDate, cd.AgentName, cd.SaleDone,
      IF(${andConds(OPENING_BRAND, OPENING_NAME_CONFIRM)}, 1, 0) AS call_opening,
      IF(${against(PROPERTY_DETAILS_KEYWORDS)}, 1, 0) AS property_lead_details,
      IF(${against(REQUIREMENT_PROBING_KEYWORDS)}, 1, 0) AS requirement_probing,
      IF(${andConds(FREE_LISTING_TERMS, PAID_PLAN_TERMS)}, 1, 0) AS free_vs_paid_explanation,
      IF(${against(PLAN_INFO_KEYWORDS)}, 1, 0) AS correct_plan_info,
      IF(${against(PLAN_RECOMMENDATION_KEYWORDS)}, 1, 0) AS plan_recommendation,
      IF(${against(PRICING_DISCOUNT_RED_FLAGS)}, 0, 1) AS pricing_discount_compliance,
      IF(${against(OFFER_URGENCY_RED_FLAGS)}, 0, 1) AS offer_communication_compliance,
      IF(${against(PLAN_AMOUNT_CONFIRM_KEYWORDS)}, 1, 0) AS plan_amount_confirmation,
      IF(${against(FALSE_COMMITMENT_LEADS_RED_FLAGS)}, 0, 1) AS no_false_commitment_leads,
      IF(${against(FALSE_COMMITMENT_VISIBILITY_RED_FLAGS)}, 0, 1) AS no_false_commitment_visibility,
      IF(${against(MANIPULATION_RED_FLAGS)}, 0, 1) AS no_manipulation_info,
      IF(${against(MISLEADING_INFO_RED_FLAGS)}, 0, 1) AS no_misleading_info,
      IF(${against(OBJECTION_HANDLING_KEYWORDS)}, 1, 0) AS objection_handling,
      IF(${against(ACTIVE_LISTENING_KEYWORDS)}, 1, 0) AS active_listening,
      IF(${against(PRESSURE_MISSELLING_RED_FLAGS)}, 0, 1) AS no_pressure_misselling,
      IF(${against(PAYMENT_INFO_RED_FLAGS)}, 0, 1) AS payment_info_compliance,
      IF(${against(SALE_CONFIRMATION_KEYWORDS)}, 1, 0) AS sale_confirmation,
      IF(${against(SALE_CONFIRMATION_KEYWORDS)} = (COALESCE(cd.SaleDone,0) = 1), 1, 0) AS correct_sale_tagging,
      IF(${against(CALLBACK_COMMITMENT_KEYWORDS)}, 1, 0) AS callback_commitment_compliance,
      IF(${against(CALL_CLOSURE_KEYWORDS)}, 1, 0) AS proper_call_closure,
      IF(${against(UNPROFESSIONAL_RED_FLAGS)}, 0, 1) AS professional_communication,
      IF(${against(CHITCHAT_RED_FLAGS)}, 0, 1) AS no_background_chitchat,
      IF(cd.FileName IS NOT NULL AND cd.FileName != '', 1, 0) AS call_recording_compliance,
      IF(${against(UNAUTHORIZED_COMMITMENT_RED_FLAGS)}, 0, 1) AS no_unauthorized_commitment
    FROM db_external.CallDetails cd
    WHERE cd.client_id = ${HOUSING_OWNER_CLIENT_ID} AND cd.id > ?
      AND cd.TranscribeText IS NOT NULL AND cd.TranscribeText != ''
    ORDER BY cd.id ASC
    LIMIT ${Number(batchSize)}
  `, [lastId]);

  if (rows.length === 0) return 0;

  const cols = ['call_id', 'call_date', 'agent_name', ...CACHE_COLS, 'overall_score'];
  const placeholders = rows.map(() => `(${cols.map(() => '?').join(',')},NOW())`).join(',');
  const flat = rows.flatMap(r => {
    const scores = CACHE_COLS.map(c => Number(r[c]));
    const overall = Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 1000) / 10;
    return [r.id, r.CallDate, r.AgentName, ...scores, overall];
  });
  const updateCols = cols.filter(c => c !== 'call_id').map(c => `${c} = VALUES(${c})`).join(', ');

  await queryMasmis(`
    INSERT INTO db_masmis.housing_owner_compliance_cache (${cols.join(', ')}, computed_at)
    VALUES ${placeholders}
    ON DUPLICATE KEY UPDATE ${updateCols}, computed_at = NOW()
  `, flat);

  const newLastId = rows[rows.length - 1].id;
  await queryMasmis(`UPDATE db_masmis.housing_owner_compliance_cursor SET last_call_id = ? WHERE id = 1`, [newLastId]);

  return rows.length;
}

let complianceJobRunning = false;
async function runHousingOwnerComplianceCatchUp(): Promise<void> {
  if (complianceJobRunning) return;
  complianceJobRunning = true;
  try {
    let processed = 0;
    do {
      processed = await processHousingOwnerComplianceBatch(50);
      if (processed > 0) await new Promise(r => setTimeout(r, 500));
    } while (processed > 0);
  } catch (err) {
    console.error('[quality] housing owner compliance batch error:', (err as Error).message);
  } finally {
    complianceJobRunning = false;
  }
}

export function startHousingOwnerComplianceJob(): void {
  runHousingOwnerComplianceCatchUp().catch(() => {});
  const timer = setInterval(() => { runHousingOwnerComplianceCatchUp().catch(() => {}); }, 5 * 60 * 1000);
  if (typeof timer.unref === 'function') timer.unref();
}

// ── Read side ────────────────────────────────────────────────────────────────────

export const COMPLIANCE_PARAM_LABELS: Record<ComplianceParamKey, { label: string; category: string; confidence: 'normal' | 'low' }> = {
  call_opening:                     { label: 'Mandatory Call Opening',                       category: 'Call Opening & Discovery', confidence: 'normal' },
  property_lead_details:            { label: 'Property/Lead Details Handled as per Process',  category: 'Call Opening & Discovery', confidence: 'normal' },
  requirement_probing:              { label: 'Requirement & Property Probing',                category: 'Call Opening & Discovery', confidence: 'normal' },
  free_vs_paid_explanation:         { label: 'Free Listing vs Paid Plan Explanation',          category: 'Plan & Pricing',           confidence: 'normal' },
  correct_plan_info:                { label: 'Correct Plan Information',                      category: 'Plan & Pricing',           confidence: 'normal' },
  plan_recommendation:              { label: 'Plan Recommendation Based on Requirement',       category: 'Plan & Pricing',           confidence: 'low' },
  pricing_discount_compliance:      { label: 'Pricing & Discount Compliance',                  category: 'Plan & Pricing',           confidence: 'normal' },
  offer_communication_compliance:   { label: 'Offer Communication Compliance',                 category: 'Plan & Pricing',           confidence: 'normal' },
  plan_amount_confirmation:         { label: 'Correct Plan & Amount Confirmation',             category: 'Plan & Pricing',           confidence: 'normal' },
  no_false_commitment_leads:        { label: 'No False Commitment Regarding Leads',            category: 'Honesty & Commitments',    confidence: 'normal' },
  no_false_commitment_visibility:   { label: 'No False Commitment Regarding Visibility/Position', category: 'Honesty & Commitments', confidence: 'normal' },
  no_manipulation_info:             { label: 'No Manipulation of Customer Information',        category: 'Honesty & Commitments',    confidence: 'low' },
  no_misleading_info:               { label: 'No Misleading Information',                      category: 'Honesty & Commitments',    confidence: 'normal' },
  objection_handling:               { label: 'Customer Objection Handling',                    category: 'Engagement & Objection Handling', confidence: 'normal' },
  active_listening:                 { label: 'Active Listening & Relevant Pitch',               category: 'Engagement & Objection Handling', confidence: 'low' },
  no_pressure_misselling:           { label: 'No Unnecessary Pressure / Mis-selling',          category: 'Engagement & Objection Handling', confidence: 'normal' },
  payment_info_compliance:          { label: 'Payment/Transaction Information Compliance',     category: 'Payment & Closure',        confidence: 'normal' },
  sale_confirmation:                { label: 'Sale Confirmation',                              category: 'Payment & Closure',        confidence: 'normal' },
  correct_sale_tagging:             { label: 'Correct Sale Tagging / Disposition',              category: 'Payment & Closure',        confidence: 'normal' },
  callback_commitment_compliance:   { label: 'Callback Commitment Compliance',                 category: 'Payment & Closure',        confidence: 'normal' },
  proper_call_closure:              { label: 'Proper Call Closure',                            category: 'Payment & Closure',        confidence: 'normal' },
  professional_communication:       { label: 'Professional Communication',                     category: 'Conduct & Process',        confidence: 'normal' },
  no_background_chitchat:           { label: 'No Background Chitchat',                         category: 'Conduct & Process',        confidence: 'low' },
  call_recording_compliance:        { label: 'Call Recording Compliance',                      category: 'Conduct & Process',        confidence: 'normal' },
  no_unauthorized_commitment:       { label: 'No Unauthorized Commitment',                     category: 'Honesty & Commitments',    confidence: 'normal' },
};

export interface HousingOwnerComplianceResult {
  totalCalls: number;
  overallScore: number;
  paramPassRate: Record<ComplianceParamKey, number>;
  byAgent: (Record<ComplianceParamKey, number> & { agentId: string; agentName: string; callCount: number; overallScore: number })[];
  cachedThrough: string | null;
}

export async function getHousingOwnerCompliance(filters: QualityFilters): Promise<HousingOwnerComplianceResult> {
  const { startDate, endDate } = filters;
  const rateSelect = CACHE_COLS.map(c => `ROUND(AVG(${c}) * 100, 1) AS ${c}`).join(',\n      ');

  const [summaryRow] = await queryMasmis<{ total_calls: number; overall_score: number | null } & Record<ComplianceParamKey, number>>(`
    SELECT COUNT(*) AS total_calls, ROUND(AVG(overall_score), 1) AS overall_score,
      ${rateSelect}
    FROM db_masmis.housing_owner_compliance_cache
    WHERE call_date BETWEEN ? AND ?
  `, [startDate, endDate]);

  const agentRows = await queryMasmis<{ agent_name: string; call_count: number; overall_score: number | null } & Record<ComplianceParamKey, number>>(`
    SELECT agent_name, COUNT(*) AS call_count, ROUND(AVG(overall_score), 1) AS overall_score,
      ${rateSelect}
    FROM db_masmis.housing_owner_compliance_cache
    WHERE call_date BETWEEN ? AND ? AND agent_name IS NOT NULL AND TRIM(agent_name) != ''
    GROUP BY agent_name
    ORDER BY overall_score DESC
  `, [startDate, endDate]);

  const [statusRow] = await queryMasmis<{ last_computed: string | null }>(
    `SELECT MAX(computed_at) AS last_computed FROM db_masmis.housing_owner_compliance_cache`
  );

  const paramPassRate = Object.fromEntries(CACHE_COLS.map(c => [c, Number(summaryRow?.[c] ?? 0)])) as Record<ComplianceParamKey, number>;

  return {
    totalCalls: Number(summaryRow?.total_calls ?? 0),
    overallScore: Number(summaryRow?.overall_score ?? 0),
    paramPassRate,
    byAgent: agentRows.map(r => ({
      agentId: String(r.agent_name),
      agentName: String(r.agent_name),
      callCount: Number(r.call_count),
      overallScore: Number(r.overall_score ?? 0),
      ...Object.fromEntries(CACHE_COLS.map(c => [c, Number(r[c] ?? 0)])) as Record<ComplianceParamKey, number>,
    })),
    cachedThrough: statusRow?.last_computed ? String(statusRow.last_computed) : null,
  };
}

export interface ComplianceDrillCall {
  callId: number;
  callDate: string;
  agentName: string;
  transcriptExcerpt: string;
}

// Drill-down behind clicking a parameter cell — mirrors getOutboundInsightDrill: pull the small,
// already-filtered set of call ids from the cache, then fetch TranscribeText for only those ids.
export async function getHousingOwnerComplianceDrill(
  filters: QualityFilters, parameter: ComplianceParamKey, pass: boolean, agentName?: string,
): Promise<ComplianceDrillCall[]> {
  const { startDate, endDate } = filters;
  if (!CACHE_COLS.includes(parameter)) return [];

  const agentClause = agentName ? 'AND agent_name = ?' : '';
  const params: (string | number)[] = [startDate, endDate, pass ? 1 : 0, ...(agentName ? [agentName] : [])];

  const cacheRows = await queryMasmis<{ call_id: number }>(`
    SELECT call_id FROM db_masmis.housing_owner_compliance_cache
    WHERE call_date BETWEEN ? AND ? AND ${parameter} = ? ${agentClause}
    ORDER BY call_date DESC
    LIMIT 200
  `, params);
  if (cacheRows.length === 0) return [];

  const ids = cacheRows.map(r => Number(r.call_id));
  const placeholders = ids.map(() => '?').join(',');
  const rows = await querySource<{ id: number; CallDate: string; AgentName: string | null; TranscribeText: string }>(
    `SELECT id, CallDate, AgentName, TranscribeText FROM db_external.CallDetails WHERE id IN (${placeholders})`,
    ids,
  );
  return rows.map(r => ({
    callId: Number(r.id),
    callDate: String(r.CallDate),
    agentName: String(r.AgentName ?? 'Unknown'),
    transcriptExcerpt: String(r.TranscribeText ?? '').slice(0, 2000),
  }));
}
