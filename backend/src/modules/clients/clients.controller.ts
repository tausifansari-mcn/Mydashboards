import { Request, Response } from 'express';
import { z } from 'zod';
import * as svc from './clients.service';
import { writeAuditLog } from '../../lib/audit';

const createSchema = z.object({
  name: z.string().min(1),
  dialdesk_client_id: z.number().int().positive(),
  logo_url: z.string().url().optional(),
});

export async function list(req: Request, res: Response): Promise<void> {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const search = String(req.query.search || '');
  res.json(await svc.getAllClients(page, limit, search));
}

export async function getOne(req: Request, res: Response): Promise<void> {
  const client = await svc.getClientById(Number(req.params.id));
  if (!client) { res.status(404).json({ message: 'Client not found' }); return; }
  res.json(client);
}

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const data = createSchema.parse(req.body);
    const client = await svc.createClient(data);
    await writeAuditLog({ userId: req.user!.id, action: 'CREATE_CLIENT', entityType: 'client', entityId: client.id, newValues: data });
    res.status(201).json(client);
  } catch (err: unknown) {
    res.status(400).json({ message: err instanceof Error ? err.message : 'Invalid data' });
  }
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    const old = await svc.getClientById(id);
    const client = await svc.updateClient(id, req.body);
    await writeAuditLog({ userId: req.user!.id, action: 'UPDATE_CLIENT', entityType: 'client', entityId: id, oldValues: old!, newValues: req.body });
    res.json(client);
  } catch {
    res.status(400).json({ message: 'Update failed' });
  }
}

export async function remove(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  await svc.deleteClient(id);
  await writeAuditLog({ userId: req.user!.id, action: 'DELETE_CLIENT', entityType: 'client', entityId: id });
  res.json({ message: 'Client deactivated' });
}
