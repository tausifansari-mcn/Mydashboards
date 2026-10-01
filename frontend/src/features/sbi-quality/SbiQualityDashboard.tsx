import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
  ScatterChart, Scatter, ZAxis,
} from 'recharts';
import {
  Landmark, Phone, CheckCircle2, Timer, IndianRupee, Wallet, AlertTriangle,
  Users, Star, Loader2, ListChecks, TrendingUp, Frown, ShieldAlert, Lightbulb,
  Trophy, Medal, Award, Filter, CalendarRange, Inbox, Download,
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
// Continuous red -> amber -> green heatmap (rather than the 3-band scoreColor) — used for the dense
// agent x parameter grid, where a smooth gradient makes the weak spots easier to scan at a glance
// than hard color bands would.
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

// ─── Generic building blocks ────────────────────────────────────────────────
// Every card/panel in this dashboard shares the same "premium" surface treatment: a soft double
// shadow (crisp 1px edge + diffuse ambient blur) instead of a flat border, so panels read as
// physically lifted off the page rather than boxed-in — this one class string is reused everywhere
// so the whole page stays visually consistent.
const CARD = 'rounded-2xl bg-white ring-1 ring-slate-900/5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]';

function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: LucideIcon; label: string; value: React.ReactNode; sub?: string; color: string;
}) {
  return (
    <div className={`${CARD} p-3.5 flex flex-col gap-2 min-w-0 transition-shadow hover:shadow-[0_1px_2px_rgba(15,23,42,0.06),0_12px_28px_-10px_rgba(15,23,42,0.18)]`}>
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
          style={{ background: `linear-gradient(135deg, ${color}, ${hexToRgba(color, 0.75)})` }}>
          <Icon size={15} className="text-white" strokeWidth={2.25} />
        </div>
        <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 leading-tight">{label}</span>
      </div>
      <div className="text-2xl font-extrabold text-slate-800 tracking-tight truncate">{value}</div>
      {sub && <div className="text-[10px] text-slate-400 font-medium truncate">{sub}</div>}
    </div>
  );
}

function Panel({ title, icon: Icon, children, className = '', accent = BLUE }: {
  title: string; icon?: LucideIcon; children: React.ReactNode; className?: string; accent?: string;
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
      </div>
      <div className="p-4 flex-1 min-w-0">{children}</div>
    </div>
  );
}

function DonutWidget({ data, centerLabel }: { data: { name: string; count: number }[]; centerLabel: string }) {
  const total = data.reduce((a, d) => a + d.count, 0);
  if (!total) return <EmptyState />;
  return (
    <div className="flex flex-col lg:flex-row items-center gap-4">
      <div className="w-full lg:w-1/2 h-52 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={3} stroke="#fff" strokeWidth={2}>
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
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-2 truncate rounded-lg px-2 py-1.5" style={{ background: hexToRgba(DONUT_COLORS[i % DONUT_COLORS.length], 0.07) }}>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
            <span className="text-slate-600 font-medium truncate">{d.name}</span>
            <span className="ml-auto font-extrabold text-slate-700 shrink-0">{d.count} <span className="text-slate-400 font-semibold">({((d.count / total) * 100).toFixed(0)}%)</span></span>
          </div>
        ))}
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

function BarList({ items, unit = '%', barColor }: { items: { label: string; value: number }[]; unit?: string; barColor?: (v: number) => string }) {
  if (!items.length) return <EmptyState />;
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div className="flex flex-col gap-3">
      {items.map(i => {
        const color = barColor ? barColor(i.value) : BLUE;
        return (
          <div key={i.label}>
            <div className="flex items-center justify-between mb-1 gap-2">
              <span className="text-[11px] font-semibold text-slate-600 truncate">{i.label}</span>
              <span className="text-[10.5px] font-extrabold shrink-0 px-1.5 py-0.5 rounded-md" style={{ color, background: hexToRgba(color, 0.1) }}>{i.value}{unit}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (i.value / (unit === '%' ? 100 : max)) * 100)}%`, background: `linear-gradient(90deg, ${hexToRgba(color, 0.75)}, ${color})` }} />
            </div>
          </div>
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
  topIssues: { issue: string; count: number }[];
  topFrustratedReasons: { reason: string; count: number; pct: number }[];
  abusiveExamples: { sentence: string; callId: string }[];
  keyInsights: string[];
}
interface FilterOptions {
  buckets: string[]; agents: string[]; scenarios: string[]; callOutcomes: string[]; sentiments: string[]; frustrationLevels: string[];
}

const SLIDES = ['Overview', 'Scenario Analysis', 'Agent Performance', 'Quality & Insights'] as const;
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

export default function SbiQualityDashboard() {
  const now = new Date();
  const [startDate, setStartDate] = useState(toLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [endDate, setEndDate] = useState(toLocalDate(now));
  const [bucket, setBucket] = useState('All');
  const [agentName, setAgentName] = useState('All');
  const [scenario, setScenario] = useState('All');
  const [callOutcome, setCallOutcome] = useState('All');
  const [sentiment, setSentiment] = useState('All');
  const [frustrationLevel, setFrustrationLevel] = useState('All');
  const [activeSlide, setActiveSlide] = useState<Slide>('Overview');

  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [scenarioData, setScenarioData] = useState<ScenarioAnalysisData | null>(null);
  const [agentData, setAgentData] = useState<AgentPerformanceData | null>(null);
  const [insightsData, setInsightsData] = useState<QualityInsightsData | null>(null);
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
      'Overview': 'overview',
      'Scenario Analysis': 'scenario-analysis',
      'Agent Performance': 'agent-performance',
      'Quality & Insights': 'quality-insights',
    };
    api.get<{ success: boolean; data: unknown }>(`/sbi-quality/${endpointBySlide[activeSlide]}?${qs}`)
      .then(r => {
        const data = r.data?.data;
        if (activeSlide === 'Overview') setOverview(data as OverviewData);
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

  const kpis = overview?.kpis ?? scenarioData?.kpis ?? agentData?.kpis ?? insightsData?.kpis ?? null;

  const activeFilterCount = [bucket, agentName, scenario, callOutcome, sentiment, frustrationLevel].filter(v => v !== 'All').length;

  return (
    <div className="flex flex-col gap-5 pb-10">
      {/* ─── Header ─── */}
      <div className="rounded-2xl overflow-hidden shadow-[0_20px_50px_-20px_rgba(13,71,161,0.45)]">
        <div className="relative px-6 py-5 flex flex-wrap items-center gap-4 overflow-hidden"
          style={{ background: `linear-gradient(120deg, ${BLUE_DARK} 0%, ${BLUE} 55%, #1E88E5 100%)` }}>
          {/* subtle decorative glow — purely cosmetic, no data */}
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

      {/* ─── Shared KPI strip ─── */}
      {kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-3">
          <KpiCard icon={Phone} label="Total Calls" value={kpis.totalCalls} color={BLUE} />
          <KpiCard icon={CheckCircle2} label="Avg Audit Score" value={`${kpis.avgAuditScore}%`} color={GREEN} />
          <KpiCard icon={Timer} label="Avg Call Duration" value={`${kpis.avgCallDurationMin.toFixed(1)} min`} color={SLATE} />
          <KpiCard icon={IndianRupee} label="PTP Given" value={kpis.ptpGiven} sub={`${kpis.ptpGivenPct}% of total calls`} color={AMBER} />
          <KpiCard icon={Wallet} label="Payment Done" value={kpis.paymentDone} sub={`${kpis.paymentDonePct}% of total calls`} color={GREEN} />
          <KpiCard icon={AlertTriangle} label="Non-Compliance" value={`${kpis.nonCompliancePct}%`} sub="of total parameters" color={RED} />
          {'totalAgents' in kpis
            ? <KpiCard icon={Users} label="Total Agents" value={(kpis as Kpis & { totalAgents: number }).totalAgents} color={BLUE} />
            : <KpiCard icon={Users} label="Unique Customers" value={kpis.uniqueCustomers} sub="repeat calls" color={BLUE} />}
          <KpiCard icon={Star} label="Customer Satisfaction" value={`${kpis.customerSatisfaction} / 5`} color={AMBER} />
        </div>
      )}

      {loading && !kpis ? <LoadingState /> : (
        <>
          {activeSlide === 'Overview' && overview && <OverviewSlide data={overview} />}
          {activeSlide === 'Scenario Analysis' && scenarioData && <ScenarioAnalysisSlide data={scenarioData} />}
          {activeSlide === 'Agent Performance' && agentData && <AgentPerformanceSlide data={agentData} />}
          {activeSlide === 'Quality & Insights' && insightsData && <QualityInsightsSlide data={insightsData} />}
        </>
      )}
    </div>
  );
}

// ─── Slide 1: Overview ──────────────────────────────────────────────────────
function OverviewSlide({ data }: { data: OverviewData }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="Call Outcomes Distribution">
          <DonutWidget data={data.callOutcomeDistribution} centerLabel="Total Calls" />
        </Panel>
        <Panel title="Key Trends (weekly)" icon={TrendingUp}>
          {data.weeklyTrends.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={data.weeklyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fill: '#334155', fontSize: 8 }} tickFormatter={(v: string) => v.split(' ')[0] + ' ' + v.split(' ')[1]} />
                <YAxis tick={{ fill: '#64748B', fontSize: 9 }} />
                <Tooltip contentStyle={TT} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="totalCalls" name="Total Calls" fill={BLUE} radius={[4, 4, 0, 0]} />
                <Bar dataKey="ptpGiven" name="PTP Given" fill={AMBER} radius={[4, 4, 0, 0]} />
                <Bar dataKey="paymentDone" name="Payment Done" fill={GREEN} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
        <Panel title="Scenario Wise Call Distribution">
          {data.scenarioDistribution.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={data.scenarioDistribution} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#64748B', fontSize: 9 }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fill: '#334155', fontSize: 8 }} />
                <Tooltip contentStyle={TT} />
                <Bar dataKey="count" fill={BLUE} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="Customer Sentiment"><DonutWidget data={data.customerSentiment} centerLabel="Total Calls" /></Panel>
        <Panel title="Frustration Level"><DonutWidget data={data.frustrationLevel} centerLabel="Total Calls" /></Panel>
        <Panel title="Abusive Calls" icon={ShieldAlert} accent={RED}>
          <DonutWidget data={[{ name: 'Abusive', count: data.abusiveCalls.abusive }, { name: 'Non-Abusive', count: data.abusiveCalls.nonAbusive }]} centerLabel="Calls" />
        </Panel>
      </div>
    </div>
  );
}

// ─── Slide 2: Scenario Analysis ─────────────────────────────────────────────
function ScenarioAnalysisSlide({ data }: { data: ScenarioAnalysisData }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="Scenario Distribution"><DonutWidget data={data.scenarioDistribution} centerLabel="Total Calls" /></Panel>
        <Panel title="Scenario Trend (weekly)" icon={TrendingUp}>
          {data.scenarioTrendWeekly.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={data.scenarioTrendWeekly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
        <Panel title="Scenario vs Call Outcome" icon={ListChecks}>
          <div className="overflow-auto max-h-60 -mx-1">
            <table className="w-full text-[11px] border-separate border-spacing-0">
              <thead><tr className="text-slate-400 uppercase text-left text-[9.5px] tracking-wider"><th className="pb-2 px-1 font-bold">Scenario</th><th className="pb-2 px-1 font-bold text-right">Calls</th></tr></thead>
              <tbody>
                {data.scenarioVsOutcome.map((s, i) => (
                  <tr key={s.scenario} className={i % 2 === 1 ? 'bg-slate-50/60' : ''}>
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
        <Panel title="Average Call Duration by Scenario">
          <BarList items={data.avgDurationByScenario.map(s => ({ label: s.scenario, value: s.avgDurationMin }))} unit=" min" />
        </Panel>
        <Panel title="Audit Score by Scenario">
          <BarList items={data.auditScoreByScenario.map(s => ({ label: s.scenario, value: s.auditScorePct }))} barColor={scoreColor} />
        </Panel>
        <Panel title="Customer Sentiment by Scenario">
          <div className="flex flex-col gap-2 max-h-60 overflow-auto">
            {data.sentimentByScenario.map(s => (
              <div key={s.scenario}>
                <div className="text-[10.5px] font-semibold text-slate-600 mb-1 truncate">{s.scenario}</div>
                <div className="h-2.5 rounded-full overflow-hidden flex bg-slate-100 ring-1 ring-slate-100">
                  <div style={{ width: `${s.positive}%`, background: GREEN }} title={`Positive ${s.positive}%`} />
                  <div style={{ width: `${s.neutral}%`, background: AMBER }} title={`Neutral ${s.neutral}%`} />
                  <div style={{ width: `${s.negative}%`, background: RED }} title={`Negative ${s.negative}%`} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Panel title="Frustration &amp; Abusive Behavior" icon={Frown} accent={AMBER}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="grid grid-cols-2 gap-3">
            <KpiCard icon={Frown} label="Frustration Detected" value={data.frustration.frustrationDetected} sub={`${data.frustration.frustrationDetectedPct}% of total calls`} color={AMBER} />
            <KpiCard icon={AlertTriangle} label="High Frustration" value={data.frustration.highFrustration} sub={`${data.frustration.highFrustrationPct}% of total calls`} color={RED} />
            <KpiCard icon={ShieldAlert} label="Customer Abusing" value={data.frustration.customerAbusing} sub={`${data.frustration.customerAbusingPct}% of total calls`} color={RED} />
            <KpiCard icon={ListChecks} label="Top 5 Scenarios by Non-Compliance" value={data.top5ScenariosByNonCompliance[0]?.scenario ?? '—'} sub={data.top5ScenariosByNonCompliance[0] ? `${data.top5ScenariosByNonCompliance[0].nonCompliancePct}% non-compliant` : ''} color={BLUE} />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2 block">Top Abusive / Frustrated Sentences</span>
            {data.topAbusiveSentences.length === 0 ? <EmptyState label="No abusive/frustrated sentences found." /> : (
              <div className="flex flex-col gap-1.5 max-h-40 overflow-auto pr-1">
                {data.topAbusiveSentences.map((s, i) => (
                  <div key={i} className="text-[11px] text-red-700 bg-red-50/80 ring-1 ring-red-100 rounded-lg px-3 py-2 italic font-medium">"{s.sentence.replace(/^Customer:\s*/, '')}"</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Panel>
      <Panel title="Top 5 Scenarios by Non-Compliance" icon={ShieldAlert} accent={RED}>
        <BarList items={data.top5ScenariosByNonCompliance.map(s => ({ label: s.scenario, value: s.nonCompliancePct }))} barColor={v => v > 15 ? RED : v > 5 ? AMBER : GREEN} />
      </Panel>
    </div>
  );
}

// Small rounded-pill score badge — used across the agent table wherever a percentage is a
// "graded" metric (audit score, compliance rate) rather than a plain count.
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
  { bg: 'linear-gradient(135deg,#FBBF24,#F59E0B)', icon: Trophy },   // 1st — gold
  { bg: 'linear-gradient(135deg,#CBD5E1,#94A3B8)', icon: Medal },    // 2nd — silver
  { bg: 'linear-gradient(135deg,#D9A066,#B4753E)', icon: Award },    // 3rd — bronze
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

// Agent-wise Parameters Score — same 16 parameters that make up Audit Score, broken out per agent
// instead of averaged into one number, so a low audit score can be traced to exactly which
// parameter(s) are pulling a given agent down (same idea as Housing Owner's CQ Score Details page).
function AgentParameterScoreTable({ data }: { data: AgentPerformanceData }) {
  const weakestOf = (a: AgentRow) => {
    const entries = data.parameterColumns.map(p => ({ label: p.label, value: a.paramScores[p.key] ?? 0 }));
    return entries.reduce((min, e) => (e.value < min.value ? e : min), entries[0]);
  };
  return (
    <Panel title="Agent-wise Parameters Score" icon={ListChecks}>
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
                    <td className={`py-1.5 px-2 font-bold text-slate-700 whitespace-nowrap sticky left-0 z-10 ${i % 2 === 1 ? 'bg-slate-50' : 'bg-white'}`}>{a.agentName}</td>
                    {data.parameterColumns.map(p => {
                      const v = a.paramScores[p.key] ?? 0;
                      const c = heatColor(v);
                      return (
                        <td key={p.key} className="py-1.5 px-2 text-center">
                          <span className="inline-block min-w-[38px] px-1.5 py-0.5 rounded-md font-extrabold" style={{ color: c.text, background: c.bg }}>{v}%</span>
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
function AgentPerformanceSlide({ data }: { data: AgentPerformanceData }) {
  return (
    <div className="flex flex-col gap-4">
      <Panel title="Agent Performance Overview" icon={Users}>
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
                <tr key={a.agentName} className={`${i % 2 === 1 ? 'bg-slate-50/60' : ''} hover:bg-blue-50/50 transition-colors`}>
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

      <AgentParameterScoreTable data={data} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Agent Wise Call Volume">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.agentTable} margin={{ top: 10, right: 10, left: -20, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="agentName" tick={{ fill: '#334155', fontSize: 8 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#64748B', fontSize: 9 }} />
              <Tooltip contentStyle={TT} />
              <Bar dataKey="totalCalls" name="Total Calls" fill={BLUE} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Agent Wise Audit Score &amp; Compliance Rate">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.agentTable} margin={{ top: 10, right: 10, left: -20, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="agentName" tick={{ fill: '#334155', fontSize: 8 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#64748B', fontSize: 9 }} domain={[0, 100]} />
              <Tooltip contentStyle={TT} />
              <Legend wrapperStyle={{ fontSize: 9 }} />
              <Bar dataKey="auditScorePct" name="Audit Score %" fill={GREEN} radius={[4, 4, 0, 0]} />
              <Bar dataKey="compliancePct" name="Compliance %" fill={AMBER} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="PTP &amp; Payment Performance by Agent">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.agentTable} margin={{ top: 10, right: 10, left: -20, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="agentName" tick={{ fill: '#334155', fontSize: 7 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#64748B', fontSize: 9 }} />
              <Tooltip contentStyle={TT} />
              <Legend wrapperStyle={{ fontSize: 9 }} />
              <Bar dataKey="ptpGiven" name="PTP Given" fill={AMBER} radius={[4, 4, 0, 0]} />
              <Bar dataKey="paymentDone" name="Payment Done" fill={GREEN} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Collection Effectiveness by Agent (Demo)" icon={IndianRupee} accent={GREEN}>
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
              Total (Demo) ₹{data.collectionEffectiveness.totalDemoAmount.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-slate-50 text-slate-500 ring-1 ring-slate-100">
              Avg PTP Amount (Demo) ₹{data.collectionEffectiveness.avgDemoAmount.toLocaleString('en-IN')}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={data.agentTable} margin={{ top: 10, right: 10, left: -10, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="agentName" tick={{ fill: '#334155', fontSize: 7 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#64748B', fontSize: 9 }} />
              <Tooltip contentStyle={TT} formatter={(v) => `₹${Number(v).toLocaleString('en-IN')}`} />
              <Bar dataKey="demoCollectionAmount" name="Collection (Demo)" fill={GREEN} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Average Call Duration by Agent">
          <BarList items={data.agentTable.map(a => ({ label: a.agentName, value: a.avgDurationMin }))} unit=" min" />
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="Agent Quality Matrix" className="lg:col-span-1">
          <ResponsiveContainer width="100%" height={220}>
            <ScatterChart margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis type="number" dataKey="avgDurationMin" name="Avg Duration (min)" tick={{ fill: '#64748B', fontSize: 9 }} />
              <YAxis type="number" dataKey="auditScorePct" name="Audit Score %" tick={{ fill: '#64748B', fontSize: 9 }} domain={[0, 100]} />
              <ZAxis type="number" dataKey="totalCalls" range={[60, 400]} name="Total Calls" />
              <Tooltip contentStyle={TT} cursor={{ strokeDasharray: '3 3' }} formatter={(v, n) => [n === 'Avg Duration (min)' ? `${v} min` : v, n]} />
              <Scatter data={data.qualityMatrix} fill={BLUE} fillOpacity={0.7} />
            </ScatterChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Top 5 Agents by Collection Amount (Demo)">
          <BarList items={data.top5ByCollectionAmount.map(a => ({ label: a.agentName, value: a.demoCollectionAmount }))} unit="" barColor={() => GREEN} />
        </Panel>
        <Panel title="Bottom 5 Agents by Audit Score">
          <BarList items={data.bottom5ByAuditScore.map(a => ({ label: a.agentName, value: a.auditScorePct }))} barColor={scoreColor} />
        </Panel>
      </div>
    </div>
  );
}

// ─── Slide 4: Quality & Insights ─────────────────────────────────────────────
function QualityInsightsSlide({ data }: { data: QualityInsightsData }) {
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
            <div className="text-[11px] font-extrabold px-3 py-1 rounded-full" style={{ color: scoreColor(data.overallQualityScore), background: hexToRgba(scoreColor(data.overallQualityScore), 0.12) }}>
              {data.qualityGrade}
            </div>
          </div>
        </Panel>
        <Panel title="Audit Parameter Scorecard" className="lg:col-span-1">
          <div className="max-h-64 overflow-auto pr-1">
            <BarList items={data.parameterScorecard.map(p => ({ label: p.label, value: p.passRatePct }))} barColor={scoreColor} />
          </div>
        </Panel>
        <Panel title="Compliance vs Non-Compliance" className="lg:col-span-1" icon={ShieldAlert} accent={GREEN}>
          <DonutWidget data={[{ name: 'Compliant', count: data.compliance.compliant }, { name: 'Non-Compliant', count: data.compliance.nonCompliant }]} centerLabel="Parameters" />
        </Panel>
        <Panel title="Customer Behavior" className="lg:col-span-1">
          <DonutWidget data={data.customerBehavior} centerLabel="Calls" />
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Sentiment Trend (weekly)">
          {data.sentimentTrendWeekly.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.sentimentTrendWeekly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
        <Panel title="Frustration Trend (weekly)">
          {data.frustrationTrendWeekly.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.frustrationTrendWeekly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
        <Panel title="Abusive Calls Trend (weekly)">
          {data.abusiveCallsTrendWeekly.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.abusiveCallsTrendWeekly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fill: '#334155', fontSize: 7 }} />
                <YAxis tick={{ fill: '#64748B', fontSize: 9 }} allowDecimals={false} />
                <Tooltip contentStyle={TT} />
                <Bar dataKey="count" name="Abusive Calls" fill={RED} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
        <Panel title="Average Audit Score Trend (weekly)">
          {data.avgAuditScoreTrendWeekly.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.avgAuditScoreTrendWeekly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
        <Panel title="Top 5 Issues / Root Causes (from Audit)" icon={AlertTriangle} accent={RED}>
          <BarList items={data.topIssues.map(i => ({ label: i.issue, value: i.count }))} unit="" barColor={() => RED} />
        </Panel>
        <Panel title="Top Frustrated Customer Reasons" icon={Frown} accent={AMBER}>
          <BarList items={data.topFrustratedReasons.map(r => ({ label: r.reason, value: r.pct }))} barColor={() => AMBER} />
        </Panel>
        <Panel title="Examples of Abusive / Frustrated Sentences" icon={ShieldAlert} accent={RED}>
          {data.abusiveExamples.length === 0 ? <EmptyState label="No abusive/frustrated sentences found." /> : (
            <div className="flex flex-col gap-1.5 max-h-52 overflow-auto pr-1">
              {data.abusiveExamples.map((s, i) => (
                <div key={i} className="text-[11px] text-red-700 bg-red-50/80 ring-1 ring-red-100 rounded-lg px-3 py-2 italic font-medium">"{s.sentence.replace(/^Customer:\s*/, '')}"</div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Key Insights &amp; Recommendations" icon={Lightbulb} accent="#7C3AED">
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
