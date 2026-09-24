import { Request, Response } from 'express';
import * as svc from './call-audit.service';
import type { CallAuditRequest } from './call-audit.types';

const REQUIRED_FIELDS: (keyof CallAuditRequest)[] = ['recordingUrl', 'processName', 'lob', 'agentName', 'masId'];

function validateBody(body: Partial<CallAuditRequest>): string | null {
  for (const field of REQUIRED_FIELDS) {
    if (!body[field] || typeof body[field] !== 'string' || !body[field]!.trim()) {
      return `${field} is required`;
    }
  }
  if (body.prompt !== undefined && typeof body.prompt !== 'string') return 'prompt must be a string';
  if ((body.prompt ?? '').length > 3000) return 'prompt is too long (max 3000 characters)';
  try {
    const u = new URL(body.recordingUrl!);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'recordingUrl must be an http(s) URL';
  } catch {
    return 'recordingUrl must be a valid URL';
  }
  return null;
}

function buildAuditRequest(body: CallAuditRequest, recordingUrl: string): CallAuditRequest {
  return {
    recordingUrl,
    processName: body.processName.trim(),
    lob: body.lob.trim(),
    agentName: body.agentName.trim(),
    masId: body.masId.trim(),
    prompt: (body.prompt ?? '').trim(),
  };
}

const MAX_BULK = 20;

export async function runBulk(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const userEmail = req.user?.email;
    if (!userId || !userEmail) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const body = req.body as Partial<CallAuditRequest> & { recordingUrls?: string[] };
    if (!Array.isArray(body.recordingUrls) || body.recordingUrls.length === 0) {
      res.status(400).json({ success: false, message: 'recordingUrls must be a non-empty array of URLs' });
      return;
    }
    if (body.recordingUrls.length > MAX_BULK) {
      res.status(400).json({ success: false, message: `Too many recordings at once (max ${MAX_BULK} — run in smaller batches)` });
      return;
    }

    // Shared context fields come from the request body, like the single-run form — only the URL
    // differs per row. Everything is validated (URL syntax + required fields) before any work starts
    // so a typo fails fast instead of half the batch audited before surfacing.
    const baseError = validateBody({ ...body, recordingUrl: body.recordingUrl ?? body.recordingUrls[0] });
    if (baseError) { res.status(400).json({ success: false, message: baseError }); return; }

    const urls = body.recordingUrls.map(u => u.trim()).filter(Boolean);
    const requests: CallAuditRequest[] = [];
    for (const url of urls) {
      try {
        const u = new URL(url);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('must be http(s)');
      } catch {
        res.status(400).json({ success: false, message: `Invalid URL: ${url.slice(0, 120)}` });
        return;
      }
      requests.push(buildAuditRequest(body as CallAuditRequest, url));
    }

    const data = await svc.runBulkAudits(userId, userEmail, requests);
    res.json({ success: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Bulk call audit failed. Please try again.';
    console.error('call-audit runBulk error:', msg);
    res.status(422).json({ success: false, message: msg });
  }
}

export async function run(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const userEmail = req.user?.email;
    if (!userId || !userEmail) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const body = req.body as Partial<CallAuditRequest>;
    const error = validateBody(body);
    if (error) { res.status(400).json({ success: false, message: error }); return; }

    const auditReq: CallAuditRequest = {
      recordingUrl: body.recordingUrl!.trim(),
      processName: body.processName!.trim(),
      lob: body.lob!.trim(),
      agentName: body.agentName!.trim(),
      masId: body.masId!.trim(),
      prompt: (body.prompt ?? '').trim(),
    };
    const result = await svc.runCallAudit(userId, userEmail, auditReq);
    res.json({ success: true, data: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Call audit failed. Please try again.';
    console.error('call-audit run error:', msg);
    // These errors are already written to be shown directly to the user (bad URL, transcription
    // failure, AI unavailable, etc.) — not internal details, so passing them through is safe and
    // more useful than a generic 500 message.
    res.status(422).json({ success: false, message: msg });
  }
}

export async function history(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const isSuperAdmin = req.user!.role === 'super_admin';
    const data = await svc.listAudits(userId, isSuperAdmin);
    res.json({ success: true, data });
  } catch (err) {
    console.error('call-audit history error:', err);
    res.status(500).json({ success: false, message: 'Failed to load audit history' });
  }
}

export async function getOne(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const isSuperAdmin = req.user!.role === 'super_admin';
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ success: false, message: 'Invalid audit id' }); return; }
    const data = await svc.getAudit(id, userId, isSuperAdmin);
    if (!data) { res.status(404).json({ success: false, message: 'Audit not found' }); return; }
    res.json({ success: true, data });
  } catch (err) {
    console.error('call-audit getOne error:', err);
    res.status(500).json({ success: false, message: 'Failed to load audit' });
  }
}
