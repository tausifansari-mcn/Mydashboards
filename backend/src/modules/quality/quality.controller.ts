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
    const { id, stage, stageTitle, objectionCategory, scriptText, displayOrder } = req.body;
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
