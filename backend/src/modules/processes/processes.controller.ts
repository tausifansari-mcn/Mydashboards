import { Request, Response } from 'express';
import { z } from 'zod';
import * as svc from './processes.service';
import { writeAuditLog } from '../../lib/audit';

const createSchema = z.object({
  client_id: z.number().int().positive(),
  process_name: z.string().min(1),
  lob: z.enum(['Inbound', 'Outbound', 'IB/OB']),
  dialdesk_client_id: z.number().int().positive(),
});

const assignSchema = z.object({ user_id: z.number(), process_id: z.number() });

export async function list(req: Request, res: Response): Promise<void> {
  const clientId = req.query.client_id ? Number(req.query.client_id) : undefined;
  res.json(await svc.getAllProcesses(clientId));
}

export async function getOne(req: Request, res: Response): Promise<void> {
  const p = await svc.getProcessById(Number(req.params.id));
  if (!p) { res.status(404).json({ message: 'Process not found' }); return; }
  res.json(p);
}

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const data = createSchema.parse(req.body);
    const p = await svc.createProcess(data);
    await writeAuditLog({ userId: req.user!.id, action: 'CREATE_PROCESS', entityType: 'process', entityId: p.id, newValues: data });
    res.status(201).json(p);
  } catch (err: unknown) {
    res.status(400).json({ message: err instanceof Error ? err.message : 'Invalid data' });
  }
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    const p = await svc.updateProcess(id, req.body);
    await writeAuditLog({ userId: req.user!.id, action: 'UPDATE_PROCESS', entityType: 'process', entityId: id, newValues: req.body });
    res.json(p);
  } catch {
    res.status(400).json({ message: 'Update failed' });
  }
}

export async function remove(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  await svc.deleteProcess(id);
  await writeAuditLog({ userId: req.user!.id, action: 'DELETE_PROCESS', entityType: 'process', entityId: id });
  res.json({ message: 'Process deactivated' });
}

export async function assignUser(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, process_id } = assignSchema.parse(req.body);
    await svc.assignUserToProcess(user_id, process_id);
    await writeAuditLog({ userId: req.user!.id, action: 'ASSIGN_PROCESS', entityType: 'user', entityId: user_id, newValues: { process_id } });
    res.json({ message: 'Process assigned' });
  } catch {
    res.status(400).json({ message: 'Assignment failed' });
  }
}

export async function unassignUser(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, process_id } = assignSchema.parse(req.body);
    await svc.unassignUserFromProcess(user_id, process_id);
    res.json({ message: 'Process unassigned' });
  } catch {
    res.status(400).json({ message: 'Unassignment failed' });
  }
}

export async function getUserProcesses(req: Request, res: Response): Promise<void> {
  const userId = Number(req.params.userId);
  res.json(await svc.getUserProcesses(userId));
}

export async function myProcesses(req: Request, res: Response): Promise<void> {
  const isSuperAdmin = req.user!.role === 'super_admin';
  if (isSuperAdmin) {
    res.json(await svc.getAllProcesses());
    return;
  }
  const mapped = await svc.getUserProcesses(req.user!.id);
  res.json(mapped.map((m) => m.process));
}
