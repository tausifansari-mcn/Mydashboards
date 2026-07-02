import { Request, Response } from 'express';
import * as svc from './quality.service';

function parseDateRange(req: Request): svc.QualityFilters {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const defaultStart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01 00:00`;
  const defaultEnd   = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} 23:59`;
  return {
    startDate: (req.query.startDate as string) || defaultStart,
    endDate:   (req.query.endDate   as string) || defaultEnd,
    clientId:  req.query.clientId as string | undefined,
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

export async function getClientsSummary(req: Request, res: Response) {
  try {
    const filters = parseDateRange(req);
    const data = await svc.getClientsSummary(filters);
    res.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ message: msg });
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
