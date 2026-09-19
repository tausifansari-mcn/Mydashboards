import { querySource } from '../../lib/sourceDb';
import * as qualitySvc from '../quality/quality.service';
import * as salesSvc from '../sales/sales.service';
import * as inboundQualitySvc from '../inbound-quality/inbound-quality.service';
import type { RequestScope } from './ai-bot.types';

// ─── Every tool call is authorized here, server-side, before it touches any data ────────────────
// The LLM only ever sees the RESULT of a tool call, never gets to run arbitrary SQL, and can never
// widen its own access — clientId requests are validated against the caller's real scope
// (resolveUserScope, same function every other module in this app uses) regardless of what the
// model asked for. This is what Rule 10 in the spec means by "never bypass authorization".
export class ScopeError extends Error {}

async function assertClientAllowed(scope: RequestScope, clientId: number): Promise<void> {
  if (scope.isSuperAdmin || scope.allowedClientIds === null) return;
  if (!scope.allowedClientIds.includes(clientId)) {
    // Named per the actual requirement: don't just say "no" — say it's not their process, and
    // tell them what they *can* ask about, so the denial reads as helpful rather than a wall.
    let ownProcesses = '';
    if (scope.allowedClientIds.length > 0) {
      const rows = await querySource<{ name: string }>(
        `SELECT name FROM shivamgiri.md_clients WHERE dialdesk_client_id IN (${scope.allowedClientIds.map(() => '?').join(',')})`,
        scope.allowedClientIds,
      );
      ownProcesses = rows.map(r => r.name).join(', ');
    }
    throw new ScopeError(
      `This isn't one of your assigned processes, so I can't share data or discuss details for it.`
      + (ownProcesses ? ` You have access to: ${ownProcesses}. Ask me about one of those instead.` : ' You don\'t currently have any process assigned — ask your admin to grant you access.'),
    );
  }
}

// ─── Client name resolution — lets the model/user say "BellaVita" instead of "375" ──────────────
export async function resolveClientByName(name: string): Promise<{ id: number; name: string }[]> {
  const rows = await querySource<{ dialdesk_client_id: number; name: string }>(
    `SELECT dialdesk_client_id, name FROM shivamgiri.md_clients WHERE name LIKE ? AND is_active = 1 LIMIT 5`,
    [`%${name}%`],
  );
  return rows.map(r => ({ id: r.dialdesk_client_id, name: r.name }));
}

// The 4 processes with a real, formula-defined CQ score today (see quality.service.ts) — CQ is
// not a generic metric every client has, it's a specific per-client formula someone defined.
const CQ_CLIENT_IDS: Record<number, string> = {
  496: 'Housing Owner',
  419: 'Housing Premium',
  375: 'Bellavita',
  409: 'GNC',
};

function defaultRange(dateFrom?: string, dateTo?: string): { startDate: string; endDate: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const startOfMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01 00:00:00`;
  const endOfToday = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} 23:59:59`;
  return {
    startDate: dateFrom ? `${dateFrom} 00:00:00` : startOfMonth,
    endDate: dateTo ? `${dateTo} 23:59:59` : endOfToday,
  };
}

// ─── Tool: getCQScore ────────────────────────────────────────────────────────────────────────
// "CQ score" means two genuinely different things depending on call direction, not one metric
// filterable by a column: Outbound CQ comes from a per-client formula over db_external.CallDetails
// (see quality.service.ts); Inbound CQ comes from db_audit.call_quality_assessment via
// getInboundProcessKPIs (see inbound-quality.service.ts) — same client_id (e.g. Bellavita = 375
// either way), completely different data source and scoring. A client having an Outbound CQ
// formula doesn't imply it has Inbound audit data, or vice versa — hence two independent
// availability checks below rather than one shared client allow-list.
export interface GetCqScoreArgs { clientId: number; direction?: 'inbound' | 'outbound'; dateFrom?: string; dateTo?: string }
interface CQAgentRow { agentId: string; agentName: string; callCount: number; avgScore: number }
type CQScoreResult =
  | { available: false; reason: string }
  | {
      available: true; direction: 'outbound'; process: string; clientId: number; dateFrom: string; dateTo: string;
      overallScore: number; totalCalls: number; topAgents: CQAgentRow[]; bottomAgents: CQAgentRow[]; agentCount: number;
    }
  | {
      available: true; direction: 'inbound'; process: string; clientId: number; dateFrom: string; dateTo: string;
      overallScore: number; totalCalls: number; fatalCount: number;
      subScores: { openingSkill: number; softSkill: number; holdProcedure: number; resolution: number; closing: number };
      breakdown: { excellent: number; good: number; average: number; belowAverage: number };
    };

async function getInboundCQScore(scope: RequestScope, args: GetCqScoreArgs): Promise<CQScoreResult> {
  await assertClientAllowed(scope, args.clientId);
  const { startDate, endDate } = defaultRange(args.dateFrom, args.dateTo);
  const kpis = await inboundQualitySvc.getInboundProcessKPIs({ startDate, endDate, clientId: String(args.clientId) });
  if (!kpis.audit_count) {
    return { available: false, reason: `No Inbound audit data found for client ${args.clientId} in this period.` };
  }
  return {
    available: true,
    direction: 'inbound',
    process: kpis.client_name,
    clientId: args.clientId,
    dateFrom: startDate.slice(0, 10),
    dateTo: endDate.slice(0, 10),
    overallScore: kpis.cq_score,
    totalCalls: kpis.audit_count,
    fatalCount: kpis.fatal_count,
    subScores: {
      openingSkill: kpis.opening_skill, softSkill: kpis.soft_skill, holdProcedure: kpis.hold_procedure,
      resolution: kpis.resolution, closing: kpis.closing,
    },
    breakdown: { excellent: kpis.excellent, good: kpis.good, average: kpis.average_count, belowAverage: kpis.below_average },
  };
}

export async function getCQScore(scope: RequestScope, args: GetCqScoreArgs): Promise<CQScoreResult> {
  if (args.direction === 'inbound') return getInboundCQScore(scope, args);

  await assertClientAllowed(scope, args.clientId);
  const label = CQ_CLIENT_IDS[args.clientId];
  if (!label) {
    return { available: false, reason: `Outbound CQ Score is only defined for Housing Owner (496), Housing Premium (419), Bellavita (375), and GNC (409). Client ${args.clientId} doesn't have an Outbound CQ formula configured — if this client has Inbound calls, try direction: 'inbound' instead.` };
  }
  const { startDate, endDate } = defaultRange(args.dateFrom, args.dateTo);
  const filters: qualitySvc.QualityFilters = { startDate, endDate, clientId: String(args.clientId) };
  const fn = {
    496: qualitySvc.getHousingOwnerCQScore,
    419: qualitySvc.getHousingPremiumCQScore,
    375: qualitySvc.getBellavitaCQScore,
    409: qualitySvc.getGncCQScore,
  }[args.clientId]!;
  const result = await fn(filters);
  return {
    available: true,
    direction: 'outbound',
    process: label,
    clientId: args.clientId,
    dateFrom: startDate.slice(0, 10),
    dateTo: endDate.slice(0, 10),
    overallScore: result.overallScore,
    totalCalls: result.totalCalls,
    topAgents: result.byAgent.slice(0, 5),
    bottomAgents: [...result.byAgent].sort((a, b) => a.avgScore - b.avgScore).slice(0, 5),
    agentCount: result.byAgent.length,
  };
}

// ─── Tool: getCallCount ──────────────────────────────────────────────────────────────────────
export interface GetCallCountArgs { clientId: number; dateFrom?: string; dateTo?: string }
export async function getCallCount(scope: RequestScope, args: GetCallCountArgs) {
  await assertClientAllowed(scope, args.clientId);
  const { startDate, endDate } = defaultRange(args.dateFrom, args.dateTo);
  const [row] = await querySource<{ total: number; with_mobile: number; sale_done: number }>(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN MobileNo IS NOT NULL AND MobileNo != '' THEN 1 ELSE 0 END) AS with_mobile,
            SUM(CASE WHEN COALESCE(SaleDone,0) = 1 THEN 1 ELSE 0 END) AS sale_done
     FROM db_external.CallDetails
     WHERE client_id = ? AND CallDate BETWEEN ? AND ?`,
    [args.clientId, startDate, endDate],
  );
  return {
    clientId: args.clientId,
    dateFrom: startDate.slice(0, 10),
    dateTo: endDate.slice(0, 10),
    totalCalls: Number(row?.total ?? 0),
    validCalls: Number(row?.with_mobile ?? 0),
    saleDoneCalls: Number(row?.sale_done ?? 0),
  };
}

// ─── Tool: getAgentPerformance ───────────────────────────────────────────────────────────────
export interface GetAgentPerformanceArgs {
  clientId: number; direction?: 'inbound' | 'outbound'; agentName?: string; sort?: 'top' | 'bottom';
  dateFrom?: string; dateTo?: string; full?: boolean;
}

async function getInboundAgentPerformance(scope: RequestScope, args: GetAgentPerformanceArgs) {
  const cq = await getInboundCQScore(scope, args);
  if (!cq.available) return cq;
  const { startDate, endDate } = defaultRange(args.dateFrom, args.dateTo);
  const rows = await inboundQualitySvc.getAgentParameterWise({ startDate, endDate, clientId: String(args.clientId) });

  let agents = rows.map(r => ({
    agentId: r.agent_id, agentName: r.agent_name, callCount: r.audit_count, cqScore: r.cq_score,
    fatalCount: r.fatal_count,
    componentScores: { openingSkill: r.opening_skill, softSkill: r.soft_skill, holdProcedure: r.hold_procedure, resolution: r.resolution, closing: r.closing },
  }));

  if (args.agentName) {
    const needle = args.agentName.toLowerCase();
    agents = agents.filter(a => a.agentName.toLowerCase().includes(needle));
    if (agents.length === 0) return { available: true, direction: 'inbound' as const, process: cq.process, found: false, message: `No agent matching "${args.agentName}" found for ${cq.process} Inbound in this period.` };
  } else {
    agents = [...agents].sort((a, b) => args.sort === 'bottom' ? a.cqScore - b.cqScore : b.cqScore - a.cqScore);
    // "Build me a full report" (args.full) intentionally returns every agent — this tool exists
    // specifically so a requested report isn't silently truncated to a top-15 preview; anything
    // less deliberate (a plain "who's underperforming" question) stays capped per Rule 25/26.
    if (!args.full) agents = agents.slice(0, 15);
  }

  return {
    available: true, direction: 'inbound' as const, process: cq.process,
    dateFrom: cq.dateFrom, dateTo: cq.dateTo, agentCount: agents.length, agents,
  };
}

export async function getAgentPerformance(scope: RequestScope, args: GetAgentPerformanceArgs) {
  if (args.direction === 'inbound') return getInboundAgentPerformance(scope, args);

  const cq = await getCQScore(scope, args);
  if (!cq.available) return cq;
  if (cq.direction !== 'outbound') return cq; // unreachable given the branch above, kept for type-narrowing
  let agents = cq.topAgents.concat(cq.bottomAgents);
  // getCQScore only returns top/bottom 5 each; for a specific agent lookup, a full sort, or an
  // explicit full report, re-fetch the complete per-agent list.
  if (args.agentName || args.sort || args.full) {
    const { startDate, endDate } = defaultRange(args.dateFrom, args.dateTo);
    const filters: qualitySvc.QualityFilters = { startDate, endDate, clientId: String(args.clientId) };
    const fn = {
      496: qualitySvc.getHousingOwnerCQScore,
      419: qualitySvc.getHousingPremiumCQScore,
      375: qualitySvc.getBellavitaCQScore,
      409: qualitySvc.getGncCQScore,
    }[args.clientId]!;
    const full = await fn(filters);
    if (args.agentName) {
      const needle = args.agentName.toLowerCase();
      agents = full.byAgent.filter(a => a.agentName.toLowerCase().includes(needle));
      if (agents.length === 0) return { available: true, direction: 'outbound' as const, process: cq.process, found: false, message: `No agent matching "${args.agentName}" found for ${cq.process} in this period.` };
    } else {
      const sorted = [...full.byAgent].sort((a, b) => args.sort === 'bottom' ? a.avgScore - b.avgScore : b.avgScore - a.avgScore);
      agents = args.full ? sorted : sorted.slice(0, 15);
    }
  }
  return { available: true, direction: 'outbound' as const, process: cq.process, dateFrom: cq.dateFrom, dateTo: cq.dateTo, agentCount: agents.length, agents };
}

// ─── Tool: getCQScoreDateWise — day-by-day CQ trend, both directions ────────────────────────────
export interface GetCqDateWiseArgs { clientId: number; direction?: 'inbound' | 'outbound'; dateFrom?: string; dateTo?: string }
const OUTBOUND_DATEWISE_FN: Record<number, (f: qualitySvc.QualityFilters) => Promise<qualitySvc.CQScoreDateWiseRow[]>> = {
  496: qualitySvc.getHousingOwnerCQScoreDateWise,
  419: qualitySvc.getHousingPremiumCQScoreDateWise,
  375: qualitySvc.getBellavitaCQScoreDateWise,
  409: qualitySvc.getGncCQScoreDateWise,
};

export async function getCQScoreDateWise(scope: RequestScope, args: GetCqDateWiseArgs) {
  await assertClientAllowed(scope, args.clientId);
  const { startDate, endDate } = defaultRange(args.dateFrom, args.dateTo);

  if (args.direction === 'inbound') {
    const rows = await inboundQualitySvc.getDailyScoresRange({ startDate, endDate, clientId: String(args.clientId) });
    if (rows.length === 0) return { available: false, reason: `No Inbound audit data found for client ${args.clientId} in this period.` };
    return {
      available: true, direction: 'inbound' as const, clientId: args.clientId,
      dateFrom: startDate.slice(0, 10), dateTo: endDate.slice(0, 10), dayCount: rows.length,
      days: rows.map(r => ({ date: r.call_date, cqScore: r.avg_score, callCount: r.audit_count })),
    };
  }

  const fn = OUTBOUND_DATEWISE_FN[args.clientId];
  if (!fn) return { available: false, reason: `Outbound CQ Score is only defined for Housing Owner (496), Housing Premium (419), Bellavita (375), and GNC (409). Client ${args.clientId} doesn't have an Outbound CQ formula configured — if this client has Inbound calls, try direction: 'inbound' instead.` };
  const rows = await fn({ startDate, endDate, clientId: String(args.clientId) });
  return {
    available: true, direction: 'outbound' as const, clientId: args.clientId,
    dateFrom: startDate.slice(0, 10), dateTo: endDate.slice(0, 10), dayCount: rows.length,
    days: rows.map(r => ({ date: r.date, cqScore: r.cqScore, callCount: r.auditCount })),
  };
}

// ─── Tool: getObjectionAnalysis ──────────────────────────────────────────────────────────────
export interface GetObjectionArgs { clientId: number; dateFrom?: string; dateTo?: string }
export async function getObjectionAnalysis(scope: RequestScope, args: GetObjectionArgs) {
  await assertClientAllowed(scope, args.clientId);
  const { startDate, endDate } = defaultRange(args.dateFrom, args.dateTo);
  const result = await qualitySvc.getObjectionAnalysis({ startDate, endDate, clientId: String(args.clientId) });
  return {
    clientId: args.clientId,
    dateFrom: startDate.slice(0, 10),
    dateTo: endDate.slice(0, 10),
    topObjections: result.posBreakdown.slice(0, 8),
    topSubcategories: result.posSubcategory.slice(0, 8),
  };
}

// ─── Tool: getCallTranscript ─────────────────────────────────────────────────────────────────
export interface GetTranscriptArgs { callId: number; clientId: number }
export async function getCallTranscript(scope: RequestScope, args: GetTranscriptArgs) {
  await assertClientAllowed(scope, args.clientId);
  // Ownership check: the call must actually belong to a client this user can see, before we hand
  // back its transcript — callId alone isn't enough to prove that.
  const [owner] = await querySource<{ client_id: number }>(
    'SELECT client_id FROM db_external.CallDetails WHERE id = ? LIMIT 1', [args.callId],
  );
  if (!owner) return { found: false, message: `No call found with ID ${args.callId}.` };
  await assertClientAllowed(scope, Number(owner.client_id));
  const result = await qualitySvc.getOutboundCallTranscript(args.callId);
  if (!result) return { found: false, message: `Call ${args.callId} has no transcript available.` };
  return { found: true, ...result };
}

// ─── Tool: searchTranscripts — keyword/phrase search, capped and date/client-scoped ─────────────
export interface SearchTranscriptsArgs { clientId: number; phrase: string; dateFrom?: string; dateTo?: string; limit?: number }
export async function searchTranscripts(scope: RequestScope, args: SearchTranscriptsArgs) {
  await assertClientAllowed(scope, args.clientId);
  const { startDate, endDate } = defaultRange(args.dateFrom, args.dateTo);
  const limit = Math.min(args.limit ?? 10, 25);
  const needle = `%${args.phrase.toLowerCase()}%`;
  const [countRow] = await querySource<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM db_external.CallDetails
     WHERE client_id = ? AND CallDate BETWEEN ? AND ? AND LOWER(TranscribeText) LIKE ?`,
    [args.clientId, startDate, endDate, needle],
  );
  const samples = await querySource<{ id: number; AgentName: string | null; CallDate: string; TranscribeText: string }>(
    `SELECT id, AgentName, CallDate, TranscribeText FROM db_external.CallDetails
     WHERE client_id = ? AND CallDate BETWEEN ? AND ? AND LOWER(TranscribeText) LIKE ?
     ORDER BY CallDate DESC LIMIT ${Number(limit)}`,
    [args.clientId, startDate, endDate, needle],
  );
  return {
    clientId: args.clientId,
    phrase: args.phrase,
    dateFrom: startDate.slice(0, 10),
    dateTo: endDate.slice(0, 10),
    matchCount: Number(countRow?.cnt ?? 0),
    samples: samples.map(s => {
      const idx = s.TranscribeText.toLowerCase().indexOf(args.phrase.toLowerCase());
      const snippet = idx >= 0 ? s.TranscribeText.slice(Math.max(0, idx - 60), idx + 200) : s.TranscribeText.slice(0, 200);
      return { callId: s.id, agentName: s.AgentName, callDate: s.CallDate, snippet };
    }),
  };
}

// ─── Tool: findCallsByPhone — locate call(s) by the customer's phone number ─────────────────────
// Users know a customer's phone number, not the internal numeric call ID that getCallTranscript
// requires — this resolves a phone number + client/process into the matching call(s) and returns
// full transcripts directly (checking both outbound CallDetails and inbound audit calls, since
// either could hold that number under the same client), so the model can analyze in the same turn
// instead of needing a second lookup once it learns the call ID.
export interface FindCallsByPhoneArgs { clientId: number; phoneNumber: string; dateFrom?: string; dateTo?: string }
interface PhoneCallMatch {
  callId: number; direction: 'outbound' | 'inbound'; agentName: string; mobileNo: string; callDate: string;
  transcript: string; saleDone?: string; callDisposition?: string; qualityPercentage?: number; scenario?: string;
}
export async function findCallsByPhone(scope: RequestScope, args: FindCallsByPhoneArgs) {
  await assertClientAllowed(scope, args.clientId);
  const digits = args.phoneNumber.replace(/\D/g, '');
  if (digits.length < 5) return { found: false, message: 'Please provide a valid phone number (at least 5 digits) to search for.' };
  // MobileNo is stored inconsistently between (and even within) these tables — sometimes the bare
  // 10-digit number, sometimes with a "91" country-code prefix — so a straight equality check would
  // silently miss real matches depending on which form happens to be stored. Comparing the last 10
  // digits on both sides handles either form correctly. A genuinely partial number (caller gave only
  // the last few digits) falls back to a right-anchored suffix match instead of full equality.
  const isFullNumber = digits.length >= 10;
  const last10 = digits.slice(-10);
  const matchClause = isFullNumber ? 'RIGHT(MobileNo, 10) = ?' : 'MobileNo LIKE ?';
  const matchParam = isFullNumber ? last10 : `%${digits}`;

  // Default window kept short (30 days, not defaultRange()'s "this month") — these tables have no
  // MobileNo index, so every extra day widens an unavoidable table scan. The model can still pass
  // an explicit wider dateFrom/dateTo if the user names a specific older period.
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const startDate = args.dateFrom ? `${args.dateFrom} 00:00:00` : `${fmt(thirtyDaysAgo)} 00:00:00`;
  const endDate = args.dateTo ? `${args.dateTo} 23:59:59` : `${fmt(now)} 23:59:59`;

  const [outboundRows, inboundRows] = await Promise.all([
    querySource<{ id: number; AgentName: string | null; MobileNo: string | null; CallDate: string; TranscribeText: string | null; SaleDone: string | null; CallDisposition: string | null }>(
      `SELECT id, AgentName, MobileNo, CallDate, TranscribeText, SaleDone, CallDisposition FROM db_external.CallDetails
       WHERE client_id = ? AND ${matchClause} AND CallDate BETWEEN ? AND ? ORDER BY CallDate DESC LIMIT 10`,
      [args.clientId, matchParam, startDate, endDate],
    ),
    querySource<{ id: number; User: string | null; MobileNo: string | null; CallDate: string; Transcribe_Text: string | null; quality_percentage: string | null; scenario: string | null }>(
      `SELECT id, User, MobileNo, CallDate, Transcribe_Text, quality_percentage, scenario FROM db_audit.call_quality_assessment
       WHERE ClientId = ? AND ${matchClause} AND CallDate BETWEEN ? AND ? ORDER BY CallDate DESC LIMIT 10`,
      [String(args.clientId), matchParam, startDate, endDate],
    ),
  ]);

  const matches: PhoneCallMatch[] = [
    ...outboundRows.map(r => ({
      callId: Number(r.id), direction: 'outbound' as const, agentName: r.AgentName ?? 'Unknown', mobileNo: r.MobileNo ?? '',
      callDate: String(r.CallDate), transcript: r.TranscribeText ?? '',
      saleDone: r.SaleDone ?? undefined, callDisposition: r.CallDisposition ?? undefined,
    })),
    ...inboundRows.map(r => ({
      callId: Number(r.id), direction: 'inbound' as const, agentName: r.User ?? 'Unknown', mobileNo: r.MobileNo ?? '',
      callDate: String(r.CallDate), transcript: r.Transcribe_Text ?? '',
      qualityPercentage: r.quality_percentage != null ? Number(r.quality_percentage) : undefined, scenario: r.scenario ?? undefined,
    })),
  ].sort((a, b) => new Date(b.callDate).getTime() - new Date(a.callDate).getTime());

  // db_audit.call_quality_assessment IS the QA audit table — a match there means this number's
  // call has actually been audited, not just placed. A CallDetails-only match means the call
  // happened but no audit record exists for it yet (useful on its own as an "is this audited?"
  // answer, without needing the caller to also want the transcript).
  const auditStatus: 'audited' | 'not_audited' | 'no_call_found' =
    inboundRows.length > 0 ? 'audited' : outboundRows.length > 0 ? 'not_audited' : 'no_call_found';

  if (matches.length === 0) {
    return {
      found: false,
      auditStatus,
      message: `No calls found for phone number ${args.phoneNumber} on this process between ${startDate.slice(0, 10)} and ${endDate.slice(0, 10)}.`,
    };
  }

  // Cap full transcripts returned to control token cost — beyond the 3 most recent, just list
  // id/date/direction so the model can call getCallTranscript for a specific older one if asked.
  const calls = matches.slice(0, 3).map(m => ({ ...m, transcript: m.transcript || '(no transcript captured for this call)' }));
  const moreCalls = matches.slice(3).map(m => ({ callId: m.callId, direction: m.direction, callDate: m.callDate }));

  return {
    found: true,
    clientId: args.clientId,
    phoneNumber: args.phoneNumber,
    matchCount: matches.length,
    auditStatus,
    auditedCallCount: inboundRows.length,
    unauditedCallCount: outboundRows.length,
    calls,
    moreCalls: moreCalls.length > 0 ? moreCalls : undefined,
  };
}

// ─── Tool: getSalesKPIs ──────────────────────────────────────────────────────────────────────
export interface GetSalesKpiArgs { clientId: number; dateFrom?: string; dateTo?: string }
export async function getSalesKPIs(scope: RequestScope, args: GetSalesKpiArgs) {
  await assertClientAllowed(scope, args.clientId);
  const { startDate, endDate } = defaultRange(args.dateFrom, args.dateTo);
  const kpis = await salesSvc.getSalesKPIs({ startDate, endDate, clientIds: [args.clientId] });
  return { clientId: args.clientId, dateFrom: startDate.slice(0, 10), dateTo: endDate.slice(0, 10), ...kpis };
}

// ─── Tool: getFraudCalls ─────────────────────────────────────────────────────────────────────
export interface GetFraudArgs { clientId: number; dateFrom?: string; dateTo?: string }
export async function getFraudCalls(scope: RequestScope, args: GetFraudArgs) {
  await assertClientAllowed(scope, args.clientId);
  const { startDate, endDate } = defaultRange(args.dateFrom, args.dateTo);
  const result = await qualitySvc.getOutboundFraudCalls({ startDate, endDate, clientId: String(args.clientId) });
  return { clientId: args.clientId, dateFrom: startDate.slice(0, 10), dateTo: endDate.slice(0, 10), ...result };
}

// ─── Tool: compareCQPeriods ──────────────────────────────────────────────────────────────────
export interface CompareCqArgs {
  clientId: number;
  periodA: { dateFrom: string; dateTo: string };
  periodB: { dateFrom: string; dateTo: string };
}
export async function compareCQPeriods(scope: RequestScope, args: CompareCqArgs) {
  const [a, b] = await Promise.all([
    getCQScore(scope, { clientId: args.clientId, dateFrom: args.periodA.dateFrom, dateTo: args.periodA.dateTo }),
    getCQScore(scope, { clientId: args.clientId, dateFrom: args.periodB.dateFrom, dateTo: args.periodB.dateTo }),
  ]);
  return { periodA: a, periodB: b };
}

// ─── Tool registry — name -> {description, schema, fn} — consumed by both the provider (as its
// tool-use spec) and the orchestrator (to actually invoke). Keep descriptions accurate: the model
// only knows what a tool does from this text and its parameter names. ───────────────────────────
export const TOOL_DEFS = [
  {
    name: 'getCQScore',
    description: "Get the CQ (Call Quality) score for a process. IMPORTANT: pass direction to pick which one — 'outbound' (default) uses the per-client Outbound CQ formula (only defined for Housing Owner 496, Housing Premium 419, Bellavita 375, GNC 409) and returns top/bottom agents; 'inbound' uses the separate Inbound audit pipeline (available for any client with Inbound audit data, e.g. Bellavita 375, GNC, Clovia, Neemans, Viega, Exicom) and returns sub-scores (opening/soft-skill/hold/resolution/closing) instead of an agent breakdown. The same clientId can have both — they are different data sources, not a filter on one dataset.",
    parameters: {
      type: 'object' as const,
      properties: {
        clientId: { type: 'integer', description: 'The numeric client/process ID' },
        direction: { type: 'string', enum: ['outbound', 'inbound'], description: "Defaults to 'outbound' if omitted" },
        dateFrom: { type: 'string', description: 'YYYY-MM-DD, defaults to start of current month' },
        dateTo: { type: 'string', description: 'YYYY-MM-DD, defaults to today' },
      },
      required: ['clientId'],
    },
    run: getCQScore,
  },
  {
    name: 'getCallCount',
    description: 'Get raw call counts for a client/process in a date range: total calls, calls with a valid mobile number, and calls that resulted in a sale.',
    parameters: {
      type: 'object' as const,
      properties: {
        clientId: { type: 'integer' },
        dateFrom: { type: 'string' },
        dateTo: { type: 'string' },
      },
      required: ['clientId'],
    },
    run: getCallCount,
  },
  {
    name: 'getAgentPerformance',
    description: "Get agent-level CQ performance for a process. Pass direction='inbound' for Inbound (returns each agent's CQ score PLUS their 5 component sub-scores: opening skill, soft skill, hold procedure, resolution, closing) or 'outbound' (default, agent overall score only). Pass agentName to look up one specific agent, sort=top/bottom to rank, or full=true when the user wants a complete report/list of every agent rather than a short top-15 preview.",
    parameters: {
      type: 'object' as const,
      properties: {
        clientId: { type: 'integer' },
        direction: { type: 'string', enum: ['outbound', 'inbound'], description: "Defaults to 'outbound' if omitted" },
        agentName: { type: 'string', description: 'Partial agent name to search for' },
        sort: { type: 'string', enum: ['top', 'bottom'] },
        full: { type: 'boolean', description: 'Set true to return every agent (a full report), not just the top 15' },
        dateFrom: { type: 'string' },
        dateTo: { type: 'string' },
      },
      required: ['clientId'],
    },
    run: getAgentPerformance,
  },
  {
    name: 'getCQScoreDateWise',
    description: "Get a day-by-day CQ score trend for a process (one row per calendar day: date, CQ score, call count) — use this for any 'date wise', 'day wise', 'daily trend', or 'show me the trend over September' style request. Same direction rules as getCQScore (outbound default; inbound for the audit-based pipeline).",
    parameters: {
      type: 'object' as const,
      properties: {
        clientId: { type: 'integer' },
        direction: { type: 'string', enum: ['outbound', 'inbound'], description: "Defaults to 'outbound' if omitted" },
        dateFrom: { type: 'string' },
        dateTo: { type: 'string' },
      },
      required: ['clientId'],
    },
    run: getCQScoreDateWise,
  },
  {
    name: 'getObjectionAnalysis',
    description: 'Get the breakdown of customer objections (main objection categories and subcategories) for a process in a date range.',
    parameters: {
      type: 'object' as const,
      properties: { clientId: { type: 'integer' }, dateFrom: { type: 'string' }, dateTo: { type: 'string' } },
      required: ['clientId'],
    },
    run: getObjectionAnalysis,
  },
  {
    name: 'getCallTranscript',
    description: 'Get the full transcript and metadata for one specific call by its numeric call ID.',
    parameters: {
      type: 'object' as const,
      properties: { callId: { type: 'integer' }, clientId: { type: 'integer' } },
      required: ['callId', 'clientId'],
    },
    run: getCallTranscript,
  },
  {
    name: 'findCallsByPhone',
    description: "Find and retrieve call transcript(s) for a specific customer by their phone/mobile number, for a given process. Use this whenever the user gives you a phone number (instead of an internal call ID) and asks to analyze, review, check, or ask any question about that customer's call — it checks both outbound call data and the inbound QA audit table for that number and returns full transcripts (up to the 3 most recent matches) ready to analyze in your answer, no follow-up lookup needed. Also use this to answer 'has this number/call been audited?' — the result's auditStatus field tells you directly: 'audited' (a QA audit record exists), 'not_audited' (the call happened but has no audit record yet), or 'no_call_found'.",
    parameters: {
      type: 'object' as const,
      properties: {
        clientId: { type: 'integer', description: 'The numeric client/process ID' },
        phoneNumber: { type: 'string', description: "The customer's phone/mobile number (with or without formatting)" },
        dateFrom: { type: 'string', description: 'YYYY-MM-DD, defaults to 180 days ago' },
        dateTo: { type: 'string', description: 'YYYY-MM-DD, defaults to today' },
      },
      required: ['clientId', 'phoneNumber'],
    },
    run: findCallsByPhone,
  },
  {
    name: 'searchTranscripts',
    description: 'Search call transcripts for a specific word or phrase (e.g. a script line, a product name, a complaint) within a date range for a client. Returns a match count and a few sample snippets — use this to check whether agents said something specific.',
    parameters: {
      type: 'object' as const,
      properties: {
        clientId: { type: 'integer' },
        phrase: { type: 'string', description: 'The word or phrase to search for (case-insensitive substring match)' },
        dateFrom: { type: 'string' },
        dateTo: { type: 'string' },
        limit: { type: 'integer', description: 'Max sample snippets to return, default 10, max 25' },
      },
      required: ['clientId', 'phrase'],
    },
    run: searchTranscripts,
  },
  {
    name: 'getSalesKPIs',
    description: 'Get sales KPIs (total calls, total sales, revenue, average sale, COD vs paid split) for a client in a date range.',
    parameters: {
      type: 'object' as const,
      properties: { clientId: { type: 'integer' }, dateFrom: { type: 'string' }, dateTo: { type: 'string' } },
      required: ['clientId'],
    },
    run: getSalesKPIs,
  },
  {
    name: 'getFraudCalls',
    description: 'Get calls flagged for fraud/data-security compliance issues for a client in a date range.',
    parameters: {
      type: 'object' as const,
      properties: { clientId: { type: 'integer' }, dateFrom: { type: 'string' }, dateTo: { type: 'string' } },
      required: ['clientId'],
    },
    run: getFraudCalls,
  },
  {
    name: 'compareCQPeriods',
    description: 'Compare CQ score between two date ranges for the same process (e.g. this month vs last month).',
    parameters: {
      type: 'object' as const,
      properties: {
        clientId: { type: 'integer' },
        periodA: { type: 'object', properties: { dateFrom: { type: 'string' }, dateTo: { type: 'string' } }, required: ['dateFrom', 'dateTo'] },
        periodB: { type: 'object', properties: { dateFrom: { type: 'string' }, dateTo: { type: 'string' } }, required: ['dateFrom', 'dateTo'] },
      },
      required: ['clientId', 'periodA', 'periodB'],
    },
    run: compareCQPeriods,
  },
  {
    name: 'resolveClientByName',
    description: 'Look up a client/process\'s numeric ID by name (e.g. "BellaVita", "Housing Owner", "GNC"). Use this first if the user names a process but you don\'t know its clientId.',
    parameters: {
      type: 'object' as const,
      properties: { name: { type: 'string' } },
      required: ['name'],
    },
    run: (_scope: RequestScope, args: { name: string }) => resolveClientByName(args.name),
  },
] as const;

export type ToolName = (typeof TOOL_DEFS)[number]['name'];
