import { querySource } from '../../lib/sourceDb';
import { sendScamAlertEmail, type ScamAlertCall } from '../../lib/mailer';

/**
 * Potential Scam alerts — Inbound only.
 *
 * The AI audit already flags a call as a potential scam (see getPotentialScamsDetail in
 * inbound-quality.service). This turns that flag into a push: the moment a newly audited call
 * trips it, the process owner gets a mail with everything needed to judge the call without
 * opening the portal — who took it, the customer's number, the recording, the transcript, and
 * the specific reason it tripped.
 *
 * Alerts are event-driven, not periodic. Each task carries a watermark (`alert_cursor`) holding
 * the highest audit row id it has already mailed, so a call alerts exactly once no matter how
 * often the checker runs, and turning an alert on never replays the backlog.
 */

// Matches the Potential Scam definition the dashboard already uses. Kept verbatim rather than
// imported so a later tweak to either one is a deliberate decision, not a silent change to what
// managers get mailed about.
const SCAM_CONDITION = `(
  LOWER(TRIM(q.financial_fraud)) = 'yes'
  OR LOWER(q.top_negative_words) LIKE '%scam%'
  OR LOWER(q.top_negative_words) LIKE '%fraud%'
  OR LOWER(q.top_negative_words) LIKE '%cheat%'
  OR LOWER(q.top_negative_words) LIKE '%fake%'
  OR LOWER(q.top_negative_words) LIKE '%loot%'
)`;

// Same low-quality gate the Potential Scam page applies, so the mail and the page agree on what
// counts as a flagged call.
const LOW_QUALITY_GATE_CLIENT_IDS = ['375'];
const QUALITY_GATE = LOW_QUALITY_GATE_CLIENT_IDS
  .map(id => `AND (q.ClientId != '${id}' OR q.quality_percentage > 35)`).join('\n  ');

// A burst (a bad batch, or a first run against an unexpected backlog) must not turn into a
// hundred mails. Anything beyond this waits for the next check, five minutes later.
const MAX_ALERTS_PER_RUN = 15;

interface RawScamRow {
  id: number;
  client_id: string;
  call_date: string;
  agent_id: string | null;
  agent_name: string | null;
  mobile_no: string | null;
  lead_id: string | null;
  neg_words: string | null;
  financial_fraud: string | null;
  fraud_risk: string | null;
  fraud_pct: string | null;
  fraud_notes: string | null;
  fin_fraud_text: string | null;
  scenario: string | null;
  scenario1: string | null;
  quality_pct: string | null;
  duration: string | null;
  recording: string | null;
  transcript: string | null;
  social_info: string | null;
}

/** Highest audit row id for a client right now — the watermark an alert starts from. */
export async function currentScamWatermark(clientId: string): Promise<number> {
  const rows = await querySource<{ mx: number | null }>(
    `SELECT MAX(id) AS mx FROM db_audit.call_quality_assessment WHERE ClientId = ?`,
    [clientId],
  );
  return Number(rows[0]?.mx ?? 0);
}

async function fetchNewScamCalls(clientId: string, afterId: number): Promise<RawScamRow[]> {
  return querySource<RawScamRow>(`
    SELECT
      q.id,
      q.ClientId                                             AS client_id,
      DATE_FORMAT(q.CallDate, '%d-%m-%Y %H:%i:%s')           AS call_date,
      q.User                                                 AS agent_id,
      am.AgentName                                           AS agent_name,
      q.MobileNo                                             AS mobile_no,
      q.lead_id,
      q.top_negative_words                                   AS neg_words,
      q.financial_fraud,
      q.overall_fraud_risk_score                             AS fraud_risk,
      q.fraud_potentiality_percentage                        AS fraud_pct,
      q.areas_for_improvement_fraud                          AS fraud_notes,
      q.Financial_Fraud_Text                                 AS fin_fraud_text,
      q.scenario,
      q.scenario1,
      q.quality_percentage                                   AS quality_pct,
      q.length_in_sec                                        AS duration,
      q.call_recording                                       AS recording,
      q.Transcribe_Text                                      AS transcript,
      q.Social_Media_Phone_Number_Order_ID_Email_ID          AS social_info
    FROM db_audit.call_quality_assessment q
    LEFT JOIN db_masmis.AgentMaster am ON am.MasId = q.User COLLATE utf8mb4_unicode_ci
    WHERE q.ClientId = ?
      AND q.id > ?
      AND q.quality_percentage IS NOT NULL ${QUALITY_GATE}
      AND ${SCAM_CONDITION}
    ORDER BY q.id ASC
    LIMIT ${MAX_ALERTS_PER_RUN}
  `, [clientId, afterId]);
}

/**
 * Why this call tripped, in the manager's words rather than the schema's. Financial fraud is the
 * AI's own explicit verdict; otherwise it's the customer-language keywords that matched, and those
 * get named so the reader can tell "the customer said the word fraud" from "the agent defrauded
 * someone" without opening the recording.
 */
const SCAM_KEYWORDS = ['scam', 'fraud', 'cheat', 'fake', 'loot'];

function buildReason(r: RawScamRow): { headline: string; matched: string[]; severity: 'critical' | 'warning' } {
  const isFinancialFraud = (r.financial_fraud ?? '').trim().toLowerCase() === 'yes';
  const words = (r.neg_words ?? '').toLowerCase();
  const matched = SCAM_KEYWORDS.filter(k => words.includes(k));

  if (isFinancialFraud) {
    return {
      headline: 'The AI audit flagged this call for financial fraud.',
      matched,
      severity: 'critical',
    };
  }
  return {
    headline: matched.length
      ? `Scam-related language was detected in the customer's words: ${matched.join(', ')}.`
      : 'Scam-related language was detected on this call.',
    matched,
    severity: 'warning',
  };
}

export interface ScamAlertRunResult {
  alerted: number;
  newCursor: number;
  recipients: string[];
}

/**
 * Finds calls flagged since the watermark and mails one alert per call. Returns the new watermark
 * so the caller can persist it — advanced only past calls that actually sent, so a mail failure
 * re-tries the same call on the next check instead of silently skipping it.
 */
export async function runScamAlert(
  clientId: string,
  clientLabel: string,
  recipients: string[],
  cursor: number,
): Promise<ScamAlertRunResult> {
  if (recipients.length === 0) throw new Error('Alert has no recipients configured');

  const rows = await fetchNewScamCalls(clientId, cursor);
  let newCursor = cursor;
  let alerted = 0;

  for (const r of rows) {
    const reason = buildReason(r);
    const call: ScamAlertCall = {
      auditId:      r.id,
      processName:  clientLabel,
      callDate:     r.call_date ?? '—',
      agentId:      (r.agent_id ?? '').trim() || '—',
      // AgentMaster does not have every MasId yet; showing the id twice beats showing "null".
      agentName:    (r.agent_name ?? '').trim() || (r.agent_id ?? '').trim() || 'Unknown',
      mobileNo:     (r.mobile_no ?? '').trim() || '—',
      leadId:       (r.lead_id ?? '').trim() || '—',
      durationSec:  r.duration ? Number(r.duration) || null : null,
      qualityPct:   r.quality_pct !== null && r.quality_pct !== undefined ? Number(r.quality_pct) : null,
      scenario:     [r.scenario, r.scenario1].map(s => (s ?? '').trim()).filter(Boolean).join(' › ') || '—',
      recordingUrl: (r.recording ?? '').trim() || null,
      transcript:   (r.transcript ?? '').trim(),
      socialInfo:   (r.social_info ?? '').trim() || null,
      negativeWords: (r.neg_words ?? '').trim() || null,
      fraudRisk:    (r.fraud_risk ?? '').trim() || null,
      fraudPct:     (r.fraud_pct ?? '').trim() || null,
      fraudNotes:   (r.fraud_notes ?? '').trim() || (r.fin_fraud_text ?? '').trim() || null,
      reason:       reason.headline,
      matchedTerms: reason.matched,
      severity:     reason.severity,
    };

    await sendScamAlertEmail(recipients, call);
    alerted += 1;
    newCursor = r.id;
  }

  return { alerted, newCursor, recipients };
}
