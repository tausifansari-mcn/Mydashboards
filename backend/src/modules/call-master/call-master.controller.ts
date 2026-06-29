import { Request, Response } from 'express';
import * as svc from './call-master.service';

function parseDateRange(req: Request): { startDate: string; endDate: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const defaultStart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01 00:00`;
  const defaultEnd   = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const startDate = (req.query.startDate as string) || defaultStart;
  const endDate   = (req.query.endDate   as string) || defaultEnd;
  return { startDate, endDate };
}

async function buildFilters(req: Request): Promise<svc.CallMasterFilters> {
  const { startDate, endDate } = parseDateRange(req);
  const requestedLob = (req.query.lob as 'Inbound' | 'Outbound' | 'All') || 'All';

  // Resolve scope: which clients + LOBs this user can see
  const scope = await svc.resolveUserScope(req.user!.id, req.tenantId ?? null);

  // Clamp the requested LOB to what the user's processes allow
  let lob: 'Inbound' | 'Outbound' | 'All' = requestedLob;
  if (scope.allowedLobs !== null) {
    const hasIb = scope.allowedLobs.includes('Inbound');
    const hasOb = scope.allowedLobs.includes('Outbound');
    if (hasIb && !hasOb)       lob = 'Inbound';
    else if (!hasIb && hasOb)  lob = 'Outbound';
    // if both allowed: respect what the user requested
  }

  let clientIds: number[] | undefined;
  if (req.query.clientId) {
    const requested = Number(req.query.clientId);
    if (scope.clientIds === null || scope.clientIds.includes(requested)) {
      clientIds = [requested];
    } else {
      clientIds = []; // requested client not in allowed set → empty result
    }
  } else if (scope.clientIds !== null) {
    clientIds = scope.clientIds.length ? scope.clientIds : [-1]; // no clients → no results
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
    const data = await svc.getClientList(req.tenantId ?? null, req.user!.id);
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

export async function getProcessList(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    const data = await svc.getProcessList(filters);
    res.json({ success: true, data });
  } catch (err) {
    console.error('getProcessList error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch process list' });
  }
}

export async function getFatalByDay(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    const data = await svc.getFatalByDay(filters);
    res.json({ success: true, data });
  } catch (err) {
    console.error('getFatalByDay error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch fatal by day' });
  }
}

export async function exportData(req: Request, res: Response) {
  try {
    const { startDate, endDate } = parseDateRange(req);
    const source = (req.query.source as 'inbound' | 'outbound') || 'inbound';
    const scope  = await svc.resolveUserScope(req.user!.id, req.tenantId ?? null);

    // LOB access check
    if (scope.allowedLobs !== null) {
      const required = source === 'inbound' ? 'Inbound' : 'Outbound';
      if (!scope.allowedLobs.includes(required)) {
        res.status(403).json({ success: false, message: `Access to ${source} data not permitted` });
        return;
      }
    }

    // Resolve clientIds (mirrors buildFilters logic)
    let clientIds: number[] | undefined;
    if (req.query.clientId) {
      const requested = Number(req.query.clientId);
      clientIds = (scope.clientIds === null || scope.clientIds.includes(requested))
        ? [requested]
        : [];
    } else if (scope.clientIds !== null) {
      clientIds = scope.clientIds.length ? scope.clientIds : [-1];
    }

    const filters: svc.CallMasterFilters = { startDate, endDate, clientIds };
    const columns = req.query.columns
      ? String(req.query.columns).split(',').map(c => c.trim()).filter(Boolean)
      : [];
    const limit = Math.min(Number(req.query.limit) || 5000, 10000);

    const rows = await svc.getExportData(filters, source, columns, limit);
    res.json({ success: true, data: { rows, count: (rows as unknown[]).length } });
  } catch (err) {
    console.error('exportData error:', err);
    res.status(500).json({ success: false, message: 'Export failed' });
  }
}

export async function getOBSummary(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    res.json({ success: true, data: await svc.getOBSummary(filters) });
  } catch (err) { console.error('getOBSummary:', err); res.status(500).json({ success: false, message: 'Failed' }); }
}

export async function getOBDailyTrend(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    res.json({ success: true, data: await svc.getOBDailyTrend(filters) });
  } catch (err) { console.error('getOBDailyTrend:', err); res.status(500).json({ success: false, message: 'Failed' }); }
}

export async function getOBHourly(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    res.json({ success: true, data: await svc.getOBHourly(filters) });
  } catch (err) { console.error('getOBHourly:', err); res.status(500).json({ success: false, message: 'Failed' }); }
}

export async function getOBAgentPerf(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    res.json({ success: true, data: await svc.getOBAgentPerf(filters, limit) });
  } catch (err) { console.error('getOBAgentPerf:', err); res.status(500).json({ success: false, message: 'Failed' }); }
}

export async function getOBAgentDaily(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    const agentName = req.query.agentName as string;
    if (!agentName) { res.status(400).json({ success: false, message: 'agentName required' }); return; }
    res.json({ success: true, data: await svc.getOBAgentDaily(agentName, filters) });
  } catch (err) { console.error('getOBAgentDaily:', err); res.status(500).json({ success: false, message: 'Failed' }); }
}

export async function getOBDisposition(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    res.json({ success: true, data: await svc.getOBDisposition(filters) });
  } catch (err) { console.error('getOBDisposition:', err); res.status(500).json({ success: false, message: 'Failed' }); }
}

export async function getOBProductMix(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    res.json({ success: true, data: await svc.getOBProductMix(filters) });
  } catch (err) { console.error('getOBProductMix:', err); res.status(500).json({ success: false, message: 'Failed' }); }
}

export async function getOBNotInterested(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    res.json({ success: true, data: await svc.getOBNotInterested(filters) });
  } catch (err) { console.error('getOBNotInterested:', err); res.status(500).json({ success: false, message: 'Failed' }); }
}

export async function getOBQualityParams(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    res.json({ success: true, data: await svc.getOBQualityParams(filters) });
  } catch (err) { console.error('getOBQualityParams:', err); res.status(500).json({ success: false, message: 'Failed' }); }
}

export async function getFatalAgentSummary(req: Request, res: Response) {
  try {
    const { startDate, endDate } = parseDateRange(req);
    const scope = await svc.resolveUserScope(req.user!.id, req.tenantId ?? null);

    if (scope.allowedLobs !== null && !scope.allowedLobs.includes('Inbound')) {
      res.status(403).json({ success: false, message: 'Access to inbound data not permitted' });
      return;
    }

    let clientIds: number[] | undefined;
    if (req.query.clientId) {
      const requested = Number(req.query.clientId);
      clientIds = (scope.clientIds === null || scope.clientIds.includes(requested))
        ? [requested]
        : [];
    } else if (scope.clientIds !== null) {
      clientIds = scope.clientIds.length ? scope.clientIds : [-1];
    }

    const limit = Math.min(Number(req.query.limit) || 50000, 100000);
    const filters: svc.CallMasterFilters = { startDate, endDate, clientIds };
    const rows = await svc.getFatalAgentSummary(filters, limit);
    res.json({ success: true, data: { rows, count: rows.length } });
  } catch (err) {
    console.error('getFatalAgentSummary error:', err);
    res.status(500).json({ success: false, message: 'Fatal agent report failed' });
  }
}
