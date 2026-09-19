import 'dotenv/config';
import fs from 'fs';
import { querySource } from '../lib/sourceDb';
import { buildScamAlertEmail, type ScamAlertCall } from '../lib/mailer';

// Renders the alert for the most recent genuinely-flagged call, so the mail can be eyeballed
// in a browser without sending anything.
const SCAM = `(LOWER(TRIM(q.financial_fraud))='yes' OR LOWER(q.top_negative_words) LIKE '%scam%' OR LOWER(q.top_negative_words) LIKE '%fraud%' OR LOWER(q.top_negative_words) LIKE '%cheat%' OR LOWER(q.top_negative_words) LIKE '%fake%' OR LOWER(q.top_negative_words) LIKE '%loot%')`;

(async () => {
  const rows = await querySource<Record<string, unknown>>(`
    SELECT q.id, q.ClientId, DATE_FORMAT(q.CallDate,'%d-%m-%Y %H:%i:%s') call_date, q.User agent_id,
           am.AgentName agent_name, q.MobileNo, q.lead_id, q.top_negative_words, q.financial_fraud,
           q.overall_fraud_risk_score, q.fraud_potentiality_percentage, q.areas_for_improvement_fraud,
           q.scenario, q.scenario1, q.quality_percentage, q.length_in_sec, q.call_recording,
           q.Transcribe_Text, q.Social_Media_Phone_Number_Order_ID_Email_ID social_info
    FROM db_audit.call_quality_assessment q
    LEFT JOIN db_masmis.AgentMaster am ON am.MasId = q.User COLLATE utf8mb4_unicode_ci
    WHERE q.ClientId='375' AND q.CallDate >= DATE_SUB(CURDATE(), INTERVAL 3 DAY)
      AND q.quality_percentage IS NOT NULL AND ${SCAM}
    ORDER BY q.id DESC LIMIT 1`);

  if (!rows.length) { console.log('no flagged call found'); process.exit(0); }
  const r = rows[0];
  const words = String(r.top_negative_words ?? '').toLowerCase();
  const matched = ['scam','fraud','cheat','fake','loot'].filter(k => words.includes(k));
  const isFin = String(r.financial_fraud ?? '').trim().toLowerCase() === 'yes';

  const call: ScamAlertCall = {
    auditId: Number(r.id),
    processName: 'Bellavita',
    callDate: String(r.call_date),
    agentId: String(r.agent_id ?? '—'),
    agentName: String(r.agent_name ?? r.agent_id ?? 'Unknown'),
    mobileNo: String(r.MobileNo ?? '—'),
    leadId: String(r.lead_id ?? '—'),
    durationSec: r.length_in_sec ? Number(r.length_in_sec) : null,
    qualityPct: r.quality_percentage !== null ? Number(r.quality_percentage) : null,
    scenario: [r.scenario, r.scenario1].map(s => String(s ?? '').trim()).filter(Boolean).join(' › ') || '—',
    recordingUrl: String(r.call_recording ?? '') || null,
    transcript: String(r.Transcribe_Text ?? ''),
    socialInfo: String(r.social_info ?? '') || null,
    negativeWords: String(r.top_negative_words ?? '') || null,
    fraudRisk: String(r.overall_fraud_risk_score ?? '') || null,
    fraudPct: String(r.fraud_potentiality_percentage ?? '') || null,
    fraudNotes: String(r.areas_for_improvement_fraud ?? '') || null,
    reason: isFin ? 'The AI audit flagged this call for financial fraud.'
                  : `Scam-related language was detected in the customer's words: ${matched.join(', ')}.`,
    matchedTerms: matched,
    severity: isFin ? 'critical' : 'warning',
  };

  const built = buildScamAlertEmail(call);
  const out = process.argv[2] || 'scam-alert-preview.html';
  fs.writeFileSync(out, built.html, 'utf-8');
  console.log('SUBJECT :', built.subject);
  console.log('AGENT   :', call.agentName, '/', call.agentId);
  console.log('MOBILE  :', call.mobileNo, '| LEAD:', call.leadId);
  console.log('REC     :', call.recordingUrl?.slice(0, 70));
  console.log('REASON  :', call.reason);
  console.log('ATTACH  :', built.attachments.map(a => `${a.filename} (${a.content.length}b)`).join(', ') || 'none');
  console.log('HTML    :', built.html.length, 'bytes →', out);
  console.log('TEXT preview:\n' + built.text.split('\n').slice(0, 12).join('\n'));
  process.exit(0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
