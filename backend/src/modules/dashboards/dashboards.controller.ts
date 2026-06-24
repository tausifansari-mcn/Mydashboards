import { Request, Response } from 'express';
import { z } from 'zod';
import * as svc from './dashboards.service';

const grantSchema = z.object({
  user_id: z.number().int().positive(),
  dashboard_id: z.number().int().positive(),
  can_export: z.boolean().default(false),
});

const revokeSchema = z.object({
  user_id: z.number().int().positive(),
  dashboard_id: z.number().int().positive(),
});

export async function list(_req: Request, res: Response): Promise<void> {
  res.json(await svc.getAllDashboards());
}

export async function myDashboards(req: Request, res: Response): Promise<void> {
  const isSuperAdmin = req.user!.role === 'super_admin';
  res.json(await svc.getMyDashboards(req.user!.id, isSuperAdmin));
}

export async function grant(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, dashboard_id, can_export } = grantSchema.parse(req.body);
    const result = await svc.grantAccess(user_id, dashboard_id, can_export, req.user!.id);
    res.json(result);
  } catch (err: unknown) {
    res.status(400).json({ message: err instanceof Error ? err.message : 'Failed' });
  }
}

export async function revoke(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, dashboard_id } = revokeSchema.parse(req.body);
    await svc.revokeAccess(user_id, dashboard_id);
    res.json({ message: 'Access revoked' });
  } catch {
    res.status(400).json({ message: 'Failed' });
  }
}

export async function userAccess(req: Request, res: Response): Promise<void> {
  res.json(await svc.getUserAccess(Number(req.params.userId)));
}
