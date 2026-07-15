import { useState, useEffect, useRef } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LabelList, Legend,
} from 'recharts';
import {
  Users, PhoneCall, TrendingUp, ShoppingBag, IndianRupee,
  Target, CreditCard, Wallet, Download, RefreshCw, Maximize2, X,
} from 'lucide-react';
import api from '@/lib/axios';

// ── Theme ─────────────────────────────────────────────────────────────────────
const G   = '#2D6A4F';
const G2  = '#52B788';
const G3  = '#B7E4C7';

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtNum   = (n: number) => n.toLocaleString('en-IN');
const fmtPct   = (n: number) => `${n.toFixed(1)}%`;
const fmtMoney = (n: number) =>
  n >= 10_00_000 ? `₹${(n / 10_00_000).toFixed(2)}L`
  : n >= 1000    ? `₹${(n / 1000).toFixed(1)}K`
  : `₹${n}`;
const fmtMoneyFull = (n: number) => `₹${n.toLocaleString('en-IN')}`;

const months = Array.from({ length: 12 }, (_, i) => {
  const v = `2026-${String(i + 1).padStart(2, '0')}`;
  return { value: v, label: new Date(2026, i, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' }) };
});

// ── Types ─────────────────────────────────────────────────────────────────────
interface Kpis {
  workable: number; connected: number; connectedPct: number;
  totalOrders: number; conversionPct: number;
  revenue: number; target: number; achievementPct: number;
  paidPct: number; codPct: number;
}
interface DateRow {
  date: string; connected: number; saleCount: number; revenue: number;
  conversionPct: number; dailyTarget: number; cumulativeRevenue: number; cumulativeTarget: number;
}
interface AgentRow  { agent: string; saleCount: number; revenue: number; codCount: number; codRevenue: number; paidCount: number; paidRevenue: number; }
interface DateDetail { date: string; saleCount: number; revenue: number; codCount: number; codRevenue: number; paidCount: number; paidRevenue: number; }
interface DashData  { kpis: Kpis; dateRows: DateRow[]; agentTable: AgentRow[]; dateTable: DateDetail[]; }

// ── Chart Modal ───────────────────────────────────────────────────────────────
interface ChartModalProps { title: string; onClose: () => void; children: React.ReactNode; }
function ChartModal({ title, onClose, children }: ChartModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl flex flex-col"
           style={{ maxHeight: '90vh' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ background: '#1D4ED8' }}>
          <h3 className="font-bold text-white text-base">{title}</h3>
          <button onClick={onClose}
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/20 transition">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 flex-1 overflow-auto" style={{ minHeight: 460 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color: string; gradient: string;
}
function KpiCard({ label, value, sub, icon: Icon, color, gradient }: KpiCardProps) {
  return (
    <div className="relative rounded-xl overflow-hidden shadow-sm border border-white/40"
         style={{ background: gradient }}>
      <div className="absolute top-0 right-0 w-14 h-14 rounded-full opacity-10 -translate-y-4 translate-x-4"
           style={{ background: color }} />
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
interface ChartCardProps {
  title: string; accent: string; onExpand: () => void; children: React.ReactNode;
}
function ChartCard({ title, onExpand, children }: ChartCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3" style={{ background: '#1D4ED8' }}>
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <button onClick={onExpand} title="Expand"
          className="p-1.5 rounded-lg transition text-white/70 hover:text-white hover:bg-white/20">
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

  const filtered = rows.filter(r =>
    Object.values(r).some(v => String(v).toLowerCase().includes(search.toLowerCase()))
  );
  const total = Math.ceil(filtered.length / PER);
  const slice = filtered.slice((page - 1) * PER, page * PER);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3" style={{ background: '#1D4ED8' }}>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <span className="text-xs text-blue-200 ml-1">({rows.length} rows)</span>
        </div>
        <input
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search…"
          className="text-xs rounded-lg px-3 py-1.5 w-36 focus:outline-none bg-white/20 text-white placeholder-blue-200 border border-white/30"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: accent + '12' }}>
              {cols.map(c => (
                <th key={String(c.key)}
                  className="px-4 py-2.5 font-semibold text-slate-600 whitespace-nowrap"
                  style={{ textAlign: c.align ?? 'left' }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 ? (
              <tr><td colSpan={cols.length} className="text-center py-8 text-slate-400">No data</td></tr>
            ) : (
              slice.map((row, i) => (
                <tr key={i}
                  className="border-t border-slate-50 hover:bg-slate-50/70 transition-colors">
                  {cols.map(c => (
                    <td key={String(c.key)}
                      className="px-4 py-2.5 text-slate-700 whitespace-nowrap"
                      style={{ textAlign: c.align ?? 'left', fontVariantNumeric: 'tabular-nums' }}>
                      {c.fmt ? c.fmt(row[c.key]) : row[c.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr style={{ background: accent + '08' }} className="border-t border-slate-100">
                {cols.map((c, ci) => {
                  const tot = rows.reduce((s, r) => {
                    const v = Number(r[c.key]);
                    return !isNaN(v) ? s + v : s;
                  }, 0);
                  return (
                    <td key={String(c.key)}
                      className="px-4 py-2 font-bold text-slate-700 whitespace-nowrap"
                      style={{ textAlign: c.align ?? 'left', fontVariantNumeric: 'tabular-nums' }}>
                      {ci === 0 ? 'Total' : (tot > 0 ? (c.fmt ? c.fmt(tot) : fmtNum(tot)) : '')}
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
              <button key={i} onClick={() => setPage(i + 1)}
                className="w-6 h-6 rounded-md transition font-semibold"
                style={{
                  background: page === i + 1 ? accent : '#F1F5F9',
                  color: page === i + 1 ? '#fff' : '#64748B',
                }}>
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-xl px-3 py-2.5 text-xs min-w-[130px]">
      <p className="font-bold text-slate-600 mb-1.5 pb-1 border-b border-slate-100">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-3 py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-slate-500">{p.name}</span>
          </span>
          <span className="font-semibold" style={{ color: p.color }}>
            {typeof p.value === 'number' && p.name?.toLowerCase().includes('revenue') ||
             p.name?.toLowerCase().includes('target') || p.name?.toLowerCase().includes('achievement')
              ? fmtMoneyFull(p.value)
              : p.name?.includes('%') ? `${p.value}%` : fmtNum(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Chart Components ──────────────────────────────────────────────────────────
function ConversionChart({ data, height = 240 }: { data: any[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 28, right: 12, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id="convGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94A3B8' }} interval={0} angle={-35} textAnchor="end" height={42} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} unit="%" tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip />} />
        <Line type="monotone" dataKey="conversionPct" name="Conversion%" stroke="#8B5CF6" strokeWidth={2.5}
          dot={{ r: 4, fill: '#fff', stroke: '#8B5CF6', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#8B5CF6' }}>
          <LabelList dataKey="conversionPct" position="top"
            formatter={(v: any) => `${v}%`}
            style={{ fontSize: 9, fill: '#8B5CF6', fontWeight: 700 }} />
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
        <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickFormatter={v => v >= 100000 ? `₹${(v/100000).toFixed(1)}L` : `₹${(v/1000).toFixed(0)}K`} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="revenue" name="Revenue" fill={G2} radius={[5, 5, 0, 0]} maxBarSize={36}>
          <LabelList dataKey="revenue" position="top"
            formatter={(v: any) => { const n = Number(v); return n >= 100000 ? `₹${(n/100000).toFixed(1)}L` : `₹${(n/1000).toFixed(0)}K`; }}
            style={{ fontSize: 8, fill: G, fontWeight: 700 }} />
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
        <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickFormatter={v => v >= 100000 ? `₹${(v/100000).toFixed(1)}L` : `₹${(v/1000).toFixed(0)}K`} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
        <Line type="monotone" dataKey="cumulativeRevenue" name="Achievement" stroke={G} strokeWidth={2.5}
          dot={{ r: 3, fill: '#fff', stroke: G, strokeWidth: 2 }} activeDot={{ r: 6 }} />
        <Line type="monotone" dataKey="cumulativeTarget" name="Target" stroke="#EF4444" strokeWidth={1.5}
          strokeDasharray="6 3" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Table column definitions ──────────────────────────────────────────────────
const AGENT_COLS: TableCol<AgentRow>[] = [
  { key: 'agent',       label: 'Agent',        align: 'left' },
  { key: 'saleCount',   label: 'Sale Count',   align: 'right', fmt: fmtNum },
  { key: 'revenue',     label: 'Revenue',      align: 'right', fmt: fmtMoneyFull },
  { key: 'codCount',    label: 'COD Count',    align: 'right', fmt: fmtNum },
  { key: 'codRevenue',  label: 'COD Revenue',  align: 'right', fmt: fmtMoneyFull },
  { key: 'paidCount',   label: 'Paid Count',   align: 'right', fmt: fmtNum },
  { key: 'paidRevenue', label: 'Paid Revenue', align: 'right', fmt: fmtMoneyFull },
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

// ── Main Dashboard ─────────────────────────────────────────────────────────────
type ExpandKey = 'conversion' | 'revenue' | 'saleCount' | 'achievement' | null;

export default function NeemansDashboard() {
  const [month,   setMonth]   = useState('2026-06');
  const [data,    setData]    = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [expand,  setExpand]  = useState<ExpandKey>(null);

  function fetchData(m: string) {
    setLoading(true); setError(null);
    api.get('/sales/neemans-dashboard', { params: { month: m } })
      .then(r => { if (r.data?.data) setData(r.data.data); else setError('No data returned'); })
      .catch(err => setError(err?.response?.data?.message || err?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchData(month); }, [month]);

  function handleExport() {
    if (!data) return;
    const hdr = ['Date','Connected','Sales','Revenue','Conversion%','Daily Target'];
    const rows = data.dateRows.map(r =>
      [r.date, r.connected, r.saleCount, r.revenue, r.conversionPct, r.dailyTarget].join(',')
    );
    const blob = new Blob([[hdr.join(','), ...rows].join('\n')], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `neemans-${month}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const k    = data?.kpis;
  const rows = (data?.dateRows ?? []).map(r => ({
    ...r, label: r.date.replace(/^(\d+)-([A-Za-z]{3}).*$/, '$1-$2'),
  }));

  const CHARTS: { key: ExpandKey; title: string; accent: string; comp: (h?: number) => React.ReactNode }[] = [
    { key: 'conversion',   title: 'Date-wise Conversion %',          accent: '#8B5CF6', comp: (h) => <ConversionChart   data={rows} height={h} /> },
    { key: 'revenue',      title: 'Date-wise Revenue',               accent: G2,        comp: (h) => <RevenueChart      data={rows} height={h} /> },
    { key: 'saleCount',    title: 'Date-wise Sale Count',            accent: '#F59E0B', comp: (h) => <SaleCountChart    data={rows} height={h} /> },
    { key: 'achievement',  title: 'Cumulative Revenue vs Target',    accent: G,         comp: (h) => <AchievementChart  data={rows} height={h} /> },
  ];

  const expandedChart = CHARTS.find(c => c.key === expand);

  return (
    <div className="space-y-6 pb-8">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 rounded-2xl"
           style={{ background: '#1D4ED8' }}>
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">Neemans Dashboard</h2>
          <p className="text-xs text-blue-200 mt-0.5">Calling performance &amp; sales analytics</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={month} onChange={e => setMonth(e.target.value)}
            className="text-sm rounded-xl px-3 py-1.5 focus:outline-none shadow-sm bg-white/20 text-white border border-white/30">
            {months.map(m => <option key={m.value} value={m.value} className="text-slate-800">{m.label}</option>)}
          </select>
          <button onClick={() => fetchData(month)}
            className="p-2 rounded-xl border border-white/30 text-white/80 hover:bg-white/20 transition">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={handleExport} disabled={!data}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded-xl shadow-sm transition disabled:opacity-40 bg-white text-blue-700 hover:bg-blue-50">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {/* ── States ── */}
      {loading && (
        <div className="flex items-center justify-center py-28">
          <div className="h-10 w-10 border-4 rounded-full border-t-emerald-600 border-slate-200 animate-spin" />
        </div>
      )}
      {!loading && error && (
        <div className="text-center py-28">
          <p className="text-red-500 font-semibold text-sm">{error}</p>
          <button onClick={() => fetchData(month)} className="mt-3 text-xs text-slate-500 underline">Retry</button>
        </div>
      )}
      {!loading && !error && !data && (
        <div className="text-center py-28 text-slate-400 text-sm">No data found for this month</div>
      )}

      {!loading && !error && data && (
        <>
          {/* ── KPI Cards ── */}
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
            <KpiCard label="Achievement %"  value={fmtPct(k!.achievementPct)} sub={`Tgt: ${fmtMoney(k!.target)}`}
              icon={Target}
              color={k!.achievementPct >= 100 ? '#10B981' : k!.achievementPct >= 70 ? '#F59E0B' : '#EF4444'}
              gradient={k!.achievementPct >= 100 ? 'linear-gradient(135deg,#ECFDF5,#A7F3D0)' : k!.achievementPct >= 70 ? 'linear-gradient(135deg,#FFFBEB,#FDE68A)' : 'linear-gradient(135deg,#FEF2F2,#FECACA)'} />
            <KpiCard label="Paid %"         value={fmtPct(k!.paidPct)}        sub="Of total orders"
              icon={CreditCard}  color="#06B6D4"  gradient="linear-gradient(135deg,#ECFEFF,#A5F3FC)" />
            <KpiCard label="COD %"          value={fmtPct(k!.codPct)}         sub="Of total orders"
              icon={Wallet}      color="#F97316"  gradient="linear-gradient(135deg,#FFF7ED,#FED7AA)" />
          </div>

          {/* ── Charts Grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {CHARTS.map(ch => (
              <ChartCard key={ch.key} title={ch.title} accent="" onExpand={() => setExpand(ch.key)}>
                {rows.length === 0
                  ? <div className="flex items-center justify-center h-52 text-sm text-slate-400">No chart data</div>
                  : ch.comp(240)}
              </ChartCard>
            ))}
          </div>

          {/* ── Tables ── */}
          <DataTable<AgentRow>
            title="Agent-wise Breakdown"
            accent={G}
            cols={AGENT_COLS}
            rows={data.agentTable}
          />
          <DataTable<DateDetail>
            title="Date-wise Breakdown"
            accent="#8B5CF6"
            cols={DATE_COLS}
            rows={data.dateTable}
          />
        </>
      )}

      {/* ── Expand Modal ── */}
      {expand && expandedChart && (
        <ChartModal title={expandedChart.title} onClose={() => setExpand(null)}>
          {rows.length === 0
            ? <div className="flex items-center justify-center h-96 text-slate-400">No data</div>
            : expandedChart.comp(460)}
        </ChartModal>
      )}
    </div>
  );
}
