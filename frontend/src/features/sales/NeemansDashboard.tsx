import { useState, useEffect, useRef } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LabelList, Legend,
} from 'recharts';
import {
  Users, PhoneCall, TrendingUp, ShoppingBag, IndianRupee,
  Target, CreditCard, Wallet, Download, RefreshCw, Maximize2, X, ChevronDown, Settings,
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
}
interface DateRow {
  date: string; connected: number; saleCount: number; revenue: number;
  conversionPct: number; dailyTarget: number; cumulativeRevenue: number; cumulativeTarget: number;
}
interface DateDetail { date: string; saleCount: number; revenue: number; codCount: number; codRevenue: number; paidCount: number; paidRevenue: number; }
interface DashData   { kpis: Kpis; dateRows: DateRow[]; dateTable: DateDetail[]; }

interface AgentRow {
  agent: string; empId: string; totalCalls: number;
  saleCount: number; revenue: number;
  codCount: number; codRevenue: number; codPct: number;
  paidCount: number; paidRevenue: number; paidPct: number;
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
function ChartCard({ title, onExpand, children }: { title: string; onExpand: () => void; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3" style={{ background: NAVY }}>
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <button onClick={onExpand} className="p-1.5 rounded-lg transition text-white/70 hover:text-white hover:bg-white/20">
          <Maximize2 size={14} />
        </button>
      </div>
      <div className="px-2 pb-4">{children}</div>
    </div>
  );
}

// ── Data Table ────────────────────────────────────────────────────────────────
interface TableCol<T> { key: keyof T; label: string; fmt?: (v: any) => string; align?: 'left' | 'right'; }
function DataTable<T extends Record<string, any>>({
  cols, rows, title, accent,
}: { cols: TableCol<T>[]; rows: T[]; title: string; accent: string }) {
  const [search, setSearch] = useState('');
  const [page, setPage]     = useState(1);
  const PER = 15;
  const filtered = rows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(search.toLowerCase())));
  const total = Math.ceil(filtered.length / PER);
  const slice = filtered.slice((page - 1) * PER, page * PER);
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3" style={{ background: NAVY }}>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <span className="text-xs text-indigo-200">({rows.length} rows)</span>
        </div>
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search…"
          className="text-xs rounded-lg px-3 py-1.5 w-36 focus:outline-none bg-white/20 text-white placeholder-indigo-200 border border-white/30" />
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
                  const tot = rows.reduce((s, r) => { const v = Number(r[c.key]); return !isNaN(v) ? s + v : s; }, 0);
                  const isAvg = String(c.key).endsWith('Pct');
                  const avg   = rows.length > 0 ? round1(tot / rows.length) : 0;
                  return (
                    <td key={String(c.key)} className="px-4 py-2 font-bold text-slate-700 whitespace-nowrap"
                        style={{ textAlign: c.align ?? 'left', fontVariantNumeric: 'tabular-nums' }}>
                      {ci === 0 ? 'Total'
                        : isAvg ? (avg > 0 ? `${avg}%` : '')
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
  { key: 'codRevenue',  label: 'COD Revenue',  align: 'right', fmt: fmtMoneyFull },
  { key: 'paidCount',   label: 'Paid Count',   align: 'right', fmt: fmtNum },
  { key: 'paidRevenue', label: 'Paid Revenue', align: 'right', fmt: fmtMoneyFull },
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
function ExportDropdown({ onSaleRaw, onCdr, disabled }: { onSaleRaw: () => void; onCdr: () => void; disabled: boolean }) {
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
        <div className="absolute right-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-slate-100 z-30 min-w-[170px] overflow-hidden">
          <button onClick={() => { onSaleRaw(); setOpen(false); }}
            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 font-medium transition">
            Download Sale Raw
          </button>
          <button onClick={() => { onCdr(); setOpen(false); }}
            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 font-medium transition border-t border-slate-50">
            Download CDR
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

// ── Main Dashboard ─────────────────────────────────────────────────────────────
type Tab       = 'overall' | 'agent';
type ExpandKey = 'conversion' | 'revenue' | 'saleCount' | 'achievement' | 'agentRevenue' | 'agentCodPaid' | null;

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

  async function handleSaleRawExport(start: string, end: string) {
    const res  = await api.get('/sales/neemans-sale-raw-export', { params: { startDate: start, endDate: end } });
    const rows = (res.data?.data ?? []) as Record<string, any>[];
    if (!rows.length) { alert('No data for selected range'); return; }
    const headers = Object.keys(rows[0]);
    const csvRows = rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','));
    downloadCsv(`neemans-sale-raw-${start}-${end}.csv`, headers, csvRows);
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

  type ChartDef = { key: ExpandKey; title: string; comp: (h?: number) => React.ReactNode };
  const OVERALL_CHARTS: ChartDef[] = [
    { key: 'conversion',  title: 'Date-wise Conversion %',       comp: (h) => <ConversionChart data={rows} height={h} /> },
    { key: 'revenue',     title: 'Date-wise Revenue',            comp: (h) => <RevenueChart data={rows} height={h} /> },
    { key: 'saleCount',   title: 'Date-wise Sale Count',         comp: (h) => <SaleCountChart data={rows} height={h} /> },
    { key: 'achievement', title: 'Cumulative Revenue vs Target', comp: (h) => <AchievementChart data={rows} height={h} /> },
  ];
  const AGENT_CHARTS: ChartDef[] = [
    { key: 'agentRevenue',  title: 'Top 5 Agents — Revenue',    comp: (h) => <AgentTop5RevenueChart data={agentData} height={h} /> },
    { key: 'agentCodPaid', title: 'Agent-wise COD% vs Paid%',  comp: (h) => <AgentCodPaidPctChart  data={agentData} height={h} /> },
  ];
  const ALL_CHARTS = [...OVERALL_CHARTS, ...AGENT_CHARTS];
  const expandedChart = ALL_CHARTS.find(c => c.key === expand);

  return (
    <div className="space-y-5 pb-8">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 rounded-2xl" style={{ background: NAVY }}>
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">Neemans Dashboard</h2>
          <p className="text-xs text-indigo-200 mt-0.5">Calling performance &amp; sales analytics</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {tab === 'overall' ? (
            <>
              <select value={month} onChange={e => setMonth(e.target.value)}
                className="text-sm rounded-xl px-3 py-1.5 focus:outline-none shadow-sm bg-white/20 text-white border border-white/30">
                {months.map(m => <option key={m.value} value={m.value} className="text-slate-800">{m.label}</option>)}
              </select>
              <button onClick={() => fetchMain(month)}
                className="p-2 rounded-xl border border-white/30 text-white/80 hover:bg-white/20 transition">
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </button>
            </>
          ) : (
            <>
              <input type="date" value={agentRange.start}
                onChange={e => setAgentRange(r => ({ ...r, start: e.target.value }))}
                className="text-sm rounded-xl px-3 py-1.5 focus:outline-none bg-white/20 text-white border border-white/30 [color-scheme:dark]" />
              <span className="text-white/50 text-sm">to</span>
              <input type="date" value={agentRange.end}
                onChange={e => setAgentRange(r => ({ ...r, end: e.target.value }))}
                className="text-sm rounded-xl px-3 py-1.5 focus:outline-none bg-white/20 text-white border border-white/30 [color-scheme:dark]" />
              <button onClick={() => fetchAgentData(agentRange.start, agentRange.end)} disabled={agentLoading}
                className="p-2 rounded-xl border border-white/30 text-white/80 hover:bg-white/20 transition disabled:opacity-50">
                <RefreshCw size={15} className={agentLoading ? 'animate-spin' : ''} />
              </button>
            </>
          )}
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
          />
        </div>
      </div>

      {/* ── Tab Switcher ── */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: '#EEF2FF' }}>
        {(['overall', 'agent'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-6 py-2 rounded-lg text-sm font-semibold transition-all"
            style={tab === t
              ? { background: NAVY, color: '#fff', boxShadow: '0 2px 8px rgba(13,20,69,0.25)' }
              : { color: '#64748B' }}>
            {t === 'overall' ? 'Overall' : 'Agent-wise'}
          </button>
        ))}
      </div>

      {/* ── Overall loading / error ── */}
      {loading && (
        <div className="flex items-center justify-center py-28">
          <div className="h-10 w-10 border-4 rounded-full animate-spin" style={{ borderTopColor: NAVY, borderColor: '#E2E8F0', borderTopWidth: 4 }} />
        </div>
      )}
      {!loading && error && (
        <div className="text-center py-28">
          <p className="text-red-500 font-semibold text-sm">{error}</p>
          <button onClick={() => fetchMain(month)} className="mt-3 text-xs text-slate-500 underline">Retry</button>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* ════════════ OVERALL TAB ════════════ */}
          {tab === 'overall' && (
            <>
              <div className="grid grid-cols-4 xl:grid-cols-8 gap-2">
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
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {OVERALL_CHARTS.map(ch => (
                  <ChartCard key={ch.key} title={ch.title} onExpand={() => setExpand(ch.key)}>
                    {rows.length === 0
                      ? <div className="flex items-center justify-center h-52 text-sm text-slate-400">No chart data</div>
                      : ch.comp(240)}
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
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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

      {/* ── Expand Modal ── */}
      {expand && expandedChart && (
        <ChartModal title={expandedChart.title} onClose={() => setExpand(null)}>
          {expandedChart.comp(460)}
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
