import { Request, Response } from 'express';
import * as svc from './inbound.service';

// ─── Date helpers ──────────────────────────────────────────────────────────────

function parseDateRange(req: Request): { startDate: string; endDate: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const defaultStart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} 00:00`;
  const defaultEnd   = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} 23:59`;
  return {
    startDate: (req.query.startDate as string) || defaultStart,
    endDate:   (req.query.endDate   as string) || defaultEnd,
  };
}

function todayStr(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// ─── Overall controllers ──────────────────────────────────────────────────────

export async function getSummary(req: Request, res: Response): Promise<void> {
  try {
    const { startDate, endDate } = parseDateRange(req);
    const data = await svc.getProjectSummary({ startDate, endDate });
    res.json({ success: true, data });
  } catch (err) {
    console.error('inbound getSummary error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch inbound summary' });
  }
}

export async function getTrend(req: Request, res: Response): Promise<void> {
  try {
    const { startDate, endDate } = parseDateRange(req);
    const data = await svc.getProjectTrend({ startDate, endDate });
    res.json({ success: true, data });
  } catch (err) {
    console.error('inbound getTrend error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch inbound trend' });
  }
}

export async function getToday(req: Request, res: Response): Promise<void> {
  try {
    const data = await svc.getConsolidatedToday();
    res.json({ success: true, data });
  } catch (err) {
    console.error('inbound getToday error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch today\'s inbound data' });
  }
}

export async function getProjectsMeta(_req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: svc.getProjectsMeta() });
}

export async function getConsolidatedTrend(req: Request, res: Response): Promise<void> {
  try {
    const { startDate, endDate } = parseDateRange(req);
    const data = await svc.getConsolidatedTrend({ startDate, endDate });
    res.json({ success: true, data });
  } catch (err) {
    console.error('inbound getConsolidatedTrend error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch consolidated trend' });
  }
}

// ─── Per-project controllers ──────────────────────────────────────────────────

export async function getProjectDetail(req: Request, res: Response): Promise<void> {
  try {
    const { key } = req.params;
    const { startDate, endDate } = parseDateRange(req);
    const rows = await svc.getProjectSummary({ startDate, endDate }, key);
    if (rows.length === 0) {
      res.status(404).json({ success: false, message: `Project '${key}' not found` });
      return;
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('inbound getProjectDetail error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch project detail' });
  }
}

export async function getProjectHourly(req: Request, res: Response): Promise<void> {
  try {
    const { key } = req.params;
    const date = (req.query.date as string) || todayStr();
    const data = await svc.getProjectHourly(key, date);
    res.json({ success: true, data });
  } catch (err) {
    console.error('inbound getProjectHourly error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch project hourly data' });
  }
}

export async function getProjectTrend(req: Request, res: Response): Promise<void> {
  try {
    const { key } = req.params;
    const { startDate, endDate } = parseDateRange(req);
    const rows = await svc.getProjectTrend({ startDate, endDate }, key);
    if (rows.length === 0) {
      res.status(404).json({ success: false, message: `Project '${key}' not found` });
      return;
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('inbound getProjectTrend error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch project trend' });
  }
}
