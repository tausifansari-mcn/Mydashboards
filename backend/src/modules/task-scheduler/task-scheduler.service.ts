import type { Response } from 'express';
import type { md_scheduled_tasks, Prisma } from '@prisma/client';
import prisma from '../../lib/prismaClient';
import { csvEscape } from '../../lib/csv';
import { sendReportEmail } from '../../lib/mailer';
import { streamProjectRawCsv } from '../inbound/inbound.service';
import { streamInboundExportCsv, getInboundClients } from '../inbound-quality/inbound-quality.service';
import { streamOutboundExportCsv, getClients as getOutboundClients } from '../quality/quality.service';
import { getSalesExport } from '../sales/sales.service';
import { buildPageKpiHtml } from './kpi-email-templates';

// ─── Static / near-static target lists per module ─────────────────────────────

const INBOUND_PROJECTS = [
  { key: 'gnc',          label: 'GNC' },
  { key: 'bellavita',    label: 'Bellavita' },
  { key: 'clovia',       label: 'Clovia' },
  { key: 'neemans',      label: 'Neemans' },
  { key: 'viega',        label: 'Viega' },
  { key: 'exicom',       label: 'Exicom' },
  { key: 'dubangladesh', label: 'DU Bangladesh' },
];

// Sales brands need a numeric ClientId (for getSalesExport) alongside the picker key.
const SALES_BRANDS = [
  { key: 'bellavita', label: 'Bellavita', clientId: 375 },
  { key: 'gnc',       label: 'GNC',       clientId: 409 },
  { key: 'neemans',   label: "Neeman's",  clientId: 475 },
];

export interface TargetOption { key: string; label: string; }
export interface TaskPage { module: string; target_key: string; target_label: string; }

function pad(n: number): string { return String(n).padStart(2, '0'); }
function fmtDate(d: Date): string { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

// A 90-day lookback is plenty to populate "who has data" pickers without scanning everything.
function last90Days(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 90);
  return { startDate: fmtDate(start), endDate: fmtDate(end) };
}

export async function getTargets(moduleName: string): Promise<TargetOption[]> {
  const { startDate, endDate } = last90Days();
  switch (moduleName) {
    case 'inbound':
      return INBOUND_PROJECTS;
    case 'ai_quality_inbound': {
      const clients = await getInboundClients({ startDate, endDate });
      return clients.map(c => ({ key: c.client_id, label: c.client_name }));
    }
    case 'ai_quality_outbound': {
      const clients = await getOutboundClients({ startDate, endDate });
      return clients.map(c => ({ key: String(c.client_id), label: c.client_name }));
    }
    case 'sales':
      return SALES_BRANDS.map(b => ({ key: b.key, label: b.label }));
    default:
      return [];
  }
}

// ─── In-memory stand-in for Express's Response ─────────────────────────────────
// Lets the existing streaming CSV export functions (built for live HTTP responses) run unchanged
// here — .setHeader()/.write()/.end() just accumulate into a Buffer instead of hitting the wire.
class BufferResponse {
  private chunks: Buffer[] = [];
  setHeader(): void { /* no-op */ }
  write(chunk: string | Buffer): boolean {
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return true;
  }
  end(): void { /* no-op */ }
  getBuffer(): Buffer { return Buffer.concat(this.chunks); }
}

function rowsToCsvBuffer(rows: Record<string, unknown>[]): Buffer {
  if (rows.length === 0) {
    return Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from('No data for this period\n', 'utf-8')]);
  }
  const cols = Object.keys(rows[0]);
  const lines = [cols.join(',')];
  for (const r of rows) lines.push(cols.map(c => csvEscape(r[c])).join(','));
  return Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(lines.join('\n'), 'utf-8')]);
}

// ─── Date-range convention ─────────────────────────────────────────────────────
// The report window is chosen explicitly at schedule time (Today / Yesterday /
// Current Month) and stored on the task. Tasks created before this option existed
// have period = NULL and fall back to the legacy frequency-derived window
// (daily → previous day, weekly → trailing 7 days ending yesterday, monthly →
// previous full calendar month). Keeps every report window unambiguous.
function fmtDisplay(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function computeDateRange(period: string | null, frequency: string): { startDate: string; endDate: string; rangeLabel: string } {
  const now = new Date();
  const from = (d: Date) => `${fmtDate(d)} 00:00:00`;
  const thru = (d: Date) => `${fmtDate(d)} 23:59:59`;

  if (period === 'today') {
    return { startDate: from(now), endDate: thru(now), rangeLabel: `Today · ${fmtDisplay(now)}` };
  }
  if (period === 'yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { startDate: from(y), endDate: thru(y), rangeLabel: `Yesterday · ${fmtDisplay(y)}` };
  }
  if (period === 'current_month') {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      startDate: from(first), endDate: thru(now),
      rangeLabel: `Current Month · ${fmtDisplay(first)} – ${fmtDisplay(now)}`,
    };
  }

  // legacy frequency-based window
  if (frequency === 'daily') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const s = fmtDate(y);
    return { startDate: `${s} 00:00:00`, endDate: `${s} 23:59:59`, rangeLabel: s };
  }
  if (frequency === 'weekly') {
    const end = new Date(now);
    end.setDate(end.getDate() - 1);
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return { startDate: `${fmtDate(start)} 00:00:00`, endDate: `${fmtDate(end)} 23:59:59`, rangeLabel: `${fmtDate(start)} to ${fmtDate(end)}` };
  }
  // monthly
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfPrevMonth = new Date(firstOfThisMonth.getTime() - 1);
  const firstOfPrevMonth = new Date(lastOfPrevMonth.getFullYear(), lastOfPrevMonth.getMonth(), 1);
  return {
    startDate: `${fmtDate(firstOfPrevMonth)} 00:00:00`,
    endDate: `${fmtDate(lastOfPrevMonth)} 23:59:59`,
    rangeLabel: `${fmtDate(firstOfPrevMonth)} to ${fmtDate(lastOfPrevMonth)}`,
  };
}

// ─── Next-run computation ──────────────────────────────────────────────────────
export function computeNextRun(
  frequency: string, timeOfDay: string,
  dayOfWeek: number | null, dayOfMonth: number | null,
  from: Date = new Date(),
): Date {
  const [hh, mm] = timeOfDay.split(':').map(Number);

  if (frequency === 'daily') {
    const next = new Date(from);
    next.setHours(hh, mm, 0, 0);
    if (next <= from) next.setDate(next.getDate() + 1);
    return next;
  }

  if (frequency === 'weekly') {
    const targetDow = dayOfWeek ?? 0;
    const next = new Date(from);
    next.setHours(hh, mm, 0, 0);
    while (next.getDay() !== targetDow || next <= from) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  }

  // monthly — clamp the target day to however many days the candidate month actually has
  const targetDom = dayOfMonth ?? 1;
  const monthCandidate = (monthOffset: number): Date => {
    const year = from.getFullYear();
    const month = from.getMonth() + monthOffset;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const day = Math.min(targetDom, daysInMonth);
    return new Date(year, month, day, hh, mm, 0, 0);
  };
  let candidate = monthCandidate(0);
  if (candidate <= from) candidate = monthCandidate(1);
  return candidate;
}

// ─── Build one page's CSV attachment (raw row-level export, same as its manual button) ──
async function buildPageCsv(
  page: TaskPage, startDate: string, endDate: string, safeRange: string,
): Promise<{ filename: string; content: Buffer }> {
  const safeLabel = page.target_label.replace(/\s+/g, '_');

  if (page.module === 'inbound') {
    const res = new BufferResponse();
    const found = await streamProjectRawCsv(res as unknown as Response, page.target_key, startDate, endDate);
    if (!found) throw new Error(`Inbound project '${page.target_key}' not found`);
    return { filename: `${safeLabel}_inbound_${safeRange}.csv`, content: res.getBuffer() };
  }
  if (page.module === 'ai_quality_inbound') {
    const res = new BufferResponse();
    await streamInboundExportCsv(res as unknown as Response, startDate, endDate, [Number(page.target_key)]);
    return { filename: `${safeLabel}_ai_quality_inbound_${safeRange}.csv`, content: res.getBuffer() };
  }
  if (page.module === 'ai_quality_outbound') {
    const res = new BufferResponse();
    await streamOutboundExportCsv(res as unknown as Response, startDate, endDate, [Number(page.target_key)]);
    return { filename: `${safeLabel}_ai_quality_outbound_${safeRange}.csv`, content: res.getBuffer() };
  }
  if (page.module === 'sales') {
    const brand = SALES_BRANDS.find(b => b.key === page.target_key);
    if (!brand) throw new Error(`Unknown sales brand '${page.target_key}'`);
    const rows = await getSalesExport({ startDate, endDate, clientIds: [brand.clientId] }, 50000);
    return { filename: `${safeLabel}_sales_${safeRange}.csv`, content: rowsToCsvBuffer(rows) };
  }
  throw new Error(`Unknown module '${page.module}'`);
}

function parsePages(raw: Prisma.JsonValue): TaskPage[] {
  if (!Array.isArray(raw)) return [];
  return raw as unknown as TaskPage[];
}

// ─── Run a single task: build every selected page's CSV + KPI summary, email them together ──
export async function runTask(task: md_scheduled_tasks): Promise<void> {
  const pages = parsePages(task.pages);
  if (pages.length === 0) throw new Error('Task has no pages configured');

  const { startDate, endDate, rangeLabel } = computeDateRange(task.period ?? null, task.frequency);
  const safeRange = rangeLabel.replace(/\s+/g, '_');

  const attachments: { filename: string; content: Buffer }[] = [];
  const htmlSections: string[] = [];

  for (const page of pages) {
    attachments.push(await buildPageCsv(page, startDate, endDate, safeRange));
    const html = await buildPageKpiHtml(page, startDate, endDate);
    if (html) htmlSections.push(html);
  }

  const recipients = task.recipients.split(',').map(s => s.trim()).filter(Boolean);
  if (recipients.length === 0) throw new Error('No recipients configured');

  await sendReportEmail(recipients, task.name, rangeLabel, htmlSections.join(''), attachments);
}

// ─── CRUD ───────────────────────────────────────────────────────────────────────

export interface TaskInput {
  name:         string;
  pages:        TaskPage[];
  frequency:    string;
  time_of_day:  string;
  day_of_week?:  number | null;
  day_of_month?: number | null;
  period?:       string | null; // 'today' | 'yesterday' | 'current_month'; null/undefined = legacy frequency window
  recipients:   string;
  is_active?:   boolean;
}

export async function listTasks() {
  return prisma.md_scheduled_tasks.findMany({ orderBy: { id: 'desc' } });
}

export async function createTask(input: TaskInput, createdBy: number) {
  const dayOfWeek = input.day_of_week ?? null;
  const dayOfMonth = input.day_of_month ?? null;
  const next_run_at = computeNextRun(input.frequency, input.time_of_day, dayOfWeek, dayOfMonth);
  return prisma.md_scheduled_tasks.create({
    data: {
      name: input.name, pages: input.pages as unknown as Prisma.InputJsonValue,
      frequency: input.frequency, time_of_day: input.time_of_day, day_of_week: dayOfWeek, day_of_month: dayOfMonth,
      period: input.period ?? null,
      recipients: input.recipients, is_active: input.is_active ?? true, created_by: createdBy, next_run_at,
    },
  });
}

export async function updateTask(id: number, input: Partial<TaskInput>) {
  const existing = await prisma.md_scheduled_tasks.findUniqueOrThrow({ where: { id } });
  const frequency = input.frequency ?? existing.frequency;
  const timeOfDay = input.time_of_day ?? existing.time_of_day;
  const dayOfWeek = input.day_of_week !== undefined ? input.day_of_week : existing.day_of_week;
  const dayOfMonth = input.day_of_month !== undefined ? input.day_of_month : existing.day_of_month;
  const next_run_at = computeNextRun(frequency, timeOfDay, dayOfWeek, dayOfMonth);
  return prisma.md_scheduled_tasks.update({
    where: { id },
    data: {
      ...input,
      pages: input.pages ? (input.pages as unknown as Prisma.InputJsonValue) : undefined,
      period: input.period !== undefined ? input.period : undefined,
      next_run_at,
    },
  });
}

export async function deleteTask(id: number) {
  return prisma.md_scheduled_tasks.delete({ where: { id } });
}

export async function runTaskNow(id: number): Promise<void> {
  const task = await prisma.md_scheduled_tasks.findUniqueOrThrow({ where: { id } });
  try {
    await runTask(task);
    await prisma.md_scheduled_tasks.update({
      where: { id }, data: { last_run_at: new Date(), last_run_status: 'success', last_run_message: null },
    });
  } catch (err) {
    await prisma.md_scheduled_tasks.update({
      where: { id },
      data: { last_run_at: new Date(), last_run_status: 'failed', last_run_message: err instanceof Error ? err.message : 'Unknown error' },
    });
    throw err;
  }
}

// ─── Background job — runs every minute, executes anything due ────────────────
export async function checkAndRunDueTasks(): Promise<void> {
  const due = await prisma.md_scheduled_tasks.findMany({
    where: { is_active: true, next_run_at: { lte: new Date() } },
  });
  for (const task of due) {
    const next_run_at = computeNextRun(task.frequency, task.time_of_day, task.day_of_week, task.day_of_month);
    try {
      await runTask(task);
      await prisma.md_scheduled_tasks.update({
        where: { id: task.id },
        data: { last_run_at: new Date(), last_run_status: 'success', last_run_message: null, next_run_at },
      });
    } catch (err) {
      await prisma.md_scheduled_tasks.update({
        where: { id: task.id },
        data: { last_run_at: new Date(), last_run_status: 'failed', last_run_message: err instanceof Error ? err.message : 'Unknown error', next_run_at },
      });
    }
  }
}

export function startTaskSchedulerJob(): void {
  const timer = setInterval(() => { checkAndRunDueTasks().catch(() => {}); }, 60_000);
  if (typeof timer.unref === 'function') timer.unref();
}
