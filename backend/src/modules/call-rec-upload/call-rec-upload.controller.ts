import { Request, Response } from 'express';
import * as svc from './call-rec-upload.service';
import { generateBatchId, logUpload, getUploadLogs, deleteUploadBatch } from '../sales/sales.service';

type UploadFn = (buffer: Buffer, uploadedBy: number, batchId: string) => Promise<{ inserted: number; total: number }>;

function makeUploadHandler(tableName: string, fn: UploadFn) {
  return async (req: Request, res: Response) => {
    try {
      if (!req.file) { res.status(400).json({ success: false, message: 'No file uploaded' }); return; }
      const userId = req.user?.id;
      if (!userId) { res.status(401).json({ success: false, message: 'User not authenticated' }); return; }

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

export const uploadHousingOwner = makeUploadHandler('CR_housing_owner', svc.uploadHousingOwner);
export const uploadHousingPremium = makeUploadHandler('CR_housing_premium', svc.uploadHousingPremium);
export const uploadLPFeedback = makeUploadHandler('CR_lp_feedback', svc.uploadLPFeedback);
export const uploadLPRegional = makeUploadHandler('CR_lp_regional', svc.uploadLPRegional);
export const uploadLPNonRegional = makeUploadHandler('CR_lp_non_regional', svc.uploadLPNonRegional);

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
