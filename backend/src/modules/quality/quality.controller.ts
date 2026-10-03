import { Request, Response } from 'express';
import * as svc from './quality.service';
import * as complianceSvc from './housingOwnerCompliance.service';
import * as bvComplianceSvc from './bellavitaCompliance.service';
import { resolveUserScope } from '../call-master/call-master.service';
import { getCaseActions as getCaseActionsFromLib, upsertCaseAction, type CaseActionFeature } from '../../lib/caseActions';

function defaultDateRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    startDate: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01 00:00`,
    endDate:   `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} 23:59`,
  };
}

// "Previous month" (the whole calendar month before the current one) is the other date range the
// AI Quality landing page's picker makes one click away — unlike "this month to date" it was never
// pre-warmed, so picking it always meant a genuinely live, full-month, all-clients aggregate query.
// That query has been measured taking 17-18+ seconds even when it succeeds, which is close enough to
// the 20s hard timeout that it fails outright whenever the shared DB server is even a little busier
// than usual (see warmClientsSummaryCache below for how this gets pre-warmed the same way).
function previousMonthDateRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  return {
    startDate: `${prevMonth.getFullYear()}-${pad(prevMonth.getMonth() + 1)}-01 00:00`,
    endDate:   `${prevMonth.getFullYear()}-${pad(prevMonth.getMonth() + 1)}-${pad(lastDay)} 23:59`,
  };
}

function parseDateRange(req: Request): svc.QualityFilters {
  const { startDate: defaultStart, endDate: defaultEnd } = defaultDateRange();
  const agentIdsRaw = req.query.agentIds as string | undefined;
  const agentIds = agentIdsRaw ? agentIdsRaw.split(',').map(s => s.trim()).filter(Boolean) : undefined;
  return {
    startDate: (req.query.startDate as string) || defaultStart,
    endDate:   (req.query.endDate   as string) || defaultEnd,
    clientId:  req.query.clientId as string | undefined,
    agentIds,
    campaignId: (req.query.campaignId as string | undefined)?.trim() || undefined,
  };
}

export async function getClients(req: Request, res: Response) {
  try {
    const filters = parseDateRange(req);
    const data = await svc.getClients(filters);
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function getKPIs(req: Request, res: Response) {
  try {
    const filters = parseDateRange(req);
    const data = await svc.getKPIs(filters);
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function getSaleDoneCalls(req: Request, res: Response) {
  try {
    const filters = parseDateRange(req);
    const data = await svc.getSaleDoneCalls(filters);
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function getMagicalCategorySaleDoneCalls(req: Request, res: Response) {
  try {
    const filters = parseDateRange(req);
    const category = String(req.query.category ?? '');
    const variant = req.query.variant === 'generic' ? 'generic' : 'bellavita';
    if (!category) { res.status(400).json({ message: 'category is required' }); return; }
    const data = await svc.getMagicalCategorySaleDoneCalls(filters, category, variant);
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function getMissedOpportunityCategoryDetail(req: Request, res: Response) {
  try {
    const filters = parseDateRange(req);
    const category = String(req.query.category ?? '');
    if (!category) { res.status(400).json({ message: 'category is required' }); return; }
    const data = await svc.getMissedOpportunityCategoryDetail(filters, category);
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function getHousingOwnerCQScore(req: Request, res: Response) {
  try {
    const filters = parseDateRange(req);
    const data = await svc.getHousingOwnerCQScore(filters);
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function getHousingOwnerCQScoreDetails(req: Request, res: Response) {
  try {
    const filters = parseDateRange(req);
    const data = await svc.getHousingOwnerCQScoreDetails(filters);
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function getBellavitaCQScore(req: Request, res: Response) {
  try {
    const filters = parseDateRange(req);
    const data = await svc.getBellavitaCQScore(filters);
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function getBellavitaCQScoreDetails(req: Request, res: Response) {
  try {
    const filters = parseDateRange(req);
    const data = await svc.getBellavitaCQScoreDetails(filters);
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function getHousingPremiumCQScore(req: Request, res: Response) {
  try {
    const filters = parseDateRange(req);
    const data = await svc.getHousingPremiumCQScore(filters);
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function getHousingPremiumCQScoreDetails(req: Request, res: Response) {
  try {
    const filters = parseDateRange(req);
    const data = await svc.getHousingPremiumCQScoreDetails(filters);
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function getGncCQScore(req: Request, res: Response) {
  try {
    const filters = parseDateRange(req);
    const data = await svc.getGncCQScore(filters);
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function getGncCQScoreDetails(req: Request, res: Response) {
  try {
    const filters = parseDateRange(req);
    const data = await svc.getGncCQScoreDetails(filters);
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function getHousingOwnerCQScoreDateWise(req: Request, res: Response) {
  try {
    const filters = parseDateRange(req);
    const data = await svc.getHousingOwnerCQScoreDateWise(filters);
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function getBellavitaCQScoreDateWise(req: Request, res: Response) {
  try {
    const filters = parseDateRange(req);
    const data = await svc.getBellavitaCQScoreDateWise(filters);
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function getHousingPremiumCQScoreDateWise(req: Request, res: Response) {
  try {
    const filters = parseDateRange(req);
    const data = await svc.getHousingPremiumCQScoreDateWise(filters);
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function getGncCQScoreDateWise(req: Request, res: Response) {
  try {
    const filters = parseDateRange(req);
    const data = await svc.getGncCQScoreDateWise(filters);
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function getHousingOwnerCompliance(req: Request, res: Response) {
  try {
    const filters = parseDateRange(req);
    const data = await complianceSvc.getHousingOwnerCompliance(filters);
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function getHousingOwnerComplianceDrill(req: Request, res: Response) {
  try {
    const filters = parseDateRange(req);
    const parameter = req.query.parameter as string;
    const pass = req.query.pass !== '0';
    const agentName = (req.query.agentName as string | undefined)?.trim() || undefined;
    if (!parameter) { res.status(400).json({ message: 'parameter is required' }); return; }
    const data = await complianceSvc.getHousingOwnerComplianceDrill(
      filters, parameter as complianceSvc.ComplianceParamKey, pass, agentName,
    );
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

// ─── BellaVita Outbound — AI Compliance & SOP ──────────────────────────────────
function parseComplianceFilters(req: Request): bvComplianceSvc.ComplianceFilters {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const defaultStart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01 00:00`;
  const defaultEnd   = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} 23:59`;
  return {
    startDate: (req.query.startDate as string) || defaultStart,
    endDate:   (req.query.endDate   as string) || defaultEnd,
    agentId:   (req.query.agentId as string | undefined)?.trim() || undefined,
  };
}

export async function getBellavitaComplianceParameters(req: Request, res: Response) {
  try {
    const includeInactive = req.query.includeInactive === '1';
    const data = await bvComplianceSvc.getComplianceParameters(includeInactive);
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function upsertBellavitaComplianceParameter(req: Request, res: Response) {
  try {
    await bvComplianceSvc.upsertComplianceParameter(req.body);
    res.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(400).json({ message: msg });
  }
}

export async function getBellavitaProductMaster(_req: Request, res: Response) {
  try {
    const data = await bvComplianceSvc.getProductMaster();
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function upsertBellavitaProductMaster(req: Request, res: Response) {
  try {
    const id = await bvComplianceSvc.upsertProductMaster(req.body);
    res.json({ success: true, data: { id } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(400).json({ message: msg });
  }
}

export async function ingestBellavitaComplianceAudit(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) { res.status(401).json({ message: 'User not authenticated' }); return; }
    const data = await bvComplianceSvc.ingestBellavitaCallAudit(req.body, userId);
    res.json({ success: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(400).json({ success: false, message: msg });
  }
}

export async function getBellavitaComplianceMonthly(req: Request, res: Response) {
  try {
    const filters = parseComplianceFilters(req);
    const data = await bvComplianceSvc.getBellavitaComplianceMonthly(filters);
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function getBellavitaComplianceCalls(req: Request, res: Response) {
  try {
    const filters = parseComplianceFilters(req);
    const status = (req.query.status as string | undefined) ?? 'all';
    const cursor = req.query.cursor ? Number(req.query.cursor) : undefined;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const data = await bvComplianceSvc.getBellavitaComplianceCalls(
      filters, status as 'all' | 'compliant' | 'non_compliant' | 'critical' | 'review', cursor, limit,
    );
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function getBellavitaComplianceCallDetail(req: Request, res: Response) {
  try {
    const callId = req.params.callId;
    const data = await bvComplianceSvc.getBellavitaComplianceCallDetail(callId);
    if (!data) { res.status(404).json({ message: 'Call audit not found' }); return; }
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function getBellavitaComplianceCallTranscript(req: Request, res: Response) {
  try {
    const callId = req.params.callId;
    const data = await bvComplianceSvc.getBellavitaComplianceTranscript(callId);
    if (!data) { res.status(404).json({ message: 'Transcript not found' }); return; }
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function getFraudCalls(req: Request, res: Response) {
  try {
    const filters = parseDateRange(req);
    const data = await svc.getOutboundFraudCalls(filters);
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function getCaseActions(req: Request, res: Response) {
  try {
    const feature = String(req.query.feature ?? '') as CaseActionFeature;
    const clientId = req.query.clientId as string | undefined;
    const data = await getCaseActionsFromLib(feature, clientId);
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function upsertCaseActionCtrl(req: Request, res: Response) {
  try {
    const { feature, leadId, clientId, action, note, updatedBy } = req.body as {
      feature?: CaseActionFeature; leadId?: string; clientId?: string; action?: string; note?: string; updatedBy?: string;
    };
    if (!feature || !leadId) { res.status(400).json({ message: 'feature and leadId are required' }); return; }
    await upsertCaseAction(feature, leadId, clientId ?? '', action ?? 'no_action', note ?? '', updatedBy ?? '');
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function getMagicalCategoryCallEndCalls(req: Request, res: Response) {
  try {
    const filters = parseDateRange(req);
    const category = String(req.query.category ?? '');
    const variant = req.query.variant === 'generic' ? 'generic' : 'bellavita';
    if (!category) { res.status(400).json({ message: 'category is required' }); return; }
    const data = await svc.getMagicalCategoryCallEndCalls(filters, category, variant);
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function getMagicalStageCallEndCalls(req: Request, res: Response) {
  try {
    const filters = parseDateRange(req);
    const stage = req.query.stage === 'csp' ? 'csp' : req.query.stage === 'offer' ? 'offer' : 'op';
    const variant = req.query.variant === 'generic' ? 'generic' : 'bellavita';
    const data = await svc.getMagicalStageCallEndCalls(filters, stage, variant);
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function getRawCallData(req: Request, res: Response) {
  try {
    const filters = parseDateRange(req);
    const mobileNo = (req.query.mobileNo as string | undefined)?.trim() || undefined;
    const cursor = req.query.cursor ? Number(req.query.cursor) : undefined;
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const data = await svc.getRawCallData(filters, mobileNo, cursor, limit, filters.campaignId);
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function getRawDataCampaigns(req: Request, res: Response) {
  try {
    const clientId = (req.query.clientId as string | undefined)?.trim();
    if (!clientId) { res.json({ data: [] }); return; }
    const data = await svc.getRawDataCampaigns(clientId);
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function getDetailAnalysis(req: Request, res: Response) {
  try {
    const filters = parseDateRange(req);
    const data = await svc.getDetailAnalysis(filters);
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function getCustomerInteractionInsights(req: Request, res: Response) {
  try {
    const filters = parseDateRange(req);
    const data = await svc.getCustomerInteractionInsights(filters);
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function getOutboundInsightDrill(req: Request, res: Response) {
  try {
    const filters = parseDateRange(req);
    const category = String(req.query.category ?? '');
    const data = await svc.getOutboundInsightDrill(filters, category);
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function getOutboundCallTranscript(req: Request, res: Response) {
  try {
    const callId = Number(req.query.callId);
    if (!callId) { res.status(400).json({ message: 'callId is required' }); return; }
    const data = await svc.getOutboundCallTranscript(callId);
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function getObjectionAnalysis(req: Request, res: Response) {
  try {
    const filters = parseDateRange(req);
    const data = await svc.getObjectionAnalysis(filters);
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

// Full-table, no-clientId-filter aggregate across every outbound client — the same result for
// every caller asking about the same date range (any per-client scoping happens client-side after
// the fetch, not in this query), which makes it a safe, effective cache candidate. Added after this
// query was measured genuinely failing — not just slow, actually exceeding the 20s hard timeout —
// on the shared MySQL server this app runs against (also used by other, unrelated, heavily-loaded
// applications). Caching means only the first request after the TTL expires pays that cost; every
// other concurrent/near-concurrent request (any user, any tab) gets the same cached answer instantly
// instead of each independently risking its own timeout.
const CLIENTS_SUMMARY_CACHE_TTL_MS = 5 * 60_000;
// A month that has already fully ended can't gain or lose calls — unlike "this month to date",
// which keeps accumulating, there's no reason to treat a cached answer for it as stale after just
// 5 minutes. A generous 24h TTL (not literally infinite, in case of rare retroactive data fixes)
// means the one-time warmup below is effectively enough for the whole day.
const CLIENTS_SUMMARY_HISTORICAL_TTL_MS = 24 * 60 * 60_000;
const clientsSummaryCache = new Map<string, { at: number; data: Awaited<ReturnType<typeof svc.getClientsSummary>> }>();

// Keyed by DATE only, not the full startDate/endDate strings — the frontend always sends the exact
// current timestamp as endDate (e.g. "2026-09-29 17:23", down to the minute the page happened to
// load), which is a different string on every single request. Keying by the full string meant this
// cache could never actually be hit by real traffic: the background warmup job's key never matched
// any real request's key, so every request kept hitting the live query regardless. Truncating to the
// date means "today, any time" all share one entry — a few minutes of "missing" recent calls in an
// aggregate CQ/conversion summary is an acceptable tradeoff for not risking a 20s timeout.
function clientsSummaryCacheKey(startDate: string, endDate: string): string {
  return `${startDate.slice(0, 10)}|${endDate.slice(0, 10)}`;
}

// Any range that ends before the start of the current calendar month is "closed" — it can't still
// be accumulating new calls — so it gets the long historical TTL instead of the normal 5-minute one.
function cacheTtlFor(endDate: string): number {
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return new Date(endDate) < startOfThisMonth ? CLIENTS_SUMMARY_HISTORICAL_TTL_MS : CLIENTS_SUMMARY_CACHE_TTL_MS;
}

export async function getClientsSummary(req: Request, res: Response) {
  const filters = parseDateRange(req);
  const key = clientsSummaryCacheKey(filters.startDate, filters.endDate);
  const ttl = cacheTtlFor(filters.endDate);
  try {
    const hit = clientsSummaryCache.get(key);
    if (hit && Date.now() - hit.at < ttl) {
      res.json({ data: hit.data, cached: true });
      return;
    }
    const data = await svc.getClientsSummary(filters);
    clientsSummaryCache.set(key, { at: Date.now(), data });
    if (clientsSummaryCache.size > 50) clientsSummaryCache.delete(clientsSummaryCache.keys().next().value as string);
    res.json({ data, cached: false });
  } catch (err: unknown) {
    // A cached-but-stale entry is far more useful to show than an error banner when the DB is the
    // one struggling right now — fall back to it instead of failing outright if we have one at all,
    // even past its normal TTL.
    const stale = clientsSummaryCache.get(key);
    if (stale) { res.json({ data: stale.data, cached: true, stale: true }); return; }
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

// Proactively keeps the cache above warm for the two date ranges the AI Quality landing page's
// picker makes a single click away: "this month to today" (the default view, refreshed every tick)
// and "previous month" (refreshed only once per historical TTL, since that data can't change — see
// cacheTtlFor above). Run on a timer (see startDashboardSummaryWarmup in app.ts) well inside the
// TTL, so a real visitor's request almost never has to wait on — or risk failing — a live query at
// all; it just reads whatever this background refresh last managed to compute, even if that attempt
// itself happened to hit a bad moment on the shared DB server (the request handler above already
// falls back to a stale entry rather than erroring, so a single missed refresh doesn't lose it).
export async function warmClientsSummaryCache(): Promise<void> {
  try {
    // Computes its own precise "now" for the actual query (so the data itself is as fresh as any
    // real request would get), but stores it under the date-only key so any real request for
    // "today" — regardless of the exact minute it was sent — finds this entry.
    const { startDate, endDate } = defaultDateRange();
    const data = await svc.getClientsSummary({ startDate, endDate });
    clientsSummaryCache.set(clientsSummaryCacheKey(startDate, endDate), { at: Date.now(), data });
  } catch (err) {
    console.error('[warmup] clients-summary cache refresh failed:', err instanceof Error ? err.message : err);
  }
  try {
    const { startDate, endDate } = previousMonthDateRange();
    const key = clientsSummaryCacheKey(startDate, endDate);
    const existing = clientsSummaryCache.get(key);
    if (!existing || Date.now() - existing.at >= cacheTtlFor(endDate)) {
      // A full-month, every-client aggregate has been measured taking 17-18+ seconds even when it
      // succeeds — too close to querySource's normal 20s live-request budget to reliably finish
      // under extra DB load. Nobody is blocked waiting on this background refresh, so give it 55s
      // instead of racing the same clock a live request would.
      const data = await svc.getClientsSummary({ startDate, endDate }, 55_000);
      clientsSummaryCache.set(key, { at: Date.now(), data });
    }
  } catch (err) {
    console.error('[warmup] clients-summary previous-month cache refresh failed:', err instanceof Error ? err.message : err);
  }
}

export async function getAgentNPSCSAT(req: Request, res: Response) {
  try {
    const filters = parseDateRange(req);
    const data = await svc.getAgentNPSCSAT(filters);
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function getAgentNPS(req: Request, res: Response) {
  try {
    const filters = parseDateRange(req);
    const data = await svc.getAgentNPS(filters);
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function getClapAnalysis(req: Request, res: Response) {
  try {
    const filters = parseDateRange(req);
    const data = await svc.getClapAnalysis(filters);
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function getMissingAgents(req: Request, res: Response) {
  try {
    const filters = parseDateRange(req);
    const data = await svc.getOutboundMissingAgents(filters);
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function insertAgentMaster(req: Request, res: Response) {
  try {
    const { agentId, agentName, lob } = req.body as { agentId: string; agentName: string; lob?: string };
    if (!agentId || !agentName) { res.status(400).json({ message: 'agentId and agentName required' }); return; }
    await svc.insertAgentMaster({ masId: agentId, agentName, lob: lob ?? 'Outbound' });
    res.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function getMagicalScript(req: Request, res: Response) {
  try {
    const filters = parseDateRange(req);
    const data = await svc.getMagicalScript(filters);
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function getMagicalScriptConfig(req: Request, res: Response) {
  try {
    const clientId = Number(req.query.clientId);
    if (!clientId) { res.status(400).json({ message: 'clientId is required' }); return; }
    const [rows, objectionOptions] = await Promise.all([
      svc.getMagicalScriptConfig(clientId),
      svc.getMagicalScriptObjectionOptions(clientId),
    ]);
    res.json({ data: { rows, objectionOptions } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function saveMagicalScriptConfig(req: Request, res: Response) {
  try {
    const clientId = Number(req.body.clientId);
    const { id, stage, stageTitle, objectionCategory, scriptText, displayOrder, campaignId } = req.body;
    if (!clientId || !stage || !stageTitle || !scriptText) {
      res.status(400).json({ message: 'clientId, stage, stageTitle, and scriptText are required' });
      return;
    }
    const data = await svc.saveMagicalScriptConfig(clientId, {
      id: id ? Number(id) : undefined,
      stage,
      stageTitle,
      objectionCategory: objectionCategory ?? null,
      scriptText,
      displayOrder: Number(displayOrder ?? 0),
      campaignId: campaignId ?? null,
    });
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function deleteMagicalScriptConfig(req: Request, res: Response) {
  try {
    const clientId = Number(req.query.clientId);
    const id = Number(req.params.id);
    if (!clientId || !id) { res.status(400).json({ message: 'clientId and id are required' }); return; }
    await svc.deleteMagicalScriptConfig(clientId, id);
    res.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function getLOBOptions(req: Request, res: Response) {
  try {
    const filters = parseDateRange(req);
    const data = await svc.getLOBOptions(filters);
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
  }
}

export async function exportAllCsv(req: Request, res: Response) {
  try {
    const { startDate, endDate, clientId } = parseDateRange(req);
    const scope = await resolveUserScope(req.user!.id, req.tenantId ?? null);
    // No clientId → export every client the user can see (scope.clientIds, or null = unrestricted).
    // A specific clientId (per-process export button) narrows to just that one — but still fails
    // closed to an empty export if it's outside the requester's own scope, same as enforceClientScope.
    let clientIds = scope.clientIds;
    if (clientId) {
      const requested = Number(clientId);
      clientIds = (scope.clientIds === null || scope.clientIds.includes(requested)) ? [requested] : [];
    }
    const mode = req.query.mode === 'required' ? 'required' as const : undefined;
    await svc.streamOutboundExportCsv(res, startDate, endDate, clientIds, mode);
  } catch (err: unknown) {
    if (!res.headersSent) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      res.status(500).json({ message: msg });
    } else {
      res.end();
    }
  }
}
