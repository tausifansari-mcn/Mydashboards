import { Request, Response } from 'express';
import * as svc from './call-master.service';
import * as oi from './opening-intelligence.service';

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
    if (scope.clientIds === null || scope.clientIds.includes(requested)) {
      clientIds = [requested];
    } else {
      clientIds = [-1];
    }
  } else if (scope.clientIds !== null) {
    clientIds = scope.clientIds.length ? scope.clientIds : [-1];
  }

  return { startDate, endDate, lob: 'Outbound', clientIds };
}

export async function getOIExecutiveSummary(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    res.json({ success: true, data: await oi.getOIExecutiveSummary(filters) });
  } catch (err) { console.error('getOIExecutiveSummary:', err); res.status(500).json({ success: false, message: 'Failed' }); }
}

export async function getOpeningByCategory(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    res.json({ success: true, data: await oi.getOpeningByCategory(filters) });
  } catch (err) { console.error('getOpeningByCategory:', err); res.status(500).json({ success: false, message: 'Failed' }); }
}

export async function getOpeningRawCategories(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    res.json({ success: true, data: await oi.getOpeningRawCategories(filters) });
  } catch (err) { console.error('getOpeningRawCategories:', err); res.status(500).json({ success: false, message: 'Failed' }); }
}

export async function getOpeningTrend(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    const period = (req.query.period as 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly') || 'daily';
    res.json({ success: true, data: await oi.getOpeningTrend(filters, period) });
  } catch (err) { console.error('getOpeningTrend:', err); res.status(500).json({ success: false, message: 'Failed' }); }
}

export async function getOpeningByDimension(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    const dim = (req.query.dim as 'client' | 'agent' | 'campaign') || 'agent';
    res.json({ success: true, data: await oi.getOpeningByDimension(filters, dim) });
  } catch (err) { console.error('getOpeningByDimension:', err); res.status(500).json({ success: false, message: 'Failed' }); }
}

export async function getContextByCategory(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    res.json({ success: true, data: await oi.getContextByCategory(filters) });
  } catch (err) { console.error('getContextByCategory:', err); res.status(500).json({ success: false, message: 'Failed' }); }
}

export async function getContextTrend(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    const period = (req.query.period as 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly') || 'daily';
    res.json({ success: true, data: await oi.getContextTrend(filters, period) });
  } catch (err) { console.error('getContextTrend:', err); res.status(500).json({ success: false, message: 'Failed' }); }
}

export async function getContextByDimension(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    const dim = (req.query.dim as 'client' | 'agent' | 'campaign') || 'agent';
    res.json({ success: true, data: await oi.getContextByDimension(filters, dim) });
  } catch (err) { console.error('getContextByDimension:', err); res.status(500).json({ success: false, message: 'Failed' }); }
}

export async function getOpeningVsSales(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    res.json({ success: true, data: await oi.getOpeningVsSales(filters) });
  } catch (err) { console.error('getOpeningVsSales:', err); res.status(500).json({ success: false, message: 'Failed' }); }
}

export async function getOpeningLeaderboard(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    res.json({ success: true, data: await oi.getOpeningLeaderboard(filters) });
  } catch (err) { console.error('getOpeningLeaderboard:', err); res.status(500).json({ success: false, message: 'Failed' }); }
}

export async function getOIAIInsights(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    res.json({ success: true, data: await oi.getOIAIInsights(filters) });
  } catch (err) { console.error('getOIAIInsights:', err); res.status(500).json({ success: false, message: 'Failed' }); }
}
