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

export async function getSocialThreatDetail(req: Request, res: Response) {
  try {
    const data = await svc.getSocialThreatDetail(parseFilters(req));
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function getTopPositiveSignals(req: Request, res: Response) {
  try {
    const data = await svc.getTopPositiveSignals(parseFilters(req));
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function getPosKeywordPhrases(req: Request, res: Response) {
  try {
    const pattern = (req.query.pattern as string) || '';
    if (!pattern) { res.status(400).json({ message: 'pattern is required' }); return; }
    const data = await svc.getPosKeywordPhrases(parseFilters(req), pattern);
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function getPosKeywordLeads(req: Request, res: Response) {
  try {
    const pattern = (req.query.pattern as string) || '';
    if (!pattern) { res.status(400).json({ message: 'pattern is required' }); return; }
    const data = await svc.getPosKeywordLeads(parseFilters(req), pattern);
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function getClapKeywordDrill(req: Request, res: Response) {
  try {
    const type = (req.query.type as 'pos' | 'neg' | 'social' | 'scam') || 'pos';
    const pattern = (req.query.pattern as string) || '';
    const clap = req.query.clap as string | undefined;
    const scenario = req.query.scenario as string | undefined;
    const subScenario = req.query.subScenario as string | undefined;
    if ((type === 'pos' || type === 'neg') && !pattern && !clap) {
      res.status(400).json({ message: 'pattern or clap is required for pos/neg type' }); return;
    }
    const data = await svc.getClapKeywordDrill(parseFilters(req), type, pattern, clap, scenario, subScenario);
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function getClapWords(req: Request, res: Response) {
  try {
    const data = await svc.getClapWords(parseFilters(req));
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function getTranscript(req: Request, res: Response) {
  try {
    const leadId = (req.query.leadId as string) || '';
    if (!leadId) { res.status(400).json({ message: 'leadId is required' }); return; }
    const data = await svc.getTranscript(leadId);
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

export async function getAbuseDetail(req: Request, res: Response) {
  try {
    const data = await svc.getAbuseDetail(parseFilters(req));
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function getPotentialScamsDetail(req: Request, res: Response) {
  try {
    const data = await svc.getPotentialScamsDetail(parseFilters(req));
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function getNegKeywords(_req: Request, res: Response) {
  try {
    const data = await svc.getNegKeywords();
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function addNegKeyword(req: Request, res: Response) {
  try {
    const { pattern, category } = req.body as { pattern?: string; category?: string };
    if (!pattern || !category) {
      res.status(400).json({ message: 'pattern and category are required' });
      return;
    }
    const validCategories = ['Frustration', 'Threat', 'Abuse', 'Slang', 'Sarcasm'];
    if (!validCategories.includes(category)) {
      res.status(400).json({ message: `category must be one of: ${validCategories.join(', ')}` });
      return;
    }
    await svc.addNegKeyword(pattern.trim(), category);
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function updateNegKeyword(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    const { enabled } = req.body as { enabled?: boolean };
    if (isNaN(id) || enabled === undefined) {
      res.status(400).json({ message: 'id and enabled are required' });
      return;
    }
    await svc.updateNegKeyword(id, Boolean(enabled));
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function reloadNegRules(_req: Request, res: Response) {
  try {
    await svc.reloadNegRules();
    res.json({ success: true, message: 'Neg category rules reloaded' });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function getNegSignalDetail(req: Request, res: Response) {
  try {
    const signal = (req.query.signal as string) as 'Threat' | 'Frustration';
    if (signal !== 'Threat' && signal !== 'Frustration') {
      res.status(400).json({ message: 'signal must be Threat or Frustration' });
      return;
    }
    const data = await svc.getNegSignalDetail(parseFilters(req), signal);
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

export async function getAgentGuidance(req: Request, res: Response) {
  try {
    const data = await svc.getAgentGuidance(parseFilters(req));
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

export async function getBandDetail(req: Request, res: Response) {
  try {
    const filters = {
      ...parseFilters(req),
      band:    (req.query.band    as string) || 'excellent',
      agentId: (req.query.agentId as string) || undefined,
    };
    const data = await svc.getBandDetail(filters);
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function updateAgentMaster(req: Request, res: Response) {
  try {
    const masId = req.params.masId;
    const { agentName } = req.body as { agentName: string };
    if (!masId || !agentName?.trim()) {
      res.status(400).json({ message: 'masId and agentName are required' });
      return;
    }
    await svc.updateAgentName(masId, agentName.trim());
    res.json({ message: 'Agent name updated' });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function getAgentMaster(_req: Request, res: Response) {
  try {
    const data = await svc.getAgentMaster();
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function getMissingAgents(req: Request, res: Response) {
  try {
    const data = await svc.getMissingAgents(parseFilters(req));
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function insertAgentMaster(req: Request, res: Response) {
  try {
    const { masId, agentName, lob, process: proc } = req.body as {
      masId: string; agentName: string; lob: string; process?: string;
    };
    if (!masId || !agentName) {
      res.status(400).json({ message: 'masId and agentName are required' });
      return;
    }
    await svc.insertAgentMaster({ masId, agentName, lob: lob || '', process: proc });
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function getRepeatCallDetail(req: Request, res: Response) {
  try {
    const filters = {
      ...parseFilters(req),
      mobileNo: req.query.mobileNo as string,
      callDate: req.query.callDate as string | undefined,
    };
    if (!filters.mobileNo) { res.status(400).json({ message: 'mobileNo is required' }); return; }
    const data = await svc.getRepeatCallDetail(filters);
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function getRawData(req: Request, res: Response) {
  try {
    const data = await svc.getRawData(parseFilters(req));
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function getScoreComponentDetail(req: Request, res: Response) {
  try {
    const data = await svc.getScoreComponentDetail(parseFilters(req));
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function getAgentCalls(req: Request, res: Response) {
  try {
    const { agentId } = req.query;
    if (!agentId || typeof agentId !== 'string') {
      res.status(400).json({ message: 'agentId is required' });
      return;
    }
    const data = await svc.getAgentCalls({ ...parseFilters(req), agentId });
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function getFatalCallsList(req: Request, res: Response) {
  try {
    const data = await svc.getFatalCallsList(parseFilters(req));
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function getTNIAnalysis(req: Request, res: Response) {
  try {
    const data = await svc.getTNIAnalysis(parseFilters(req));
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function getTNIAgentParams(req: Request, res: Response) {
  try {
    const agentId = req.query.agentId as string;
    if (!agentId) { res.status(400).json({ message: 'agentId is required' }); return; }
    const data = await svc.getTNIAgentParams({ ...parseFilters(req), agentId });
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function getTNIComments(req: Request, res: Response) {
  try {
    const clientId = req.query.clientId as string | undefined;
    const data = await svc.getTNIComments(clientId);
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function upsertTNIComment(req: Request, res: Response) {
  try {
    const { agentId, clientId, comment, updatedBy } = req.body as {
      agentId?: string; clientId?: string; comment?: string; updatedBy?: string;
    };
    if (!agentId) { res.status(400).json({ message: 'agentId is required' }); return; }
    await svc.upsertTNIComment(agentId, clientId ?? '', comment ?? '', updatedBy ?? '');
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}


export async function getClapCustomerAnalysis(req: Request, res: Response) {
  try {
    const data = await svc.getClapCustomerAnalysis(parseFilters(req));
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}

export async function getClapIntelligence(req: Request, res: Response) {
  try {
    const data = await svc.getClapIntelligence(parseFilters(req));
    res.json({ data });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Unknown error' });
  }
}
