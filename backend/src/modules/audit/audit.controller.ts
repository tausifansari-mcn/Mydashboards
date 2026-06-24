import { Request, Response } from 'express';
import * as svc from './audit.service';

export async function auditLogs(req: Request, res: Response): Promise<void> {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 50;
  const userId = req.query.user_id ? Number(req.query.user_id) : undefined;
  const action = req.query.action as string | undefined;
  res.json(await svc.getAuditLogs(page, limit, userId, action));
}

export async function loginHistory(req: Request, res: Response): Promise<void> {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 50;
  const userId = req.query.user_id ? Number(req.query.user_id) : undefined;
  const status = req.query.status as string | undefined;
  res.json(await svc.getLoginHistory(page, limit, userId, status));
}
