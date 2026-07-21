import { useState, useEffect, useRef } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LabelList, Legend, PieChart, Pie, Cell,
} from 'recharts';
import {
  Users, PhoneCall, TrendingUp, ShoppingBag, IndianRupee,
  Target, CreditCard, Wallet, Download, RefreshCw, Maximize2, X, ChevronDown, Settings,
  Clock, Activity, BarChart2,
} from 'lucide-react';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/authStore';

// ── Theme ─────────────────────────────────────────────────────────────────────
const NAVY  = '#0D1445';
const G     = '#2D6A4F';
const G2    = '#52B788';
const PAY_C = '#06B6D4';
const COD_C = '#F97316';

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtNum       = (n: number) => n.toLocaleString('en-IN');
const fmtPct       = (n: number) => `${n.toFixed(1)}%`;
const fmtMoney     = (n: number) =>
  n >= 10_00_000 ? `₹${(n / 10_00_000).toFixed(2)}L`
  : n >= 1000    ? `₹${(n / 1000).toFixed(1)}K`
  : `₹${n}`;
const fmtMoneyFull = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const fmtMoneyK    = (v: number) =>
  v >= 100_000 ? `₹${(v / 100_000).toFixed(1)}L` : `₹${(v / 1_000).toFixed(0)}K`;

const months = Array.from({ length: 12 }, (_, i) => {
  const v = `2026-${String(i + 1).padStart(2, '0')}`;
  return { value: v, label: new Date(2026, i, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' }) };
});

function monthToRange(m: string) {
  const [y, mo] = m.split('-').map(Number);
  const last = new Date(y, mo, 0).getDate();
  return {
    start: `${m}-01`,
    end:   `${m}-${String(last).padStart(2, '0')}`,
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Kpis {
  workable: number; connected: number; connectedPct: number;
  totalOrders: number; conversionPct: number;
  revenue: number; target: number; proratedTarget: number;
  daysElapsed: number; daysInMo: number; achievementPct: number;
  paidPct: number; codPct: number;
  rtoCount: number; rtoPct: number;
}
interface DateRow {
  date: string; connected: number; saleCount: number; revenue: number;
  conversionPct: number; dailyTarget: number; cumulativeRevenue: number; cumulativeTarget: number;
}
interface DateDetail { date: string; saleCount: number; revenue: number; codCount: number; codRevenue: number; paidCount: number; paidRevenue: number; paidPct: number; }
interface DashData   { kpis: Kpis; dateRows: DateRow[]; dateTable: DateDetail[]; }

interface AgentRow {
  agent: string; empId: string; totalCalls: number;
  saleCount: number; revenue: number;
  codCount: number; codRevenue: number; codPct: number;
  paidCount: number; paidRevenue: number; paidPct: number;
}

interface NmsAgent {
  id: number;
  empId: string;
  daildeskId: string | null;
  name: string;
  lob: string | null;
  tl: string | null;
  doj: string | null;
  fhd: string | null;
  status: string;
  dol: string | null;
  tenure: number;
  tenureBucket: string;
}

// ── Chart Modal ───────────────────────────────────────────────────────────────
function ChartModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl flex flex-col" style={{ maxHeight: '90vh' }}>
        <div className="flex items-center justify-between px-6 py-4 rounded-t-3xl" style={{ background: NAVY }}>
          <h3 className="font-bold text-white text-base">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/20 transition">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 flex-1 overflow-auto" style={{ minHeight: 460 }}>{children}</div>
      </div>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, color, gradient }: {
  label: string; value: string; sub?: string; icon: React.ElementType; color: string; gradient: string;
}) {
  return (
    <div className="relative rounded-xl overflow-hidden shadow-sm border border-white/40" style={{ background: gradient }}>
      <div className="absolute top-0 right-0 w-14 h-14 rounded-full opacity-10 -translate-y-4 translate-x-4" style={{ background: color }} />
      <div className="relative p-2.5">
        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="p-1 rounded-lg bg-white/30 backdrop-blur-sm flex-shrink-0">
            <Icon size={13} style={{ color }} />
          </div>
          <p className="text-[9.5px] font-semibold text-slate-500 uppercase tracking-wide leading-tight">{label}</p>
        </div>
        <p className="text-lg font-black leading-none" style={{ color }}>{value}</p>
        {sub && <p className="text-[9px] text-slate-400 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ── Chart Card ────────────────────────────────────────────────────────────────
function ChartCard({ title, subtitle, onExpand, children }: { title: string; subtitle?: string; onExpand: () => void; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3" style={{ background: NAVY }}>
        <div>
          <h3 className="text-sm font-bold text-white">{title}</h3>
          {subtitle && <p className="text-[10px] text-indigo-200 mt-0.5">{subtitle}</p>}
        </div>
        <button onClick={onExpand} title="Expand to see the full range" className="p-1.5 rounded-lg transition text-white/70 hover:text-white hover:bg-white/20">
          <Maximize2 size={14} />
        </button>
      </div>
      <div className="px-2 pb-4">{children}</div>
    </div>
  );
}

// ── Data Table ────────────────────────────────────────────────────────────────
interface TableCol<T> { key: keyof T; label: string; fmt?: (v: any) => string; align?: 'left' | 'right'; aggregate?: 'avg' | 'sum' | 'none'; }
function DataTable<T extends Record<string, any>>({
  cols, rows, title, accent,
  dateFrom, dateTo, onDateFrom, onDateTo, onDateRefresh, dateLoading,
}: {
  cols: TableCol<T>[]; rows: T[]; title: string; accent: string;
  dateFrom?: string; dateTo?: string;
  onDateFrom?: (v: string) => void; onDateTo?: (v: string) => void;
  onDateRefresh?: () => void; dateLoading?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage]     = useState(1);
  const PER = 15;
  const filtered = rows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(search.toLowerCase())));
  const total = Math.ceil(filtered.length / PER);
  const slice = filtered.slice((page - 1) * PER, page * PER);
  const hasDateFilter = dateFrom !== undefined && dateTo !== undefined;
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3" style={{ background: NAVY }}>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <span className="text-xs text-indigo-200">({rows.length} rows)</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {hasDateFilter && (
            <>
              <input type="date" value={dateFrom} onChange={e => onDateFrom?.(e.target.value)}
                className="text-xs rounded-lg px-2 py-1.5 focus:outline-none bg-white/20 text-white border border-white/30 [color-scheme:dark] w-32" />
              <span className="text-white/50 text-xs">–</span>
              <input type="date" value={dateTo} onChange={e => onDateTo?.(e.target.value)}
                className="text-xs rounded-lg px-2 py-1.5 focus:outline-none bg-white/20 text-white border border-white/30 [color-scheme:dark] w-32" />
              {onDateRefresh && (
                <button onClick={onDateRefresh} disabled={dateLoading}
                  className="p-1.5 rounded-lg border border-white/30 text-white/80 hover:bg-white/20 transition disabled:opacity-50">
                  <RefreshCw size={13} className={dateLoading ? 'animate-spin' : ''} />
                </button>
              )}
            </>
          )}
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search…"
            className="text-xs rounded-lg px-3 py-1.5 w-36 focus:outline-none bg-white/20 text-white placeholder-indigo-200 border border-white/30" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: accent + '12' }}>
              {cols.map(c => (
                <th key={String(c.key)} className="px-4 py-2.5 font-semibold text-slate-600 whitespace-nowrap" style={{ textAlign: c.align ?? 'left' }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.length === 0
              ? <tr><td colSpan={cols.length} className="text-center py-8 text-slate-400">No data</td></tr>
              : slice.map((row, i) => (
                <tr key={i} className="border-t border-slate-50 hover:bg-slate-50/70 transition-colors">
                  {cols.map(c => (
                    <td key={String(c.key)} className="px-4 py-2.5 text-slate-700 whitespace-nowrap"
                        style={{ textAlign: c.align ?? 'left', fontVariantNumeric: 'tabular-nums' }}>
                      {c.fmt ? c.fmt(row[c.key]) : row[c.key]}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr style={{ background: accent + '08' }} className="border-t border-slate-100">
                {cols.map((c, ci) => {
                  const tot    = rows.reduce((s, r) => { const v = Number(r[c.key]); return !isNaN(v) ? s + v : s; }, 0);
                  const agg    = c.aggregate ?? (String(c.key).endsWith('Pct') ? 'avg' : 'sum');
                  const avg    = rows.length > 0 ? round1(tot / rows.length) : 0;
                  const isNone = agg === 'none';
                  const isAvg  = agg === 'avg';
                  return (
                    <td key={String(c.key)} className="px-4 py-2 font-bold text-slate-700 whitespace-nowrap"
                        style={{ textAlign: c.align ?? 'left', fontVariantNumeric: 'tabular-nums' }}>
                      {ci === 0 ? 'Total'
                        : isNone ? ''
                        : isAvg  ? (avg > 0 ? `${avg}%` : '')
                        : (tot > 0 ? (c.fmt ? c.fmt(tot) : fmtNum(tot)) : '')}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {total > 1 && (
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-slate-50 text-xs text-slate-500">
          <span>{filtered.length} results</span>
          <div className="flex gap-1">
            {Array.from({ length: total }, (_, i) => (
              <button key={i} onClick={() => setPage(i + 1)} className="w-6 h-6 rounded-md transition font-semibold"
                style={{ background: page === i + 1 ? accent : '#F1F5F9', color: page === i + 1 ? '#fff' : '#64748B' }}>
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function round1(n: number) { return Math.round(n * 10) / 10; }

// ── Custom Tooltip ─────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-xl px-3 py-2.5 text-xs min-w-[140px]">
      <p className="font-bold text-slate-600 mb-1.5 pb-1 border-b border-slate-100">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-3 py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-slate-500">{p.name}</span>
          </span>
          <span className="font-semibold" style={{ color: p.color }}>
            {p.name?.toLowerCase().includes('revenue') || p.name?.toLowerCase().includes('target')
              ? fmtMoneyFull(p.value)
              : p.name?.includes('%') ? `${p.value}%` : fmtNum(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Overall Charts ─────────────────────────────────────────────────────────────
function ConversionChart({ data, height = 240 }: { data: any[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 28, right: 12, bottom: 0, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94A3B8' }} interval={0} angle={-35} textAnchor="end" height={42} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} unit="%" tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip />} />
        <Line type="monotone" dataKey="conversionPct" name="Conversion%" stroke="#8B5CF6" strokeWidth={2.5}
          dot={{ r: 4, fill: '#fff', stroke: '#8B5CF6', strokeWidth: 2 }} activeDot={{ r: 6 }}>
          <LabelList dataKey="conversionPct" position="top" formatter={(v: any) => `${v}%`} style={{ fontSize: 9, fill: '#8B5CF6', fontWeight: 700 }} />
        </Line>
      </LineChart>
    </ResponsiveContainer>
  );
}

function RevenueChart({ data, height = 240 }: { data: any[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 28, right: 12, bottom: 0, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94A3B8' }} interval={0} angle={-35} textAnchor="end" height={42} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickFormatter={fmtMoneyK} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="revenue" name="Revenue" fill={G2} radius={[5, 5, 0, 0]} maxBarSize={36}>
          <LabelList dataKey="revenue" position="top" formatter={(v: any) => fmtMoneyK(Number(v))} style={{ fontSize: 8, fill: G, fontWeight: 700 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function SaleCountChart({ data, height = 240 }: { data: any[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 28, right: 12, bottom: 0, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94A3B8' }} interval={0} angle={-35} textAnchor="end" height={42} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} allowDecimals={false} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="saleCount" name="Sales" fill="#F59E0B" radius={[5, 5, 0, 0]} maxBarSize={36}>
          <LabelList dataKey="saleCount" position="top" style={{ fontSize: 9, fill: '#B45309', fontWeight: 700 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function AchievementChart({ data, height = 240 }: { data: any[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 16, right: 12, bottom: 0, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94A3B8' }} interval={0} angle={-35} textAnchor="end" height={42} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickFormatter={fmtMoneyK} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
        <Line type="monotone" dataKey="cumulativeRevenue" name="Achievement" stroke={G} strokeWidth={2.5}
          dot={{ r: 3, fill: '#fff', stroke: G, strokeWidth: 2 }} activeDot={{ r: 6 }} />
        <Line type="monotone" dataKey="cumulativeTarget" name="Target" stroke="#EF4444" strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Agent Revenue Chart ────────────────────────────────────────────────────────
function AgentTop5RevenueChart({ data, height = 280 }: { data: AgentRow[]; height?: number }) {
  const top5 = [...data].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={top5} layout="vertical" margin={{ top: 4, right: 70, bottom: 4, left: 110 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: '#94A3B8' }} tickFormatter={fmtMoneyK} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="agent" tick={{ fontSize: 10, fill: '#334155' }} width={110} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="revenue" name="Revenue" fill={G2} radius={[0, 5, 5, 0]} maxBarSize={30}>
          <LabelList dataKey="revenue" position="right" formatter={(v: any) => fmtMoneyK(Number(v))} style={{ fontSize: 9, fill: G, fontWeight: 700 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Agent COD% / Paid% Line Chart ─────────────────────────────────────────────
function AgentCodPaidPctChart({ data, height = 300 }: { data: AgentRow[]; height?: number }) {
  const sorted = [...data].sort((a, b) => b.revenue - a.revenue).slice(0, 15);
  const chartData = sorted.map(r => ({
    agent: r.agent.length > 12 ? r.agent.slice(0, 12) + '…' : r.agent,
    codPct:  r.codPct,
    paidPct: r.paidPct,
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 20, right: 20, bottom: 60, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
        <XAxis dataKey="agent" tick={{ fontSize: 9, fill: '#94A3B8' }} interval={0} angle={-40} textAnchor="end" height={60} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} unit="%" tickLine={false} axisLine={false} domain={[0, 100]} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
        <Line type="monotone" dataKey="codPct" name="COD %" stroke={COD_C} strokeWidth={2.5}
          dot={{ r: 4, fill: '#fff', stroke: COD_C, strokeWidth: 2 }} activeDot={{ r: 6 }}>
          <LabelList dataKey="codPct" position="top" formatter={(v: any) => `${v}%`} style={{ fontSize: 8, fill: COD_C, fontWeight: 700 }} />
        </Line>
        <Line type="monotone" dataKey="paidPct" name="Paid %" stroke={PAY_C} strokeWidth={2.5}
          dot={{ r: 4, fill: '#fff', stroke: PAY_C, strokeWidth: 2 }} activeDot={{ r: 6 }}>
          <LabelList dataKey="paidPct" position="bottom" formatter={(v: any) => `${v}%`} style={{ fontSize: 8, fill: PAY_C, fontWeight: 700 }} />
        </Line>
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Table Columns ─────────────────────────────────────────────────────────────
const AGENT_COLS: TableCol<AgentRow>[] = [
  { key: 'agent',       label: 'Agent',        align: 'left' },
  { key: 'empId',       label: 'MAS ID',       align: 'left' },
  { key: 'totalCalls',  label: 'Total Calls',  align: 'right', fmt: fmtNum },
  { key: 'saleCount',   label: 'Sale Count',   align: 'right', fmt: fmtNum },
  { key: 'revenue',     label: 'Revenue',      align: 'right', fmt: fmtMoneyFull },
  { key: 'paidCount',   label: 'Paid Count',   align: 'right', fmt: fmtNum },
  { key: 'paidRevenue', label: 'Paid Revenue', align: 'right', fmt: fmtMoneyFull },
  { key: 'paidPct',     label: 'Paid %',       align: 'right', fmt: (v: number) => `${v}%` },
  { key: 'codCount',    label: 'COD Count',    align: 'right', fmt: fmtNum },
  { key: 'codRevenue',  label: 'COD Revenue',  align: 'right', fmt: fmtMoneyFull },
  { key: 'codPct',      label: 'COD %',        align: 'right', fmt: (v: number) => `${v}%` },
];

const DATE_COLS: TableCol<DateDetail>[] = [
  { key: 'date',        label: 'Date',         align: 'left' },
  { key: 'saleCount',   label: 'Sale Count',   align: 'right', fmt: fmtNum },
  { key: 'revenue',     label: 'Revenue',      align: 'right', fmt: fmtMoneyFull },
  { key: 'codCount',    label: 'COD Count',    align: 'right', fmt: fmtNum },
  { key: 'paidCount',   label: 'Paid Count',   align: 'right', fmt: fmtNum },
  { key: 'paidPct',     label: 'Paid %',       align: 'right', fmt: (v: number) => `${v}%` },
];

// ── Export Date Range Modal ───────────────────────────────────────────────────
type ExportType = 'saleRaw' | 'cdr';

function ExportModal({ type, defaultStart, defaultEnd, onClose, onExport }: {
  type: ExportType;
  defaultStart: string;
  defaultEnd: string;
  onClose: () => void;
  onExport: (start: string, end: string) => Promise<void>;
}) {
  const [start,   setStart]   = useState(defaultStart);
  const [end,     setEnd]     = useState(defaultEnd);
  const [loading, setLoading] = useState(false);

  async function handle() {
    if (!start || !end || start > end) { alert('Please select a valid date range'); return; }
    setLoading(true);
    try {
      await onExport(start, end);
      onClose();
    } catch {
      alert('Export failed — please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4" style={{ background: NAVY }}>
          <div>
            <h3 className="font-bold text-white text-sm">
              {type === 'saleRaw' ? 'Download Sale Raw' : 'Download CDR'}
            </h3>
            <p className="text-indigo-200 text-xs mt-0.5">Select date range to export</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">From Date</label>
            <input type="date" value={start} onChange={e => setStart(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">To Date</label>
            <input type="date" value={end} onChange={e => setEnd(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
              Cancel
            </button>
            <button onClick={handle} disabled={loading}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl text-white transition disabled:opacity-60 flex items-center justify-center gap-1.5"
              style={{ background: NAVY }}>
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
              {loading ? 'Exporting…' : 'Export'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Export Dropdown ───────────────────────────────────────────────────────────
function ExportDropdown({ onSaleRaw, onCdr, onApr, disabled }: {
  onSaleRaw: () => void; onCdr: () => void; onApr: () => void; disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => !disabled && setOpen(o => !o)} disabled={disabled}
        className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded-xl shadow-sm transition disabled:opacity-40 bg-white hover:bg-indigo-50"
        style={{ color: NAVY }}>
        <Download size={14} /> Export <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-slate-100 z-30 min-w-[180px] overflow-hidden">
          <button onClick={() => { onSaleRaw(); setOpen(false); }}
            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 font-medium transition">
            Download Sale Raw
          </button>
          <button onClick={() => { onCdr(); setOpen(false); }}
            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 font-medium transition border-t border-slate-50">
            Download CDR
          </button>
          <button onClick={() => { onApr(); setOpen(false); }}
            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 font-medium transition border-t border-slate-50">
            Download APR
          </button>
        </div>
      )}
    </div>
  );
}

// ── CSV helper ────────────────────────────────────────────────────────────────
function downloadCsv(filename: string, headers: string[], rows: (string | number)[]) {
  const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Set Target Modal (super_admin only) ───────────────────────────────────────
function SetTargetModal({ currentMonth, onClose, onSaved }: {
  currentMonth: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [month,   setMonth]   = useState(currentMonth);
  const [amount,  setAmount]  = useState('');
  const [loading, setLoading] = useState(false);
  const [existing, setExisting] = useState<{ month: string; target: number }[]>([]);

  useEffect(() => {
    api.get('/sales/neemans-targets').then(r => setExisting(r.data?.data ?? []));
  }, []);

  async function handleSave() {
    const val = parseFloat(amount.replace(/,/g, ''));
    if (!month || isNaN(val) || val <= 0) { alert('Enter a valid month and target amount'); return; }
    setLoading(true);
    try {
      await api.post('/sales/neemans-targets', { month, target: val });
      onSaved();
      onClose();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to save target');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4" style={{ background: NAVY }}>
          <div>
            <h3 className="font-bold text-white text-sm">Set Monthly Target</h3>
            <p className="text-indigo-200 text-xs mt-0.5">Neemans revenue target</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Month</label>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Target Amount (₹)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="e.g. 6774194"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          {existing.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Existing Targets</p>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {existing.map(e => (
                  <div key={e.month} className="flex justify-between text-xs px-3 py-1.5 rounded-lg bg-slate-50 text-slate-600">
                    <span className="font-medium">{e.month}</span>
                    <span className="font-semibold">₹{e.target.toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
              Cancel
            </button>
            <button onClick={handleSave} disabled={loading}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl text-white transition disabled:opacity-60 flex items-center justify-center gap-1.5"
              style={{ background: NAVY }}>
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <Target size={14} />}
              {loading ? 'Saving…' : 'Save Target'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── APR Types & Charts ────────────────────────────────────────────────────────
interface AprAgentRow {
  empName: string; empId: string; lob: string;
  calls: number; uca: number; attendance: number;
  talk: string; wait: string; pause: string;
  netLogin: string; totalBreak: string;
  avgAcht: number; avgOccu: number;
  firstLogin: string; lastLogout: string;
}
interface AprDateRow  { date: string; calls: number; agents: number; }
interface AprLobRow   { lob: string; calls: number; }
interface AprKpis     { totalCalls: number; totalAgents: number; avgOccu: number; avgAcht: number; totalAttendance: number; }
interface AprDashData { kpis: AprKpis; agentRows: AprAgentRow[]; dateRows: AprDateRow[]; lobRows: AprLobRow[]; }

const LOB_COLORS = ['#6366F1','#10B981','#F59E0B','#EF4444','#06B6D4','#8B5CF6','#F97316','#84CC16'];

function AprCallsByDateChart({ data, height = 260 }: { data: AprDateRow[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 28, right: 12, bottom: 0, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94A3B8' }} interval={0} angle={-35} textAnchor="end" height={44} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} allowDecimals={false} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="calls" name="Calls" fill="#6366F1" radius={[5, 5, 0, 0]} maxBarSize={36}>
          <LabelList dataKey="calls" position="top" style={{ fontSize: 9, fill: '#4338CA', fontWeight: 700 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function AprOccuByAgentChart({ data, height = 280 }: { data: AprAgentRow[]; height?: number }) {
  const top10 = [...data].sort((a, b) => b.avgOccu - a.avgOccu).slice(0, 10);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={top10} layout="vertical" margin={{ top: 8, right: 40, bottom: 0, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: '#94A3B8' }} unit="%" tickLine={false} axisLine={false} domain={[0, 100]} />
        <YAxis type="category" dataKey="empName" tick={{ fontSize: 9, fill: '#64748B' }} width={90} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="avgOccu" name="Occupancy %" fill="#10B981" radius={[0, 5, 5, 0]} maxBarSize={18}>
          <LabelList dataKey="avgOccu" position="right" formatter={(v: any) => `${v}%`} style={{ fontSize: 9, fill: '#059669', fontWeight: 700 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function AprLobPieChart({ data, height = 260 }: { data: AprLobRow[]; height?: number }) {
  const total = data.reduce((s, r) => s + r.calls, 0) || 1;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="calls" nameKey="lob" cx="50%" cy="50%" outerRadius={90} innerRadius={45} paddingAngle={2}
          label={(entry: any) => `${entry.lob}: ${Math.round(entry.calls / total * 100)}%`} labelLine={false}>
          {data.map((_, i) => <Cell key={i} fill={LOB_COLORS[i % LOB_COLORS.length]} />)}
        </Pie>
        <Tooltip formatter={(v: any) => [fmtNum(Number(v)), 'Calls']} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function AprAchtByAgentChart({ data, height = 280 }: { data: AprAgentRow[]; height?: number }) {
  const top10 = [...data].sort((a, b) => b.avgAcht - a.avgAcht).slice(0, 10);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={top10} layout="vertical" margin={{ top: 8, right: 40, bottom: 0, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: '#94A3B8' }} unit="s" tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="empName" tick={{ fontSize: 9, fill: '#64748B' }} width={90} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="avgAcht" name="ACHT (sec)" fill="#F59E0B" radius={[0, 5, 5, 0]} maxBarSize={18}>
          <LabelList dataKey="avgAcht" position="right" formatter={(v: any) => `${v}s`} style={{ fontSize: 9, fill: '#B45309', fontWeight: 700 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── APR Upload Panel ──────────────────────────────────────────────────────────
// ── APR Table Columns ─────────────────────────────────────────────────────────
const APR_AGENT_COLS: TableCol<AprAgentRow>[] = [
  { key: 'empName',    label: 'Agent',        align: 'left',  aggregate: 'none' },
  { key: 'empId',      label: 'EMP ID',       align: 'left',  aggregate: 'none' },
  { key: 'lob',        label: 'LOB',          align: 'left',  aggregate: 'none' },
  { key: 'calls',      label: 'Calls',        align: 'right', fmt: fmtNum },
  { key: 'uca',        label: 'UCA OB',       align: 'right', fmt: fmtNum },
  { key: 'attendance', label: 'Attend.',      align: 'right', fmt: fmtNum },
  { key: 'avgOccu',    label: 'Occu %',       align: 'right', fmt: (v: number) => `${v}%`, aggregate: 'avg' },
  { key: 'avgAcht',    label: 'ACHT (s)',     align: 'right', fmt: fmtNum,                  aggregate: 'avg' },
  { key: 'talk',       label: 'Talk',         align: 'right', aggregate: 'none' },
  { key: 'wait',       label: 'Wait',         align: 'right', aggregate: 'none' },
  { key: 'pause',      label: 'Pause',        align: 'right', aggregate: 'none' },
  { key: 'netLogin',   label: 'Net Login',    align: 'right', aggregate: 'none' },
  { key: 'totalBreak', label: 'Total Break',  align: 'right', aggregate: 'none' },
  { key: 'firstLogin', label: 'First Login',  align: 'right', aggregate: 'none' },
  { key: 'lastLogout', label: 'Last Logout',  align: 'right', aggregate: 'none' },
];

// ── ABC Cart Snap Component ────────────────────────────────────────────────────

// ── ABC Cart Snap Table ────────────────────────────────────────────────────────

const SC_MTD   = '#D9EEF7';
const SC_WEEK  = '#FCE4D6';
const SC_DARK  = '#111827';

type SnapColType = {
  workable: number; attempted: number; connected: number; connectedPct: number;
  callPerAgent: number; saleCount: number; lineItems: number; ptpCount: number;
  ptpRevenue: number; conversionPct: number; revenue: number; target: number;
  achievementPct: number; asp: number; salePerAgent: number; revenuePerAgent: number;
  loginCount: number; talktime: string; wrap: string; idle: string;
  netLogin: string; avgOccu: number; avgAht: number; attemptPerAgent: number;
  totalSales: number; codCount: number; prepaid: number; prepaidPct: number;
};

interface SnapDispRow { name: string; mtd: number; mtdPct: number; weeks: number[]; daily: number[]; }
interface SnapDispSection { names: string[]; rows: SnapDispRow[]; mtdTotal: number; weekTotals: number[]; dailyTotals: number[]; }

interface DelivSlice { counts: Record<string, number>; total: number; }

interface SnapDataType {
  mtd: SnapColType;
  weeks: Array<{ label: string } & SnapColType>;
  daily: Array<{ label: string } & SnapColType>;
  totalTarget: number;
  connectedDisp: SnapDispSection;
  notInterested: SnapDispSection;
  notIntWp:      SnapDispSection;
  deliveryStatus: {
    mtd: DelivSlice;
    weeks: Array<{ label: string } & DelivSlice>;
    daily: Array<{ label: string } & DelivSlice>;
  };
}

function AbcCartSnapTable({ data, month }: { data: SnapDataType; month: string }) {
  type ColEntry = { label: string; col: SnapColType; type: 'mtd' | 'week' | 'day'; weekIdx?: number; dayIdx?: number };

  const hasData = (col: SnapColType) =>
    col.workable > 0 || col.saleCount > 0 || col.connected > 0 || col.loginCount > 0;

  // Only show weeks/days that have actual data in sale raw
  const activeWeekIdxs = data.weeks.map((_, i) => i).filter(i => hasData(data.weeks[i] as SnapColType));
  const activeDayIdxs  = data.daily.map((_, i) => i).filter(i => hasData(data.daily[i] as SnapColType));

  const allCols: ColEntry[] = [
    { label: 'MTD', col: data.mtd, type: 'mtd' },
    ...activeWeekIdxs.map(i => ({ label: data.weeks[i].label, col: data.weeks[i] as SnapColType, type: 'week' as const, weekIdx: i })),
    ...activeDayIdxs.map(i => ({ label: data.daily[i].label, col: data.daily[i] as SnapColType, type: 'day' as const, dayIdx: i })),
  ];

  // Delivery column slices (aligned to filtered allCols)
  const delivCols: DelivSlice[] = allCols.map((c) => {
    if (c.type === 'mtd')  return data.deliveryStatus.mtd;
    if (c.type === 'week') return data.deliveryStatus.weeks[c.weekIdx!] ?? { counts: {}, total: 0 };
    return data.deliveryStatus.daily[c.dayIdx!] ?? { counts: {}, total: 0 };
  });

  const DELIVERY_STATUSES = [
    'Unfulfilled', 'Delivered', 'RTO', 'InTransit', 'Processing', 'Dispatched',
    'Cancelled', 'Out For Delivery', 'FAILED_DELIVERY', 'SHIPMENT_DELAYED',
    'PICKUP_PENDING', 'OUT FOR PICKUP',
  ];

  const colBg = (c: ColEntry) => c.type === 'mtd' ? SC_MTD : c.type === 'week' ? SC_WEEK : 'transparent';
  const hdrBg = (c: ColEntry) => c.type === 'mtd' ? '#0A4A5A' : c.type === 'week' ? '#7C3A10' : '#0D5E73';

  // Sticky left offset for MTD and week columns (metric col = 220px, each data col = 85px)
  const METRIC_W = 220;
  const COL_W    = 85;
  const colStickyStyle = (c: ColEntry, idx: number) =>
    (c.type === 'mtd' || c.type === 'week')
      ? { position: 'sticky' as const, left: METRIC_W + idx * COL_W, zIndex: 9 }
      : {};

  // Sticky column helpers
  const TH_METRIC = 'text-xs font-bold text-white text-left px-3 py-2 whitespace-nowrap sticky left-0 z-30';
  const TH_DATA   = 'text-xs font-bold text-white text-center px-3 py-1.5 whitespace-nowrap';
  const TD_METRIC_CLS = 'text-xs font-semibold px-3 py-2 whitespace-nowrap sticky left-0 z-10 border-b border-slate-200';
  const TD_DATA_CLS   = 'text-xs text-center px-3 py-1.5 whitespace-nowrap border-b border-slate-100';

  type MetricDef = { label: string; key: keyof SnapColType; fmt?: (v: any) => string; bold?: boolean };

  function SectionHdr({ label, color }: { label: string; color: string }) {
    return (
      <tr>
        <td className="sticky left-0 z-10 text-xs font-black text-white px-3 py-2 whitespace-nowrap" style={{ background: color, minWidth: 220 }}>
          {label}
        </td>
        {allCols.map((c, i) => (
          <td key={i} className="text-xs font-semibold text-white text-center px-2 py-2 whitespace-nowrap"
              style={{ background: color, minWidth: 85, ...colStickyStyle(c, i) }}>
            {c.label}
          </td>
        ))}
      </tr>
    );
  }

  function MetricRow({ m, rowBg }: { m: MetricDef; rowBg: string }) {
    const fw = m.bold ? 700 : 400;
    return (
      <tr style={{ background: rowBg }}>
        <td className={TD_METRIC_CLS} style={{ background: rowBg, fontWeight: fw, minWidth: 220, color: SC_DARK }}>
          {m.label}
        </td>
        {allCols.map((c, ci) => {
          const val = c.col[m.key];
          return (
            <td key={ci} className={TD_DATA_CLS}
                style={{ background: colBg(c), fontWeight: fw, fontVariantNumeric: 'tabular-nums', color: SC_DARK, ...colStickyStyle(c, ci) }}>
              {m.fmt ? m.fmt(val) : fmtNum(val as number)}
            </td>
          );
        })}
      </tr>
    );
  }

  function MetricSection({ metrics, rowBg, altBg }: { metrics: MetricDef[]; rowBg: string; altBg: string }) {
    return <>{metrics.map((m, i) => <MetricRow key={String(m.key)+i} m={m} rowBg={i%2===0?rowBg:altBg} />)}</>;
  }

  // Disposition section renderer — returns <thead> + <tbody> so each table gets its own sticky header
  // Only shows active weeks/days; freezes Name + MTD + week columns on horizontal scroll
  function DispSection({ section, showPct, label, color, rowBg, altBg }:
    { section: SnapDispSection; showPct: boolean; label: string; color: string; rowBg: string; altBg: string }) {
    const total = section.mtdTotal;
    const TH    = `${TH_DATA} whitespace-nowrap`;
    // column left offsets: Name=0(220px), MTD=220(85px), [%=305(60px)], Week-i...
    const MTD_L  = 220;
    const MTD_W  = 85;
    const PCT_W  = 60;
    const weekStart = MTD_L + MTD_W + (showPct ? PCT_W : 0);
    return (
      <>
        <thead className="sticky top-0 z-20">
          <tr>
            <th className={`${TH_METRIC} z-30`} style={{ background: color, minWidth: 220 }}>{label}</th>
            <th className={TH} style={{ background: '#0A4A5A', minWidth: MTD_W, position: 'sticky', left: MTD_L, zIndex: 10 }}>MTD</th>
            {showPct && <th className={TH} style={{ background: '#0A4A5A', minWidth: PCT_W, position: 'sticky', left: MTD_L + MTD_W, zIndex: 10 }}>%</th>}
            {activeWeekIdxs.map((wi, ii) => (
              <th key={wi} className={TH} style={{ background: '#7C3A10', minWidth: 85, position: 'sticky', left: weekStart + ii * 85, zIndex: 10 }}>
                {data.weeks[wi].label.toUpperCase()}
              </th>
            ))}
            {activeDayIdxs.map(di => (
              <th key={di+100} className={TH} style={{ background: '#0D5E73', minWidth: 85 }}>
                {data.daily[di].label.toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {section.rows.map((r, ri) => {
            const bg = ri % 2 === 0 ? rowBg : altBg;
            return (
              <tr key={r.name} style={{ background: bg }}>
                <td className={TD_METRIC_CLS} style={{ background: bg, color: SC_DARK, minWidth: 220 }}>{r.name}</td>
                <td className={TD_DATA_CLS} style={{ background: SC_MTD, color: SC_DARK, fontVariantNumeric: 'tabular-nums', position: 'sticky', left: MTD_L, zIndex: 8 }}>{fmtNum(r.mtd)}</td>
                {showPct && <td className={TD_DATA_CLS} style={{ color: SC_DARK, fontVariantNumeric: 'tabular-nums', position: 'sticky', left: MTD_L + MTD_W, zIndex: 8 }}>{r.mtdPct}%</td>}
                {activeWeekIdxs.map((wi, ii) => (
                  <td key={wi} className={TD_DATA_CLS} style={{ background: SC_WEEK, color: SC_DARK, fontVariantNumeric: 'tabular-nums', position: 'sticky', left: weekStart + ii * 85, zIndex: 8 }}>{fmtNum(r.weeks[wi])}</td>
                ))}
                {activeDayIdxs.map(di => (
                  <td key={di+100} className={TD_DATA_CLS} style={{ color: SC_DARK, fontVariantNumeric: 'tabular-nums' }}>{fmtNum(r.daily[di])}</td>
                ))}
              </tr>
            );
          })}
          <tr style={{ background: rowBg }}>
            <td className={TD_METRIC_CLS} style={{ background: rowBg, fontWeight: 700, color: SC_DARK, minWidth: 220 }}>Grand Total</td>
            <td className={TD_DATA_CLS} style={{ background: SC_MTD, fontWeight: 700, color: SC_DARK, fontVariantNumeric: 'tabular-nums', position: 'sticky', left: MTD_L, zIndex: 8 }}>{fmtNum(total)}</td>
            {showPct && <td className={TD_DATA_CLS} style={{ fontWeight: 700, color: SC_DARK, position: 'sticky', left: MTD_L + MTD_W, zIndex: 8 }}>100%</td>}
            {activeWeekIdxs.map((wi, ii) => (
              <td key={wi} className={TD_DATA_CLS} style={{ background: SC_WEEK, fontWeight: 700, color: SC_DARK, fontVariantNumeric: 'tabular-nums', position: 'sticky', left: weekStart + ii * 85, zIndex: 8 }}>{fmtNum(section.weekTotals[wi])}</td>
            ))}
            {activeDayIdxs.map(di => (
              <td key={di+100} className={TD_DATA_CLS} style={{ fontWeight: 700, color: SC_DARK, fontVariantNumeric: 'tabular-nums' }}>{fmtNum(section.dailyTotals[di])}</td>
            ))}
          </tr>
        </tbody>
      </>
    );
  }

  const BASE: MetricDef[] = [
    { label: 'Workable Cases',             key: 'workable',      fmt: fmtNum },
    { label: 'Overall Unique Attempted',   key: 'attempted',     fmt: fmtNum },
    { label: 'Overall Unique Connected',   key: 'connected',     fmt: fmtNum },
    { label: 'Overall Unique Connected %', key: 'connectedPct',  fmt: v => `${v}%` },
    { label: 'Call Per Agent',             key: 'callPerAgent',  fmt: fmtNum },
  ];
  const SALE: MetricDef[] = [
    { label: 'Conversion On Unique Connect', key: 'conversionPct', fmt: v => `${v}%` },
    { label: 'Sale Count',                   key: 'saleCount',     fmt: fmtNum },
    { label: 'Total Line Items Sold',        key: 'lineItems',     fmt: fmtNum },
  ];
  const PTP: MetricDef[] = [
    { label: 'PTP Count',   key: 'ptpCount',   fmt: fmtNum },
    { label: 'PTP Revenue', key: 'ptpRevenue', fmt: fmtMoney },
  ];
  const REV: MetricDef[] = [
    { label: 'Target',           key: 'target',          fmt: fmtMoney },
    { label: 'Achievement %',    key: 'achievementPct',  fmt: v => `${v}%` },
    { label: 'ASP',              key: 'asp',             fmt: fmtMoney },
    { label: 'Sale Per Agent',   key: 'salePerAgent',    fmt: fmtNum },
    { label: 'Revenue Per Agent',key: 'revenuePerAgent', fmt: fmtMoney },
    { label: 'Total Revenue',    key: 'revenue',         fmt: fmtMoney, bold: true },
  ];
  const ADV: MetricDef[] = [
    { label: 'Login Count',          key: 'loginCount',       fmt: fmtNum },
    { label: 'Talktime',             key: 'talktime',         fmt: v => String(v) },
    { label: 'Wrap',                 key: 'wrap',             fmt: v => String(v) },
    { label: 'Idle',                 key: 'idle',             fmt: v => String(v) },
    { label: 'AHT',                  key: 'avgAht',           fmt: v => `${fmtNum(v)} Sec` },
    { label: 'Net Login',            key: 'netLogin',         fmt: v => String(v) },
    { label: 'Occupancy',            key: 'avgOccu',          fmt: v => `${v}%` },
    { label: 'Overall Attempt Per Agent', key: 'attemptPerAgent', fmt: fmtNum },
  ];
  const PAY: MetricDef[] = [
    { label: 'Total Sales',          key: 'totalSales',  fmt: fmtNum },
    { label: 'COD',                  key: 'codCount',    fmt: fmtNum },
    { label: 'Prepaid',              key: 'prepaid',     fmt: fmtNum },
    { label: 'Prepaid Contribution', key: 'prepaidPct',  fmt: v => `${v}%` },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
      <div className="flex items-center gap-3 px-5 py-3 rounded-t-2xl" style={{ background: NAVY }}>
        <h3 className="text-sm font-black text-white">Neemans ABC Cart Snap</h3>
        <span className="text-xs text-indigo-200">{month}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: 900 }}>
          <thead className="sticky top-0 z-20">
            <tr>
              <th className={TH_METRIC} style={{ background: '#0D1445', minWidth: 220 }}>
                <div>METRIC</div>
                <div className="text-indigo-300 font-normal" style={{ fontSize: 10 }}>{month}</div>
              </th>
              {allCols.map((c, i) => (
                <th key={i} className={TH_DATA} style={{ background: hdrBg(c), minWidth: 85, ...colStickyStyle(c, i) }}>
                  {c.label.toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <SectionHdr label="Base Metrics"    color="#17A2C0" />
            <MetricSection metrics={BASE} rowBg="#EBF8FC" altBg="#F5FCFE" />
            <SectionHdr label="Sale Metrics"    color="#2E7D32" />
            <MetricSection metrics={SALE} rowBg="#F0FFF4" altBg="#FAFFFE" />
            <SectionHdr label="PTP Metrics"     color="#6A1B9A" />
            <MetricSection metrics={PTP}  rowBg="#F9F0FF" altBg="#FDF7FF" />
            <SectionHdr label="Revenue Metrics" color="#B45309" />
            <MetricSection metrics={REV}  rowBg="#FFFBF0" altBg="#FEFDF5" />
            <SectionHdr label="Advisors Metrics" color="#1565C0" />
            <MetricSection metrics={ADV}  rowBg="#EFF6FF" altBg="#F8FBFF" />
            <SectionHdr label="Order Type — Payment Mode" color="#00695C" />
            <MetricSection metrics={PAY}  rowBg="#F0FDFA" altBg="#F8FFFD" />
          </tbody>
        </table>
      </div>

      {/* Connected Disposition — separate scrollable table */}
      {data.connectedDisp.names.length > 0 && (
        <div className="overflow-x-auto border-t border-slate-100 mt-0">
          <table className="w-full border-collapse" style={{ minWidth: 900 }}>
            <DispSection section={data.connectedDisp} showPct label="Connected Disposition" color="#0277BD" rowBg="#E3F2FD" altBg="#F0F8FF" />
          </table>
        </div>
      )}

      {/* Not Interested */}
      {data.notInterested.names.length > 0 && (
        <div className="overflow-x-auto border-t border-slate-100">
          <table className="w-full border-collapse" style={{ minWidth: 900 }}>
            <DispSection section={data.notInterested} showPct label="Not Interested" color="#AD1457" rowBg="#FCE4EC" altBg="#FFF0F5" />
          </table>
        </div>
      )}

      {/* Not Interested-Without Pitched */}
      {data.notIntWp.names.length > 0 && (
        <div className="overflow-x-auto border-t border-slate-100">
          <table className="w-full border-collapse" style={{ minWidth: 900 }}>
            <DispSection section={data.notIntWp} showPct={false} label="Not Interested — Without Pitched" color="#4E342E" rowBg="#EFEBE9" altBg="#FAF7F5" />
          </table>
        </div>
      )}

      {/* Delivery Status — last section */}
      <div className="overflow-x-auto border-t border-slate-100">
        <table className="w-full border-collapse" style={{ minWidth: 900 }}>
          <thead className="sticky top-0 z-20">
            <tr>
              <th className={TH_METRIC} style={{ background: '#1565C0', minWidth: 220 }}>Delivery Status</th>
              {allCols.map((c, i) => (
                <th key={i} className={TH_DATA} style={{ background: hdrBg(c), minWidth: 85 }}>
                  {c.label.toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DELIVERY_STATUSES.map((status, si) => {
              const bg = si % 2 === 0 ? '#EFF6FF' : '#F8FBFF';
              return (
                <tr key={status} style={{ background: bg }}>
                  <td className={TD_METRIC_CLS} style={{ background: bg, color: SC_DARK, minWidth: 220 }}>{status}</td>
                  {delivCols.map((dc, ci) => (
                    <td key={ci} className={TD_DATA_CLS}
                        style={{ background: colBg(allCols[ci]), color: SC_DARK, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtNum(dc.counts[status] ?? 0)}
                    </td>
                  ))}
                </tr>
              );
            })}
            {DELIVERY_STATUSES.map((status, si) => {
              const bg = si % 2 === 0 ? '#E8F0FE' : '#F3F8FF';
              return (
                <tr key={status + '%'} style={{ background: bg }}>
                  <td className={TD_METRIC_CLS} style={{ background: bg, color: SC_DARK, minWidth: 220 }}>{status} %</td>
                  {delivCols.map((dc, ci) => (
                    <td key={ci} className={TD_DATA_CLS}
                        style={{ background: colBg(allCols[ci]), color: SC_DARK, fontVariantNumeric: 'tabular-nums' }}>
                      {dc.total > 0 ? ((dc.counts[status] ?? 0) / dc.total * 100).toFixed(0) + '%' : '0%'}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── ABC Cart Snap Types (defined above AbcCartSnapTable) ──────────────────────

// ── Agent Details Tab ──────────────────────────────────────────────────────────
function calcTenurePreview(doj: string, dol: string): { days: number; bucket: string } {
  if (!doj) return { days: 0, bucket: '—' };
  const start = new Date(doj).getTime();
  const end   = dol ? new Date(dol).getTime() : Date.now();
  const days  = Math.max(0, Math.floor((end - start) / 86400000));
  let bucket  = '—';
  if (days >= 181)     bucket = 'Above 180';
  else if (days >= 121) bucket = '121-180';
  else if (days >= 91)  bucket = '91-120';
  else if (days >= 61)  bucket = '61-90';
  else if (days >= 31)  bucket = '31-60';
  else if (days >= 1)   bucket = '0-30';
  return { days, bucket };
}

function AgentDetailsTab({ data, loading, error, onRefresh }: {
  data: NmsAgent[]; loading: boolean; error: string | null; onRefresh: () => void;
}) {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin';
  const [search,    setSearch]    = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editAgent, setEditAgent] = useState<NmsAgent | null>(null);
  const [deleteId,  setDeleteId]  = useState<number | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(false);

  const emptyForm = { emp_id: '', daildesk_id: '', name: '', lob: '', tl: '', doj: '', fhd: '', status: 'Active', dol: '' };
  const [form, setForm] = useState(emptyForm);

  const tenurePreview = calcTenurePreview(form.doj, form.dol);

  function openAdd() { setForm(emptyForm); setEditAgent(null); setModalOpen(true); }
  function openEdit(a: NmsAgent) {
    setForm({
      emp_id: a.empId, daildesk_id: a.daildeskId ?? '', name: a.name,
      lob: a.lob ?? '', tl: a.tl ?? '', doj: a.doj ?? '',
      fhd: a.fhd ?? '', status: a.status, dol: a.dol ?? '',
    });
    setEditAgent(a); setModalOpen(true);
  }

  async function handleSave() {
    if (!form.emp_id.trim() || !form.name.trim()) { alert('Emp ID and Name are required'); return; }
    setSaving(true);
    try {
      if (editAgent) await api.put(`/sales/nms-agent-details/${editAgent.id}`, form);
      else            await api.post('/sales/nms-agent-details', form);
      setModalOpen(false); onRefresh();
    } catch (err: any) { alert(err?.response?.data?.message || err?.message || 'Failed to save'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try { await api.delete(`/sales/nms-agent-details/${deleteId}`); setDeleteId(null); onRefresh(); }
    catch (err: any) { alert(err?.response?.data?.message || err?.message || 'Failed to delete'); }
    finally { setDeleting(false); }
  }

  const filtered = data.filter(a =>
    [a.empId ?? '', a.name ?? '', a.lob ?? '', a.tl ?? '', a.status ?? ''].some(
      s => s.toLowerCase().includes(search.toLowerCase())
    )
  );

  const FIELD_CLS = 'w-full text-xs rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300';
  const LABEL_CLS = 'block text-xs font-semibold text-slate-600 mb-1';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3" style={{ background: NAVY }}>
          <div>
            <h3 className="text-sm font-bold text-white">Agent Details</h3>
            <span className="text-xs text-indigo-200">{data.length} agents</span>
          </div>
          <div className="flex items-center gap-2">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              className="text-xs rounded-lg px-3 py-1.5 w-36 focus:outline-none bg-white/20 text-white placeholder-indigo-200 border border-white/30" />
            {isSuperAdmin && (
              <button onClick={openAdd}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl text-white border border-white/30 hover:bg-white/20 transition">
                + Add Agent
              </button>
            )}
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 border-4 rounded-full animate-spin" style={{ borderTopColor: NAVY, borderColor: '#E2E8F0' }} />
          </div>
        )}
        {!loading && error && (
          <div className="text-center py-12 text-red-500 text-sm font-semibold">{error}</div>
        )}
        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: '#EEF2FF' }}>
                  {['#','Emp ID','Name','TL','DOJ','FHD','Bucket','Status','DOL', ...(isSuperAdmin ? ['Actions'] : [])].map(h => (
                    <th key={h} className="px-3 py-2.5 font-semibold text-slate-600 whitespace-nowrap text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-10 text-slate-400">No agents found</td></tr>
                ) : filtered.map((a, i) => (
                  <tr key={a.id} className="border-t border-slate-50 hover:bg-slate-50/70 transition-colors">
                    <td className="px-3 py-2.5 text-slate-400">{i + 1}</td>
                    <td className="px-3 py-2.5 font-semibold text-slate-700 whitespace-nowrap">{a.empId}</td>
                    <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap font-medium">{a.name}</td>
                    <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{a.tl || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{a.doj || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{a.fhd || '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: '#EEF2FF', color: NAVY }}>{a.tenureBucket || '—'}</span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
                        style={{ background: a.status === 'Active' ? '#10B981' : '#EF4444' }}>{a.status}</span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{a.dol || '—'}</td>
                    {isSuperAdmin && (
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => openEdit(a)}
                            className="px-2 py-1 rounded-lg text-[10px] font-semibold border border-indigo-200 text-indigo-700 hover:bg-indigo-50 transition">
                            Edit
                          </button>
                          <button onClick={() => setDeleteId(a.id)}
                            className="px-2 py-1 rounded-lg text-[10px] font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition">
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4" style={{ background: NAVY, borderRadius: '1rem 1rem 0 0' }}>
              <h3 className="font-bold text-white text-sm">{editAgent ? 'Edit Agent' : 'Add Agent'}</h3>
              <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-xl text-white/70 hover:text-white hover:bg-white/20 transition">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-3 overflow-y-auto" style={{ maxHeight: '70vh' }}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Emp ID *</label>
                  <input className={FIELD_CLS} value={form.emp_id} onChange={e => setForm(f => ({ ...f, emp_id: e.target.value }))} placeholder="EMP001" />
                </div>
                <div>
                  <label className={LABEL_CLS}>DialDesk ID</label>
                  <input className={FIELD_CLS} value={form.daildesk_id} onChange={e => setForm(f => ({ ...f, daildesk_id: e.target.value }))} placeholder="DialDesk-EMP001" />
                </div>
                <div className="col-span-2">
                  <label className={LABEL_CLS}>Name *</label>
                  <input className={FIELD_CLS} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full Name" />
                </div>
                <div>
                  <label className={LABEL_CLS}>LOB</label>
                  <input className={FIELD_CLS} value={form.lob} onChange={e => setForm(f => ({ ...f, lob: e.target.value }))} placeholder="Line of Business" />
                </div>
                <div>
                  <label className={LABEL_CLS}>TL (Team Leader)</label>
                  <input className={FIELD_CLS} value={form.tl} onChange={e => setForm(f => ({ ...f, tl: e.target.value }))} placeholder="TL Name" />
                </div>
                <div>
                  <label className={LABEL_CLS}>DOJ (Date of Joining)</label>
                  <input type="date" className={FIELD_CLS} value={form.doj} onChange={e => setForm(f => ({ ...f, doj: e.target.value }))} />
                </div>
                <div>
                  <label className={LABEL_CLS}>FHD (First Handling Date)</label>
                  <input type="date" className={FIELD_CLS} value={form.fhd} onChange={e => setForm(f => ({ ...f, fhd: e.target.value }))} />
                </div>
                <div>
                  <label className={LABEL_CLS}>Status</label>
                  <select className={FIELD_CLS} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLS}>DOL (Date of Leaving)</label>
                  <input type="date" className={FIELD_CLS} value={form.dol} onChange={e => setForm(f => ({ ...f, dol: e.target.value }))} />
                </div>
              </div>
              {/* Auto-calculated Tenure Preview */}
              {form.doj && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: '#EEF2FF' }}>
                  <div className="flex-1">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Auto-calculated Tenure</p>
                    <p className="text-sm font-black" style={{ color: NAVY }}>{tenurePreview.days} days</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Tenure Bucket</p>
                    <p className="text-sm font-black" style={{ color: NAVY }}>{tenurePreview.bucket}</p>
                  </div>
                  <div className="text-[9px] text-slate-400 text-right leading-tight">
                    {form.dol ? 'DOJ → DOL' : 'DOJ → Today'}
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setModalOpen(false)}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-xl text-white transition disabled:opacity-60 flex items-center justify-center gap-1.5"
                  style={{ background: NAVY }}>
                  {saving ? <RefreshCw size={14} className="animate-spin" /> : null}
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: '#FEF2F2' }}>
              <X size={22} style={{ color: '#EF4444' }} />
            </div>
            <h3 className="font-bold text-slate-800 mb-1">Delete Agent?</h3>
            <p className="text-sm text-slate-500 mb-5">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 py-2.5 text-sm font-semibold rounded-xl text-white transition disabled:opacity-60 flex items-center justify-center gap-1.5"
                style={{ background: '#EF4444' }}>
                {deleting ? <RefreshCw size={14} className="animate-spin" /> : null}
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
type Tab       = 'overall' | 'agent' | 'apr' | 'snap' | 'agentdetails';
type ExpandKey = 'conversion' | 'revenue' | 'saleCount' | 'achievement' | 'agentRevenue' | 'agentCodPaid' |
                 'aprCalls' | 'aprOccu' | 'aprLob' | 'aprAcht' | null;

export default function NeemansDashboard() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin';

  const currentMonth = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; })();
  const [month,        setMonth]        = useState(currentMonth);
  const [tab,          setTab]          = useState<Tab>('overall');
  const [data,         setData]         = useState<DashData | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [expand,       setExpand]       = useState<ExpandKey>(null);

  // Agent tab state
  const [agentRange,   setAgentRange]   = useState(monthToRange(currentMonth));
  const [agentData,    setAgentData]    = useState<AgentRow[]>([]);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentError,   setAgentError]   = useState<string | null>(null);

  // APR tab state
  const [aprRange,    setAprRange]    = useState(monthToRange(currentMonth));
  const [aprData,     setAprData]     = useState<AprDashData | null>(null);
  const [aprLoading,  setAprLoading]  = useState(false);
  const [aprError,    setAprError]    = useState<string | null>(null);

  // ABC Cart Snap tab state
  const [snapMonth,   setSnapMonth]   = useState(currentMonth);
  const [snapData,    setSnapData]    = useState<SnapDataType | null>(null);
  const [snapLoading, setSnapLoading] = useState(false);
  const [snapError,   setSnapError]   = useState<string | null>(null);

  // Agent Details tab state
  const [agentDetailsList,    setAgentDetailsList]    = useState<NmsAgent[]>([]);
  const [agentDetailsLoading, setAgentDetailsLoading] = useState(false);
  const [agentDetailsError,   setAgentDetailsError]   = useState<string | null>(null);

  // Export modal
  const [exportModal,   setExportModal]  = useState<ExportType | null>(null);
  const [targetModal,   setTargetModal]  = useState(false);

  // When month changes, reset agent date range to new month
  useEffect(() => { setAgentRange(monthToRange(month)); }, [month]);

  function fetchMain(m: string) {
    setLoading(true); setError(null);
    api.get('/sales/neemans-dashboard', { params: { month: m } })
      .then(r => { if (r.data?.data) setData(r.data.data); else setError('No data returned'); })
      .catch(err => setError(err?.response?.data?.message || err?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }

  function fetchAgentData(start: string, end: string) {
    setAgentLoading(true); setAgentError(null);
    api.get('/sales/neemans-agent-data', { params: { startDate: start, endDate: end } })
      .then(r => { if (r.data?.data) setAgentData(r.data.data); else setAgentError('No data'); })
      .catch(err => setAgentError(err?.response?.data?.message || err?.message || 'Failed'))
      .finally(() => setAgentLoading(false));
  }

  useEffect(() => { fetchMain(month); }, [month]);

  // Fetch agent data when switching to agent tab or when range changes
  useEffect(() => {
    if (tab === 'agent') fetchAgentData(agentRange.start, agentRange.end);
  }, [tab, agentRange.start, agentRange.end]);

  function fetchAprData(start: string, end: string) {
    setAprLoading(true); setAprError(null);
    api.get('/sales/neemans-apr-dashboard', { params: { startDate: start, endDate: end } })
      .then(r => { if (r.data?.data) setAprData(r.data.data); else setAprError('No APR data'); })
      .catch(err => setAprError(err?.response?.data?.message || err?.message || 'Failed to load APR'))
      .finally(() => setAprLoading(false));
  }

  useEffect(() => {
    if (tab === 'apr') fetchAprData(aprRange.start, aprRange.end);
  }, [tab, aprRange.start, aprRange.end]);

  function fetchSnapData(m: string) {
    setSnapLoading(true); setSnapError(null);
    api.get('/sales/neemans-abc-cart-snap', { params: { month: m } })
      .then(r => { if (r.data?.data) setSnapData(r.data.data); else setSnapError('No data'); })
      .catch(err => setSnapError(err?.response?.data?.message || err?.message || 'Failed'))
      .finally(() => setSnapLoading(false));
  }

  useEffect(() => {
    if (tab === 'snap') fetchSnapData(snapMonth);
  }, [tab, snapMonth]);

  function fetchAgentDetails() {
    setAgentDetailsLoading(true); setAgentDetailsError(null);
    api.get('/sales/nms-agent-details')
      .then(r => setAgentDetailsList(r.data?.data ?? []))
      .catch(err => setAgentDetailsError(err?.response?.data?.message || err?.message || 'Failed'))
      .finally(() => setAgentDetailsLoading(false));
  }

  useEffect(() => {
    if (tab === 'agentdetails') fetchAgentDetails();
  }, [tab]);

  async function handleSaleRawExport(start: string, end: string) {
    const res  = await api.get('/sales/neemans-sale-raw-export', { params: { startDate: start, endDate: end } });
    const rows = (res.data?.data ?? []) as Record<string, any>[];
    if (!rows.length) { alert('No data for selected range'); return; }
    const headers = Object.keys(rows[0]);
    const csvRows = rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','));
    downloadCsv(`neemans-sale-raw-${start}-${end}.csv`, headers, csvRows);
  }

  async function handleAprExport(start: string, end: string) {
    const res  = await api.get('/sales/neemans-apr-export', { params: { startDate: start, endDate: end } });
    const rows = (res.data?.data ?? []) as Record<string, any>[];
    if (!rows.length) { alert('No APR data for selected range'); return; }
    const headers = Object.keys(rows[0]);
    const csvRows = rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','));
    downloadCsv(`neemans-apr-${start}-${end}.csv`, headers, csvRows);
  }

  async function handleCdrExport(start: string, end: string) {
    const res  = await api.get('/sales/neemans-cdr-export', { params: { startDate: start, endDate: end } });
    const rows = (res.data?.data ?? []) as Record<string, any>[];
    if (!rows.length) { alert('No CDR data for selected range'); return; }
    const headers = Object.keys(rows[0]);
    const csvRows = rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','));
    downloadCsv(`neemans-cdr-${start}-${end}.csv`, headers, csvRows);
  }

  const k    = data?.kpis;
  const rows = (data?.dateRows ?? []).map(r => ({
    ...r, label: r.date.replace(/^(\d+)-([A-Za-z]{3}).*$/, '$1-$2'),
  }));
  const rowsLast7 = rows.slice(-7);

  type ChartDef = { key: ExpandKey; title: string; comp: (h?: number, full?: boolean) => React.ReactNode };
  const OVERALL_CHARTS: ChartDef[] = [
    { key: 'conversion',  title: 'Date-wise Conversion %',       comp: (h, full) => <ConversionChart data={full ? rows : rowsLast7} height={h} /> },
    { key: 'revenue',     title: 'Date-wise Revenue',            comp: (h, full) => <RevenueChart data={full ? rows : rowsLast7} height={h} /> },
    { key: 'saleCount',   title: 'Date-wise Sale Count',         comp: (h, full) => <SaleCountChart data={full ? rows : rowsLast7} height={h} /> },
    { key: 'achievement', title: 'Cumulative Revenue vs Target', comp: (h, full) => <AchievementChart data={full ? rows : rowsLast7} height={h} /> },
  ];
  const AGENT_CHARTS: ChartDef[] = [
    { key: 'agentRevenue',  title: 'Top 5 Agents — Revenue',    comp: (h) => <AgentTop5RevenueChart data={agentData} height={h} /> },
    { key: 'agentCodPaid', title: 'Agent-wise COD% vs Paid%',  comp: (h) => <AgentCodPaidPctChart  data={agentData} height={h} /> },
  ];
  const APR_CHARTS: ChartDef[] = [
    { key: 'aprCalls', title: 'Date-wise Calls',         comp: (h) => <AprCallsByDateChart data={aprData?.dateRows ?? []} height={h} /> },
    { key: 'aprOccu',  title: 'Top 10 — Occupancy %',    comp: (h) => <AprOccuByAgentChart  data={aprData?.agentRows ?? []} height={h} /> },
    { key: 'aprLob',   title: 'Calls by LOB',             comp: (h) => <AprLobPieChart       data={aprData?.lobRows ?? []} height={h} /> },
    { key: 'aprAcht',  title: 'Top 10 — ACHT (sec)',      comp: (h) => <AprAchtByAgentChart  data={aprData?.agentRows ?? []} height={h} /> },
  ];
  const ALL_CHARTS = [...OVERALL_CHARTS, ...AGENT_CHARTS, ...APR_CHARTS];
  const expandedChart = ALL_CHARTS.find(c => c.key === expand);

  return (
    <div className="space-y-3 sm:space-y-5 pb-8">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 rounded-2xl" style={{ background: NAVY }}>
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">Neemans Dashboard</h2>
          <p className="text-xs text-indigo-200 mt-0.5">Calling performance &amp; sales analytics</p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end flex-1">
          {(() => {
            if (tab === 'agentdetails') {
              return (
                <button onClick={fetchAgentDetails} disabled={agentDetailsLoading}
                  className="p-2 rounded-xl border border-white/30 text-white/80 hover:bg-white/20 transition disabled:opacity-50">
                  <RefreshCw size={15} className={agentDetailsLoading ? 'animate-spin' : ''} />
                </button>
              );
            }
            const activeRange   = tab === 'overall' ? monthToRange(month)
                                : tab === 'agent'   ? agentRange
                                : tab === 'snap'    ? monthToRange(snapMonth)
                                : aprRange;
            const activeLoading = tab === 'overall' ? loading
                                : tab === 'agent'   ? agentLoading
                                : tab === 'snap'    ? snapLoading
                                : aprLoading;
            const handleStart = (v: string) => {
              if (tab === 'overall') setMonth(v.slice(0, 7));
              else if (tab === 'agent') setAgentRange(r => ({ ...r, start: v }));
              else if (tab === 'snap') setSnapMonth(v.slice(0, 7));
              else setAprRange(r => ({ ...r, start: v }));
            };
            const handleEnd = (v: string) => {
              if (tab === 'overall') setMonth(v.slice(0, 7));
              else if (tab === 'agent') setAgentRange(r => ({ ...r, end: v }));
              else if (tab === 'snap') setSnapMonth(v.slice(0, 7));
              else setAprRange(r => ({ ...r, end: v }));
            };
            const handleRefresh = () => {
              if (tab === 'overall') fetchMain(month);
              else if (tab === 'agent') fetchAgentData(agentRange.start, agentRange.end);
              else if (tab === 'snap') fetchSnapData(snapMonth);
              else fetchAprData(aprRange.start, aprRange.end);
            };
            return (
              <>
                <input type="date" value={activeRange.start} onChange={e => handleStart(e.target.value)}
                  className="text-xs sm:text-sm rounded-xl px-2 sm:px-3 py-1.5 focus:outline-none bg-white/20 text-white border border-white/30 [color-scheme:dark] w-32 sm:w-auto" />
                <span className="text-white/50 text-xs">–</span>
                <input type="date" value={activeRange.end} onChange={e => handleEnd(e.target.value)}
                  className="text-xs sm:text-sm rounded-xl px-2 sm:px-3 py-1.5 focus:outline-none bg-white/20 text-white border border-white/30 [color-scheme:dark] w-32 sm:w-auto" />
                <button onClick={handleRefresh} disabled={activeLoading}
                  className="p-2 rounded-xl border border-white/30 text-white/80 hover:bg-white/20 transition disabled:opacity-50">
                  <RefreshCw size={15} className={activeLoading ? 'animate-spin' : ''} />
                </button>
              </>
            );
          })()}
          {isSuperAdmin && (
            <button onClick={() => setTargetModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-xl border border-white/30 text-white/80 hover:bg-white/20 transition">
              <Settings size={14} /> Set Target
            </button>
          )}
          <ExportDropdown
            disabled={false}
            onSaleRaw={() => setExportModal('saleRaw')}
            onCdr={() => setExportModal('cdr')}
            onApr={() => handleAprExport(aprRange.start, aprRange.end)}
          />
        </div>
      </div>

      {/* ── Tab Switcher ── */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: '#EEF2FF' }}>
        {([['overall', 'Overall'], ['agent', 'Agent-wise'], ['apr', 'APR'], ['snap', 'ABC Cart Snap'], ['agentdetails', 'Agent Details']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all"
            style={tab === t
              ? { background: NAVY, color: '#fff', boxShadow: '0 2px 8px rgba(13,20,69,0.25)' }
              : { color: '#64748B' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── APR TAB (independent of overall dashboard) ── */}
      {tab === 'apr' && (
        <div className="space-y-3 sm:space-y-5">

          {aprLoading && (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 border-4 rounded-full animate-spin" style={{ borderTopColor: NAVY, borderColor: '#E2E8F0' }} />
            </div>
          )}

          {!aprLoading && aprError && (
            <div className="text-center py-12 text-red-500 text-sm font-semibold">{aprError}</div>
          )}

          {!aprLoading && !aprError && aprData && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2">
                <KpiCard label="Total Calls"  value={fmtNum(aprData.kpis.totalCalls)}
                  icon={PhoneCall}  color="#6366F1" gradient="linear-gradient(135deg,#EEF2FF,#C7D2FE)" />
                <KpiCard label="Agents"       value={fmtNum(aprData.kpis.totalAgents)}
                  icon={Users}      color="#10B981" gradient="linear-gradient(135deg,#ECFDF5,#A7F3D0)" />
                <KpiCard label="Avg Occu %"   value={`${aprData.kpis.avgOccu}%`}
                  sub="Average occupancy"
                  icon={Activity}   color="#F59E0B" gradient="linear-gradient(135deg,#FFFBEB,#FDE68A)" />
                <KpiCard label="Avg ACHT"     value={`${fmtNum(aprData.kpis.avgAcht)}s`}
                  sub="Avg call handle time"
                  icon={Clock}      color="#06B6D4" gradient="linear-gradient(135deg,#ECFEFF,#A5F3FC)" />
                <KpiCard label="Attendance"   value={fmtNum(aprData.kpis.totalAttendance)}
                  sub="Total agent days"
                  icon={BarChart2}  color="#8B5CF6" gradient="linear-gradient(135deg,#F5F3FF,#DDD6FE)" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
                <ChartCard title="Date-wise Calls" onExpand={() => setExpand('aprCalls')}>
                  {aprData.dateRows.length === 0
                    ? <div className="flex items-center justify-center h-52 text-sm text-slate-400">No data — upload APR first</div>
                    : <AprCallsByDateChart data={aprData.dateRows} height={260} />}
                </ChartCard>
                <ChartCard title="Calls by LOB" onExpand={() => setExpand('aprLob')}>
                  {aprData.lobRows.length === 0
                    ? <div className="flex items-center justify-center h-52 text-sm text-slate-400">No data</div>
                    : <AprLobPieChart data={aprData.lobRows} height={260} />}
                </ChartCard>
                <ChartCard title="Top 10 Agents — Occupancy %" onExpand={() => setExpand('aprOccu')}>
                  {aprData.agentRows.length === 0
                    ? <div className="flex items-center justify-center h-52 text-sm text-slate-400">No data</div>
                    : <AprOccuByAgentChart data={aprData.agentRows} height={280} />}
                </ChartCard>
                <ChartCard title="Top 10 Agents — ACHT (sec)" onExpand={() => setExpand('aprAcht')}>
                  {aprData.agentRows.length === 0
                    ? <div className="flex items-center justify-center h-52 text-sm text-slate-400">No data</div>
                    : <AprAchtByAgentChart data={aprData.agentRows} height={280} />}
                </ChartCard>
              </div>

              <DataTable<AprAgentRow>
                title="Agent-wise APR Breakdown"
                accent="#6366F1"
                cols={APR_AGENT_COLS}
                rows={aprData.agentRows}
                dateFrom={aprRange.start}
                dateTo={aprRange.end}
                onDateFrom={v => setAprRange(r => ({ ...r, start: v }))}
                onDateTo={v => setAprRange(r => ({ ...r, end: v }))}
                onDateRefresh={() => fetchAprData(aprRange.start, aprRange.end)}
                dateLoading={aprLoading}
              />
            </>
          )}

          {!aprLoading && !aprError && !aprData && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <BarChart2 size={40} className="text-slate-300" />
              <p className="text-slate-400 text-sm">No APR data for this date range. Upload via Neemans → Data Uploader → APR Data.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Overall loading / error (only for overall / agent tabs) ── */}
      {tab !== 'apr' && tab !== 'snap' && tab !== 'agentdetails' && loading && (
        <div className="flex items-center justify-center py-28">
          <div className="h-10 w-10 border-4 rounded-full animate-spin" style={{ borderTopColor: NAVY, borderColor: '#E2E8F0', borderTopWidth: 4 }} />
        </div>
      )}
      {tab !== 'apr' && tab !== 'snap' && tab !== 'agentdetails' && !loading && error && (
        <div className="text-center py-28">
          <p className="text-red-500 font-semibold text-sm">{error}</p>
          <button onClick={() => fetchMain(month)} className="mt-3 text-xs text-slate-500 underline">Retry</button>
        </div>
      )}

      {tab !== 'apr' && tab !== 'snap' && tab !== 'agentdetails' && !loading && !error && data && (
        <>
          {/* ════════════ OVERALL TAB ════════════ */}
          {tab === 'overall' && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-9 gap-2">
                <KpiCard label="Workable Data"  value={fmtNum(k!.workable)}       sub="Allocation"
                  icon={Users}       color={G}        gradient="linear-gradient(135deg,#F0FAF4,#D8F3DC)" />
                <KpiCard label="Connected %"    value={fmtPct(k!.connectedPct)}   sub={`${fmtNum(k!.connected)} calls`}
                  icon={PhoneCall}   color="#0EA5E9"  gradient="linear-gradient(135deg,#F0F9FF,#BAE6FD)" />
                <KpiCard label="Conversion %"   value={fmtPct(k!.conversionPct)}  sub="Of connected"
                  icon={TrendingUp}  color="#8B5CF6"  gradient="linear-gradient(135deg,#F5F3FF,#DDD6FE)" />
                <KpiCard label="Total Orders"   value={fmtNum(k!.totalOrders)}    sub="Sale records"
                  icon={ShoppingBag} color="#F59E0B"  gradient="linear-gradient(135deg,#FFFBEB,#FDE68A)" />
                <KpiCard label="Revenue"        value={fmtMoney(k!.revenue)}      sub={fmtMoneyFull(k!.revenue)}
                  icon={IndianRupee} color="#10B981"  gradient="linear-gradient(135deg,#ECFDF5,#A7F3D0)" />
                <KpiCard label="Achievement %"  value={fmtPct(k!.achievementPct)} sub={`Till day ${k!.daysElapsed}: ${fmtMoney(k!.proratedTarget)} / ${fmtMoney(k!.target)}`}
                  icon={Target}
                  color={k!.achievementPct >= 100 ? '#10B981' : k!.achievementPct >= 70 ? '#F59E0B' : '#EF4444'}
                  gradient={k!.achievementPct >= 100 ? 'linear-gradient(135deg,#ECFDF5,#A7F3D0)' : k!.achievementPct >= 70 ? 'linear-gradient(135deg,#FFFBEB,#FDE68A)' : 'linear-gradient(135deg,#FEF2F2,#FECACA)'} />
                <KpiCard label="Paid %"         value={fmtPct(k!.paidPct)}        sub="Of total orders"
                  icon={CreditCard}  color={PAY_C}   gradient="linear-gradient(135deg,#ECFEFF,#A5F3FC)" />
                <KpiCard label="COD %"          value={fmtPct(k!.codPct)}         sub="Of total orders"
                  icon={Wallet}      color={COD_C}   gradient="linear-gradient(135deg,#FFF7ED,#FED7AA)" />
                <KpiCard label="RTO %"          value={fmtPct(k!.rtoPct)}         sub={`${fmtNum(k!.rtoCount)} orders`}
                  icon={TrendingUp}  color="#EF4444" gradient="linear-gradient(135deg,#FEF2F2,#FECACA)" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
                {OVERALL_CHARTS.map(ch => (
                  <ChartCard key={ch.key} title={ch.title} subtitle="Last 7 days · click ⤢ to expand" onExpand={() => setExpand(ch.key)}>
                    {rows.length === 0
                      ? <div className="flex items-center justify-center h-52 text-sm text-slate-400">No chart data</div>
                      : ch.comp(240, false)}
                  </ChartCard>
                ))}
              </div>

              <DataTable<DateDetail> title="Date-wise Breakdown" accent="#8B5CF6" cols={DATE_COLS} rows={data.dateTable} />
            </>
          )}

          {/* ════════════ AGENT-WISE TAB ════════════ */}
          {tab === 'agent' && (
            <>
              {agentLoading && (
                <div className="flex items-center justify-center py-20">
                  <div className="h-8 w-8 border-4 rounded-full animate-spin" style={{ borderTopColor: NAVY, borderColor: '#E2E8F0' }} />
                </div>
              )}

              {!agentLoading && agentError && (
                <div className="text-center py-16 text-red-500 text-sm font-semibold">{agentError}</div>
              )}

              {!agentLoading && !agentError && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
                    {/* Revenue chart */}
                    <ChartCard title="Top 5 Agents — Revenue" onExpand={() => setExpand('agentRevenue')}>
                      {agentData.length === 0
                        ? <div className="flex items-center justify-center h-64 text-sm text-slate-400">No agent data</div>
                        : <AgentTop5RevenueChart data={agentData} height={300} />}
                    </ChartCard>

                    {/* COD% vs Paid% line chart */}
                    <ChartCard title="Agent-wise COD% vs Paid%" onExpand={() => setExpand('agentCodPaid')}>
                      {agentData.length === 0
                        ? <div className="flex items-center justify-center h-64 text-sm text-slate-400">No agent data</div>
                        : <AgentCodPaidPctChart data={agentData} height={300} />}
                    </ChartCard>
                  </div>

                  {/* Agent breakdown table */}
                  <DataTable<AgentRow>
                    title="Agent-wise Breakdown"
                    accent={NAVY}
                    cols={AGENT_COLS}
                    rows={agentData}
                  />
                </>
              )}
            </>
          )}
        </>
      )}

      {/* ── ABC Cart Snap TAB ── */}
      {tab === 'snap' && (
        <div className="space-y-0">
          {snapLoading && (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 border-4 rounded-full animate-spin" style={{ borderTopColor: NAVY, borderColor: '#E2E8F0' }} />
            </div>
          )}
          {!snapLoading && snapError && (
            <div className="text-center py-12 text-red-500 text-sm font-semibold">{snapError}</div>
          )}
          {!snapLoading && !snapError && snapData && (
            <AbcCartSnapTable data={snapData} month={snapMonth} />
          )}
          {!snapLoading && !snapError && !snapData && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <BarChart2 size={40} className="text-slate-300" />
              <p className="text-slate-400 text-sm">No data for this month. Upload allocation and sale raw data first.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Agent Details TAB ── */}
      {tab === 'agentdetails' && (
        <AgentDetailsTab
          data={agentDetailsList}
          loading={agentDetailsLoading}
          error={agentDetailsError}
          onRefresh={fetchAgentDetails}
        />
      )}

      {/* ── Expand Modal ── */}
      {expand && expandedChart && (
        <ChartModal title={expandedChart.title} onClose={() => setExpand(null)}>
          {expandedChart.comp(460, true)}
        </ChartModal>
      )}

      {/* ── Export Date Range Modal ── */}
      {exportModal && (
        <ExportModal
          type={exportModal}
          defaultStart={agentRange.start}
          defaultEnd={agentRange.end}
          onClose={() => setExportModal(null)}
          onExport={exportModal === 'saleRaw' ? handleSaleRawExport : handleCdrExport}
        />
      )}

      {/* ── Set Target Modal (super_admin only) ── */}
      {targetModal && (
        <SetTargetModal
          currentMonth={month}
          onClose={() => setTargetModal(false)}
          onSaved={() => fetchMain(month)}
        />
      )}
    </div>
  );
}
