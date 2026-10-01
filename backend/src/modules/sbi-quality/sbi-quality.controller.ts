import { Request, Response } from 'express';
import * as svc from './sbi-quality.service';
import type { SbiQualityFilters } from './sbi-quality.service';

function defaultDateRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    startDate: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`,
    endDate:   `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
  };
}

function parseFilters(req: Request): SbiQualityFilters {
  const { startDate: defaultStart, endDate: defaultEnd } = defaultDateRange();
  const str = (v: unknown) => (typeof v === 'string' && v && v !== 'All' ? v : undefined);
  return {
    startDate: (req.query.startDate as string) || defaultStart,
    endDate:   (req.query.endDate   as string) || defaultEnd,
    bucket:           str(req.query.bucket),
    agentName:        str(req.query.agentName),
    scenario:         str(req.query.scenario),
    callOutcome:      str(req.query.callOutcome),
    sentiment:        str(req.query.sentiment),
    frustrationLevel: str(req.query.frustrationLevel),
  };
}

export async function getOverview(req: Request, res: Response) {
  try {
    const rows = await svc.fetchSbiQualityRows(parseFilters(req));
    res.json({ success: true, data: svc.computeOverview(rows) });
  } catch (err) {
    console.error('sbi-quality getOverview error:', err);
    res.status(500).json({ success: false, message: 'Failed to load SBI overview' });
  }
}

export async function getScenarioAnalysis(req: Request, res: Response) {
  try {
    const rows = await svc.fetchSbiQualityRows(parseFilters(req));
    res.json({ success: true, data: svc.computeScenarioAnalysis(rows) });
  } catch (err) {
    console.error('sbi-quality getScenarioAnalysis error:', err);
    res.status(500).json({ success: false, message: 'Failed to load SBI scenario analysis' });
  }
}

export async function getAgentPerformance(req: Request, res: Response) {
  try {
    const rows = await svc.fetchSbiQualityRows(parseFilters(req));
    res.json({ success: true, data: svc.computeAgentPerformance(rows) });
  } catch (err) {
    console.error('sbi-quality getAgentPerformance error:', err);
    res.status(500).json({ success: false, message: 'Failed to load SBI agent performance' });
  }
}

export async function getQualityInsights(req: Request, res: Response) {
  try {
    const rows = await svc.fetchSbiQualityRows(parseFilters(req));
    res.json({ success: true, data: svc.computeQualityInsights(rows) });
  } catch (err) {
    console.error('sbi-quality getQualityInsights error:', err);
    res.status(500).json({ success: false, message: 'Failed to load SBI quality insights' });
  }
}

export async function getFilterOptions(_req: Request, res: Response) {
  try {
    const data = await svc.getFilterOptions();
    res.json({ success: true, data });
  } catch (err) {
    console.error('sbi-quality getFilterOptions error:', err);
    res.status(500).json({ success: false, message: 'Failed to load SBI filter options' });
  }
}

// Raw call-level export (one row per call, every audit parameter as its own column) for the
// currently selected date range + filters — the aggregated slide endpoints above only ever return
// summary numbers, never the underlying rows, so this is the only way to get the detail behind them.
const EXPORT_COLUMNS: { key: keyof Awaited<ReturnType<typeof svc.fetchSbiQualityRows>>[number]; header: string }[] = [
  { key: 'call_date', header: 'Call Date' },
  { key: 'call_id', header: 'Call ID' },
  { key: 'scenario', header: 'Scenario' },
  { key: 'agent_name', header: 'Agent Name' },
  { key: 'agent_id', header: 'Agent ID' },
  { key: 'customer_name', header: 'Customer Name' },
  { key: 'customer_phone', header: 'Customer Phone' },
  { key: 'bucket', header: 'Bucket' },
  { key: 'language', header: 'Language' },
  { key: 'duration_sec', header: 'Duration (sec)' },
  { key: 'proper_opening', header: 'Proper Opening' },
  { key: 'customer_verified', header: 'Customer Verified' },
  { key: 'call_purpose_explained', header: 'Call Purpose Explained' },
  { key: 'payment_status_discussed', header: 'Payment Status Discussed' },
  { key: 'non_payment_reason_identified', header: 'Non-Payment Reason Identified' },
  { key: 'appropriate_probing', header: 'Appropriate Probing' },
  { key: 'payment_commitment_obtained', header: 'Payment Commitment Obtained' },
  { key: 'commitment_date_captured', header: 'Commitment Date Captured' },
  { key: 'customer_concern_acknowledged', header: 'Customer Concern Acknowledged' },
  { key: 'agent_empathy', header: 'Agent Empathy' },
  { key: 'professional_tone', header: 'Professional Tone' },
  { key: 'abusive_language_by_agent', header: 'Abusive Language By Agent' },
  { key: 'threatening_behavior', header: 'Threatening Behavior' },
  { key: 'coercion_or_pressure', header: 'Coercion Or Pressure' },
  { key: 'otp_requested', header: 'OTP Requested' },
  { key: 'pin_requested', header: 'PIN Requested' },
  { key: 'cvv_requested', header: 'CVV Requested' },
  { key: 'password_requested', header: 'Password Requested' },
  { key: 'unauthorized_payment_instruction', header: 'Unauthorized Payment Instruction' },
  { key: 'third_party_disclosure', header: 'Third Party Disclosure' },
  { key: 'payment_information_accuracy', header: 'Payment Information Accuracy' },
  { key: 'dispute_handling', header: 'Dispute Handling' },
  { key: 'objection_handling', header: 'Objection Handling' },
  { key: 'callback_handling', header: 'Callback Handling' },
  { key: 'proper_call_closure', header: 'Call Closure' },
  { key: 'frustration_level', header: 'Frustration Level' },
  { key: 'frustration_detected', header: 'Frustration Detected' },
  { key: 'customer_abusing', header: 'Customer Abusing' },
  { key: 'abusive_sentence', header: 'Abusive / Frustrated Sentence' },
  { key: 'customer_sentiment', header: 'Customer Sentiment' },
  { key: 'call_outcome', header: 'Call Outcome' },
];

function csvCell(v: unknown): string {
  // mysql2 returns a DATE column as a JS Date object — letting String(v) fall through to
  // Date.prototype.toString() produces a verbose, timezone-dependent string like "Tue Sep 01 2026
  // 00:00:00 GMT+0530 (India Standard Time)" instead of a plain date (same gotcha noted in
  // quality.service.ts's exportSelectExpr, normally handled there with DATE_FORMAT at the SQL level
  // instead). Formatted from LOCAL date parts, not toISOString()'s UTC conversion — this DATE column
  // has no time-of-day component, so converting to UTC first would shift it back a day for any
  // timezone ahead of UTC (IST included).
  const pad = (n: number) => String(n).padStart(2, '0');
  const s = v === null || v === undefined ? '' : v instanceof Date ? `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}` : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function exportCsv(req: Request, res: Response) {
  try {
    const filters = parseFilters(req);
    const rows = await svc.fetchSbiQualityRows(filters);
    const header = EXPORT_COLUMNS.map(c => csvCell(c.header)).join(',');
    const body = rows.map(r => EXPORT_COLUMNS.map(c => csvCell(r[c.key])).join(',')).join('\n');
    const filename = `sbi-collection_${filters.startDate.slice(0, 10)}_to_${filters.endDate.slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    // UTF-8 BOM so Excel doesn't mangle non-ASCII characters (Hindi/Devanagari in transcripts etc.).
    res.send('﻿' + `${header}\n${body}`);
  } catch (err) {
    console.error('sbi-quality exportCsv error:', err);
    res.status(500).json({ success: false, message: 'Failed to export SBI Collection data' });
  }
}
