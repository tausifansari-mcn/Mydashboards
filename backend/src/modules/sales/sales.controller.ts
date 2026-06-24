import { Request, Response } from 'express';
import * as svc from './sales.service';
import { resolveUserScope } from '../call-master/call-master.service';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function parseDateRange(req: Request): { startDate: string; endDate: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const defaultStart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} 00:00`;
  const defaultEnd   = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} 23:59`;
  return {
    startDate: (req.query.startDate as string) || defaultStart,
    endDate:   (req.query.endDate   as string) || defaultEnd,
  };
}

async function buildFilters(req: Request): Promise<svc.SalesFilters> {
  const { startDate, endDate } = parseDateRange(req);
  const scope = await resolveUserScope(req.user!.id, req.tenantId ?? null);

  let clientIds: number[] | undefined;
  if (req.query.clientId) {
    const requested = Number(req.query.clientId);
    clientIds = (scope.clientIds === null || scope.clientIds.includes(requested))
      ? [requested]
      : [];
  } else if (scope.clientIds !== null) {
    clientIds = scope.clientIds.length ? scope.clientIds : [-1];
  }

  const lob = (req.query.lob as string) || 'All';
  return { startDate, endDate, clientIds, lob };
}

// ─── Controllers ──────────────────────────────────────────────────────────────

export async function getKPIs(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    const data = await svc.getSalesKPIs(filters);
    res.json({ success: true, data });
  } catch (err) {
    console.error('sales getKPIs error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch sales KPIs' });
  }
}

export async function getTrend(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    const data = await svc.getSalesTrend(filters);
    res.json({ success: true, data });
  } catch (err) {
    console.error('sales getTrend error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch sales trend' });
  }
}

export async function getByLob(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    const data = await svc.getSalesByLob(filters);
    res.json({ success: true, data });
  } catch (err) {
    console.error('sales getByLob error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch sales by LOB' });
  }
}

export async function getPayment(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    const data = await svc.getPaymentBreakdown(filters);
    res.json({ success: true, data });
  } catch (err) {
    console.error('sales getPayment error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch payment breakdown' });
  }
}

export async function getProducts(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    const limit = Math.min(Number(req.query.limit) || 12, 50);
    const data = await svc.getTopProducts(filters, limit);
    res.json({ success: true, data });
  } catch (err) {
    console.error('sales getProducts error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch top products' });
  }
}

export async function getAgents(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    const data = await svc.getAgentLeaderboard(filters);
    res.json({ success: true, data });
  } catch (err) {
    console.error('sales getAgents error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch agent leaderboard' });
  }
}

export async function getSubScenarios(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    const data = await svc.getSubScenarios(filters);
    res.json({ success: true, data });
  } catch (err) {
    console.error('sales getSubScenarios error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch sub-scenarios' });
  }
}

export async function getLobList(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    const data = await svc.getSalesLobList(filters);
    res.json({ success: true, data });
  } catch (err) {
    console.error('sales getLobList error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch LOB list' });
  }
}

export async function exportSales(req: Request, res: Response) {
  try {
    const { startDate, endDate } = parseDateRange(req);
    const scope = await resolveUserScope(req.user!.id, req.tenantId ?? null);

    let clientIds: number[] | undefined;
    if (req.query.clientId) {
      const requested = Number(req.query.clientId);
      clientIds = (scope.clientIds === null || scope.clientIds.includes(requested))
        ? [requested]
        : [];
    } else if (scope.clientIds !== null) {
      clientIds = scope.clientIds.length ? scope.clientIds : [-1];
    }

    const lob = (req.query.lob as string) || 'All';
    const limit = Math.min(Number(req.query.limit) || 10000, 50000);
    const filters: svc.SalesFilters = { startDate, endDate, clientIds, lob };
    const rows = await svc.getSalesExport(filters, limit);
    res.json({ success: true, data: { rows, count: rows.length } });
  } catch (err) {
    console.error('sales exportSales error:', err);
    res.status(500).json({ success: false, message: 'Export failed' });
  }
}
