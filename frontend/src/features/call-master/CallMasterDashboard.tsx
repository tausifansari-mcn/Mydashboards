import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer,
} from 'recharts';
import {
  PhoneCall, CheckCircle, Shield, Heart, TrendingUp,
  Users, Layers, UserCheck, AlertCircle, Calendar,
  RefreshCw, ChevronDown, Award, ThumbsDown, Lock,
} from 'lucide-react';
import api from '@/lib/axios';

// ─── Types ───────────────────────────────────────────────────────────────────

interface KPIs {
  totalCalls: number;
  totalAudited: number;
  qualityScore: number;
  customerExperience: number;
  compliance: number;
  salesConversion: number;
  activeClients: number;
  activeProcesses: number;
  activeAgents: number;
}

interface ClientItem { id: number; name: string; dialdesk_client_id: number }
interface TrendRow { period: string; quality: number; calls: number }
interface FunnelRow { stage: string; value: number; pct: number }
interface CXRow { parameter: string; score: number }
interface AgentRow { agent: string; calls: number; quality: number; compliance: number }
interface HourRow { hour: string; inbound: number; outbound: number; total: number }
interface DayRow { day: string; inbound: number; outbound: number }
interface ClientRow { client_name: string; audited?: number; quality?: number; calls?: number; sales?: number }

// ─── Helpers ─────────────────────────────────────────────────────────────────

const COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899', '#6366F1'];
const COLOR_GREEN = '#10B981';
const COLOR_BLUE = '#3B82F6';
const COLOR_PURPLE = '#8B5CF6';
const COLOR_AMBER = '#F59E0B';
const COLOR_RED = '#EF4444';

function fmt(n: number, dec = 1) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(dec)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(dec)}K`;
  return n.toLocaleString();
}

function pctColor(v: number) {
  if (v >= 80) return COLOR_GREEN;
  if (v >= 60) return COLOR_AMBER;
  return COLOR_RED;
}

// ─── Animated Counter ─────────────────────────────────────────────────────────

function AnimatedNumber({ value, suffix = '', dec = 0 }: { value: number; suffix?: string; dec?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const start = 0;
    const end = value;
    const duration = 1200;
    const startTime = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(start + (end - start) * eased);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value]);
  return <span>{dec > 0 ? display.toFixed(dec) : Math.round(display).toLocaleString()}{suffix}</span>;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KPICardProps {
  label: string;
  value: number;
  suffix?: string;
  dec?: number;
  icon: React.ReactNode;
  color: string;
  sub?: string;
  index: number;
}

function KPICard({ label, value, suffix, dec, icon, color, sub, index }: KPICardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      className="bg-[#1E293B] rounded-xl p-5 flex flex-col gap-3 border border-white/5 hover:border-white/15 transition-colors"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">{label}</span>
        <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}20` }}>
          <div style={{ color }}>{icon}</div>
        </div>
      </div>
      <div className="text-3xl font-bold text-white">
        <AnimatedNumber value={value} suffix={suffix} dec={dec} />
      </div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
      <div className="h-1 rounded-full bg-white/5">
        <motion.div
          className="h-1 rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: suffix === '%' ? `${Math.min(value, 100)}%` : '100%' }}
          transition={{ delay: index * 0.05 + 0.3, duration: 0.8 }}
        />
      </div>
    </motion.div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`bg-[#1E293B] rounded-xl border border-white/5 p-5 ${className}`}
    >
      <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">{title}</h3>
      {children}
    </motion.div>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

interface Filters {
  startDate: string;
  endDate: string;
  clientId: string;
  lob: string;
  period: string;
}

function FilterBar({
  filters, clients, onChange, onRefresh, loading,
}: {
  filters: Filters;
  clients: ClientItem[];
  onChange: (k: keyof Filters, v: string) => void;
  onRefresh: () => void;
  loading: boolean;
}) {
  // If the API returned exactly 1 client, this user is tenant-scoped — lock the client filter
  const isTenantLocked = clients.length === 1;
  const lockedClient = isTenantLocked ? clients[0] : null;

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* Date range */}
      <div className="flex items-center gap-2 bg-[#1E293B] border border-white/10 rounded-lg px-3 py-2">
        <Calendar size={14} className="text-slate-400" />
        <input
          type="date"
          value={filters.startDate}
          onChange={(e) => onChange('startDate', e.target.value)}
          className="bg-transparent text-sm text-slate-200 outline-none w-32"
        />
        <span className="text-slate-600">—</span>
        <input
          type="date"
          value={filters.endDate}
          onChange={(e) => onChange('endDate', e.target.value)}
          className="bg-transparent text-sm text-slate-200 outline-none w-32"
        />
      </div>

      {/* Client filter — locked badge for tenant users, dropdown for super admin */}
      {isTenantLocked ? (
        <div className="flex items-center gap-2 bg-[#1E293B] border border-blue-500/40 rounded-lg px-3 py-2">
          <Lock size={12} className="text-blue-400 shrink-0" />
          <span className="text-sm text-blue-300 font-medium">{lockedClient!.name}</span>
        </div>
      ) : (
        <div className="relative">
          <select
            value={filters.clientId}
            onChange={(e) => onChange('clientId', e.target.value)}
            className="appearance-none bg-[#1E293B] border border-white/10 text-sm text-slate-200 rounded-lg px-3 py-2 pr-8 outline-none"
          >
            <option value="">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.dialdesk_client_id}>{c.name}</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-3 text-slate-400 pointer-events-none" />
        </div>
      )}

      {/* LOB */}
      <div className="relative">
        <select
          value={filters.lob}
          onChange={(e) => onChange('lob', e.target.value)}
          className="appearance-none bg-[#1E293B] border border-white/10 text-sm text-slate-200 rounded-lg px-3 py-2 pr-8 outline-none"
        >
          <option value="All">All LOBs</option>
          <option value="Inbound">Inbound</option>
          <option value="Outbound">Outbound</option>
        </select>
        <ChevronDown size={12} className="absolute right-2 top-3 text-slate-400 pointer-events-none" />
      </div>

      {/* Period */}
      <div className="relative">
        <select
          value={filters.period}
          onChange={(e) => onChange('period', e.target.value)}
          className="appearance-none bg-[#1E293B] border border-white/10 text-sm text-slate-200 rounded-lg px-3 py-2 pr-8 outline-none"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
        <ChevronDown size={12} className="absolute right-2 top-3 text-slate-400 pointer-events-none" />
      </div>

      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={onRefresh}
        disabled={loading}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        {loading ? 'Loading...' : 'Refresh'}
      </motion.button>
    </div>
  );
}

// ─── Funnel Bar ──────────────────────────────────────────────────────────────

function FunnelBar({ row, max }: { row: FunnelRow; max: number }) {
  const width = max > 0 ? (row.value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-36 text-xs text-slate-400 text-right shrink-0">{row.stage}</div>
      <div className="flex-1 bg-white/5 rounded-full h-6 overflow-hidden">
        <motion.div
          className="h-6 rounded-full flex items-center justify-end pr-2"
          style={{ backgroundColor: COLOR_BLUE }}
          initial={{ width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ duration: 0.8 }}
        >
          <span className="text-xs text-white font-bold">{fmt(row.value)}</span>
        </motion.div>
      </div>
      <div className="w-12 text-xs text-slate-400 shrink-0">{row.pct}%</div>
    </div>
  );
}

// ─── Agent Table ─────────────────────────────────────────────────────────────

function AgentTable({ agents, type }: { agents: AgentRow[]; type: 'top' | 'bottom' }) {
  const icon = type === 'top' ? <Award size={12} className="text-amber-400" /> : <ThumbsDown size={12} className="text-red-400" />;
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {type === 'top' ? 'Top Performers' : 'Needs Coaching'}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left text-slate-500 py-2 pr-3">#</th>
              <th className="text-left text-slate-500 py-2 pr-3">Agent</th>
              <th className="text-right text-slate-500 py-2 pr-3">Calls</th>
              <th className="text-right text-slate-500 py-2 pr-3">Quality</th>
              <th className="text-right text-slate-500 py-2">Compliance</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a, i) => (
              <motion.tr
                key={a.agent}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="border-b border-white/5 hover:bg-white/5"
              >
                <td className="py-2 pr-3 text-slate-600">{i + 1}</td>
                <td className="py-2 pr-3 font-medium text-slate-200">{a.agent}</td>
                <td className="py-2 pr-3 text-right text-slate-400">{fmt(a.calls)}</td>
                <td className="py-2 pr-3 text-right font-semibold" style={{ color: pctColor(a.quality) }}>
                  {a.quality.toFixed(1)}%
                </td>
                <td className="py-2 text-right font-semibold" style={{ color: pctColor(a.compliance) }}>
                  {a.compliance.toFixed(1)}%
                </td>
              </motion.tr>
            ))}
            {agents.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-600 text-xs">No data for this period</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function CallMasterDashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [filters, setFilters] = useState<Filters>({
    startDate: firstOfMonth,
    endDate: today,
    clientId: '',
    lob: 'All',
    period: 'daily',
  });

  const [clients, setClients] = useState<ClientItem[]>([]);
  const [kpis, setKPIs] = useState<KPIs | null>(null);
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const [byHour, setByHour] = useState<HourRow[]>([]);
  const [byDay, setByDay] = useState<DayRow[]>([]);
  const [byClient, setByClient] = useState<{ inbound: ClientRow[]; outbound: ClientRow[] }>({ inbound: [], outbound: [] });
  const [funnel, setFunnel] = useState<FunnelRow[]>([]);
  const [cxParams, setCXParams] = useState<CXRow[]>([]);
  const [agents, setAgents] = useState<{ top: AgentRow[]; bottom: AgentRow[] }>({ top: [], bottom: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildParams = useCallback(() => {
    const p: Record<string, string> = {
      startDate: filters.startDate,
      endDate: filters.endDate,
      lob: filters.lob,
    };
    if (filters.clientId) p.clientId = filters.clientId;
    if (filters.period) p.period = filters.period;
    return new URLSearchParams(p).toString();
  }, [filters]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = buildParams();
      const [kRes, tRes, hRes, dRes, cRes, fRes, xRes, aRes] = await Promise.all([
        api.get(`/call-master/kpis?${qs}`),
        api.get(`/call-master/quality-trend?${qs}`),
        api.get(`/call-master/calls-by-hour?${qs}`),
        api.get(`/call-master/calls-by-day?${qs}`),
        api.get(`/call-master/calls-by-client?${qs}`),
        api.get(`/call-master/sales-funnel?${qs}`),
        api.get(`/call-master/cx-parameters?${qs}`),
        api.get(`/call-master/top-agents?${qs}`),
      ]);
      setKPIs(kRes.data.data);
      // Parse decimal strings from MySQL AVG/ROUND to numbers for Recharts
      setTrend((tRes.data.data || []).map((r: TrendRow) => ({
        ...r, quality: parseFloat(String(r.quality)) || 0, calls: Number(r.calls) || 0,
      })));
      setByHour(hRes.data.data || []);
      setByDay(dRes.data.data || []);
      setByClient(cRes.data.data || { inbound: [], outbound: [] });
      setFunnel(fRes.data.data || []);
      setCXParams((xRes.data.data || []).map((r: CXRow) => ({
        ...r, score: parseFloat(String(r.score)) || 0,
      })));
      const agentData = aRes.data.data || { top: [], bottom: [] };
      const parseAgent = (a: AgentRow) => ({
        ...a,
        quality: parseFloat(String(a.quality)) || 0,
        compliance: parseFloat(String(a.compliance)) || 0,
        calls: Number(a.calls) || 0,
      });
      setAgents({ top: agentData.top.map(parseAgent), bottom: agentData.bottom.map(parseAgent) });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load dashboard data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    api.get('/call-master/clients')
      .then((r) => {
        const list: ClientItem[] = r.data.data || [];
        setClients(list);
        // If user is tenant-scoped (only 1 client returned), auto-lock the filter
        if (list.length === 1) {
          setFilters((prev) => ({ ...prev, clientId: String(list[0].dialdesk_client_id) }));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleFilterChange = (k: keyof Filters, v: string) => {
    setFilters((prev) => ({ ...prev, [k]: v }));
  };

  const maxFunnelValue = funnel[0]?.value || 1;

  return (
    <div className="min-h-screen bg-[#0F172A] text-white">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Call Master</h1>
            <p className="text-sm text-slate-400 mt-0.5">Real-time analytics across all lines of business</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Live Data
          </div>
        </div>
        <FilterBar
          filters={filters}
          clients={clients}
          onChange={handleFilterChange}
          onRefresh={fetchAll}
          loading={loading}
        />
      </div>

      <div className="p-6 space-y-6">
        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-4 py-3 text-sm"
            >
              <AlertCircle size={16} />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <KPICard index={0} label="Total Calls" value={kpis?.totalCalls ?? 0} icon={<PhoneCall size={16} />} color={COLOR_BLUE} sub="Outbound" />
          <KPICard index={1} label="Audited Calls" value={kpis?.totalAudited ?? 0} icon={<CheckCircle size={16} />} color={COLOR_PURPLE} sub="Inbound QA" />
          <KPICard index={2} label="Quality Score" value={kpis?.qualityScore ?? 0} suffix="%" dec={1} icon={<Award size={16} />} color={COLOR_GREEN} />
          <KPICard index={3} label="Compliance" value={kpis?.compliance ?? 0} suffix="%" dec={1} icon={<Shield size={16} />} color={COLOR_AMBER} />
          <KPICard index={4} label="CX Score" value={kpis?.customerExperience ?? 0} suffix="%" dec={1} icon={<Heart size={16} />} color="#EC4899" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard index={5} label="Sales Conversion" value={kpis?.salesConversion ?? 0} suffix="%" dec={1} icon={<TrendingUp size={16} />} color={COLOR_GREEN} />
          <KPICard index={6} label="Active Clients" value={kpis?.activeClients ?? 0} icon={<Users size={16} />} color={COLOR_BLUE} />
          <KPICard index={7} label="Active Processes" value={kpis?.activeProcesses ?? 0} icon={<Layers size={16} />} color={COLOR_PURPLE} />
          <KPICard index={8} label="Active Agents" value={kpis?.activeAgents ?? 0} icon={<UserCheck size={16} />} color={COLOR_AMBER} />
        </div>

        {/* Quality Trend + Calls by Hour */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard title={`Quality Trend (${filters.period})`}>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="period" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fill: '#94A3B8', fontSize: 11 }} unit="%" />
                <Tooltip
                  contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
                  labelStyle={{ color: '#CBD5E1' }}
                />
                <Legend />
                <Line type="monotone" dataKey="quality" stroke={COLOR_GREEN} strokeWidth={2} dot={false} name="Quality %" />
                <Line type="monotone" dataKey="calls" stroke={COLOR_BLUE} strokeWidth={2} dot={false} name="Audited Calls" yAxisId={undefined} />
              </LineChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard title="Calls by Hour of Day">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={byHour}>
                <defs>
                  <linearGradient id="inboundGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLOR_BLUE} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLOR_BLUE} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="outboundGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLOR_PURPLE} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLOR_PURPLE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="hour" tick={{ fill: '#94A3B8', fontSize: 10 }} interval={3} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8 }} />
                <Legend />
                <Area type="monotone" dataKey="inbound" stroke={COLOR_BLUE} fill="url(#inboundGrad)" name="Inbound" strokeWidth={2} />
                <Area type="monotone" dataKey="outbound" stroke={COLOR_PURPLE} fill="url(#outboundGrad)" name="Outbound" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </SectionCard>
        </div>

        {/* Calls by Day + Calls by Client */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard title="Calls by Day of Week">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="day" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="inbound" fill={COLOR_BLUE} name="Inbound" radius={[3, 3, 0, 0]} />
                <Bar dataKey="outbound" fill={COLOR_PURPLE} name="Outbound" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard title="Calls by Client (Inbound QA)">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byClient.inbound.slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                <YAxis dataKey="client_name" type="category" tick={{ fill: '#94A3B8', fontSize: 10 }} width={100} />
                <Tooltip contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8 }} />
                <Bar dataKey="audited" fill={COLOR_GREEN} name="Audited" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
        </div>

        {/* Sales Funnel + CX Radar */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard title="Sales Funnel (Outbound)">
            <div className="space-y-3 mt-2">
              {funnel.map((row) => (
                <FunnelBar key={row.stage} row={row} max={maxFunnelValue} />
              ))}
              {funnel.length === 0 && (
                <p className="text-center text-slate-600 text-sm py-8">No outbound data for this period</p>
              )}
            </div>
          </SectionCard>

          <SectionCard title="CX Quality Parameters">
            {cxParams.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={cxParams}>
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis dataKey="parameter" tick={{ fill: '#94A3B8', fontSize: 10 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fill: '#64748B', fontSize: 10 }} />
                  <Radar
                    name="CX Score"
                    dataKey="score"
                    stroke="#EC4899"
                    fill="#EC4899"
                    fillOpacity={0.25}
                    strokeWidth={2}
                  />
                  <Tooltip contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8 }} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-slate-600 text-sm py-16">No quality data for this period</p>
            )}
          </SectionCard>
        </div>

        {/* Agent Leaderboard */}
        <SectionCard title="Agent Leaderboard">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <AgentTable agents={agents.top} type="top" />
            <AgentTable agents={agents.bottom} type="bottom" />
          </div>
        </SectionCard>

        {/* Outbound by Client */}
        {byClient.outbound.length > 0 && (
          <SectionCard title="Outbound Calls by Client">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byClient.outbound.slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                <YAxis dataKey="client_name" type="category" tick={{ fill: '#94A3B8', fontSize: 10 }} width={100} />
                <Tooltip contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8 }} />
                <Bar dataKey="calls" fill={COLOR_PURPLE} name="Total Calls" radius={[0, 3, 3, 0]} />
                <Bar dataKey="sales" fill={COLOR_GREEN} name="Sales" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
