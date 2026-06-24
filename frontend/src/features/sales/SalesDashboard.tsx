import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  ShoppingCart, TrendingUp, DollarSign, CreditCard, RefreshCw,
  Download, ChevronDown, AlertCircle, X, Info, Maximize2,
  Package, BarChart2, Percent, Calendar,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/axios';

// ─── Colors ──────────────────────────────────────────────────────────────────

const COLOR_VIOLET = '#7C3AED';
const COLOR_PINK   = '#EC4899';
const COLOR_GREEN  = '#10B981';
const COLOR_AMBER  = '#F59E0B';
const COLOR_RED    = '#EF4444';
const COLOR_BLUE   = '#3B82F6';
const COLOR_ORANGE = '#F97316';
const COLOR_CYAN   = '#06B6D4';

const DONUT_COLORS = [COLOR_VIOLET, COLOR_GREEN, COLOR_AMBER, COLOR_RED, COLOR_BLUE, COLOR_PINK, COLOR_CYAN, COLOR_ORANGE];

// ─── Types ───────────────────────────────────────────────────────────────────

interface KPIs {
  total_calls: number;
  total_sales: number;
  total_revenue: number;
  avg_sale: number;
  conversion_rate: number;
  cod_count: number;
  paid_count: number;
  cod_pct: number;
  paid_pct: number;
}

interface TrendRow    { hour: number; calls: number; sales: number; revenue: number }
interface LobRow      { lob: string; calls: number; sales: number; revenue: number; conversion: number }
interface PaymentRow  { mode: string; count: number; revenue: number }
interface ProductRow  { product: string; sales: number; revenue: number; avg_value: number }
interface AgentRow    { masid: string; agent_id: string; total_calls: number; sales: number; revenue: number; conversion: number }
interface SubRow      { scenario: string; count: number; revenue: number }
interface Filters     { startDate: string; endDate: string; clientId: string; lob: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T00:00`;
}

function toEndInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T23:59`;
}

function fmtCurrency(n: number): string {
  if (n >= 1_000_000) return `₹${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toLocaleString()}`;
}

function pctColor(n: number): string {
  if (n >= 50) return COLOR_GREEN;
  if (n >= 30) return COLOR_AMBER;
  return COLOR_RED;
}

function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Animated Counter ─────────────────────────────────────────────────────────

function AnimatedNumber({ value, prefix = '', suffix = '', dec = 0 }: {
  value: number; prefix?: string; suffix?: string; dec?: number;
}) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const end = value;
    const duration = 1100;
    const startTime = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(end * eased);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value]);
  const formatted = dec > 0 ? display.toFixed(dec) : Math.round(display).toLocaleString();
  return <span>{prefix}{formatted}{suffix}</span>;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KPICardProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  dec?: number;
  icon: React.ReactNode;
  color: string;
  sub?: string;
  index: number;
}

function KPICard({ label, value, prefix = '', suffix = '', dec = 0, icon, color, sub, index }: KPICardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: 'easeOut' }}
      className="relative bg-gradient-to-br from-[#1E293B] to-[#16213a] rounded-xl p-4 flex flex-col gap-1.5 border border-white/5 overflow-hidden hover:border-white/15 hover:shadow-lg transition-all duration-200 group"
    >
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ backgroundColor: color }} />
      <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, ${color}50, transparent)` }} />
      <div className="pl-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest leading-none">{label}</span>
          <div className="p-1.5 rounded-lg group-hover:scale-110 transition-transform" style={{ backgroundColor: `${color}18` }}>
            <div style={{ color }}>{icon}</div>
          </div>
        </div>
        <div className="text-2xl font-bold text-white tracking-tight leading-none">
          <AnimatedNumber value={value} prefix={prefix} suffix={suffix} dec={dec} />
        </div>
        {sub && <div className="text-[11px] text-slate-500 mt-1.5">{sub}</div>}
      </div>
    </motion.div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({ title, children, className = '', accent = COLOR_VIOLET, description, downloadData }: {
  title: string;
  children: React.ReactNode;
  className?: string;
  accent?: string;
  description?: string;
  downloadData?: { filename: string; rows: Record<string, unknown>[] };
}) {
  const [tipOpen, setTipOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  const header = (onClose?: () => void) => (
    <div className="flex items-center gap-2.5 px-5 py-3 border-b border-white/5">
      <div className="w-1.5 h-4 rounded-full shrink-0" style={{ backgroundColor: accent }} />
      <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest flex-1">{title}</h3>
      {downloadData && downloadData.rows.length > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); downloadCSV(downloadData.filename, downloadData.rows); }}
          title="Download CSV"
          className="text-slate-600 hover:text-slate-300 transition-colors p-0.5 rounded"
        >
          <Download size={13} />
        </button>
      )}
      {description && !onClose && (
        <button onClick={() => setTipOpen(v => !v)} className="text-slate-600 hover:text-slate-300 transition-colors p-0.5 rounded">
          <Info size={13} />
        </button>
      )}
      {!onClose && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
          title="Expand"
          className="text-slate-600 hover:text-slate-300 transition-colors p-0.5 rounded"
        >
          <Maximize2 size={13} />
        </button>
      )}
      {onClose && (
        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-0.5 rounded ml-1">
          <X size={15} />
        </button>
      )}
    </div>
  );

  const modal = createPortal(
    <AnimatePresence>
      {expanded && (
        <motion.div
          key="sales-expand-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-sm"
          onClick={() => setExpanded(false)}
        >
          <motion.div
            key="sales-expand-card"
            initial={{ opacity: 0, scale: 0.95, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="bg-[#1E293B] rounded-2xl border border-white/10 shadow-2xl w-full max-w-6xl flex flex-col overflow-hidden"
            style={{ maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {header(() => setExpanded(false))}
            {description && (
              <div className="px-5 py-2.5 bg-violet-500/5 border-b border-violet-500/10 text-xs text-slate-400 leading-relaxed">
                {description}
              </div>
            )}
            <div className="p-6 overflow-auto flex-1" style={{ minHeight: 400 }}>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={`bg-[#1E293B] rounded-xl border border-white/5 overflow-hidden ${className}`}
      >
        {header()}
        <AnimatePresence>
          {tipOpen && description && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-5 py-3 bg-violet-500/5 border-b border-violet-500/10 text-xs text-slate-400 leading-relaxed">
                {description}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="p-5">{children}</div>
      </motion.div>
      {modal}
    </>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ message = 'No data for this period' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-600">
      <BarChart2 size={32} className="opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ─── Custom Donut Label ───────────────────────────────────────────────────────

function DonutLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: {
  cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; percent: number;
}) {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  if (percent < 0.05) return null;
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="600">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function SalesDashboard() {
  const { user } = useAuthStore();
  const now = new Date();

  // ── State ──
  const [kpis,         setKPIs]         = useState<KPIs | null>(null);
  const [trend,        setTrend]        = useState<TrendRow[]>([]);
  const [lobData,      setLobData]      = useState<LobRow[]>([]);
  const [payment,      setPayment]      = useState<PaymentRow[]>([]);
  const [products,     setProducts]     = useState<ProductRow[]>([]);
  const [agents,       setAgents]       = useState<AgentRow[]>([]);
  const [subScenarios, setSubScenarios] = useState<SubRow[]>([]);
  const [lobList,      setLobList]      = useState<string[]>([]);

  const [filters, setFilters] = useState<Filters>({
    startDate: toDateInput(now),
    endDate:   toEndInput(now),
    clientId:  '',
    lob:       'All',
  });

  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState('');
  const [exporting,     setExporting]     = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [countdown,     setCountdown]     = useState(120);
  const [lobOpen,       setLobOpen]       = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Build query string ──
  const buildQS = useCallback(() => {
    const qs = new URLSearchParams();
    if (filters.startDate) qs.set('startDate', filters.startDate.replace('T', ' '));
    if (filters.endDate)   qs.set('endDate',   filters.endDate.replace('T', ' '));
    if (filters.clientId)  qs.set('clientId',  filters.clientId);
    if (filters.lob && filters.lob !== 'All') qs.set('lob', filters.lob);
    return qs.toString();
  }, [filters]);

  // ── Fetch all data ──
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    const qs = buildQS();
    try {
      const [kRes, tRes, lRes, pRes, prRes, aRes, sRes] = await Promise.all([
        api.get(`/sales/kpis?${qs}`),
        api.get(`/sales/trend?${qs}`),
        api.get(`/sales/by-lob?${qs}`),
        api.get(`/sales/payment?${qs}`),
        api.get(`/sales/products?${qs}`),
        api.get(`/sales/agents?${qs}`),
        api.get(`/sales/sub-scenarios?${qs}`),
      ]);
      setKPIs(kRes.data.data);
      setTrend(tRes.data.data ?? []);
      setLobData(lRes.data.data ?? []);
      setPayment(pRes.data.data ?? []);
      setProducts(prRes.data.data ?? []);
      setAgents(aRes.data.data ?? []);
      setSubScenarios(sRes.data.data ?? []);
      setLastRefreshed(new Date());
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load sales data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [buildQS]);

  // ── Fetch LOB list ──
  const fetchLobList = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (filters.startDate) qs.set('startDate', filters.startDate.replace('T', ' '));
      if (filters.endDate)   qs.set('endDate',   filters.endDate.replace('T', ' '));
      if (filters.clientId)  qs.set('clientId',  filters.clientId);
      const res = await api.get(`/sales/lob-list?${qs}`);
      setLobList(res.data.data ?? []);
    } catch {
      // silently fail for LOB list
    }
  }, [filters.startDate, filters.endDate, filters.clientId]);

  // ── Initial + filter-driven fetch ──
  useEffect(() => {
    fetchAll();
    fetchLobList();
  }, [fetchAll, fetchLobList]);

  // ── Auto-refresh every 120 seconds ──
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(120);

    intervalRef.current = setInterval(() => {
      fetchAll();
      setCountdown(120);
    }, 120_000);

    countdownRef.current = setInterval(() => {
      setCountdown(c => (c > 0 ? c - 1 : 120));
    }, 1_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [fetchAll]);

  // ── Export ──
  const handleExport = async () => {
    setExporting(true);
    try {
      const qs = buildQS();
      const res = await api.get(`/sales/export?${qs}&limit=10000`);
      const rows = res.data.data?.rows ?? [];
      downloadCSV('sales-export', rows);
    } catch {
      // fallback
    } finally {
      setExporting(false);
    }
  };

  // ── Filter helpers ──
  const setFilter = (k: keyof Filters, v: string) => setFilters(f => ({ ...f, [k]: v }));

  // ── Trend chart data (fill missing hours) ──
  const fullTrend = (() => {
    const map = new Map(trend.map(r => [r.hour, r]));
    return Array.from({ length: 24 }, (_, i) => map.get(i) ?? { hour: i, calls: 0, sales: 0, revenue: 0 });
  })();

  const trendRows = fullTrend.map(r => ({
    ...r,
    label: `${String(r.hour).padStart(2, '0')}:00`,
  }));

  // ── Product rows truncated ──
  const productRows = products.map(r => ({
    ...r,
    name: r.product.length > 15 ? r.product.slice(0, 14) + '…' : r.product,
  }));

  return (
    <div className="min-h-screen bg-[#0B1120] text-white">
      {/* ── Header ── */}
      <div className="sticky top-0 z-30 bg-[#0B1120]/90 backdrop-blur-md border-b border-white/5 px-6 py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: `${COLOR_VIOLET}20` }}>
              <TrendingUp size={18} style={{ color: COLOR_VIOLET }} />
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-none">Sales Dashboard</h1>
              <p className="text-[11px] text-slate-500 mt-0.5">Real-time sales performance</p>
            </div>
          </div>

          {/* Live indicator */}
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: COLOR_GREEN }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: COLOR_GREEN }} />
            </span>
            Live · Auto-refresh in {countdown}s
          </div>
        </div>

        {/* ── Filter Bar ── */}
        <div className="flex flex-wrap items-end gap-3 mt-3">
          {/* Start date */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-500 uppercase tracking-wider">From</label>
            <input
              type="datetime-local"
              value={filters.startDate}
              onChange={e => setFilter('startDate', e.target.value)}
              className="bg-[#1E293B] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          {/* End date */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-500 uppercase tracking-wider">To</label>
            <input
              type="datetime-local"
              value={filters.endDate}
              onChange={e => setFilter('endDate', e.target.value)}
              className="bg-[#1E293B] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          {/* LOB dropdown */}
          <div className="flex flex-col gap-1 relative">
            <label className="text-[10px] text-slate-500 uppercase tracking-wider">LOB</label>
            <button
              onClick={() => setLobOpen(v => !v)}
              className="bg-[#1E293B] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-200 flex items-center gap-2 min-w-[120px] focus:outline-none focus:border-violet-500 transition-colors hover:border-white/20"
            >
              <span className="flex-1 text-left">{filters.lob || 'All'}</span>
              <ChevronDown size={12} className={`transition-transform ${lobOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {lobOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full mt-1 left-0 z-50 bg-[#1E293B] border border-white/10 rounded-lg shadow-xl overflow-hidden min-w-[140px]"
                >
                  {['All', ...lobList].map(l => (
                    <button
                      key={l}
                      onClick={() => { setFilter('lob', l); setLobOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-violet-500/10 ${
                        filters.lob === l ? 'text-violet-400 bg-violet-500/5' : 'text-slate-300'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Action buttons */}
          <button
            onClick={() => fetchAll()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all disabled:opacity-50"
            style={{ background: `${COLOR_VIOLET}30`, border: `1px solid ${COLOR_VIOLET}50` }}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>

          <button
            onClick={handleExport}
            disabled={exporting || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all disabled:opacity-50"
            style={{ background: `${COLOR_GREEN}25`, border: `1px solid ${COLOR_GREEN}45` }}
          >
            <Download size={12} className={exporting ? 'animate-bounce' : ''} />
            {exporting ? 'Exporting…' : 'Export Sales'}
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-6 py-6 space-y-6">

        {/* Error banner */}
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
              <button
                onClick={() => fetchAll()}
                className="text-xs underline ml-2 hover:no-underline"
              >Retry</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading overlay hint */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-2 text-xs text-slate-500">
            <div className="h-1 w-1 rounded-full animate-bounce" style={{ backgroundColor: COLOR_VIOLET, animationDelay: '0ms' }} />
            <div className="h-1 w-1 rounded-full animate-bounce" style={{ backgroundColor: COLOR_VIOLET, animationDelay: '150ms' }} />
            <div className="h-1 w-1 rounded-full animate-bounce" style={{ backgroundColor: COLOR_VIOLET, animationDelay: '300ms' }} />
            <span>Loading sales data…</span>
          </div>
        )}

        {/* ── Row 1: 4 Primary KPIs ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KPICard
            label="Total Calls"
            value={kpis?.total_calls ?? 0}
            icon={<ShoppingCart size={14} />}
            color={COLOR_BLUE}
            sub="All calls in period"
            index={0}
          />
          <KPICard
            label="Total Sales"
            value={kpis?.total_sales ?? 0}
            icon={<TrendingUp size={14} />}
            color={COLOR_VIOLET}
            sub="Confirmed sale calls"
            index={1}
          />
          <KPICard
            label="Revenue"
            value={kpis?.total_revenue ?? 0}
            prefix="₹"
            icon={<DollarSign size={14} />}
            color={COLOR_GREEN}
            sub={kpis ? `Avg ₹${(kpis.avg_sale || 0).toFixed(0)}` : undefined}
            index={2}
          />
          <KPICard
            label="Avg Sale Value"
            value={kpis?.avg_sale ?? 0}
            prefix="₹"
            icon={<Package size={14} />}
            color={COLOR_ORANGE}
            sub="Per sale transaction"
            index={3}
          />
        </div>

        {/* ── Row 2: 3 Rate KPIs ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KPICard
            label="Conversion Rate"
            value={kpis?.conversion_rate ?? 0}
            suffix="%"
            dec={1}
            icon={<Percent size={14} />}
            color={COLOR_PINK}
            sub="Sales / Total calls"
            index={4}
          />
          <KPICard
            label="Paid %"
            value={kpis?.paid_pct ?? 0}
            suffix="%"
            dec={1}
            icon={<CreditCard size={14} />}
            color={COLOR_GREEN}
            sub={`${kpis?.paid_count ?? 0} paid orders`}
            index={5}
          />
          <KPICard
            label="COD %"
            value={kpis?.cod_pct ?? 0}
            suffix="%"
            dec={1}
            icon={<Calendar size={14} />}
            color={COLOR_AMBER}
            sub={`${kpis?.cod_count ?? 0} COD orders`}
            index={6}
          />
        </div>

        {/* ── Row 3: Sales & Revenue Trend (full width) ── */}
        <SectionCard
          title="Sales & Revenue Trend — By Hour"
          accent={COLOR_VIOLET}
          description="Hourly breakdown of total calls, sales closed, and revenue generated throughout the day."
          downloadData={{
            filename: 'sales-trend-hourly',
            rows: trendRows as unknown as Record<string, unknown>[],
          }}
        >
          {trendRows.length === 0 || trendRows.every(r => r.calls === 0) ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={trendRows} margin={{ top: 4, right: 60, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 10 }}
                  tickFormatter={v => fmtCurrency(v)} />
                <Tooltip
                  contentStyle={{ background: '#1E293B', border: '1px solid #ffffff15', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#94a3b8' }}
                  formatter={(value: unknown, name: unknown) => {
                    const v = Number(value); const n = String(name);
                    if (n === 'revenue') return [fmtCurrency(v), 'Revenue'];
                    return [v.toLocaleString(), n === 'calls' ? 'Calls' : 'Sales'];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingTop: 8 }} />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="calls"
                  fill={`${COLOR_BLUE}18`}
                  stroke={COLOR_BLUE}
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  dot={false}
                  name="calls"
                />
                <Bar
                  yAxisId="right"
                  dataKey="revenue"
                  fill={`${COLOR_GREEN}55`}
                  stroke={COLOR_GREEN}
                  strokeWidth={0}
                  radius={[2, 2, 0, 0]}
                  name="revenue"
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="sales"
                  fill={`${COLOR_VIOLET}25`}
                  stroke={COLOR_VIOLET}
                  strokeWidth={2}
                  dot={false}
                  name="sales"
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        {/* ── Row 4: Payment Donut + LOB Bar ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Payment Donut */}
          <div className="lg:col-span-2">
            <SectionCard
              title="Payment Mode Breakdown"
              accent={COLOR_PINK}
              description="Distribution of sales by payment method (Prepaid, COD, etc.)."
              downloadData={{
                filename: 'payment-breakdown',
                rows: payment as unknown as Record<string, unknown>[],
              }}
            >
              {payment.length === 0 ? (
                <EmptyState />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={payment}
                        dataKey="count"
                        nameKey="mode"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        labelLine={false}
                        label={DonutLabel as never}
                      >
                        {payment.map((_, i) => (
                          <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: '#1E293B', border: '1px solid #ffffff15', borderRadius: 8, fontSize: 12 }}
                        formatter={(v: unknown, name: unknown) => [`${Number(v).toLocaleString()} orders`, String(name)]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center mt-2">
                    {payment.map((p, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                        <span>{p.mode}</span>
                        <span className="text-slate-600">({p.count})</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </SectionCard>
          </div>

          {/* LOB Bar */}
          <div className="lg:col-span-3">
            <SectionCard
              title="Sales by LOB (Line of Business)"
              accent={COLOR_BLUE}
              description="Calls and sales counts grouped by LOB/Call From field."
              downloadData={{
                filename: 'sales-by-lob',
                rows: lobData as unknown as Record<string, unknown>[],
              }}
            >
              {lobData.length === 0 ? (
                <EmptyState />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={lobData}
                    layout="vertical"
                    margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} />
                    <YAxis
                      type="category"
                      dataKey="lob"
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      width={90}
                    />
                    <Tooltip
                      contentStyle={{ background: '#1E293B', border: '1px solid #ffffff15', borderRadius: 8, fontSize: 12 }}
                      formatter={(v: unknown, name: unknown) => [Number(v).toLocaleString(), String(name) === 'sales' ? 'Sales' : 'Calls']}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                    <Bar dataKey="calls" fill={`${COLOR_BLUE}55`} stroke={COLOR_BLUE} strokeWidth={0.5} radius={[0, 3, 3, 0]} name="calls" />
                    <Bar dataKey="sales" fill={COLOR_VIOLET} stroke="none" radius={[0, 3, 3, 0]} name="sales" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </SectionCard>
          </div>
        </div>

        {/* ── Row 5: Top Products + Sub-Scenarios ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Top Products */}
          <div className="lg:col-span-3">
            <SectionCard
              title="Top Products by Sales Volume"
              accent={COLOR_ORANGE}
              description="Products ranked by number of sales closed. Top 12 shown."
              downloadData={{
                filename: 'top-products',
                rows: products as unknown as Record<string, unknown>[],
              }}
            >
              {productRows.length === 0 ? (
                <EmptyState />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={productRows}
                    margin={{ top: 4, right: 8, left: 0, bottom: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#64748b', fontSize: 9 }}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ background: '#1E293B', border: '1px solid #ffffff15', borderRadius: 8, fontSize: 12 }}
                      labelFormatter={(v) => `Product: ${v}`}
                      formatter={(v: unknown, name: unknown) => {
                        const num = Number(v); const nm = String(name);
                        return [
                          nm === 'revenue' ? fmtCurrency(num) : num.toLocaleString(),
                          nm === 'sales' ? 'Sales' : nm === 'revenue' ? 'Revenue' : 'Avg Value',
                        ];
                      }}
                    />
                    <Bar dataKey="sales" radius={[3, 3, 0, 0]} name="sales">
                      {productRows.map((_, i) => (
                        <Cell
                          key={i}
                          fill={i < 3 ? COLOR_VIOLET : i < 6 ? COLOR_BLUE : `${COLOR_CYAN}bb`}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </SectionCard>
          </div>

          {/* Sub-Scenarios */}
          <div className="lg:col-span-2">
            <SectionCard
              title="Sub-Scenario Distribution"
              accent={COLOR_PINK}
              description="Top 10 sub-scenarios (Category2) for sale calls."
              downloadData={{
                filename: 'sub-scenarios',
                rows: subScenarios as unknown as Record<string, unknown>[],
              }}
            >
              {subScenarios.length === 0 ? (
                <EmptyState />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={subScenarios}
                    layout="vertical"
                    margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} />
                    <YAxis
                      type="category"
                      dataKey="scenario"
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      width={100}
                    />
                    <Tooltip
                      contentStyle={{ background: '#1E293B', border: '1px solid #ffffff15', borderRadius: 8, fontSize: 12 }}
                      formatter={(v: unknown) => [Number(v).toLocaleString(), 'Count']}
                    />
                    <Bar dataKey="count" fill={COLOR_PINK} radius={[0, 3, 3, 0]} name="Count" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </SectionCard>
          </div>
        </div>

        {/* ── Row 6: Agent Leaderboard ── */}
        <SectionCard
          title="Agent Sales Leaderboard"
          accent={COLOR_AMBER}
          description="Top 25 agents ranked by sales closed. Minimum 1 call required."
          downloadData={{
            filename: 'agent-leaderboard',
            rows: agents as unknown as Record<string, unknown>[],
          }}
        >
          {agents.length === 0 ? (
            <EmptyState message="No agent data for this period" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left py-2 px-3 text-slate-500 font-semibold uppercase tracking-wider w-12">Rank</th>
                    <th className="text-left py-2 px-3 text-slate-500 font-semibold uppercase tracking-wider">MASID</th>
                    <th className="text-left py-2 px-3 text-slate-500 font-semibold uppercase tracking-wider">Agent ID</th>
                    <th className="text-right py-2 px-3 text-slate-500 font-semibold uppercase tracking-wider">Calls</th>
                    <th className="text-right py-2 px-3 text-slate-500 font-semibold uppercase tracking-wider">Sales</th>
                    <th className="text-right py-2 px-3 text-slate-500 font-semibold uppercase tracking-wider">Revenue</th>
                    <th className="text-right py-2 px-3 text-slate-500 font-semibold uppercase tracking-wider">Conv%</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((a, i) => {
                    const medals = ['🥇', '🥈', '🥉'];
                    const isTop3 = i < 3;
                    return (
                      <tr
                        key={a.agent_id}
                        className={`border-b border-white/4 transition-colors ${
                          i % 2 === 0 ? 'bg-white/[0.01]' : ''
                        } ${isTop3 ? 'hover:bg-violet-500/5' : 'hover:bg-white/[0.02]'}`}
                      >
                        <td className="py-2.5 px-3">
                          {isTop3 ? (
                            <span className="text-base">{medals[i]}</span>
                          ) : (
                            <span className="text-slate-600 font-mono">{i + 1}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`font-mono font-semibold ${isTop3 ? 'text-white' : 'text-slate-300'}`}>
                            {a.masid}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 font-mono text-[10px]">{a.agent_id}</td>
                        <td className="py-2.5 px-3 text-right text-slate-400">{a.total_calls.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-right">
                          <span className={`font-semibold ${isTop3 ? 'text-violet-300' : 'text-slate-300'}`}>
                            {a.sales.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-300">{fmtCurrency(a.revenue)}</td>
                        <td className="py-2.5 px-3 text-right">
                          <span
                            className="font-bold px-1.5 py-0.5 rounded text-[11px]"
                            style={{
                              color: pctColor(a.conversion),
                              background: `${pctColor(a.conversion)}18`,
                            }}
                          >
                            {a.conversion.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {/* Footer timestamp */}
        <div className="text-center text-[10px] text-slate-600 pb-4">
          Last updated: {lastRefreshed.toLocaleTimeString()} · {user?.name || 'User'}
        </div>
      </div>
    </div>
  );
}
