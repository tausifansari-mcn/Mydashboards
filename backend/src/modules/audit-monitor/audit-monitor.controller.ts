import { Request, Response } from 'express';
import * as svc from './audit-monitor.service';
import { resolveUserScope } from '../call-master/call-master.service';

const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

/**
 * Defaults to the last 7 days. The window-function scan behind the health query costs roughly a
 * second over 7 days but several over 30, and this page is meant to be refreshed often against a
 * connection pool that is shared with VICIdial — so the cheap window is the default and longer
 * ranges are opt-in.
 */
function parseDateRange(req: Request): { startDate: string; endDate: string } {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  weekAgo.setHours(0, 0, 0, 0);
  return {
    startDate: (req.query.startDate as string) || fmt(weekAgo),
    endDate:   (req.query.endDate   as string) || fmt(now),
  };
}

function clampInt(raw: unknown, def: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

async function buildFilters(req: Request): Promise<svc.MonitorFilters> {
  const { startDate, endDate } = parseDateRange(req);
  const scope = await resolveUserScope(req.user!.id, req.tenantId ?? null);

  let clientIds: number[] | undefined;
  if (req.query.clientId) {
    const requested = Number(req.query.clientId);
    clientIds = scope.clientIds === null || scope.clientIds.includes(requested) ? [requested] : [-1];
  } else if (scope.clientIds !== null) {
    clientIds = scope.clientIds.length ? scope.clientIds : [-1];
  }

  return {
    startDate,
    endDate,
    clientIds,
    blankThreshold: clampInt(req.query.blankThreshold, 5, 1, 500),
    staleHours:     clampInt(req.query.staleHours, 24, 1, 720),
  };
}

// The overview fans out to two full-table window scans, and an auto-refreshing monitoring page
// would otherwise hammer the shared pool. A short TTL keeps it near-live without that cost.
const CACHE_TTL_MS = 90_000;
const cache = new Map<string, { at: number; data: svc.MonitorOverview }>();

export async function getOverview(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    const key = JSON.stringify(filters);
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS && req.query.refresh !== '1') {
      res.json({ success: true, data: hit.data, cached: true });
      return;
    }

    const data = await svc.getOverview(filters);
    cache.set(key, { at: Date.now(), data });
    if (cache.size > 50) cache.delete(cache.keys().next().value as string);

    res.json({ success: true, data, cached: false });
  } catch (err) {
    console.error('audit-monitor getOverview error:', err);
    res.status(500).json({ success: false, message: 'Failed to load audit monitor overview' });
  }
}

export async function getTimeline(req: Request, res: Response) {
  try {
    const data = await svc.getTimeline(await buildFilters(req));
    res.json({ success: true, data });
  } catch (err) {
    console.error('audit-monitor getTimeline error:', err);
    res.status(500).json({ success: false, message: 'Failed to load audit timeline' });
  }
}

export async function getBlankCalls(req: Request, res: Response) {
  try {
    const filters = await buildFilters(req);
    const ddc = Number(req.query.dialdeskClientId);
    const lob = (req.query.lob as string) || 'Inbound';

    if (!Number.isFinite(ddc)) {
      res.status(400).json({ success: false, message: 'dialdeskClientId is required' });
      return;
    }
    // buildFilters already narrowed clientIds to what this user may see; re-check the explicit
    // drilldown target against it so a crafted id cannot read another tenant's calls.
    if (filters.clientIds && !filters.clientIds.includes(ddc)) {
      res.status(403).json({ success: false, message: 'Not permitted for this client' });
      return;
    }

    const data = await svc.getBlankCalls(ddc, lob, filters, clampInt(req.query.limit, 100, 1, 500));
    res.json({ success: true, data });
  } catch (err) {
    console.error('audit-monitor getBlankCalls error:', err);
    res.status(500).json({ success: false, message: 'Failed to load blank calls' });
  }
}
