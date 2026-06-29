import { Request, Response } from 'express';
import * as svc from './inbound-quality.service';

function parseFilters(req: Request): svc.InboundQualityFilters {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const defaultStart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01 00:00:00`;
  const defaultEnd   = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} 23:59:59`;
  return {
    startDate: (req.query.startDate as string) || defaultStart,
    endDate:   (req.query.endDate   as string) || defaultEnd,
    clientId:  req.query.clientId   as string | undefined,
  };
}

export async function getInboundClients(req: Request, res: Response) {
  try {
    const data = await svc.getInboundClients(parseFilters(req));
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function getInboundProcessKPIs(req: Request, res: Response) {
  try {
    const data = await svc.getInboundProcessKPIs(parseFilters(req));
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function getTopPerformers(req: Request, res: Response) {
  try {
    const data = await svc.getTopPerformers(parseFilters(req));
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function getDailyScores(req: Request, res: Response) {
  try {
    const data = await svc.getDailyScores(parseFilters(req));
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function getScenarios(req: Request, res: Response) {
  try {
    const data = await svc.getScenarios(parseFilters(req));
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function getSocialMediaThreats(req: Request, res: Response) {
  try {
    const data = await svc.getSocialMediaThreats(parseFilters(req));
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function getTopNegativeSignalDetails(req: Request, res: Response) {
  try {
    const data = await svc.getTopNegativeSignalDetails(parseFilters(req));
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function getPotentialScams(req: Request, res: Response) {
  try {
    const data = await svc.getPotentialScams(parseFilters(req));
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function getSensitiveWordAnalysis(req: Request, res: Response) {
  try {
    const data = await svc.getSensitiveWordAnalysis(parseFilters(req));
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function getFatalAnalysis(req: Request, res: Response) {
  try {
    const data = await svc.getFatalAnalysis(parseFilters(req));
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function getDetailAnalysis(req: Request, res: Response) {
  try {
    const data = await svc.getDetailAnalysis(parseFilters(req));
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function getAgentParameterWise(req: Request, res: Response) {
  try {
    const filters = { ...parseFilters(req), scenario: req.query.scenario as string | undefined };
    const data = await svc.getAgentParameterWise(filters);
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function getQualityParameters(req: Request, res: Response) {
  try {
    const filters = {
      ...parseFilters(req),
      scenario:  req.query.scenario  as string | undefined,
      agentName: req.query.agentName as string | undefined,
    };
    const data = await svc.getQualityParameters(filters);
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function getWeekWiseQuality(req: Request, res: Response) {
  try {
    const filters = {
      ...parseFilters(req),
      scenario:  req.query.scenario  as string | undefined,
      agentName: req.query.agentName as string | undefined,
    };
    const data = await svc.getWeekWiseQuality(filters);
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function getDayWiseQuality(req: Request, res: Response) {
  try {
    const filters = {
      ...parseFilters(req),
      scenario:  req.query.scenario  as string | undefined,
      agentName: req.query.agentName as string | undefined,
    };
    const data = await svc.getDayWiseQuality(filters);
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function getRepeatAnalysis(req: Request, res: Response) {
  try {
    const data = await svc.getRepeatAnalysis(parseFilters(req));
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function getAgentAuditBandSummary(req: Request, res: Response) {
  try {
    const data = await svc.getAgentAuditBandSummary(parseFilters(req));
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}
