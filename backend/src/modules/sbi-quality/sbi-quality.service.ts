import { getMasmisPool, queryMasmis } from '../../lib/masmisDb';

// ─── Table setup ────────────────────────────────────────────────────────────
// Standalone dataset (not CallDetails/call_quality_assessment) for the "SBI Collection" process —
// a QA audit export with its own 25 audit-parameter columns, imported from an Excel sheet rather
// than fed live from VICIdial. See scripts/setup-sbi-quality.ts for the one-time table-creation +
// import step.
export async function initSbiQualityTable(): Promise<void> {
  try {
    const pool = getMasmisPool();
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS db_masmis.sbi_quality (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sr_no INT,
        call_date DATE NOT NULL,
        call_id VARCHAR(50) NOT NULL,
        scenario VARCHAR(100),
        agent_name VARCHAR(100),
        agent_phone VARCHAR(20),
        agent_id VARCHAR(50),
        customer_name VARCHAR(100),
        customer_phone VARCHAR(20),
        customer_id VARCHAR(50),
        bucket VARCHAR(20),
        language VARCHAR(30),
        duration_sec INT DEFAULT 0,
        transcript LONGTEXT,
        proper_opening TINYINT(1) DEFAULT 0,
        customer_verified TINYINT(1) DEFAULT 0,
        call_purpose_explained TINYINT(1) DEFAULT 0,
        payment_status_discussed TINYINT(1) DEFAULT 0,
        non_payment_reason_identified TINYINT(1) DEFAULT 0,
        appropriate_probing TINYINT(1) DEFAULT 0,
        payment_commitment_obtained TINYINT(1) DEFAULT 0,
        commitment_date_captured TINYINT(1) DEFAULT 0,
        customer_concern_acknowledged TINYINT(1) DEFAULT 0,
        agent_empathy TINYINT(1) DEFAULT 0,
        professional_tone TINYINT(1) DEFAULT 0,
        abusive_language_by_agent TINYINT(1) DEFAULT 0,
        threatening_behavior TINYINT(1) DEFAULT 0,
        coercion_or_pressure TINYINT(1) DEFAULT 0,
        otp_requested TINYINT(1) DEFAULT 0,
        pin_requested TINYINT(1) DEFAULT 0,
        cvv_requested TINYINT(1) DEFAULT 0,
        password_requested TINYINT(1) DEFAULT 0,
        unauthorized_payment_instruction TINYINT(1) DEFAULT 0,
        third_party_disclosure TINYINT(1) DEFAULT 0,
        payment_information_accuracy TINYINT(1) DEFAULT 0,
        dispute_handling TINYINT(1) DEFAULT 0,
        objection_handling TINYINT(1) DEFAULT 0,
        callback_handling TINYINT(1) DEFAULT 0,
        proper_call_closure TINYINT(1) DEFAULT 0,
        frustration_level VARCHAR(20),
        frustration_detected TINYINT(1) DEFAULT 0,
        customer_abusing TINYINT(1) DEFAULT 0,
        abusive_sentence TEXT,
        customer_sentiment VARCHAR(20),
        call_outcome VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_call_id (call_id),
        INDEX idx_call_date (call_date),
        INDEX idx_agent_name (agent_name),
        INDEX idx_scenario (scenario)
      )
    `);
    // Additive migration: the second call-data export added these columns. MySQL has no
    // ADD COLUMN IF NOT EXISTS, so check information_schema first and only add what's missing.
    const existing = await queryMasmis<{ COLUMN_NAME: string }>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'db_masmis' AND TABLE_NAME = 'sbi_quality'`,
    );
    const have = new Set(existing.map(r => r.COLUMN_NAME));
    for (const [col, def] of SBI_QUALITY_EXTRA_COLUMNS) {
      if (!have.has(col)) await pool.execute(`ALTER TABLE db_masmis.sbi_quality ADD COLUMN ${col} ${def}`);
    }
  } catch (err) {
    console.error('[startup] initSbiQualityTable failed:', err instanceof Error ? err.message : err);
  }
}

// Columns added by the second Call Data export (customer intent / payability / QA detail). Kept as
// (name, SQL type) pairs so the additive migration above and the import script share one source.
export const SBI_QUALITY_EXTRA_COLUMNS: [string, string][] = [
  ['call_datetime', 'DATETIME NULL'],
  ['customer_intent', 'VARCHAR(20) NULL'],
  ['customer_validity', 'VARCHAR(40) NULL'],
  ['genuine_payable', 'VARCHAR(5) NULL'],
  ['non_payable_reason', 'VARCHAR(120) NULL'],
  ['payment_status', 'VARCHAR(5) NULL'],
  ['payment_made', 'VARCHAR(5) NULL'],
  ['call_required', 'VARCHAR(10) NULL'],
  ['call_priority', 'VARCHAR(200) NULL'],
  ['recommended_next_action', 'TEXT NULL'],
  ['qa_statement', 'VARCHAR(40) NULL'],
  ['primary_emotion', 'VARCHAR(255) NULL'],
  ['frustration_reason', 'TEXT NULL'],
  ['anger_abuse_reason', 'VARCHAR(255) NULL'],
];

// Column order used both by the CREATE TABLE above and by the one-time Excel import script, so
// the two never drift apart.
export const SBI_QUALITY_COLUMNS = [
  'sr_no', 'call_date', 'call_id', 'scenario', 'agent_name', 'agent_phone', 'agent_id',
  'customer_name', 'customer_phone', 'customer_id', 'bucket', 'language', 'duration_sec', 'transcript',
  'proper_opening', 'customer_verified', 'call_purpose_explained', 'payment_status_discussed',
  'non_payment_reason_identified', 'appropriate_probing', 'payment_commitment_obtained',
  'commitment_date_captured', 'customer_concern_acknowledged', 'agent_empathy', 'professional_tone',
  'abusive_language_by_agent', 'threatening_behavior', 'coercion_or_pressure', 'otp_requested',
  'pin_requested', 'cvv_requested', 'password_requested', 'unauthorized_payment_instruction',
  'third_party_disclosure', 'payment_information_accuracy', 'dispute_handling', 'objection_handling',
  'callback_handling', 'proper_call_closure', 'frustration_level', 'frustration_detected',
  'customer_abusing', 'abusive_sentence', 'customer_sentiment', 'call_outcome',
] as const;

// The 16 parameters where 1 = good behavior (a normal "pass" flag).
export const POSITIVE_PARAMS = [
  'proper_opening', 'customer_verified', 'call_purpose_explained', 'payment_status_discussed',
  'non_payment_reason_identified', 'appropriate_probing', 'payment_commitment_obtained',
  'commitment_date_captured', 'customer_concern_acknowledged', 'agent_empathy', 'professional_tone',
  'payment_information_accuracy', 'dispute_handling', 'objection_handling', 'callback_handling',
  'proper_call_closure',
] as const;
export type PositiveParam = (typeof POSITIVE_PARAMS)[number];

// The 9 parameters where 1 = a compliance violation (1 is bad, 0 is the "pass"/compliant state).
export const NEGATIVE_PARAMS = [
  'abusive_language_by_agent', 'threatening_behavior', 'coercion_or_pressure', 'otp_requested',
  'pin_requested', 'cvv_requested', 'password_requested', 'unauthorized_payment_instruction',
  'third_party_disclosure',
] as const;
export type NegativeParam = (typeof NEGATIVE_PARAMS)[number];

export const POSITIVE_LABELS: Record<PositiveParam, string> = {
  proper_opening: 'Proper Opening',
  customer_verified: 'Customer Verified',
  call_purpose_explained: 'Call Purpose Explained',
  payment_status_discussed: 'Payment Status Discussed',
  non_payment_reason_identified: 'Non-Payment Reason Identified',
  appropriate_probing: 'Appropriate Probing',
  payment_commitment_obtained: 'Payment Commitment Obtained',
  commitment_date_captured: 'Commitment Date Captured',
  customer_concern_acknowledged: 'Customer Concern Acknowledged',
  agent_empathy: 'Agent Empathy',
  professional_tone: 'Professional Tone',
  payment_information_accuracy: 'Payment Information Accuracy',
  dispute_handling: 'Dispute Handling',
  objection_handling: 'Objection Handling',
  callback_handling: 'Callback Handling',
  proper_call_closure: 'Call Closure',
};
export const NEGATIVE_LABELS: Record<NegativeParam, string> = {
  abusive_language_by_agent: 'No Abusive Language (Agent)',
  threatening_behavior: 'No Threatening Behavior',
  coercion_or_pressure: 'No Coercion / Pressure',
  otp_requested: 'No OTP Requested',
  pin_requested: 'No PIN Requested',
  cvv_requested: 'No CVV Requested',
  password_requested: 'No Password Requested',
  unauthorized_payment_instruction: 'No Unauthorized Payment Instruction',
  third_party_disclosure: 'No Third-Party Disclosure',
};
// Same 25 parameters, phrased as the problem they represent — used for the "Top Issues" ranking.
const ISSUE_LABELS: Record<PositiveParam | NegativeParam, string> = {
  proper_opening: 'Improper call opening',
  customer_verified: 'Customer not verified',
  call_purpose_explained: 'Call purpose not explained',
  payment_status_discussed: 'Payment status not discussed',
  non_payment_reason_identified: 'Non-payment reason not identified',
  appropriate_probing: 'Insufficient probing',
  payment_commitment_obtained: 'Payment commitment not obtained',
  commitment_date_captured: 'Commitment date not captured',
  customer_concern_acknowledged: 'Customer concern not acknowledged',
  agent_empathy: 'Lack of agent empathy',
  professional_tone: 'Unprofessional tone',
  payment_information_accuracy: 'Payment information inaccurate',
  dispute_handling: 'Poor dispute handling',
  objection_handling: 'Poor objection handling',
  callback_handling: 'Poor callback handling',
  proper_call_closure: 'Improper call closure',
  abusive_language_by_agent: 'Abusive language by agent',
  threatening_behavior: 'Threatening behavior by agent',
  coercion_or_pressure: 'Coercion or pressure used',
  otp_requested: 'OTP requested (compliance risk)',
  pin_requested: 'PIN requested (compliance risk)',
  cvv_requested: 'CVV requested (compliance risk)',
  password_requested: 'Password requested (compliance risk)',
  unauthorized_payment_instruction: 'Unauthorized payment instruction',
  third_party_disclosure: 'Third-party disclosure',
};

export interface SbiQualityRow {
  id: number;
  sr_no: number;
  call_date: string;
  call_id: string;
  scenario: string;
  agent_name: string;
  agent_phone: string;
  agent_id: string;
  customer_name: string;
  customer_phone: string;
  customer_id: string;
  bucket: string;
  language: string;
  duration_sec: number;
  proper_opening: number; customer_verified: number; call_purpose_explained: number;
  payment_status_discussed: number; non_payment_reason_identified: number; appropriate_probing: number;
  payment_commitment_obtained: number; commitment_date_captured: number; customer_concern_acknowledged: number;
  agent_empathy: number; professional_tone: number; abusive_language_by_agent: number;
  threatening_behavior: number; coercion_or_pressure: number; otp_requested: number; pin_requested: number;
  cvv_requested: number; password_requested: number; unauthorized_payment_instruction: number;
  third_party_disclosure: number; payment_information_accuracy: number; dispute_handling: number;
  objection_handling: number; callback_handling: number; proper_call_closure: number;
  frustration_level: string; frustration_detected: number; customer_abusing: number;
  abusive_sentence: string | null; customer_sentiment: string; call_outcome: string;
  call_datetime: string | null; customer_intent: string; customer_validity: string; genuine_payable: string;
  non_payable_reason: string; payment_status: string; payment_made: string; call_required: string;
  call_priority: string; recommended_next_action: string; qa_statement: string; primary_emotion: string;
  frustration_reason: string; anger_abuse_reason: string | null;
}

export interface SbiQualityFilters {
  startDate: string;
  endDate: string;
  bucket?: string;
  agentName?: string;
  scenario?: string;
  callOutcome?: string;
  sentiment?: string;
  frustrationLevel?: string;
}

// The dataset is small (an audit-sample export, not a full call log), so it's simplest and most
// robust to fetch the filtered rows once per request and do every slide's aggregation in plain JS,
// rather than hand-writing 20+ separate GROUP BY queries that all have to agree on the same WHERE
// clause. If this table grows into the tens of thousands of rows, that calculus changes.
export async function fetchSbiQualityRows(filters: SbiQualityFilters): Promise<SbiQualityRow[]> {
  const clauses = ['call_date BETWEEN ? AND ?'];
  const params: unknown[] = [filters.startDate, filters.endDate];
  if (filters.bucket)           { clauses.push('bucket = ?');             params.push(filters.bucket); }
  if (filters.agentName)        { clauses.push('agent_name = ?');         params.push(filters.agentName); }
  if (filters.scenario)         { clauses.push('scenario = ?');           params.push(filters.scenario); }
  if (filters.callOutcome)      { clauses.push('call_outcome = ?');       params.push(filters.callOutcome); }
  if (filters.sentiment)        { clauses.push('customer_sentiment = ?'); params.push(filters.sentiment); }
  if (filters.frustrationLevel) { clauses.push('frustration_level = ?');  params.push(filters.frustrationLevel); }

  return queryMasmis<SbiQualityRow>(
    `SELECT * FROM db_masmis.sbi_quality WHERE ${clauses.join(' AND ')} ORDER BY call_date, id`,
    params,
  );
}

export async function getFilterOptions() {
  const [buckets, agents, scenarios, outcomes, sentiments, frustrations] = await Promise.all([
    queryMasmis<{ v: string }>('SELECT DISTINCT bucket AS v FROM db_masmis.sbi_quality ORDER BY v'),
    queryMasmis<{ v: string }>('SELECT DISTINCT agent_name AS v FROM db_masmis.sbi_quality ORDER BY v'),
    queryMasmis<{ v: string }>('SELECT DISTINCT scenario AS v FROM db_masmis.sbi_quality ORDER BY v'),
    queryMasmis<{ v: string }>('SELECT DISTINCT call_outcome AS v FROM db_masmis.sbi_quality ORDER BY v'),
    queryMasmis<{ v: string }>('SELECT DISTINCT customer_sentiment AS v FROM db_masmis.sbi_quality ORDER BY v'),
    queryMasmis<{ v: string }>('SELECT DISTINCT frustration_level AS v FROM db_masmis.sbi_quality ORDER BY v'),
  ]);
  return {
    buckets: buckets.map(r => r.v),
    agents: agents.map(r => r.v),
    scenarios: scenarios.map(r => r.v),
    callOutcomes: outcomes.map(r => r.v),
    sentiments: sentiments.map(r => r.v),
    frustrationLevels: frustrations.map(r => r.v),
  };
}

// ─── Pure aggregation helpers (no DB access — operate on an already-fetched rows array) ────────
function round1(n: number): number { return Math.round(n * 10) / 10; }
function pct(count: number, total: number): number { return total > 0 ? round1((count / total) * 100) : 0; }

function auditScore(r: SbiQualityRow): number {
  const sum = POSITIVE_PARAMS.reduce((a, c) => a + (Number(r[c]) || 0), 0);
  return sum / POSITIVE_PARAMS.length;
}
function avgAuditScorePct(rows: SbiQualityRow[]): number {
  if (!rows.length) return 0;
  return round1((rows.reduce((a, r) => a + auditScore(r), 0) / rows.length) * 100);
}
function avgDurationMin(rows: SbiQualityRow[]): number {
  if (!rows.length) return 0;
  return round1(rows.reduce((a, r) => a + (r.duration_sec || 0), 0) / rows.length / 60);
}
function countWhere(rows: SbiQualityRow[], pred: (r: SbiQualityRow) => boolean): number {
  return rows.reduce((a, r) => a + (pred(r) ? 1 : 0), 0);
}
function groupCount(rows: SbiQualityRow[], key: keyof SbiQualityRow): { name: string; count: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = String(r[key] ?? 'Unknown');
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}
// Weeks aligned to the calendar month (1-7 / 8-14 / 15-21 / 22-end), matching how this dashboard's
// date filter is normally used (a single month at a time) rather than a rolling 7-day window.
function weekBucket(dateStr: string): { key: number; label: string } {
  const d = new Date(dateStr);
  const day = d.getDate();
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  if (day <= 7)  return { key: 1, label: `Week 1 (1-7 ${month})` };
  if (day <= 14) return { key: 2, label: `Week 2 (8-14 ${month})` };
  if (day <= 21) return { key: 3, label: `Week 3 (15-21 ${month})` };
  return { key: 4, label: `Week 4 (22-${new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()} ${month})` };
}
function weeklyBuckets(rows: SbiQualityRow[]): { key: number; label: string; rows: SbiQualityRow[] }[] {
  const buckets = new Map<number, { key: number; label: string; rows: SbiQualityRow[] }>();
  for (const r of rows) {
    const { key, label } = weekBucket(r.call_date);
    if (!buckets.has(key)) buckets.set(key, { key, label, rows: [] });
    buckets.get(key)!.rows.push(r);
  }
  return [...buckets.values()].sort((a, b) => a.key - b.key);
}
// Compliance is measured across all 25 parameters (16 positive + 9 negative), each call
// contributing one "compliant" or "non-compliant" verdict per parameter — this is what backs the
// "N Parameters" donut, distinct from Audit Score which only looks at the 16 positive parameters.
function complianceCounts(rows: SbiQualityRow[]): { compliant: number; nonCompliant: number; total: number } {
  let compliant = 0;
  const total = rows.length * (POSITIVE_PARAMS.length + NEGATIVE_PARAMS.length);
  for (const r of rows) {
    for (const c of POSITIVE_PARAMS) if (Number(r[c]) === 1) compliant++;
    for (const c of NEGATIVE_PARAMS) if (Number(r[c]) !== 1) compliant++;
  }
  return { compliant, nonCompliant: total - compliant, total };
}
function agentDisplayName(agentName: string): string { return agentName; }

function baseKpis(rows: SbiQualityRow[]) {
  const total = rows.length;
  const ptpGiven = countWhere(rows, r => r.call_outcome === 'PTP Given');
  const paymentDone = countWhere(rows, r => r.call_outcome === 'Payment Done');
  const { nonCompliant, total: totalParams } = complianceCounts(rows);
  const uniqueCustomers = new Set(rows.map(r => r.customer_phone || r.customer_id)).size;
  // No monetary column exists in the source data — sentiment is mapped onto a 1-5 scale
  // (Positive=5, Neutral=3, Negative=1) as a stand-in "satisfaction" score, same idea as the
  // mockup's own "4.2 / 5" KPI.
  const sentScore = (s: string) => (s === 'Positive' ? 5 : s === 'Negative' ? 1 : 3);
  const satisfaction = total ? round1(rows.reduce((a, r) => a + sentScore(r.customer_sentiment), 0) / total) : 0;
  return {
    totalCalls: total,
    avgAuditScore: avgAuditScorePct(rows),
    avgCallDurationMin: avgDurationMin(rows),
    ptpGiven,
    ptpGivenPct: pct(ptpGiven, total),
    paymentDone,
    paymentDonePct: pct(paymentDone, total),
    nonCompliancePct: pct(nonCompliant, totalParams),
    uniqueCustomers,
    customerSatisfaction: satisfaction,
  };
}

// ─── Slide 1: Overview ──────────────────────────────────────────────────────
export function computeOverview(rows: SbiQualityRow[]) {
  const weeks = weeklyBuckets(rows);
  return {
    kpis: baseKpis(rows),
    callOutcomeDistribution: groupCount(rows, 'call_outcome'),
    scenarioDistribution: groupCount(rows, 'scenario'),
    weeklyTrends: weeks.map(w => ({
      label: w.label,
      totalCalls: w.rows.length,
      ptpGiven: countWhere(w.rows, r => r.call_outcome === 'PTP Given'),
      paymentDone: countWhere(w.rows, r => r.call_outcome === 'Payment Done'),
      auditScorePct: avgAuditScorePct(w.rows),
    })),
    customerSentiment: groupCount(rows, 'customer_sentiment'),
    frustrationLevel: groupCount(rows, 'frustration_level'),
    abusiveCalls: {
      abusive: countWhere(rows, r => Number(r.customer_abusing) === 1),
      nonAbusive: countWhere(rows, r => Number(r.customer_abusing) !== 1),
    },
  };
}

// ─── Slide 2: Scenario Analysis ─────────────────────────────────────────────
export function computeScenarioAnalysis(rows: SbiQualityRow[]) {
  const scenarios = [...new Set(rows.map(r => r.scenario))];
  const weeks = weeklyBuckets(rows);
  const topScenariosForTrend = groupCount(rows, 'scenario').slice(0, 4).map(s => s.name);

  const perScenario = scenarios.map(scenario => {
    const scenRows = rows.filter(r => r.scenario === scenario);
    return {
      scenario,
      callCount: scenRows.length,
      avgDurationMin: avgDurationMin(scenRows),
      auditScorePct: avgAuditScorePct(scenRows),
      nonCompliancePct: pct(complianceCounts(scenRows).nonCompliant, complianceCounts(scenRows).total),
      sentiment: {
        positive: pct(countWhere(scenRows, r => r.customer_sentiment === 'Positive'), scenRows.length),
        neutral: pct(countWhere(scenRows, r => r.customer_sentiment === 'Neutral'), scenRows.length),
        negative: pct(countWhere(scenRows, r => r.customer_sentiment === 'Negative'), scenRows.length),
      },
      outcomeBreakdown: groupCount(scenRows, 'call_outcome'),
    };
  });

  const frustratedRows = rows.filter(r => r.frustration_level === 'High' || r.frustration_level === 'Medium');

  return {
    kpis: baseKpis(rows),
    scenarioDistribution: groupCount(rows, 'scenario'),
    scenarioTrendWeekly: weeks.map(w => {
      const point: Record<string, number | string> = { label: w.label };
      for (const s of topScenariosForTrend) point[s] = countWhere(w.rows, r => r.scenario === s);
      return point;
    }),
    topScenariosForTrend,
    scenarioVsOutcome: perScenario.map(s => ({ scenario: s.scenario, callCount: s.callCount, outcomeBreakdown: s.outcomeBreakdown })),
    avgDurationByScenario: perScenario.map(s => ({ scenario: s.scenario, avgDurationMin: s.avgDurationMin })).sort((a, b) => b.avgDurationMin - a.avgDurationMin),
    auditScoreByScenario: perScenario.map(s => ({ scenario: s.scenario, auditScorePct: s.auditScorePct })).sort((a, b) => b.auditScorePct - a.auditScorePct),
    sentimentByScenario: perScenario.map(s => ({ scenario: s.scenario, ...s.sentiment })),
    frustration: {
      frustrationDetected: countWhere(rows, r => Number(r.frustration_detected) === 1),
      frustrationDetectedPct: pct(countWhere(rows, r => Number(r.frustration_detected) === 1), rows.length),
      highFrustration: countWhere(rows, r => r.frustration_level === 'High'),
      highFrustrationPct: pct(countWhere(rows, r => r.frustration_level === 'High'), rows.length),
      customerAbusing: countWhere(rows, r => Number(r.customer_abusing) === 1),
      customerAbusingPct: pct(countWhere(rows, r => Number(r.customer_abusing) === 1), rows.length),
    },
    topAbusiveSentences: rows
      .filter(r => r.abusive_sentence && r.abusive_sentence.trim())
      .slice(0, 5)
      .map(r => ({ sentence: r.abusive_sentence as string, scenario: r.scenario, callId: r.call_id })),
    top5ScenariosByNonCompliance: [...perScenario].sort((a, b) => b.nonCompliancePct - a.nonCompliancePct).slice(0, 5)
      .map(s => ({ scenario: s.scenario, nonCompliancePct: s.nonCompliancePct })),
    topFrustratedReasons: groupCount(frustratedRows, 'scenario').slice(0, 7)
      .map(s => ({ reason: s.name, count: s.count, pct: pct(s.count, frustratedRows.length) })),
  };
}

// ─── Slide 3: Agent Performance ─────────────────────────────────────────────
// No monetary column exists in the source export — this uses a fixed, clearly-labeled "(Demo)"
// average collection amount per completed payment, the same convention the reference mockup uses
// for its own "Total Payment Amount (Demo)" KPI, since every identifier in this dataset
// (DEMO-AGT-*, dummy phone numbers, scripted transcripts) is already synthetic.
const DEMO_AVG_PAYMENT_AMOUNT = 4850;

// Column set behind "Agent-wise Parameters Score" — the same 16 parameters that feed Audit Score
// itself (see POSITIVE_PARAMS/auditScore above), broken out per-agent instead of averaged into one
// number, so a low audit score can be traced to the specific parameter(s) dragging it down.
export const PARAM_SCORE_COLUMNS = POSITIVE_PARAMS.map(c => ({ key: c, label: POSITIVE_LABELS[c] }));

export function computeAgentPerformance(rows: SbiQualityRow[]) {
  const agents = [...new Set(rows.map(r => r.agent_name))];
  const perAgent = agents.map(agentName => {
    const aRows = rows.filter(r => r.agent_name === agentName);
    const ptpGiven = countWhere(aRows, r => r.call_outcome === 'PTP Given');
    const paymentDone = countWhere(aRows, r => r.call_outcome === 'Payment Done');
    const { nonCompliant, total } = complianceCounts(aRows);
    const paramScores: Record<string, number> = {};
    for (const c of POSITIVE_PARAMS) paramScores[c] = pct(countWhere(aRows, r => Number(r[c]) === 1), aRows.length);
    return {
      agentName: agentDisplayName(agentName),
      agentId: aRows[0]?.agent_id ?? '',
      totalCalls: aRows.length,
      avgDurationMin: avgDurationMin(aRows),
      auditScorePct: avgAuditScorePct(aRows),
      ptpGiven,
      paymentDone,
      ptpConversionPct: pct(paymentDone, ptpGiven || 1),
      nonCompliantCount: nonCompliant,
      compliancePct: pct(total - nonCompliant, total),
      demoCollectionAmount: paymentDone * DEMO_AVG_PAYMENT_AMOUNT,
      paramScores,
    };
  }).sort((a, b) => b.auditScorePct - a.auditScorePct);

  const totalPaymentDone = countWhere(rows, r => r.call_outcome === 'Payment Done');

  return {
    kpis: {
      ...baseKpis(rows),
      totalAgents: agents.length,
    },
    parameterColumns: PARAM_SCORE_COLUMNS,
    agentTable: perAgent,
    collectionEffectiveness: {
      totalDemoAmount: totalPaymentDone * DEMO_AVG_PAYMENT_AMOUNT,
      avgDemoAmount: DEMO_AVG_PAYMENT_AMOUNT,
      totalPaymentDone,
    },
    qualityMatrix: perAgent.map(a => ({
      agentName: a.agentName, avgDurationMin: a.avgDurationMin, auditScorePct: a.auditScorePct, totalCalls: a.totalCalls,
    })),
    top5ByCollectionAmount: [...perAgent].sort((a, b) => b.demoCollectionAmount - a.demoCollectionAmount).slice(0, 5)
      .map(a => ({ agentName: a.agentName, demoCollectionAmount: a.demoCollectionAmount })),
    bottom5ByAuditScore: [...perAgent].sort((a, b) => a.auditScorePct - b.auditScorePct).slice(0, 5)
      .map(a => ({ agentName: a.agentName, auditScorePct: a.auditScorePct })),
  };
}

// ─── Slide 4: Quality & Insights ────────────────────────────────────────────
export function computeQualityInsights(rows: SbiQualityRow[]) {
  const total = rows.length;
  const scorecard = [
    ...POSITIVE_PARAMS.map(c => ({ key: c, label: POSITIVE_LABELS[c], passRatePct: pct(countWhere(rows, r => Number(r[c]) === 1), total) })),
    ...NEGATIVE_PARAMS.map(c => ({ key: c, label: NEGATIVE_LABELS[c], passRatePct: pct(countWhere(rows, r => Number(r[c]) !== 1), total) })),
  ].sort((a, b) => b.passRatePct - a.passRatePct);

  const compliance = complianceCounts(rows);
  const overallScore = avgAuditScorePct(rows);
  const grade = overallScore >= 90 ? 'A+ Excellent' : overallScore >= 80 ? 'A Good Performance' : overallScore >= 65 ? 'B Needs Improvement' : 'C At Risk';

  const weeks = weeklyBuckets(rows);
  const allIssueCols = [...POSITIVE_PARAMS, ...NEGATIVE_PARAMS];
  const topIssues = allIssueCols
    .map(c => {
      const failCount = POSITIVE_PARAMS.includes(c as PositiveParam)
        ? countWhere(rows, r => Number(r[c]) !== 1)
        : countWhere(rows, r => Number(r[c]) === 1);
      return { key: c, issue: ISSUE_LABELS[c], count: failCount };
    })
    .filter(x => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const frustratedRows = rows.filter(r => r.frustration_level === 'High' || r.frustration_level === 'Medium');

  return {
    kpis: baseKpis(rows),
    overallQualityScore: overallScore,
    qualityGrade: grade,
    parameterScorecard: scorecard,
    compliance: { compliant: compliance.compliant, nonCompliant: compliance.nonCompliant, total: compliance.total, compliantPct: pct(compliance.compliant, compliance.total), nonCompliantPct: pct(compliance.nonCompliant, compliance.total) },
    customerBehavior: groupCount(rows, 'customer_sentiment'),
    frustrationTrendWeekly: weeks.map(w => ({
      label: w.label,
      high: countWhere(w.rows, r => r.frustration_level === 'High'),
      medium: countWhere(w.rows, r => r.frustration_level === 'Medium'),
      low: countWhere(w.rows, r => r.frustration_level === 'Low'),
    })),
    abusiveCallsTrendWeekly: weeks.map(w => ({ label: w.label, count: countWhere(w.rows, r => Number(r.customer_abusing) === 1) })),
    avgAuditScoreTrendWeekly: weeks.map(w => ({ label: w.label, auditScorePct: avgAuditScorePct(w.rows) })),
    sentimentTrendWeekly: weeks.map(w => ({
      label: w.label,
      positivePct: pct(countWhere(w.rows, r => r.customer_sentiment === 'Positive'), w.rows.length),
      neutralPct: pct(countWhere(w.rows, r => r.customer_sentiment === 'Neutral'), w.rows.length),
      negativePct: pct(countWhere(w.rows, r => r.customer_sentiment === 'Negative'), w.rows.length),
    })),
    topIssues,
    topFrustratedReasons: groupCount(frustratedRows, 'scenario').slice(0, 7).map(s => ({ reason: s.name, count: s.count, pct: pct(s.count, frustratedRows.length || 1) })),
    abusiveExamples: rows.filter(r => r.abusive_sentence && r.abusive_sentence.trim()).slice(0, 5)
      .map(r => ({ sentence: r.abusive_sentence as string, callId: r.call_id })),
    keyInsights: buildKeyInsights(rows),
  };
}

function buildKeyInsights(rows: SbiQualityRow[]): string[] {
  const total = rows.length;
  if (!total) return [];
  const insights: string[] = [];
  const ptpGiven = countWhere(rows, r => r.call_outcome === 'PTP Given');
  const paymentDone = countWhere(rows, r => r.call_outcome === 'Payment Done');
  if (ptpGiven > 0) {
    insights.push(`${pct(ptpGiven, total)}% of customers gave a PTP, of which ${pct(paymentDone, ptpGiven)}% converted to an actual payment.`);
  }
  const frustratedRows = rows.filter(r => r.frustration_level === 'High' || r.frustration_level === 'Medium');
  const topFrustrationReason = groupCount(frustratedRows, 'scenario')[0];
  if (topFrustrationReason) {
    insights.push(`"${topFrustrationReason.name}" is the leading scenario behind frustrated calls (${pct(topFrustrationReason.count, frustratedRows.length)}% of them).`);
  }
  const abusingPct = pct(countWhere(rows, r => Number(r.customer_abusing) === 1), total);
  if (abusingPct > 0) insights.push(`${abusingPct}% of calls had abusive language detected from the customer.`);
  const overallScore = avgAuditScorePct(rows);
  insights.push(`Overall audit score for this period is ${overallScore}%.`);
  const weakest = POSITIVE_PARAMS.map(c => ({ label: POSITIVE_LABELS[c], pct: pct(countWhere(rows, r => Number(r[c]) === 1), total) })).sort((a, b) => a.pct - b.pct)[0];
  if (weakest) insights.push(`"${weakest.label}" is the weakest audit parameter at ${weakest.pct}% — a good focus area for coaching.`);
  const sensitiveCount = countWhere(rows, r => [
    'otp_requested', 'pin_requested', 'cvv_requested', 'password_requested', 'unauthorized_payment_instruction',
  ].some(c => Number(r[c as NegativeParam]) === 1));
  if (sensitiveCount > 0) insights.push(`${sensitiveCount} call(s) involved a request for OTP/PIN/CVV/password or an unauthorized payment instruction — flag for immediate compliance review.`);
  return insights;
}

// ─── Drill-down: any chart/metric click resolves to a (type, value) pair that selects the matching
// calls from the already-fetched, already-filtered rows, then summarizes them. No extra SQL needed.
export type DrillType =
  | 'kpi' | 'outcome' | 'scenario' | 'agent' | 'sentiment' | 'frustration' | 'abusive'
  | 'frustratedScenario' | 'week' | 'param' | 'agentParam' | 'compliance' | 'call'
  | 'intent' | 'genuine' | 'payOutcome' | 'nonActionableReason' | 'neutralOutcome' | 'disposition' | 'needCall' | 'funnel' | 'qaStatement';

function matchesDrill(r: SbiQualityRow, type: DrillType, value: string): boolean {
  switch (type) {
    case 'kpi':
      if (value === 'ptp') return r.call_outcome === 'PTP Given';
      if (value === 'payment') return r.call_outcome === 'Payment Done';
      if (value === 'abusing') return Number(r.customer_abusing) === 1;
      if (value === 'highFrustration') return r.frustration_level === 'High';
      if (value === 'frustrationDetected') return Number(r.frustration_detected) === 1;
      if (value === 'nonCompliant') return POSITIVE_PARAMS.some(c => Number(r[c]) !== 1) || NEGATIVE_PARAMS.some(c => Number(r[c]) === 1);
      return true;
    case 'outcome': return r.call_outcome === value;
    case 'scenario': return r.scenario === value;
    case 'agent': return r.agent_name === value;
    case 'sentiment': return r.customer_sentiment === value;
    case 'frustration': return r.frustration_level === value;
    case 'abusive': return value === 'Abusive' ? Number(r.customer_abusing) === 1 : Number(r.customer_abusing) !== 1;
    case 'frustratedScenario': return (r.frustration_level === 'High' || r.frustration_level === 'Medium') && r.scenario === value;
    case 'week': return weekBucket(String(r.call_date)).label === value;
    case 'param':
      if ((POSITIVE_PARAMS as readonly string[]).includes(value)) return Number(r[value as PositiveParam]) !== 1;
      return Number(r[value as NegativeParam]) === 1;
    case 'agentParam': {
      const [agent, key] = value.split('|');
      return r.agent_name === agent && matchesDrill(r, 'param', key);
    }
    case 'compliance':
      return value === 'nonCompliant'
        ? matchesDrill(r, 'kpi', 'nonCompliant')
        : !matchesDrill(r, 'kpi', 'nonCompliant');
    case 'call': return r.call_id === value;
    case 'intent': return r.customer_intent === value;
    case 'genuine': return r.genuine_payable === value;
    case 'payOutcome': return isGenuine(r) && payOutcomeOf(r) === value;
    case 'nonActionableReason': return !isGenuine(r) && r.non_payable_reason === value;
    case 'neutralOutcome': return r.customer_intent === 'Neutral' && r.call_outcome === value;
    case 'disposition': return r.non_payable_reason === value;
    case 'needCall': return value === 'Need to call' ? needsCall(r) : r.call_required === value;
    case 'funnel':
      if (value === 'total') return true;
      if (value === 'genuine') return isGenuine(r);
      if (value === 'positive') return isGenuine(r) && r.customer_intent === 'Positive';
      if (value === 'ptp') return isGenuine(r) && payOutcomeOf(r) === 'PTP Given';
      return isGenuine(r) && payOutcomeOf(r) === 'Payment Done';
    case 'qaStatement': return r.qa_statement === value;
  }
}

function dayKey(d: unknown): string {
  const dt = d instanceof Date ? d : new Date(String(d));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

export function computeDrill(rows: SbiQualityRow[], type: DrillType, value: string) {
  const matched = rows.filter(r => matchesDrill(r, type, value));
  const total = matched.length;
  const dayMap = new Map<string, SbiQualityRow[]>();
  for (const r of matched) {
    const k = dayKey(r.call_date);
    if (!dayMap.has(k)) dayMap.set(k, []);
    dayMap.get(k)!.push(r);
  }
  const byDay = [...dayMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, dr]) => ({
    date,
    calls: dr.length,
    auditScorePct: avgAuditScorePct(dr),
    ptpGiven: countWhere(dr, r => r.call_outcome === 'PTP Given'),
    paymentDone: countWhere(dr, r => r.call_outcome === 'Payment Done'),
    abusive: countWhere(dr, r => Number(r.customer_abusing) === 1),
  }));
  const { nonCompliant, total: paramTotal } = complianceCounts(matched);
  return {
    total,
    kpis: {
      calls: total,
      auditScorePct: avgAuditScorePct(matched),
      avgDurationMin: avgDurationMin(matched),
      ptpGiven: countWhere(matched, r => r.call_outcome === 'PTP Given'),
      paymentDone: countWhere(matched, r => r.call_outcome === 'Payment Done'),
      abusive: countWhere(matched, r => Number(r.customer_abusing) === 1),
      nonCompliancePct: pct(nonCompliant, paramTotal),
      uniqueCustomers: new Set(matched.map(r => r.customer_phone || r.customer_id)).size,
    },
    byDay,
    breakdowns: {
      outcome: groupCount(matched, 'call_outcome'),
      scenario: groupCount(matched, 'scenario'),
      agent: groupCount(matched, 'agent_name'),
      sentiment: groupCount(matched, 'customer_sentiment'),
      frustration: groupCount(matched, 'frustration_level'),
    },
    calls: matched.slice(0, 300).map(r => ({
      callId: r.call_id,
      date: dayKey(r.call_date),
      agent: r.agent_name,
      scenario: r.scenario,
      outcome: r.call_outcome,
      sentiment: r.customer_sentiment,
      frustration: r.frustration_level,
      auditScorePct: round1(auditScore(r) * 100),
      durationMin: round1((r.duration_sec || 0) / 60),
      abusive: Number(r.customer_abusing) === 1,
      abusiveSentence: r.abusive_sentence ?? '',
      failedParams: POSITIVE_PARAMS.filter(c => Number(r[c]) !== 1).map(c => POSITIVE_LABELS[c])
        .concat(NEGATIVE_PARAMS.filter(c => Number(r[c]) === 1).map(c => NEGATIVE_LABELS[c].replace(/^No /, ''))),
    })),
    callsTruncated: total > 300,
  };
}

// ─── Customer Intent slide (second call-data export) ─────────────────────────────────────────
// Genuine = the agent reached a valid, payable customer. Non-actionable = wrong number, refusal,
// already-paid claim, invalid PIN, etc. Payment outcome is only meaningful for genuine customers.
function isGenuine(r: SbiQualityRow): boolean { return r.genuine_payable === 'Yes'; }
function payOutcomeOf(r: SbiQualityRow): 'Payment Done' | 'PTP Given' | 'Pending' | 'Other' {
  if (r.payment_status === 'Yes') return 'Payment Done';
  if (r.non_payable_reason === 'PTP') return 'PTP Given';
  if ((r.non_payable_reason ?? '').startsWith('Pending')) return 'Pending';
  return 'Other';
}
function needsCall(r: SbiQualityRow): boolean { return r.call_required === 'High' || r.call_required === 'Medium'; }
const QA_STATEMENTS = ['Calm / Positive', 'Concerned', 'Frustrated', 'Angry', 'Abusive'] as const;

export function computeIntent(rows: SbiQualityRow[]) {
  const total = rows.length;
  const genuine = rows.filter(isGenuine);
  const nonActionable = rows.filter(r => !isGenuine(r));
  const intentN = (v: string) => countWhere(rows, r => r.customer_intent === v);
  const paid = countWhere(rows, r => payOutcomeOf(r) === 'Payment Done');
  const ptp = countWhere(rows, r => payOutcomeOf(r) === 'PTP Given');
  const needCall = countWhere(rows, needsCall);

  const weeks = weeklyBuckets(rows);
  const sentimentTrendWeekly = weeks.map(w => {
    const point: Record<string, number | string> = { label: w.label };
    for (const s of QA_STATEMENTS) point[s] = countWhere(w.rows, r => r.qa_statement === s);
    return point;
  });

  const agents = [...new Set(rows.map(r => r.agent_name))].map(name => {
    const a = rows.filter(r => r.agent_name === name);
    const g = a.filter(isGenuine).length;
    const pd = countWhere(a, r => payOutcomeOf(r) === 'Payment Done');
    return {
      agentName: name,
      totalCalls: a.length,
      genuine: g,
      paymentDone: pd,
      ptpGiven: countWhere(a, r => payOutcomeOf(r) === 'PTP Given'),
      conversionPct: pct(pd, g),
    };
  }).sort((x, y) => y.conversionPct - x.conversionPct || y.paymentDone - x.paymentDone).slice(0, 10);

  const genuineCount = genuine.length;
  const kpis = {
    totalCalls: total,
    genuineCustomers: genuineCount, genuinePct: pct(genuineCount, total),
    nonActionable: nonActionable.length, nonActionablePct: pct(nonActionable.length, total),
    positiveIntent: intentN('Positive'), positiveIntentPct: pct(intentN('Positive'), total),
    neutralIntent: intentN('Neutral'), neutralIntentPct: pct(intentN('Neutral'), total),
    negativeIntent: intentN('Negative'), negativeIntentPct: pct(intentN('Negative'), total),
    paymentDone: paid, paymentDonePct: pct(paid, total),
    ptpGiven: ptp, ptpGivenPct: pct(ptp, total),
    needToCall: needCall, needToCallPct: pct(needCall, total),
  };

  const funnel = [
    { stage: 'total', label: 'Total Calls', count: total },
    { stage: 'genuine', label: 'Genuine Customers', count: genuineCount },
    { stage: 'positive', label: 'Positive Intent', count: countWhere(genuine, r => r.customer_intent === 'Positive') },
    { stage: 'ptp', label: 'PTP Given', count: countWhere(genuine, r => payOutcomeOf(r) === 'PTP Given') },
    { stage: 'paid', label: 'Payment Done', count: countWhere(genuine, r => payOutcomeOf(r) === 'Payment Done') },
  ].map(s => ({ ...s, pct: pct(s.count, total) }));

  const pending = countWhere(genuine, r => payOutcomeOf(r) === 'Pending');
  const insights: string[] = [];
  insights.push(`${kpis.genuinePct}% of calls are genuine customers and actionable.`);
  insights.push(`${kpis.positiveIntentPct}% of customers have shown positive payment intent.`);
  insights.push(`${pct(intentN('Neutral'), total)}% of customers are neutral — mostly ${groupCount(rows.filter(r => r.customer_intent === 'Neutral'), 'call_outcome')[0]?.name ?? 'undecided'}.`);
  insights.push(`${kpis.nonActionablePct}% of calls are non-actionable (wrong number, refusal, invalid PIN, etc.).`);
  insights.push(`${kpis.paymentDonePct}% of customers have already made the payment.`);
  insights.push(`${kpis.ptpGivenPct}% of customers have given a PTP, a strong conversion opportunity.`);
  const abusive = countWhere(rows, r => Number(r.customer_abusing) === 1);
  insights.push(`${pct(abusive, total)}% of calls were abusive, mainly around payment disputes and repeated calls.`);
  const topAgent = agents[0];
  if (topAgent) insights.push(`${topAgent.agentName} has the best conversion rate (${topAgent.conversionPct}%).`);
  insights.push(`Focus on follow-up for ${pending} pending genuine customers.`);
  insights.push(`${kpis.needToCallPct}% of calls need a follow-up call (High/Medium priority).`);

  return {
    kpis,
    intentDistribution: ['Positive', 'Neutral', 'Negative'].map(name => ({ name, count: intentN(name) })),
    genuineDistribution: [
      { name: 'Genuine / Payable', count: genuineCount },
      { name: 'Non-Actionable', count: nonActionable.length },
    ],
    payOutcomeDistribution: (['Payment Done', 'PTP Given', 'Pending', 'Other'] as const)
      .map(name => ({ name, count: countWhere(genuine, r => payOutcomeOf(r) === name) }))
      .filter(x => x.count > 0),
    qaSentimentDistribution: QA_STATEMENTS.map(name => ({ name, count: countWhere(rows, r => r.qa_statement === name) })),
    sentimentTrendWeekly,
    sentimentStatements: [...QA_STATEMENTS],
    nonActionableReasons: groupCount(nonActionable, 'non_payable_reason'),
    neutralReasons: groupCount(rows.filter(r => r.customer_intent === 'Neutral'), 'call_outcome'),
    disposition: groupCount(rows, 'non_payable_reason').map(d => ({ ...d, pct: pct(d.count, total) })),
    funnel,
    agents,
    insights,
  };
}
