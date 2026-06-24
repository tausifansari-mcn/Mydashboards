import { Request, Response } from 'express';
import * as svc from './call-master.service';

function parseDateRange(req: Request): { startDate: string; endDate: string } {
  const today = new Date();
  const startDate = (req.query.startDate as string) || new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const endDate = (req.query.endDate as string) || today.toISOString().slice(0, 10);
  return { startDate, endDate };
}

async function buildFilters(req: Request): Promise<svc.CallMasterFilters> {
  const { startDate, endDate } = parseDateRange(req);
  const lob = (req.query.lob as 'Inbound' | 'Outbound' | 'All') || 'All';

  // Multi-tenant: resolve which clientIds are visible
  const allowedIds = await svc.resolveClientIds(req.tenantId ?? null);
  let clientIds: number[] | undefined;

  if (req.query.clientId) {
    const requested = Number(req.query.clientId);
    if (allowedIds === null || allowedIds.includes(requested)) {
      clientIds = [requested];
    } else {
      clientIds = []; // forbidden — return empty
    }
  } else if (allowedIds !== null) {
    clientIds = allowedIds.length ? allowedIds : [-1]; // tenant with no clients → no results
  }

  return { startDate, endDate, lob, clientIds };
}

export async function getKPIs(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    const data = await svc.getKPIs(filters);
    res.json({ success: true, data });
  } catch (err) {
    console.error('getKPIs error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch KPIs' });
  }
}

export async function getQualityTrend(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    const period = (req.query.period as 'daily' | 'weekly' | 'monthly') || 'daily';
    const data = await svc.getQualityTrend(filters, period);
    res.json({ success: true, data });
  } catch (err) {
    console.error('getQualityTrend error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch quality trend' });
  }
}

export async function getCallsByClient(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    const data = await svc.getCallsByClient(filters);
    res.json({ success: true, data });
  } catch (err) {
    console.error('getCallsByClient error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch calls by client' });
  }
}

export async function getCallsByHour(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    const data = await svc.getCallsByHour(filters);
    res.json({ success: true, data });
  } catch (err) {
    console.error('getCallsByHour error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch calls by hour' });
  }
}

export async function getCallsByDay(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    const data = await svc.getCallsByDay(filters);
    res.json({ success: true, data });
  } catch (err) {
    console.error('getCallsByDay error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch calls by day' });
  }
}

export async function getTopAgents(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const data = await svc.getTopAgents(filters, limit);
    res.json({ success: true, data });
  } catch (err) {
    console.error('getTopAgents error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch top agents' });
  }
}

export async function getSalesFunnel(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    const data = await svc.getSalesFunnel(filters);
    res.json({ success: true, data });
  } catch (err) {
    console.error('getSalesFunnel error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch sales funnel' });
  }
}

export async function getCXParameters(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    const data = await svc.getCXParameters(filters);
    res.json({ success: true, data });
  } catch (err) {
    console.error('getCXParameters error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch CX parameters' });
  }
}

export async function getClientList(req: Request, res: Response) {
  try {
    const data = await svc.getClientList(req.tenantId ?? null);
    res.json({ success: true, data });
  } catch (err) {
    console.error('getClientList error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch client list' });
  }
}

export async function getActiveAgentsList(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    const data = await svc.getActiveAgentsList(filters);
    res.json({ success: true, data });
  } catch (err) {
    console.error('getActiveAgentsList error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch active agents list' });
  }
}

export async function getScenarioDetail(req: Request, res: Response) {
  try {
    const scenario = req.query.scenario as string;
    if (!scenario) { res.status(400).json({ success: false, message: 'scenario query param required' }); return; }
    const filters = await buildFilters(req);
    const data = await svc.getScenarioDetail(scenario, filters);
    res.json({ success: true, data });
  } catch (err) {
    console.error('getScenarioDetail error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch scenario detail' });
  }
}

export async function getAgentParams(req: Request, res: Response) {
  try {
    const agent = req.query.agent as string;
    if (!agent) { res.status(400).json({ success: false, message: 'agent query param required' }); return; }
    const filters = await buildFilters(req);
    const data = await svc.getAgentParams(agent, filters);
    res.json({ success: true, data });
  } catch (err) {
    console.error('getAgentParams error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch agent parameters' });
  }
}

export async function getCallsByMonth(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    const data = await svc.getCallsByMonth(filters);
    res.json({ success: true, data });
  } catch (err) {
    console.error('getCallsByMonth error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch calls by month' });
  }
}
