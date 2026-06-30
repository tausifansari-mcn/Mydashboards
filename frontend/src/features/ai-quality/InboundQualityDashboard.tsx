import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useProcessStore } from '@/store/processStore';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine, Legend,
} from 'recharts';
import {
  ChevronLeft, Phone, ClipboardCheck, TrendingUp, Star,
  ThumbsUp, ThumbsDown, Minus, AlertTriangle, Trophy, Target,
  ShieldAlert, AlertOctagon, Download, Maximize2, Minimize2, X, Info, Loader2,
} from 'lucide-react';
import api from '@/lib/axios';

function toLocalDT(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface PieSlice { name: string; value: number; color: string; }

interface AchtRow {
  category:    string;
  audit_count: number;
  score_pct:   number;
  fatal_count: number;
  fatal_pct:   number;
}

interface InboundProcessKPIs {
  client_id:         string;
  client_name:       string;
  audit_count:       number;
  cq_score:          number;
  cq_score_no_fatal: number;
  excellent:         number;
  good:              number;
  average_count:     number;
  below_average:     number;
  fatal_count:       number;
  opening_skill:     number;
  soft_skill:        number;
  hold_procedure:    number;
  resolution:        number;
  closing:                    number;
  avg_score:                  number;
  social_media_court_threat:  number;
  potential_scam:             number;
  frustration_count:          number;
  threat_count:               number;
  abuse_count:                number;
  slang_count:                number;
  sarcasm_count:              number;
  pie_data:                   PieSlice[];
  acht_data:                  AchtRow[];
}

interface TopPerformer  { user: string; audit_count: number; avg_score: number; }
interface DailyScore   { call_date: string; avg_score: number; audit_count: number; }
interface Scenario1Item   { scenario1: string; count: number; pct: number; }
interface ScenarioItem   { scenario: string; count: number; pct: number; children: Scenario1Item[]; }
interface AlertScenarioRow { scenario: string; scenario1: string; count: number; pct: number; }
interface NegSignalDetailRow { scenario: string; scenario1: string; neg_signal: string; count: number; pct: number; }
interface SensitiveWordUseRow { label: string; count: number; pct: number; }
interface SensitiveWordAnalysis { distribution: SensitiveWordUseRow[]; akash_count: number; akash_label: string; social_count: number; court_count: number; }
interface FatalContributorRow  { agent_name: string; audit_count: number; fatal_count: number; fatal_pct: number; }
interface DayWiseFatalRow      { call_date: string; total_count: number; total_fatal: number; fatal_pct: number; query_fatal: number; complaint_fatal: number; request_fatal: number; }
interface WeekScenarioFatalRow { week_label: string; query_fatal_pct: number; complaint_fatal_pct: number; request_fatal_pct: number; sale_done_fatal_pct: number; total_fatal: number; }
interface AgentPerformanceRow  { agent_name: string; audit_count: number; cq_score: number; fatal_count: number; fatal_pct: number; below_avg_pct: number; avg_pct: number; good_pct: number; excellent_pct: number; }
interface FatalAnalysis        { audit_count: number; cq_score: number; fatal_count: number; fatal_pct: number; query_fatal: number; complaint_fatal: number; request_fatal: number; sale_done_fatal: number; top_contributors: FatalContributorRow[]; day_wise: DayWiseFatalRow[]; week_scenario: WeekScenarioFatalRow[]; agent_performance: AgentPerformanceRow[]; }

interface DetailScenario1Item  { scenario1: string; count: number; pct: number; }
interface DetailScenarioPanel  { scenario: string; total_count: number; items: DetailScenario1Item[]; }
interface DayWiseAuditRow      { call_date: string; complaint: number; null_count: number; request: number; query: number; total: number; }
interface WeekScenarioAuditRow { week_label: string; query_pct: number; complaint_pct: number; request_pct: number; sale_done_pct: number; total: number; }
interface DetailAnalysis       { cq_score: number; audit_count: number; fatal_count: number; fatal_pct: number; query_count: number; complaint_count: number; request_count: number; sale_done_count: number; scenario_panels: DetailScenarioPanel[]; day_wise_audit: DayWiseAuditRow[]; week_scenario_audit: WeekScenarioAuditRow[]; }

interface AgentParamRow      { agent_name: string; tq_mq_bq: string; audit_count: number; cq_score: number; fatal_count: number; fatal_pct: number; opening_skill: number; soft_skill: number; hold_procedure: number; resolution: number; closing: number; }
interface AgentAuditBandRow  { agent: string; audit_count: number; cq_score: number; fatal_count: number; fatal_pct: number; tq_count: number; mq_count: number; bq_count: number; }
interface DayWiseQualityRow  { call_date: string; audit_count: number; cq_score: number; fatal_count: number; fatal_pct: number; opening_skill: number; soft_skill: number; hold_procedure: number; resolution: number; closing: number; }
interface WeekWiseQualityRow  { week_label: string; audit_count: number; cq_score: number; fatal_count: number; fatal_pct: number; opening_skill: number; soft_skill: number; hold_procedure: number; resolution: number; closing: number; }
interface QualityParameterRow { parameter: string; hit_count: number; total_count: number; score_pct: number; }

interface DayWiseRepeatRow { call_date: string; unique_calls: number; repeat_calls: number; repeat_pct: number; }
interface RepeatPivotRow   { mobile_no: string; by_date: Record<string, number>; grand_total: number; }
interface RepeatAnalysis   { grand_unique: number; grand_repeat: number; grand_pct: number; day_wise: DayWiseRepeatRow[]; pivot_dates: string[]; pivot_rows: RepeatPivotRow[]; }

// ─── CSV Export ───────────────────────────────────────────────────────────────
function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const header = keys.join(',');
  const body = rows.map(r =>
    keys.map(k => {
      const v = r[k];
      const s = v == null ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')
  ).join('\n');
  const blob = new Blob([`${header}\n${body}`], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Drill Modal (portal) ─────────────────────────────────────────────────────
interface DrillModalProps {
  title: string;
  accent: string;
  onClose: () => void;
  children: React.ReactNode;
}
function DrillModal({ title, accent, onClose, children }: DrillModalProps) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-6 px-4"
      onClick={onClose}>
      <div className="bg-[#0F172A] border border-white/10 rounded-2xl w-full max-w-5xl shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/5">
          <div className="w-1 h-5 rounded-full" style={{ background: accent }} />
          <p className="text-sm font-bold text-white flex-1">{title}</p>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Expand Wrapper ──────────────────────────────────────────────────────────
function ExpandBtn({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle}
      title={expanded ? 'Minimize' : 'Expand fullscreen'}
      className="ml-auto p-1 rounded text-slate-600 hover:text-slate-300 transition-colors shrink-0">
      {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
    </button>
  );
}

// ─── Export Button ────────────────────────────────────────────────────────────
function ExportBtn({ onClick, title = 'Export CSV' }: { onClick: () => void; title?: string }) {
  return (
    <button onClick={onClick} title={title}
      className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-slate-400 hover:text-emerald-400 border border-white/5 hover:border-emerald-500/30 transition-colors shrink-0">
      <Download size={11} /> CSV
    </button>
  );
}

const SCENARIO_COLORS = ['#3B82F6','#22C55E','#F59E0B','#A855F7','#EF4444','#14B8A6','#F97316','#EC4899'];

function cqColor(score: number): string {
  if (score >= 90) return '#22C55E';
  if (score >= 85) return '#F59E0B';
  if (score > 0)   return '#EF4444';
  return '#64748B';
}

interface MetricCardProps {
  label:      string;
  value:      string | number;
  subValue?:  string;
  icon:       React.ElementType;
  accentColor: string;
  loading?:   boolean;
}
function MetricCard({ label, value, subValue, icon: Icon, accentColor, loading }: MetricCardProps) {
  return (
    <div className="relative flex flex-col gap-2 bg-[#1E293B] border border-white/5 rounded-xl px-4 py-4 overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ backgroundColor: accentColor }} />
      <div className="pl-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest leading-tight">{label}</span>
          <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${accentColor}18` }}>
            <Icon size={13} style={{ color: accentColor }} />
          </div>
        </div>
        {loading ? (
          <div className="h-7 w-16 bg-white/5 rounded animate-pulse" />
        ) : (
          <p className="text-2xl font-bold text-white leading-none">{value}</p>
        )}
        {subValue && !loading && (
          <p className="text-[11px] text-slate-400 mt-1">{subValue}</p>
        )}
      </div>
    </div>
  );
}

const SLIDES = [
  { label: 'Quality Performance', color: 'sky'    },
  { label: 'Fatal Analysis',      color: 'red'    },
  { label: 'Detail Analysis',     color: 'purple' },
  { label: 'Repeat Analysis',     color: 'teal'   },
] as const;

export default function InboundQualityDashboard() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { canAccessInboundClient, loaded: processLoaded } = useProcessStore();
  const now = new Date();

  useEffect(() => {
    if (processLoaded && clientId && !canAccessInboundClient(clientId)) {
      navigate('/dashboard', { replace: true });
    }
  }, [processLoaded, clientId, canAccessInboundClient, navigate]);

  const [activeSlide, setActiveSlide] = useState(0);
  const [fatalData, setFatalData] = useState<FatalAnalysis | null>(null);
  const [fatalLoading, setFatalLoading] = useState(false);
  const [detailData, setDetailData] = useState<DetailAnalysis | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [agentParamScenario, setAgentParamScenario] = useState('');
  const [agentParamData, setAgentParamData] = useState<AgentParamRow[]>([]);
  const [agentParamLoading, setAgentParamLoading] = useState(false);
  const [agentAuditBand, setAgentAuditBand] = useState<AgentAuditBandRow[]>([]);
  const [dayWiseScenario, setDayWiseScenario] = useState('');
  const [dayWiseAgent, setDayWiseAgent] = useState('');
  const [dayWiseData, setDayWiseData] = useState<DayWiseQualityRow[]>([]);
  const [dayWiseLoading, setDayWiseLoading] = useState(false);
  const [weekWiseScenario, setWeekWiseScenario] = useState('');
  const [weekWiseAgent, setWeekWiseAgent] = useState('');
  const [weekWiseData, setWeekWiseData] = useState<WeekWiseQualityRow[]>([]);
  const [weekWiseLoading, setWeekWiseLoading] = useState(false);
  const [qualityParamScenario, setQualityParamScenario] = useState('');
  const [qualityParamAgent, setQualityParamAgent] = useState('');
  const [qualityParamData, setQualityParamData] = useState<QualityParameterRow[]>([]);
  const [qualityParamLoading, setQualityParamLoading] = useState(false);
  const [repeatData, setRepeatData] = useState<RepeatAnalysis | null>(null);
  const [repeatLoading, setRepeatLoading] = useState(false);

  // ── Deep analysis state ──────────────────────────────────────────────────
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [drillModal, setDrillModal] = useState<{ title: string; accent: string; rows: Record<string,unknown>[]; columns: { key: string; label: string }[] } | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);

  const toggleExpand = (key: string) => setExpandedSection(prev => prev === key ? null : key);

  const [startDate, setStartDate] = useState(
    toLocalDT(new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0))
  );
  const [endDate, setEndDate] = useState(toLocalDT(now));
  const [kpis, setKpis]               = useState<InboundProcessKPIs | null>(null);
  const [loading, setLoading]         = useState(true);
  const [performers, setPerformers]       = useState<TopPerformer[]>([]);
  const [dailyScores, setDailyScores]     = useState<DailyScore[]>([]);
  const [scenarios, setScenarios]             = useState<ScenarioItem[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [socialThreats, setSocialThreats]         = useState<AlertScenarioRow[]>([]);
  const [negSignalDetails, setNegSignalDetails]   = useState<NegSignalDetailRow[]>([]);
  const [potentialScams, setPotentialScams]       = useState<AlertScenarioRow[]>([]);
  const [sensitiveWordAnalysis, setSensitiveWordAnalysis] = useState<SensitiveWordAnalysis | null>(null);

  const sd = startDate.replace('T', ' ');
  const ed = endDate.replace('T', ' ');

  const openBandDetail = async (band: string, title: string, accent: string) => {
    const cols = [
      { key: 'Agent',       label: 'Agent' },
      { key: 'Scenario',    label: 'Scenario' },
      { key: 'Count',       label: 'Count' },
      { key: 'Avg Score%',  label: 'Avg Score%' },
    ];
    setDrillModal({ title, accent, rows: [], columns: cols });
    setDrillLoading(true);
    try {
      const q = `clientId=${clientId}&startDate=${sd}&endDate=${ed}&band=${band}`;
      const { data } = await api.get<{ data: { agent: string; scenario: string; count: number; avg_score: number }[] }>(
        `/inbound-quality/band-detail?${q}`
      );
      setDrillModal({ title, accent, columns: cols, rows: data.data.map(r => ({
        Agent:        r.agent,
        Scenario:     r.scenario,
        Count:        r.count,
        'Avg Score%': `${r.avg_score}%`,
      })) });
    } catch {
      setDrillModal(prev => prev ? { ...prev, rows: [] } : null);
    } finally {
      setDrillLoading(false);
    }
  };

  const fetchKPIs = useCallback(() => {
    setLoading(true);
    api.get<{ data: InboundProcessKPIs }>(
      `/inbound-quality/kpis?clientId=${clientId}&startDate=${sd}&endDate=${ed}`
    )
      .then(r => setKpis(r.data?.data ?? null))
      .catch(() => setKpis(null))
      .finally(() => setLoading(false));
  }, [clientId, sd, ed]);

  const fetchPerformers = useCallback(() => {
    api.get<{ data: TopPerformer[] }>(
      `/inbound-quality/top-performers?clientId=${clientId}&startDate=${sd}&endDate=${ed}`
    )
      .then(r => setPerformers(r.data?.data ?? []))
      .catch(() => setPerformers([]));
  }, [clientId, sd, ed]);

  const fetchDailyScores = useCallback(() => {
    api.get<{ data: DailyScore[] }>(
      `/inbound-quality/daily-scores?clientId=${clientId}&endDate=${ed}`
    )
      .then(r => setDailyScores(r.data?.data ?? []))
      .catch(() => setDailyScores([]));
  }, [clientId, ed]);

  const fetchScenarios = useCallback(() => {
    api.get<{ data: ScenarioItem[] }>(
      `/inbound-quality/scenarios?clientId=${clientId}&startDate=${sd}&endDate=${ed}`
    )
      .then(r => { setScenarios(r.data?.data ?? []); setSelectedScenario(null); })
      .catch(() => setScenarios([]));
  }, [clientId, sd, ed]);

  const fetchFatalAnalysis = useCallback(() => {
    setFatalLoading(true);
    api.get<{ data: FatalAnalysis }>(
      `/inbound-quality/fatal-analysis?clientId=${clientId}&startDate=${sd}&endDate=${ed}`
    )
      .then(r => setFatalData(r.data?.data ?? null))
      .catch(() => setFatalData(null))
      .finally(() => setFatalLoading(false));
  }, [clientId, sd, ed]);

  const fetchDetailAnalysis = useCallback(() => {
    setDetailLoading(true);
    api.get<{ data: DetailAnalysis }>(
      `/inbound-quality/detail-analysis?clientId=${clientId}&startDate=${sd}&endDate=${ed}`
    )
      .then(r => setDetailData(r.data?.data ?? null))
      .catch(() => setDetailData(null))
      .finally(() => setDetailLoading(false));
  }, [clientId, sd, ed]);

  const fetchAgentParam = useCallback(() => {
    setAgentParamLoading(true);
    const q = `clientId=${clientId}&startDate=${sd}&endDate=${ed}${agentParamScenario ? `&scenario=${encodeURIComponent(agentParamScenario)}` : ''}`;
    api.get<{ data: AgentParamRow[] }>(`/inbound-quality/agent-param?${q}`)
      .then(r => setAgentParamData(r.data?.data ?? []))
      .catch(() => setAgentParamData([]))
      .finally(() => setAgentParamLoading(false));
  }, [clientId, sd, ed, agentParamScenario]);

  const fetchDayWiseQuality = useCallback(() => {
    setDayWiseLoading(true);
    const q = `clientId=${clientId}&startDate=${sd}&endDate=${ed}${dayWiseScenario ? `&scenario=${encodeURIComponent(dayWiseScenario)}` : ''}${dayWiseAgent ? `&agentName=${encodeURIComponent(dayWiseAgent)}` : ''}`;
    api.get<{ data: DayWiseQualityRow[] }>(`/inbound-quality/day-wise-quality?${q}`)
      .then(r => setDayWiseData(r.data?.data ?? []))
      .catch(() => setDayWiseData([]))
      .finally(() => setDayWiseLoading(false));
  }, [clientId, sd, ed, dayWiseScenario, dayWiseAgent]);

  const fetchWeekWiseQuality = useCallback(() => {
    setWeekWiseLoading(true);
    const q = `clientId=${clientId}&startDate=${sd}&endDate=${ed}${weekWiseScenario ? `&scenario=${encodeURIComponent(weekWiseScenario)}` : ''}${weekWiseAgent ? `&agentName=${encodeURIComponent(weekWiseAgent)}` : ''}`;
    api.get<{ data: WeekWiseQualityRow[] }>(`/inbound-quality/week-wise-quality?${q}`)
      .then(r => setWeekWiseData(r.data?.data ?? []))
      .catch(() => setWeekWiseData([]))
      .finally(() => setWeekWiseLoading(false));
  }, [clientId, sd, ed, weekWiseScenario, weekWiseAgent]);

  const fetchQualityParameters = useCallback(() => {
    setQualityParamLoading(true);
    const q = `clientId=${clientId}&startDate=${sd}&endDate=${ed}${qualityParamScenario ? `&scenario=${encodeURIComponent(qualityParamScenario)}` : ''}${qualityParamAgent ? `&agentName=${encodeURIComponent(qualityParamAgent)}` : ''}`;
    api.get<{ data: QualityParameterRow[] }>(`/inbound-quality/quality-parameters?${q}`)
      .then(r => setQualityParamData(r.data?.data ?? []))
      .catch(() => setQualityParamData([]))
      .finally(() => setQualityParamLoading(false));
  }, [clientId, sd, ed, qualityParamScenario, qualityParamAgent]);

  const fetchRepeatAnalysis = useCallback(() => {
    setRepeatLoading(true);
    api.get<{ data: RepeatAnalysis }>(
      `/inbound-quality/repeat-analysis?clientId=${clientId}&startDate=${sd}&endDate=${ed}`
    )
      .then(r => setRepeatData(r.data?.data ?? null))
      .catch(() => setRepeatData(null))
      .finally(() => setRepeatLoading(false));
  }, [clientId, sd, ed]);

  const fetchAlertTables = useCallback(() => {
    const q = `clientId=${clientId}&startDate=${sd}&endDate=${ed}`;
    api.get<{ data: AlertScenarioRow[] }>(`/inbound-quality/social-media-threats?${q}`)
      .then(r => setSocialThreats(r.data?.data ?? [])).catch(() => setSocialThreats([]));
    api.get<{ data: NegSignalDetailRow[] }>(`/inbound-quality/neg-signal-details?${q}`)
      .then(r => setNegSignalDetails(r.data?.data ?? [])).catch(() => setNegSignalDetails([]));
    api.get<{ data: AlertScenarioRow[] }>(`/inbound-quality/potential-scams?${q}`)
      .then(r => setPotentialScams(r.data?.data ?? [])).catch(() => setPotentialScams([]));
    api.get<{ data: SensitiveWordAnalysis }>(`/inbound-quality/sensitive-word-analysis?${q}`)
      .then(r => setSensitiveWordAnalysis(r.data?.data ?? null)).catch(() => setSensitiveWordAnalysis(null));
  }, [clientId, sd, ed]);

  useEffect(() => {
    fetchKPIs();
    fetchPerformers();
    fetchDailyScores();
    fetchScenarios();
    fetchAlertTables();
    fetchFatalAnalysis();
    fetchDetailAnalysis();
    fetchRepeatAnalysis();
    // Agent audit band for Quality Performance slide
    api.get<{ data: AgentAuditBandRow[] }>(
      `/inbound-quality/agent-audit-band?clientId=${clientId}&startDate=${sd}&endDate=${ed}`
    ).then(r => setAgentAuditBand(r.data?.data ?? [])).catch(() => setAgentAuditBand([]));
  }, [fetchKPIs, fetchPerformers, fetchDailyScores, fetchScenarios, fetchAlertTables, fetchFatalAnalysis, fetchDetailAnalysis, fetchRepeatAnalysis, clientId, sd, ed]);

  useEffect(() => { fetchAgentParam(); }, [fetchAgentParam]);
  useEffect(() => { fetchDayWiseQuality(); }, [fetchDayWiseQuality]);
  useEffect(() => { fetchWeekWiseQuality(); }, [fetchWeekWiseQuality]);
  useEffect(() => { fetchQualityParameters(); }, [fetchQualityParameters]);

  const clientName = kpis?.client_name || `Client ${clientId}`;
  const total = kpis?.audit_count ?? 0;

  const pct = (n: number) => total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '—';

  return (
    <div className="min-h-screen bg-[#0F172A] text-white flex flex-col">

      {/* Top bar */}
      <div className="bg-[#0B1120] border-b border-white/5 sticky top-0 z-30">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3 flex-wrap">
          <button onClick={() => navigate('/quality')}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-xs">
            <ChevronLeft size={16} /> AI Quality
          </button>
          <div className="w-px h-4 bg-slate-700" />
          <Phone size={14} className="text-sky-400 shrink-0" />
          <div>
            <h1 className="text-sm font-bold text-white leading-none">Inbound Quality · {clientName}</h1>
            <p className="text-[10px] text-slate-500 mt-0.5">Quality audit performance</p>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 w-full">

        {/* Date filter */}
        <div className="flex items-center gap-3 flex-wrap mb-6">
          <label className="text-[11px] text-slate-400 uppercase tracking-wider">From</label>
          <input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="bg-[#1E293B] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500" />
          <label className="text-[11px] text-slate-400 uppercase tracking-wider">To</label>
          <input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="bg-[#1E293B] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500" />
          <button
            onClick={async () => {
              setDrillLoading(true);
              try {
                const { data } = await api.get<{ data: Record<string, string | number>[] }>(
                  `/inbound-quality/raw-data?clientId=${clientId}&startDate=${sd}&endDate=${ed}`
                );
                const rows = data.data;
                if (!rows.length) { alert('No data found for selected period.'); return; }
                const cols = Object.keys(rows[0]);
                const header = cols.join(',');
                const body = rows.map(r =>
                  cols.map(k => {
                    const v = String(r[k] ?? '');
                    return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v;
                  }).join(',')
                ).join('\n');
                const csv = `${header}\n${body}`;
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                const clientLabel = clientId || 'ALL';
                const dateFrom = sd.slice(0, 10);
                const dateTo = ed.slice(0, 10);
                a.href = url;
                a.download = `raw-data-${clientLabel}-${dateFrom}-to-${dateTo}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              } catch { alert('Failed to export raw data. Please try again.'); }
              finally { setDrillLoading(false); }
            }}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-300 border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors">
            {drillLoading ? <span className="animate-spin w-3 h-3 border border-emerald-400 border-t-transparent rounded-full inline-block" /> : <Download size={12} />}
            Export Raw Data
          </button>
        </div>

        {/* Slide tabs */}
        <div className="flex gap-2 mb-6">
          {SLIDES.map((s, i) => {
            const isActive = activeSlide === i;
            const activeClass =
              s.color === 'red'    ? 'bg-red-500/20 border-red-500/60 text-red-300' :
              s.color === 'purple' ? 'bg-purple-500/20 border-purple-500/60 text-purple-300' :
              s.color === 'teal'   ? 'bg-teal-500/20 border-teal-500/60 text-teal-300' :
                                     'bg-sky-500/20 border-sky-500/60 text-sky-300';
            return (
              <button key={s.label}
                onClick={() => setActiveSlide(i)}
                className={`px-5 py-2 rounded-lg border text-xs font-bold uppercase tracking-widest transition-all duration-150 ${
                  isActive ? activeClass : 'bg-white/[0.03] border-white/10 text-slate-500 hover:text-slate-300'
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Quality Performance slide */}
        {activeSlide === 0 && (
          <>
            {/* KPI metric cards — 7 in a row — click to drill */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
              <div className="cursor-pointer" title="Click for detailed breakdown"
                onClick={() => kpis && setDrillModal({ title: 'Quality Score Distribution — Detail', accent: cqColor(kpis.cq_score), columns: [{ key: 'Category', label: 'Category' }, { key: 'Count', label: 'Count' }, { key: 'Pct', label: '%' }, { key: 'Score Range', label: 'Score Range' }], rows: [{ Category: 'Excellent', Count: kpis.excellent, Pct: `${pct(kpis.excellent)}`, 'Score Range': '98–100%' }, { Category: 'Good', Count: kpis.good, Pct: `${pct(kpis.good)}`, 'Score Range': '90–97%' }, { Category: 'Average', Count: kpis.average_count, Pct: `${pct(kpis.average_count)}`, 'Score Range': '85–89%' }, { Category: 'Below Average', Count: kpis.below_average, Pct: `${pct(kpis.below_average)}`, 'Score Range': '<85%' }, { Category: 'Fatal (Score=0)', Count: kpis.fatal_count, Pct: `${pct(kpis.fatal_count)}`, 'Score Range': '0%' }] })}>
              <MetricCard
                label="CQ Score%"
                value={loading ? '—' : `${kpis?.cq_score ?? 0}%`}
                subValue="Click for breakdown"
                icon={Star}
                accentColor={cqColor(kpis?.cq_score ?? 0)}
                loading={loading}
              />
              </div>
              <div className="cursor-pointer" title="Click for breakdown excluding fatal calls"
                onClick={() => openBandDetail('no_fatal', 'W/O Fatal — Agent & Scenario Breakdown', '#38BDF8')}>
              <MetricCard
                label="W/O Fatal CQ Score%"
                value={loading ? '—' : kpis?.cq_score_no_fatal ? `${kpis.cq_score_no_fatal}%` : 'No data'}
                subValue="Click for breakdown"
                icon={TrendingUp}
                accentColor="#38BDF8"
                loading={loading}
              />
              </div>
              <div className="cursor-pointer" title="Click to see score components breakdown"
                onClick={() => kpis && setDrillModal({ title: 'Score Components — Parameter Breakdown', accent: '#A78BFA', columns: [{ key: 'Parameter', label: 'Parameter' }, { key: 'Score%', label: 'Score%' }, { key: 'Status', label: 'Status' }], rows: [{ Parameter: 'Opening Skill', 'Score%': `${kpis.opening_skill}%`, Status: kpis.opening_skill >= 90 ? '✅ On Target' : kpis.opening_skill >= 85 ? '⚠️ Amber' : '❌ Below Target' }, { Parameter: 'Soft Skill', 'Score%': `${kpis.soft_skill}%`, Status: kpis.soft_skill >= 90 ? '✅ On Target' : kpis.soft_skill >= 85 ? '⚠️ Amber' : '❌ Below Target' }, { Parameter: 'Hold Procedure', 'Score%': `${kpis.hold_procedure}%`, Status: kpis.hold_procedure >= 90 ? '✅ On Target' : kpis.hold_procedure >= 85 ? '⚠️ Amber' : '❌ Below Target' }, { Parameter: 'Resolution', 'Score%': `${kpis.resolution}%`, Status: kpis.resolution >= 90 ? '✅ On Target' : kpis.resolution >= 85 ? '⚠️ Amber' : '❌ Below Target' }, { Parameter: 'Closing', 'Score%': `${kpis.closing}%`, Status: kpis.closing >= 90 ? '✅ On Target' : kpis.closing >= 85 ? '⚠️ Amber' : '❌ Below Target' }] })}>
              <MetricCard
                label="Audit Count"
                value={loading ? '—' : total.toLocaleString()}
                subValue="Click for score breakdown"
                icon={ClipboardCheck}
                accentColor="#A78BFA"
                loading={loading}
              />
              </div>
              <div className="cursor-pointer" title="Click for Excellent call breakdown"
                onClick={() => openBandDetail('excellent', 'Excellent Calls — Agent & Scenario Breakdown (98–100%)', '#22C55E')}>
              <MetricCard
                label="Excellent Call"
                value={loading ? '—' : (kpis?.excellent ?? 0).toLocaleString()}
                subValue={loading ? '' : `${pct(kpis?.excellent ?? 0)} · Click to drill`}
                icon={ThumbsUp}
                accentColor="#22C55E"
                loading={loading}
              />
              </div>
              <div className="cursor-pointer" title="Click for Good call breakdown"
                onClick={() => openBandDetail('good', 'Good Calls — Agent & Scenario Breakdown (90–97%)', '#3B82F6')}>
              <MetricCard
                label="Good Call"
                value={loading ? '—' : (kpis?.good ?? 0).toLocaleString()}
                subValue={loading ? '' : `${pct(kpis?.good ?? 0)} · Click to drill`}
                icon={ThumbsUp}
                accentColor="#3B82F6"
                loading={loading}
              />
              </div>
              <div className="cursor-pointer" title="Click for Average call breakdown"
                onClick={() => openBandDetail('average', 'Average Calls — Agent & Scenario Breakdown (85–89%)', '#F59E0B')}>
              <MetricCard
                label="Average Call"
                value={loading ? '—' : (kpis?.average_count ?? 0).toLocaleString()}
                subValue={loading ? '' : `${pct(kpis?.average_count ?? 0)} · Click to drill`}
                icon={Minus}
                accentColor="#F59E0B"
                loading={loading}
              />
              </div>
              <div className="cursor-pointer" title="Click for Below Average breakdown"
                onClick={() => openBandDetail('below_average', 'Below Average Calls — Agent & Scenario Breakdown (<85%)', '#EF4444')}>
              <MetricCard
                label="Below Average"
                value={loading ? '—' : (kpis?.below_average ?? 0).toLocaleString()}
                subValue={loading ? '' : `${pct(kpis?.below_average ?? 0)} · Click to drill`}
                icon={ThumbsDown}
                accentColor="#EF4444"
                loading={loading}
              />
              </div>
            </div>

            {/* Score Components + ACHT Categorization — side by side below KPI cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">

              {/* Score Components — LEFT */}
              <div className="bg-[#1E293B] border border-white/5 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full bg-violet-500" />
                  <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Score Components</h3>
                </div>
                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'Opening Skill',  value: kpis?.opening_skill  ?? 0 },
                    { label: 'Soft Skill',      value: kpis?.soft_skill     ?? 0 },
                    { label: 'Hold Procedure',  value: kpis?.hold_procedure ?? 0 },
                    { label: 'Resolution',      value: kpis?.resolution     ?? 0 },
                    { label: 'Closing',         value: kpis?.closing        ?? 0 },
                    { label: 'Avg Score',       value: kpis?.avg_score      ?? 0, isAvg: true },
                  ].map(({ label, value, isAvg }) => {
                    const color = value >= 90 ? '#22C55E' : value >= 85 ? '#F59E0B' : value > 0 ? '#EF4444' : '#64748B';
                    return (
                      <div key={label}
                        className={`relative flex flex-col items-center justify-center gap-1.5 rounded-xl border py-4 px-3 overflow-hidden ${
                          isAvg ? 'border-violet-500/30 bg-violet-500/5' : 'border-white/5 bg-[#0F172A]'
                        }`}>
                        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl" style={{ backgroundColor: isAvg ? '#8B5CF6' : color }} />
                        {loading ? (
                          <div className="h-7 w-14 bg-white/5 rounded animate-pulse" />
                        ) : (
                          <span className="text-2xl font-bold tabular-nums" style={{ color: isAvg ? '#A78BFA' : color }}>
                            {value}%
                          </span>
                        )}
                        <span className={`text-[10px] font-semibold uppercase tracking-widest text-center leading-tight ${isAvg ? 'text-violet-400' : 'text-slate-300'}`}>
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ACHT Categorization — RIGHT */}
              {!loading && kpis && kpis.acht_data.length > 0 ? (() => {
                const grandTotal    = kpis.acht_data.reduce((s, r) => s + r.audit_count, 0);
                const grandFatal    = kpis.acht_data.reduce((s, r) => s + r.fatal_count, 0);
                const grandScoreAvg = grandTotal > 0
                  ? kpis.acht_data.reduce((s, r) => s + r.score_pct * r.audit_count, 0) / grandTotal
                  : 0;
                const grandFatalPct = grandTotal > 0 ? (grandFatal / grandTotal) * 100 : 0;
                return (
                  <div className="bg-[#1E293B] border border-white/5 rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
                      <div className="w-1 h-4 rounded-full bg-amber-500" />
                      <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">ACHT Categorization</h3>
                      <ExportBtn onClick={() => kpis && downloadCSV(kpis.acht_data.map(r => ({ Category: r.category, 'Audit Count': r.audit_count, 'Score%': r.score_pct, 'Fatal Count': r.fatal_count, 'Fatal%': r.fatal_pct })), 'acht-categorization.csv')} />
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/5 bg-white/[0.02]">
                            {['ACHT Categorization', 'Audit Count', 'Score%', 'Fatal Count', 'Fatal%'].map(h => (
                              <th key={h} className="py-2.5 px-4 text-left text-slate-300 font-semibold uppercase tracking-wider whitespace-nowrap">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {kpis.acht_data.map((row, i) => (
                            <tr key={i} className={`border-b border-white/[0.04] hover:bg-white/[0.02] ${i % 2 === 0 ? '' : 'bg-white/[0.01]'}`}>
                              <td className="py-2.5 px-4 text-slate-200 font-medium">{row.category}</td>
                              <td className="py-2.5 px-4 text-slate-300 tabular-nums">{row.audit_count.toLocaleString()}</td>
                              <td className="py-2.5 px-4 tabular-nums">
                                <span className="font-semibold" style={{
                                  color: row.score_pct >= 90 ? '#22C55E' : row.score_pct >= 85 ? '#F59E0B' : row.score_pct > 0 ? '#EF4444' : '#64748B'
                                }}>
                                  {row.score_pct > 0 ? `${row.score_pct}%` : '0%'}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-slate-300 tabular-nums">{row.fatal_count.toLocaleString()}</td>
                              <td className="py-2.5 px-4 tabular-nums">
                                <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold"
                                  style={{
                                    backgroundColor: row.fatal_pct >= 50 ? '#EF444430' : row.fatal_pct > 0 ? '#F59E0B20' : '#22C55E15',
                                    color:           row.fatal_pct >= 50 ? '#EF4444'   : row.fatal_pct > 0 ? '#F59E0B'   : '#22C55E',
                                  }}>
                                  {row.fatal_pct.toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-white/10 bg-[#1E293B]">
                            <td className="py-2.5 px-4 font-bold text-slate-200">Grand Total</td>
                            <td className="py-2.5 px-4 font-bold text-white tabular-nums">{grandTotal.toLocaleString()}</td>
                            <td className="py-2.5 px-4 font-bold tabular-nums" style={{
                              color: grandScoreAvg >= 90 ? '#22C55E' : grandScoreAvg >= 85 ? '#F59E0B' : '#EF4444'
                            }}>
                              {grandScoreAvg > 0 ? `${grandScoreAvg.toFixed(1)}%` : '0%'}
                            </td>
                            <td className="py-2.5 px-4 font-bold text-white tabular-nums">{grandFatal.toLocaleString()}</td>
                            <td className="py-2.5 px-4 font-bold tabular-nums">
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold"
                                style={{
                                  backgroundColor: grandFatalPct >= 50 ? '#EF444430' : grandFatalPct > 0 ? '#F59E0B20' : '#22C55E15',
                                  color:           grandFatalPct >= 50 ? '#EF4444'   : grandFatalPct > 0 ? '#F59E0B'   : '#22C55E',
                                }}>
                                {grandFatalPct.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              })() : (
                <div className="bg-[#1E293B] border border-white/5 rounded-xl flex items-center justify-center text-slate-600 text-xs py-10">
                  No ACHT data
                </div>
              )}
            </div>

            {/* Portfolio Insight */}
            <div className="bg-[#1E293B]/60 border border-white/5 rounded-2xl px-5 py-5 mb-6">
              {/* Section header */}
              <div className="flex items-center gap-2 mb-5">
                <div className="w-1 h-5 rounded-full bg-violet-500" />
                <h2 className="text-sm font-bold text-white uppercase tracking-widest">Portfolio Insight</h2>
              </div>

            {/* Threat & Scam Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">

              {/* Social Media & Consumer Court Threat */}
              <div
                className="relative flex items-center gap-4 bg-[#1E293B] border border-orange-500/20 rounded-xl px-5 py-4 overflow-hidden cursor-pointer hover:bg-white/[0.03] transition-colors"
                title="Click to view detail breakdown"
                onClick={() => socialThreats.length > 0 && setDrillModal({
                  title: 'Social Media & Consumer Court Threat — Detail Breakdown',
                  accent: '#F97316',
                  columns: [{ key: 'Scenario', label: 'Scenario' }, { key: 'Scenario1', label: 'Scenario1' }, { key: 'Count', label: 'Count' }, { key: 'Count%', label: 'Count%' }],
                  rows: socialThreats.map(r => ({ Scenario: r.scenario, Scenario1: r.scenario1, Count: r.count, 'Count%': `${r.pct}%` })),
                })}>
                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-orange-500" />
                <div className="p-3 rounded-xl bg-orange-500/10 shrink-0">
                  <ShieldAlert size={22} className="text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-slate-200 uppercase tracking-widest leading-tight mb-1">
                    Social Media &amp; Consumer Court Threat
                  </p>
                  {loading ? (
                    <div className="h-8 w-20 bg-white/5 rounded animate-pulse" />
                  ) : (
                    <div className="flex items-end gap-2">
                      <span className="text-3xl font-black text-orange-400 tabular-nums leading-none">
                        {(kpis?.social_media_court_threat ?? 0).toLocaleString()}
                      </span>
                      <span className="text-xs text-slate-300 mb-0.5">
                        calls ({kpis && kpis.audit_count > 0
                          ? ((kpis.social_media_court_threat / kpis.audit_count) * 100).toFixed(1)
                          : 0}%) · Click to view
                      </span>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-300 mt-1">
                    sensetive_word: social / court / consumer / legal / fir
                  </p>
                </div>
              </div>

              {/* Potential Scam */}
              <div
                className="relative flex items-center gap-4 bg-[#1E293B] border border-red-500/20 rounded-xl px-5 py-4 overflow-hidden cursor-pointer hover:bg-white/[0.03] transition-colors"
                title="Click to view detail breakdown"
                onClick={() => potentialScams.length > 0 && setDrillModal({
                  title: 'Potential Scam Leads — Detail Breakdown',
                  accent: '#EF4444',
                  columns: [{ key: 'Scenario', label: 'Scenario' }, { key: 'Scenario1', label: 'Scenario1' }, { key: 'Count', label: 'Count' }, { key: 'Count%', label: 'Count%' }],
                  rows: potentialScams.map(r => ({ Scenario: r.scenario, Scenario1: r.scenario1, Count: r.count, 'Count%': `${r.pct}%` })),
                })}>
                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-red-500" />
                <div className="p-3 rounded-xl bg-red-500/10 shrink-0">
                  <AlertOctagon size={22} className="text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-slate-200 uppercase tracking-widest leading-tight mb-1">
                    Potential Scam
                  </p>
                  {loading ? (
                    <div className="h-8 w-20 bg-white/5 rounded animate-pulse" />
                  ) : (
                    <div className="flex items-end gap-2">
                      <span className="text-3xl font-black text-red-400 tabular-nums leading-none">
                        {(kpis?.potential_scam ?? 0).toLocaleString()}
                      </span>
                      <span className="text-xs text-slate-300 mb-0.5">
                        calls ({kpis && kpis.audit_count > 0
                          ? ((kpis.potential_scam / kpis.audit_count) * 100).toFixed(1)
                          : 0}%) · Click to view
                      </span>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-300 mt-1">
                    Sys. manipulation / Financial fraud / Collusion / Policy failure = Yes
                  </p>
                </div>
              </div>

            </div>

            {/* Top Negative Signals */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-rose-500" />
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Top Negative Signals</h3>
                <span className="ml-auto text-[10px] text-slate-400">Based on top_negative_words categorisation</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  { label: 'Frustration', key: 'frustration_count' as const, color: '#F59E0B', bg: '#F59E0B15', icon: '😤' },
                  { label: 'Threat',      key: 'threat_count'      as const, color: '#EF4444', bg: '#EF444415', icon: '⚠️' },
                  { label: 'Abuse',       key: 'abuse_count'       as const, color: '#A855F7', bg: '#A855F715', icon: '🚫' },
                  { label: 'Slang',       key: 'slang_count'       as const, color: '#3B82F6', bg: '#3B82F615', icon: '💬' },
                  { label: 'Sarcasm',     key: 'sarcasm_count'     as const, color: '#14B8A6', bg: '#14B8A615', icon: '🙃' },
                ].map(({ label, key, color, bg, icon }) => {
                  const count = kpis?.[key] ?? 0;
                  const pct   = kpis && kpis.audit_count > 0
                    ? ((count / kpis.audit_count) * 100).toFixed(1)
                    : '0.0';
                  const filtered = negSignalDetails.filter(r => r.neg_signal === label);
                  return (
                    <div key={label}
                      className="relative flex flex-col gap-2 rounded-xl border border-white/5 px-4 py-4 overflow-hidden cursor-pointer hover:brightness-110 transition-all"
                      style={{ backgroundColor: bg }}
                      title={`Click to view ${label} signal details`}
                      onClick={() => filtered.length > 0 && setDrillModal({
                        title: `${label} Signal — Scenario Breakdown`,
                        accent: color,
                        columns: [
                          { key: 'Scenario',  label: 'Scenario'  },
                          { key: 'Scenario1', label: 'Scenario1' },
                          { key: 'Count',     label: 'Count'     },
                          { key: 'Count%',    label: 'Count%'    },
                        ],
                        rows: filtered.map(r => ({ Scenario: r.scenario, Scenario1: r.scenario1, Count: r.count, 'Count%': `${r.pct}%` })),
                      })}>
                      <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl" style={{ backgroundColor: color }} />
                      <div className="flex items-center justify-between">
                        <span className="text-base">{icon}</span>
                        <span className="text-[10px] font-bold rounded-full px-2 py-0.5"
                          style={{ backgroundColor: `${color}25`, color }}>
                          {pct}%
                        </span>
                      </div>
                      {loading ? (
                        <div className="h-7 w-16 bg-white/10 rounded animate-pulse" />
                      ) : (
                        <span className="text-2xl font-black tabular-nums" style={{ color }}>
                          {count.toLocaleString()}
                        </span>
                      )}
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-300">
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            </div> {/* /Portfolio Insight */}

            {/* Fatal count banner (if any) */}
            {!loading && (kpis?.fatal_count ?? 0) > 0 && (
              <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-red-500/20 bg-red-500/5 mb-6">
                <AlertTriangle size={14} className="text-red-400 shrink-0" />
                <span className="text-xs text-red-300">
                  <span className="font-bold">{kpis!.fatal_count}</span> fatal call{kpis!.fatal_count !== 1 ? 's' : ''} (quality score = 0) excluded from W/O Fatal CQ Score
                </span>
              </div>
            )}

            {/* Top 5 Performers + 7-Day Chart */}
            {(() => {
              // Pad daily chart to always show 7 days ending at endDate
              const ed7 = new Date(endDate);
              const chartData = Array.from({ length: 7 }, (_, i) => {
                const d = new Date(ed7);
                d.setDate(d.getDate() - (6 - i));
                const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                const hit = dailyScores.find(s => s.call_date === key);
                return {
                  date: key,
                  label: d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
                  score: hit?.avg_score ?? null,
                  audits: hit?.audit_count ?? 0,
                  target: 95,
                };
              });

              const RANK_COLORS = ['#F59E0B','#94A3B8','#CD7F32','#64748B','#64748B'];
              const RANK_LABELS = ['1st','2nd','3rd','4th','5th'];

              return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6 mb-6">

                  {/* Top 5 Performers */}
                  <div className="bg-[#1E293B] border border-white/5 rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
                      <Trophy size={13} className="text-amber-400" />
                      <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Top 5 Performers</h3>
                      <ExportBtn onClick={() => downloadCSV(performers.map((p, i) => ({ Rank: i + 1, Agent: p.user, Audits: p.audit_count, 'Avg Score%': p.avg_score })), 'top-performers.csv')} />
                    </div>
                    <div className="p-4 space-y-2.5">
                      {performers.length === 0 ? (
                        <p className="text-xs text-slate-600 py-6 text-center">No agent data found</p>
                      ) : performers.map((p, i) => (
                        <div key={p.user}
                          className="flex items-center gap-3 cursor-pointer hover:bg-white/[0.03] rounded-lg px-1 transition-colors"
                          title={`Click to drill into ${p.user}'s performance`}
                          onClick={() => openBandDetail('no_fatal', `${p.user} — Performance Breakdown`, RANK_COLORS[i])}>
                          <div className="flex items-center justify-center w-8 h-8 rounded-lg text-[10px] font-black shrink-0"
                            style={{ backgroundColor: `${RANK_COLORS[i]}20`, color: RANK_COLORS[i] }}>
                            {RANK_LABELS[i]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-slate-200 truncate">{p.user}</span>
                              <span className="text-xs font-bold ml-2 shrink-0"
                                style={{ color: cqColor(p.avg_score) }}>
                                {p.avg_score}%
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${Math.min(p.avg_score, 100)}%`,
                                  backgroundColor: cqColor(p.avg_score),
                                }} />
                            </div>
                            <span className="text-[10px] text-slate-400 mt-0.5">{p.audit_count} audits · Click to drill</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 7-Day Bar Chart: Score vs Target */}
                  <div className="bg-[#1E293B] border border-white/5 rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
                      <Target size={13} className="text-sky-400" />
                      <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Last 7 Days vs Target</h3>
                      <ExportBtn onClick={() => downloadCSV(chartData.map(d => ({ Date: d.date, 'Avg Score%': d.score ?? 'No data', 'Audit Count': d.audits, Target: d.target })), 'last-7-days.csv')} />
                      <span className="ml-auto flex items-center gap-1.5 text-[10px] text-red-400 font-semibold">
                        <span className="w-4 h-0.5 bg-red-400 rounded inline-block" />
                        Target 95%
                      </span>
                    </div>
                    <div className="p-4">
                      <ResponsiveContainer width="100%" height={220}>
                        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                          <XAxis
                            dataKey="label"
                            tick={{ fill: '#64748B', fontSize: 10 }}
                            axisLine={false} tickLine={false}
                          />
                          <YAxis
                            domain={[0, 100]}
                            tick={{ fill: '#64748B', fontSize: 10 }}
                            axisLine={false} tickLine={false}
                            tickFormatter={v => `${v}%`}
                          />
                          <Tooltip
                            contentStyle={{ background: '#0F172A', border: '1px solid #ffffff15', borderRadius: 8, fontSize: 11 }}
                            formatter={(val: unknown, name: unknown) => [
                              name === 'score' ? `${val ?? 'No data'}%` : `${val}%`,
                              name === 'score' ? 'Quality Score' : 'Target',
                            ]}
                            labelStyle={{ color: '#94A3B8', marginBottom: 4 }}
                          />
                          <ReferenceLine
                            y={95}
                            stroke="#EF4444"
                            strokeDasharray="5 3"
                            strokeWidth={1.5}
                          />
                          <Bar
                            dataKey="score"
                            name="score"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={36}
                          >
                            {chartData.map((d, i) => (
                              <Cell
                                key={i}
                                fill={d.score === null ? '#1E293B' : d.score >= 95 ? '#22C55E' : d.score >= 85 ? '#3B82F6' : '#F59E0B'}
                                fillOpacity={d.score === null ? 0.2 : 1}
                              />
                            ))}
                          </Bar>
                        </ComposedChart>
                      </ResponsiveContainer>
                      <div className="flex items-center justify-center gap-5 mt-1">
                        {[
                          { color: '#22C55E', label: '≥95% (On Target)' },
                          { color: '#3B82F6', label: '85–94%' },
                          { color: '#F59E0B', label: '<85%' },
                        ].map(l => (
                          <div key={l.label} className="flex items-center gap-1.5 text-[10px] text-slate-500">
                            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: l.color }} />
                            {l.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              );
            })()}

            {/* ── Agent Audit Summary ───────────────────────────────────── */}
            {agentAuditBand.length > 0 && (() => {
              const cq = (v: number) => v >= 80 ? '#10B981' : v >= 60 ? '#F59E0B' : '#EF4444';
              const stackBadge = (score: number) => {
                const label = score > 95 ? 'TQ' : score > 85 ? 'MQ' : 'BQ';
                const c = label === 'TQ'
                  ? { bg: '#22C55E1A', text: '#22C55E', border: '#22C55E40' }
                  : label === 'MQ'
                  ? { bg: '#F59E0B1A', text: '#F59E0B', border: '#F59E0B40' }
                  : { bg: '#EF44441A', text: '#EF4444', border: '#EF444440' };
                return (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border"
                    style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}>
                    {label}
                  </span>
                );
              };
              const total_audits = agentAuditBand.reduce((s, r) => s + r.audit_count, 0);
              const total_fatals = agentAuditBand.reduce((s, r) => s + r.fatal_count, 0);
              const total_tq     = agentAuditBand.reduce((s, r) => s + r.tq_count,    0);
              const total_mq     = agentAuditBand.reduce((s, r) => s + r.mq_count,    0);
              const total_bq     = agentAuditBand.reduce((s, r) => s + r.bq_count,    0);
              const avg_cq       = agentAuditBand.reduce((s, r) => s + r.cq_score, 0) / agentAuditBand.length;
              return (
                <div className="mb-6 bg-[#1E293B] border border-white/5 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3 flex-wrap">
                    <div className="w-1 h-4 rounded-full bg-sky-500 shrink-0" />
                    <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Agent Audit Summary</h3>
                    <span className="text-[10px] text-slate-300 ml-1">TQ ≥80% · MQ 60–79% · BQ &lt;60% · Stack Ranking: &gt;95% TQ · &gt;85% MQ · else BQ</span>
                    <ExportBtn onClick={() => downloadCSV(agentAuditBand.map((r, i) => ({
                      '#': i + 1,
                      'Agent':           r.agent,
                      'Audit Count':     r.audit_count,
                      'CQ Score%':       r.cq_score,
                      'Stack Ranking':   r.cq_score > 95 ? 'TQ' : r.cq_score > 85 ? 'MQ' : 'BQ',
                      'Fatal Count':     r.fatal_count,
                      'Fatal%':          r.fatal_pct,
                      'TQ (≥80%)':       r.tq_count,
                      'MQ (60-79%)':     r.mq_count,
                      'BQ (<60%)':       r.bq_count,
                    })), 'agent-audit-summary.csv')} />
                  </div>
                  <div className="overflow-x-auto overflow-y-auto max-h-96">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-[#1E293B] z-10">
                        <tr className="border-b border-white/5 bg-white/[0.02]">
                          {[
                            { label: '#',              cls: 'w-8 text-center' },
                            { label: 'Agent',           cls: 'text-left' },
                            { label: 'Audit Count',     cls: 'text-right' },
                            { label: 'CQ Score%',       cls: 'text-right' },
                            { label: 'Stack Ranking',   cls: 'text-center text-violet-400' },
                            { label: 'Fatal Count',     cls: 'text-right' },
                            { label: 'Fatal%',          cls: 'text-right' },
                            { label: 'TQ',              cls: 'text-right text-emerald-400' },
                            { label: 'MQ',              cls: 'text-right text-amber-400'   },
                            { label: 'BQ',              cls: 'text-right text-red-400'     },
                          ].map(h => (
                            <th key={h.label} className={`py-2.5 px-3 font-semibold uppercase tracking-wider text-[9px] whitespace-nowrap ${h.cls || 'text-slate-300'}`}>
                              {h.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {agentAuditBand.map((r, i) => (
                          <tr key={r.agent}
                            className="border-b border-white/5 hover:bg-white/[0.04] transition-colors cursor-pointer"
                            title={`Click to drill into ${r.agent}'s band detail`}
                            onClick={() => openBandDetail('no_fatal', `${r.agent} — Band Detail`, r.cq_score > 95 ? '#22C55E' : r.cq_score > 85 ? '#F59E0B' : '#EF4444')}>
                            <td className="py-2 px-3 text-slate-400 text-center">{i + 1}</td>
                            <td className="py-2 px-3 font-medium text-white whitespace-nowrap">{r.agent}</td>
                            <td className="py-2 px-3 text-right text-slate-200">{r.audit_count.toLocaleString()}</td>
                            <td className="py-2 px-3 text-right font-bold" style={{ color: cq(r.cq_score) }}>{r.cq_score.toFixed(1)}%</td>
                            <td className="py-2 px-3 text-center">{stackBadge(r.cq_score)}</td>
                            <td className="py-2 px-3 text-right font-semibold" style={{ color: r.fatal_count > 0 ? '#EF4444' : '#94A3B8' }}>
                              {r.fatal_count > 0 ? r.fatal_count.toLocaleString() : '—'}
                            </td>
                            <td className="py-2 px-3 text-right font-semibold" style={{ color: r.fatal_pct > 0 ? '#EF4444' : '#94A3B8' }}>
                              {r.fatal_pct > 0 ? `${r.fatal_pct.toFixed(1)}%` : '—'}
                            </td>
                            <td className="py-2 px-3 text-right font-semibold text-emerald-400">
                              {r.tq_count > 0 ? r.tq_count.toLocaleString() : <span className="text-slate-400">0</span>}
                            </td>
                            <td className="py-2 px-3 text-right font-semibold text-amber-400">
                              {r.mq_count > 0 ? r.mq_count.toLocaleString() : <span className="text-slate-400">0</span>}
                            </td>
                            <td className="py-2 px-3 text-right font-semibold" style={{ color: r.bq_count > 0 ? '#EF4444' : '#94A3B8' }}>
                              {r.bq_count > 0 ? r.bq_count.toLocaleString() : <span className="text-slate-400">0</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-white/10 bg-white/[0.02]">
                          <td className="py-2 px-3 text-[10px] text-slate-200 font-semibold" colSpan={2}>
                            Total ({agentAuditBand.length} agents)
                          </td>
                          <td className="py-2 px-3 text-right text-[10px] font-semibold text-slate-200">{total_audits.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right text-[10px] font-bold" style={{ color: cq(avg_cq) }}>{avg_cq.toFixed(1)}%</td>
                          <td className="py-2 px-3 text-center">{stackBadge(avg_cq)}</td>
                          <td className="py-2 px-3 text-right text-[10px] font-semibold text-red-400">{total_fatals.toLocaleString()}</td>
                          <td className="py-2 px-3" />
                          <td className="py-2 px-3 text-right text-[10px] font-semibold text-emerald-400">{total_tq.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right text-[10px] font-semibold text-amber-400">{total_mq.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right text-[10px] font-semibold text-red-400">{total_bq.toLocaleString()}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              );
            })()}

            {/* Scenario Distribution */}
            {scenarios.length > 0 && (() => {
              const filteredScenarios = scenarios.filter(s => s.scenario.trim().toLowerCase() !== 'unknown');
              const activeChildren = selectedScenario
                ? (filteredScenarios.find(s => s.scenario === selectedScenario)?.children ?? [])
                : null;

              return (
                <div className="mt-6 mb-6 bg-[#1E293B] border border-white/5 rounded-xl overflow-hidden">
                  {/* Header */}
                  <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2 flex-wrap">
                    <div className="w-1 h-4 rounded-full bg-blue-500" />
                    <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">
                      Scenario Distribution
                    </h3>
                    <ExportBtn onClick={() => downloadCSV(filteredScenarios.map(s => ({ Scenario: s.scenario, Count: s.count, 'Count%': `${s.pct}%` })), 'scenario-distribution.csv')} />
                    {selectedScenario && (
                      <>
                        <span className="text-slate-600 text-xs">→</span>
                        <span className="text-xs font-bold text-blue-400">{selectedScenario}</span>
                        <button
                          onClick={() => setSelectedScenario(null)}
                          className="ml-auto text-[10px] text-slate-500 hover:text-slate-300 border border-white/10 rounded px-2 py-0.5 transition-colors">
                          ✕ Clear
                        </button>
                      </>
                    )}
                    {!selectedScenario && (
                      <span className="ml-auto text-[10px] text-slate-400">Click a slice or row to drill down</span>
                    )}
                  </div>

                  <div className="flex flex-col lg:flex-row">
                    {/* Left — Pie Chart */}
                    <div className="lg:w-[45%] p-4 flex flex-col items-center">
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Pie
                            data={filteredScenarios}
                            dataKey="count"
                            nameKey="scenario"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            innerRadius={48}
                            paddingAngle={2}
                            onClick={(d: ScenarioItem) => setSelectedScenario(prev => prev === d.scenario ? null : d.scenario)}
                            style={{ cursor: 'pointer' }}
                            labelLine={false}
                            label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }: {
                              cx: number; cy: number; midAngle: number; innerRadius: number;
                              outerRadius: number; percent: number; index: number;
                            }) => {
                              if (percent < 0.06) return null;
                              const R = Math.PI / 180;
                              const r = innerRadius + (outerRadius - innerRadius) * 0.55;
                              return (
                                <text
                                  x={cx + r * Math.cos(-midAngle * R)}
                                  y={cy + r * Math.sin(-midAngle * R)}
                                  fill="#fff" textAnchor="middle" dominantBaseline="central"
                                  fontSize={10} fontWeight={700}>
                                  {`${(percent * 100).toFixed(0)}%`}
                                </text>
                              );
                            }}
                          >
                            {filteredScenarios.map((s, i) => (
                              <Cell
                                key={i}
                                fill={SCENARIO_COLORS[i % SCENARIO_COLORS.length]}
                                opacity={selectedScenario && selectedScenario !== s.scenario ? 0.35 : 1}
                                stroke={selectedScenario === s.scenario ? '#fff' : 'transparent'}
                                strokeWidth={selectedScenario === s.scenario ? 2 : 0}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ background: '#0F172A', border: '1px solid #ffffff15', borderRadius: 8, fontSize: 11 }}
                            formatter={(v: unknown, n: unknown) => [
                              `${Number(v).toLocaleString()} calls (${filteredScenarios.find(s => s.scenario === n)?.pct ?? 0}%)`,
                              String(n),
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>

                      {/* Legend */}
                      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-1">
                        {filteredScenarios.map((s, i) => (
                          <button
                            key={s.scenario}
                            onClick={() => setSelectedScenario(prev => prev === s.scenario ? null : s.scenario)}
                            className="flex items-center gap-1.5 text-[10px] hover:opacity-80 transition-opacity"
                            style={{ opacity: selectedScenario && selectedScenario !== s.scenario ? 0.4 : 1 }}>
                            <span className="w-2.5 h-2.5 rounded-sm shrink-0"
                              style={{ background: SCENARIO_COLORS[i % SCENARIO_COLORS.length] }} />
                            <span className="text-slate-400">{s.scenario}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Right — Table */}
                    <div className="lg:w-[55%] border-t lg:border-t-0 lg:border-l border-white/5 overflow-hidden">
                      {!selectedScenario ? (
                        /* All scenarios summary */
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-white/5 bg-white/[0.02]">
                              {['Scenario', 'Count', 'Count %'].map(h => (
                                <th key={h} className="py-2.5 px-4 text-left text-slate-300 font-semibold uppercase tracking-wider">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredScenarios.map((s, i) => (
                              <tr key={s.scenario}
                                onClick={() => setSelectedScenario(s.scenario)}
                                className="border-b border-white/[0.04] hover:bg-white/[0.04] cursor-pointer transition-colors">
                                <td className="py-2.5 px-4 flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-sm shrink-0"
                                    style={{ background: SCENARIO_COLORS[i % SCENARIO_COLORS.length] }} />
                                  <span className="text-slate-200 font-medium">{s.scenario}</span>
                                </td>
                                <td className="py-2.5 px-4 text-slate-300 tabular-nums font-semibold">
                                  {s.count.toLocaleString()}
                                </td>
                                <td className="py-2.5 px-4 tabular-nums">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden max-w-[80px]">
                                      <div className="h-full rounded-full"
                                        style={{ width: `${s.pct}%`, background: SCENARIO_COLORS[i % SCENARIO_COLORS.length] }} />
                                    </div>
                                    <span className="text-slate-300 font-semibold">{s.pct}%</span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        /* Scenario1 drill-down */
                        <div>
                          <div className="px-4 py-2.5 border-b border-white/5 bg-white/[0.02]">
                            <p className="text-[10px] text-slate-300 uppercase tracking-wider font-semibold">
                              {selectedScenario} — Sub-scenario breakdown
                            </p>
                          </div>
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-white/5">
                                {['Scenario 1', 'Count', 'Count %'].map(h => (
                                  <th key={h} className="py-2.5 px-4 text-left text-slate-300 font-semibold uppercase tracking-wider">
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(activeChildren ?? []).map((c, i) => {
                                const scenIdx = filteredScenarios.findIndex(s => s.scenario === selectedScenario);
                                const color   = SCENARIO_COLORS[scenIdx % SCENARIO_COLORS.length];
                                return (
                                  <tr key={i}
                                    className={`border-b border-white/[0.04] ${i % 2 === 0 ? '' : 'bg-white/[0.01]'}`}>
                                    <td className="py-2.5 px-4 text-slate-200">{c.scenario1}</td>
                                    <td className="py-2.5 px-4 text-slate-300 tabular-nums font-semibold">
                                      {c.count.toLocaleString()}
                                    </td>
                                    <td className="py-2.5 px-4 tabular-nums">
                                      <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden max-w-[80px]">
                                          <div className="h-full rounded-full"
                                            style={{ width: `${c.pct}%`, background: color }} />
                                        </div>
                                        <span className="text-slate-300 font-semibold">{c.pct}%</span>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── Alert Field Tables ─────────────────────────────────────── */}
            {(socialThreats.length > 0 || negSignalDetails.length > 0 || potentialScams.length > 0) && (() => {
              const negColor: Record<string, string> = {
                Frustration: '#F97316', Threat: '#EF4444', Abuse: '#A855F7',
                Slang: '#3B82F6', Sarcasm: '#14B8A6',
              };
              const totalSocial  = socialThreats.reduce((s, r) => s + r.count, 0);
              const totalNeg     = negSignalDetails.reduce((s, r) => s + r.count, 0);
              const totalScam    = potentialScams.reduce((s, r) => s + r.count, 0);

              const AlertTable = ({
                title, accentColor, rows, extraCol,
              }: {
                title: string;
                accentColor: string;
                rows: Array<{ scenario: string; scenario1: string; count: number; pct: number; extra?: string }>;
                extraCol?: string;
              }) => (
                <div className="bg-[#1E293B] border border-white/5 rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
                    <div className="w-1 h-4 rounded-full" style={{ background: accentColor }} />
                    <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">{title}</h3>
                    <ExportBtn onClick={() => downloadCSV(rows.map(r => ({ Scenario: r.scenario, Scenario1: r.scenario1, ...(extraCol ? { [extraCol]: r.extra } : {}), Count: r.count, 'Count%': `${r.pct}%` })), `${title.replace(/\s+/g,'-').toLowerCase()}.csv`)} />
                    <span className="ml-auto text-xs font-bold" style={{ color: accentColor }}>
                      {rows.reduce((s, r) => s + r.count, 0).toLocaleString()} calls
                    </span>
                  </div>
                  {rows.length === 0 ? (
                    <p className="text-xs text-slate-600 p-4">No data for selected period.</p>
                  ) : (
                    <div className="overflow-y-auto max-h-64">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-[#1E293B] z-10">
                          <tr className="border-b border-white/5 bg-white/[0.02]">
                            <th className="py-2.5 px-4 text-left text-slate-300 font-semibold uppercase tracking-wider">Scenario</th>
                            <th className="py-2.5 px-4 text-left text-slate-300 font-semibold uppercase tracking-wider">Scenario1</th>
                            {extraCol && <th className="py-2.5 px-4 text-left text-slate-300 font-semibold uppercase tracking-wider">{extraCol}</th>}
                            <th className="py-2.5 px-4 text-left text-slate-300 font-semibold uppercase tracking-wider">Count</th>
                            <th className="py-2.5 px-4 text-left text-slate-300 font-semibold uppercase tracking-wider">Count%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r, i) => (
                            <tr key={i} className={`border-b border-white/[0.04] ${i % 2 === 0 ? '' : 'bg-white/[0.01]'}`}>
                              <td className="py-2.5 px-4 text-slate-300">{r.scenario}</td>
                              <td className="py-2.5 px-4 text-slate-400">{r.scenario1}</td>
                              {extraCol && (
                                <td className="py-2.5 px-4">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                                    style={{
                                      background: `${negColor[r.extra ?? ''] ?? '#64748B'}22`,
                                      color: negColor[r.extra ?? ''] ?? '#94A3B8',
                                    }}>
                                    {r.extra}
                                  </span>
                                </td>
                              )}
                              <td className="py-2.5 px-4 text-slate-200 font-semibold tabular-nums">{r.count.toLocaleString()}</td>
                              <td className="py-2.5 px-4 tabular-nums">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden max-w-[60px]">
                                    <div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: accentColor }} />
                                  </div>
                                  <span className="text-slate-300 font-semibold">{r.pct}%</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t border-white/10">
                          <tr className="bg-white/[0.03]">
                            <td colSpan={extraCol ? 3 : 2} className="py-2.5 px-4 text-slate-300 font-semibold text-[10px] uppercase">Total</td>
                            <td className="py-2.5 px-4 text-white font-bold tabular-nums">{rows.reduce((s, r) => s + r.count, 0).toLocaleString()}</td>
                            <td className="py-2.5 px-4 text-white font-bold">100%</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              );

              return (
                <div className="mt-6 mb-6 space-y-4">
                  {socialThreats.length > 0 && (
                    <AlertTable
                      title="Social Media & Consumer Court Threat"
                      accentColor="#F97316"
                      rows={socialThreats.map(r => ({ ...r, extra: undefined }))}
                    />
                  )}

                  {/* Sensitive Word Analysis — two metrics below the social threats table */}
                  {sensitiveWordAnalysis && (
                    <div className="bg-[#1E293B] border border-white/5 rounded-xl overflow-hidden">
                      <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
                        <div className="w-1 h-4 rounded-full bg-orange-400" />
                        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">
                          Sensitive Word Use Analysis
                        </h3>
                      </div>
                      <div className="flex flex-col lg:flex-row">
                        {/* Left — Sensitive Word Use distribution */}
                        <div className="lg:w-[65%] overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-white/5 bg-white/[0.02]">
                                {['Sensitive Word Use', 'Count', 'Count%'].map(h => (
                                  <th key={h} className="py-2.5 px-4 text-left text-slate-300 font-semibold uppercase tracking-wider">
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {sensitiveWordAnalysis.distribution.map((r, i) => (
                                <tr key={i} className={`border-b border-white/[0.04] ${i % 2 === 0 ? '' : 'bg-white/[0.01]'}`}>
                                  <td className="py-3 px-4 text-slate-200 leading-snug">{r.label}</td>
                                  <td className="py-3 px-4 text-slate-300 font-bold tabular-nums whitespace-nowrap">{r.count.toLocaleString()}</td>
                                  <td className="py-3 px-4 tabular-nums whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden max-w-[60px]">
                                        <div className="h-full rounded-full bg-orange-400" style={{ width: `${r.pct}%` }} />
                                      </div>
                                      <span className="text-slate-300 font-semibold">{r.pct}%</span>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="border-t border-white/10">
                              <tr className="bg-white/[0.03]">
                                <td className="py-2.5 px-4 text-slate-300 font-semibold text-[10px] uppercase">Total</td>
                                <td className="py-2.5 px-4 text-white font-bold tabular-nums">
                                  {sensitiveWordAnalysis.distribution.reduce((s, r) => s + r.count, 0).toLocaleString()}
                                </td>
                                <td className="py-2.5 px-4 text-white font-bold">100%</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>

                        {/* Right — Dimension counts */}
                        <div className="lg:w-[35%] border-t lg:border-t-0 lg:border-l border-white/5 p-4 flex flex-col gap-3 justify-center">
                          <p className="text-[10px] text-slate-300 uppercase tracking-widest font-semibold mb-1">
                            Dimension
                          </p>
                          {[
                            { label: sensitiveWordAnalysis.akash_label, count: sensitiveWordAnalysis.akash_count,  color: '#A855F7', note: 'CX mentioned co-founder name' },
                            { label: 'Social Media',                    count: sensitiveWordAnalysis.social_count, color: '#3B82F6', note: 'CX threatened social media' },
                            { label: 'Consumer Court',                  count: sensitiveWordAnalysis.court_count,  color: '#F97316', note: 'CX mentioned court/legal/FIR' },
                          ].map(d => (
                            <div key={d.label} className="flex items-center gap-3 bg-white/[0.03] rounded-lg px-3 py-3 border border-white/5">
                              <div className="w-1 self-stretch rounded-full shrink-0" style={{ background: d.color }} />
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-slate-300 uppercase tracking-widest">{d.label}</p>
                                <p className="text-slate-400 text-[9px] leading-tight">{d.note}</p>
                              </div>
                              <span className="text-xl font-bold tabular-nums" style={{ color: d.color }}>
                                {d.count.toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {negSignalDetails.length > 0 && (
                    <AlertTable
                      title="Top Negative Signals"
                      accentColor="#F59E0B"
                      extraCol="Signal Type"
                      rows={negSignalDetails.map(r => ({ ...r, extra: r.neg_signal }))}
                    />
                  )}
                  {potentialScams.length > 0 && (
                    <AlertTable
                      title="Potential Scam Leads"
                      accentColor="#EF4444"
                      rows={potentialScams.map(r => ({ ...r, extra: undefined }))}
                    />
                  )}
                  {/* summary strip */}
                  <div className="flex gap-3">
                    {[
                      { label: 'Social Media & Court Threats', count: totalSocial, color: '#F97316' },
                      { label: 'Top Negative Signal Calls',    count: totalNeg,    color: '#F59E0B' },
                      { label: 'Potential Scam Leads',         count: totalScam,   color: '#EF4444' },
                    ].map(s => (
                      <div key={s.label} className="flex-1 bg-[#1E293B] border border-white/5 rounded-xl px-4 py-3 flex items-center gap-3">
                        <div className="w-1 self-stretch rounded-full" style={{ background: s.color }} />
                        <div>
                          <p className="text-[10px] text-slate-300 uppercase tracking-widest">{s.label}</p>
                          <p className="text-xl font-bold text-white">{s.count.toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}



            {!loading && (!kpis || kpis.audit_count === 0) && (
              <div className="flex items-center justify-center py-20 text-slate-600 text-sm">
                No audit data found for this period.
              </div>
            )}
          </>
        )}

        {/* ── Fatal Analysis Slide ─────────────────────────────────────── */}
        {activeSlide === 1 && (() => {
          const fd = fatalData;
          if (fatalLoading || !fd) {
            return (
              <div className="flex items-center justify-center py-20 text-slate-600 text-sm">
                {fatalLoading ? 'Loading fatal analysis…' : 'No fatal data for this period.'}
              </div>
            );
          }

          // Heat-map colour helper
          const heatBg = (val: number, max: number) => {
            if (!val || !max) return '';
            const a = 0.15 + (val / max) * 0.65;
            return `rgba(239,68,68,${a.toFixed(2)})`;
          };

          // Chart data — reverse day_wise (ASC) for chart, keep DESC for table
          const chartData = [...fd.day_wise].reverse().map(r => ({
            date:  r.call_date.slice(5).replace('-', '/'),
            count: r.total_fatal,
            pct:   r.fatal_pct,
          }));

          const dayMaxFatal = Math.max(...fd.day_wise.map(r => r.total_fatal), 1);

          // Grand totals for agent table
          const gt = fd.agent_performance.reduce(
            (acc, r) => ({
              audit: acc.audit + r.audit_count,
              fatal: acc.fatal + r.fatal_count,
            }),
            { audit: 0, fatal: 0 }
          );
          const gtCq  = fd.cq_score;
          const gtFp  = gt.audit > 0 ? Math.round(gt.fatal / gt.audit * 1000) / 10 : 0;

          const deltaVsTarget = (fd.cq_score - 98).toFixed(1);

          // Custom bar label renderer
          const renderFatalBarLabel = (props: { x?: number; y?: number; width?: number; value?: number; index?: number }) => {
            const { x = 0, y = 0, width = 0, value, index = 0 } = props;
            const row = chartData[index];
            if (!value) return <g />;
            return (
              <g>
                <text x={x + width / 2} y={y - 6}  textAnchor="middle" fill="#22D3EE" fontSize={9} fontWeight="bold">{value}</text>
                <text x={x + width / 2} y={y - 16} textAnchor="middle" fill="#EF4444" fontSize={8}>{row?.pct ?? 0}%</text>
              </g>
            );
          };

          const pctCell = (val: number) => {
            const color = val > 0 ? '#EF4444' : '#64748B';
            const bg    = val > 0 ? 'rgba(239,68,68,0.15)' : 'transparent';
            return (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ color, background: bg }}>
                {val > 0 ? `${val}%` : '0%'}
              </span>
            );
          };

          return (
            <>
              {/* ── KPI Cards ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                  {
                    label: 'CQ Score%', value: `${fd.cq_score}%`,
                    sub: <span className={`text-[10px] font-bold flex items-center gap-0.5 ${Number(deltaVsTarget) < 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {Number(deltaVsTarget) < 0 ? '▼' : '▲'} {deltaVsTarget}%
                    </span>,
                    color: fd.cq_score >= 90 ? '#22C55E' : '#EF4444',
                    onClick: () => setDrillModal({ title: 'Fatal Analysis — Scenario Fatal Breakdown', accent: '#EF4444', columns: [{ key: 'Scenario', label: 'Scenario' }, { key: 'Fatal Count', label: 'Fatal Count' }, { key: 'Fatal%', label: 'Fatal%' }], rows: [{ Scenario: 'Query', 'Fatal Count': fd.query_fatal, 'Fatal%': fd.audit_count > 0 ? `${((fd.query_fatal / fd.audit_count) * 100).toFixed(1)}%` : '0%' }, { Scenario: 'Complaint', 'Fatal Count': fd.complaint_fatal, 'Fatal%': fd.audit_count > 0 ? `${((fd.complaint_fatal / fd.audit_count) * 100).toFixed(1)}%` : '0%' }, { Scenario: 'Request', 'Fatal Count': fd.request_fatal, 'Fatal%': fd.audit_count > 0 ? `${((fd.request_fatal / fd.audit_count) * 100).toFixed(1)}%` : '0%' }, { Scenario: 'Sale Done', 'Fatal Count': fd.sale_done_fatal, 'Fatal%': fd.audit_count > 0 ? `${((fd.sale_done_fatal / fd.audit_count) * 100).toFixed(1)}%` : '0%' }] }),
                  },
                  {
                    label: 'Audit Count', value: fd.audit_count.toLocaleString(), sub: null, color: '#38BDF8',
                    onClick: () => setDrillModal({ title: 'Fatal Analysis — Day Wise Audit Count', accent: '#38BDF8', columns: [{ key: 'Date', label: 'Date' }, { key: 'Total', label: 'Total' }, { key: 'Null Fatal', label: 'Null Fatal' }, { key: 'Query Fatal', label: 'Query Fatal' }, { key: 'Complaint Fatal', label: 'Complaint Fatal' }, { key: 'Request Fatal', label: 'Request Fatal' }], rows: fd.day_wise.map(r => ({ Date: r.call_date, Total: r.total_count, 'Null Fatal': r.null_fatal, 'Query Fatal': r.query_fatal, 'Complaint Fatal': r.complaint_fatal, 'Request Fatal': r.request_fatal })) }),
                  },
                  {
                    label: 'Fatal Count', value: fd.fatal_count.toLocaleString(), sub: null, color: '#EF4444',
                    onClick: () => setDrillModal({ title: 'Top Fatal Contributors', accent: '#EF4444', columns: [{ key: 'Agent', label: 'Agent' }, { key: 'Audits', label: 'Audits' }, { key: 'Fatals', label: 'Fatals' }, { key: 'Fatal%', label: 'Fatal%' }], rows: fd.top_contributors.map(r => ({ Agent: r.agent_name, Audits: r.audit_count, Fatals: r.fatal_count, 'Fatal%': `${r.fatal_pct}%` })) }),
                  },
                  {
                    label: 'Fatal%', value: `${fd.fatal_pct}%`, sub: null, color: fd.fatal_pct >= 20 ? '#EF4444' : '#F59E0B',
                    onClick: () => setDrillModal({ title: 'Fatal% — Week & Scenario Breakdown', accent: '#F59E0B', columns: [{ key: 'Week', label: 'Week' }, { key: 'Query Fatal%', label: 'Query%' }, { key: 'Complaint Fatal%', label: 'Complaint%' }, { key: 'Request Fatal%', label: 'Request%' }, { key: 'Sale Done Fatal%', label: 'Sale Done%' }, { key: 'Total Fatal', label: 'Total' }], rows: fd.week_scenario.map(r => ({ Week: r.week_label, 'Query Fatal%': `${r.query_fatal_pct}%`, 'Complaint Fatal%': `${r.complaint_fatal_pct}%`, 'Request Fatal%': `${r.request_fatal_pct}%`, 'Sale Done Fatal%': `${r.sale_done_fatal_pct}%`, 'Total Fatal': r.total_fatal })) }),
                  },
                ].map(c => (
                  <div key={c.label}
                    className="relative bg-[#1E293B] border border-white/5 rounded-xl px-4 py-4 overflow-hidden cursor-pointer hover:bg-white/[0.03] transition-colors"
                    onClick={c.onClick}
                    title="Click for detail analysis">
                    <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ background: c.color }} />
                    <div className="pl-2">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">{c.label}</p>
                      <p className="text-2xl font-bold text-white leading-none">{c.value}</p>
                      {c.sub && <div className="mt-1">{c.sub}</div>}
                      <p className="text-[9px] text-slate-400 mt-1">Click to analyse</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Two-column layout ── */}
              <div className="grid lg:grid-cols-2 gap-4 mb-4">

                {/* LEFT column */}
                <div className="space-y-4">

                  {/* Top 5 Fatal Contributor */}
                  <div className="bg-[#1E293B] border border-white/5 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                      <div className="w-1 h-4 rounded-full bg-red-500" />
                      <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Top 5 Fatal Contributor</h3>
                      <ExportBtn onClick={() => downloadCSV(fd.top_contributors.map(r => ({ Agent: r.agent_name, Audits: r.audit_count, Fatals: r.fatal_count, 'Fatal%': r.fatal_pct })), 'fatal-contributors.csv')} />
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/5 bg-white/[0.02]">
                          {['Agent Name','Audit Count','Fatal Count','Fatal%'].map(h => (
                            <th key={h} className="py-2 px-4 text-left text-slate-300 font-semibold uppercase tracking-wider text-[10px]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {fd.top_contributors.map((r, i) => (
                          <tr key={i} className="border-b border-white/[0.04]">
                            <td className="py-2.5 px-4 text-slate-200">{r.agent_name}</td>
                            <td className="py-2.5 px-4 text-slate-300 tabular-nums">{r.audit_count}</td>
                            <td className="py-2.5 px-4 text-red-400 font-bold tabular-nums">{r.fatal_count}</td>
                            <td className="py-2.5 px-4">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-4 rounded bg-white/5 overflow-hidden max-w-[80px]">
                                  <div className="h-full rounded bg-red-500 flex items-center justify-center"
                                    style={{ width: `${Math.min(r.fatal_pct, 100)}%` }}>
                                    <span className="text-[9px] font-bold text-white px-1 whitespace-nowrap">{r.fatal_pct}%</span>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {fd.top_contributors.length === 0 && (
                          <tr><td colSpan={4} className="py-6 text-center text-slate-600 text-xs">No fatal calls</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Day Wise Fatal% chart */}
                  {chartData.length > 0 && (
                    <div className="bg-[#1E293B] border border-white/5 rounded-xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                        <div className="w-1 h-4 rounded-full bg-red-500" />
                        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Day Wise Fatal%</h3>
                      </div>
                      <div className="p-3">
                        <ResponsiveContainer width="100%" height={220}>
                          <ComposedChart data={chartData} margin={{ top: 28, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                            <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 9 }} />
                            <YAxis tick={{ fill: '#64748B', fontSize: 9 }} allowDecimals={false} />
                            <Tooltip
                              contentStyle={{ background: '#0F172A', border: '1px solid #ffffff15', borderRadius: 8, fontSize: 11 }}
                              formatter={(v: unknown, n: unknown) => [v, n === 'count' ? 'Fatal Count' : String(n)]}
                            />
                            <Bar dataKey="count" fill="#0EA5E9" radius={[3,3,0,0]} label={renderFatalBarLabel} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>

                {/* RIGHT column */}
                <div className="space-y-4">

                  {/* Scenario Wise Fatal Count — 4 cards */}
                  <div className="bg-[#1E293B] border border-white/5 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                      <div className="w-1 h-4 rounded-full bg-red-500" />
                      <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Scenario Wise Fatal Count</h3>
                    </div>
                    <div className="grid grid-cols-4 divide-x divide-white/5">
                      {[
                        { label: 'Query Fatal',     value: fd.query_fatal },
                        { label: 'Complaint Fatal',  value: fd.complaint_fatal },
                        { label: 'Request Fatal',    value: fd.request_fatal },
                        { label: 'Sale Done Fatal',  value: fd.sale_done_fatal },
                      ].map(c => (
                        <div key={c.label} className="px-3 py-4 text-center">
                          <p className="text-[9px] text-slate-300 uppercase tracking-wider mb-1">{c.label}</p>
                          <p className={`text-2xl font-bold ${c.value > 0 ? 'text-red-400' : 'text-slate-400'}`}>{c.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Day Wise / Fatal heat-map table */}
                  {fd.day_wise.length > 0 && (
                    <div className="bg-[#1E293B] border border-white/5 rounded-xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                        <div className="w-1 h-4 rounded-full bg-red-500" />
                        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Day Wise / Fatal</h3>
                        <ExportBtn onClick={() => downloadCSV(fd.day_wise.map(r => ({ Date: r.call_date, 'Query Fatal': r.query_fatal, 'Complaint Fatal': r.complaint_fatal, 'Request Fatal': r.request_fatal, 'Total Fatal': r.total_fatal, 'Fatal%': r.fatal_pct })), 'day-wise-fatal.csv')} />
                      </div>
                      <div className="overflow-y-auto max-h-52">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-[#1E293B] z-10">
                            <tr className="border-b border-white/5 bg-white/[0.02]">
                              {['Date','Query','Complaint','Request','Total'].map(h => (
                                <th key={h} className="py-2 px-3 text-left text-slate-300 font-semibold uppercase tracking-wider text-[9px]">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {fd.day_wise.map((r, i) => (
                              <tr key={i} className="border-b border-white/[0.04]">
                                <td className="py-2 px-3 text-slate-400 whitespace-nowrap">
                                  {r.call_date.slice(5).replace('-','/')}
                                </td>
                                {[r.query_fatal, r.complaint_fatal, r.request_fatal].map((v, ci) => (
                                  <td key={ci} className="py-2 px-3 tabular-nums text-center font-semibold"
                                    style={{ background: heatBg(v, dayMaxFatal), color: v > 0 ? '#fff' : '#475569' }}>
                                    {v > 0 ? v : '—'}
                                  </td>
                                ))}
                                <td className="py-2 px-3 text-white font-bold tabular-nums">{r.total_fatal}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="border-t border-white/10">
                            <tr className="bg-white/[0.03]">
                              <td className="py-2 px-3 text-slate-400 font-semibold text-[10px]">Grand total</td>
                              {(['query_fatal','complaint_fatal','request_fatal'] as const).map(k => (
                                <td key={k} className="py-2 px-3 text-white font-bold tabular-nums text-center">
                                  {fd.day_wise.reduce((s,r) => s + r[k], 0)}
                                </td>
                              ))}
                              <td className="py-2 px-3 text-white font-bold tabular-nums">{fd.fatal_count}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Week & Scenario Wise Fatal Count */}
                  {fd.week_scenario.length > 0 && (
                    <div className="bg-[#1E293B] border border-white/5 rounded-xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                        <div className="w-1 h-4 rounded-full bg-red-500" />
                        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Week &amp; Scenario Wise Fatal Count</h3>
                      </div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/5 bg-white/[0.02]">
                            {['Week','Query','Complaint','Request','Sale Done','Total'].map(h => (
                              <th key={h} className="py-2 px-3 text-left text-slate-300 font-semibold uppercase tracking-wider text-[9px]">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[...fd.week_scenario].reverse().map((r, i) => (
                            <tr key={i} className="border-b border-white/[0.04]">
                              <td className="py-2.5 px-3 text-slate-300 font-medium">{r.week_label}</td>
                              {[r.query_fatal_pct, r.complaint_fatal_pct, r.request_fatal_pct, r.sale_done_fatal_pct].map((v, ci) => (
                                <td key={ci} className="py-2.5 px-3">{pctCell(v)}</td>
                              ))}
                              <td className="py-2.5 px-3 text-slate-200 font-bold tabular-nums">{r.total_fatal}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t border-white/10">
                          <tr className="bg-white/[0.03]">
                            <td className="py-2.5 px-3 text-slate-400 font-semibold text-[10px] uppercase">Grand total</td>
                            {[
                              fd.query_fatal    > 0 ? Math.round(fd.query_fatal    / (fd.audit_count||1) * 1000)/10 : 0,
                              fd.complaint_fatal > 0 ? Math.round(fd.complaint_fatal / (fd.audit_count||1) * 1000)/10 : 0,
                              fd.request_fatal  > 0 ? Math.round(fd.request_fatal  / (fd.audit_count||1) * 1000)/10 : 0,
                              fd.sale_done_fatal > 0 ? Math.round(fd.sale_done_fatal / (fd.audit_count||1) * 1000)/10 : 0,
                            ].map((v, ci) => (
                              <td key={ci} className="py-2.5 px-3">{pctCell(v)}</td>
                            ))}
                            <td className="py-2.5 px-3 text-white font-bold tabular-nums">{fd.fatal_count}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Agent Wise Performance (full width) ── */}
              {fd.agent_performance.length > 0 && (
                <div className="bg-[#1E293B] border border-white/5 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                    <div className="w-1 h-4 rounded-full bg-red-500" />
                    <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Agent Wise Performance</h3>
                    <ExportBtn onClick={() => downloadCSV(fd.agent_performance.map(r => ({ Agent: r.agent_name, Audits: r.audit_count, 'CQ Score%': r.cq_score, Fatals: r.fatal_count, 'Fatal%': r.fatal_pct, 'Below Avg%': r.below_avg_pct, 'Avg%': r.avg_pct, 'Good%': r.good_pct, 'Excellent%': r.excellent_pct })), 'agent-performance.csv')} />
                  </div>
                  <div className="overflow-x-auto overflow-y-auto max-h-80">
                    <table className="w-full text-xs min-w-[800px]">
                      <thead className="sticky top-0 bg-[#1E293B] z-10">
                        <tr className="border-b border-white/5 bg-white/[0.02]">
                          {['Agent Name','Audit Count','CQ Score%','Fatal Count','Fatal%','Below Avg Call','Average Calls','Good Calls','Excellent Calls'].map(h => (
                            <th key={h} className="py-2.5 px-4 text-left text-slate-300 font-semibold uppercase tracking-wider text-[9px] whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {fd.agent_performance.map((r, i) => (
                          <tr key={i}
                            className={`border-b border-white/[0.04] ${i % 2 === 0 ? '' : 'bg-white/[0.01]'} cursor-pointer hover:bg-white/[0.04] transition-colors`}
                            title={`Click to drill into ${r.agent_name}'s calls`}
                            onClick={() => openBandDetail('no_fatal', `${r.agent_name} — Call Breakdown`, r.cq_score >= 90 ? '#22C55E' : '#F59E0B')}>
                            <td className="py-2.5 px-4 text-slate-200 whitespace-nowrap">{r.agent_name}</td>
                            <td className="py-2.5 px-4 tabular-nums text-slate-300">{r.audit_count}</td>
                            <td className="py-2.5 px-4">
                              <div className="flex items-center gap-2 min-w-[80px]">
                                <div className="flex-1 h-4 rounded bg-white/5 overflow-hidden">
                                  <div className="h-full rounded flex items-center justify-center text-[9px] font-bold text-white"
                                    style={{
                                      width: `${Math.min(r.cq_score, 100)}%`,
                                      background: r.cq_score >= 90 ? '#22C55E' : r.cq_score >= 85 ? '#F59E0B' : '#EF4444',
                                    }}>
                                    {r.cq_score}%
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-4 text-red-400 font-bold tabular-nums">{r.fatal_count}</td>
                            <td className="py-2.5 px-4">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold"
                                style={{ background: r.fatal_pct > 0 ? 'rgba(239,68,68,0.15)' : 'transparent', color: r.fatal_pct > 0 ? '#EF4444' : '#64748B' }}>
                                {r.fatal_pct}%
                              </span>
                            </td>
                            {[r.below_avg_pct, r.avg_pct, r.good_pct, r.excellent_pct].map((v, ci) => (
                              <td key={ci} className="py-2.5 px-4 tabular-nums text-slate-400">{v > 0 ? `${v}%` : '0%'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t border-white/10">
                        <tr className="bg-white/[0.03]">
                          <td className="py-2.5 px-4 text-slate-400 font-semibold text-[10px] uppercase">Grand total</td>
                          <td className="py-2.5 px-4 text-white font-bold tabular-nums">{gt.audit}</td>
                          <td className="py-2.5 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold"
                              style={{ background: gtCq >= 90 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: gtCq >= 90 ? '#22C55E' : '#EF4444' }}>
                              {gtCq}%
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-red-400 font-bold tabular-nums">{gt.fatal}</td>
                          <td className="py-2.5 px-4 text-red-400 font-bold">{gtFp}%</td>
                          {fd.agent_performance.length > 0 && (() => {
                            const totAudit = gt.audit;
                            const totBelow  = fd.agent_performance.reduce((s,r) => s + Math.round(r.below_avg_pct * r.audit_count / 100), 0);
                            const totAvg    = fd.agent_performance.reduce((s,r) => s + Math.round(r.avg_pct       * r.audit_count / 100), 0);
                            const totGood   = fd.agent_performance.reduce((s,r) => s + Math.round(r.good_pct      * r.audit_count / 100), 0);
                            const totExc    = fd.agent_performance.reduce((s,r) => s + Math.round(r.excellent_pct * r.audit_count / 100), 0);
                            return [totBelow, totAvg, totGood, totExc].map((v, ci) => (
                              <td key={ci} className="py-2.5 px-4 text-slate-300 font-bold tabular-nums">
                                {totAudit > 0 ? `${Math.round(v / totAudit * 1000)/10}%` : '0%'}
                              </td>
                            ));
                          })()}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </>
          );
        })()}

        {/* ── Detail Analysis Slide ───────────────────────────────────── */}
        {activeSlide === 2 && (() => {
          const dd = detailData;
          if (detailLoading || !dd) {
            return (
              <div className="flex items-center justify-center py-20 text-slate-600 text-sm">
                {detailLoading ? 'Loading detail analysis…' : 'No data for this period.'}
              </div>
            );
          }

          const deltaVsTarget = (dd.cq_score - 98).toFixed(1);

          const scenColor = (scenario: string) =>
            scenario === 'Complaint' ? '#EF4444' : '#22C55E';

          const auditHeatBg = (val: number, max: number) => {
            if (!val || !max) return '';
            const a = 0.12 + (val / max) * 0.55;
            return `rgba(34,197,94,${a.toFixed(2)})`;
          };

          const dayMax = Math.max(...dd.day_wise_audit.map(r => r.total), 1);

          const pctCellDetail = (val: number, color = '#22C55E') => {
            const bg = val > 0 ? `${color}22` : 'transparent';
            const fg = val > 0 ? color : '#64748B';
            return (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ color: fg, background: bg }}>
                {val > 0 ? `${val}%` : '0%'}
              </span>
            );
          };

          return (
            <>
              {/* ── KPI Cards ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                  {
                    label: 'CQ Score%', value: `${dd.cq_score}%`,
                    sub: <span className={`text-[10px] font-bold flex items-center gap-0.5 ${Number(deltaVsTarget) < 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {Number(deltaVsTarget) < 0 ? '▼' : '▲'} {deltaVsTarget}%
                    </span>,
                    color: dd.cq_score >= 90 ? '#22C55E' : '#EF4444',
                    onClick: () => setDrillModal({ title: 'Detail Analysis — Scenario Panels', accent: dd.cq_score >= 90 ? '#22C55E' : '#EF4444', columns: [{ key: 'Scenario', label: 'Scenario' }, { key: 'Sub-Scenario', label: 'Sub-Scenario' }, { key: 'Count', label: 'Count' }, { key: '%', label: '%' }], rows: dd.scenario_panels.flatMap(p => p.items.map(it => ({ Scenario: p.scenario, 'Sub-Scenario': it.scenario1, Count: it.count, '%': `${it.pct}%` }))) }),
                  },
                  {
                    label: 'Audit Count', value: dd.audit_count.toLocaleString(), sub: null, color: '#38BDF8',
                    onClick: () => setDrillModal({ title: 'Detail Analysis — Day Wise Audit Count', accent: '#38BDF8', columns: [{ key: 'Date', label: 'Date' }, { key: 'Complaint', label: 'Complaint' }, { key: 'Request', label: 'Request' }, { key: 'Query', label: 'Query' }, { key: 'Total', label: 'Total' }], rows: dd.day_wise_audit.map(r => ({ Date: r.call_date, Complaint: r.complaint, Request: r.request, Query: r.query, Total: r.total })) }),
                  },
                  {
                    label: 'Fatal Count', value: dd.fatal_count.toLocaleString(), sub: null, color: '#EF4444',
                    onClick: () => setDrillModal({ title: 'Detail Analysis — Scenario Count Breakdown', accent: '#EF4444', columns: [{ key: 'Scenario', label: 'Scenario' }, { key: 'Count', label: 'Count' }], rows: [{ Scenario: 'Query', Count: dd.query_count }, { Scenario: 'Complaint', Count: dd.complaint_count }, { Scenario: 'Request', Count: dd.request_count }, { Scenario: 'Sale Done', Count: dd.sale_done_count }] }),
                  },
                  {
                    label: 'Fatal%',      value: `${dd.fatal_pct}%`, sub: null, color: dd.fatal_pct >= 20 ? '#EF4444' : '#F59E0B',
                    onClick: () => setDrillModal({ title: 'Detail Analysis — Week & Scenario Audit%', accent: '#F59E0B', columns: [{ key: 'Week', label: 'Week' }, { key: 'Query%', label: 'Query%' }, { key: 'Complaint%', label: 'Complaint%' }, { key: 'Request%', label: 'Request%' }, { key: 'Sale Done%', label: 'Sale Done%' }, { key: 'Total', label: 'Total' }], rows: dd.week_scenario_audit.map(r => ({ Week: r.week_label, 'Query%': `${r.query_pct}%`, 'Complaint%': `${r.complaint_pct}%`, 'Request%': `${r.request_pct}%`, 'Sale Done%': `${r.sale_done_pct}%`, Total: r.total })) }),
                  },
                ].map(c => (
                  <div key={c.label}
                    className="relative bg-[#1E293B] border border-white/5 rounded-xl px-4 py-4 overflow-hidden cursor-pointer hover:bg-white/[0.03] transition-colors"
                    onClick={c.onClick}
                    title="Click for detail analysis">
                    <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ background: c.color }} />
                    <div className="pl-2">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">{c.label}</p>
                      <p className="text-2xl font-bold text-white leading-none">{c.value}</p>
                      {c.sub && <div className="mt-1">{c.sub}</div>}
                      <p className="text-[9px] text-slate-400 mt-1">Click to analyse</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Two-column layout ── */}
              <div className="grid lg:grid-cols-2 gap-4 mb-4">

                {/* LEFT — Scenario panels stacked */}
                <div className="space-y-4">
                  {dd.scenario_panels.filter(p => p.scenario !== 'Sale Done' && p.scenario !== 'Repeat').map(panel => {
                    const color = scenColor(panel.scenario);
                    const pieData = panel.items.map(it => ({ name: it.scenario1, value: it.count }));
                    const PIE_COLORS = ['#3B82F6','#22C55E','#F59E0B','#A855F7','#EF4444'];
                    return (
                      <div key={panel.scenario} className="bg-[#1E293B] border border-white/5 rounded-xl overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-white/5 flex items-center gap-2">
                          <div className="w-1 h-4 rounded-full" style={{ background: color }} />
                          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">
                            Top 5 {panel.scenario}
                          </h3>
                          <span className="ml-auto text-xs font-bold" style={{ color }}>
                            {panel.total_count.toLocaleString()} audits
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row">
                          <div className="sm:w-[55%] overflow-hidden">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-white/5 bg-white/[0.02]">
                                  {['Scenario 1','Count','%'].map(h => (
                                    <th key={h} className="py-2 px-3 text-left text-slate-300 font-semibold uppercase tracking-wider text-[9px]">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {panel.items.map((it, i) => (
                                  <tr key={i} className={`border-b border-white/[0.04] ${i % 2 ? 'bg-white/[0.01]' : ''}`}>
                                    <td className="py-2 px-3 text-slate-200 leading-snug">{it.scenario1}</td>
                                    <td className="py-2 px-3 text-slate-300 font-semibold tabular-nums">{it.count.toLocaleString()}</td>
                                    <td className="py-2 px-3 tabular-nums">
                                      <div className="flex items-center gap-1.5">
                                        <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden max-w-[40px]">
                                          <div className="h-full rounded-full" style={{ width: `${it.pct}%`, background: color }} />
                                        </div>
                                        <span className="text-slate-400 text-[9px]">{it.pct}%</span>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <div className="sm:w-[45%] border-t sm:border-t-0 sm:border-l border-white/5 flex flex-col items-center justify-center py-2">
                            <ResponsiveContainer width="100%" height={140}>
                              <PieChart>
                                <Pie
                                  data={pieData}
                                  dataKey="value"
                                  cx="50%" cy="50%"
                                  outerRadius={58}
                                  innerRadius={22}
                                  paddingAngle={2}
                                  labelLine={false}
                                  label={({ cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 }: {
                                    cx?: number; cy?: number; midAngle?: number; innerRadius?: number; outerRadius?: number; percent?: number;
                                  }) => {
                                    if (percent < 0.06) return null;
                                    const R = Math.PI / 180;
                                    const r = innerRadius + (outerRadius - innerRadius) * 0.6;
                                    return (
                                      <text
                                        x={cx + r * Math.cos(-midAngle * R)}
                                        y={cy + r * Math.sin(-midAngle * R)}
                                        fill="#fff" textAnchor="middle" dominantBaseline="central"
                                        fontSize={9} fontWeight={700}>
                                        {`${(percent * 100).toFixed(0)}%`}
                                      </text>
                                    );
                                  }}
                                >
                                  {pieData.map((_, pi) => (
                                    <Cell key={pi} fill={PIE_COLORS[pi % PIE_COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip
                                  contentStyle={{ background: '#0F172A', border: '1px solid #ffffff15', borderRadius: 8, fontSize: 10 }}
                                  formatter={(v: unknown, n: unknown) => [`${Number(v).toLocaleString()} calls`, String(n)]}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 px-2 pb-2">
                              {pieData.map((d, pi) => (
                                <div key={pi} className="flex items-center gap-1 text-[9px]">
                                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: PIE_COLORS[pi % PIE_COLORS.length] }} />
                                  <span className="text-slate-300 truncate max-w-[80px]">{d.name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* RIGHT — Scenario count cards + heat maps */}
                <div className="space-y-4">

                  {/* Scenario Wise Count — 4 cards */}
                  <div className="bg-[#1E293B] border border-white/5 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                      <div className="w-1 h-4 rounded-full bg-purple-500" />
                      <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Scenario Wise Count</h3>
                    </div>
                    <div className="grid grid-cols-4 divide-x divide-white/5">
                      {[
                        { label: 'Query Count',     value: dd.query_count,     color: '#22C55E' },
                        { label: 'Complaint Count',  value: dd.complaint_count, color: '#EF4444' },
                        { label: 'Request Count',    value: dd.request_count,   color: '#22C55E' },
                        { label: 'Sale Done Count',  value: dd.sale_done_count, color: '#22C55E' },
                      ].map(c => (
                        <div key={c.label} className="px-2 py-4 text-center">
                          <p className="text-[8px] text-slate-500 uppercase tracking-wider mb-1 leading-tight">{c.label}</p>
                          <p className="text-xl font-bold" style={{ color: c.value > 0 ? c.color : '#475569' }}>
                            {c.value.toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Day Wise / Audit Count heat map */}
                  {dd.day_wise_audit.length > 0 && (
                    <div className="bg-[#1E293B] border border-white/5 rounded-xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                        <div className="w-1 h-4 rounded-full bg-purple-500" />
                        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Day Wise / Audit Count</h3>
                      </div>
                      <div className="overflow-y-auto max-h-52">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-[#1E293B] z-10">
                            <tr className="border-b border-white/5 bg-white/[0.02]">
                              {['Date','Complaint','Request','Query','Total'].map(h => (
                                <th key={h} className="py-2 px-3 text-left text-slate-300 font-semibold uppercase tracking-wider text-[9px]">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {dd.day_wise_audit.map((r, i) => (
                              <tr key={i} className="border-b border-white/[0.04]">
                                <td className="py-2 px-3 text-slate-400 whitespace-nowrap">
                                  {r.call_date.slice(5).replace('-', '/')}
                                </td>
                                {[r.complaint, r.request, r.query].map((v, ci) => (
                                  <td key={ci} className="py-2 px-3 tabular-nums text-center font-semibold"
                                    style={{ background: auditHeatBg(v, dayMax), color: v > 0 ? '#fff' : '#475569' }}>
                                    {v > 0 ? v : '—'}
                                  </td>
                                ))}
                                <td className="py-2 px-3 text-white font-bold tabular-nums">{r.total}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="border-t border-white/10">
                            <tr className="bg-white/[0.03]">
                              <td className="py-2 px-3 text-slate-400 font-semibold text-[10px]">Grand total</td>
                              {(['complaint','request','query'] as const).map(k => (
                                <td key={k} className="py-2 px-3 text-white font-bold tabular-nums text-center">
                                  {dd.day_wise_audit.reduce((s, r) => s + r[k], 0)}
                                </td>
                              ))}
                              <td className="py-2 px-3 text-white font-bold tabular-nums">{dd.audit_count}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Week & Scenario Wise Audit Count */}
                  {dd.week_scenario_audit.length > 0 && (
                    <div className="bg-[#1E293B] border border-white/5 rounded-xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                        <div className="w-1 h-4 rounded-full bg-purple-500" />
                        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Week &amp; Scenario Wise Audit Count</h3>
                      </div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/5 bg-white/[0.02]">
                            {['Week','Query%','Complaint%','Request%','Sale Done%','Total'].map(h => (
                              <th key={h} className="py-2 px-3 text-left text-slate-300 font-semibold uppercase tracking-wider text-[9px]">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {dd.week_scenario_audit.map((r, i) => (
                            <tr key={i} className="border-b border-white/[0.04]">
                              <td className="py-2.5 px-3 text-slate-300 font-medium">{r.week_label}</td>
                              <td className="py-2.5 px-3">{pctCellDetail(r.query_pct,     '#22C55E')}</td>
                              <td className="py-2.5 px-3">{pctCellDetail(r.complaint_pct, '#EF4444')}</td>
                              <td className="py-2.5 px-3">{pctCellDetail(r.request_pct,   '#22C55E')}</td>
                              <td className="py-2.5 px-3">{pctCellDetail(r.sale_done_pct, '#22C55E')}</td>
                              <td className="py-2.5 px-3 text-slate-200 font-bold tabular-nums">{r.total.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t border-white/10">
                          <tr className="bg-white/[0.03]">
                            <td className="py-2.5 px-3 text-slate-400 font-semibold text-[10px] uppercase">Grand total</td>
                            {(() => {
                              const tot = dd.audit_count || 1;
                              return [
                                { v: Math.round(dd.query_count     / tot * 100), color: '#22C55E' },
                                { v: Math.round(dd.complaint_count  / tot * 100), color: '#EF4444' },
                                { v: Math.round(dd.request_count    / tot * 100), color: '#22C55E' },
                                { v: Math.round(dd.sale_done_count  / tot * 100), color: '#22C55E' },
                              ].map(({ v, color }, ci) => (
                                <td key={ci} className="py-2.5 px-3">{pctCellDetail(v, color)}</td>
                              ));
                            })()}
                            <td className="py-2.5 px-3 text-white font-bold tabular-nums">{dd.audit_count.toLocaleString()}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Agent & Parameter Wise CQ Score% ── */}
              <div className="mt-4 bg-[#1E293B] border border-white/5 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3 flex-wrap">
                  <div className="w-1 h-4 rounded-full bg-purple-500 shrink-0" />
                  <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Agent &amp; Parameter Wise CQ Score%</h3>
                  <ExportBtn onClick={() => downloadCSV(agentParamData.map(r => ({ Agent: r.agent_name, 'TQ/MQ/BQ': r.cq_score > 95 ? 'TQ' : r.cq_score > 85 ? 'MQ' : 'BQ', Audits: r.audit_count, 'CQ Score%': r.cq_score, Fatals: r.fatal_count, 'Fatal%': r.fatal_pct, 'Opening%': r.opening_skill, 'Soft Skill%': r.soft_skill, 'Hold%': r.hold_procedure, 'Resolution%': r.resolution, 'Closing%': r.closing })), 'agent-param.csv')} />
                  <div className="ml-auto flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-slate-300 uppercase tracking-wider">Scenario Wise</span>
                    <select
                      value={agentParamScenario}
                      onChange={e => setAgentParamScenario(e.target.value)}
                      className="bg-[#0F172A] border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="">Select Scenario Wise</option>
                      {scenarios.map(s => (
                        <option key={s.scenario} value={s.scenario}>{s.scenario}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {agentParamLoading ? (
                  <div className="py-8 text-center text-slate-600 text-xs">Loading…</div>
                ) : agentParamData.length === 0 ? (
                  <div className="py-8 text-center text-slate-600 text-xs">No data for this period.</div>
                ) : (() => {
                  const gt = agentParamData.reduce((acc, r) => ({
                    audit: acc.audit + r.audit_count,
                    fatal: acc.fatal + r.fatal_count,
                    cqSum: acc.cqSum + r.cq_score * r.audit_count,
                    opening: acc.opening + r.opening_skill * r.audit_count,
                    soft: acc.soft + r.soft_skill * r.audit_count,
                    hold: acc.hold + r.hold_procedure * r.audit_count,
                    res: acc.res + r.resolution * r.audit_count,
                    closing: acc.closing + r.closing * r.audit_count,
                  }), { audit: 0, fatal: 0, cqSum: 0, opening: 0, soft: 0, hold: 0, res: 0, closing: 0 });
                  const wa = gt.audit || 1;
                  const scoreCell = (v: number) => (
                    <span className="font-semibold" style={{ color: v >= 90 ? '#22C55E' : v >= 85 ? '#F59E0B' : v > 0 ? '#EF4444' : '#64748B' }}>
                      {v > 0 ? `${v}%` : '0%'}
                    </span>
                  );
                  const tqBadge = (score: number) => {
                    const label = score > 95 ? 'TQ' : score > 85 ? 'MQ' : 'BQ';
                    const c = label === 'TQ'
                      ? { bg: '#22C55E1A', text: '#22C55E', border: '#22C55E40' }
                      : label === 'MQ'
                      ? { bg: '#F59E0B1A', text: '#F59E0B', border: '#F59E0B40' }
                      : { bg: '#EF44441A', text: '#EF4444', border: '#EF444440' };
                    return (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border"
                        style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}>
                        {label}
                      </span>
                    );
                  };
                  return (
                    <div className="overflow-x-auto overflow-y-auto max-h-72">
                      <table className="w-full text-xs min-w-[900px]">
                        <thead className="sticky top-0 bg-[#1E293B] z-10">
                          <tr className="border-b border-white/5 bg-white/[0.02]">
                            {['Agent Name','TQ/MQ/BQ','Audit Count','CQ Score%','Fatal Count','Fatal%','Opening Score%','Soft Skills Score%','Hold Procedure%','Resolution Score%','Closing Score%'].map(h => (
                              <th key={h} className="py-2.5 px-3 text-left text-slate-300 font-semibold uppercase tracking-wider text-[9px] whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {agentParamData.map((r, i) => (
                            <tr key={i} className={`border-b border-white/[0.04] ${i % 2 ? 'bg-white/[0.01]' : ''}`}>
                              <td className="py-2.5 px-3 text-slate-200 whitespace-nowrap">{r.agent_name}</td>
                              <td className="py-2.5 px-3">{tqBadge(r.cq_score)}</td>
                              <td className="py-2.5 px-3 text-slate-300 tabular-nums">{r.audit_count}</td>
                              <td className="py-2.5 px-3">{scoreCell(r.cq_score)}</td>
                              <td className="py-2.5 px-3 text-slate-300 tabular-nums">{r.fatal_count}</td>
                              <td className="py-2.5 px-3">
                                <span className="font-semibold" style={{ color: r.fatal_pct > 0 ? '#EF4444' : '#64748B' }}>{r.fatal_pct}%</span>
                              </td>
                              <td className="py-2.5 px-3">{scoreCell(r.opening_skill)}</td>
                              <td className="py-2.5 px-3">{scoreCell(r.soft_skill)}</td>
                              <td className="py-2.5 px-3">{scoreCell(r.hold_procedure)}</td>
                              <td className="py-2.5 px-3">{scoreCell(r.resolution)}</td>
                              <td className="py-2.5 px-3">{scoreCell(r.closing)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t border-white/10">
                          <tr className="bg-white/[0.03]">
                            <td className="py-2.5 px-3 text-slate-400 font-semibold text-[10px] uppercase">Grand total</td>
                            <td className="py-2.5 px-3">{tqBadge(Math.round(gt.cqSum / wa * 10) / 10)}</td>
                            <td className="py-2.5 px-3 text-white font-bold tabular-nums">{gt.audit}</td>
                            <td className="py-2.5 px-3">{scoreCell(Math.round(gt.cqSum / wa * 10) / 10)}</td>
                            <td className="py-2.5 px-3 text-white font-bold tabular-nums">{gt.fatal}</td>
                            <td className="py-2.5 px-3">
                              <span className="font-bold" style={{ color: gt.fatal > 0 ? '#EF4444' : '#64748B' }}>
                                {gt.audit > 0 ? `${Math.round(gt.fatal / gt.audit * 1000) / 10}%` : '0%'}
                              </span>
                            </td>
                            {[gt.opening, gt.soft, gt.hold, gt.res, gt.closing].map((v, ci) => (
                              <td key={ci} className="py-2.5 px-3">{scoreCell(Math.round(v / wa * 10) / 10)}</td>
                            ))}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  );
                })()}
              </div>

              {/* ── Week Wise Quality Performance ── */}
              <div className="mt-4 bg-[#1E293B] border border-white/5 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3 flex-wrap">
                  <div className="w-1 h-4 rounded-full bg-purple-500 shrink-0" />
                  <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Week Wise Quality Performance</h3>
                  <div className="ml-auto flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-300 uppercase tracking-wider">Scenario Wise</span>
                      <select
                        value={weekWiseScenario}
                        onChange={e => setWeekWiseScenario(e.target.value)}
                        className="bg-[#0F172A] border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500"
                      >
                        <option value="">Select Scenario Wise</option>
                        {scenarios.map(s => (
                          <option key={s.scenario} value={s.scenario}>{s.scenario}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-300 uppercase tracking-wider">Agent Username</span>
                      <select
                        value={weekWiseAgent}
                        onChange={e => setWeekWiseAgent(e.target.value)}
                        className="bg-[#0F172A] border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500"
                      >
                        <option value="">Select Agent Name</option>
                        {agentParamData.map(a => (
                          <option key={a.agent_name} value={a.agent_name}>{a.agent_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                {weekWiseLoading ? (
                  <div className="py-8 text-center text-slate-600 text-xs">Loading…</div>
                ) : weekWiseData.length === 0 ? (
                  <div className="py-8 text-center text-slate-600 text-xs">No data for this period.</div>
                ) : (() => {
                  const gt = weekWiseData.reduce((acc, r) => ({
                    audit: acc.audit + r.audit_count,
                    fatal: acc.fatal + r.fatal_count,
                    cqSum: acc.cqSum + r.cq_score * r.audit_count,
                    opening: acc.opening + r.opening_skill * r.audit_count,
                    soft: acc.soft + r.soft_skill * r.audit_count,
                    hold: acc.hold + r.hold_procedure * r.audit_count,
                    res: acc.res + r.resolution * r.audit_count,
                    closing: acc.closing + r.closing * r.audit_count,
                  }), { audit: 0, fatal: 0, cqSum: 0, opening: 0, soft: 0, hold: 0, res: 0, closing: 0 });
                  const wa = gt.audit || 1;
                  const scoreCell = (v: number) => (
                    <span className="font-semibold" style={{ color: v >= 90 ? '#22C55E' : v >= 85 ? '#F59E0B' : v > 0 ? '#EF4444' : '#64748B' }}>
                      {v > 0 ? `${v}%` : '0%'}
                    </span>
                  );
                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs min-w-[900px]">
                        <thead>
                          <tr className="border-b border-white/5 bg-white/[0.02]">
                            {['Week','Audit Count','CQ Score%','Fatal Count','Fatal%','Opening Score%','Soft Skills Score%','Hold Procedure Score%','Resolution Score%','Closing Score%'].map(h => (
                              <th key={h} className="py-2.5 px-3 text-left text-slate-300 font-semibold uppercase tracking-wider text-[9px] whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {weekWiseData.map((r, i) => (
                            <tr key={i} className={`border-b border-white/[0.04] ${i % 2 ? 'bg-white/[0.01]' : ''}`}>
                              <td className="py-2.5 px-3 text-slate-300 font-medium">{r.week_label}</td>
                              <td className="py-2.5 px-3 text-slate-300 tabular-nums">{r.audit_count}</td>
                              <td className="py-2.5 px-3">{scoreCell(r.cq_score)}</td>
                              <td className="py-2.5 px-3 text-slate-300 tabular-nums">{r.fatal_count}</td>
                              <td className="py-2.5 px-3">
                                <span className="font-semibold" style={{ color: r.fatal_pct > 0 ? '#EF4444' : '#64748B' }}>{r.fatal_pct}%</span>
                              </td>
                              <td className="py-2.5 px-3">{scoreCell(r.opening_skill)}</td>
                              <td className="py-2.5 px-3">{scoreCell(r.soft_skill)}</td>
                              <td className="py-2.5 px-3">{scoreCell(r.hold_procedure)}</td>
                              <td className="py-2.5 px-3">{scoreCell(r.resolution)}</td>
                              <td className="py-2.5 px-3">{scoreCell(r.closing)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t border-white/10">
                          <tr className="bg-white/[0.03]">
                            <td className="py-2.5 px-3 text-slate-400 font-semibold text-[10px] uppercase">Grand total</td>
                            <td className="py-2.5 px-3 text-white font-bold tabular-nums">{gt.audit}</td>
                            <td className="py-2.5 px-3">{scoreCell(Math.round(gt.cqSum / wa * 10) / 10)}</td>
                            <td className="py-2.5 px-3 text-white font-bold tabular-nums">{gt.fatal}</td>
                            <td className="py-2.5 px-3">
                              <span className="font-bold" style={{ color: gt.fatal > 0 ? '#EF4444' : '#64748B' }}>
                                {gt.audit > 0 ? `${Math.round(gt.fatal / gt.audit * 1000) / 10}%` : '0%'}
                              </span>
                            </td>
                            {[gt.opening, gt.soft, gt.hold, gt.res, gt.closing].map((v, ci) => (
                              <td key={ci} className="py-2.5 px-3">{scoreCell(Math.round(v / wa * 10) / 10)}</td>
                            ))}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  );
                })()}
              </div>

              {/* ── Day Wise Quality Performance ── */}
              <div className="mt-4 bg-[#1E293B] border border-white/5 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3 flex-wrap">
                  <div className="w-1 h-4 rounded-full bg-purple-500 shrink-0" />
                  <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Day Wise Quality Performance</h3>
                  <div className="ml-auto flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">Scenario</span>
                      <select
                        value={dayWiseScenario}
                        onChange={e => setDayWiseScenario(e.target.value)}
                        className="bg-[#0F172A] border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500"
                      >
                        <option value="">Select Scenario Wise</option>
                        {scenarios.map(s => (
                          <option key={s.scenario} value={s.scenario}>{s.scenario}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-300 uppercase tracking-wider">Agent</span>
                      <select
                        value={dayWiseAgent}
                        onChange={e => setDayWiseAgent(e.target.value)}
                        className="bg-[#0F172A] border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500"
                      >
                        <option value="">Select Agent Name</option>
                        {agentParamData.map(a => (
                          <option key={a.agent_name} value={a.agent_name}>{a.agent_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                {dayWiseLoading ? (
                  <div className="py-8 text-center text-slate-600 text-xs">Loading…</div>
                ) : dayWiseData.length === 0 ? (
                  <div className="py-8 text-center text-slate-600 text-xs">No data for this period.</div>
                ) : (() => {
                  const gt = dayWiseData.reduce((acc, r) => ({
                    audit: acc.audit + r.audit_count,
                    fatal: acc.fatal + r.fatal_count,
                    cqSum: acc.cqSum + r.cq_score * r.audit_count,
                    opening: acc.opening + r.opening_skill * r.audit_count,
                    soft: acc.soft + r.soft_skill * r.audit_count,
                    hold: acc.hold + r.hold_procedure * r.audit_count,
                    res: acc.res + r.resolution * r.audit_count,
                    closing: acc.closing + r.closing * r.audit_count,
                  }), { audit: 0, fatal: 0, cqSum: 0, opening: 0, soft: 0, hold: 0, res: 0, closing: 0 });
                  const wa = gt.audit || 1;
                  const scoreCell = (v: number) => (
                    <span className="font-semibold" style={{ color: v >= 90 ? '#22C55E' : v >= 85 ? '#F59E0B' : v > 0 ? '#EF4444' : '#64748B' }}>
                      {v > 0 ? `${v}%` : '0%'}
                    </span>
                  );
                  return (
                    <div className="overflow-x-auto overflow-y-auto max-h-72">
                      <table className="w-full text-xs min-w-[900px]">
                        <thead className="sticky top-0 bg-[#1E293B] z-10">
                          <tr className="border-b border-white/5 bg-white/[0.02]">
                            {['Date','Audit Count','CQ Score%','Fatal Count','Fatal%','Opening Score%','Soft Skills Score%','Hold Procedure%','Resolution Score%','Closing Score%'].map(h => (
                              <th key={h} className="py-2.5 px-3 text-left text-slate-300 font-semibold uppercase tracking-wider text-[9px] whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {dayWiseData.map((r, i) => (
                            <tr key={i} className={`border-b border-white/[0.04] ${i % 2 ? 'bg-white/[0.01]' : ''}`}>
                              <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">{r.call_date.slice(5).replace('-', '/')}</td>
                              <td className="py-2.5 px-3 text-slate-300 tabular-nums">{r.audit_count}</td>
                              <td className="py-2.5 px-3">{scoreCell(r.cq_score)}</td>
                              <td className="py-2.5 px-3 text-slate-300 tabular-nums">{r.fatal_count}</td>
                              <td className="py-2.5 px-3">
                                <span className="font-semibold" style={{ color: r.fatal_pct > 0 ? '#EF4444' : '#64748B' }}>{r.fatal_pct}%</span>
                              </td>
                              <td className="py-2.5 px-3">{scoreCell(r.opening_skill)}</td>
                              <td className="py-2.5 px-3">{scoreCell(r.soft_skill)}</td>
                              <td className="py-2.5 px-3">{scoreCell(r.hold_procedure)}</td>
                              <td className="py-2.5 px-3">{scoreCell(r.resolution)}</td>
                              <td className="py-2.5 px-3">{scoreCell(r.closing)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t border-white/10">
                          <tr className="bg-white/[0.03]">
                            <td className="py-2.5 px-3 text-slate-400 font-semibold text-[10px] uppercase">Grand total</td>
                            <td className="py-2.5 px-3 text-white font-bold tabular-nums">{gt.audit}</td>
                            <td className="py-2.5 px-3">{scoreCell(Math.round(gt.cqSum / wa * 10) / 10)}</td>
                            <td className="py-2.5 px-3 text-white font-bold tabular-nums">{gt.fatal}</td>
                            <td className="py-2.5 px-3">
                              <span className="font-bold" style={{ color: gt.fatal > 0 ? '#EF4444' : '#64748B' }}>
                                {gt.audit > 0 ? `${Math.round(gt.fatal / gt.audit * 1000) / 10}%` : '0%'}
                              </span>
                            </td>
                            {[gt.opening, gt.soft, gt.hold, gt.res, gt.closing].map((v, ci) => (
                              <td key={ci} className="py-2.5 px-3">{scoreCell(Math.round(v / wa * 10) / 10)}</td>
                            ))}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  );
                })()}
              </div>
              {/* ── Quality Parameters ── */}
              <div className="mt-4 bg-[#1E293B] border border-white/5 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3 flex-wrap">
                  <div className="w-1 h-4 rounded-full bg-purple-500 shrink-0" />
                  <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Quality Parameters</h3>
                  <span className="text-[10px] text-slate-400 ml-1">count &amp; score by parameter</span>
                  <ExportBtn onClick={() => downloadCSV(qualityParamData.map(r => ({ Parameter: r.parameter, 'Hit Count': r.hit_count, 'Applicable Count': r.total_count, 'Score%': r.score_pct })), 'quality-parameters.csv')} />
                  <div className="ml-auto flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">Scenario</span>
                      <select
                        value={qualityParamScenario}
                        onChange={e => setQualityParamScenario(e.target.value)}
                        className="bg-[#0F172A] border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500"
                      >
                        <option value="">All Scenarios</option>
                        {scenarios.map(s => (
                          <option key={s.scenario} value={s.scenario}>{s.scenario}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-300 uppercase tracking-wider">Agent</span>
                      <select
                        value={qualityParamAgent}
                        onChange={e => setQualityParamAgent(e.target.value)}
                        className="bg-[#0F172A] border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500"
                      >
                        <option value="">All Agents</option>
                        {agentParamData.map(a => (
                          <option key={a.agent_name} value={a.agent_name}>{a.agent_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {qualityParamLoading ? (
                  <div className="py-8 text-center text-slate-600 text-xs">Loading…</div>
                ) : qualityParamData.length === 0 ? (
                  <div className="py-8 text-center text-slate-600 text-xs">No data for this period.</div>
                ) : (
                  /* show top 10 rows (~440px), rest scrollable */
                  <div className="overflow-y-auto" style={{ maxHeight: '440px' }}>
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-[#1E293B] z-10">
                        <tr className="border-b border-white/5 bg-white/[0.02]">
                          <th className="py-2.5 px-4 text-left text-slate-300 font-semibold uppercase tracking-wider text-[9px]">#</th>
                          <th className="py-2.5 px-4 text-left text-slate-300 font-semibold uppercase tracking-wider text-[9px]">Parameter</th>
                          <th className="py-2.5 px-4 text-left text-slate-300 font-semibold uppercase tracking-wider text-[9px]">Hit Count</th>
                          <th className="py-2.5 px-4 text-left text-slate-300 font-semibold uppercase tracking-wider text-[9px]">Applicable Count</th>
                          <th className="py-2.5 px-4 text-left text-slate-300 font-semibold uppercase tracking-wider text-[9px] min-w-[180px]">Score%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {qualityParamData.map((r, i) => {
                          const color = r.score_pct >= 90 ? '#22C55E' : r.score_pct >= 70 ? '#F59E0B' : r.score_pct > 0 ? '#EF4444' : '#64748B';
                          return (
                            <tr key={i}
                              className={`border-b border-white/[0.04] ${i % 2 ? 'bg-white/[0.01]' : ''} ${i === 9 ? 'border-b-2 border-purple-500/30' : ''} cursor-pointer hover:bg-white/[0.04] transition-colors`}
                              title={`Click to view ${r.parameter} detail`}
                              onClick={() => setDrillModal({ title: `Quality Parameter — ${r.parameter}`, accent: color, columns: [{ key: 'Parameter', label: 'Parameter' }, { key: 'Hit Count', label: 'Hit Count' }, { key: 'Applicable Count', label: 'Applicable Count' }, { key: 'Score%', label: 'Score%' }], rows: [{ Parameter: r.parameter, 'Hit Count': r.hit_count, 'Applicable Count': r.total_count, 'Score%': `${r.score_pct}%` }] })}>
                              <td className="py-3 px-4 text-slate-400 tabular-nums font-medium">{i + 1}</td>
                              <td className="py-3 px-4 text-slate-200 font-medium">{r.parameter}</td>
                              <td className="py-3 px-4 tabular-nums">
                                <span className="font-bold text-white">{r.hit_count.toLocaleString()}</span>
                                <span className="text-slate-400 text-[10px] ml-1">hits</span>
                              </td>
                              <td className="py-3 px-4 text-slate-400 tabular-nums">{r.total_count.toLocaleString()}</td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden max-w-[140px]">
                                    <div className="h-full rounded-full transition-all duration-500"
                                      style={{ width: `${r.score_pct}%`, background: color }} />
                                  </div>
                                  <span className="text-xs font-bold tabular-nums shrink-0" style={{ color }}>
                                    {r.score_pct}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {qualityParamData.length > 10 && (
                      <div className="px-4 py-2 border-t border-white/5 text-[10px] text-slate-400 text-center">
                        Showing {qualityParamData.length} parameters · scroll to see all
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          );
        })()}

        {/* ── Repeat Analysis slide ─────────────────────────────────────────── */}
        {activeSlide === 3 && (() => {
          const rd = repeatData;
          const maskPhone = (p: string) => p.length > 5 ? p.slice(0, 5) + '*****' : p;

          return (
            <>
              {repeatLoading ? (
                <div className="flex items-center justify-center h-64 text-slate-500 text-sm">Loading repeat analysis…</div>
              ) : !rd ? (
                <div className="flex items-center justify-center h-64 text-slate-500 text-sm">No data</div>
              ) : (
                <>
                  {/* KPI strip */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div
                      className="bg-[#1E293B] border border-white/5 rounded-xl px-5 py-4 cursor-pointer hover:bg-white/[0.03] transition-colors"
                      title="Click to view all unique callers"
                      onClick={() => setDrillModal({ title: 'Repeat Analysis — All Unique Callers', accent: '#14B8A6', columns: [{ key: 'Mobile No', label: 'Mobile No' }, { key: 'Total Calls', label: 'Total Calls' }], rows: rd.pivot_rows.map(r => ({ 'Mobile No': maskPhone(r.mobile_no), 'Total Calls': r.grand_total })) })}>
                      <p className="text-[10px] text-slate-300 uppercase tracking-widest mb-1">Total Unique Callers</p>
                      <p className="text-2xl font-bold text-white">{rd.grand_unique.toLocaleString()}</p>
                      <p className="text-[9px] text-slate-400 mt-1">Click to view unique callers</p>
                    </div>
                    <div
                      className="bg-[#1E293B] border border-white/5 rounded-xl px-5 py-4 cursor-pointer hover:bg-white/[0.03] transition-colors"
                      title="Click to view repeat callers breakdown"
                      onClick={() => setDrillModal({ title: 'Repeat Analysis — Repeat Callers by Day', accent: '#14B8A6', columns: [{ key: 'Date', label: 'Date' }, { key: 'Repeat Calls', label: 'Repeat Calls' }, { key: 'Unique Calls', label: 'Unique Calls' }, { key: 'Repeat%', label: 'Repeat%' }], rows: rd.day_wise.filter(r => r.repeat_calls > 0).map(r => ({ Date: r.call_date, 'Repeat Calls': r.repeat_calls, 'Unique Calls': r.unique_calls, 'Repeat%': `${r.repeat_pct}%` })) })}>
                      <p className="text-[10px] text-slate-300 uppercase tracking-widest mb-1">Repeat Calls</p>
                      <p className="text-2xl font-bold text-teal-400">{rd.grand_repeat.toLocaleString()}</p>
                      <p className="text-[9px] text-slate-400 mt-1">Click to view day-wise</p>
                    </div>
                    <div
                      className="bg-[#1E293B] border border-white/5 rounded-xl px-5 py-4 cursor-pointer hover:bg-white/[0.03] transition-colors"
                      title="Click to view repeat rate by day"
                      onClick={() => setDrillModal({ title: 'Repeat Analysis — Repeat% by Day', accent: '#EF4444', columns: [{ key: 'Date', label: 'Date' }, { key: 'Repeat%', label: 'Repeat%' }, { key: 'Repeat Calls', label: 'Repeat Calls' }, { key: 'Unique Calls', label: 'Unique Calls' }], rows: rd.day_wise.map(r => ({ Date: r.call_date, 'Repeat%': `${r.repeat_pct}%`, 'Repeat Calls': r.repeat_calls, 'Unique Calls': r.unique_calls })) })}>
                      <p className="text-[10px] text-slate-300 uppercase tracking-widest mb-1">Repeat%</p>
                      <p className="text-2xl font-bold" style={{ color: rd.grand_pct > 0 ? '#EF4444' : '#22C55E' }}>
                        {rd.grand_pct}%
                      </p>
                      <p className="text-[9px] text-slate-500 mt-1">Click to view day-wise</p>
                    </div>
                  </div>

                  {/* Day-wise repeat table */}
                  <div className="bg-[#1E293B] border border-white/5 rounded-xl mb-6 overflow-hidden">
                    <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
                      <h3 className="text-xs font-bold text-teal-300 uppercase tracking-widest">Day Wise Repeat Analysis</h3>
                      <ExportBtn onClick={() => downloadCSV(rd.day_wise.map(r => ({ Date: r.call_date, 'Unique Calls': r.unique_calls, 'Repeat Calls': r.repeat_calls, 'Repeat%': r.repeat_pct })), 'repeat-day-wise.csv')} />
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-[#0F172A]">
                          <tr>
                            {['Date', 'Unique Calls', 'Repeat Calls', 'Repeat%'].map(h => (
                              <th key={h} className="py-2.5 px-4 text-left text-slate-300 font-semibold uppercase tracking-wider text-[9px]">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rd.day_wise.map((r, i) => (
                            <tr key={i} className={`border-b border-white/[0.04] ${i % 2 ? 'bg-white/[0.01]' : ''}`}>
                              <td className="py-2.5 px-4 text-slate-300 tabular-nums font-medium">{r.call_date}</td>
                              <td className="py-2.5 px-4 text-slate-200 tabular-nums">{r.unique_calls.toLocaleString()}</td>
                              <td className="py-2.5 px-4 text-teal-300 tabular-nums font-semibold">{r.repeat_calls.toLocaleString()}</td>
                              <td className="py-2.5 px-4 tabular-nums">
                                <span className="font-bold" style={{ color: r.repeat_pct > 0 ? '#EF4444' : '#22C55E' }}>
                                  {r.repeat_pct}%
                                </span>
                              </td>
                            </tr>
                          ))}
                          {/* Grand total row */}
                          {rd.day_wise.length > 0 && (() => {
                            const totUniq   = rd.day_wise.reduce((s, r) => s + r.unique_calls,  0);
                            const totRepeat = rd.day_wise.reduce((s, r) => s + r.repeat_calls, 0);
                            const totPct    = totUniq > 0 ? Math.round(totRepeat / totUniq * 100) : 0;
                            return (
                              <tr className="border-t-2 border-teal-500/30 bg-teal-500/5 font-bold">
                                <td className="py-2.5 px-4 text-teal-300">Grand Total</td>
                                <td className="py-2.5 px-4 text-white tabular-nums">{totUniq.toLocaleString()}</td>
                                <td className="py-2.5 px-4 text-teal-300 tabular-nums">{totRepeat.toLocaleString()}</td>
                                <td className="py-2.5 px-4 tabular-nums">
                                  <span style={{ color: totPct > 0 ? '#EF4444' : '#22C55E' }}>{totPct}%</span>
                                </td>
                              </tr>
                            );
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Repeat Count — Phone × Date pivot */}
                  <div className="bg-[#1E293B] border border-white/5 rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
                      <h3 className="text-xs font-bold text-teal-300 uppercase tracking-widest">
                        Repeat Count Number &amp; Date Wise
                        <span className="ml-2 text-slate-500 normal-case font-normal">({rd.pivot_rows.length} callers · {rd.pivot_dates.length} dates)</span>
                      </h3>
                      <ExportBtn onClick={() => {
                        const maskPhone = (p: string) => p.length > 5 ? p.slice(0, 5) + '*****' : p;
                        const rows = rd.pivot_rows.map(r => {
                          const obj: Record<string, unknown> = { 'Phone No': maskPhone(r.mobile_no) };
                          rd.pivot_dates.forEach(d => { obj[d] = r.by_date[d] ?? 0; });
                          obj['Grand Total'] = r.grand_total;
                          return obj;
                        });
                        downloadCSV(rows, 'repeat-pivot.csv');
                      }} />
                    </div>
                    {rd.pivot_rows.length === 0 ? (
                      <div className="px-5 py-8 text-center text-slate-500 text-sm">No repeat callers in this period</div>
                    ) : (
                      <div className="overflow-auto" style={{ maxHeight: '520px' }}>
                        <table className="text-xs border-collapse" style={{ minWidth: `${Math.max(600, 160 + rd.pivot_dates.length * 80)}px` }}>
                          <thead className="sticky top-0 z-10 bg-[#0F172A]">
                            <tr>
                              <th className="py-2.5 px-4 text-left text-slate-300 font-semibold uppercase tracking-wider text-[9px] sticky left-0 bg-[#0F172A] z-20 min-w-[140px]">Phone No</th>
                              {rd.pivot_dates.map(d => (
                                <th key={d} className="py-2.5 px-3 text-center text-slate-300 font-semibold uppercase tracking-wider text-[9px] min-w-[70px]">
                                  {d.slice(5)}
                                </th>
                              ))}
                              <th className="py-2.5 px-4 text-center text-teal-400 font-semibold uppercase tracking-wider text-[9px] min-w-[70px]">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rd.pivot_rows.map((row, i) => (
                              <tr key={i} className={`border-b border-white/[0.04] ${i % 2 ? 'bg-white/[0.01]' : ''}`}>
                                <td className="py-2 px-4 text-slate-300 font-medium tabular-nums sticky left-0 bg-inherit" style={{ background: i % 2 ? 'rgba(255,255,255,0.01)' : '#1E293B' }}>
                                  {maskPhone(row.mobile_no)}
                                </td>
                                {rd.pivot_dates.map(d => {
                                  const val = row.by_date[d] ?? 0;
                                  return (
                                    <td key={d} className="py-2 px-3 text-center tabular-nums">
                                      {val > 0 ? (
                                        <span
                                          className="inline-block px-2 py-0.5 rounded font-bold text-[11px] cursor-pointer hover:opacity-70 transition-opacity"
                                          style={{ background: 'rgba(20,184,166,0.15)', color: '#2DD4BF' }}
                                          title={`Click to see scenarios for ${maskPhone(row.mobile_no)} on ${d}`}
                                          onClick={async () => {
                                            setDrillLoading(true);
                                            setDrillModal({ title: `${maskPhone(row.mobile_no)} — ${d}`, accent: '#14B8A6', rows: [], columns: [{ key: 'Date', label: 'Date' }, { key: 'Scenario', label: 'Scenario' }, { key: 'Scenario1', label: 'Scenario 1' }, { key: 'Score%', label: 'Score%' }] });
                                            try {
                                              const { data } = await api.get<{ data: { CallDate: string; scenario: string; scenario1: string; quality_percentage: number }[] }>(
                                                `/inbound-quality/repeat-call-detail?mobileNo=${encodeURIComponent(row.mobile_no)}&callDate=${d}&clientId=${clientId}&startDate=${sd}&endDate=${ed}`
                                              );
                                              setDrillModal(prev => prev ? { ...prev, rows: data.data.map(r => ({ Date: r.CallDate, Scenario: r.scenario, Scenario1: r.scenario1, 'Score%': `${r.quality_percentage}%` })) } : null);
                                            } catch { setDrillModal(prev => prev ? { ...prev, rows: [] } : null); }
                                            finally { setDrillLoading(false); }
                                          }}>
                                          {val}
                                        </span>
                                      ) : (
                                        <span className="text-slate-700">—</span>
                                      )}
                                    </td>
                                  );
                                })}
                                <td
                                  className="py-2 px-4 text-center font-bold text-teal-300 tabular-nums cursor-pointer hover:opacity-70 transition-opacity"
                                  title={`Click to see all scenarios for ${maskPhone(row.mobile_no)}`}
                                  onClick={async () => {
                                    setDrillLoading(true);
                                    setDrillModal({ title: `${maskPhone(row.mobile_no)} — All Calls`, accent: '#14B8A6', rows: [], columns: [{ key: 'Date', label: 'Date' }, { key: 'Scenario', label: 'Scenario' }, { key: 'Scenario1', label: 'Scenario 1' }, { key: 'Score%', label: 'Score%' }] });
                                    try {
                                      const { data } = await api.get<{ data: { CallDate: string; scenario: string; scenario1: string; quality_percentage: number }[] }>(
                                        `/inbound-quality/repeat-call-detail?mobileNo=${encodeURIComponent(row.mobile_no)}&clientId=${clientId}&startDate=${sd}&endDate=${ed}`
                                      );
                                      setDrillModal(prev => prev ? { ...prev, rows: data.data.map(r => ({ Date: r.CallDate, Scenario: r.scenario, Scenario1: r.scenario1, 'Score%': `${r.quality_percentage}%` })) } : null);
                                    } catch { setDrillModal(prev => prev ? { ...prev, rows: [] } : null); }
                                    finally { setDrillLoading(false); }
                                  }}>
                                  {row.grand_total}
                                </td>
                              </tr>
                            ))}
                            {/* Grand total column row */}
                            {rd.pivot_rows.length > 0 && (() => {
                              const colTotals = rd.pivot_dates.map(d => rd.pivot_rows.reduce((s, r) => s + (r.by_date[d] ?? 0), 0));
                              const grandTotal = rd.pivot_rows.reduce((s, r) => s + r.grand_total, 0);
                              return (
                                <tr className="border-t-2 border-teal-500/30 bg-teal-500/5 font-bold sticky bottom-0">
                                  <td className="py-2.5 px-4 text-teal-300 sticky left-0" style={{ background: 'rgba(20,184,166,0.05)' }}>Grand Total</td>
                                  {colTotals.map((t, ci) => (
                                    <td key={ci} className="py-2.5 px-3 text-center text-white tabular-nums">{t > 0 ? t : '—'}</td>
                                  ))}
                                  <td className="py-2.5 px-4 text-center text-teal-300 tabular-nums">{grandTotal}</td>
                                </tr>
                              );
                            })()}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          );
        })()}

      </div>

      {/* ── Drill-down Modal ─────────────────────────────────────────────────── */}
      {drillModal && (
        <DrillModal title={drillModal.title} accent={drillModal.accent} onClose={() => { setDrillModal(null); setDrillLoading(false); }}>
          {drillLoading ? (
            <div className="flex items-center justify-center py-16 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-sky-400" />
              <span className="text-sm text-slate-400">Loading data…</span>
            </div>
          ) : drillModal.rows.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-slate-500 text-sm">No data found for this period.</div>
          ) : (
            <>
              <div className="overflow-auto" style={{ maxHeight: '70vh' }}>
                <table className="w-full text-xs">
                  <thead className="sticky top-0">
                    <tr className="border-b border-white/10 bg-[#0F172A]">
                      {drillModal.columns.map(c => (
                        <th key={c.key} className="py-2.5 px-4 text-left text-slate-300 font-semibold uppercase tracking-wider text-[10px] whitespace-nowrap">
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {drillModal.rows.map((row, i) => (
                      <tr key={i} className={i % 2 ? 'bg-white/[0.01]' : ''}>
                        {drillModal.columns.map(c => (
                          <td key={c.key} className="py-2.5 px-4 text-white tabular-nums">
                            {String(row[c.key] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">{drillModal.rows.length} records</span>
                <ExportBtn onClick={() => downloadCSV(drillModal.rows, `${drillModal.title.replace(/\s+/g, '-').toLowerCase()}.csv`)} title="Export this table" />
              </div>
            </>
          )}
        </DrillModal>
      )}
    </div>
  );
}
