import { useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, ComposedChart,
  ScatterChart, Scatter, ZAxis,
} from 'recharts';
import {
  Landmark, Phone, CheckCircle2, Timer, IndianRupee, Wallet, AlertTriangle,
  Users, Star, Loader2, ListChecks, TrendingUp, Frown, ShieldAlert, Lightbulb,
  Trophy, Medal, Award, Filter, CalendarRange, Inbox, Download, X, MousePointerClick,
  Ban, ThumbsUp, ThumbsDown, Meh, PhoneCall,
  type LucideIcon,
} from 'lucide-react';
import api from '@/lib/axios';

// ─── Shared helpers ─────────────────────────────────────────────────────────
const BLUE = '#1565C0';
const BLUE_DARK = '#0D47A1';
const GREEN = '#22b990';
const AMBER = '#eea12b';
const RED = '#e8607d';
const SLATE = '#64748B';
const VIOLET = '#7C3AED';
const DONUT_COLORS = ['#1565C0', '#22b990', '#7C3AED', '#eea12b', '#e8607d', '#0891B2', '#D97706', '#64748B', '#EC4899', '#84CC16', '#F97316', '#06B6D4'];

const TT = { background: '#0f172a', border: 'none', borderRadius: 10, fontSize: 11, color: '#fff', padding: '8px 12px', boxShadow: '0 8px 24px rgba(15,23,42,0.25)' };

function toLocalDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function scoreColor(pct: number) { return pct >= 85 ? GREEN : pct >= 60 ? AMBER : RED; }
function hexToRgba(hex: string, alpha: number) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
// Continuous red -> amber -> green heatmap, used for the dense agent x parameter grid.
function heatColor(pct: number): { text: string; bg: string } {
  const stops = pct <= 50
    ? { from: [232, 96, 125], to: [238, 161, 43], t: pct / 50 }
    : { from: [238, 161, 43], to: [34, 185, 144], t: (pct - 50) / 50 };
  const [r1, g1, b1] = stops.from, [r2, g2, b2] = stops.to;
  const r = Math.round(r1 + (r2 - r1) * stops.t);
  const g = Math.round(g1 + (g2 - g1) * stops.t);
  const b = Math.round(b1 + (b2 - b1) * stops.t);
  return { text: `rgb(${r},${g},${b})`, bg: `rgba(${r},${g},${b},0.14)` };
}

// What a click on any chart/metric resolves to. Mirrors DrillType on the backend.
export type DrillType =
  | 'kpi' | 'outcome' | 'scenario' | 'agent' | 'sentiment' | 'frustration' | 'abusive'
  | 'frustratedScenario' | 'week' | 'param' | 'agentParam' | 'compliance' | 'call'
  | 'intent' | 'genuine' | 'payOutcome' | 'nonActionableReason' | 'neutralOutcome' | 'disposition' | 'needCall' | 'funnel' | 'qaStatement';
interface DrillSel { type: DrillType; value: string; title: string }
type OnDrill = (type: DrillType, value: string, title: string) => void;

// ─── Generic building blocks ────────────────────────────────────────────────
const CARD = 'rounded-2xl bg-white ring-1 ring-slate-900/5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]';
const CLICKABLE = 'cursor-pointer hover:ring-2 hover:ring-blue-300/70 transition-shadow';

function KpiCard({ icon: Icon, label, value, sub, color, onClick }: {
  icon: LucideIcon; label: string; value: React.ReactNode; sub?: string; color: string; onClick?: () => void;
}) {
  const body = (
    <>
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
          style={{ background: `linear-gradient(135deg, ${color}, ${hexToRgba(color, 0.75)})` }}>
          <Icon size={15} className="text-white" strokeWidth={2.25} />
        </div>
        <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 leading-tight text-left">{label}</span>
      </div>
      <div className="text-2xl font-extrabold text-slate-800 tracking-tight truncate text-left">{value}</div>
      {sub && <div className="text-[10px] text-slate-400 font-medium truncate text-left">{sub}</div>}
    </>
  );
  const base = `${CARD} p-3.5 flex flex-col gap-2 min-w-0 transition-shadow hover:shadow-[0_1px_2px_rgba(15,23,42,0.06),0_12px_28px_-10px_rgba(15,23,42,0.18)]`;
  if (!onClick) return <div className={base}>{body}</div>;
  return (
    <button type="button" onClick={onClick} title="Click for details" className={`${base} ${CLICKABLE} w-full`}>
      {body}
    </button>
  );
}

function Panel({ title, icon: Icon, children, className = '', accent = BLUE, hint }: {
  title: string; icon?: LucideIcon; children: React.ReactNode; className?: string; accent?: string; hint?: boolean;
}) {
  return (
    <div className={`${CARD} overflow-hidden flex flex-col ${className}`}>
      <div className="h-[3px] w-full shrink-0" style={{ background: `linear-gradient(90deg, ${accent}, ${hexToRgba(accent, 0.25)})` }} />
      <div className="px-4 py-3 flex items-center gap-2 border-b border-slate-100">
        {Icon && (
          <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: hexToRgba(accent, 0.12) }}>
            <Icon size={12.5} style={{ color: accent }} strokeWidth={2.25} />
          </div>
        )}
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{title}</span>
        {hint && (
          <span className="ml-auto flex items-center gap-1 text-[9px] font-semibold text-slate-400 normal-case tracking-normal">
            <MousePointerClick size={10} /> click for details
          </span>
        )}
      </div>
      <div className="p-4 flex-1 min-w-0">{children}</div>
    </div>
  );
}

function DonutWidget({ data, centerLabel, onSliceClick }: {
  data: { name: string; count: number }[]; centerLabel: string; onSliceClick?: (name: string) => void;
}) {
  const total = data.reduce((a, d) => a + d.count, 0);
  if (!total) return <EmptyState />;
  const clickable = !!onSliceClick;
  return (
    <div className="flex flex-col lg:flex-row items-center gap-4">
      <div className="w-full lg:w-1/2 h-52 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={3} stroke="#fff" strokeWidth={2}
              onClick={clickable ? (d: { name?: string | number }) => onSliceClick!(String(d.name ?? '')) : undefined}
              style={clickable ? { cursor: 'pointer' } : undefined}>
              {data.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={TT} formatter={(v, n) => [`${v} (${((Number(v) / total) * 100).toFixed(0)}%)`, n]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[26px] font-extrabold text-slate-800 tracking-tight">{total}</span>
          <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wide text-center">{centerLabel}</span>
        </div>
      </div>
      <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
        {data.map((d, i) => {
          const row = (
            <>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
              <span className="text-slate-600 font-medium truncate">{d.name}</span>
              <span className="ml-auto font-extrabold text-slate-700 shrink-0">{d.count} <span className="text-slate-400 font-semibold">({((d.count / total) * 100).toFixed(0)}%)</span></span>
            </>
          );
          const style = { background: hexToRgba(DONUT_COLORS[i % DONUT_COLORS.length], 0.07) };
          return clickable ? (
            <button key={d.name} type="button" onClick={() => onSliceClick!(d.name)} style={style}
              className="flex items-center gap-2 truncate rounded-lg px-2 py-1.5 text-left hover:ring-1 hover:ring-slate-300 transition">{row}</button>
          ) : (
            <div key={d.name} style={style} className="flex items-center gap-2 truncate rounded-lg px-2 py-1.5">{row}</div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({ label = 'No data for this period.' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-52 gap-2 text-slate-300">
      <Inbox size={26} strokeWidth={1.5} />
      <span className="text-xs text-slate-400 font-medium">{label}</span>
    </div>
  );
}
function LoadingState() {
  return (
    <div className="flex items-center justify-center h-52 gap-2 text-slate-400 text-xs font-medium">
      <Loader2 size={14} className="animate-spin text-blue-500" /> Loading…
    </div>
  );
}

function BarList({ items, unit = '%', barColor, onItemClick }: {
  items: { label: string; value: number; key?: string }[]; unit?: string; barColor?: (v: number) => string;
  onItemClick?: (item: { label: string; key?: string }) => void;
}) {
  if (!items.length) return <EmptyState />;
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div className="flex flex-col gap-3">
      {items.map(i => {
        const color = barColor ? barColor(i.value) : BLUE;
        const body = (
          <>
            <div className="flex items-center justify-between mb-1 gap-2">
              <span className="text-[11px] font-semibold text-slate-600 truncate text-left">{i.label}</span>
              <span className="text-[10.5px] font-extrabold shrink-0 px-1.5 py-0.5 rounded-md" style={{ color, background: hexToRgba(color, 0.1) }}>{i.value}{unit}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (i.value / (unit === '%' ? 100 : max)) * 100)}%`, background: `linear-gradient(90deg, ${hexToRgba(color, 0.75)}, ${color})` }} />
            </div>
          </>
        );
        return onItemClick ? (
          <button key={i.label} type="button" onClick={() => onItemClick(i)} className="w-full text-left rounded-lg px-1 -mx-1 py-0.5 hover:bg-slate-50 transition-colors">{body}</button>
        ) : (
          <div key={i.label}>{body}</div>
        );
      })}
    </div>
  );
}

// ─── Types mirroring the backend response shapes ────────────────────────────
interface Kpis {
  totalCalls: number; avgAuditScore: number; avgCallDurationMin: number;
  ptpGiven: number; ptpGivenPct: number; paymentDone: number; paymentDonePct: number;
  nonCompliancePct: number; uniqueCustomers: number; customerSatisfaction: number;
}
interface NameCount { name: string; count: number }
interface OverviewData {
  kpis: Kpis;
  callOutcomeDistribution: NameCount[];
  scenarioDistribution: NameCount[];
  weeklyTrends: { label: string; totalCalls: number; ptpGiven: number; paymentDone: number; auditScorePct: number }[];
  customerSentiment: NameCount[];
  frustrationLevel: NameCount[];
  abusiveCalls: { abusive: number; nonAbusive: number };
}
interface ScenarioAnalysisData {
  kpis: Kpis;
  scenarioDistribution: NameCount[];
  scenarioTrendWeekly: Record<string, number | string>[];
  topScenariosForTrend: string[];
  scenarioVsOutcome: { scenario: string; callCount: number; outcomeBreakdown: NameCount[] }[];
  avgDurationByScenario: { scenario: string; avgDurationMin: number }[];
  auditScoreByScenario: { scenario: string; auditScorePct: number }[];
  sentimentByScenario: { scenario: string; positive: number; neutral: number; negative: number }[];
  frustration: { frustrationDetected: number; frustrationDetectedPct: number; highFrustration: number; highFrustrationPct: number; customerAbusing: number; customerAbusingPct: number };
  topAbusiveSentences: { sentence: string; scenario: string; callId: string }[];
  top5ScenariosByNonCompliance: { scenario: string; nonCompliancePct: number }[];
  topFrustratedReasons: { reason: string; count: number; pct: number }[];
}
interface AgentRow {
  agentName: string; agentId: string; totalCalls: number; avgDurationMin: number; auditScorePct: number;
  ptpGiven: number; paymentDone: number; ptpConversionPct: number; nonCompliantCount: number; compliancePct: number;
  demoCollectionAmount: number; paramScores: Record<string, number>;
}
interface AgentPerformanceData {
  kpis: Kpis & { totalAgents: number };
  parameterColumns: { key: string; label: string }[];
  agentTable: AgentRow[];
  collectionEffectiveness: { totalDemoAmount: number; avgDemoAmount: number; totalPaymentDone: number };
  qualityMatrix: { agentName: string; avgDurationMin: number; auditScorePct: number; totalCalls: number }[];
  top5ByCollectionAmount: { agentName: string; demoCollectionAmount: number }[];
  bottom5ByAuditScore: { agentName: string; auditScorePct: number }[];
}
interface QualityInsightsData {
  kpis: Kpis;
  overallQualityScore: number;
  qualityGrade: string;
  parameterScorecard: { key: string; label: string; passRatePct: number }[];
  compliance: { compliant: number; nonCompliant: number; total: number; compliantPct: number; nonCompliantPct: number };
  customerBehavior: NameCount[];
  frustrationTrendWeekly: { label: string; high: number; medium: number; low: number }[];
  abusiveCallsTrendWeekly: { label: string; count: number }[];
  avgAuditScoreTrendWeekly: { label: string; auditScorePct: number }[];
  sentimentTrendWeekly: { label: string; positivePct: number; neutralPct: number; negativePct: number }[];
  topIssues: { key: string; issue: string; count: number }[];
  topFrustratedReasons: { reason: string; count: number; pct: number }[];
  abusiveExamples: { sentence: string; callId: string }[];
  keyInsights: string[];
}
interface IntentData {
  kpis: { totalCalls: number; genuineCustomers: number; genuinePct: number; nonActionable: number; nonActionablePct: number;
    positiveIntent: number; positiveIntentPct: number; neutralIntent: number; neutralIntentPct: number;
    negativeIntent: number; negativeIntentPct: number; paymentDone: number; paymentDonePct: number;
    ptpGiven: number; ptpGivenPct: number; needToCall: number; needToCallPct: number };
  intentDistribution: NameCount[];
  genuineDistribution: NameCount[];
  payOutcomeDistribution: NameCount[];
  qaSentimentDistribution: NameCount[];
  sentimentTrendWeekly: Record<string, number | string>[];
  sentimentStatements: string[];
  nonActionableReasons: NameCount[];
  neutralReasons: NameCount[];
  disposition: (NameCount & { pct: number })[];
  funnel: { stage: string; label: string; count: number; pct: number }[];
  agents: { agentName: string; totalCalls: number; genuine: number; paymentDone: number; ptpGiven: number; conversionPct: number }[];
  insights: string[];
}
interface FilterOptions {
  buckets: string[]; agents: string[]; scenarios: string[]; callOutcomes: string[]; sentiments: string[]; frustrationLevels: string[];
}
interface DrillCall {
  callId: string; date: string; agent: string; scenario: string; outcome: string; sentiment: string; frustration: string;
  auditScorePct: number; durationMin: number; abusive: boolean; abusiveSentence: string; failedParams: string[];
}
interface DrillData {
  total: number;
  kpis: { calls: number; auditScorePct: number; avgDurationMin: number; ptpGiven: number; paymentDone: number; abusive: number; nonCompliancePct: number; uniqueCustomers: number };
  byDay: { date: string; calls: number; auditScorePct: number; ptpGiven: number; paymentDone: number; abusive: number }[];
  breakdowns: { outcome: NameCount[]; scenario: NameCount[]; agent: NameCount[]; sentiment: NameCount[]; frustration: NameCount[] };
  calls: DrillCall[];
  callsTruncated: boolean;
}

const SLIDES = ['Customer Intent', 'Overview', 'Scenario Analysis', 'Agent Performance', 'Quality & Insights'] as const;
type Slide = (typeof SLIDES)[number];

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  const active = value !== 'All';
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}
        className={`text-[11px] font-semibold rounded-lg px-2.5 py-1.5 truncate outline-none transition-colors cursor-pointer
          ${active ? 'text-blue-700 bg-blue-50 ring-1 ring-blue-200' : 'text-slate-600 bg-slate-50 ring-1 ring-slate-200 hover:ring-slate-300'}`}>
        <option value="All">All</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

// ─── Drill-down modal ────────────────────────────────────────────────────────
function downloadCsv(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const body = rows.map(r => keys.map(k => {
    const s = r[k] == null ? '' : String(r[k]);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
  const blob = new Blob(['﻿' + `${keys.join(',')}\n${body}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function DrillModal({ sel, qs, onClose }: { sel: DrillSel; qs: string; onClose: () => void }) {
  const [data, setData] = useState<DrillData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<'daily' | 'breakdown' | 'calls'>('daily');

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => {
    setLoading(true); setError(false);
    const params = `${qs}&type=${encodeURIComponent(sel.type)}&value=${encodeURIComponent(sel.value)}`;
    api.get<{ success: boolean; data: DrillData }>(`/sbi-quality/drill?${params}`)
      .then(r => setData(r.data?.data ?? null))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [qs, sel.type, sel.value]);

  const exportCalls = () => {
    if (!data) return;
    downloadCsv(data.calls.map(c => ({
      'Call ID': c.callId, Date: c.date, Agent: c.agent, Scenario: c.scenario, 'Call Outcome': c.outcome,
      Sentiment: c.sentiment, Frustration: c.frustration, 'Audit Score %': c.auditScorePct,
      'Duration (min)': c.durationMin, Abusive: c.abusive ? 'Yes' : 'No',
      'Failed Parameters': c.failedParams.join('; '),
    })), `sbi-drill_${sel.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`);
  };

  const k = data?.kpis;
  const TABS = [
    { id: 'daily' as const, label: 'Date-wise' },
    { id: 'breakdown' as const, label: 'Breakdown' },
    { id: 'calls' as const, label: `Calls${data ? ` (${data.total})` : ''}` },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4" onClick={onClose}>
      <div className="w-full max-w-6xl bg-slate-50 rounded-3xl shadow-2xl ring-1 ring-slate-900/10 overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 flex items-center gap-4 text-white"
          style={{ background: `linear-gradient(120deg, ${BLUE_DARK} 0%, ${BLUE} 60%, #1E88E5 100%)` }}>
          <div className="w-10 h-10 rounded-xl bg-white/15 ring-1 ring-white/25 flex items-center justify-center shrink-0">
            <Landmark size={18} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/70">Drill-down</div>
            <div className="font-extrabold text-base truncate">{sel.title}</div>
          </div>
          {data && (
            <span className="ml-2 text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/15 ring-1 ring-white/20 shrink-0">
              {data.total} call{data.total === 1 ? '' : 's'}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {data && data.calls.length > 0 && (
              <button onClick={exportCalls} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/15 ring-1 ring-white/25 hover:bg-white/25 transition">
                <Download size={12} /> Export CSV
              </button>
            )}
            <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/10 hover:bg-white/25 transition">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-5 flex flex-col gap-4 max-h-[78vh] overflow-y-auto">
          {loading && <LoadingState />}
          {error && (
            <div className="rounded-xl bg-red-50 text-red-600 text-xs px-4 py-3 flex items-center gap-2">
              <AlertTriangle size={14} /> Couldn't load the details for this selection.
            </div>
          )}
          {data && k && (
            <>
              {/* KPI strip for this selection */}
              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2.5">
                <KpiCard icon={Phone} label="Calls" value={k.calls} color={BLUE} />
                <KpiCard icon={CheckCircle2} label="Audit Score" value={`${k.auditScorePct}%`} color={scoreColor(k.auditScorePct)} />
                <KpiCard icon={Timer} label="Avg Duration" value={`${k.avgDurationMin.toFixed(1)} min`} color={SLATE} />
                <KpiCard icon={IndianRupee} label="PTP Given" value={k.ptpGiven} sub={data.total ? `${((k.ptpGiven / data.total) * 100).toFixed(0)}% of calls` : ''} color={AMBER} />
                <KpiCard icon={Wallet} label="Payment Done" value={k.paymentDone} sub={data.total ? `${((k.paymentDone / data.total) * 100).toFixed(0)}% of calls` : ''} color={GREEN} />
                <KpiCard icon={ShieldAlert} label="Abusive" value={k.abusive} color={RED} />
                <KpiCard icon={AlertTriangle} label="Non-Compliance" value={`${k.nonCompliancePct}%`} color={RED} />
                <KpiCard icon={Users} label="Unique Customers" value={k.uniqueCustomers} color={BLUE} />
              </div>

              {data.total === 0 ? (
                <Panel title="No matching calls" icon={Inbox}><EmptyState label="Nothing in this period matches this selection." /></Panel>
              ) : (
                <>
                  {/* Tabs */}
                  <div className="flex items-center gap-1 bg-white ring-1 ring-slate-200 rounded-xl p-1 w-fit">
                    {TABS.map(t => (
                      <button key={t.id} onClick={() => setTab(t.id)}
                        className={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold transition ${tab === t.id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {tab === 'daily' && (
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                      <Panel title="Calls & audit score by date" icon={CalendarRange} className="lg:col-span-3">
                        <ResponsiveContainer width="100%" height={260}>
                          <ComposedChart data={data.byDay} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                            <XAxis dataKey="date" tick={{ fill: '#334155', fontSize: 9 }} tickFormatter={(v: string) => v.slice(8, 10) + '-' + v.slice(5, 7)} />
                            <YAxis yAxisId="l" tick={{ fill: '#64748B', fontSize: 9 }} allowDecimals={false} />
                            <YAxis yAxisId="r" orientation="right" domain={[0, 100]} tick={{ fill: '#64748B', fontSize: 9 }} tickFormatter={(v: number) => `${v}%`} />
                            <Tooltip contentStyle={TT} />
                            <Legend wrapperStyle={{ fontSize: 10 }} />
                            <Bar yAxisId="l" dataKey="calls" name="Calls" fill={BLUE} radius={[5, 5, 0, 0]} />
                            <Line yAxisId="r" type="monotone" dataKey="auditScorePct" name="Audit Score %" stroke={GREEN} strokeWidth={2.5} dot={{ r: 3 }} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </Panel>
                      <Panel title="Day-by-day" icon={ListChecks} className="lg:col-span-2">
                        <div className="overflow-auto max-h-[260px]">
                          <table className="w-full text-[11px] border-separate border-spacing-0">
                            <thead className="sticky top-0 bg-white">
                              <tr className="text-slate-400 uppercase text-left text-[9px] tracking-wider">
                                <th className="py-1.5 font-bold">Date</th><th className="py-1.5 font-bold text-right">Calls</th>
                                <th className="py-1.5 font-bold text-right">Audit</th><th className="py-1.5 font-bold text-right">PTP</th>
                                <th className="py-1.5 font-bold text-right">Paid</th>
                              </tr>
                            </thead>
                            <tbody>
                              {data.byDay.map((d, i) => (
                                <tr key={d.date} className={i % 2 === 1 ? 'bg-slate-50/60' : ''}>
                                  <td className="py-1.5 font-semibold text-slate-700">{d.date.slice(8, 10)}-{d.date.slice(5, 7)}-{d.date.slice(0, 4)}</td>
                                  <td className="py-1.5 text-right font-bold text-blue-700">{d.calls}</td>
                                  <td className="py-1.5 text-right"><span className="font-bold" style={{ color: scoreColor(d.auditScorePct) }}>{d.auditScorePct}%</span></td>
                                  <td className="py-1.5 text-right text-slate-600">{d.ptpGiven}</td>
                                  <td className="py-1.5 text-right text-slate-600">{d.paymentDone}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Panel>
                    </div>
                  )}

                  {tab === 'breakdown' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <Panel title="By scenario" icon={ListChecks}>
                        <BarList items={data.breakdowns.scenario.map(s => ({ label: s.name, value: s.count }))} unit="" barColor={() => BLUE} />
                      </Panel>
                      <Panel title="By agent" icon={Users}>
                        <BarList items={data.breakdowns.agent.map(s => ({ label: s.name, value: s.count }))} unit="" barColor={() => VIOLET} />
                      </Panel>
                      <Panel title="By call outcome" icon={Wallet}>
                        <DonutWidget data={data.breakdowns.outcome} centerLabel="Calls" />
                      </Panel>
                      <Panel title="By sentiment & frustration" icon={Frown}>
                        <div className="grid grid-cols-1 gap-4">
                          <DonutWidget data={data.breakdowns.sentiment} centerLabel="Sentiment" />
                          <DonutWidget data={data.breakdowns.frustration} centerLabel="Frustration" />
                        </div>
                      </Panel>
                    </div>
                  )}

                  {tab === 'calls' && (
                    <Panel title={`Calls${data.callsTruncated ? ` (first ${data.calls.length} of ${data.total})` : ''}`} icon={Phone}>
                      <div className="overflow-auto max-h-[420px] -mx-1">
                        <table className="w-full text-[11px] border-separate border-spacing-0">
                          <thead className="sticky top-0 bg-white z-10">
                            <tr className="text-slate-400 uppercase text-left text-[9px] tracking-wider">
                              <th className="py-2 px-2 font-bold">Call ID</th><th className="py-2 px-2 font-bold">Date</th>
                              <th className="py-2 px-2 font-bold">Agent</th><th className="py-2 px-2 font-bold">Scenario</th>
                              <th className="py-2 px-2 font-bold">Outcome</th><th className="py-2 px-2 font-bold text-right">Audit</th>
                              <th className="py-2 px-2 font-bold text-right">Min</th><th className="py-2 px-2 font-bold">Flags</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.calls.map((c, i) => (
                              <tr key={c.callId} className={`${i % 2 === 1 ? 'bg-slate-50/60' : ''} hover:bg-blue-50/50`}>
                                <td className="py-1.5 px-2 font-mono text-slate-500">{c.callId}</td>
                                <td className="py-1.5 px-2 text-slate-600 whitespace-nowrap">{c.date.slice(8, 10)}-{c.date.slice(5, 7)}-{c.date.slice(0, 4)}</td>
                                <td className="py-1.5 px-2 font-semibold text-slate-700 whitespace-nowrap">{c.agent}</td>
                                <td className="py-1.5 px-2 text-slate-600 max-w-[200px] truncate" title={c.scenario}>{c.scenario}</td>
                                <td className="py-1.5 px-2 text-slate-600 whitespace-nowrap">{c.outcome}</td>
                                <td className="py-1.5 px-2 text-right"><span className="font-bold" style={{ color: scoreColor(c.auditScorePct) }}>{c.auditScorePct}%</span></td>
                                <td className="py-1.5 px-2 text-right text-slate-600">{c.durationMin.toFixed(1)}</td>
                                <td className="py-1.5 px-2">
                                  <div className="flex flex-wrap gap-1">
                                    {c.abusive && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-600 ring-1 ring-red-100">ABUSIVE</span>}
                                    {c.failedParams.length > 0 && (
                                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 ring-1 ring-amber-100" title={c.failedParams.join('\n')}>
                                        {c.failedParams.length} failed
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Panel>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function SbiQualityDashboard() {
  const now = new Date();
  const [startDate, setStartDate] = useState(toLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)));
  // Full calendar month by default (not month-to-date) so the review dataset shows on first open.
  const [endDate, setEndDate] = useState(toLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  const [bucket, setBucket] = useState('All');
  const [agentName, setAgentName] = useState('All');
  const [scenario, setScenario] = useState('All');
  const [callOutcome, setCallOutcome] = useState('All');
  const [sentiment, setSentiment] = useState('All');
  const [frustrationLevel, setFrustrationLevel] = useState('All');
  const [activeSlide, setActiveSlide] = useState<Slide>('Customer Intent');
  const [drill, setDrill] = useState<DrillSel | null>(null);

  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [scenarioData, setScenarioData] = useState<ScenarioAnalysisData | null>(null);
  const [agentData, setAgentData] = useState<AgentPerformanceData | null>(null);
  const [insightsData, setInsightsData] = useState<QualityInsightsData | null>(null);
  const [intentData, setIntentData] = useState<IntentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.get<{ success: boolean; data: FilterOptions }>('/sbi-quality/filter-options')
      .then(r => setFilterOptions(r.data?.data ?? null))
      .catch(() => setFilterOptions(null));
  }, []);

  const qs = useMemo(() => {
    const p = new URLSearchParams({ startDate, endDate });
    if (bucket !== 'All') p.set('bucket', bucket);
    if (agentName !== 'All') p.set('agentName', agentName);
    if (scenario !== 'All') p.set('scenario', scenario);
    if (callOutcome !== 'All') p.set('callOutcome', callOutcome);
    if (sentiment !== 'All') p.set('sentiment', sentiment);
    if (frustrationLevel !== 'All') p.set('frustrationLevel', frustrationLevel);
    return p.toString();
  }, [startDate, endDate, bucket, agentName, scenario, callOutcome, sentiment, frustrationLevel]);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    const endpointBySlide: Record<Slide, string> = {
      'Customer Intent': 'intent',
      'Overview': 'overview',
      'Scenario Analysis': 'scenario-analysis',
      'Agent Performance': 'agent-performance',
      'Quality & Insights': 'quality-insights',
    };
    api.get<{ success: boolean; data: unknown }>(`/sbi-quality/${endpointBySlide[activeSlide]}?${qs}`)
      .then(r => {
        const data = r.data?.data;
        if (activeSlide === 'Customer Intent') setIntentData(data as IntentData);
        else if (activeSlide === 'Overview') setOverview(data as OverviewData);
        else if (activeSlide === 'Scenario Analysis') setScenarioData(data as ScenarioAnalysisData);
        else if (activeSlide === 'Agent Performance') setAgentData(data as AgentPerformanceData);
        else setInsightsData(data as QualityInsightsData);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [activeSlide, qs]);

  useEffect(() => { load(); }, [load]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get(`/sbi-quality/export-csv?${qs}`, { responseType: 'blob' });
      const blob = new Blob([res.data as BlobPart], { type: 'text/csv' });
      const objUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = `sbi-collection_${startDate}_to_${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(objUrl);
    } catch {
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const onDrill: OnDrill = useCallback((type, value, title) => setDrill({ type, value, title }), []);
  const closeDrill = useCallback(() => setDrill(null), []);

  const kpis = overview?.kpis ?? scenarioData?.kpis ?? agentData?.kpis ?? insightsData?.kpis ?? null;

  const activeFilterCount = [bucket, agentName, scenario, callOutcome, sentiment, frustrationLevel].filter(v => v !== 'All').length;

  return (
    <div className="flex flex-col gap-5 pb-10">
      {/* ─── Header ─── */}
      <div className="rounded-2xl overflow-hidden shadow-[0_20px_50px_-20px_rgba(13,71,161,0.45)]">
        <div className="relative px-6 py-5 flex flex-wrap items-center gap-4 overflow-hidden"
          style={{ background: `linear-gradient(120deg, ${BLUE_DARK} 0%, ${BLUE} 55%, #1E88E5 100%)` }}>
          <div className="pointer-events-none absolute -right-16 -top-24 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute right-24 bottom-0 w-40 h-40 rounded-full bg-white/5 blur-2xl" />

          <div className="relative w-11 h-11 rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm flex items-center justify-center shrink-0 shadow-lg">
            <Landmark size={22} className="text-white" strokeWidth={2} />
          </div>
          <div className="relative">
            <div className="text-white font-extrabold text-base leading-tight tracking-tight">L3 Payment Collection</div>
            <div className="text-white/70 text-[10.5px] font-semibold tracking-wide">Quality &amp; Performance Dashboard</div>
          </div>

          <div className="relative ml-auto flex items-center gap-1 bg-white/10 ring-1 ring-white/15 rounded-xl p-1 backdrop-blur-sm">
            {SLIDES.map(s => (
              <button key={s} onClick={() => setActiveSlide(s)}
                className={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-150 whitespace-nowrap
                  ${activeSlide === s ? 'bg-white text-blue-700 shadow-md' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}>
                {s}
              </button>
            ))}
          </div>
          <button onClick={handleExport} disabled={exporting}
            className="relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold text-white bg-white/15 ring-1 ring-white/25 hover:bg-white/25 transition-colors disabled:opacity-60 backdrop-blur-sm shrink-0">
            {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            Export CSV
          </button>
        </div>
        <div className="bg-white px-6 py-3.5 flex flex-wrap items-end gap-3 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-slate-400 pb-1.5 pr-1">
            <Filter size={12} />
            <span className="text-[9.5px] font-bold uppercase tracking-wider">{activeFilterCount > 0 ? `${activeFilterCount} active` : 'Filters'}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400 flex items-center gap-1"><CalendarRange size={10} /> Date Range</span>
            <div className="flex items-center gap-1.5">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-blue-300" />
              <span className="text-slate-300 text-[10px] font-semibold">to</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-blue-300" />
            </div>
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Process</span>
            <div className="text-[11px] font-bold text-blue-700 rounded-lg px-2.5 py-1.5 bg-blue-50 ring-1 ring-blue-100">SBI - Collections</div>
          </div>
          <FilterSelect label="Bucket" value={bucket} onChange={setBucket} options={filterOptions?.buckets ?? []} />
          <FilterSelect label="Agent" value={agentName} onChange={setAgentName} options={filterOptions?.agents ?? []} />
          <FilterSelect label="Scenario" value={scenario} onChange={setScenario} options={filterOptions?.scenarios ?? []} />
          <FilterSelect label="Call Outcome" value={callOutcome} onChange={setCallOutcome} options={filterOptions?.callOutcomes ?? []} />
          <FilterSelect label="Customer Sentiment" value={sentiment} onChange={setSentiment} options={filterOptions?.sentiments ?? []} />
          <FilterSelect label="Frustration Level" value={frustrationLevel} onChange={setFrustrationLevel} options={filterOptions?.frustrationLevels ?? []} />
        </div>
      </div>

      {error && (
        <div className={`${CARD} border-none text-red-600 text-xs px-4 py-3 flex items-center gap-2 bg-red-50/60`}>
          <AlertTriangle size={14} /> Couldn't load SBI Collection data for this period.
          <button onClick={load} className="ml-auto underline font-semibold hover:text-red-700">Try again</button>
        </div>
      )}

      {/* ─── Shared KPI strip (every card opens its drill-down) ─── */}
      {kpis && activeSlide !== 'Customer Intent' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-3">
          <KpiCard icon={Phone} label="Total Calls" value={kpis.totalCalls} color={BLUE} onClick={() => onDrill('kpi', 'all', 'All calls')} />
          <KpiCard icon={CheckCircle2} label="Avg Audit Score" value={`${kpis.avgAuditScore}%`} color={GREEN} onClick={() => onDrill('kpi', 'all', 'All calls — audit score')} />
          <KpiCard icon={Timer} label="Avg Call Duration" value={`${kpis.avgCallDurationMin.toFixed(1)} min`} color={SLATE} onClick={() => onDrill('kpi', 'all', 'All calls — duration')} />
          <KpiCard icon={IndianRupee} label="PTP Given" value={kpis.ptpGiven} sub={`${kpis.ptpGivenPct}% of total calls`} color={AMBER} onClick={() => onDrill('kpi', 'ptp', 'PTP Given calls')} />
          <KpiCard icon={Wallet} label="Payment Done" value={kpis.paymentDone} sub={`${kpis.paymentDonePct}% of total calls`} color={GREEN} onClick={() => onDrill('kpi', 'payment', 'Payment Done calls')} />
          <KpiCard icon={AlertTriangle} label="Non-Compliance" value={`${kpis.nonCompliancePct}%`} sub="of total parameters" color={RED} onClick={() => onDrill('kpi', 'nonCompliant', 'Calls with a non-compliance')} />
          {'totalAgents' in kpis
            ? <KpiCard icon={Users} label="Total Agents" value={(kpis as Kpis & { totalAgents: number }).totalAgents} color={BLUE} />
            : <KpiCard icon={Users} label="Unique Customers" value={kpis.uniqueCustomers} sub="repeat calls" color={BLUE} onClick={() => onDrill('kpi', 'all', 'All customers')} />}
          <KpiCard icon={Star} label="Customer Satisfaction" value={`${kpis.customerSatisfaction} / 5`} color={AMBER} onClick={() => onDrill('kpi', 'all', 'All calls — sentiment')} />
        </div>
      )}

      {loading && !kpis ? <LoadingState /> : (
        <>
          {activeSlide === 'Customer Intent' && intentData && <IntentSlide data={intentData} onDrill={onDrill} />}
          {activeSlide === 'Overview' && overview && <OverviewSlide data={overview} onDrill={onDrill} />}
          {activeSlide === 'Scenario Analysis' && scenarioData && <ScenarioAnalysisSlide data={scenarioData} onDrill={onDrill} />}
          {activeSlide === 'Agent Performance' && agentData && <AgentPerformanceSlide data={agentData} onDrill={onDrill} />}
          {activeSlide === 'Quality & Insights' && insightsData && <QualityInsightsSlide data={insightsData} onDrill={onDrill} />}
        </>
      )}

      {drill && <DrillModal sel={drill} qs={qs} onClose={closeDrill} />}
    </div>
  );
}

// ─── Slide 1: Overview ──────────────────────────────────────────────────────
function OverviewSlide({ data, onDrill }: { data: OverviewData; onDrill: OnDrill }) {
  const onWeek = (s: { activeLabel?: string | number } | null | undefined) => {
    if (s?.activeLabel != null) onDrill('week', String(s.activeLabel), `Week: ${s.activeLabel}`);
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="Call Outcomes Distribution" hint>
          <DonutWidget data={data.callOutcomeDistribution} centerLabel="Total Calls" onSliceClick={n => onDrill('outcome', n, `Outcome: ${n}`)} />
        </Panel>
        <Panel title="Key Trends (weekly)" icon={TrendingUp} hint>
          {data.weeklyTrends.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={data.weeklyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} onClick={onWeek}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fill: '#334155', fontSize: 8 }} tickFormatter={(v: string) => v.split(' ').slice(0, 2).join(' ')} />
                <YAxis tick={{ fill: '#64748B', fontSize: 9 }} />
                <Tooltip contentStyle={TT} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="totalCalls" name="Total Calls" fill={BLUE} radius={[4, 4, 0, 0]} cursor="pointer" />
                <Bar dataKey="ptpGiven" name="PTP Given" fill={AMBER} radius={[4, 4, 0, 0]} cursor="pointer" />
                <Bar dataKey="paymentDone" name="Payment Done" fill={GREEN} radius={[4, 4, 0, 0]} cursor="pointer" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
        <Panel title="Scenario Wise Call Distribution" hint>
          {data.scenarioDistribution.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={data.scenarioDistribution} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                onClick={s => { if (s?.activeLabel != null) onDrill('scenario', String(s.activeLabel), `Scenario: ${s.activeLabel}`); }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#64748B', fontSize: 9 }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fill: '#334155', fontSize: 8 }} />
                <Tooltip contentStyle={TT} />
                <Bar dataKey="count" fill={BLUE} radius={[0, 4, 4, 0]} cursor="pointer" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="Customer Sentiment" hint><DonutWidget data={data.customerSentiment} centerLabel="Total Calls" onSliceClick={n => onDrill('sentiment', n, `Sentiment: ${n}`)} /></Panel>
        <Panel title="Frustration Level" hint><DonutWidget data={data.frustrationLevel} centerLabel="Total Calls" onSliceClick={n => onDrill('frustration', n, `Frustration: ${n}`)} /></Panel>
        <Panel title="Abusive Calls" icon={ShieldAlert} accent={RED} hint>
          <DonutWidget data={[{ name: 'Abusive', count: data.abusiveCalls.abusive }, { name: 'Non-Abusive', count: data.abusiveCalls.nonAbusive }]} centerLabel="Calls"
            onSliceClick={n => onDrill('abusive', n, n === 'Abusive' ? 'Abusive calls' : 'Non-abusive calls')} />
        </Panel>
      </div>
    </div>
  );
}

// ─── Slide 2: Scenario Analysis ─────────────────────────────────────────────
function ScenarioAnalysisSlide({ data, onDrill }: { data: ScenarioAnalysisData; onDrill: OnDrill }) {
  const scen = (name: string) => onDrill('scenario', name, `Scenario: ${name}`);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="Scenario Distribution" hint><DonutWidget data={data.scenarioDistribution} centerLabel="Total Calls" onSliceClick={scen} /></Panel>
        <Panel title="Scenario Trend (weekly)" icon={TrendingUp} hint>
          {data.scenarioTrendWeekly.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={data.scenarioTrendWeekly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                onClick={s => { if (s?.activeLabel != null) onDrill('week', String(s.activeLabel), `Week: ${s.activeLabel}`); }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fill: '#334155', fontSize: 7 }} />
                <YAxis tick={{ fill: '#64748B', fontSize: 9 }} />
                <Tooltip contentStyle={TT} />
                <Legend wrapperStyle={{ fontSize: 9 }} />
                {data.topScenariosForTrend.map((s, i) => (
                  <Line key={s} type="monotone" dataKey={s} stroke={DONUT_COLORS[i % DONUT_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </Panel>
        <Panel title="Scenario vs Call Outcome" icon={ListChecks} hint>
          <div className="overflow-auto max-h-60 -mx-1">
            <table className="w-full text-[11px] border-separate border-spacing-0">
              <thead><tr className="text-slate-400 uppercase text-left text-[9.5px] tracking-wider"><th className="pb-2 px-1 font-bold">Scenario</th><th className="pb-2 px-1 font-bold text-right">Calls</th></tr></thead>
              <tbody>
                {data.scenarioVsOutcome.map((s, i) => (
                  <tr key={s.scenario} onClick={() => scen(s.scenario)} className={`${i % 2 === 1 ? 'bg-slate-50/60' : ''} cursor-pointer hover:bg-blue-50/60`}>
                    <td className="py-1.5 px-1 rounded-l-lg text-slate-700 font-semibold">{s.scenario}</td>
                    <td className="py-1.5 px-1 rounded-r-lg text-right font-extrabold text-blue-700">{s.callCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="Average Call Duration by Scenario" hint>
          <BarList items={data.avgDurationByScenario.map(s => ({ label: s.scenario, value: s.avgDurationMin }))} unit=" min" onItemClick={i => scen(i.label)} />
        </Panel>
        <Panel title="Audit Score by Scenario" hint>
          <BarList items={data.auditScoreByScenario.map(s => ({ label: s.scenario, value: s.auditScorePct }))} barColor={scoreColor} onItemClick={i => scen(i.label)} />
        </Panel>
        <Panel title="Customer Sentiment by Scenario" hint>
          <div className="flex flex-col gap-2 max-h-60 overflow-auto">
            {data.sentimentByScenario.map(s => (
              <button key={s.scenario} type="button" onClick={() => scen(s.scenario)} className="text-left rounded-lg px-1 -mx-1 py-0.5 hover:bg-slate-50">
                <div className="text-[10.5px] font-semibold text-slate-600 mb-1 truncate">{s.scenario}</div>
                <div className="h-2.5 rounded-full overflow-hidden flex bg-slate-100 ring-1 ring-slate-100">
                  <div style={{ width: `${s.positive}%`, background: GREEN }} title={`Positive ${s.positive}%`} />
                  <div style={{ width: `${s.neutral}%`, background: AMBER }} title={`Neutral ${s.neutral}%`} />
                  <div style={{ width: `${s.negative}%`, background: RED }} title={`Negative ${s.negative}%`} />
                </div>
              </button>
            ))}
          </div>
        </Panel>
      </div>
      <Panel title="Frustration &amp; Abusive Behavior" icon={Frown} accent={AMBER} hint>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="grid grid-cols-2 gap-3">
            <KpiCard icon={Frown} label="Frustration Detected" value={data.frustration.frustrationDetected} sub={`${data.frustration.frustrationDetectedPct}% of total calls`} color={AMBER}
              onClick={() => onDrill('kpi', 'frustrationDetected', 'Frustration detected')} />
            <KpiCard icon={AlertTriangle} label="High Frustration" value={data.frustration.highFrustration} sub={`${data.frustration.highFrustrationPct}% of total calls`} color={RED}
              onClick={() => onDrill('kpi', 'highFrustration', 'High frustration calls')} />
            <KpiCard icon={ShieldAlert} label="Customer Abusing" value={data.frustration.customerAbusing} sub={`${data.frustration.customerAbusingPct}% of total calls`} color={RED}
              onClick={() => onDrill('kpi', 'abusing', 'Customer abusing calls')} />
            <KpiCard icon={ListChecks} label="Top Non-Compliance Scenario" value={data.top5ScenariosByNonCompliance[0]?.scenario ?? '—'} sub={data.top5ScenariosByNonCompliance[0] ? `${data.top5ScenariosByNonCompliance[0].nonCompliancePct}% non-compliant` : ''} color={BLUE}
              onClick={data.top5ScenariosByNonCompliance[0] ? () => scen(data.top5ScenariosByNonCompliance[0].scenario) : undefined} />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2 block">Top Abusive / Frustrated Sentences</span>
            {data.topAbusiveSentences.length === 0 ? <EmptyState label="No abusive/frustrated sentences found." /> : (
              <div className="flex flex-col gap-1.5 max-h-40 overflow-auto pr-1">
                {data.topAbusiveSentences.map((s, i) => (
                  <button key={i} type="button" onClick={() => onDrill('call', s.callId, `Call ${s.callId}`)}
                    className="text-left text-[11px] text-red-700 bg-red-50/80 ring-1 ring-red-100 rounded-lg px-3 py-2 italic font-medium hover:ring-red-300 transition">
                    "{s.sentence.replace(/^Customer:\s*/, '')}"
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </Panel>
      <Panel title="Top 5 Scenarios by Non-Compliance" icon={ShieldAlert} accent={RED} hint>
        <BarList items={data.top5ScenariosByNonCompliance.map(s => ({ label: s.scenario, value: s.nonCompliancePct }))} barColor={v => v > 15 ? RED : v > 5 ? AMBER : GREEN} onItemClick={i => scen(i.label)} />
      </Panel>
    </div>
  );
}

// Small rounded-pill score badge — used across the agent table wherever a percentage is a graded metric.
function ScoreBadge({ pct }: { pct: number }) {
  const color = scoreColor(pct);
  return (
    <span className="inline-flex items-center justify-center min-w-[52px] px-2 py-1 rounded-full text-[11px] font-extrabold"
      style={{ color, background: hexToRgba(color, 0.12) }}>
      {pct}%
    </span>
  );
}
const RANK_STYLE = [
  { bg: 'linear-gradient(135deg,#FBBF24,#F59E0B)', icon: Trophy },
  { bg: 'linear-gradient(135deg,#CBD5E1,#94A3B8)', icon: Medal },
  { bg: 'linear-gradient(135deg,#D9A066,#B4753E)', icon: Award },
];
function RankBadge({ rank }: { rank: number }) {
  const style = RANK_STYLE[rank - 1];
  if (!style) {
    return <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-400 bg-slate-100">{rank}</span>;
  }
  const Icon = style.icon;
  return (
    <span className="w-6 h-6 rounded-full flex items-center justify-center shadow-sm" style={{ background: style.bg }}>
      <Icon size={12} className="text-white" strokeWidth={2.5} />
    </span>
  );
}

// Agent-wise Parameters Score — each cell opens the calls where that agent failed that parameter.
function AgentParameterScoreTable({ data, onDrill }: { data: AgentPerformanceData; onDrill: OnDrill }) {
  const weakestOf = (a: AgentRow) => {
    const entries = data.parameterColumns.map(p => ({ label: p.label, value: a.paramScores[p.key] ?? 0 }));
    return entries.reduce((min, e) => (e.value < min.value ? e : min), entries[0]);
  };
  return (
    <Panel title="Agent-wise Parameters Score" icon={ListChecks} hint>
      {data.agentTable.length === 0 || data.parameterColumns.length === 0 ? <EmptyState /> : (
        <div className="overflow-auto -mx-1">
          <table className="text-[11px] border-separate border-spacing-0">
            <thead>
              <tr className="text-slate-400 uppercase text-left text-[9px] tracking-wider">
                <th className="py-2 px-2 font-bold sticky left-0 bg-white z-10">Agent Name</th>
                {data.parameterColumns.map(p => (
                  <th key={p.key} className="py-2 px-2 font-bold text-center whitespace-nowrap">{p.label}</th>
                ))}
                <th className="py-2 px-2 font-bold text-left whitespace-nowrap">Weakest Parameter</th>
              </tr>
            </thead>
            <tbody>
              {data.agentTable.map((a, i) => {
                const weakest = weakestOf(a);
                return (
                  <tr key={a.agentName} className={i % 2 === 1 ? 'bg-slate-50/60' : ''}>
                    <td className={`py-1.5 px-2 font-bold text-slate-700 whitespace-nowrap sticky left-0 z-10 cursor-pointer hover:text-blue-700 ${i % 2 === 1 ? 'bg-slate-50' : 'bg-white'}`}
                      onClick={() => onDrill('agent', a.agentName, `Agent: ${a.agentName}`)}>{a.agentName}</td>
                    {data.parameterColumns.map(p => {
                      const v = a.paramScores[p.key] ?? 0;
                      const c = heatColor(v);
                      return (
                        <td key={p.key} className="py-1.5 px-2 text-center">
                          <button type="button" title={`${a.agentName} — ${p.label}: failed calls`}
                            onClick={() => onDrill('agentParam', `${a.agentName}|${p.key}`, `${a.agentName} · ${p.label}`)}
                            className="inline-block min-w-[38px] px-1.5 py-0.5 rounded-md font-extrabold hover:ring-2 hover:ring-blue-300 transition"
                            style={{ color: c.text, background: c.bg }}>{v}%</button>
                        </td>
                      );
                    })}
                    <td className="py-1.5 px-2 whitespace-nowrap">
                      <span className="text-red-600 font-semibold">{weakest.label}</span>
                      <span className="text-slate-400"> ({weakest.value}%)</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

// ─── Slide 3: Agent Performance ─────────────────────────────────────────────
function AgentPerformanceSlide({ data, onDrill }: { data: AgentPerformanceData; onDrill: OnDrill }) {
  const agent = (name: string) => onDrill('agent', name, `Agent: ${name}`);
  const onAgentClick = (s: { activeLabel?: string | number } | null | undefined) => {
    if (s?.activeLabel != null) agent(String(s.activeLabel));
  };
  return (
    <div className="flex flex-col gap-4">
      <Panel title="Agent Performance Overview" icon={Users} hint>
        <div className="overflow-auto -mx-1">
          <table className="w-full text-[11.5px] border-separate border-spacing-0">
            <thead>
              <tr className="text-slate-400 uppercase text-left text-[9.5px] tracking-wider">
                <th className="py-2 px-1 font-bold">Rank</th><th className="py-2 px-2 font-bold">Agent Name</th>
                <th className="py-2 px-2 font-bold text-right">Total Calls</th><th className="py-2 px-2 font-bold text-right">Duration</th>
                <th className="py-2 px-2 font-bold text-right">Audit Score</th><th className="py-2 px-2 font-bold text-right">PTP Given</th>
                <th className="py-2 px-2 font-bold text-right">Payment Done</th><th className="py-2 px-1 font-bold text-right">Compliance</th>
              </tr>
            </thead>
            <tbody>
              {data.agentTable.map((a, i) => (
                <tr key={a.agentName} onClick={() => agent(a.agentName)}
                  className={`${i % 2 === 1 ? 'bg-slate-50/60' : ''} hover:bg-blue-50/60 cursor-pointer transition-colors`}>
                  <td className="py-2 px-1 rounded-l-lg"><RankBadge rank={i + 1} /></td>
                  <td className="py-2 px-2 font-bold text-slate-700">{a.agentName}</td>
                  <td className="py-2 px-2 text-right text-slate-600 font-medium">{a.totalCalls}</td>
                  <td className="py-2 px-2 text-right text-slate-600 font-medium">{a.avgDurationMin.toFixed(1)} min</td>
                  <td className="py-2 px-2 text-right"><ScoreBadge pct={a.auditScorePct} /></td>
                  <td className="py-2 px-2 text-right text-slate-600 font-medium">{a.ptpGiven}</td>
                  <td className="py-2 px-2 text-right text-slate-600 font-medium">{a.paymentDone}</td>
                  <td className="py-2 px-1 text-right rounded-r-lg"><ScoreBadge pct={a.compliancePct} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <AgentParameterScoreTable data={data} onDrill={onDrill} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Agent Wise Call Volume" hint>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.agentTable} margin={{ top: 10, right: 10, left: -20, bottom: 30 }} onClick={onAgentClick}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="agentName" tick={{ fill: '#334155', fontSize: 8 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#64748B', fontSize: 9 }} />
              <Tooltip contentStyle={TT} />
              <Bar dataKey="totalCalls" name="Total Calls" fill={BLUE} radius={[4, 4, 0, 0]} cursor="pointer" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Agent Wise Audit Score &amp; Compliance Rate" hint>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.agentTable} margin={{ top: 10, right: 10, left: -20, bottom: 30 }} onClick={onAgentClick}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="agentName" tick={{ fill: '#334155', fontSize: 8 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#64748B', fontSize: 9 }} domain={[0, 100]} />
              <Tooltip contentStyle={TT} />
              <Legend wrapperStyle={{ fontSize: 9 }} />
              <Bar dataKey="auditScorePct" name="Audit Score %" fill={GREEN} radius={[4, 4, 0, 0]} cursor="pointer" />
              <Bar dataKey="compliancePct" name="Compliance %" fill={AMBER} radius={[4, 4, 0, 0]} cursor="pointer" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="PTP &amp; Payment Performance by Agent" hint>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.agentTable} margin={{ top: 10, right: 10, left: -20, bottom: 30 }} onClick={onAgentClick}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="agentName" tick={{ fill: '#334155', fontSize: 7 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#64748B', fontSize: 9 }} />
              <Tooltip contentStyle={TT} />
              <Legend wrapperStyle={{ fontSize: 9 }} />
              <Bar dataKey="ptpGiven" name="PTP Given" fill={AMBER} radius={[4, 4, 0, 0]} cursor="pointer" />
              <Bar dataKey="paymentDone" name="Payment Done" fill={GREEN} radius={[4, 4, 0, 0]} cursor="pointer" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Collection Effectiveness by Agent (Demo)" icon={IndianRupee} accent={GREEN} hint>
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
              Total (Demo) ₹{data.collectionEffectiveness.totalDemoAmount.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-slate-50 text-slate-500 ring-1 ring-slate-100">
              Avg PTP Amount (Demo) ₹{data.collectionEffectiveness.avgDemoAmount.toLocaleString('en-IN')}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={data.agentTable} margin={{ top: 10, right: 10, left: -10, bottom: 30 }} onClick={onAgentClick}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="agentName" tick={{ fill: '#334155', fontSize: 7 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#64748B', fontSize: 9 }} />
              <Tooltip contentStyle={TT} formatter={(v) => `₹${Number(v).toLocaleString('en-IN')}`} />
              <Bar dataKey="demoCollectionAmount" name="Collection (Demo)" fill={GREEN} radius={[4, 4, 0, 0]} cursor="pointer" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Average Call Duration by Agent" hint>
          <BarList items={data.agentTable.map(a => ({ label: a.agentName, value: a.avgDurationMin }))} unit=" min" onItemClick={i => agent(i.label)} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="Agent Quality Matrix" className="lg:col-span-1" hint>
          <ResponsiveContainer width="100%" height={220}>
            <ScatterChart margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis type="number" dataKey="avgDurationMin" name="Avg Duration (min)" tick={{ fill: '#64748B', fontSize: 9 }} />
              <YAxis type="number" dataKey="auditScorePct" name="Audit Score %" tick={{ fill: '#64748B', fontSize: 9 }} domain={[0, 100]} />
              <ZAxis type="number" dataKey="totalCalls" range={[60, 400]} name="Total Calls" />
              <Tooltip contentStyle={TT} cursor={{ strokeDasharray: '3 3' }} formatter={(v, n) => [n === 'Avg Duration (min)' ? `${v} min` : v, n]} />
              <Scatter data={data.qualityMatrix} fill={BLUE} fillOpacity={0.7} cursor="pointer"
                onClick={(d: { payload?: { agentName?: string } }) => { if (d?.payload?.agentName) agent(d.payload.agentName); }} />
            </ScatterChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Top 5 Agents by Collection Amount (Demo)" hint>
          <BarList items={data.top5ByCollectionAmount.map(a => ({ label: a.agentName, value: a.demoCollectionAmount }))} unit="" barColor={() => GREEN} onItemClick={i => agent(i.label)} />
        </Panel>
        <Panel title="Bottom 5 Agents by Audit Score" hint>
          <BarList items={data.bottom5ByAuditScore.map(a => ({ label: a.agentName, value: a.auditScorePct }))} barColor={scoreColor} onItemClick={i => agent(i.label)} />
        </Panel>
      </div>
    </div>
  );
}

// ─── Slide 4: Quality & Insights ─────────────────────────────────────────────
function QualityInsightsSlide({ data, onDrill }: { data: QualityInsightsData; onDrill: OnDrill }) {
  const weekClick = (s: { activeLabel?: string | number } | null | undefined) => {
    if (s?.activeLabel != null) onDrill('week', String(s.activeLabel), `Week: ${s.activeLabel}`);
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Panel title="Overall Quality Score" className="lg:col-span-1" accent={scoreColor(data.overallQualityScore)}>
          <div className="flex flex-col items-center justify-center gap-2 h-full py-2">
            <div className="relative">
              <svg width="128" height="128" viewBox="0 0 128 128" className="drop-shadow-sm">
                <circle cx="64" cy="64" r="54" fill="none" stroke="#eef2f1" strokeWidth="13" />
                <circle cx="64" cy="64" r="54" fill="none" stroke={scoreColor(data.overallQualityScore)} strokeWidth="13" strokeLinecap="round"
                  strokeDasharray={`${(data.overallQualityScore / 100) * 339.3} 339.3`} transform="rotate(-90 64 64)" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-extrabold text-slate-800 tracking-tight">{data.overallQualityScore}%</span>
              </div>
            </div>
            <button type="button" onClick={() => onDrill('kpi', 'all', 'All calls — overall quality')}
              className="text-[11px] font-extrabold px-3 py-1 rounded-full hover:ring-2 hover:ring-slate-300 transition"
              style={{ color: scoreColor(data.overallQualityScore), background: hexToRgba(scoreColor(data.overallQualityScore), 0.12) }}>
              {data.qualityGrade}
            </button>
          </div>
        </Panel>
        <Panel title="Audit Parameter Scorecard" className="lg:col-span-1" hint>
          <div className="max-h-64 overflow-auto pr-1">
            <BarList items={data.parameterScorecard.map(p => ({ label: p.label, value: p.passRatePct, key: p.key }))} barColor={scoreColor}
              onItemClick={i => { if (i.key) onDrill('param', i.key, `Failed: ${i.label}`); }} />
          </div>
        </Panel>
        <Panel title="Compliance vs Non-Compliance" className="lg:col-span-1" icon={ShieldAlert} accent={GREEN} hint>
          <DonutWidget data={[{ name: 'Compliant', count: data.compliance.compliant }, { name: 'Non-Compliant', count: data.compliance.nonCompliant }]} centerLabel="Parameters"
            onSliceClick={n => onDrill('compliance', n === 'Non-Compliant' ? 'nonCompliant' : 'compliant', n === 'Non-Compliant' ? 'Calls with a non-compliance' : 'Fully compliant calls')} />
        </Panel>
        <Panel title="Customer Behavior" className="lg:col-span-1" hint>
          <DonutWidget data={data.customerBehavior} centerLabel="Calls" onSliceClick={n => onDrill('sentiment', n, `Sentiment: ${n}`)} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Sentiment Trend (weekly)" hint>
          {data.sentimentTrendWeekly.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.sentimentTrendWeekly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} onClick={weekClick}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fill: '#334155', fontSize: 7 }} />
                <YAxis tick={{ fill: '#64748B', fontSize: 9 }} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip contentStyle={TT} />
                <Legend wrapperStyle={{ fontSize: 9 }} />
                <Line type="monotone" dataKey="positivePct" name="Positive" stroke={GREEN} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="neutralPct" name="Neutral" stroke={AMBER} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="negativePct" name="Negative" stroke={RED} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Panel>
        <Panel title="Frustration Trend (weekly)" hint>
          {data.frustrationTrendWeekly.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.frustrationTrendWeekly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} onClick={weekClick}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fill: '#334155', fontSize: 7 }} />
                <YAxis tick={{ fill: '#64748B', fontSize: 9 }} />
                <Tooltip contentStyle={TT} />
                <Legend wrapperStyle={{ fontSize: 9 }} />
                <Line type="monotone" dataKey="high" name="High" stroke={RED} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="medium" name="Medium" stroke={AMBER} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="low" name="Low" stroke={GREEN} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Panel>
        <Panel title="Abusive Calls Trend (weekly)" hint>
          {data.abusiveCallsTrendWeekly.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.abusiveCallsTrendWeekly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} onClick={weekClick}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fill: '#334155', fontSize: 7 }} />
                <YAxis tick={{ fill: '#64748B', fontSize: 9 }} allowDecimals={false} />
                <Tooltip contentStyle={TT} />
                <Bar dataKey="count" name="Abusive Calls" fill={RED} radius={[4, 4, 0, 0]} cursor="pointer" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
        <Panel title="Average Audit Score Trend (weekly)" hint>
          {data.avgAuditScoreTrendWeekly.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.avgAuditScoreTrendWeekly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} onClick={weekClick}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fill: '#334155', fontSize: 7 }} />
                <YAxis tick={{ fill: '#64748B', fontSize: 9 }} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip contentStyle={TT} />
                <Line type="monotone" dataKey="auditScorePct" name="Audit Score %" stroke={BLUE} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="Top 5 Issues / Root Causes (from Audit)" icon={AlertTriangle} accent={RED} hint>
          <BarList items={data.topIssues.map(i => ({ label: i.issue, value: i.count, key: i.key }))} unit="" barColor={() => RED}
            onItemClick={i => { if (i.key) onDrill('param', i.key, `Failed: ${i.label}`); }} />
        </Panel>
        <Panel title="Top Frustrated Customer Reasons" icon={Frown} accent={AMBER} hint>
          <BarList items={data.topFrustratedReasons.map(r => ({ label: r.reason, value: r.pct }))} barColor={() => AMBER}
            onItemClick={i => onDrill('frustratedScenario', i.label, `Frustrated · ${i.label}`)} />
        </Panel>
        <Panel title="Examples of Abusive / Frustrated Sentences" icon={ShieldAlert} accent={RED} hint>
          {data.abusiveExamples.length === 0 ? <EmptyState label="No abusive/frustrated sentences found." /> : (
            <div className="flex flex-col gap-1.5 max-h-52 overflow-auto pr-1">
              {data.abusiveExamples.map((s, i) => (
                <button key={i} type="button" onClick={() => onDrill('call', s.callId, `Call ${s.callId}`)}
                  className="text-left text-[11px] text-red-700 bg-red-50/80 ring-1 ring-red-100 rounded-lg px-3 py-2 italic font-medium hover:ring-red-300 transition">
                  "{s.sentence.replace(/^Customer:\s*/, '')}"
                </button>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Key Insights &amp; Recommendations" icon={Lightbulb} accent={VIOLET}>
        {data.keyInsights.length === 0 ? <EmptyState /> : (
          <ol className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {data.keyInsights.map((insight, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[12px] text-slate-700 leading-snug bg-violet-50/50 ring-1 ring-violet-100 rounded-xl px-3 py-2.5">
                <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-[10px] font-extrabold flex items-center justify-center shrink-0 mt-0.5 shadow-sm">{i + 1}</span>
                {insight}
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}

// ─── Customer Intent (front slide) ───────────────────────────────────────────
// Mirrors the "Quality & Insights" dashboard layout: intent KPI strip, intent/payability/payment
// donuts, weekly sentiment trend, non-actionable and neutral reasons, payment funnel, call
// disposition summary, top agents by conversion, and key insights. Every widget drills into the calls
// behind it.
function IntentSlide({ data, onDrill }: { data: IntentData; onDrill: OnDrill }) {
  const k = data.kpis;
  const genuineVal = (name: string) => (name === 'Genuine / Payable' ? 'Yes' : 'No');
  const funnelColors = ['#1565C0', '#0891B2', '#22b990', '#eea12b', '#e8607d'];
  const maxFunnel = Math.max(...data.funnel.map(f => f.count), 1);

  return (
    <div className="flex flex-col gap-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-3">
        <KpiCard icon={Phone} label="Total Calls" value={k.totalCalls} color={BLUE} onClick={() => onDrill('funnel', 'total', 'All calls')} />
        <KpiCard icon={Users} label="Genuine Customers" value={k.genuineCustomers} sub={`${k.genuinePct}% of total calls`} color={GREEN}
          onClick={() => onDrill('genuine', 'Yes', 'Genuine customers')} />
        <KpiCard icon={Ban} label="Non-Actionable" value={k.nonActionable} sub={`${k.nonActionablePct}% of total calls`} color={RED}
          onClick={() => onDrill('genuine', 'No', 'Non-actionable calls')} />
        <KpiCard icon={ThumbsUp} label="Positive Intent" value={k.positiveIntent} sub={`${k.positiveIntentPct}% want to pay`} color={GREEN}
          onClick={() => onDrill('intent', 'Positive', 'Positive intent')} />
        <KpiCard icon={Meh} label="Neutral Intent" value={k.neutralIntent} sub={`${k.neutralIntentPct}% wants to pay (with reasons)`} color={AMBER}
          onClick={() => onDrill('intent', 'Neutral', 'Neutral intent')} />
        <KpiCard icon={ThumbsDown} label="Negative Intent" value={k.negativeIntent} sub={`${k.negativeIntentPct}% no intent to pay`} color={RED}
          onClick={() => onDrill('intent', 'Negative', 'Negative intent')} />
        <KpiCard icon={Wallet} label="Payment Done" value={k.paymentDone} sub={`${k.paymentDonePct}% of total calls`} color={GREEN}
          onClick={() => onDrill('funnel', 'paid', 'Payment Done')} />
        <KpiCard icon={IndianRupee} label="PTP Given" value={k.ptpGiven} sub={`${k.ptpGivenPct}% of total calls`} color={AMBER}
          onClick={() => onDrill('funnel', 'ptp', 'PTP Given')} />
        <KpiCard icon={PhoneCall} label="Need to Call" value={k.needToCall} sub={`${k.needToCallPct}% follow-up required`} color={VIOLET}
          onClick={() => onDrill('needCall', 'Need to call', 'Calls that need a follow-up call')} />
      </div>

      {/* Row 1: intent, genuine, payment outcome, QA sentiment */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Panel title="Customer Intent Distribution" hint>
          <DonutWidget data={data.intentDistribution} centerLabel="Total Calls" onSliceClick={n => onDrill('intent', n, `Intent: ${n}`)} />
        </Panel>
        <Panel title="Genuine vs Non-Actionable" hint>
          <DonutWidget data={data.genuineDistribution} centerLabel="Total Calls" onSliceClick={n => onDrill('genuine', genuineVal(n), n)} />
        </Panel>
        <Panel title="Payment Outcome (Genuine)" hint>
          <DonutWidget data={data.payOutcomeDistribution} centerLabel="Genuine Calls" onSliceClick={n => onDrill('payOutcome', n, `Genuine · ${n}`)} />
        </Panel>
        <Panel title="Customer Sentiment (QA)" hint>
          <DonutWidget data={data.qaSentimentDistribution} centerLabel="Total Calls" onSliceClick={n => onDrill('qaStatement', n, `Sentiment: ${n}`)} />
        </Panel>
      </div>

      {/* Row 2: trend + reasons */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel title="Sentiment Trend (weekly)" icon={TrendingUp} hint>
          {data.sentimentTrendWeekly.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={data.sentimentTrendWeekly} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}
                onClick={s => { if (s?.activeLabel != null) onDrill('week', String(s.activeLabel), `Week: ${s.activeLabel}`); }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fill: '#334155', fontSize: 8 }} tickFormatter={(v: string) => v.split(' (')[0]} />
                <YAxis tick={{ fill: '#64748B', fontSize: 9 }} allowDecimals={false} />
                <Tooltip contentStyle={TT} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {data.sentimentStatements.map((st, i) => (
                  <Line key={st} type="monotone" dataKey={st} stroke={[GREEN, BLUE, AMBER, '#F97316', RED][i % 5]} strokeWidth={2} dot={{ r: 3 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </Panel>
        <Panel title={`Reasons for Non-Actionable Calls (${k.nonActionable})`} icon={Ban} accent={RED} hint>
          <BarList items={data.nonActionableReasons.map(r => ({ label: r.name, value: r.count }))} unit="" barColor={() => RED}
            onItemClick={i => onDrill('nonActionableReason', i.label, `Non-actionable · ${i.label}`)} />
        </Panel>
        <Panel title={`Reasons for Neutral Intent (${k.neutralIntent})`} icon={Meh} accent={AMBER} hint>
          <BarList items={data.neutralReasons.map(r => ({ label: r.name, value: r.count }))} unit="" barColor={() => AMBER}
            onItemClick={i => onDrill('neutralOutcome', i.label, `Neutral · ${i.label}`)} />
        </Panel>
      </div>

      {/* Row 3: funnel, disposition, agents, insights */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <Panel title="Payment Funnel" icon={Wallet} accent={GREEN} hint>
          <div className="flex flex-col gap-2">
            {data.funnel.map((f, i) => {
              const width = Math.max(35, (f.count / maxFunnel) * 100);
              return (
                <button key={f.stage} type="button" onClick={() => onDrill('funnel', f.stage, f.label)}
                  className="group text-left flex items-center gap-2 hover:opacity-90">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-[10.5px] font-semibold text-slate-600 mb-0.5">
                      <span className="truncate">{f.label}</span>
                      <span className="font-extrabold text-slate-700 shrink-0">{f.count} <span className="text-slate-400 font-semibold">({f.pct}%)</span></span>
                    </div>
                    <div className="h-6 rounded-md bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-md transition-all group-hover:brightness-110" style={{ width: `${width}%`, background: `linear-gradient(90deg, ${funnelColors[i % 5]}, ${hexToRgba(funnelColors[i % 5], 0.7)})` }} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Panel>
        <Panel title="Call Disposition Summary" icon={ListChecks} hint>
          <div className="overflow-auto max-h-80 -mx-1">
            <table className="w-full text-[11px] border-separate border-spacing-0">
              <thead className="sticky top-0 bg-white">
                <tr className="text-slate-400 uppercase text-left text-[9px] tracking-wider">
                  <th className="py-2 px-1 font-bold">Disposition</th><th className="py-2 px-1 font-bold text-right">Calls</th><th className="py-2 px-1 font-bold text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {data.disposition.map((d, i) => (
                  <tr key={d.name} onClick={() => onDrill('disposition', d.name, `Disposition: ${d.name}`)}
                    className={`${i % 2 === 1 ? 'bg-slate-50/60' : ''} hover:bg-blue-50/60 cursor-pointer`}>
                    <td className="py-1.5 px-1 font-semibold text-slate-700">
                      <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />{d.name}
                    </td>
                    <td className="py-1.5 px-1 text-right font-bold text-slate-700">{d.count}</td>
                    <td className="py-1.5 px-1 text-right text-slate-500">{d.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Top Agents by Conversion" icon={Trophy} accent={GREEN} hint>
          <div className="overflow-auto max-h-80 -mx-1">
            <table className="w-full text-[11px] border-separate border-spacing-0">
              <thead className="sticky top-0 bg-white">
                <tr className="text-slate-400 uppercase text-left text-[9px] tracking-wider">
                  <th className="py-2 px-1 font-bold">#</th><th className="py-2 px-1 font-bold">Agent</th>
                  <th className="py-2 px-1 font-bold text-right">Calls</th><th className="py-2 px-1 font-bold text-right">Genuine</th>
                  <th className="py-2 px-1 font-bold text-right">Paid</th><th className="py-2 px-1 font-bold text-right">PTP</th>
                  <th className="py-2 px-1 font-bold text-right">Conv.</th>
                </tr>
              </thead>
              <tbody>
                {data.agents.map((a, i) => (
                  <tr key={a.agentName} onClick={() => onDrill('agent', a.agentName, `Agent: ${a.agentName}`)}
                    className={`${i % 2 === 1 ? 'bg-slate-50/60' : ''} hover:bg-blue-50/60 cursor-pointer`}>
                    <td className="py-1.5 px-1"><RankBadge rank={i + 1} /></td>
                    <td className="py-1.5 px-1 font-bold text-slate-700 whitespace-nowrap">{a.agentName}</td>
                    <td className="py-1.5 px-1 text-right">{a.totalCalls}</td>
                    <td className="py-1.5 px-1 text-right">{a.genuine}</td>
                    <td className="py-1.5 px-1 text-right">{a.paymentDone}</td>
                    <td className="py-1.5 px-1 text-right">{a.ptpGiven}</td>
                    <td className="py-1.5 px-1 text-right"><ScoreBadge pct={a.conversionPct} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Key Insights" icon={Lightbulb} accent={VIOLET}>
          <ol className="flex flex-col gap-2">
            {data.insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[11.5px] text-slate-700 leading-snug">
                <span className="w-5 h-5 rounded-full text-white text-[10px] font-extrabold flex items-center justify-center shrink-0 mt-0.5 shadow-sm"
                  style={{ background: [BLUE, GREEN, AMBER, RED, VIOLET][i % 5] }}>{i + 1}</span>
                {insight}
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </div>
  );
}
