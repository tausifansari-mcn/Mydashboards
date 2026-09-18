import { useEffect, useState, useCallback, useMemo, useRef, Fragment } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, CircleSlash, Clock, Loader2,
  RefreshCw, ChevronDown, FileX, ShieldAlert, Radio, Gauge, SlidersHorizontal,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import api from '@/lib/axios';

/* ───────────────────────── palette ─────────────────────────
   Two families, deliberately separate.

   Chart series — blue / yellow / red, validated as a set against the white card
   surface: worst CVD pair ΔE 15.3 (target ≥8), worst normal-vision pair ΔE 20.8
   (floor ≥15). The obvious green-for-good, red-for-bad pairing was measured first
   and rejected — it collapses to ΔE 4.1 under deuteranopia, which is exactly the
   distinction this page exists to make. Yellow sits under 3:1 on white, so the
   legend labels and the process table below are its required relief.

   Status — the reserved status palette, never reused as a series colour. Every
   status ships as dot + icon + word, so hue never carries the meaning alone. */
const SERIES = {
  scored:       '#2a78d6',  // graded successfully
  noTranscript: '#eda100',  // stage 1 failed — nothing to grade
  blank:        '#e34948',  // stage 2 failed — text present, no scores
} as const;

const INK = {
  primary: '#0b0b0b',
  secondary: '#52514e',
  muted: '#898781',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
} as const;

type AuditHealth = 'healthy' | 'degraded' | 'not_auditing' | 'stalled' | 'no_data';

const STATUS: Record<AuditHealth, {
  label: string; color: string; tint: string; text: string; icon: React.ElementType; blurb: string;
}> = {
  not_auditing: { label: 'Not Auditing', color: '#d03b3b', tint: '#FEF2F2', text: '#9B1C1C', icon: ShieldAlert,  blurb: 'Calls arrive but nothing is being graded' },
  stalled:      { label: 'Stalled',      color: '#ec835a', tint: '#FFF7ED', text: '#9A3412', icon: Clock,        blurb: 'No new audited call for a while' },
  no_data:      { label: 'No Data',      color: '#898781', tint: '#F8FAFC', text: '#475569', icon: CircleSlash,   blurb: 'Nothing landed in this window at all' },
  degraded:     { label: 'Degraded',     color: '#fab219', tint: '#FEFCE8', text: '#854D0E', icon: AlertTriangle, blurb: 'Auditing runs, but is dropping calls' },
  healthy:      { label: 'Healthy',      color: '#0ca30c', tint: '#F0FDF4', text: '#166534', icon: CheckCircle2,  blurb: 'Transcription and grading keeping up' },
};

const STATUS_ORDER: AuditHealth[] = ['not_auditing', 'stalled', 'no_data', 'degraded', 'healthy'];

/* ───────────────────────── types ───────────────────────── */

interface ProcessAuditHealth {
  processId: number;
  processName: string;
  clientName: string;
  dialdeskClientId: number;
  lob: string;
  status: AuditHealth;
  reason: string;
  total: number;
  transcribed: number;
  noTranscript: number;
  scoredOk: number;
  scoredBlank: number;
  blankStreak: number;
  blankRate: number;
  transcriptGapRate: number;
  coverage: number;
  lastCall: string | null;
  hoursSinceLastCall: number | null;
}

interface Overview {
  generatedAt: string;
  thresholds: { blankThreshold: number; staleHours: number };
  summary: {
    totalProcesses: number; healthy: number; degraded: number;
    notAuditing: number; stalled: number; noData: number;
    totalCalls: number; totalScored: number; totalBlank: number;
    totalNoTranscript: number; coverage: number;
  };
  processes: ProcessAuditHealth[];
}

interface TimelinePoint {
  date: string; total: number; scored: number;
  blank: number; noTranscript: number; coverage: number;
}

interface BlankCall {
  callDate: string; agent: string | null; mobile: string | null;
  leadId: string | null; durationSec: number | null;
  hasTranscript: boolean; stage: 'transcription' | 'scoring';
}

/* ───────────────────────── helpers ───────────────────────── */

const pad = (n: number) => String(n).padStart(2, '0');
const toLocalDT = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toApiDT = (v: string) => v.replace('T', ' ');
const nf = new Intl.NumberFormat('en-IN');

function relTime(hours: number | null): string {
  if (hours === null) return '—';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m ago`;
  if (hours < 48) return `${Math.round(hours)}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

/* ───────────────────────── small pieces ───────────────────────── */

function StatusPill({ status, size = 'md' }: { status: AuditHealth; size?: 'sm' | 'md' }) {
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap ${
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
      }`}
      style={{ backgroundColor: s.tint, color: s.text, border: `1px solid ${s.color}33` }}
    >
      <Icon size={size === 'sm' ? 11 : 12} style={{ color: s.color }} />
      {s.label}
    </span>
  );
}

/** Clickable summary tile — doubles as the status filter for the table below. */
function StatusTile({
  status, count, active, onClick,
}: { status: AuditHealth; count: number; active: boolean; onClick: () => void }) {
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="group relative flex flex-col gap-1 rounded-xl border p-3 text-left transition-all duration-150 hover:shadow-md"
      style={{
        backgroundColor: active ? s.tint : '#fff',
        borderColor: active ? s.color : '#E2E8F0',
        boxShadow: active ? `0 0 0 1px ${s.color}` : undefined,
      }}
    >
      <span className="flex items-center gap-1.5">
        <Icon size={13} style={{ color: s.color }} />
        <span className="text-[11px] font-semibold" style={{ color: INK.secondary }}>{s.label}</span>
      </span>
      <span className="text-2xl font-bold leading-none" style={{ color: count > 0 ? s.color : INK.muted }}>
        {count}
      </span>
      <span className="text-[10px] leading-tight" style={{ color: INK.muted }}>{s.blurb}</span>
    </button>
  );
}

/** Two-stage funnel bar: how many calls survived transcription, then grading. */
function StageBar({ p }: { p: ProcessAuditHealth }) {
  if (p.total === 0) {
    return <div className="h-2 w-full rounded-full" style={{ backgroundColor: '#F1F5F9' }} />;
  }
  const seg = (n: number) => `${(n / p.total) * 100}%`;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: '#F1F5F9' }}>
      {/* 2px surface gaps keep adjacent fills from reading as one mark */}
      <div style={{ width: seg(p.scoredOk),      backgroundColor: SERIES.scored }} />
      <div style={{ width: seg(p.scoredBlank),   backgroundColor: SERIES.blank,        marginLeft: p.scoredOk ? 2 : 0 }} />
      <div style={{ width: seg(p.noTranscript),  backgroundColor: SERIES.noTranscript, marginLeft: p.scoredBlank ? 2 : 0 }} />
    </div>
  );
}

interface TipEntry { name: string; value: number; color: string }
function ChartTooltip({ active, payload, label, suffix }: {
  active?: boolean; payload?: TipEntry[]; label?: string; suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-white px-3 py-2 shadow-lg" style={{ borderColor: INK.grid }}>
      <div className="mb-1 text-[11px] font-semibold" style={{ color: INK.primary }}>
        {label ? shortDate(label) : ''}
      </div>
      {payload.map((e) => (
        <div key={e.name} className="flex items-center gap-2 text-[11px]" style={{ color: INK.secondary }}>
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: e.color }} />
          <span>{e.name}</span>
          <span className="ml-auto font-semibold tabular-nums" style={{ color: INK.primary }}>
            {nf.format(e.value)}{suffix ?? ''}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────── page ───────────────────────── */

export default function AuditMonitorPage() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 864e5);
  weekAgo.setHours(0, 0, 0, 0);

  const [startDate, setStartDate] = useState(toLocalDT(weekAgo));
  const [endDate, setEndDate]     = useState(toLocalDT(now));
  const [blankThreshold, setBlankThreshold] = useState(5);
  const [staleHours, setStaleHours]         = useState(24);
  const [showSettings, setShowSettings]     = useState(false);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const [statusFilter, setStatusFilter] = useState<AuditHealth | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [blankCalls, setBlankCalls] = useState<Record<number, BlankCall[]>>({});
  const [loadingCalls, setLoadingCalls] = useState<number | null>(null);

  const params = useMemo(() => ({
    startDate: toApiDT(startDate),
    endDate: toApiDT(endDate),
    blankThreshold,
    staleHours,
  }), [startDate, endDate, blankThreshold, staleHours]);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const [ov, tl] = await Promise.all([
        api.get('/audit-monitor/overview', { params: force ? { ...params, refresh: 1 } : params }),
        api.get('/audit-monitor/timeline', { params }),
      ]);
      setOverview(ov.data.data);
      setTimeline(tl.data.data);
    } catch {
      setError('Could not load the audit monitor. The source database may be busy — try again.');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { void load(); }, [load]);

  // Keep the polling timer out of the render path so changing filters doesn't restart it.
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => void loadRef.current(true), 120_000);
    return () => clearInterval(t);
  }, [autoRefresh]);

  const toggleRow = async (p: ProcessAuditHealth) => {
    if (expanded === p.processId) { setExpanded(null); return; }
    setExpanded(p.processId);
    if (blankCalls[p.processId] || p.scoredBlank + p.noTranscript === 0) return;
    setLoadingCalls(p.processId);
    try {
      const { data } = await api.get('/audit-monitor/blank-calls', {
        params: { ...params, dialdeskClientId: p.dialdeskClientId, lob: p.lob, limit: 60 },
      });
      setBlankCalls((prev) => ({ ...prev, [p.processId]: data.data }));
    } catch {
      setBlankCalls((prev) => ({ ...prev, [p.processId]: [] }));
    } finally {
      setLoadingCalls(null);
    }
  };

  const s = overview?.summary;
  const attention = overview?.processes.filter(
    (p) => p.status === 'not_auditing' || p.status === 'stalled',
  ) ?? [];
  // Processes that never had a single audited call are dead weight in the list — they say nothing
  // about whether auditing is working, only that this process was never wired up. They stay out of
  // the table unless the No Data tile is selected, and their count stays on that tile either way.
  const visible = overview?.processes.filter(
    (p) => (statusFilter ? p.status === statusFilter : p.status !== 'no_data'),
  ) ?? [];
  const hiddenNoData = statusFilter ? 0 : (s?.noData ?? 0);

  return (
    <div className="min-h-full bg-slate-50/60 pb-10">
      {/* ── header ── */}
      <div
        className="px-5 py-4 text-white"
        style={{ background: 'linear-gradient(135deg, #0D47A1 0%, #1565C0 100%)' }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
              <Activity size={18} />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">AI Audit Monitor</h1>
              <p className="text-[11px] text-white/70">
                Which processes are actually being audited — and which have quietly stopped
              </p>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <input
              type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              aria-label="Start date"
              className="rounded-lg border border-white/25 bg-white/15 px-2 py-1.5 text-[11px] text-white outline-none [color-scheme:dark]"
            />
            <span className="text-[11px] text-white/60">to</span>
            <input
              type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              aria-label="End date"
              className="rounded-lg border border-white/25 bg-white/15 px-2 py-1.5 text-[11px] text-white outline-none [color-scheme:dark]"
            />
            <button
              onClick={() => setShowSettings((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/15 px-2.5 py-1.5 text-[11px] font-semibold transition hover:bg-white/25"
            >
              <SlidersHorizontal size={12} /> Thresholds
            </button>
            <button
              onClick={() => setAutoRefresh((v) => !v)}
              aria-pressed={autoRefresh}
              title="Re-check every 2 minutes"
              className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition"
              style={{
                backgroundColor: autoRefresh ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.15)',
                borderColor: autoRefresh ? '#fff' : 'rgba(255,255,255,0.25)',
                color: autoRefresh ? '#0D47A1' : '#fff',
              }}
            >
              <Radio size={12} className={autoRefresh ? 'animate-pulse' : ''} />
              Live
            </button>
            <button
              onClick={() => void load(true)} disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/15 px-2.5 py-1.5 text-[11px] font-semibold transition hover:bg-white/25 disabled:cursor-wait"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {showSettings && (
          <div className="mt-3 flex flex-wrap items-center gap-5 rounded-xl border border-white/20 bg-white/10 px-4 py-3 animate-fade-in">
            <label className="flex items-center gap-2 text-[11px]">
              <span className="text-white/80">Blank calls in a row that mean “not auditing”</span>
              <input
                type="number" min={1} max={500} value={blankThreshold}
                onChange={(e) => setBlankThreshold(Math.max(1, Number(e.target.value) || 1))}
                className="w-16 rounded-md border border-white/25 bg-white/15 px-2 py-1 text-center font-semibold text-white outline-none"
              />
            </label>
            <label className="flex items-center gap-2 text-[11px]">
              <span className="text-white/80">Hours with no new call before “stalled”</span>
              <input
                type="number" min={1} max={720} value={staleHours}
                onChange={(e) => setStaleHours(Math.max(1, Number(e.target.value) || 1))}
                className="w-16 rounded-md border border-white/25 bg-white/15 px-2 py-1 text-center font-semibold text-white outline-none"
              />
            </label>
            {overview && (
              <span className="ml-auto text-[10px] text-white/60">
                Checked {new Date(overview.generatedAt).toLocaleTimeString('en-IN')}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4 px-5 pt-4">
        {error && (
          <div className="flex items-center gap-2 rounded-xl border px-4 py-3 text-[12px]"
            style={{ backgroundColor: STATUS.not_auditing.tint, borderColor: `${STATUS.not_auditing.color}44`, color: STATUS.not_auditing.text }}>
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        {loading && !overview && (
          <div className="flex h-64 items-center justify-center gap-2 text-sm" style={{ color: INK.muted }}>
            <Loader2 size={18} className="animate-spin" /> Checking every process…
          </div>
        )}

        {overview && s && (
          <>
            {/* ── status tiles + coverage ── */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {STATUS_ORDER.map((st) => (
                <StatusTile
                  key={st} status={st} active={statusFilter === st}
                  count={
                    st === 'not_auditing' ? s.notAuditing
                    : st === 'stalled'    ? s.stalled
                    : st === 'no_data'    ? s.noData
                    : st === 'degraded'   ? s.degraded
                    : s.healthy
                  }
                  onClick={() => setStatusFilter((cur) => (cur === st ? null : st))}
                />
              ))}

              {/* Hero figure — one number, no plot, so no legend or hover needed */}
              <div className="flex flex-col justify-center gap-1 rounded-xl border p-3"
                style={{ backgroundColor: '#fff', borderColor: '#E2E8F0' }}>
                <span className="flex items-center gap-1.5">
                  <Gauge size={13} style={{ color: SERIES.scored }} />
                  <span className="text-[11px] font-semibold" style={{ color: INK.secondary }}>Audit Coverage</span>
                </span>
                <span className="text-2xl font-bold leading-none" style={{ color: SERIES.scored }}>
                  {s.coverage}%
                </span>
                <span className="text-[10px] leading-tight" style={{ color: INK.muted }}>
                  {nf.format(s.totalScored)} of {nf.format(s.totalCalls)} calls graded
                </span>
              </div>
            </div>

            {/* ── needs attention ── */}
            {attention.length > 0 && (
              <div className="rounded-xl border bg-white p-4" style={{ borderColor: `${STATUS.not_auditing.color}33` }}>
                <h2 className="mb-3 flex items-center gap-2 text-[13px] font-bold" style={{ color: INK.primary }}>
                  <ShieldAlert size={15} style={{ color: STATUS.not_auditing.color }} />
                  Needs attention now
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ backgroundColor: STATUS.not_auditing.tint, color: STATUS.not_auditing.text }}>
                    {attention.length}
                  </span>
                </h2>
                <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                  {attention.map((p) => (
                    <div key={p.processId} className="rounded-lg border-l-[3px] bg-slate-50/70 p-3"
                      style={{ borderLeftColor: STATUS[p.status].color }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-bold" style={{ color: INK.primary }}>
                            {p.processName}
                          </div>
                          <div className="text-[10px]" style={{ color: INK.muted }}>
                            {p.clientName} · {p.lob}
                          </div>
                        </div>
                        <StatusPill status={p.status} size="sm" />
                      </div>
                      <p className="mt-2 text-[11px] leading-snug" style={{ color: INK.secondary }}>{p.reason}</p>
                      <div className="mt-2 flex items-center gap-3 text-[10px]" style={{ color: INK.muted }}>
                        <span>{nf.format(p.total)} calls</span>
                        <span>·</span>
                        <span>last {relTime(p.hoursSinceLastCall)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── charts: counts and rate kept on separate axes, never overlaid ── */}
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border bg-white p-4 lg:col-span-2" style={{ borderColor: '#E2E8F0' }}>
                <h2 className="text-[13px] font-bold" style={{ color: INK.primary }}>Where calls are dropping out</h2>
                <p className="mb-3 text-[11px]" style={{ color: INK.muted }}>
                  Every audited call per day, split by how far it got through the pipeline
                </p>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={timeline} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={INK.grid} vertical={false} />
                    <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false}
                      axisLine={{ stroke: INK.axis }} tick={{ fontSize: 10, fill: INK.muted }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: INK.muted }} width={44} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
                    <Legend iconType="circle" iconSize={8}
                      wrapperStyle={{ fontSize: 11, color: INK.secondary, paddingTop: 6 }} />
                    {/* 2px white stroke = the surface gap between stacked segments */}
                    <Bar dataKey="scored"       stackId="a" name="Graded"          fill={SERIES.scored}       stroke="#fff" strokeWidth={2} />
                    <Bar dataKey="blank"        stackId="a" name="Blank score"     fill={SERIES.blank}        stroke="#fff" strokeWidth={2} />
                    <Bar dataKey="noTranscript" stackId="a" name="No transcript"   fill={SERIES.noTranscript} stroke="#fff" strokeWidth={2} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-xl border bg-white p-4" style={{ borderColor: '#E2E8F0' }}>
                <h2 className="text-[13px] font-bold" style={{ color: INK.primary }}>Daily audit coverage</h2>
                <p className="mb-3 text-[11px]" style={{ color: INK.muted }}>
                  Share of calls that came back with real scores
                </p>
                <ResponsiveContainer width="100%" height={230}>
                  <LineChart data={timeline} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={INK.grid} vertical={false} />
                    <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false}
                      axisLine={{ stroke: INK.axis }} tick={{ fontSize: 10, fill: INK.muted }} />
                    <YAxis domain={[0, 100]} unit="%" tickLine={false} axisLine={false}
                      tick={{ fontSize: 10, fill: INK.muted }} width={46} />
                    <Tooltip content={<ChartTooltip suffix="%" />} />
                    {/* Single series — the title names it, so no legend box */}
                    <Line type="monotone" dataKey="coverage" name="Coverage" stroke={SERIES.scored}
                      strokeWidth={2} dot={{ r: 3, fill: SERIES.scored, stroke: '#fff', strokeWidth: 2 }}
                      activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── process table (also the required table view for the charts) ── */}
            <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: '#E2E8F0' }}>
              <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3" style={{ borderColor: '#E2E8F0' }}>
                <h2 className="text-[13px] font-bold" style={{ color: INK.primary }}>
                  {statusFilter ? STATUS[statusFilter].label : 'Processes with audit activity'}
                  <span className="ml-2 font-normal" style={{ color: INK.muted }}>
                    {visible.length}
                  </span>
                </h2>
                {hiddenNoData > 0 && (
                  <button onClick={() => setStatusFilter('no_data')}
                    className="rounded-full border px-2.5 py-1 text-[10px] font-medium transition hover:bg-slate-50"
                    style={{ borderColor: '#E2E8F0', color: INK.muted }}>
                    {hiddenNoData} with no data hidden — show
                  </button>
                )}
                {statusFilter && (
                  <button onClick={() => setStatusFilter(null)}
                    className="rounded-full border px-2.5 py-1 text-[10px] font-semibold transition hover:bg-slate-50"
                    style={{ borderColor: '#E2E8F0', color: INK.secondary }}>
                    Clear “{STATUS[statusFilter].label}” filter ✕
                  </button>
                )}
                <div className="ml-auto flex items-center gap-3 text-[10px]" style={{ color: INK.muted }}>
                  {([['Graded', SERIES.scored], ['Blank score', SERIES.blank], ['No transcript', SERIES.noTranscript]] as const).map(
                    ([label, color]) => (
                      <span key={label} className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{label}
                      </span>
                    ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-[12px]">
                  <thead>
                    <tr className="border-b bg-slate-50/80 text-left" style={{ borderColor: '#E2E8F0' }}>
                      {['Process', 'Status', 'Pipeline', 'Calls', 'Graded', 'Blank', 'No transcript', 'Streak', 'Last call', ''].map((h, i) => (
                        <th key={h || i}
                          className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-wide ${i >= 3 && i <= 7 ? 'text-right' : ''}`}
                          style={{ color: INK.muted }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((p) => {
                      const isOpen = expanded === p.processId;
                      const rows = blankCalls[p.processId];
                      return (
                        <Fragment key={p.processId}>
                          <tr
                            onClick={() => void toggleRow(p)}
                            className="cursor-pointer border-b transition-colors hover:bg-slate-50/80"
                            style={{ borderColor: '#F1F5F9' }}
                          >
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className="h-7 w-[3px] rounded-full"
                                  style={{ backgroundColor: STATUS[p.status].color }} />
                                <div className="min-w-0">
                                  <div className="truncate font-semibold" style={{ color: INK.primary }}>
                                    {p.processName}
                                  </div>
                                  <div className="text-[10px]" style={{ color: INK.muted }}>
                                    {p.clientName} · {p.lob}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2.5"><StatusPill status={p.status} size="sm" /></td>
                            <td className="w-40 px-3 py-2.5"><StageBar p={p} /></td>
                            <td className="px-3 py-2.5 text-right font-semibold tabular-nums" style={{ color: INK.primary }}>
                              {nf.format(p.total)}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: INK.secondary }}>
                              {nf.format(p.scoredOk)}
                              <span className="ml-1 text-[10px]" style={{ color: INK.muted }}>{p.coverage}%</span>
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-semibold"
                              style={{ color: p.scoredBlank > 0 ? SERIES.blank : INK.muted }}>
                              {nf.format(p.scoredBlank)}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums"
                              style={{ color: p.noTranscript > 0 ? '#8a5d00' : INK.muted }}>
                              {nf.format(p.noTranscript)}
                              <span className="ml-1 text-[10px]" style={{ color: INK.muted }}>{p.transcriptGapRate}%</span>
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-bold"
                              style={{ color: p.blankStreak > blankThreshold ? STATUS.not_auditing.color : INK.muted }}>
                              {p.blankStreak}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5" style={{ color: INK.secondary }}>
                              {relTime(p.hoursSinceLastCall)}
                            </td>
                            <td className="px-3 py-2.5">
                              <ChevronDown size={14} style={{ color: INK.muted }}
                                className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                            </td>
                          </tr>

                          {isOpen && (
                            <tr style={{ backgroundColor: '#F8FAFC' }}>
                              <td colSpan={10} className="px-5 py-3">
                                <p className="mb-2.5 text-[11px] font-medium" style={{ color: INK.secondary }}>
                                  {p.reason}
                                </p>
                                {loadingCalls === p.processId ? (
                                  <div className="flex items-center gap-2 py-3 text-[11px]" style={{ color: INK.muted }}>
                                    <Loader2 size={13} className="animate-spin" /> Loading the calls behind this…
                                  </div>
                                ) : rows && rows.length > 0 ? (
                                  <div className="max-h-64 overflow-auto rounded-lg border bg-white" style={{ borderColor: '#E2E8F0' }}>
                                    <table className="w-full text-[11px]">
                                      <thead className="sticky top-0 bg-slate-50">
                                        <tr className="text-left" style={{ color: INK.muted }}>
                                          {['Call time', 'Agent', 'Lead', 'Duration', 'Failed at'].map((h) => (
                                            <th key={h} className="px-3 py-1.5 text-[10px] font-semibold uppercase">{h}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {rows.map((c, i) => (
                                          <tr key={`${c.callDate}-${i}`} className="border-t" style={{ borderColor: '#F1F5F9' }}>
                                            <td className="whitespace-nowrap px-3 py-1.5 tabular-nums" style={{ color: INK.secondary }}>
                                              {new Date(c.callDate).toLocaleString('en-IN', {
                                                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                                              })}
                                            </td>
                                            <td className="px-3 py-1.5" style={{ color: INK.primary }}>{c.agent ?? '—'}</td>
                                            <td className="px-3 py-1.5 tabular-nums" style={{ color: INK.muted }}>{c.leadId ?? '—'}</td>
                                            <td className="px-3 py-1.5 tabular-nums" style={{ color: INK.muted }}>
                                              {c.durationSec !== null ? `${c.durationSec}s` : '—'}
                                            </td>
                                            <td className="px-3 py-1.5">
                                              <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                                style={{
                                                  backgroundColor: c.stage === 'scoring' ? '#FEF2F2' : '#FEFCE8',
                                                  color: c.stage === 'scoring' ? '#9B1C1C' : '#854D0E',
                                                }}>
                                                {c.stage === 'scoring'
                                                  ? <><ShieldAlert size={10} /> Grading</>
                                                  : <><FileX size={10} /> Transcription</>}
                                              </span>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <p className="py-2 text-[11px]" style={{ color: INK.muted }}>
                                    No blank calls to show for this window.
                                  </p>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}

                    {visible.length === 0 && (
                      <tr>
                        <td colSpan={10} className="px-4 py-10 text-center text-[12px]" style={{ color: INK.muted }}>
                          No processes match this filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="px-1 text-[10px]" style={{ color: INK.muted }}>
              A call is counted “blank” when its row exists but every audit parameter came back empty.
              “Blank score” means the transcript was there and the grader still returned nothing;
              “no transcript” means the recording never became text, so there was nothing to grade.
              A process is flagged <b>Not Auditing</b> once more than {blankThreshold} calls in a row
              come back blank, and <b>Stalled</b> when no new call has arrived for {staleHours}h.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
