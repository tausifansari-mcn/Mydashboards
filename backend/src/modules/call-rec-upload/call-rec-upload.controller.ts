import { Request, Response } from 'express';
import * as svc from './call-rec-upload.service';
import type { CallRecProcessKey } from './call-rec-upload.service';
import { generateBatchId, logUpload, getUploadLogs, deleteUploadBatch } from '../sales/sales.service';

type UploadFn = (buffer: Buffer, uploadedBy: number, batchId: string) => Promise<{ inserted: number; total: number }>;

function makeUploadHandler(tableName: string, processKey: CallRecProcessKey, fn: UploadFn) {
  return async (req: Request, res: Response) => {
    try {
      if (!req.file) { res.status(400).json({ success: false, message: 'No file uploaded' }); return; }
      const userId = req.user?.id;
      if (!userId) { res.status(401).json({ success: false, message: 'User not authenticated' }); return; }

      // Checked here (not in the route middleware) so it runs after the "is there even a file"
      // check above but before the potentially-large file gets parsed — no point spending that
      // time on a request that's going to be rejected anyway.
      const quota = await svc.checkCallRecUploadQuota(processKey, req.user?.role === 'super_admin');
      if (!quota.ok) { res.status(429).json({ success: false, message: quota.message }); return; }

      const batchId = generateBatchId();
      const { inserted, total } = await fn(req.file.buffer, userId, batchId);
      await logUpload(batchId, tableName, req.file.originalname, inserted, userId);
      res.json({ success: true, data: { rowsInserted: inserted, totalRows: total, batchId } });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`call-rec upload (${tableName}) error:`, msg);
      res.status(500).json({ success: false, message: `Upload failed: ${msg}` });
    }
  };
}

export const uploadHousingOwner = makeUploadHandler('CR_housing_owner', 'housingOwner', svc.uploadHousingOwner);
export const uploadHousingPremium = makeUploadHandler('CR_housing_premium', 'housingPremium', svc.uploadHousingPremium);
export const uploadLPFeedback = makeUploadHandler('CR_lp_feedback', 'lpFeedback', svc.uploadLPFeedback);
export const uploadLPRegional = makeUploadHandler('CR_lp_regional', 'lpRegional', svc.uploadLPRegional);
export const uploadLPNonRegional = makeUploadHandler('CR_lp_non_regional', 'lpNonRegional', svc.uploadLPNonRegional);

export async function getUploadLimits(req: Request, res: Response) {
  try {
    const data = await svc.getCallRecUploadLimits();
    res.json({ success: true, data });
  } catch (err) {
    console.error('call-rec getUploadLimits error:', err);
    res.status(500).json({ success: false, message: 'Failed to load upload limits' });
  }
}

export async function setUploadLimit(req: Request, res: Response) {
  try {
    const processKey = req.params.processKey as CallRecProcessKey;
    if (!svc.CALL_REC_PROCESS_KEYS.includes(processKey)) { res.status(400).json({ success: false, message: 'Unknown process' }); return; }
    const body = req.body as { maxRowsPerDay?: number | null };
    const maxRowsPerDay = body.maxRowsPerDay === null || body.maxRowsPerDay === undefined || (body.maxRowsPerDay as unknown) === ''
      ? null
      : Number(body.maxRowsPerDay);
    if (maxRowsPerDay !== null && (!Number.isFinite(maxRowsPerDay) || maxRowsPerDay < 0 || !Number.isInteger(maxRowsPerDay))) {
      res.status(400).json({ success: false, message: 'maxRowsPerDay must be a whole number ≥ 0, or blank for unlimited' });
      return;
    }
    const updatedByName = req.user?.email ?? 'Unknown';
    await svc.setCallRecUploadLimit(processKey, maxRowsPerDay, updatedByName);
    const data = await svc.getCallRecUploadLimits();
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err instanceof Error ? err.message : 'Failed to update upload limit' });
  }
}

// Lets the upload page show only the process cards this user can actually use — super_admin sees
// all five (same bypass as the enforcement middleware), everyone else sees exactly what's granted.
export async function getMyProcesses(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }
    const processes = req.user?.role === 'super_admin'
      ? [...svc.CALL_REC_PROCESS_KEYS]
      : await svc.getUserCallRecProcessAccess(userId);
    res.json({ success: true, data: processes });
  } catch (err) {
    console.error('call-rec getMyProcesses error:', err);
    res.status(500).json({ success: false, message: 'Failed to load process access' });
  }
}

export async function getCallRecUploadLogs(req: Request, res: Response) {
  try {
    const tableName = req.query.table as string | undefined;
    const logs = await getUploadLogs(tableName);
    res.json({ success: true, data: logs });
  } catch (err) {
    console.error('call-rec getUploadLogs error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch upload logs' });
  }
}

export async function deleteCallRecUploadLog(req: Request, res: Response) {
  try {
    const { batchId } = req.params;
    const tableName = req.query.table as string;
    if (!tableName) { res.status(400).json({ success: false, message: 'table query param required' }); return; }
    const result = await deleteUploadBatch(batchId, tableName);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('call-rec deleteUploadLog error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete upload' });
  }
}
