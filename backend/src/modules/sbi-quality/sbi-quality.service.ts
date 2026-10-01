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
  } catch (err) {
    console.error('[startup] initSbiQualityTable failed:', err instanceof Error ? err.message : err);
  }
}

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
      return { issue: ISSUE_LABELS[c], count: failCount };
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
