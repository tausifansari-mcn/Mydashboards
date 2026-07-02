import { useEffect, useState, useCallback, useRef, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Cell, ComposedChart, Line,
} from 'recharts';
import {
  Phone, TrendingUp, Users, RefreshCw, AlertCircle, CheckCircle,
  ChevronDown, X, Download, Maximize2, FileDown,
} from 'lucide-react';
import api from '@/lib/axios';
import { useProcessStore } from '@/store/processStore';

// ─── Chart height context (normal vs expanded) ───────────────────────────────
const ChartHeightCtx = createContext(260);

// ─── Colors ───────────────────────────────────────────────────────────────────

const COLOR_GREEN  = '#10B981';
const COLOR_RED    = '#EF4444';
const COLOR_AMBER  = '#F59E0B';
const COLOR_BLUE   = '#3B82F6';
const COLOR_TEAL   = '#14B8A6';

// ─── Export helpers ───────────────────────────────────────────────────────────

function exportTableCSV(headers: string[], rows: (string | number)[][], filename: string) {
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  a.download = `${filename}.csv`;
  a.click();
}

function exportCSV(rows: ProjectRow[], startDate: string, endDate: string) {
  const headers = ['Project', 'Offered', 'Answered', 'Abandoned', 'AL%', 'SL%', 'ACHT(s)', 'Repeat%', 'FCR%', 'Login', 'Mandate', 'Required', 'Deficit'];
  const data = rows.map(r => [
    r.name,
    r.offered,
    r.answered,
    Math.max(0, r.offered - r.answered),
    r.al.toFixed(2),
    r.sl.toFixed(2),
    r.acht,
    r.repeat_pct.toFixed(2),
    r.fcr_pct != null ? r.fcr_pct.toFixed(2) : '',
    r.login_count,
    r.mandate,
    r.required,
    r.deficit,
  ]);
  const csv = [headers, ...data].map(row => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inbound_summary_${startDate.slice(0, 10)}_to_${endDate.slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadChartPNG(containerRef: React.RefObject<HTMLDivElement | null>, filename: string) {
  const svg = containerRef.current?.querySelector('svg');
  if (!svg) return;
  const svgData = new XMLSerializer().serializeToString(svg);
  const w = svg.clientWidth || 800;
  const h = svg.clientHeight || 300;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#F1F5F9';
  ctx.fillRect(0, 0, w, h);
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' }));
  img.onload = () => {
    ctx.drawImage(img, 0, 0);
    const a = document.createElement('a');
    a.download = `${filename.replace(/\s+/g, '_')}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

// ─── Static project config (mandate data never changes) ───────────────────────

interface ProjectMeta {
  key: string;
  name: string;
  icon: string;
  color: string;
  mandate: number;
  required: number;
  hasFCR: boolean;
}

const PROJECT_META: ProjectMeta[] = [
  { key: 'gnc',         name: 'GNC',          icon: '🛒', color: '#2E86C1', mandate: 8,  required: 6,  hasFCR: false },
  { key: 'bellavita',   name: 'Bellavita',     icon: '🌸', color: '#E67E22', mandate: 14, required: 12, hasFCR: false },
  { key: 'clovia',      name: 'Clovia',        icon: '👗', color: '#27AE60', mandate: 7,  required: 6,  hasFCR: false },
  { key: 'neemans',     name: "Neemans",       icon: '👟', color: '#8E44AD', mandate: 10, required: 10, hasFCR: true  },
  { key: 'viega',       name: 'Viega',         icon: '🚰', color: '#E74C3C', mandate: 2,  required: 2,  hasFCR: false },
  { key: 'exicom',      name: 'Exicom',        icon: '⚡', color: '#3498DB', mandate: 5,  required: 5,  hasFCR: false },
  { key: 'dubangladesh',name: 'DU Bangladesh', icon: '🇧🇩', color: '#F39C12', mandate: 3,  required: 3,  hasFCR: false },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProjectRow {
  key: string;
  name: string;
  icon: string;
  color: string;
  offered: number;
  answered: number;
  al: number;
  sl: number;
  acht: number;
  repeat_pct: number;
  login_count: number;
  fcr_pct: number | null;
  deficit: number;
  mandate: number;
  required: number;
}

interface Filters {
  startDate: string;
  endDate: string;
}

interface ConsolidatedTrendRow {
  date: string;
  offered: number;
  answered: number;
  al: number;
  sl: number;
  acht: number;
  total_login: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string): string {
  const m = String(d).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const dt = new Date(String(d));
  if (!isNaN(dt.getTime())) {
    const p = (n: number) => String(n).padStart(2,'0');
    return `${p(dt.getDate())}-${p(dt.getMonth()+1)}-${dt.getFullYear()}`;
  }
  return String(d).slice(0, 10);
}

function toDateInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T00:00`;
}

function toEndInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T23:59`;
}

function alColor(al: number): string  { return al >= 95 ? COLOR_GREEN : COLOR_RED; }
function slColor(sl: number): string  { return sl >= 80 ? COLOR_GREEN : COLOR_RED; }
function achtColor(v: number): string { return v <= 300 ? COLOR_GREEN : COLOR_AMBER; }
function repeatColor(v: number): string { return v <= 20 ? COLOR_GREEN : COLOR_RED; }
function fcrColor(v: number): string  { return v >= 85 ? COLOR_GREEN : COLOR_RED; }
function deficitColor(d: number): string { return d <= 0 ? COLOR_GREEN : COLOR_RED; }

// ─── Metric Badge ─────────────────────────────────────────────────────────────

function Badge({ value, color, suffix = '' }: { value: string | number; color: string; suffix?: string }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold tabular-nums border"
      style={{ color, background: `${color}14`, borderColor: `${color}35` }}
    >
      {value}{suffix}
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({
  label, value, suffix = '', dec = 0, icon, color, sub, index, onClick,
}: {
  label: string; value: number; suffix?: string; dec?: number;
  icon: React.ReactNode; color: string; sub?: string; index: number;
  onClick?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: 'easeOut' }}
      whileHover={{ y: -4, boxShadow: `0 16px 40px ${color}28` }}
      onClick={onClick}
      className={`relative bg-white rounded-2xl overflow-hidden group transition-colors duration-200 ${onClick ? 'cursor-pointer' : ''}`}
      style={{ border: `2px solid ${color}30`, borderTopWidth: 4, borderTopColor: color }}
    >
      {/* Tinted background wash on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
           style={{ background: `linear-gradient(145deg, ${color}0a, ${color}05 60%, transparent)` }} />

      <div className="relative p-4">
        {/* Top row: label + icon */}
        <div className="flex items-start justify-between mb-3">
          <span className="text-label leading-none pr-2">{label}</span>
          <div className="p-2 rounded-xl shrink-0 group-hover:scale-110 transition-transform duration-200 shadow-sm"
               style={{ backgroundColor: `${color}18`, color }}>
            {icon}
          </div>
        </div>

        {/* Big number */}
        <div className="text-2xl font-bold text-slate-900 tracking-tight leading-none mb-2 tabular-nums">
          {dec > 0 ? value.toFixed(dec) : Math.round(value).toLocaleString()}{suffix}
        </div>

        {/* Sub text */}
        {sub && (
          <div className="flex items-center gap-1.5">
            <div className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <span className="text-[11px] text-slate-600 font-semibold">{sub}</span>
          </div>
        )}
      </div>

      {/* Bottom color bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] opacity-60 group-hover:opacity-100 transition-opacity duration-200"
           style={{ background: `linear-gradient(90deg, ${color}, ${color}40)` }} />
    </motion.div>
  );
}

// ─── ChartContainer — reads height from context so expanded modal is taller ───

function ChartContainer({ children }: { children: React.ReactNode }) {
  const h = useContext(ChartHeightCtx);
  return (
    <div style={{ height: h, width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

// ─── Section Card (with expand + download) ────────────────────────────────────

function SectionCard({
  title, children, className = '', accent = COLOR_BLUE, onDownload,
}: {
  title: string; children: React.ReactNode; className?: string; accent?: string;
  onDownload?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const expandBodyRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        whileHover={{ boxShadow: `0 8px 30px ${accent}18` }}
        className={`bg-white rounded-2xl overflow-hidden transition-shadow duration-200 ${className}`}
        style={{ border: `2px solid ${accent}22`, borderTopWidth: 4, borderTopColor: accent }}
      >
        <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100"
             style={{ background: `linear-gradient(90deg, ${accent}08, transparent)` }}>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: accent }} />
            <h3 className="text-[11px] font-semibold text-slate-700 uppercase tracking-[0.06em] truncate">{title}</h3>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {onDownload && (
              <button
                onClick={onDownload}
                title="Download data as CSV"
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <FileDown size={13} />
              </button>
            )}
            <button
              onClick={() => setExpanded(true)}
              title="Expand chart"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              <Maximize2 size={13} />
            </button>
          </div>
        </div>
        <div className="p-5">
          <ChartHeightCtx.Provider value={260}>{children}</ChartHeightCtx.Provider>
        </div>
      </motion.div>

      {/* Expanded portal — plain conditional, no AnimatePresence so portal always mounts */}
      {expanded && createPortal(
        <div
          className="fixed inset-0 flex flex-col bg-slate-900/70 backdrop-blur-sm p-4"
          style={{ zIndex: 9999 }}
          onClick={(e) => { if (e.target === e.currentTarget) setExpanded(false); }}
        >
          <div className="flex flex-col bg-white rounded-2xl border border-slate-200 overflow-hidden flex-1 min-h-0">
            <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
              <div className="w-1.5 h-5 rounded-full" style={{ backgroundColor: accent }} />
              <h3 className="text-sm font-semibold text-slate-700 flex-1">{title}</h3>
              {onDownload && (
                <button
                  onClick={onDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors mr-1"
                >
                  <FileDown size={13} /> Download Data
                </button>
              )}
              <button
                onClick={() => downloadChartPNG(expandBodyRef, title)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors mr-1"
              >
                <Download size={13} /> PNG
              </button>
              <button
                onClick={() => setExpanded(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 p-6 min-h-0 overflow-auto" ref={expandBodyRef}>
                <ChartHeightCtx.Provider value={500}>{children}</ChartHeightCtx.Provider>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

// ─── Drill-down types ─────────────────────────────────────────────────────────

interface ProjectDrillRow {
  date: string; offered: number; answered: number;
  al: number; sl: number; acht: number; repeat_pct: number;
  login_count: number; fcr_pct: number | null;
}

type MetricDrillKey = 'offered' | 'answered' | 'al' | 'sl';

// ─── DrillModal ───────────────────────────────────────────────────────────────

function DrillModal({ title, accent = COLOR_BLUE, onClose, loading, onExport, children }: {
  title: string; accent?: string; onClose: () => void;
  loading?: boolean; onExport?: () => void; children: React.ReactNode;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm" style={{ zIndex: 9998 }}
      onClick={onClose}>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="w-1.5 h-5 rounded-full shrink-0" style={{ backgroundColor: accent }} />
          <h3 className="text-sm font-semibold text-slate-700 flex-1 truncate">{title}</h3>
          {onExport && (
            <button onClick={onExport} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors">
              <FileDown size={13} /> Export CSV
            </button>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors ml-1">
            <X size={15} />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-40 gap-2 text-slate-500 text-sm">
              <RefreshCw size={16} className="animate-spin" /> Loading analysis…
            </div>
          ) : children}
        </div>
      </div>
    </div>,
    document.body,
  );
}


// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function InboundDashboard() {
  const now = new Date();
  const { canAccessInboundSlug } = useProcessStore();

  // ── State ──
  const [projects,           setProjects]           = useState<ProjectRow[]>([]);
  const [consolidatedTrend,  setConsolidatedTrend]  = useState<ConsolidatedTrendRow[]>([]);
  const [loading,            setLoading]            = useState(false);
  const [trendLoading,       setTrendLoading]       = useState(false);
  const [error,              setError]              = useState('');
  const [lastRefreshed,      setLastRefreshed]      = useState<Date>(new Date());
  const [countdown,          setCountdown]          = useState(120);

  const [filters, setFilters] = useState<Filters>({
    startDate: toDateInput(now),
    endDate:   toEndInput(now),
  });

  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Drill-down state ──
  const [drillProject, setDrillProject] = useState<ProjectRow | null>(null);
  const [drillRows,    setDrillRows]    = useState<ProjectDrillRow[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [metricDrill,  setMetricDrill]  = useState<MetricDrillKey | null>(null);

  // ── Project drill-down ──
  const fetchProjectDrill = useCallback(async (p: ProjectRow) => {
    setDrillProject(p);
    setDrillLoading(true);
    setDrillRows([]);
    try {
      const qs = new URLSearchParams({
        startDate: filters.startDate.replace('T', ' '),
        endDate:   filters.endDate.replace('T', ' '),
      });
      const res = await api.get(`/inbound/project/${p.key}/trend?${qs}`);
      const data = res.data?.data;
      if (data?.rows) {
        setDrillRows([...data.rows].sort((a: ProjectDrillRow, b: ProjectDrillRow) =>
          a.date.localeCompare(b.date)));
      }
    } catch { setDrillRows([]); }
    finally { setDrillLoading(false); }
  }, [filters]);

  // ── Merge meta into API rows ──
  const mergeWithMeta = (rows: Omit<ProjectRow, 'mandate' | 'required'>[]): ProjectRow[] => {
    return rows.map((r) => {
      const meta = PROJECT_META.find((m) => m.key === r.key);
      return {
        ...r,
        mandate: meta?.mandate ?? 0,
        required: meta?.required ?? 0,
      };
    });
  };

  // ── Fetch ──
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    const qs = new URLSearchParams();
    qs.set('startDate', filters.startDate.replace('T', ' '));
    qs.set('endDate',   filters.endDate.replace('T', ' '));

    // Phase 1 — summary (charts + table): fast, unblocks UI immediately
    try {
      const sumRes = await api.get(`/inbound/summary?${qs}`);
      setProjects(mergeWithMeta(sumRes.data.data ?? []));
      setLastRefreshed(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load inbound summary');
    } finally {
      setLoading(false);
    }

    // Phase 2 — consolidated trend (date-wise tables): runs after UI is already rendered
    setTrendLoading(true);
    try {
      const todayD = new Date();
      const p2 = (n: number) => String(n).padStart(2, '0');
      const tEnd   = `${todayD.getFullYear()}-${p2(todayD.getMonth()+1)}-${p2(todayD.getDate())} 23:59`;
      const tStart = `${todayD.getFullYear()}-${p2(todayD.getMonth()+1)}-01 00:00`;
      const trendQs = new URLSearchParams({ startDate: tStart, endDate: tEnd });
      const trendRes = await api.get(`/inbound/consolidated-trend?${trendQs}`);
      setConsolidatedTrend(trendRes.data.data ?? []);
    } catch {
      // trend tables fail silently — charts already visible
    } finally {
      setTrendLoading(false);
    }
  }, [filters]);

  // ── Initial + filter-driven fetch ──
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Auto-refresh every 120 seconds ──
  useEffect(() => {
    if (intervalRef.current)  clearInterval(intervalRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(120);

    intervalRef.current = setInterval(() => {
      fetchAll();
      setCountdown(120);
    }, 120_000);

    countdownRef.current = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 120));
    }, 1_000);

    return () => {
      if (intervalRef.current)  clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [fetchAll]);

  // ── Access-filtered views ──
  const allowedProjects = projects.filter((p) => canAccessInboundSlug(p.key));
  const allowedMeta     = PROJECT_META.filter((m) => canAccessInboundSlug(m.key));

  // ── Summary KPIs ──
  const totalOffered  = allowedProjects.reduce((s, p) => s + p.offered,  0);
  const totalAnswered = allowedProjects.reduce((s, p) => s + p.answered, 0);
  const avgAL = totalOffered > 0 ? Math.round(totalAnswered * 10000 / totalOffered) / 100 : 0;
  const totalSlNum = allowedProjects.reduce((s, p) => s + Math.round(p.sl * p.offered / 100), 0);
  const avgSL = totalOffered > 0 ? Math.round(totalSlNum * 10000 / totalOffered) / 100 : 0;

  // ── Chart data ──
  const alChartData     = allowedProjects.map((p) => ({ name: p.name, icon: p.icon, al: p.al,             color: p.color }));
  const slChartData     = allowedProjects.map((p) => ({ name: p.name, icon: p.icon, sl: p.sl,             color: p.color }));
  const volumeChartData = allowedProjects.map((p) => ({ name: p.name, color: p.color, offered: p.offered, answered: p.answered, abandoned: Math.max(0, p.offered - p.answered) }));
  const achtChartData   = allowedProjects.map((p) => ({ name: `${p.icon} ${p.name}`, acht: p.acht,         color: p.color }));
  const repeatChartData = allowedProjects.map((p) => ({ name: `${p.icon} ${p.name}`, repeat: parseFloat(p.repeat_pct.toFixed(1)), color: p.color }));

  const hasAnyData = allowedProjects.some(p => p.offered > 0);

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen text-slate-900">

      {/* ── Sticky Header ── */}
      <div className="page-header">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 shrink-0">
                <img src="/Logo.png" alt="MAS" className="h-8 w-8 object-contain p-0.5" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-slate-900 leading-none">Inbound Dashboard</h1>
                <p className="text-[11px] font-medium text-mas-green mt-0.5">Real-time inbound call center KPIs</p>
              </div>
            </div>

            {/* Live indicator */}
            <div className="flex items-center gap-2 text-[11px] text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: COLOR_GREEN }} />
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: COLOR_GREEN }} />
              </span>
              <span className="text-emerald-600 font-semibold">Live</span>
              <span className="text-slate-400">· Refresh in {countdown}s</span>
            </div>
          </div>

          {/* ── Filter Bar ── */}
          <div className="filter-bar mt-3">
            <label className="text-label">From</label>
            <input
              type="datetime-local"
              value={filters.startDate}
              onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
              className="rounded-lg px-3 py-1.5 text-xs font-medium focus:outline-none transition-colors [color-scheme:dark]"
            />
            <label className="text-label">To</label>
            <input
              type="datetime-local"
              value={filters.endDate}
              onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
              className="rounded-lg px-3 py-1.5 text-xs font-medium focus:outline-none transition-colors [color-scheme:dark]"
            />

            <button
              onClick={() => fetchAll()}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: COLOR_BLUE }}
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>

            <button
              onClick={() => exportCSV(projects, filters.startDate, filters.endDate)}
              disabled={projects.length === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-40"
              style={{ background: COLOR_GREEN }}
              title="Export project summary as CSV"
            >
              <FileDown size={12} />
              Export CSV
            </button>

            <div className="ml-auto text-[11px] text-slate-400 font-medium">
              Last updated: {lastRefreshed.toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-6 py-6 space-y-6">

        {/* Error Banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border text-sm"
              style={{ background: `${COLOR_RED}10`, borderColor: `${COLOR_RED}30`, color: COLOR_RED }}
            >
              <AlertCircle size={16} />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError('')}><X size={14} /></button>
              <button onClick={() => fetchAll()} className="text-xs underline ml-2 hover:no-underline">Retry</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading dots */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-2 text-xs text-slate-500">
            <div className="h-1 w-1 rounded-full animate-bounce" style={{ backgroundColor: COLOR_BLUE, animationDelay: '0ms' }} />
            <div className="h-1 w-1 rounded-full animate-bounce" style={{ backgroundColor: COLOR_BLUE, animationDelay: '150ms' }} />
            <div className="h-1 w-1 rounded-full animate-bounce" style={{ backgroundColor: COLOR_BLUE, animationDelay: '300ms' }} />
            <span>Loading inbound data...</span>
          </div>
        )}

        {/* ── Row 1: 4 Summary KPI Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KPICard
            label="Total Offered"
            value={totalOffered}
            icon={<Phone size={14} />}
            color={COLOR_BLUE}
            sub="Click for project breakdown"
            index={0}
            onClick={() => setMetricDrill('offered')}
          />
          <KPICard
            label="Total Answered"
            value={totalAnswered}
            icon={<CheckCircle size={14} />}
            color={COLOR_GREEN}
            sub="Click for project breakdown"
            index={1}
            onClick={() => setMetricDrill('answered')}
          />
          <KPICard
            label="Avg AL%"
            value={avgAL}
            suffix="%"
            dec={1}
            icon={<TrendingUp size={14} />}
            color={avgAL >= 95 ? COLOR_GREEN : COLOR_RED}
            sub={`Target: 95% · Click to analyse`}
            index={2}
            onClick={() => setMetricDrill('al')}
          />
          <KPICard
            label="Avg SL%"
            value={avgSL}
            suffix="%"
            dec={1}
            icon={<Users size={14} />}
            color={avgSL >= 80 ? COLOR_GREEN : COLOR_RED}
            sub={`Target: 80% · Click to analyse`}
            index={3}
            onClick={() => setMetricDrill('sl')}
          />
        </div>

        {/* ── Row 2: Consolidated Project Table ── */}
        <SectionCard title="Project Performance Summary" accent={COLOR_BLUE}
          onDownload={() => exportCSV(projects, filters.startDate, filters.endDate)}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap">Project</th>
                  <th className="text-right py-2 px-3 text-slate-500 font-semibold uppercase tracking-wider">Offered</th>
                  <th className="text-right py-2 px-3 text-slate-500 font-semibold uppercase tracking-wider">Answered</th>
                  <th className="text-right py-2 px-3 text-slate-500 font-semibold uppercase tracking-wider">AL%</th>
                  <th className="text-right py-2 px-3 text-slate-500 font-semibold uppercase tracking-wider">SL%</th>
                  <th className="text-right py-2 px-3 text-slate-500 font-semibold uppercase tracking-wider">ACHT</th>
                  <th className="text-right py-2 px-3 text-slate-500 font-semibold uppercase tracking-wider">Repeat%</th>
                  <th className="text-right py-2 px-3 text-slate-500 font-semibold uppercase tracking-wider">FCR%</th>
                  <th className="text-right py-2 px-3 text-slate-500 font-semibold uppercase tracking-wider">Login</th>
                  <th className="text-right py-2 px-3 text-slate-500 font-semibold uppercase tracking-wider">Reqd</th>
                  <th className="text-right py-2 px-3 text-slate-500 font-semibold uppercase tracking-wider">Deficit</th>
                </tr>
              </thead>
              <tbody>
                {projects.length === 0 && !loading && (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-600">No data for this period</td>
                  </tr>
                )}
                {allowedProjects.map((p, i) => (
                  <tr
                    key={p.key}
                    onClick={() => fetchProjectDrill(p)}
                    className={`border-b border-slate-100 transition-colors hover:bg-slate-100 cursor-pointer ${i % 2 === 0 ? 'bg-transparent' : ''}`}
                    style={{ borderLeft: `3px solid ${p.color}` }}
                    title={`Click to deep-analyse ${p.name}`}
                  >
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className="text-base leading-none">{p.icon}</span>
                        <span className="font-bold text-slate-900 whitespace-nowrap">{p.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-800 font-semibold tabular-nums">
                      {p.offered.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-800 font-semibold tabular-nums">
                      {p.answered.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Badge value={p.al.toFixed(1)} suffix="%" color={alColor(p.al)} />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Badge value={p.sl.toFixed(1)} suffix="%" color={slColor(p.sl)} />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Badge value={p.acht} suffix="s" color={achtColor(p.acht)} />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Badge value={p.repeat_pct.toFixed(1)} suffix="%" color={repeatColor(p.repeat_pct)} />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {p.fcr_pct !== null ? (
                        <Badge value={p.fcr_pct.toFixed(1)} suffix="%" color={fcrColor(p.fcr_pct)} />
                      ) : (
                        <span className="text-slate-600 text-[11px]">N/A</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-800 font-semibold tabular-nums">{p.login_count}</td>
                    <td className="py-2.5 px-3 text-right text-slate-400 tabular-nums">{p.required}</td>
                    <td className="py-2.5 px-3 text-right">
                      {p.deficit <= 0 ? (
                        <span className="text-[11px] font-semibold tabular-nums" style={{ color: COLOR_GREEN }}>
                          +{Math.abs(p.deficit)} surplus
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold tabular-nums" style={{ color: COLOR_RED }}>
                          -{p.deficit} deficit
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* ── No-data banner ── */}
        {!loading && !error && !hasAnyData && projects.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border text-sm"
            style={{ background: `${COLOR_AMBER}10`, borderColor: `${COLOR_AMBER}30`, color: COLOR_AMBER }}>
            <AlertCircle size={16} />
            No call records found for this date range. Projects are loaded but show zero values — the call centre may be closed or data is still being collected.
          </div>
        )}

        {/* ── Row 3: Call Volume — Offered vs Answered vs Abandoned ── */}
        <SectionCard title="Call Volume · Offered vs Answered vs Abandoned" accent={COLOR_BLUE}
          onDownload={() => exportTableCSV(
            ['Project','Offered','Answered','Abandoned'],
            allowedProjects.map(p => [p.name, p.offered, p.answered, Math.max(0, p.offered - p.answered)]),
            'call_volume'
          )}>
          {!hasAnyData ? (
            <div className="flex items-center justify-center py-12 text-slate-600 text-sm">No call data for this period</div>
          ) : (
            <ChartContainer>
              <BarChart data={volumeChartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  formatter={(v: unknown, name: unknown) => [Number(v).toLocaleString(), String(name)]}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: '#64748B' }} />
                <Bar dataKey="offered"   name="Offered"   fill={COLOR_BLUE}  radius={[3,3,0,0]} />
                <Bar dataKey="answered"  name="Answered"  fill={COLOR_GREEN} radius={[3,3,0,0]} />
                <Bar dataKey="abandoned" name="Abandoned" fill={COLOR_RED}   radius={[3,3,0,0]} />
              </BarChart>
            </ChartContainer>
          )}
        </SectionCard>

        {/* ── Row 4: AL% and SL% Bar Charts side by side ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* AL% Chart */}
          <SectionCard title="Answer Level % by Project" accent={COLOR_TEAL}
            onDownload={() => exportTableCSV(
              ['Project','AL%'],
              allowedProjects.map(p => [p.name, p.al.toFixed(2)]),
              'answer_level_pct'
            )}>
            {!hasAnyData ? (
              <div className="flex items-center justify-center py-12 text-slate-600 text-sm">No data</div>
            ) : (
              <ChartContainer>
                <BarChart
                  data={alChartData}
                  layout="vertical"
                  margin={{ top: 4, right: 40, left: 0, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: '#94A3B8', fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#64748B', fontSize: 11 }} width={90} />
                  <Tooltip
                    contentStyle={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                    formatter={(v: unknown) => [`${Number(v).toFixed(1)}%`, 'AL%']}
                  />
                  <ReferenceLine x={95} stroke={COLOR_GREEN} strokeDasharray="4 2" strokeWidth={1.5}
                    label={{ value: 'Target 95%', position: 'insideTopRight', fill: COLOR_GREEN, fontSize: 10 }}
                  />
                  <Bar dataKey="al" radius={[0, 3, 3, 0]} name="AL%">
                    {alChartData.map((entry, index) => (
                      <Cell key={index} fill={entry.al >= 95 ? COLOR_GREEN : COLOR_RED} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </SectionCard>

          {/* SL% Chart */}
          <SectionCard title="Service Level % by Project" accent={COLOR_AMBER}
            onDownload={() => exportTableCSV(
              ['Project','SL%'],
              allowedProjects.map(p => [p.name, p.sl.toFixed(2)]),
              'service_level_pct'
            )}>
            {!hasAnyData ? (
              <div className="flex items-center justify-center py-12 text-slate-600 text-sm">No data</div>
            ) : (
              <ChartContainer>
                <BarChart
                  data={slChartData}
                  layout="vertical"
                  margin={{ top: 4, right: 40, left: 0, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: '#94A3B8', fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#64748B', fontSize: 11 }} width={90} />
                  <Tooltip
                    contentStyle={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                    formatter={(v: unknown) => [`${Number(v).toFixed(1)}%`, 'SL%']}
                  />
                  <ReferenceLine x={80} stroke={COLOR_AMBER} strokeDasharray="4 2" strokeWidth={1.5}
                    label={{ value: 'Target 80%', position: 'insideTopRight', fill: COLOR_AMBER, fontSize: 10 }}
                  />
                  <Bar dataKey="sl" radius={[0, 3, 3, 0]} name="SL%">
                    {slChartData.map((entry, index) => (
                      <Cell key={index} fill={entry.sl >= 80 ? COLOR_GREEN : COLOR_RED} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </SectionCard>
        </div>

        {/* ── Row 4: ACHT + Repeat Grid + Login/Mandate Cards ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* ACHT Bar Chart */}
          <SectionCard title="Average Call Handling Time (ACHT)" accent={COLOR_AMBER}
            onDownload={() => exportTableCSV(
              ['Project','ACHT(s)'],
              allowedProjects.map(p => [p.name, p.acht]),
              'acht'
            )}>
            {!hasAnyData ? (
              <div className="flex items-center justify-center py-12 text-slate-600 text-sm">No data</div>
            ) : (
              <ChartContainer>
                <BarChart data={achtChartData} layout="vertical" margin={{ top: 4, right: 60, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                  <XAxis type="number" domain={[0, (dataMax: number) => Math.max(dataMax * 1.15, 350)]} tick={{ fill: '#94A3B8', fontSize: 10 }} tickFormatter={(v) => `${v}s`} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#64748B', fontSize: 11 }} width={110} />
                  <Tooltip
                    contentStyle={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                    formatter={(v: unknown) => [`${Number(v)}s`, 'ACHT']}
                  />
                  <ReferenceLine x={300} stroke={COLOR_AMBER} strokeDasharray="4 2" strokeWidth={1.5}
                    label={{ value: 'Target 300s', position: 'insideTopRight', fill: COLOR_AMBER, fontSize: 10 }}
                  />
                  <Bar dataKey="acht" radius={[0, 3, 3, 0]} name="ACHT (sec)">
                    {achtChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.acht <= 300 ? COLOR_GREEN : COLOR_RED} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </SectionCard>

          {/* Repeat% Bar Chart */}
          <SectionCard title="Repeat Call % by Project" accent={COLOR_RED}
            onDownload={() => exportTableCSV(
              ['Project','Repeat%'],
              allowedProjects.map(p => [p.name, p.repeat_pct.toFixed(2)]),
              'repeat_pct'
            )}>
            {!hasAnyData ? (
              <div className="flex items-center justify-center py-12 text-slate-600 text-sm">No data</div>
            ) : (
              <ChartContainer>
                <BarChart data={repeatChartData} layout="vertical" margin={{ top: 4, right: 60, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                  <XAxis type="number" domain={[0, (dataMax: number) => Math.max(dataMax * 1.15, 25)]} tick={{ fill: '#94A3B8', fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#64748B', fontSize: 11 }} width={110} />
                  <Tooltip
                    contentStyle={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                    formatter={(v: unknown) => [`${Number(v)}%`, 'Repeat%']}
                  />
                  <ReferenceLine x={20} stroke={COLOR_RED} strokeDasharray="4 2" strokeWidth={1.5}
                    label={{ value: 'Target 20%', position: 'insideTopRight', fill: COLOR_RED, fontSize: 10 }}
                  />
                  <Bar dataKey="repeat" radius={[0, 3, 3, 0]} name="Repeat%">
                    {repeatChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.repeat <= 20 ? COLOR_GREEN : COLOR_RED} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </SectionCard>
        </div>

        {/* ── Row 5: Login / Mandate Grid ── */}
        <SectionCard title="Agent Login vs Mandate" accent={COLOR_BLUE}
          onDownload={() => exportTableCSV(
            ['Project','Login Count','Mandate','Required','Deficit'],
            allowedProjects.map(p => [p.name, p.login_count, p.mandate, p.required, p.deficit]),
            'agent_login_mandate'
          )}>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {allowedProjects.map((p) => {
              const pctFilled = p.mandate > 0 ? Math.min(100, Math.round(p.login_count * 100 / p.mandate)) : 0;
              const dc = deficitColor(p.deficit);
              return (
                <div
                  key={p.key}
                  className="rounded-xl p-3 border border-slate-200 flex flex-col gap-2"
                  style={{ borderTop: `3px solid ${p.color}` }}
                >
                  {/* Project header */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-base leading-none">{p.icon}</span>
                    <span className="text-[11px] font-semibold text-slate-600 leading-tight">{p.name}</span>
                  </div>

                  {/* Login count */}
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold tabular-nums" style={{ color: dc }}>{p.login_count}</span>
                    <span className="text-[11px] text-slate-500">/ {p.mandate}</span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pctFilled}%`, backgroundColor: pctFilled >= 100 ? COLOR_GREEN : pctFilled >= 60 ? COLOR_AMBER : COLOR_RED }}
                    />
                  </div>

                  {/* Deficit label */}
                  <div className="flex flex-col gap-0.5 text-[10px]">
                    <span className="text-slate-500">Required: <span className="text-slate-600">{p.required}</span></span>
                    <span style={{ color: dc }}>
                      {p.deficit <= 0
                        ? `+${Math.abs(p.deficit)} surplus`
                        : `-${p.deficit} deficit`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* ── Row 6: FCR Card (Neemans only) ── */}
        {projects.some((p) => p.fcr_pct !== null) && (
          <SectionCard title="First Call Resolution — Neemans" accent={COLOR_GREEN}
            onDownload={() => exportTableCSV(
              ['Project','FCR%'],
              allowedProjects.filter(p => p.fcr_pct !== null).map(p => [p.name, p.fcr_pct!.toFixed(2)]),
              'fcr'
            )}>
            <div className="flex flex-wrap gap-6 items-center">
              {projects
                .filter((p) => p.fcr_pct !== null)
                .map((p) => (
                  <div key={p.key} className="flex flex-col gap-1 items-center">
                    <span className="text-3xl leading-none">{p.icon}</span>
                    <span className="text-[11px] text-slate-600 font-semibold">{p.name}</span>
                    <div
                      className="text-3xl font-bold tabular-nums"
                      style={{ color: fcrColor(p.fcr_pct!) }}
                    >
                      {p.fcr_pct!.toFixed(1)}%
                    </div>
                    <span
                      className="text-[10px] font-medium px-2 py-0.5 rounded"
                      style={{
                        color: fcrColor(p.fcr_pct!),
                        background: `${fcrColor(p.fcr_pct!)}18`,
                      }}
                    >
                      {p.fcr_pct! >= 85 ? 'On Target' : 'Below Target'}
                    </span>
                    <span className="text-[10px] text-slate-600">Target: 85%</span>
                  </div>
                ))}
            </div>
          </SectionCard>
        )}

        {/* ── Date-wise Overall Performance Table ── */}
        {(() => {
          const TOTAL_MANDATE  = allowedMeta.reduce((s, m) => s + m.mandate,  0);
          const TOTAL_REQUIRED = allowedMeta.reduce((s, m) => s + m.required, 0);
          const exportConsolidatedPerf = () => exportTableCSV(
            ['Date','Offered','Answered','AL%','SL%','ACHT(s)'],
            consolidatedTrend.map(r => [fmtDate(r.date), r.offered, r.answered, r.al.toFixed(2), r.sl.toFixed(2), r.acht]),
            'inbound_overall_daily_performance'
          );
          const exportOverallManpower = () => exportTableCSV(
            ['Date','Total Mandate','Total Required','Total Login Count','Deficit'],
            consolidatedTrend.map(r => [fmtDate(r.date), TOTAL_MANDATE, TOTAL_REQUIRED, r.total_login, TOTAL_REQUIRED - r.total_login]),
            'inbound_overall_manpower'
          );
          const sorted = [...consolidatedTrend].sort((a, b) => a.date.localeCompare(b.date));

          // ── Date-wise totals ──
          const totOffered  = sorted.reduce((s, r) => s + r.offered,  0);
          const totAnswered = sorted.reduce((s, r) => s + r.answered, 0);
          const totAL       = totOffered  > 0 ? (totAnswered / totOffered) * 100 : 0;
          const totSL       = totOffered  > 0 ? sorted.reduce((s, r) => s + r.sl   * r.offered,  0) / totOffered  : 0;
          const totACHT     = totAnswered > 0 ? Math.round(sorted.reduce((s, r) => s + r.acht * r.answered, 0) / totAnswered) : 0;

          // ── Manpower totals ──
          const totLogin   = sorted.reduce((s, r) => s + r.total_login, 0);
          const totDeficit = sorted.reduce((s, r) => s + Math.max(0, TOTAL_REQUIRED - r.total_login), 0);

          return (
            <>
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="flex items-center gap-2.5 px-5 py-3 border-b border-slate-200 bg-slate-50">
                  <div className="w-1.5 h-4 rounded-full shrink-0 bg-blue-500" />
                  <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-widest flex-1">
                    Date-wise Performance · All Projects (Current Month)
                  </h3>
                  <button onClick={exportConsolidatedPerf}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors">
                    <FileDown size={13} /> Export CSV
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        {['Date','Offered','Answered','AL%','SL%','ACHT'].map(h => (
                          <th key={h} className="py-2 px-3 text-left text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {trendLoading ? (
                        <tr><td colSpan={6} className="py-8 text-center text-slate-600">
                          <span className="flex items-center justify-center gap-2">
                            <RefreshCw size={13} className="animate-spin" /> Loading…
                          </span>
                        </td></tr>
                      ) : sorted.length === 0 ? (
                        <tr><td colSpan={6} className="py-8 text-center text-slate-600">No data available</td></tr>
                      ) : sorted.map((r, i) => (
                        <tr key={r.date} className={`border-b border-slate-100 hover:bg-slate-50 ${i%2===0?'':'bg-transparent'}`}>
                          <td className="py-2 px-3 text-slate-600 font-medium">{fmtDate(r.date)}</td>
                          <td className="py-2 px-3 text-slate-800 font-semibold tabular-nums">{r.offered.toLocaleString()}</td>
                          <td className="py-2 px-3 text-slate-800 font-semibold tabular-nums">{r.answered.toLocaleString()}</td>
                          <td className="py-2 px-3 tabular-nums"><Badge value={r.al.toFixed(1)} suffix="%" color={alColor(r.al)} /></td>
                          <td className="py-2 px-3 tabular-nums"><Badge value={r.sl.toFixed(1)} suffix="%" color={slColor(r.sl)} /></td>
                          <td className="py-2 px-3 tabular-nums"><Badge value={`${r.acht}s`} color={achtColor(r.acht)} /></td>
                        </tr>
                      ))}
                    </tbody>
                    {!trendLoading && sorted.length > 0 && (
                      <tfoot>
                        <tr className="border-t-2 border-blue-500/30 bg-blue-500/5 font-bold">
                          <td className="py-2 px-3 text-blue-300 text-[11px] uppercase tracking-wider">Total</td>
                          <td className="py-2 px-3 text-slate-900 tabular-nums">{totOffered.toLocaleString()}</td>
                          <td className="py-2 px-3 text-slate-900 tabular-nums">{totAnswered.toLocaleString()}</td>
                          <td className="py-2 px-3 tabular-nums"><Badge value={totAL.toFixed(1)} suffix="%" color={alColor(totAL)} /></td>
                          <td className="py-2 px-3 tabular-nums"><Badge value={totSL.toFixed(1)} suffix="%" color={slColor(totSL)} /></td>
                          <td className="py-2 px-3 tabular-nums"><Badge value={`${totACHT}s`} color={achtColor(totACHT)} /></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="flex items-center gap-2.5 px-5 py-3 border-b border-slate-200 bg-slate-50">
                  <div className="w-1.5 h-4 rounded-full shrink-0 bg-purple-500" />
                  <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-widest flex-1">
                    👥 Manpower Details · All Projects (Current Month) · Mandate: {TOTAL_MANDATE} · Required: {TOTAL_REQUIRED}
                  </h3>
                  <button onClick={exportOverallManpower}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors">
                    <FileDown size={13} /> Export CSV
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        {['Date','Total Mandate','Total Required','Login Count','Deficit'].map(h => (
                          <th key={h} className="py-2 px-3 text-left text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {trendLoading ? (
                        <tr><td colSpan={5} className="py-8 text-center text-slate-600">
                          <span className="flex items-center justify-center gap-2">
                            <RefreshCw size={13} className="animate-spin" /> Loading…
                          </span>
                        </td></tr>
                      ) : sorted.length === 0 ? (
                        <tr><td colSpan={5} className="py-8 text-center text-slate-600">No data available</td></tr>
                      ) : sorted.map((r, i) => {
                        const deficit = TOTAL_REQUIRED - r.total_login;
                        return (
                          <tr key={r.date} className={`border-b border-slate-100 hover:bg-slate-50 ${i%2===0?'':'bg-transparent'}`}>
                            <td className="py-2 px-3 text-slate-600 font-medium">{fmtDate(r.date)}</td>
                            <td className="py-2 px-3 text-slate-800 font-semibold tabular-nums">{TOTAL_MANDATE}</td>
                            <td className="py-2 px-3 text-slate-800 font-semibold tabular-nums">{TOTAL_REQUIRED}</td>
                            <td className="py-2 px-3 tabular-nums">
                              <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold"
                                style={{ color: r.total_login>=TOTAL_REQUIRED?COLOR_GREEN:COLOR_AMBER, background: (r.total_login>=TOTAL_REQUIRED?COLOR_GREEN:COLOR_AMBER)+'18' }}>
                                {r.total_login}
                              </span>
                            </td>
                            <td className="py-2 px-3 tabular-nums">
                              <span className="text-[11px] font-semibold" style={{ color: deficitColor(deficit) }}>
                                {deficit<=0 ? `+${Math.abs(deficit)} surplus` : `-${deficit} deficit`}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {!trendLoading && sorted.length > 0 && (
                      <tfoot>
                        <tr className="border-t-2 border-purple-500/30 bg-purple-500/5 font-bold">
                          <td className="py-2 px-3 text-purple-300 text-[11px] uppercase tracking-wider">Total</td>
                          <td className="py-2 px-3 text-slate-400 tabular-nums">—</td>
                          <td className="py-2 px-3 text-slate-400 tabular-nums">—</td>
                          <td className="py-2 px-3 tabular-nums">
                            <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold"
                              style={{ color: COLOR_GREEN, background: COLOR_GREEN + '18' }}>
                              {totLogin.toLocaleString()}
                            </span>
                          </td>
                          <td className="py-2 px-3 tabular-nums">
                            <span className="text-[11px] font-semibold" style={{ color: totDeficit > 0 ? COLOR_RED : COLOR_GREEN }}>
                              {totDeficit > 0 ? `-${totDeficit} deficit-days` : 'No deficit'}
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </>
          );
        })()}

        {/* Footer */}
        <div className="text-center text-[10px] text-slate-600 pb-4">
          Last updated: {lastRefreshed.toLocaleTimeString()} · Inbound Dashboard · Click any project row or metric card for deep analysis
        </div>
      </div>

      {/* ── Project Drill Modal ── */}
      {drillProject && (
        <DrillModal
          title={`${drillProject.icon} ${drillProject.name} — Deep Analysis`}
          accent={drillProject.color}
          onClose={() => { setDrillProject(null); setDrillRows([]); }}
          loading={drillLoading}
          onExport={drillRows.length > 0 ? () => exportTableCSV(
            ['Date','Offered','Answered','AL%','SL%','ACHT(s)','Repeat%','Login'],
            drillRows.map(r => [fmtDate(r.date), r.offered, r.answered, r.al.toFixed(1), r.sl.toFixed(1), r.acht, r.repeat_pct.toFixed(1), r.login_count]),
            `${drillProject.name.replace(/\s+/g,'_')}_daily`
          ) : undefined}
        >
          {drillRows.length === 0 ? (
            <div className="text-center text-slate-500 py-10 text-sm">No daily data for this period.</div>
          ) : (
            <>
              {/* KPI Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                  { label: 'Total Offered',  val: drillRows.reduce((s,r)=>s+r.offered,0).toLocaleString(), color: COLOR_BLUE },
                  { label: 'Total Answered', val: drillRows.reduce((s,r)=>s+r.answered,0).toLocaleString(), color: COLOR_GREEN },
                  { label: 'Overall AL%',    val: `${drillProject.al.toFixed(1)}%`, color: alColor(drillProject.al) },
                  { label: 'Overall SL%',    val: `${drillProject.sl.toFixed(1)}%`, color: slColor(drillProject.sl) },
                ].map(({ label, val, color }) => (
                  <div key={label} className="bg-white rounded-xl p-3 border border-slate-200">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</p>
                    <p className="text-lg font-bold" style={{ color }}>{val}</p>
                  </div>
                ))}
              </div>

              {/* Daily trend chart */}
              <h4 className="text-[11px] text-slate-500 uppercase tracking-widest mb-3">Daily Trend</h4>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={drillRows.map(r => ({ ...r, date: fmtDate(r.date) }))} margin={{ top: 4, right: 48, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left"  tick={{ fill: '#94A3B8', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="right" orientation="right" domain={[0,100]} unit="%" tick={{ fill: '#94A3B8', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Bar yAxisId="left"  dataKey="offered"  fill={COLOR_BLUE}   name="Offered"  radius={[2,2,0,0]} />
                  <Bar yAxisId="left"  dataKey="answered" fill={COLOR_GREEN}  name="Answered" radius={[2,2,0,0]} />
                  <Line yAxisId="right" type="monotone" dataKey="al" stroke={COLOR_RED}   strokeWidth={2} dot={false} name="AL%" />
                  <Line yAxisId="right" type="monotone" dataKey="sl" stroke={COLOR_AMBER} strokeWidth={2} dot={false} strokeDasharray="4 2" name="SL%" />
                  <ReferenceLine yAxisId="right" y={95} stroke={COLOR_RED}   strokeDasharray="3 3" />
                  <ReferenceLine yAxisId="right" y={80} stroke={COLOR_AMBER} strokeDasharray="3 3" />
                </ComposedChart>
              </ResponsiveContainer>

              {/* Daily data table */}
              <h4 className="text-[11px] text-slate-500 uppercase tracking-widest mt-5 mb-3">Day-by-Day Breakdown</h4>
              <div className="overflow-auto max-h-60">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr className="border-b border-slate-200">
                      {['Date','Offered','Answered','AL%','SL%','ACHT','Repeat%','Login'].map(h => (
                        <th key={h} className="py-2 px-3 text-right first:text-left text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap text-[9px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {drillRows.map((r, i) => (
                      <tr key={r.date} className={`border-b border-slate-100 ${i%2===0?'':'bg-transparent'}`}>
                        <td className="py-2 px-3 text-slate-600 font-medium whitespace-nowrap">{fmtDate(r.date)}</td>
                        <td className="py-2 px-3 text-right text-slate-400 tabular-nums">{r.offered.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right text-slate-400 tabular-nums">{r.answered.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right"><Badge value={r.al.toFixed(1)} suffix="%" color={alColor(r.al)} /></td>
                        <td className="py-2 px-3 text-right"><Badge value={r.sl.toFixed(1)} suffix="%" color={slColor(r.sl)} /></td>
                        <td className="py-2 px-3 text-right"><Badge value={r.acht} suffix="s" color={achtColor(r.acht)} /></td>
                        <td className="py-2 px-3 text-right"><Badge value={r.repeat_pct.toFixed(1)} suffix="%" color={repeatColor(r.repeat_pct)} /></td>
                        <td className="py-2 px-3 text-right text-slate-400 tabular-nums">{r.login_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </DrillModal>
      )}

      {/* ── Metric Drill Modal ── */}
      {metricDrill && (() => {
        const metaMap: Record<MetricDrillKey, { label: string; key: keyof ProjectRow; unit: string; refY?: number; refColor?: string; colorFn?: (v: number) => string }> = {
          offered:  { label: 'Total Offered',    key: 'offered',  unit: '' },
          answered: { label: 'Total Answered',   key: 'answered', unit: '' },
          al:       { label: 'Answer Level %',   key: 'al',       unit: '%', refY: 95, refColor: COLOR_RED,   colorFn: alColor },
          sl:       { label: 'Service Level %',  key: 'sl',       unit: '%', refY: 80, refColor: COLOR_AMBER, colorFn: slColor },
        };
        const meta = metaMap[metricDrill];
        const chartData = allowedProjects.map(p => ({
          name: `${p.icon} ${p.name}`,
          value: Number(p[meta.key]),
          color: meta.colorFn ? meta.colorFn(Number(p[meta.key])) : p.color,
        }));
        return (
          <DrillModal
            title={`${meta.label} — Project Breakdown`}
            onClose={() => setMetricDrill(null)}
            onExport={() => exportTableCSV(
              ['Project', meta.label],
              allowedProjects.map(p => [p.name, Number(p[meta.key]).toFixed(meta.unit === '%' ? 1 : 0)]),
              `${metricDrill}_breakdown`
            )}
          >
            <p className="text-xs text-slate-500 mb-4">Click a project row in the table below to see its day-by-day analysis.</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }} barCategoryGap="35%">
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis domain={meta.unit === '%' ? [0,100] : undefined} unit={meta.unit}
                  tick={{ fill: '#94A3B8', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  formatter={(v: unknown) => [`${Number(v).toFixed(meta.unit === '%' ? 1 : 0)}${meta.unit}`, meta.label]} />
                {meta.refY && <ReferenceLine y={meta.refY} stroke={meta.refColor} strokeDasharray="4 4"
                  label={{ value: `Target: ${meta.refY}${meta.unit}`, position: 'insideTopRight', fill: meta.refColor, fontSize: 10 }} />}
                <Bar dataKey="value" name={meta.label} radius={[4,4,0,0]}>
                  {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {/* Project summary table */}
            <div className="mt-5 overflow-auto max-h-48">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-200">
                    <th className="py-2 px-3 text-left text-slate-500 font-semibold uppercase tracking-wider text-[9px]">Project</th>
                    <th className="py-2 px-3 text-right text-slate-500 font-semibold uppercase tracking-wider text-[9px]">{meta.label}</th>
                    <th className="py-2 px-3 text-right text-slate-500 font-semibold uppercase tracking-wider text-[9px]">Deficit</th>
                  </tr>
                </thead>
                <tbody>
                  {allowedProjects.filter(p => p.offered > 0).sort((a,b) => Number(a[meta.key]) - Number(b[meta.key])).map((p, i) => (
                    <tr key={p.key} className={`border-b border-slate-100 hover:bg-slate-100 cursor-pointer ${i%2===0?'':'bg-transparent'}`}
                      onClick={() => { setMetricDrill(null); fetchProjectDrill(p); }}>
                      <td className="py-2 px-3 text-slate-700 font-medium">{p.icon} {p.name}</td>
                      <td className="py-2 px-3 text-right">
                        <Badge value={Number(p[meta.key]).toFixed(meta.unit==='%'?1:0)} suffix={meta.unit}
                          color={meta.colorFn ? meta.colorFn(Number(p[meta.key])) : p.color} />
                      </td>
                      <td className="py-2 px-3 text-right text-[11px] font-semibold" style={{ color: deficitColor(p.deficit) }}>
                        {p.deficit<=0 ? `+${Math.abs(p.deficit)} surplus` : `-${p.deficit} deficit`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DrillModal>
        );
      })()}
    </div>
  );
}
