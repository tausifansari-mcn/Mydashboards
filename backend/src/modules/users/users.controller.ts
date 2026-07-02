import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import * as svc from './users.service';
import { writeAuditLog } from '../../lib/audit';

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role_id: z.number().int().positive(),
  client_id: z.number().int().positive().optional(),
});

export async function list(req: Request, res: Response): Promise<void> {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const search = String(req.query.search || '');
  const roleFilter = req.query.role as string | undefined;
  const clientFilter = req.query.client_id ? Number(req.query.client_id) : undefined;
  res.json(await svc.getAllUsers(page, limit, roleFilter, clientFilter, search));
}

export async function getOne(req: Request, res: Response): Promise<void> {
  const user = await svc.getUserById(Number(req.params.id));
  if (!user) { res.status(404).json({ message: 'User not found' }); return; }
  res.json(user);
}

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const data = createSchema.parse(req.body);
    const user = await svc.createUser(data);
    await writeAuditLog({ userId: req.user!.id, action: 'CREATE_USER', entityType: 'user', entityId: user.id, newValues: { name: data.name, email: data.email } });
    res.status(201).json(user);
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ message: 'A user with this email already exists.' });
      return;
    }
    res.status(400).json({ message: err instanceof Error ? err.message : 'Invalid data' });
  }
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    const user = await svc.updateUser(id, req.body);
    await writeAuditLog({ userId: req.user!.id, action: 'UPDATE_USER', entityType: 'user', entityId: id, newValues: req.body });
    res.json(user);
  } catch {
    res.status(400).json({ message: 'Update failed' });
  }
}

export async function remove(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  await svc.deleteUser(id);
  await writeAuditLog({ userId: req.user!.id, action: 'DELETE_USER', entityType: 'user', entityId: id });
  res.json({ message: 'User deactivated' });
}

export async function permanentDelete(req: Request, res: Response): Promise<void> {
  try {
    await svc.permanentDeleteUser(Number(req.params.id));
    res.json({ message: 'User permanently deleted' });
  } catch {
    res.status(400).json({ message: 'Failed to delete user' });
  }
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  await svc.adminResetPassword(Number(req.params.id));
  res.json({ message: 'Temporary password sent to user email' });
}
