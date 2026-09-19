import { Request, Response } from 'express';
import { z } from 'zod';
import * as svc from './task-scheduler.service';

const pageSchema = z.object({
  module:       z.enum(['inbound', 'ai_quality_inbound', 'ai_quality_outbound', 'sales']),
  target_key:   z.string().min(1),
  target_label: z.string().min(1),
  // Only meaningful for module === 'ai_quality_inbound'; picks which CSV shape to attach.
  report_type:  z.enum(['raw', 'agent_wise', 'date_wise', 'week_wise']).optional(),
});

const taskBase = z.object({
  name:          z.string().min(1).max(150),
  task_type:     z.enum(['report', 'scam_alert']).optional(),
  pages:         z.array(pageSchema).min(1),
  // A scam alert has no schedule of its own — it watches continuously — so these are only
  // required for a report. The form still sends its defaults; they are simply ignored.
  frequency:     z.enum(['daily', 'weekly', 'monthly', 'realtime']),
  time_of_day:   z.string().regex(/^\d{2}:\d{2}$/),
  day_of_week:   z.number().int().min(0).max(6).nullable().optional(),
  day_of_month:  z.number().int().min(1).max(31).nullable().optional(),
  period:        z.enum(['today', 'yesterday', 'current_month']).nullable().optional(),
  recipients:    z.string().min(3),
  is_active:     z.boolean().optional(),
});

// Scam alerts are Inbound-only and watch exactly one process, so the mail can carry that
// process's name and the watermark can be a single client's row ids. Applied to create and to
// patch separately, because .refine() returns a ZodEffects that has no .partial().
const inboundOnlyForAlerts = (t: { task_type?: string; pages?: { module: string }[] }): boolean =>
  t.task_type !== 'scam_alert' || (t.pages?.length === 1 && t.pages[0].module === 'ai_quality_inbound');
const ALERT_TARGET_MSG = { message: 'A Potential Scam alert must watch exactly one AI Quality — Inbound process' };

const taskSchema = taskBase.refine(inboundOnlyForAlerts, ALERT_TARGET_MSG);
const taskPatchSchema = taskBase.partial().refine(inboundOnlyForAlerts, ALERT_TARGET_MSG);

export async function getTargets(req: Request, res: Response): Promise<void> {
  try {
    const moduleName = String(req.query.module ?? '');
    const targets = await svc.getTargets(moduleName);
    res.json({ data: targets });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Failed to load targets' });
  }
}

export async function list(_req: Request, res: Response): Promise<void> {
  res.json({ data: await svc.listTasks() });
}

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const input = taskSchema.parse(req.body);
    const task = await svc.createTask(input, req.user!.id);
    res.status(201).json({ data: task });
  } catch (err: unknown) {
    res.status(400).json({ message: err instanceof Error ? err.message : 'Failed to create task' });
  }
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    const input = taskPatchSchema.parse(req.body);
    const task = await svc.updateTask(Number(req.params.id), input);
    res.json({ data: task });
  } catch (err: unknown) {
    res.status(400).json({ message: err instanceof Error ? err.message : 'Failed to update task' });
  }
}

export async function remove(req: Request, res: Response): Promise<void> {
  try {
    await svc.deleteTask(Number(req.params.id));
    res.json({ message: 'Task deleted' });
  } catch (err: unknown) {
    res.status(400).json({ message: err instanceof Error ? err.message : 'Failed to delete task' });
  }
}

export async function runNow(req: Request, res: Response): Promise<void> {
  try {
    await svc.runTaskNow(Number(req.params.id));
    res.json({ message: 'Task executed' });
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Task run failed' });
  }
}
