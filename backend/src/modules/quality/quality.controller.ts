import { Request, Response } from 'express';
import * as svc from './quality.service';
import { resolveUserScope } from '../call-master/call-master.service';
import { getCaseActions as getCaseActionsFromLib, upsertCaseAction, type CaseActionFeature } from '../../lib/caseActions';

function parseDateRange(req: Request): svc.QualityFilters {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const defaultStart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01 00:00`;
  const defaultEnd   = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} 23:59`;
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
    await svc.streamOutboundExportCsv(res, startDate, endDate, clientIds);
  } catch (err: unknown) {
    if (!res.headersSent) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      res.status(500).json({ message: msg });
    } else {
      res.end();
    }
  }
}
