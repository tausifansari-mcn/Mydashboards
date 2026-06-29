import { Request, Response } from 'express';
import * as svc from './call-master.service';
import * as ci from './customer-intelligence.service';

function parseDateRange(req: Request) {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const defaultStart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01 00:00`;
  const defaultEnd   = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return {
    startDate: (req.query.startDate as string) || defaultStart,
    endDate:   (req.query.endDate   as string) || defaultEnd,
  };
}

async function buildFilters(req: Request): Promise<svc.CallMasterFilters> {
  const { startDate, endDate } = parseDateRange(req);
  const scope = await svc.resolveUserScope(req.user!.id, req.tenantId ?? null);

  let clientIds: number[] | undefined;
  if (req.query.clientId) {
    const requested = Number(req.query.clientId);
    clientIds = scope.clientIds === null || scope.clientIds.includes(requested) ? [requested] : [-1];
  } else if (scope.clientIds !== null) {
    clientIds = scope.clientIds.length ? scope.clientIds : [-1];
  }

  return { startDate, endDate, lob: 'Outbound', clientIds };
}

const wrap = (fn: (f: svc.CallMasterFilters, ...args: unknown[]) => Promise<unknown>, ...extra: unknown[]) =>
  async (req: Request, res: Response) => {
    try {
      const filters = await buildFilters(req);
      res.json({ success: true, data: await fn(filters, ...extra) });
    } catch (err) {
      console.error(`CI controller error:`, err);
      res.status(500).json({ success: false, message: 'Failed' });
    }
  };

export async function getCIExecutiveSummary(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    res.json({ success: true, data: await ci.getCIExecutiveSummary(filters) });
  } catch (err) { console.error('getCIExecutiveSummary:', err); res.status(500).json({ success: false, message: 'Failed' }); }
}

export async function getSentimentDistribution(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    res.json({ success: true, data: await ci.getSentimentDistribution(filters) });
  } catch (err) { console.error('getSentimentDistribution:', err); res.status(500).json({ success: false, message: 'Failed' }); }
}

export async function getSentimentTrend(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    const period = (req.query.period as 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly') || 'daily';
    res.json({ success: true, data: await ci.getSentimentTrend(filters, period) });
  } catch (err) { console.error('getSentimentTrend:', err); res.status(500).json({ success: false, message: 'Failed' }); }
}

export async function getFeedbackCategories(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    res.json({ success: true, data: await ci.getFeedbackCategories(filters) });
  } catch (err) { console.error('getFeedbackCategories:', err); res.status(500).json({ success: false, message: 'Failed' }); }
}

export async function getFeedbackSubCategories(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    res.json({ success: true, data: await ci.getFeedbackSubCategories(filters) });
  } catch (err) { console.error('getFeedbackSubCategories:', err); res.status(500).json({ success: false, message: 'Failed' }); }
}

export async function getTopObjections(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    res.json({ success: true, data: await ci.getTopObjections(filters) });
  } catch (err) { console.error('getTopObjections:', err); res.status(500).json({ success: false, message: 'Failed' }); }
}

export async function getCustomerJourney(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    res.json({ success: true, data: await ci.getCustomerJourney(filters) });
  } catch (err) { console.error('getCustomerJourney:', err); res.status(500).json({ success: false, message: 'Failed' }); }
}

export async function getFeedbackByDimension(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    const dim = (req.query.dim as 'client' | 'agent' | 'campaign') || 'agent';
    res.json({ success: true, data: await ci.getFeedbackByDimension(filters, dim) });
  } catch (err) { console.error('getFeedbackByDimension:', err); res.status(500).json({ success: false, message: 'Failed' }); }
}

export async function getClientComparison(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    res.json({ success: true, data: await ci.getClientComparison(filters) });
  } catch (err) { console.error('getClientComparison:', err); res.status(500).json({ success: false, message: 'Failed' }); }
}

export async function getCampaignComparison(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    res.json({ success: true, data: await ci.getCampaignComparison(filters) });
  } catch (err) { console.error('getCampaignComparison:', err); res.status(500).json({ success: false, message: 'Failed' }); }
}

export async function getAgentCXRanking(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    res.json({ success: true, data: await ci.getAgentCXRanking(filters) });
  } catch (err) { console.error('getAgentCXRanking:', err); res.status(500).json({ success: false, message: 'Failed' }); }
}

export async function getProductFeedback(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    res.json({ success: true, data: await ci.getProductFeedback(filters) });
  } catch (err) { console.error('getProductFeedback:', err); res.status(500).json({ success: false, message: 'Failed' }); }
}

export async function getOfferingFunnel(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    res.json({ success: true, data: await ci.getOfferingFunnel(filters) });
  } catch (err) { console.error('getOfferingFunnel:', err); res.status(500).json({ success: false, message: 'Failed' }); }
}

export async function getCIAIInsights(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    res.json({ success: true, data: await ci.getCIAIInsights(filters) });
  } catch (err) { console.error('getCIAIInsights:', err); res.status(500).json({ success: false, message: 'Failed' }); }
}
