import mysql from 'mysql2/promise';
import { querySource } from '../../lib/sourceDb';
import { queryMasmis, getMasmisPool } from '../../lib/masmisDb';
import { getOutboundCallTranscript } from './quality.service';

// ─── BellaVita Outbound — AI Compliance & SOP ──────────────────────────────────
// This module is deliberately an INGESTION + AGGREGATION layer only — it does not call any LLM
// itself. There is no existing transcript-analysis pipeline anywhere in this backend (verified: no
// AI provider SDK, no API key, no outbound HTTP call to an LLM anywhere in the codebase); every
// other "AI Quality" feature in this app works the same way — reading columns an external system
// already wrote into db_external.CallDetails. Per explicit product decision, this feature follows
// that same shape: an external audit system (vendor script, internal job, whatever) POSTs one
// call's structured audit result to POST /quality/bellavita-compliance/ingest, and everything below
// stores/validates/aggregates/serves that data. See parameter master seed below for the source of
// truth the external system should audit against and report back with (GET .../parameters).

const BELLAVITA_CLIENT_ID = 375;
const VALID_RESULTS = new Set(['PASS', 'FAIL', 'REVIEW', 'NA']);
// No explicit threshold was specified for "compliant" vs "non-compliant" (as opposed to critical,
// which is unambiguous — any critical parameter FAIL). 80% is a reasonable default split; expose it
// as a named constant so it's a one-line change, not a hunt through the aggregation query.
const COMPLIANT_SCORE_THRESHOLD = 80;

// ─── Parameter master (the 50 BellaVita Outbound SOP/compliance parameters) ────────────────────
export interface ComplianceParameterDef {
  code: string;
  name: string;
  category: string;
  critical: boolean;
  derived: boolean;
  displayOrder: number;
  active: boolean;
  description: string | null;
}

// code, name, category, critical, derived
const PARAMETER_SEED: [string, string, string, boolean, boolean][] = [
  // A. Opening & Customer Handling
  ['OPENING', 'Proper Opening', 'OPENING', false, false],
  ['AGENT_INTRODUCTION', 'Agent Introduction', 'OPENING', false, false],
  ['BRAND_IDENTIFICATION', 'BellaVita Identification', 'OPENING', false, false],
  ['CALL_PURPOSE', 'Call Purpose', 'OPENING', false, false],
  ['REPEAT_CUSTOMER_HANDLING', 'Repeat Customer Handling', 'OPENING', false, false],
  ['FEEDBACK', 'Feedback', 'OPENING', false, false],
  ['CUSTOMER_VERIFICATION', 'Customer Verification', 'OPENING', false, false],
  ['REQUIREMENT_UNDERSTANDING', 'Requirement Understanding', 'OPENING', false, false],
  ['ACTIVE_LISTENING', 'Active Listening', 'OPENING', false, false],
  // B. Product & Offer Compliance
  ['PRODUCT_INFORMATION', 'Product Information', 'PRODUCT', false, false],
  ['PRODUCT_NAME_ACCURACY', 'Product Name Accuracy', 'PRODUCT', false, false],
  ['PRODUCT_VARIANT_ACCURACY', 'Product Variant / Size Accuracy', 'PRODUCT', false, false],
  ['PRODUCT_BENEFIT_ACCURACY', 'Product Benefit Accuracy', 'PRODUCT', false, false],
  ['PRICE_COMMUNICATION', 'Price Communication', 'PRODUCT', false, false],
  ['OFFER_COMMUNICATION', 'Offer Communication', 'PRODUCT', false, false],
  ['DISCOUNT_ACCURACY', 'Discount Accuracy', 'PRODUCT', false, false],
  ['UNAUTHORIZED_OFFER', 'Unauthorized Offer', 'PRODUCT', true, false],
  ['FALSE_PRODUCT_CLAIM', 'False Product Claim', 'PRODUCT', true, false],
  ['MISLEADING_INFORMATION', 'Misleading Information', 'PRODUCT', true, false],
  // C. Payment Compliance
  ['COD_PITCH', 'COD Pitch', 'PAYMENT', false, false],
  ['PREPAID_PITCH', 'Prepaid Pitch', 'PAYMENT', false, false],
  ['BOTH_PAYMENT_PITCH', 'Both COD + Prepaid Pitch', 'PAYMENT', false, true],
  ['PAYMENT_OPTION_HANDLING', 'Payment Option Handling', 'PAYMENT', false, false],
  ['COD_CHARGES_COMMUNICATION', 'COD Charges Communication', 'PAYMENT', false, false],
  ['PREPAID_BENEFIT_COMMUNICATION', 'Prepaid Benefit Communication', 'PAYMENT', false, false],
  ['PAYMENT_INFO_ACCURACY', 'Payment Information Accuracy', 'PAYMENT', false, false],
  ['UNAUTHORIZED_PAYMENT_COMMITMENT', 'Unauthorized Payment Commitment', 'PAYMENT', true, false],
  // D. Sales Process
  ['PRODUCT_RECOMMENDATION', 'Product Recommendation', 'SALES', false, false],
  ['UPSELLING', 'Upselling', 'SALES', false, false],
  ['CROSS_SELLING', 'Cross-selling', 'SALES', false, false],
  ['OBJECTION_HANDLING', 'Objection Handling', 'SALES', false, false],
  ['CUSTOMER_CONCERN_ACK', 'Customer Concern Acknowledgement', 'SALES', false, false],
  ['CLOSING', 'Closing', 'SALES', false, false],
  ['ORDER_CONFIRMATION', 'Order Confirmation', 'SALES', false, false],
  // E. Critical Compliance
  ['FALSE_INFORMATION', 'False Information', 'CRITICAL', true, false],
  ['FALSE_PRODUCT_COMMITMENT', 'False Product Commitment', 'CRITICAL', true, false],
  ['FALSE_DELIVERY_COMMITMENT', 'False Delivery Commitment', 'CRITICAL', true, false],
  ['FALSE_REFUND_COMMITMENT', 'False Refund/Replacement Commitment', 'CRITICAL', true, false],
  ['UNAUTHORIZED_DISCOUNT', 'Unauthorized Discount', 'CRITICAL', true, false],
  ['MISLEADING_CUSTOMER', 'Misleading Customer', 'CRITICAL', true, false],
  ['FORCED_SELLING', 'Forced Selling', 'CRITICAL', true, false],
  ['AGGRESSIVE_SELLING', 'Aggressive Selling', 'CRITICAL', true, false],
  ['ABUSIVE_COMMUNICATION', 'Abusive/Rude Communication', 'CRITICAL', true, false],
  ['CUSTOMER_DATA_MISUSE', 'Customer Data Misuse', 'CRITICAL', true, false],
  // F. Soft Skills
  ['PROFESSIONAL_COMMUNICATION', 'Professional Communication', 'SOFT_SKILLS', false, false],
  ['APPROPRIATE_TONE', 'Appropriate Tone', 'SOFT_SKILLS', false, false],
  ['EMPATHY', 'Empathy', 'SOFT_SKILLS', false, false],
  ['PERSONALIZATION', 'Personalization', 'SOFT_SKILLS', false, false],
  ['SPEECH_CLARITY', 'Speech Clarity', 'SOFT_SKILLS', false, false],
  ['CUSTOMER_FRIENDLY_BEHAVIOUR', 'Customer-Friendly Behaviour', 'SOFT_SKILLS', false, false],
];

export async function initBellavitaComplianceTables(): Promise<void> {
  const pool = getMasmisPool();
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS db_masmis.bellavita_compliance_parameters (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(60) NOT NULL,
        name VARCHAR(150) NOT NULL,
        category VARCHAR(30) NOT NULL,
        critical TINYINT(1) NOT NULL DEFAULT 0,
        derived TINYINT(1) NOT NULL DEFAULT 0,
        display_order INT NOT NULL DEFAULT 0,
        active TINYINT(1) NOT NULL DEFAULT 1,
        description TEXT,
        created_at DATETIME DEFAULT NOW(),
        updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
        UNIQUE KEY uq_code (code)
      )
    `);
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS db_masmis.bellavita_call_audit_summary (
        id INT AUTO_INCREMENT PRIMARY KEY,
        call_id VARCHAR(100) NOT NULL,
        client_id INT NOT NULL DEFAULT ${BELLAVITA_CLIENT_ID},
        agent_id VARCHAR(150),
        agent_name VARCHAR(150),
        call_date DATETIME,
        audit_status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
        overall_score DECIMAL(5,2),
        has_critical_issue TINYINT(1) NOT NULL DEFAULT 0,
        critical_issue_params TEXT,
        strengths TEXT,
        improvement_areas TEXT,
        ai_summary TEXT,
        raw_payload LONGTEXT,
        uploaded_by INT,
        audited_at DATETIME DEFAULT NOW(),
        created_at DATETIME DEFAULT NOW(),
        UNIQUE KEY uq_call (call_id),
        INDEX idx_call_date (client_id, call_date),
        INDEX idx_agent (agent_id, call_date),
        INDEX idx_critical (client_id, has_critical_issue)
      )
    `);
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS db_masmis.bellavita_call_audit_results (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        call_id VARCHAR(100) NOT NULL,
        parameter_code VARCHAR(60) NOT NULL,
        result ENUM('PASS','FAIL','REVIEW','NA') NOT NULL,
        score DECIMAL(5,2),
        confidence DECIMAL(5,4),
        critical TINYINT(1) NOT NULL DEFAULT 0,
        evidence TEXT,
        timestamp_start VARCHAR(30),
        speaker VARCHAR(30),
        reason TEXT,
        created_at DATETIME DEFAULT NOW(),
        UNIQUE KEY uq_call_param (call_id, parameter_code),
        INDEX idx_call (call_id),
        INDEX idx_param_result (parameter_code, result)
      )
    `);
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS db_masmis.bellavita_product_master (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_name VARCHAR(200) NOT NULL,
        variant VARCHAR(150),
        size VARCHAR(100),
        approved_price DECIMAL(12,2),
        approved_offer TEXT,
        approved_discount TEXT,
        approved_payment_benefit TEXT,
        approved_product_claims TEXT,
        approved_delivery_claims TEXT,
        effective_from DATE,
        effective_to DATE,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME DEFAULT NOW(),
        updated_at DATETIME DEFAULT NOW() ON UPDATE NOW()
      )
    `);

    // Seed the 50-parameter master (idempotent — INSERT IGNORE on the unique code, never overwrites
    // an admin's later edit to critical/active/display_order for a code that already exists).
    const rows = PARAMETER_SEED.map(([code, name, category, critical, derived], i) => [
      code, name, category, critical ? 1 : 0, derived ? 1 : 0, i + 1,
    ]);
    await pool.query(
      `INSERT IGNORE INTO db_masmis.bellavita_compliance_parameters
        (code, name, category, critical, derived, display_order) VALUES ?`,
      [rows],
    );
  } catch (err) {
    console.error('[quality] initBellavitaComplianceTables warning:', (err as Error).message);
  }
}

export async function getComplianceParameters(includeInactive = false): Promise<ComplianceParameterDef[]> {
  const rows = await queryMasmis<{
    code: string; name: string; category: string; critical: number; derived: number;
    display_order: number; active: number; description: string | null;
  }>(`
    SELECT code, name, category, critical, derived, display_order, active, description
    FROM db_masmis.bellavita_compliance_parameters
    ${includeInactive ? '' : 'WHERE active = 1'}
    ORDER BY display_order ASC
  `);
  return rows.map(r => ({
    code: r.code, name: r.name, category: r.category,
    critical: !!r.critical, derived: !!r.derived,
    displayOrder: r.display_order, active: !!r.active, description: r.description,
  }));
}

export async function upsertComplianceParameter(input: {
  code: string; name: string; category: string; critical?: boolean;
  displayOrder?: number; active?: boolean; description?: string | null;
}): Promise<void> {
  const code = input.code.trim().toUpperCase();
  if (!code || !input.name || !input.category) throw new Error('code, name and category are required');
  await getMasmisPool().execute(
    `INSERT INTO db_masmis.bellavita_compliance_parameters
      (code, name, category, critical, display_order, active, description)
     VALUES (?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE
       name=VALUES(name), category=VALUES(category), critical=VALUES(critical),
       display_order=VALUES(display_order), active=VALUES(active), description=VALUES(description)`,
    [
      code, input.name, input.category, input.critical ? 1 : 0,
      input.displayOrder ?? 0, input.active === false ? 0 : 1, input.description ?? null,
    ],
  );
}

async function getParameterMasterMap(): Promise<Map<string, ComplianceParameterDef>> {
  const params = await getComplianceParameters(true);
  return new Map(params.map(p => [p.code, p]));
}

// ─── Product master (reference data the external audit system validates claims against) ───────
export interface ProductMasterRow {
  id: number; productName: string; variant: string | null; size: string | null;
  approvedPrice: number | null; approvedOffer: string | null; approvedDiscount: string | null;
  approvedPaymentBenefit: string | null; approvedProductClaims: string | null;
  approvedDeliveryClaims: string | null; effectiveFrom: string | null; effectiveTo: string | null;
  status: string;
}

export async function getProductMaster(): Promise<ProductMasterRow[]> {
  const rows = await queryMasmis<any>(`
    SELECT id, product_name, variant, size, approved_price, approved_offer, approved_discount,
           approved_payment_benefit, approved_product_claims, approved_delivery_claims,
           DATE_FORMAT(effective_from, '%Y-%m-%d') AS effective_from,
           DATE_FORMAT(effective_to, '%Y-%m-%d') AS effective_to, status
    FROM db_masmis.bellavita_product_master
    ORDER BY product_name ASC, variant ASC
  `);
  return rows.map((r: any) => ({
    id: r.id, productName: r.product_name, variant: r.variant, size: r.size,
    approvedPrice: r.approved_price !== null ? Number(r.approved_price) : null,
    approvedOffer: r.approved_offer, approvedDiscount: r.approved_discount,
    approvedPaymentBenefit: r.approved_payment_benefit, approvedProductClaims: r.approved_product_claims,
    approvedDeliveryClaims: r.approved_delivery_claims,
    effectiveFrom: r.effective_from, effectiveTo: r.effective_to, status: r.status,
  }));
}

export async function upsertProductMaster(input: {
  id?: number; productName: string; variant?: string | null; size?: string | null;
  approvedPrice?: number | null; approvedOffer?: string | null; approvedDiscount?: string | null;
  approvedPaymentBenefit?: string | null; approvedProductClaims?: string | null;
  approvedDeliveryClaims?: string | null; effectiveFrom?: string | null; effectiveTo?: string | null;
  status?: string;
}): Promise<number> {
  if (!input.productName) throw new Error('productName is required');
  const pool = getMasmisPool();
  if (input.id) {
    await pool.execute(
      `UPDATE db_masmis.bellavita_product_master SET
         product_name=?, variant=?, size=?, approved_price=?, approved_offer=?, approved_discount=?,
         approved_payment_benefit=?, approved_product_claims=?, approved_delivery_claims=?,
         effective_from=?, effective_to=?, status=?
       WHERE id=?`,
      [
        input.productName, input.variant ?? null, input.size ?? null, input.approvedPrice ?? null,
        input.approvedOffer ?? null, input.approvedDiscount ?? null, input.approvedPaymentBenefit ?? null,
        input.approvedProductClaims ?? null, input.approvedDeliveryClaims ?? null,
        input.effectiveFrom ?? null, input.effectiveTo ?? null, input.status ?? 'ACTIVE', input.id,
      ],
    );
    return input.id;
  }
  const [result] = await pool.execute(
    `INSERT INTO db_masmis.bellavita_product_master
      (product_name, variant, size, approved_price, approved_offer, approved_discount,
       approved_payment_benefit, approved_product_claims, approved_delivery_claims,
       effective_from, effective_to, status)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      input.productName, input.variant ?? null, input.size ?? null, input.approvedPrice ?? null,
      input.approvedOffer ?? null, input.approvedDiscount ?? null, input.approvedPaymentBenefit ?? null,
      input.approvedProductClaims ?? null, input.approvedDeliveryClaims ?? null,
      input.effectiveFrom ?? null, input.effectiveTo ?? null, input.status ?? 'ACTIVE',
    ],
  );
  return (result as mysql.ResultSetHeader).insertId;
}

// ─── Ingestion ──────────────────────────────────────────────────────────────────────────────
export type AuditResult = 'PASS' | 'FAIL' | 'REVIEW' | 'NA';

export interface IncomingAuditParameter {
  code: string; result: AuditResult; score?: number | null; confidence?: number | null;
  critical?: boolean; evidence?: string | null; timestamp?: string | null;
  speaker?: string | null; reason?: string | null;
}
export interface IncomingCallAudit {
  call_id: string | number; process?: string; audit_status?: string; overall_score?: number;
  parameters: IncomingAuditParameter[];
  strengths?: string[]; improvement_areas?: string[]; ai_summary?: string;
}

// COD/Prepaid derivation per spec: PASS only when both applicable pitches were covered. A FAIL on
// either side is a clear compliance miss regardless of the other; NA on one side with no FAIL means
// "both" genuinely can't be confirmed (not a fail, just not fully demonstrated), so it stays NA
// rather than being forced into PASS or FAIL.
function deriveBothPaymentPitch(cod: AuditResult, prepaid: AuditResult): AuditResult {
  if (cod === 'FAIL' || prepaid === 'FAIL') return 'FAIL';
  if (cod === 'REVIEW' || prepaid === 'REVIEW') return 'REVIEW';
  if (cod === 'PASS' && prepaid === 'PASS') return 'PASS';
  return 'NA';
}

export interface IngestResult { callId: string; parametersStored: number; hasCriticalIssue: boolean; overallScore: number | null }

export async function ingestBellavitaCallAudit(payload: IncomingCallAudit, uploadedBy: number): Promise<IngestResult> {
  if (!payload || typeof payload !== 'object') throw new Error('Invalid payload: expected a JSON object');
  const callId = String(payload.call_id ?? '').trim();
  if (!callId) throw new Error('call_id is required');
  if (!Array.isArray(payload.parameters) || payload.parameters.length === 0) {
    throw new Error('parameters array is required and must not be empty');
  }

  // call_id must be the real db_external.CallDetails.id for a Bellavita Outbound call — this is how
  // agent/call-date/transcript get enriched without asking the external audit system to duplicate
  // that data, and it stops audit rows being attached to calls that don't exist or aren't Bellavita.
  const [callRow] = await querySource<{ id: number; agentId: string | null; agentName: string | null; CallDate: string }>(`
    SELECT cd.id AS id, cd.AgentName AS agentId, COALESCE(am.AgentName, cd.AgentName) AS agentName, cd.CallDate AS CallDate
    FROM db_external.CallDetails cd
    LEFT JOIN db_masmis.AgentMaster am ON am.MasId = cd.AgentName COLLATE utf8mb4_unicode_ci
    WHERE cd.id = ? AND cd.client_id = ${BELLAVITA_CLIENT_ID}
  `, [callId]);
  if (!callRow) throw new Error(`call_id ${callId} was not found in Bellavita Outbound (client_id ${BELLAVITA_CLIENT_ID}) call data`);

  const master = await getParameterMasterMap();
  const validated: IncomingAuditParameter[] = [];
  for (const p of payload.parameters ?? []) {
    const code = String(p?.code ?? '').trim().toUpperCase();
    if (!code) continue;
    const def = master.get(code);
    if (!def) throw new Error(`Unknown parameter code: ${code}`);
    if (def.derived) continue; // BOTH_PAYMENT_PITCH etc. are computed here, never trusted from the payload
    if (!VALID_RESULTS.has(p.result)) throw new Error(`Invalid result "${p.result}" for parameter ${code} — must be PASS/FAIL/REVIEW/NA`);
    validated.push({ ...p, code });
  }
  if (validated.length === 0) throw new Error('No valid (non-derived) parameters in payload');

  const pool = getMasmisPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM db_masmis.bellavita_call_audit_results WHERE call_id = ?', [callId]);

    const rows = validated.map(p => [
      callId, p.code, p.result,
      p.score ?? null, p.confidence ?? null,
      (p.critical ?? master.get(p.code)?.critical ?? false) ? 1 : 0,
      p.evidence ?? null, p.timestamp ?? null, p.speaker ?? null, p.reason ?? null,
    ]);
    await conn.query(
      `INSERT INTO db_masmis.bellavita_call_audit_results
        (call_id, parameter_code, result, score, confidence, critical, evidence, timestamp_start, speaker, reason)
       VALUES ?`,
      [rows],
    );

    const cod = validated.find(p => p.code === 'COD_PITCH')?.result;
    const prepaid = validated.find(p => p.code === 'PREPAID_PITCH')?.result;
    if (cod && prepaid) {
      const derived = deriveBothPaymentPitch(cod, prepaid);
      await conn.execute(
        `INSERT INTO db_masmis.bellavita_call_audit_results
          (call_id, parameter_code, result, critical, reason)
         VALUES (?, 'BOTH_PAYMENT_PITCH', ?, 0, ?)`,
        [callId, derived, `Derived from COD_PITCH=${cod} and PREPAID_PITCH=${prepaid}`],
      );
    }

    const [criticalRows] = await conn.query(
      `SELECT parameter_code FROM db_masmis.bellavita_call_audit_results WHERE call_id = ? AND critical = 1 AND result = 'FAIL'`,
      [callId],
    );
    const criticalParams = (criticalRows as { parameter_code: string }[]).map(r => r.parameter_code);

    await conn.execute(
      `INSERT INTO db_masmis.bellavita_call_audit_summary
        (call_id, client_id, agent_id, agent_name, call_date, audit_status, overall_score,
         has_critical_issue, critical_issue_params, strengths, improvement_areas, ai_summary, raw_payload, uploaded_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         agent_id=VALUES(agent_id), agent_name=VALUES(agent_name), call_date=VALUES(call_date),
         audit_status=VALUES(audit_status), overall_score=VALUES(overall_score),
         has_critical_issue=VALUES(has_critical_issue), critical_issue_params=VALUES(critical_issue_params),
         strengths=VALUES(strengths), improvement_areas=VALUES(improvement_areas), ai_summary=VALUES(ai_summary),
         raw_payload=VALUES(raw_payload), uploaded_by=VALUES(uploaded_by), audited_at=NOW()`,
      [
        callId, BELLAVITA_CLIENT_ID, callRow.agentId, callRow.agentName, callRow.CallDate,
        payload.audit_status ?? 'COMPLETED', payload.overall_score ?? null,
        criticalParams.length > 0 ? 1 : 0, criticalParams.join(',') || null,
        payload.strengths ? JSON.stringify(payload.strengths) : null,
        payload.improvement_areas ? JSON.stringify(payload.improvement_areas) : null,
        payload.ai_summary ?? null, JSON.stringify(payload), uploadedBy,
      ],
    );

    await conn.commit();
    return {
      callId, parametersStored: validated.length + (cod && prepaid ? 1 : 0),
      hasCriticalIssue: criticalParams.length > 0, overallScore: payload.overall_score ?? null,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ─── Monthly aggregation ────────────────────────────────────────────────────────────────────
export interface ComplianceFilters { startDate: string; endDate: string; agentId?: string }

export interface ParameterStat {
  code: string; name: string; category: string; critical: boolean;
  passed: number; failed: number; review: number; na: number; applicableCalls: number; percentage: number;
}

export interface ComplianceMonthlyResult {
  totalCalls: number;
  auditedCalls: number;
  overallCompliance: number;
  compliantCalls: number;
  nonCompliantCalls: number;
  criticalCalls: number;
  reviewRequiredCalls: number;
  parameters: ParameterStat[];
  payment: { codPassed: number; prepaidPassed: number; bothPassed: number; neitherCovered: number; applicableCalls: number };
  critical: { totalCases: number; percentage: number; breakdown: { code: string; name: string; calls: number }[] };
  topImprovementAreas: { code: string; name: string; percentage: number }[];
  insights: string[];
  aiSummary: string;
}

function agentFilterSql(agentId?: string): { sql: string; params: string[] } {
  return agentId ? { sql: ' AND s.agent_id = ?', params: [agentId] } : { sql: '', params: [] };
}

export async function getBellavitaComplianceMonthly(filters: ComplianceFilters): Promise<ComplianceMonthlyResult> {
  const { startDate, endDate, agentId } = filters;
  const { sql: af, params: afParams } = agentFilterSql(agentId);

  const [volumeRow] = await querySource<{ total: number }>(`
    SELECT COUNT(*) AS total FROM db_external.CallDetails
    WHERE client_id = ${BELLAVITA_CLIENT_ID} AND CallDate BETWEEN ? AND ?
  `, [startDate, endDate]);

  const [summaryRow] = await queryMasmis<{
    audited: number; avg_score: number | null; compliant: number; non_compliant: number;
    critical: number; review_required: number;
  }>(`
    SELECT
      COUNT(*) AS audited,
      ROUND(AVG(overall_score), 1) AS avg_score,
      SUM(CASE WHEN has_critical_issue = 0 AND overall_score >= ${COMPLIANT_SCORE_THRESHOLD} THEN 1 ELSE 0 END) AS compliant,
      SUM(CASE WHEN has_critical_issue = 0 AND (overall_score IS NULL OR overall_score < ${COMPLIANT_SCORE_THRESHOLD}) THEN 1 ELSE 0 END) AS non_compliant,
      SUM(has_critical_issue) AS critical,
      SUM(CASE WHEN audit_status = 'REVIEW_REQUIRED' THEN 1 ELSE 0 END) AS review_required
    FROM db_masmis.bellavita_call_audit_summary s
    WHERE s.client_id = ${BELLAVITA_CLIENT_ID} AND s.call_date BETWEEN ? AND ? ${af}
  `, [startDate, endDate, ...afParams]);

  const paramDefs = await getComplianceParameters();
  const paramRows = await queryMasmis<{
    parameter_code: string; passed: number; failed: number; review: number; na: number;
  }>(`
    SELECT r.parameter_code,
      SUM(r.result = 'PASS') AS passed, SUM(r.result = 'FAIL') AS failed,
      SUM(r.result = 'REVIEW') AS review, SUM(r.result = 'NA') AS na
    FROM db_masmis.bellavita_call_audit_results r
    JOIN db_masmis.bellavita_call_audit_summary s ON s.call_id = r.call_id
    WHERE s.client_id = ${BELLAVITA_CLIENT_ID} AND s.call_date BETWEEN ? AND ? ${af}
    GROUP BY r.parameter_code
  `, [startDate, endDate, ...afParams]);
  const paramRowMap = new Map(paramRows.map(r => [r.parameter_code, r]));

  const parameters: ParameterStat[] = paramDefs.map(def => {
    const r = paramRowMap.get(def.code);
    const passed = Number(r?.passed ?? 0), failed = Number(r?.failed ?? 0);
    const review = Number(r?.review ?? 0), na = Number(r?.na ?? 0);
    const applicableCalls = passed + failed + review;
    return {
      code: def.code, name: def.name, category: def.category, critical: def.critical,
      passed, failed, review, na, applicableCalls,
      percentage: applicableCalls > 0 ? Math.round((passed / applicableCalls) * 1000) / 10 : 0,
    };
  });
  const paramByCode = new Map(parameters.map(p => [p.code, p]));

  const codStat = paramByCode.get('COD_PITCH');
  const prepaidStat = paramByCode.get('PREPAID_PITCH');
  const bothStat = paramByCode.get('BOTH_PAYMENT_PITCH');
  const paymentApplicable = Math.max(codStat?.applicableCalls ?? 0, prepaidStat?.applicableCalls ?? 0, bothStat?.applicableCalls ?? 0);
  const bothPassed = bothStat?.passed ?? 0;

  const criticalBreakdownRows = await queryMasmis<{ parameter_code: string; calls: number }>(`
    SELECT r.parameter_code, COUNT(DISTINCT r.call_id) AS calls
    FROM db_masmis.bellavita_call_audit_results r
    JOIN db_masmis.bellavita_call_audit_summary s ON s.call_id = r.call_id
    WHERE s.client_id = ${BELLAVITA_CLIENT_ID} AND s.call_date BETWEEN ? AND ? ${af}
      AND r.critical = 1 AND r.result = 'FAIL'
    GROUP BY r.parameter_code
    ORDER BY calls DESC
  `, [startDate, endDate, ...afParams]);
  const paramNameByCode = new Map(paramDefs.map(p => [p.code, p.name]));
  const criticalBreakdown = criticalBreakdownRows.map(r => ({
    code: r.parameter_code, name: paramNameByCode.get(r.parameter_code) ?? r.parameter_code, calls: Number(r.calls),
  }));

  const auditedCalls = Number(summaryRow?.audited ?? 0);
  const criticalCalls = Number(summaryRow?.critical ?? 0);

  const topImprovementAreas = [...parameters]
    .filter(p => p.applicableCalls > 0)
    .sort((a, b) => a.percentage - b.percentage)
    .slice(0, 5)
    .map(p => ({ code: p.code, name: p.name, percentage: p.percentage }));

  const insights: string[] = [];
  if (bothStat && bothStat.applicableCalls > 0) {
    insights.push(`COD + Prepaid pitch was completed in ${bothStat.percentage}% of audited calls.`);
  }
  const upsellStat = paramByCode.get('UPSELLING');
  if (upsellStat && upsellStat.applicableCalls > 0) insights.push(`Upselling compliance is ${upsellStat.percentage}%.`);
  const objStat = paramByCode.get('OBJECTION_HANDLING');
  if (objStat && objStat.applicableCalls > 0) insights.push(`Objection handling compliance is ${objStat.percentage}%.`);
  const openingStat = paramByCode.get('OPENING');
  if (openingStat && openingStat.applicableCalls > 0) insights.push(`Opening compliance is ${openingStat.percentage}%.`);
  if (criticalCalls > 0) insights.push(`${criticalCalls} critical compliance case${criticalCalls === 1 ? '' : 's'} ${criticalCalls === 1 ? 'was' : 'were'} detected.`);
  const productClaimStat = paramByCode.get('FALSE_PRODUCT_CLAIM');
  if (productClaimStat && productClaimStat.review > 0) {
    insights.push(`Product claim validation requires review in ${productClaimStat.review} call${productClaimStat.review === 1 ? '' : 's'}.`);
  }

  const overallCompliance = Number(summaryRow?.avg_score ?? 0);
  const aiSummary = auditedCalls > 0
    ? `${auditedCalls.toLocaleString()} BellaVita Outbound calls were audited${agentId ? ' for this agent' : ''} in the selected period. `
      + `Overall SOP compliance is ${overallCompliance}%. `
      + (topImprovementAreas.length > 0
          ? `The largest gap${topImprovementAreas.length === 1 ? ' is' : 's are'} ${topImprovementAreas.slice(0, 3).map(p => `${p.name} (${p.percentage}%)`).join(', ')}. `
          : '')
      + (criticalCalls > 0
          ? `${criticalCalls} critical compliance case${criticalCalls === 1 ? '' : 's'} ${criticalCalls === 1 ? 'was' : 'were'} identified and require management review.`
          : 'No critical compliance cases were identified in this period.')
    : 'No BellaVita Outbound calls have been audited for the selected period yet.';

  return {
    totalCalls: Number(volumeRow?.total ?? 0),
    auditedCalls,
    overallCompliance,
    compliantCalls: Number(summaryRow?.compliant ?? 0),
    nonCompliantCalls: Number(summaryRow?.non_compliant ?? 0),
    criticalCalls,
    reviewRequiredCalls: Number(summaryRow?.review_required ?? 0),
    parameters,
    payment: {
      codPassed: codStat?.passed ?? 0, prepaidPassed: prepaidStat?.passed ?? 0, bothPassed,
      neitherCovered: Math.max(0, paymentApplicable - (codStat?.passed ?? 0) - (prepaidStat?.passed ?? 0) + bothPassed),
      applicableCalls: paymentApplicable,
    },
    critical: {
      totalCases: criticalCalls,
      percentage: auditedCalls > 0 ? Math.round((criticalCalls / auditedCalls) * 10000) / 100 : 0,
      breakdown: criticalBreakdown,
    },
    topImprovementAreas,
    insights,
    aiSummary,
  };
}

// ─── Call list + call detail (paginated / lazy-loaded, per performance requirement) ────────────
export interface ComplianceCallListRow {
  callId: string; agentId: string | null; agentName: string | null; callDate: string;
  auditStatus: string; overallScore: number | null; hasCriticalIssue: boolean;
}

export async function getBellavitaComplianceCalls(
  filters: ComplianceFilters, complianceStatus: 'all' | 'compliant' | 'non_compliant' | 'critical' | 'review',
  cursor: number | undefined, limit: number,
): Promise<{ rows: ComplianceCallListRow[]; nextCursor: number | null }> {
  const { startDate, endDate, agentId } = filters;
  const { sql: af, params: afParams } = agentFilterSql(agentId);
  let statusClause = '';
  if (complianceStatus === 'critical') statusClause = ' AND has_critical_issue = 1';
  else if (complianceStatus === 'compliant') statusClause = ` AND has_critical_issue = 0 AND overall_score >= ${COMPLIANT_SCORE_THRESHOLD}`;
  else if (complianceStatus === 'non_compliant') statusClause = ` AND has_critical_issue = 0 AND (overall_score IS NULL OR overall_score < ${COMPLIANT_SCORE_THRESHOLD})`;
  else if (complianceStatus === 'review') statusClause = ` AND audit_status = 'REVIEW_REQUIRED'`;

  const rows = await queryMasmis<{
    call_id: string; agent_id: string | null; agent_name: string | null; call_date: string;
    audit_status: string; overall_score: number | null; has_critical_issue: number; id: number;
  }>(`
    SELECT id, call_id, agent_id, agent_name, DATE_FORMAT(call_date, '%Y-%m-%d %H:%i:%s') AS call_date,
           audit_status, overall_score, has_critical_issue
    FROM db_masmis.bellavita_call_audit_summary s
    WHERE s.client_id = ${BELLAVITA_CLIENT_ID} AND s.call_date BETWEEN ? AND ? ${af} ${statusClause}
      ${cursor ? 'AND s.id < ?' : ''}
    ORDER BY s.id DESC
    LIMIT ${limit}
  `, [startDate, endDate, ...afParams, ...(cursor ? [cursor] : [])]);

  return {
    rows: rows.map(r => ({
      callId: r.call_id, agentId: r.agent_id, agentName: r.agent_name, callDate: r.call_date,
      auditStatus: r.audit_status, overallScore: r.overall_score !== null ? Number(r.overall_score) : null,
      hasCriticalIssue: !!r.has_critical_issue,
    })),
    nextCursor: rows.length === limit ? Number(rows[rows.length - 1].id) : null,
  };
}

export interface ComplianceCallDetail {
  callId: string; agentId: string | null; agentName: string | null; callDate: string; durationSec: number | null;
  auditStatus: string; overallScore: number | null; hasCriticalIssue: boolean;
  strengths: string[]; improvementAreas: string[]; aiSummary: string | null;
  parameters: {
    code: string; name: string; category: string; critical: boolean; result: AuditResult;
    score: number | null; confidence: number | null; evidence: string | null;
    timestamp: string | null; speaker: string | null; reason: string | null;
  }[];
}

export async function getBellavitaComplianceCallDetail(callId: string): Promise<ComplianceCallDetail | null> {
  const [summary] = await queryMasmis<{
    call_id: string; agent_id: string | null; agent_name: string | null; call_date: string;
    audit_status: string; overall_score: number | null; has_critical_issue: number;
    strengths: string | null; improvement_areas: string | null; ai_summary: string | null;
  }>(`
    SELECT call_id, agent_id, agent_name, DATE_FORMAT(call_date, '%Y-%m-%d %H:%i:%s') AS call_date,
           audit_status, overall_score, has_critical_issue, strengths, improvement_areas, ai_summary
    FROM db_masmis.bellavita_call_audit_summary
    WHERE call_id = ? AND client_id = ${BELLAVITA_CLIENT_ID}
  `, [callId]);
  if (!summary) return null;

  const [durationRow] = await querySource<{ length_in_sec: number | null }>(
    `SELECT length_in_sec FROM db_external.CallDetails WHERE id = ?`, [callId],
  );

  const paramRows = await queryMasmis<{
    parameter_code: string; result: AuditResult; score: number | null; confidence: number | null;
    critical: number; evidence: string | null; timestamp_start: string | null; speaker: string | null; reason: string | null;
    name: string; category: string; display_order: number;
  }>(`
    SELECT r.parameter_code, r.result, r.score, r.confidence, r.critical, r.evidence,
           r.timestamp_start, r.speaker, r.reason, p.name, p.category, p.display_order
    FROM db_masmis.bellavita_call_audit_results r
    JOIN db_masmis.bellavita_compliance_parameters p ON p.code = r.parameter_code
    WHERE r.call_id = ?
    ORDER BY p.display_order ASC
  `, [callId]);

  const parseJsonArray = (s: string | null): string[] => {
    if (!s) return [];
    try { const v = JSON.parse(s); return Array.isArray(v) ? v.map(String) : []; } catch { return []; }
  };

  return {
    callId: summary.call_id, agentId: summary.agent_id, agentName: summary.agent_name,
    callDate: summary.call_date, durationSec: durationRow?.length_in_sec ?? null,
    auditStatus: summary.audit_status,
    overallScore: summary.overall_score !== null ? Number(summary.overall_score) : null,
    hasCriticalIssue: !!summary.has_critical_issue,
    strengths: parseJsonArray(summary.strengths), improvementAreas: parseJsonArray(summary.improvement_areas),
    aiSummary: summary.ai_summary,
    parameters: paramRows.map(r => ({
      code: r.parameter_code, name: r.name, category: r.category, critical: !!r.critical,
      result: r.result, score: r.score !== null ? Number(r.score) : null,
      confidence: r.confidence !== null ? Number(r.confidence) : null,
      evidence: r.evidence, timestamp: r.timestamp_start, speaker: r.speaker, reason: r.reason,
    })),
  };
}

// Transcript is deliberately NOT part of the call-detail payload above — it's loaded only when the
// user actually opens a call, per the "don't ship full transcripts into a list view" performance
// requirement. Reuses the existing outbound transcript lookup rather than re-querying CallDetails.
export async function getBellavitaComplianceTranscript(callId: string) {
  const numericId = Number(callId);
  if (!Number.isFinite(numericId)) return null;
  return getOutboundCallTranscript(numericId);
}
