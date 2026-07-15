import { useEffect, useState, useCallback, useRef, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useProcessStore } from '@/store/processStore';
import {
  BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
// framer-motion removed — portal uses plain conditional to avoid AnimatePresence key conflict
import {
  ArrowLeft, RefreshCw, Phone, PhoneIncoming, Clock, Repeat2, CheckCircle,
  Users, AlertCircle, Maximize2, Download, X, FileDown,
} from 'lucide-react';
import api from '@/lib/axios';

// ─── Chart height context ─────────────────────────────────────────────────────
const ChartHeightCtx = createContext(240);

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

// ─── Download PNG ─────────────────────────────────────────────────────────────
function downloadChartPNG(ref: React.RefObject<HTMLDivElement | null>, name: string) {
  const svg = ref.current?.querySelector('svg');
  if (!svg) return;
  const w = svg.clientWidth || 800;
  const h = svg.clientHeight || 300;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, w, h);
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' }));
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0);
    const a = document.createElement('a');
    a.download = `${name.replace(/\s+/g, '_')}.png`; a.href = canvas.toDataURL('image/png'); a.click();
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

// ─── Export table as CSV ──────────────────────────────────────────────────────
function exportCSV(headers: string[], rows: (string | number)[][], filename: string) {
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  a.download = `${filename}.csv`; a.click();
}

// ─── Section card with expand + download ──────────────────────────────────────
function SectionCard({
  title, accent = '#3B82F6', textColor = '#FFFFFF', children, onDownload,
}: { title: string; accent?: string; textColor?: string; children: React.ReactNode; onDownload?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const expandBodyRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-3 border-b" style={{ backgroundColor: accent, borderColor: accent }}>
          <div className="w-1.5 h-4 rounded-full shrink-0" style={{ backgroundColor: textColor + '99' }} />
          <h3 className="text-xs font-semibold uppercase tracking-widest flex-1" style={{ color: textColor }}>{title}</h3>
          <div className="flex items-center gap-1">
            {onDownload && (
              <button onClick={onDownload} title="Download chart data as CSV"
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: textColor + '99' }}
                onMouseEnter={e => { e.currentTarget.style.color = textColor; e.currentTarget.style.backgroundColor = textColor + '20'; }}
                onMouseLeave={e => { e.currentTarget.style.color = textColor + '99'; e.currentTarget.style.backgroundColor = 'transparent'; }}>
                <FileDown size={13} />
              </button>
            )}
            <button onClick={() => setExpanded(true)} title="Expand"
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: textColor + '99' }}
              onMouseEnter={e => { e.currentTarget.style.color = textColor; e.currentTarget.style.backgroundColor = textColor + '20'; }}
              onMouseLeave={e => { e.currentTarget.style.color = textColor + '99'; e.currentTarget.style.backgroundColor = 'transparent'; }}>
              <Maximize2 size={13} />
            </button>
          </div>
        </div>
        <div className="p-4">
          <ChartHeightCtx.Provider value={240}>{children}</ChartHeightCtx.Provider>
        </div>
      </div>

      {expanded && createPortal(
        <div
          className="fixed inset-0 flex flex-col bg-black/85 backdrop-blur-sm p-4"
          style={{ zIndex: 9999 }}
          onClick={e => { if (e.target === e.currentTarget) setExpanded(false); }}
        >
          <div className="flex flex-col bg-white rounded-2xl border border-slate-200 overflow-hidden flex-1 min-h-0">
            <div className="flex items-center gap-2.5 px-6 py-4 border-b shrink-0" style={{ backgroundColor: accent, borderColor: accent }}>
              <div className="w-1.5 h-5 rounded-full" style={{ backgroundColor: textColor + '99' }} />
              <h3 className="text-sm font-semibold flex-1" style={{ color: textColor }}>{title}</h3>
              {onDownload && (
                <button onClick={onDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors mr-1"
                  style={{ color: textColor + '99' }}
                  onMouseEnter={e => { e.currentTarget.style.color = textColor; e.currentTarget.style.backgroundColor = textColor + '20'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = textColor + '99'; e.currentTarget.style.backgroundColor = 'transparent'; }}>
                  <FileDown size={13} /> Download Data
                </button>
              )}
              <button onClick={() => downloadChartPNG(expandBodyRef, title)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors mr-1"
                style={{ color: textColor + '99' }}
                onMouseEnter={e => { e.currentTarget.style.color = textColor; e.currentTarget.style.backgroundColor = textColor + '20'; }}
                onMouseLeave={e => { e.currentTarget.style.color = textColor + '99'; e.currentTarget.style.backgroundColor = 'transparent'; }}>
                <Download size={13} /> PNG
              </button>
              <button onClick={() => setExpanded(false)}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: textColor + '99' }}
                onMouseEnter={e => { e.currentTarget.style.color = textColor; e.currentTarget.style.backgroundColor = textColor + '20'; }}
                onMouseLeave={e => { e.currentTarget.style.color = textColor + '99'; e.currentTarget.style.backgroundColor = 'transparent'; }}>
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

// ─── Expandable Table wrapper (mirrors SectionCard but for tables) ────────────
function ExpandableTable({
  title, accent = '#1E293B', textColor = '#FFFFFF', onExport, children,
}: {
  title: string; accent?: string; textColor?: string;
  onExport?: () => void; children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  const header = (close?: () => void) => (
    <div className="flex items-center gap-2.5 px-5 py-3 border-b shrink-0" style={{ backgroundColor: accent, borderColor: accent }}>
      <div className="w-1.5 h-4 rounded-full shrink-0" style={{ backgroundColor: textColor + '99' }} />
      <h3 className="text-xs font-semibold uppercase tracking-widest flex-1" style={{ color: textColor }}>{title}</h3>
      <div className="flex items-center gap-1">
        {onExport && (
          <button onClick={onExport} title="Export CSV"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
            style={{ color: textColor + '99' }}
            onMouseEnter={e => { e.currentTarget.style.color = textColor; e.currentTarget.style.backgroundColor = textColor + '20'; }}
            onMouseLeave={e => { e.currentTarget.style.color = textColor + '99'; e.currentTarget.style.backgroundColor = 'transparent'; }}>
            <FileDown size={13} /> Export CSV
          </button>
        )}
        {close ? (
          <button onClick={close} title="Close"
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: textColor + '99' }}
            onMouseEnter={e => { e.currentTarget.style.color = textColor; e.currentTarget.style.backgroundColor = textColor + '20'; }}
            onMouseLeave={e => { e.currentTarget.style.color = textColor + '99'; e.currentTarget.style.backgroundColor = 'transparent'; }}>
            <X size={15} />
          </button>
        ) : (
          <button onClick={() => setExpanded(true)} title="Expand fullscreen"
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: textColor + '99' }}
            onMouseEnter={e => { e.currentTarget.style.color = textColor; e.currentTarget.style.backgroundColor = textColor + '20'; }}
            onMouseLeave={e => { e.currentTarget.style.color = textColor + '99'; e.currentTarget.style.backgroundColor = 'transparent'; }}>
            <Maximize2 size={13} />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {header()}
        {children}
      </div>

      {expanded && createPortal(
        <div
          className="fixed inset-0 flex flex-col bg-black/80 backdrop-blur-sm p-4"
          style={{ zIndex: 9999 }}
          onClick={e => { if (e.target === e.currentTarget) setExpanded(false); }}
        >
          <div className="flex flex-col bg-white rounded-2xl overflow-hidden flex-1 min-h-0 shadow-2xl">
            {header(() => setExpanded(false))}
            <div className="flex-1 overflow-auto">
              {children}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// ─── Static project metadata ──────────────────────────────────────────────────
const PROJECT_META: Record<string, {
  name: string; icon: string; color: string; textOnColor: string; secondary: string;
  mandate: number; required: number; hasFCR: boolean;
}> = {
  gnc:          { name: 'GNC',          icon: '🛒', color: '#ED1C24', textOnColor: '#FFFFFF', secondary: '#1A1A1A', mandate: 8,  required: 6,  hasFCR: false },
  bellavita:    { name: 'Bellavita',    icon: '🌸', color: '#1A1A1A', textOnColor: '#FFFFFF', secondary: '#333333', mandate: 14, required: 12, hasFCR: false },
  clovia:       { name: 'Clovia',       icon: '👗', color: '#E91E63', textOnColor: '#FFFFFF', secondary: '#C2185B', mandate: 7,  required: 6,  hasFCR: false },
  neemans:      { name: 'Neemans',      icon: '👟', color: '#8E44AD', textOnColor: '#FFFFFF', secondary: '#6C3483', mandate: 10, required: 10, hasFCR: true  },
  viega:        { name: 'Viega',        icon: '🚰', color: '#E74C3C', textOnColor: '#FFFFFF', secondary: '#B03A2E', mandate: 2,  required: 2,  hasFCR: false },
  exicom:       { name: 'Exicom',       icon: '⚡', color: '#3498DB', textOnColor: '#FFFFFF', secondary: '#2471A3', mandate: 5,  required: 5,  hasFCR: false },
  dubangladesh: { name: 'DU Bangladesh',icon: '🇧🇩', color: '#F39C12', textOnColor: '#FFFFFF', secondary: '#D68910', mandate: 3,  required: 3,  hasFCR: false },
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface ProjectSummary {
  key: string; name: string; icon: string; color: string;
  offered: number; answered: number; al: number; sl: number;
  acht: number; repeat_pct: number; login_count: number;
  fcr_pct: number | null; deficit: number;
}
interface HourlyRow { hour: number; offered: number; answered: number; al: number; sl: number; }
interface TrendRow  {
  date: string; offered: number; answered: number; al: number;
  sl: number; acht: number; repeat_pct: number; fcr_pct: number | null; login_count: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function todayStr()           { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function daysAgoStr(n: number){ const d = new Date(); d.setDate(d.getDate()-n); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function pad(n: number)       { return String(n).padStart(2,'0'); }
function fmtHour(h: number)   { if(h===0)return'12am'; if(h<12)return`${h}am`; if(h===12)return'12pm'; return`${h-12}pm`; }

// Converts any date value (YYYY-MM-DD string or JS Date object string) → DD-MM-YYYY
function fmtDate(d: string): string {
  const m = String(d).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const dt = new Date(String(d));
  if (!isNaN(dt.getTime())) return `${pad(dt.getDate())}-${pad(dt.getMonth()+1)}-${dt.getFullYear()}`;
  return String(d).slice(0, 10);
}
// Short tick label for chart X-axis: DD-MM
function fmtDateTick(v: unknown): string {
  const m = String(v).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}-${m[2]}`;
  const dt = new Date(String(v));
  if (!isNaN(dt.getTime())) return `${pad(dt.getDate())}-${pad(dt.getMonth()+1)}`;
  return String(v).slice(0, 5);
}

function alColor(v: number)     { return v>=95?'#22C55E':v>=85?'#F59E0B':'#EF4444'; }
function slColor(v: number)     { return v>=80?'#22C55E':v>=65?'#F59E0B':'#EF4444'; }
function achtColor(v: number)   { return v<=300?'#22C55E':v<=360?'#F59E0B':'#EF4444'; }
function repeatColor(v: number) { return v<=20?'#22C55E':v<=30?'#F59E0B':'#EF4444'; }
function deficitColor(v: number){ return v<=0?'#22C55E':'#EF4444'; }

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, color, icon: Icon }: {
  label: string; value: string; sub?: string; color: string; icon: React.ElementType;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: color + '22' }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
        <span className="text-xs text-slate-400 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function InboundProjectDashboard() {
  const { projectKey = '' } = useParams<{ projectKey: string }>();
  const navigate = useNavigate();
  const { canAccessInboundSlug, loaded } = useProcessStore();
  const meta = PROJECT_META[projectKey];

  useEffect(() => {
    if (loaded && !canAccessInboundSlug(projectKey)) {
      navigate('/dashboard', { replace: true });
    }
  }, [loaded, projectKey, canAccessInboundSlug, navigate]);

  const [range, setRange]       = useState<'today'|'7d'|'30d'|'custom'>('today');
  const [customStart, setCustomStart] = useState(todayStr());
  const [customEnd,   setCustomEnd]   = useState(todayStr());
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [hourly, setHourly]   = useState<HourlyRow[]>([]);
  const [trend, setTrend]     = useState<TrendRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');
  const [fallbackDate, setFallbackDate] = useState<string | null>(null);

  // Agent-wise state
  interface AgentRow { agent_id: string; agent_name: string; offered: number; answered: number; al: number; sl: number; acht: number; repeat_pct: number; fcr_pct: number | null; }
  const [agentRows, setAgentRows]     = useState<AgentRow[]>([]);
  const [agentLoading, setAgentLoading] = useState(false);

  const buildDateRange = useCallback(() => {
    const today = todayStr();
    if (range === 'today')  return { startDate: `${today} 00:00`,       endDate: `${today} 23:59` };
    if (range === 'custom') return { startDate: `${customStart} 00:00`, endDate: `${customEnd} 23:59` };
    const days = range === '7d' ? 6 : 29;
    return { startDate: `${daysAgoStr(days)} 00:00`, endDate: `${today} 23:59` };
  }, [range, customStart, customEnd]);

  const fetchAll = useCallback(async () => {
    if (!projectKey || !meta) return;
    setLoading(true);
    setFallbackDate(null);
    try {
      const { startDate, endDate } = buildDateRange();
      const today = todayStr();
      const yesterday = daysAgoStr(1);
      const trendStart = range === 'custom' ? `${startDate.slice(0, 7)}-01 00:00` : `${today.slice(0, 7)}-01 00:00`;
      const trendEnd   = range === 'custom' ? endDate : `${today} 23:59`;
      const [sumRes, hourRes, trendRes] = await Promise.all([
        api.get(`/inbound/project/${projectKey}`, { params: { startDate, endDate } }),
        api.get(`/inbound/project/${projectKey}/hourly`, { params: { date: today } }),
        api.get(`/inbound/project/${projectKey}/trend`, { params: { startDate: trendStart, endDate: trendEnd } }),
      ]);

      const summaryData: ProjectSummary = sumRes.data.data;
      const trendRows: TrendRow[] = [...(trendRes.data.data?.rows || [])].reverse();

      // If today has no data, directly fetch yesterday's summary + hourly
      if (range === 'today' && (summaryData?.offered ?? 0) === 0) {
        try {
          const [ySumRes, yHourRes] = await Promise.all([
            api.get(`/inbound/project/${projectKey}`, { params: { startDate: `${yesterday} 00:00`, endDate: `${yesterday} 23:59` } }),
            api.get(`/inbound/project/${projectKey}/hourly`, { params: { date: yesterday } }),
          ]);
          const yData: ProjectSummary = ySumRes.data.data;
          if ((yData?.offered ?? 0) > 0) {
            setFallbackDate(yesterday);
            setSummary(yData);
            setHourly(yHourRes.data.data || []);
          } else {
            setSummary(summaryData);
            setHourly(hourRes.data.data || []);
          }
        } catch {
          setSummary(summaryData);
          setHourly(hourRes.data.data || []);
        }
      } else {
        setSummary(summaryData);
        setHourly(hourRes.data.data || []);
      }

      setTrend(trendRows);
      setLastUpdated(new Date().toLocaleTimeString());

      // Agent-wise fetch (non-blocking)
      setAgentLoading(true);
      try {
        const qs = new URLSearchParams({ projectKey, startDate, endDate });
        const agRes = await api.get<{ success: boolean; data: AgentRow[] }>(`/inbound/agent-summary?${qs}`);
        setAgentRows(agRes.data.data ?? []);
      } catch { setAgentRows([]); }
      finally { setAgentLoading(false); }
    } catch (err) { console.error('Project fetch error:', err); }
    finally { setLoading(false); }
  }, [projectKey, buildDateRange, meta]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (!meta) return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: '#F8FAFC' }}>
      <div className="text-center">
        <p className="text-slate-400 text-5xl mb-4">404</p>
        <p className="text-slate-600 text-lg mb-6">Project not found: {projectKey}</p>
        <button onClick={() => navigate('/inbound')}
          className="rounded-lg px-4 py-2 text-sm font-medium transition-colors text-white"
          style={{ backgroundColor: '#1A1A1A' }}>
          ← Back to Projects
        </button>
      </div>
    </div>
  );

  const loginPct   = meta.mandate > 0 ? Math.min(100, Math.round((summary?.login_count ?? 0) * 100 / meta.mandate)) : 0;
  const hasData    = (summary?.offered ?? 0) > 0;
  const noDataAtAll = !loading && summary && !hasData && !fallbackDate;

  // CSV exports
  const exportPerf = () => exportCSV(
    ['Date','Offered','Answered','AL%','SL%','ACHT(s)','Repeat%','FCR%'],
    trend.map(r => [fmtDate(r.date), r.offered, r.answered, r.al.toFixed(2), r.sl.toFixed(2), r.acht, r.repeat_pct.toFixed(2), r.fcr_pct ?? '']),
    `${meta.name}_daily_performance`
  );
  const exportManpower = () => exportCSV(
    ['Date','Mandate','Required','Login Count','Deficit'],
    trend.map(r => [fmtDate(r.date), meta.mandate, meta.required, r.login_count, meta.required - r.login_count]),
    `${meta.name}_manpower`
  );

  return (
    <div className="min-h-screen text-slate-900 space-y-6">

      {/* Brand banner */}
      <div className="px-6 py-5" style={{ background: `linear-gradient(135deg, ${meta.color} 0%, ${meta.color}dd 50%, ${meta.secondary}44 100%)` }}>
        <div className="flex items-center justify-between flex-wrap gap-3 max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
              <button onClick={() => navigate('/inbound')}
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
            style={{ borderColor: meta.textOnColor + '40', backgroundColor: meta.textOnColor + '10', color: meta.textOnColor }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = meta.textOnColor; e.currentTarget.style.color = meta.color; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = meta.textOnColor + '10'; e.currentTarget.style.color = meta.textOnColor; }}>
            <ArrowLeft className="h-4 w-4" /> All Projects
          </button>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{meta.icon}</span>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: meta.textOnColor }}>{meta.name} Inbound</h1>
              <p className="text-xs" style={{ color: meta.textOnColor + '99' }}>Mandate: {meta.mandate} agents · Required: {meta.required}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(['today','7d','30d'] as const).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${range===r?'':'border border-white/30 hover:bg-white/10'}`}
              style={range===r ? { backgroundColor: 'rgba(255,255,255,0.22)', color: meta.textOnColor, fontWeight: 700 } : { color: meta.textOnColor }}>
              {r==='today'?'Today':r==='7d'?'Last 7 Days':'Last 30 Days'}
            </button>
          ))}
          {/* Custom date range */}
          <button onClick={() => setRange('custom')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${range==='custom'?'':'border border-white/30 hover:bg-white/10'}`}
            style={range==='custom' ? { backgroundColor: 'rgba(255,255,255,0.22)', color: meta.textOnColor, fontWeight: 700 } : { color: meta.textOnColor }}>
            Custom
          </button>
          {range === 'custom' && (
            <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2 py-1 border border-white/20">
              <input
                type="date"
                value={customStart}
                max={customEnd}
                onChange={e => setCustomStart(e.target.value)}
                className="bg-transparent text-xs font-medium outline-none cursor-pointer"
                style={{ color: meta.textOnColor, colorScheme: 'dark' }}
              />
              <span className="text-xs opacity-60" style={{ color: meta.textOnColor }}>→</span>
              <input
                type="date"
                value={customEnd}
                min={customStart}
                max={todayStr()}
                onChange={e => setCustomEnd(e.target.value)}
                className="bg-transparent text-xs font-medium outline-none cursor-pointer"
                style={{ color: meta.textOnColor, colorScheme: 'dark' }}
              />
            </div>
          )}
          <button onClick={fetchAll}
            className="flex items-center gap-1.5 rounded-lg border border-white/30 px-3 py-1.5 text-xs transition-colors hover:bg-white/10"
            style={{ color: meta.textOnColor }}
          >
            <RefreshCw className={`h-3 w-3 ${loading?'animate-spin':''}`} />
            {lastUpdated || 'Refresh'}
          </button>
        </div>
      </div>
      </div>

      <div className="p-6 space-y-6">

      {/* Fallback notice — showing last available day's data instead of today */}
      {!loading && fallbackDate && (
        <div className="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm"
          style={{ background: '#3B82F610', borderColor: '#3B82F630', color: '#1D4ED8' }}>
          <AlertCircle className="h-4 w-4 shrink-0" />
          No data yet for today — showing latest available data from <strong className="ml-1">{fmtDate(fallbackDate)}</strong>.
        </div>
      )}

      {/* No-data banner — only when no data exists at all */}
      {noDataAtAll && (
        <div className="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm"
          style={{ background: '#F59E0B10', borderColor: '#F59E0B30', color: '#F59E0B' }}>
          <AlertCircle className="h-4 w-4 shrink-0" />
          No call records found for this period — the call centre may be closed or data is still being collected.
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <KPICard label="Offered"  value={(summary?.offered??0).toLocaleString()}  sub="Total calls"       color={meta.color}                      icon={Phone}         />
        <KPICard label="Answered" value={(summary?.answered??0).toLocaleString()} sub="Answered by agents" color="#22C55E"                         icon={PhoneIncoming} />
        <KPICard label="AL%"      value={`${summary?.al??0}%`}                   sub="Target ≥ 95%"      color={alColor(summary?.al??0)}         icon={CheckCircle}   />
        <KPICard label="SL%"      value={`${summary?.sl??0}%`}                   sub="Target ≥ 80%"      color={slColor(summary?.sl??0)}         icon={CheckCircle}   />
        <KPICard label="ACHT"     value={`${summary?.acht??0}s`}                 sub="Target ≤ 300s"     color={achtColor(summary?.acht??0)}     icon={Clock}         />
        <KPICard label="Repeat%"  value={`${summary?.repeat_pct??0}%`}           sub="Target ≤ 20%"      color={repeatColor(summary?.repeat_pct??0)} icon={Repeat2}   />
        {meta.hasFCR && (
          <KPICard label="FCR%"  value={summary?.fcr_pct!=null?`${summary.fcr_pct}%`:'N/A'}  sub="First Call Resolution"  color="#A855F7"  icon={CheckCircle} />
        )}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

        {/* Hourly Distribution */}
        <div className="lg:col-span-2">
          <SectionCard title="Hourly Call Distribution · Today" accent={meta.color} textColor={meta.textOnColor}
            onDownload={() => exportCSV(
              ['Hour','Offered','Answered','AL%','SL%'],
              hourly.map(r => [fmtHour(r.hour), r.offered, r.answered, r.al.toFixed(2), r.sl.toFixed(2)]),
              `${meta.name}_hourly`
            )}>
            {hourly.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-slate-500 text-sm">No data for today</div>
            ) : (
              <ChartContainer>
                <BarChart data={hourly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="hour" tickFormatter={fmtHour} tick={{ fill: '#94A3B8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 11, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                    labelFormatter={(v: unknown) => `${fmtHour(Number(v))}`}
                    formatter={(v: unknown, n: unknown) => [Number(v).toLocaleString(), String(n)]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="offered"  name="Offered"  fill={meta.color} radius={[3,3,0,0]} />
                  <Bar dataKey="answered" name="Answered" fill="#22C55E"    radius={[3,3,0,0]} />
                </BarChart>
              </ChartContainer>
            )}
          </SectionCard>
        </div>

        {/* Login Progress */}
        <div className="rounded-xl border border-slate-200 bg-white flex flex-col gap-4 overflow-hidden">
          <div className="px-4 py-3" style={{ background: `linear-gradient(90deg, ${meta.color} 0%, ${meta.secondary}44 100%)` }}>
            <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: meta.textOnColor }}>Login Status</h3>
          </div>
          <div className="px-4 pb-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2"
              style={{ borderColor: (summary?.login_count??0) >= meta.required ? '#22C55E' : '#F59E0B' }}>
              <Users className="h-5 w-5 text-slate-900" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{summary?.login_count ?? 0}</p>
              <p className="text-xs text-slate-400">of {meta.mandate} mandate</p>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-400"><span>Progress</span><span>{loginPct}%</span></div>
            <div className="h-2.5 w-full rounded-full bg-slate-700">
              <div className="h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${loginPct}%`, backgroundColor: loginPct>=100?'#22C55E':loginPct>=75?'#F59E0B':'#EF4444' }} />
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Required: {meta.required}</span>
              <span>Deficit: {Math.max(0, meta.required - (summary?.login_count ?? 0))}</span>
            </div>
          </div>
          <div className="mt-auto space-y-2 border-t border-slate-200 pt-4 text-xs">
            {([['AL Target','≥ 95%',alColor(summary?.al??0)],['SL Target','≥ 80%',slColor(summary?.sl??0)],['ACHT Target','≤ 300s',achtColor(summary?.acht??0)]] as [string,string,string][]).map(([k,v,c]) => (
              <div key={k} className="flex justify-between"><span className="text-slate-400">{k}</span><span className="font-medium" style={{ color: c }}>{v}</span></div>
            ))}
          </div>
        </div>
      </div>

      {/* AL% & SL% trend */}
      <SectionCard title="Daily AL% & SL% Trend · Last 30 Days" accent={meta.color} textColor={meta.textOnColor}
        onDownload={() => exportCSV(
          ['Date','AL%','SL%',...(meta.hasFCR?['FCR%']:[])],
          trend.map(r => [fmtDate(r.date), r.al.toFixed(2), r.sl.toFixed(2), ...(meta.hasFCR?[r.fcr_pct??'']:[])] ),
          `${meta.name}_al_sl_trend`
        )}>
        {trend.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-slate-500 text-sm">No trend data</div>
        ) : (
          <ChartContainer>
            <LineChart data={trend} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fill: '#94A3B8', fontSize: 10 }} tickFormatter={(v: unknown) => fmtDateTick(v)} />
              <YAxis domain={[0,100]} tick={{ fill: '#94A3B8', fontSize: 11 }} unit="%" />
              <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 11, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                formatter={(v: unknown, n: unknown) => [`${Number(v).toFixed(1)}%`, String(n)]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={95} stroke="#22C55E" strokeDasharray="4 4" label={{ value:'AL 95%', fill:'#22C55E', fontSize:10 }} />
              <ReferenceLine y={80} stroke="#3B82F6" strokeDasharray="4 4" label={{ value:'SL 80%', fill:'#3B82F6', fontSize:10 }} />
              <Line type="monotone" dataKey="al" name="AL%" stroke="#22C55E" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="sl" name="SL%" stroke="#3B82F6" strokeWidth={2} dot={false} />
              {meta.hasFCR && <Line type="monotone" dataKey="fcr_pct" name="FCR%" stroke="#A855F7" strokeWidth={2} dot={false} />}
            </LineChart>
          </ChartContainer>
        )}
      </SectionCard>

      {/* ACHT & Repeat trend */}
      <SectionCard title="Daily ACHT & Repeat% Trend · Last 30 Days" accent={meta.color} textColor={meta.textOnColor}
        onDownload={() => exportCSV(
          ['Date','ACHT(s)','Repeat%'],
          trend.map(r => [fmtDate(r.date), r.acht, r.repeat_pct.toFixed(2)]),
          `${meta.name}_acht_repeat_trend`
        )}>
        {trend.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-slate-500 text-sm">No trend data</div>
        ) : (
          <ChartContainer>
            <ComposedChart data={trend} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fill: '#94A3B8', fontSize: 10 }} tickFormatter={(v: unknown) => fmtDateTick(v)} />
              <YAxis yAxisId="acht"   orientation="left"  tick={{ fill:'#94A3B8',fontSize:11 }} unit="s" />
              <YAxis yAxisId="repeat" orientation="right" tick={{ fill:'#94A3B8',fontSize:11 }} unit="%" />
              <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 11, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                formatter={(v: unknown, n: unknown) => { const s=String(n); return s==='ACHT'?[`${Number(v)}s`,s]:[`${Number(v).toFixed(1)}%`,s]; }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine yAxisId="acht"   y={300} stroke="#F59E0B" strokeDasharray="4 4" label={{ value:'300s', fill:'#F59E0B', fontSize:10 }} />
              <ReferenceLine yAxisId="repeat" y={20}  stroke="#EF4444" strokeDasharray="4 4" label={{ value:'20%',  fill:'#EF4444', fontSize:10 }} />
              <Line yAxisId="acht"   type="monotone" dataKey="acht"       name="ACHT"    stroke="#F59E0B" strokeWidth={2} dot={false} />
              <Line yAxisId="repeat" type="monotone" dataKey="repeat_pct" name="Repeat%" stroke="#EF4444" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ChartContainer>
        )}
      </SectionCard>

      {/* Daily Call Volume */}
      <SectionCard title="Daily Call Volume · Last 30 Days" accent={meta.color} textColor={meta.textOnColor}
        onDownload={() => exportCSV(
          ['Date','Offered','Answered','Abandoned'],
          trend.map(r => [fmtDate(r.date), r.offered, r.answered, Math.max(0, r.offered - r.answered)]),
          `${meta.name}_daily_volume`
        )}>
        {trend.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-slate-500 text-sm">No trend data</div>
        ) : (
          <ChartContainer>
            <BarChart data={trend} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fill: '#94A3B8', fontSize: 10 }} tickFormatter={(v: unknown) => fmtDateTick(v)} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 11, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                formatter={(v: unknown, n: unknown) => [Number(v).toLocaleString(), String(n)]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="offered"  name="Offered"  fill={meta.color} radius={[2,2,0,0]} />
              <Bar dataKey="answered" name="Answered" fill="#22C55E"    radius={[2,2,0,0]} />
            </BarChart>
          </ChartContainer>
        )}
      </SectionCard>

      {/* ── Date-wise Performance Table ── */}
      <ExpandableTable
        title={`Date-wise Performance · ${meta.name}`}
        accent={meta.color} textColor={meta.textOnColor}
        onExport={exportPerf}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {['Date','Offered','Answered','AL%','SL%','ACHT','Repeat%',...(meta.hasFCR?['FCR%']:[])].map(h => (
                  <th key={h} className="py-2 px-3 text-left text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trend.length === 0 ? (
                <tr><td colSpan={meta.hasFCR?8:7} className="py-8 text-center text-slate-600">No data available</td></tr>
              ) : trend.map((r, i) => (
                <tr key={r.date} className={`border-b border-slate-100 hover:bg-slate-50 ${i%2===0?'':'bg-transparent'}`}>
                  <td className="py-2 px-3 text-slate-600 font-medium">{fmtDate(r.date)}</td>
                  <td className="py-2 px-3 text-slate-600 tabular-nums">{r.offered.toLocaleString()}</td>
                  <td className="py-2 px-3 text-slate-600 tabular-nums">{r.answered.toLocaleString()}</td>
                  <td className="py-2 px-3 tabular-nums"><span className="px-1.5 py-0.5 rounded text-[11px] font-semibold" style={{ color: alColor(r.al), background: alColor(r.al)+'18' }}>{r.al.toFixed(1)}%</span></td>
                  <td className="py-2 px-3 tabular-nums"><span className="px-1.5 py-0.5 rounded text-[11px] font-semibold" style={{ color: slColor(r.sl), background: slColor(r.sl)+'18' }}>{r.sl.toFixed(1)}%</span></td>
                  <td className="py-2 px-3 tabular-nums"><span className="px-1.5 py-0.5 rounded text-[11px] font-semibold" style={{ color: achtColor(r.acht), background: achtColor(r.acht)+'18' }}>{r.acht}s</span></td>
                  <td className="py-2 px-3 tabular-nums"><span className="px-1.5 py-0.5 rounded text-[11px] font-semibold" style={{ color: repeatColor(r.repeat_pct), background: repeatColor(r.repeat_pct)+'18' }}>{r.repeat_pct.toFixed(1)}%</span></td>
                  {meta.hasFCR && <td className="py-2 px-3 tabular-nums text-slate-600">{r.fcr_pct!=null?`${r.fcr_pct.toFixed(1)}%`:'—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ExpandableTable>

      {/* ── Manpower Details Table ── */}
      <ExpandableTable
        title={`👥 Manpower Details · ${meta.name}`}
        accent={meta.color} textColor={meta.textOnColor}
        onExport={exportManpower}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {['Date','Mandate','Required','Login Count','Deficit'].map(h => (
                  <th key={h} className="py-2 px-3 text-left text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trend.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-slate-600">No data available</td></tr>
              ) : trend.map((r, i) => {
                const deficit = meta.required - r.login_count;
                return (
                  <tr key={r.date} className={`border-b border-slate-100 hover:bg-slate-50 ${i%2===0?'':'bg-transparent'}`}>
                    <td className="py-2 px-3 text-slate-600 font-medium whitespace-nowrap">{fmtDate(r.date)}</td>
                    <td className="py-2 px-3 text-slate-600 tabular-nums">{meta.mandate}</td>
                    <td className="py-2 px-3 text-slate-600 tabular-nums">{meta.required}</td>
                    <td className="py-2 px-3 tabular-nums">
                      <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold"
                        style={{ color: r.login_count>=meta.required?'#22C55E':'#EF4444', background: (r.login_count>=meta.required?'#22C55E':'#EF4444')+'18' }}>
                        {r.login_count}
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
          </table>
        </div>
      </ExpandableTable>

      {/* ── Agent-wise Performance Table ── */}
      <ExpandableTable
        title={`🧑‍💼 Agent-wise Performance · ${meta.name}`}
        accent="#6D28D9" textColor="#FFFFFF"
        onExport={agentRows.length > 0 ? () => {
          const headers = ['Agent ID','Agent Name','Offered','Answered','AL%','SL%','ACHT(s)','Repeat%',...(meta.hasFCR?['FCR%']:[])];
          const rows = agentRows.map(r => [r.agent_id, r.agent_name, r.offered, r.answered, r.al.toFixed(1), r.sl.toFixed(1), r.acht, r.repeat_pct.toFixed(1), ...(meta.hasFCR?[r.fcr_pct!=null?r.fcr_pct.toFixed(1):'']:[])] );
          exportCSV(headers, rows, `${meta.name}_agents`);
        } : undefined}
      >
        {agentLoading ? (
          <div className="py-10 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
            <Download size={14} className="animate-spin" /> Loading agent data…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {['#','Agent Name','Offered','Answered','AL%','SL%','ACHT','Repeat%',...(meta.hasFCR?['FCR%']:[])].map(h => (
                    <th key={h} className="py-2 px-3 text-left text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agentRows.length === 0 ? (
                  <tr><td colSpan={meta.hasFCR?9:8} className="py-8 text-center text-slate-500">No agent data for this period</td></tr>
                ) : (
                  <>
                    {agentRows.map((r, i) => (
                      <tr key={r.agent_id} className={`border-b border-slate-100 hover:bg-purple-50/40 ${i%2===0?'':'bg-transparent'}`}>
                        <td className="py-2 px-3 text-slate-400 tabular-nums">{i+1}</td>
                        <td className="py-2 px-3 text-slate-800 font-semibold whitespace-nowrap">{r.agent_name || r.agent_id}</td>
                        <td className="py-2 px-3 text-slate-600 tabular-nums font-medium">{r.offered.toLocaleString()}</td>
                        <td className="py-2 px-3 text-slate-600 tabular-nums">{r.answered.toLocaleString()}</td>
                        <td className="py-2 px-3 tabular-nums"><span className="px-1.5 py-0.5 rounded text-[11px] font-semibold" style={{ color: alColor(r.al), background: alColor(r.al)+'18' }}>{r.al.toFixed(1)}%</span></td>
                        <td className="py-2 px-3 tabular-nums"><span className="px-1.5 py-0.5 rounded text-[11px] font-semibold" style={{ color: slColor(r.sl), background: slColor(r.sl)+'18' }}>{r.sl.toFixed(1)}%</span></td>
                        <td className="py-2 px-3 tabular-nums"><span className="px-1.5 py-0.5 rounded text-[11px] font-semibold" style={{ color: achtColor(r.acht), background: achtColor(r.acht)+'18' }}>{r.acht}s</span></td>
                        <td className="py-2 px-3 tabular-nums"><span className="px-1.5 py-0.5 rounded text-[11px] font-semibold" style={{ color: repeatColor(r.repeat_pct), background: repeatColor(r.repeat_pct)+'18' }}>{r.repeat_pct.toFixed(1)}%</span></td>
                        {meta.hasFCR && <td className="py-2 px-3 tabular-nums text-slate-600">{r.fcr_pct!=null?`${r.fcr_pct.toFixed(1)}%`:'—'}</td>}
                      </tr>
                    ))}
                    {agentRows.length > 1 && (() => {
                      const tot = agentRows.reduce((acc, r) => ({ off: acc.off + r.offered, ans: acc.ans + r.answered }), { off: 0, ans: 0 });
                      const tAL = tot.off > 0 ? Math.round(tot.ans * 10000 / tot.off) / 100 : 0;
                      return (
                        <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                          <td className="py-2 px-3 text-slate-500 text-[10px] uppercase">—</td>
                          <td className="py-2 px-3 text-slate-700">Total ({agentRows.length} agents)</td>
                          <td className="py-2 px-3 text-slate-700 tabular-nums">{tot.off.toLocaleString()}</td>
                          <td className="py-2 px-3 text-slate-700 tabular-nums">{tot.ans.toLocaleString()}</td>
                          <td className="py-2 px-3 tabular-nums"><span className="px-1.5 py-0.5 rounded text-[11px] font-semibold" style={{ color: alColor(tAL), background: alColor(tAL)+'18' }}>{tAL.toFixed(1)}%</span></td>
                          <td colSpan={meta.hasFCR?4:3} className="py-2 px-3 text-slate-400 text-[11px]">—</td>
                        </tr>
                      );
                    })()}
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}
      </ExpandableTable>
    </div>
    </div>
    </div>
  );
}
