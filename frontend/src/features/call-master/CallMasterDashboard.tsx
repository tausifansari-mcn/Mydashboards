import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
  ResponsiveContainer,
} from 'recharts';
import {
  PhoneCall, CheckCircle, Shield, Heart, TrendingUp,
  Users, Layers, UserCheck, AlertCircle, Calendar,
  RefreshCw, ChevronDown, Award, ThumbsDown, Lock, X,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
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
interface TrendRow   { period: string; quality: number; calls: number }
interface FunnelRow  { stage: string; value: number; pct: number }
interface CXParamRow { parameter: string; key: string; score: number }
interface ScenarioRow { name: string; value: number }
interface CXData { inbound: CXParamRow[]; outbound: CXParamRow[]; scenario: ScenarioRow[] }
interface AgentRow    { agent: string; calls: number; quality: number; compliance: number }
interface AgentParamRow { parameter: string; key: string; score: number }
interface HourRow    { hour: string; inbound: number; outbound: number; total: number }
interface DayRow     { day: string; inbound: number; outbound: number }
interface MonthRow   { month: string; inbound: number; outbound: number; sales: number }
interface ClientRow  { client_name: string; audited?: number; quality?: number; calls?: number; sales?: number }

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
      className="relative bg-gradient-to-br from-[#1E293B] to-[#16213a] rounded-xl p-4 flex flex-col gap-2 border border-white/5 hover:border-white/10 transition-all overflow-hidden"
    >
      {/* Accent left bar */}
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ backgroundColor: color }} />
      <div className="pl-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider leading-none">{label}</span>
          <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${color}18` }}>
            <div style={{ color }}>{icon}</div>
          </div>
        </div>
        <div className="text-2xl font-bold text-white tracking-tight">
          <AnimatedNumber value={value} suffix={suffix} dec={dec} />
        </div>
        {sub && <div className="text-[11px] text-slate-500 mt-1">{sub}</div>}
      </div>
      {/* Bottom shimmer bar */}
      <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, ${color}40, transparent)` }} />
    </motion.div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({ title, children, className = '', accent = COLOR_BLUE }: {
  title: string; children: React.ReactNode; className?: string; accent?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`bg-[#1E293B] rounded-xl border border-white/5 overflow-hidden ${className}`}
    >
      <div className="flex items-center gap-2.5 px-5 py-3 border-b border-white/5">
        <div className="w-1.5 h-4 rounded-full shrink-0" style={{ backgroundColor: accent }} />
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">{title}</h3>
      </div>
      <div className="p-5">
        {children}
      </div>
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

// ─── Pareto Chart ─────────────────────────────────────────────────────────────

function ParetoChart({ data }: { data: CXParamRow[] }) {
  if (data.length === 0) return <p className="text-slate-600 text-sm text-center py-4">No data</p>;
  const sorted = [...data].sort((a, b) => b.score - a.score);
  const totalScore = sorted.reduce((s, p) => s + p.score, 0) || 1;
  let cum = 0;
  const chartData = sorted.map(p => {
    cum += p.score;
    return { name: p.parameter, score: p.score, cumulative: parseFloat((cum / totalScore * 100).toFixed(1)) };
  });

  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={chartData} margin={{ top: 4, right: 36, bottom: 64, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 8 }} angle={-45} textAnchor="end" interval={0} />
        <YAxis yAxisId="left" domain={[0, 100]} tick={{ fill: '#94A3B8', fontSize: 10 }} unit="%" />
        <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fill: '#94A3B8', fontSize: 10 }} unit="%" />
        <Tooltip contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8 }} />
        <Bar yAxisId="left" dataKey="score" name="Adherence %" radius={[2, 2, 0, 0]}>
          {chartData.map((entry, i) => <Cell key={i} fill={pctColor(entry.score)} />)}
        </Bar>
        <Line yAxisId="right" type="monotone" dataKey="cumulative" stroke={COLOR_AMBER} strokeWidth={2} dot={false} name="Cumulative %" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ─── CX Quality Parameters (tabbed, LOB-aware) ───────────────────────────────

const SCENARIO_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4'];

function ParamBars({ rows, barH = 'h-5' }: { rows: CXParamRow[]; barH?: string }) {
  const sorted = [...rows].sort((a, b) => b.score - a.score);
  if (sorted.length === 0) return <p className="text-slate-600 text-sm text-center py-8">No data</p>;
  return (
    <div className="space-y-1.5">
      {sorted.map(p => (
        <div key={p.key} className="flex items-center gap-2">
          <span className="text-xs text-slate-400 w-40 shrink-0 truncate" title={p.parameter}>{p.parameter}</span>
          <div className={`flex-1 bg-white/5 rounded-full ${barH} overflow-hidden`}>
            <motion.div
              className={`${barH} rounded-full flex items-center justify-end pr-2`}
              style={{ backgroundColor: pctColor(p.score), minWidth: 4 }}
              initial={{ width: 0 }}
              animate={{ width: `${p.score}%` }}
              transition={{ duration: 0.7 }}
            >
              {p.score > 12 && <span className="text-[10px] text-white font-bold">{p.score.toFixed(0)}%</span>}
            </motion.div>
          </div>
          {p.score <= 12 && (
            <span className="text-[10px] w-8 text-right shrink-0" style={{ color: pctColor(p.score) }}>
              {p.score.toFixed(0)}%
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function CXParametersCard({ cxData, lob }: { cxData: CXData; lob: string }) {
  const showInbound  = lob !== 'Outbound';
  const showOutbound = lob !== 'Inbound';
  const [tab, setTab] = useState<'inbound' | 'outbound'>(showInbound ? 'inbound' : 'outbound');

  useEffect(() => {
    if (lob === 'Outbound') setTab('outbound');
    else setTab('inbound');
  }, [lob]);

  return (
    <SectionCard title="CX Quality Parameters" accent="#EC4899">
      {(showInbound && showOutbound) && (
        <div className="flex gap-1 mb-4 bg-white/5 rounded-lg p-1 w-fit">
          <button onClick={() => setTab('inbound')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${tab === 'inbound' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            Inbound (19)
          </button>
          <button onClick={() => setTab('outbound')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${tab === 'outbound' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            Outbound (6)
          </button>
        </div>
      )}

      {tab === 'inbound' && showInbound && (
        <div className="max-h-[220px] overflow-y-auto pr-1">
          <ParamBars rows={cxData.inbound} />
        </div>
      )}

      {tab === 'outbound' && showOutbound && (
        <ParamBars rows={cxData.outbound} barH="h-6" />
      )}
    </SectionCard>
  );
}

// ─── Scenario Section ─────────────────────────────────────────────────────────

function ScenarioSection({ scenario, buildQS }: { scenario: ScenarioRow[]; buildQS: () => string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [subData, setSubData] = useState<ScenarioRow[]>([]);
  const [loading, setLoading] = useState(false);

  const handleClick = async (entry: { name?: string }) => {
    const name = entry?.name;
    if (!name) return;
    if (selected === name) { setSelected(null); setSubData([]); return; }
    setSelected(name);
    setLoading(true);
    try {
      const qs = buildQS();
      const r = await api.get(`/call-master/scenario-detail?scenario=${encodeURIComponent(name)}&${qs}`);
      setSubData((r.data.data || []).map((s: ScenarioRow) => ({ name: String(s.name), value: Number(s.value) })));
    } catch { setSubData([]); }
    finally { setLoading(false); }
  };

  if (scenario.length === 0) return null;
  const total = scenario.reduce((s, r) => s + r.value, 0) || 1;

  return (
    <SectionCard title="Scenario Distribution · Inbound" accent={COLOR_BLUE}>
      <p className="text-xs text-slate-500 mb-4">Click a slice to drill into sub-scenarios</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Main pie */}
        <div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={scenario}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={85}
                strokeWidth={2}
                stroke="#0F172A"
                onClick={handleClick}
                style={{ cursor: 'pointer' }}
              >
                {scenario.map((r, i) => (
                  <Cell
                    key={i}
                    fill={SCENARIO_COLORS[i % SCENARIO_COLORS.length]}
                    opacity={selected && selected !== r.name ? 0.35 : 1}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(v) => [Number(v).toLocaleString(), 'Calls']}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="mt-2 space-y-1.5">
            {scenario.map((r, i) => (
              <div key={r.name} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: SCENARIO_COLORS[i % SCENARIO_COLORS.length] }} />
                <span className="text-xs text-slate-300 flex-1">{r.name}</span>
                <span className="text-xs text-slate-400">{r.value.toLocaleString()}</span>
                <span className="text-xs font-semibold text-slate-300 w-12 text-right">
                  {((r.value / total) * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Sub-scenario */}
        <div className="flex flex-col justify-center">
          {!selected && (
            <p className="text-slate-600 text-xs text-center py-8">← Select a scenario to see sub-scenarios</p>
          )}
          {selected && loading && (
            <p className="text-slate-500 text-xs text-center py-8">Loading sub-scenarios…</p>
          )}
          {selected && !loading && subData.length === 0 && (
            <p className="text-slate-600 text-xs text-center py-8">No sub-scenario data for "{selected}"</p>
          )}
          {selected && !loading && subData.length > 0 && (() => {
            const subTotal = subData.reduce((s, r) => s + r.value, 0) || 1;
            return (
              <>
                <p className="text-xs text-slate-400 mb-3">
                  Sub-scenarios — <span className="text-white font-medium">{selected}</span>
                </p>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={subData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                      outerRadius={65} strokeWidth={2} stroke="#0F172A">
                      {subData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
                      formatter={(v) => [Number(v).toLocaleString(), 'Calls']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 space-y-1.5">
                  {subData.map((r, i) => (
                    <div key={r.name} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-xs text-slate-300 flex-1">{r.name}</span>
                      <span className="text-xs text-slate-400">{r.value.toLocaleString()}</span>
                      <span className="text-xs font-semibold text-slate-300 w-12 text-right">
                        {((r.value / subTotal) * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      </div>
    </SectionCard>
  );
}

// ─── Agent Drill-down Panel ──────────────────────────────────────────────────

function AgentParamsPanel({
  agent, type, params, onClose,
}: {
  agent: AgentRow; type: 'top' | 'bottom'; params: AgentParamRow[]; onClose: () => void;
}) {
  const sorted = [...params].sort((a, b) => b.score - a.score);
  const weak = sorted.filter(p => p.score < 60);
  const strong = sorted.filter(p => p.score >= 80);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="mt-4 bg-[#0F172A] border border-white/10 rounded-xl p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-sm font-semibold text-white">{agent.agent}</span>
          <span className="ml-2 text-xs text-slate-400">
            {type === 'top' ? '— Why Top Performer' : '— Coaching Areas'}
          </span>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
          <X size={14} />
        </button>
      </div>

      {type === 'bottom' && weak.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-red-400 font-medium mb-2 uppercase tracking-wider">Needs Improvement</p>
          <div className="space-y-1.5">
            {weak.map(p => (
              <div key={p.key} className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-44 shrink-0">{p.parameter}</span>
                <div className="flex-1 bg-white/5 rounded-full h-4 overflow-hidden">
                  <motion.div
                    className="h-4 rounded-full flex items-center justify-end pr-1.5"
                    style={{ backgroundColor: COLOR_RED }}
                    initial={{ width: 0 }}
                    animate={{ width: `${p.score}%` }}
                    transition={{ duration: 0.6 }}
                  >
                    <span className="text-[10px] text-white font-bold">{p.score.toFixed(0)}%</span>
                  </motion.div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {type === 'top' && strong.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-green-400 font-medium mb-2 uppercase tracking-wider">Strengths</p>
          <div className="space-y-1.5">
            {strong.map(p => (
              <div key={p.key} className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-44 shrink-0">{p.parameter}</span>
                <div className="flex-1 bg-white/5 rounded-full h-4 overflow-hidden">
                  <motion.div
                    className="h-4 rounded-full flex items-center justify-end pr-1.5"
                    style={{ backgroundColor: COLOR_GREEN }}
                    initial={{ width: 0 }}
                    animate={{ width: `${p.score}%` }}
                    transition={{ duration: 0.6 }}
                  >
                    <span className="text-[10px] text-white font-bold">{p.score.toFixed(0)}%</span>
                  </motion.div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All params compact */}
      <details className="group">
        <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300 transition-colors">
          All parameters ({params.length})
        </summary>
        <div className="mt-2 space-y-1">
          {sorted.map(p => (
            <div key={p.key} className="flex items-center gap-2">
              <span className="text-xs text-slate-400 w-44 shrink-0">{p.parameter}</span>
              <div className="flex-1 bg-white/5 rounded-full h-3 overflow-hidden">
                <div
                  className="h-3 rounded-full"
                  style={{ width: `${p.score}%`, backgroundColor: pctColor(p.score) }}
                />
              </div>
              <span className="text-xs w-10 text-right" style={{ color: pctColor(p.score) }}>
                {p.score.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </details>
    </motion.div>
  );
}

// ─── Agent Table ─────────────────────────────────────────────────────────────

function AgentTable({
  agents, type, buildQS,
}: {
  agents: AgentRow[];
  type: 'top' | 'bottom';
  buildQS: () => string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [params, setParams] = useState<AgentParamRow[]>([]);
  const [loadingAgent, setLoadingAgent] = useState(false);

  const handleClick = async (agentName: string) => {
    if (selected === agentName) { setSelected(null); return; }
    setSelected(agentName);
    setLoadingAgent(true);
    try {
      const qs = buildQS();
      const r = await api.get(`/call-master/agent-params?agent=${encodeURIComponent(agentName)}&${qs}`);
      setParams((r.data.data || []).map((p: AgentParamRow) => ({
        ...p, score: parseFloat(String(p.score)) || 0,
      })));
    } catch { setParams([]); }
    finally { setLoadingAgent(false); }
  };

  const icon = type === 'top'
    ? <Award size={12} className="text-amber-400" />
    : <ThumbsDown size={12} className="text-red-400" />;

  const selectedAgent = agents.find(a => a.agent === selected);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {type === 'top' ? 'Top Performers' : 'Needs Coaching'}
        </span>
        <span className="text-xs text-slate-600 ml-1">(click agent to drill down)</span>
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
                onClick={() => handleClick(a.agent)}
                className={`border-b border-white/5 cursor-pointer transition-colors ${
                  selected === a.agent ? 'bg-blue-500/10' : 'hover:bg-white/5'
                }`}
              >
                <td className="py-2 pr-3 text-slate-600">{i + 1}</td>
                <td className="py-2 pr-3 font-medium text-blue-300 underline decoration-dotted">{a.agent}</td>
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
      <AnimatePresence>
        {selected && selectedAgent && !loadingAgent && (
          <AgentParamsPanel
            agent={selectedAgent}
            type={type}
            params={params}
            onClose={() => setSelected(null)}
          />
        )}
        {loadingAgent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-3 text-xs text-slate-500 text-center py-3"
          >
            Loading parameters…
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function CallMasterDashboard() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin';

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
  const [byMonth, setByMonth] = useState<MonthRow[]>([]);
  const [byClient, setByClient] = useState<{ inbound: ClientRow[]; outbound: ClientRow[] }>({ inbound: [], outbound: [] });
  const [funnel, setFunnel] = useState<FunnelRow[]>([]);
  const [cxData, setCXData] = useState<CXData>({ inbound: [], outbound: [], scenario: [] });
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
      const [kRes, tRes, hRes, dRes, mRes, cRes, fRes, xRes, aRes] = await Promise.all([
        api.get(`/call-master/kpis?${qs}`),
        api.get(`/call-master/quality-trend?${qs}`),
        api.get(`/call-master/calls-by-hour?${qs}`),
        api.get(`/call-master/calls-by-day?${qs}`),
        api.get(`/call-master/calls-by-month?${qs}`),
        api.get(`/call-master/calls-by-client?${qs}`),
        api.get(`/call-master/sales-funnel?${qs}`),
        api.get(`/call-master/cx-parameters?${qs}`),
        api.get(`/call-master/top-agents?${qs}`),
      ]);
      setKPIs(kRes.data.data);
      setTrend((tRes.data.data || []).map((r: TrendRow) => ({
        ...r, quality: parseFloat(String(r.quality)) || 0, calls: Number(r.calls) || 0,
      })));
      setByHour(hRes.data.data || []);
      setByDay(dRes.data.data || []);
      setByMonth((mRes.data.data || []).map((r: MonthRow) => ({
        ...r, inbound: Number(r.inbound) || 0, outbound: Number(r.outbound) || 0, sales: Number(r.sales) || 0,
      })));
      setByClient(cRes.data.data || { inbound: [], outbound: [] });
      setFunnel(fRes.data.data || []);
      const rawCX = xRes.data.data || { inbound: [], outbound: [], scenario: [] };
      setCXData({
        inbound: (rawCX.inbound || []).map((r: CXParamRow) => ({ ...r, score: parseFloat(String(r.score)) || 0 })),
        outbound: (rawCX.outbound || []).map((r: CXParamRow) => ({ ...r, score: parseFloat(String(r.score)) || 0 })),
        scenario: rawCX.scenario || [],
      });
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
  const showInbound  = filters.lob !== 'Outbound';
  const showOutbound = filters.lob !== 'Inbound';

  const TOOLTIP_STYLE = { background: '#0F172A', border: '1px solid #334155', borderRadius: 8, fontSize: 12 };
  const AXIS_TICK = { fill: '#64748B', fontSize: 11 };
  const GRID = { strokeDasharray: '3 3', stroke: '#1E293B' };

  return (
    <div className="min-h-screen bg-[#0F172A] text-white">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-4 bg-[#0B1120] border-b border-white/5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Call Master</h1>
            <p className="text-xs text-slate-500 mt-0.5">Real-time analytics · {filters.lob === 'All' ? 'All LOBs' : filters.lob}</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-green-400 font-medium">Live</span>
          </div>
        </div>
        <FilterBar filters={filters} clients={clients} onChange={handleFilterChange} onRefresh={fetchAll} loading={loading} />
      </div>

      <div className="p-6 space-y-5">
        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-4 py-3 text-sm"
            >
              <AlertCircle size={16} /> {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Row 1: 5 primary KPI cards ─────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KPICard index={0} label="Total Calls"    value={kpis?.totalCalls    ?? 0} icon={<PhoneCall  size={15}/>} color={COLOR_BLUE}   sub="Outbound" />
          <KPICard index={1} label="Audited Calls"  value={kpis?.totalAudited  ?? 0} icon={<CheckCircle size={15}/>} color={COLOR_PURPLE} sub="Inbound QA" />
          <KPICard index={2} label="Quality Score"  value={kpis?.qualityScore  ?? 0} suffix="%" dec={1} icon={<Award  size={15}/>} color={COLOR_GREEN} />
          <KPICard index={3} label="Compliance"     value={kpis?.compliance    ?? 0} suffix="%" dec={1} icon={<Shield size={15}/>} color={COLOR_AMBER} />
          <KPICard index={4} label="CX Score"       value={kpis?.customerExperience ?? 0} suffix="%" dec={1} icon={<Heart size={15}/>} color="#EC4899" />
        </div>

        {/* ── Row 2: operational KPIs (role-gated) ────────────────────────── */}
        <div className={`grid gap-3 ${isSuperAdmin ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2'}`}>
          <KPICard index={5} label="Sales Conv."    value={kpis?.salesConversion ?? 0} suffix="%" dec={1} icon={<TrendingUp size={15}/>} color={COLOR_GREEN} />
          {isSuperAdmin && <KPICard index={6} label="Active Clients"   value={kpis?.activeClients   ?? 0} icon={<Users    size={15}/>} color={COLOR_BLUE} />}
          {isSuperAdmin && <KPICard index={7} label="Active Processes" value={kpis?.activeProcesses ?? 0} icon={<Layers   size={15}/>} color={COLOR_PURPLE} />}
          <KPICard index={8} label="Active Agents"  value={kpis?.activeAgents   ?? 0} icon={<UserCheck size={15}/>} color={COLOR_AMBER} sub="In date range" />
        </div>

        {/* ── Row 3: Quality Trend (3/5) + Hourly Distribution (2/5) ──────── */}
        <div className={`grid gap-5 ${showInbound ? 'grid-cols-1 lg:grid-cols-5' : 'grid-cols-1'}`}>
          {showInbound && (
            <div className="lg:col-span-3">
              <SectionCard title={`Quality Trend · Inbound (${filters.period})`} accent={COLOR_GREEN}>
                <ResponsiveContainer width="100%" height={270}>
                  <LineChart data={trend} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
                    <defs>
                      <linearGradient id="qualityFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={COLOR_GREEN}  stopOpacity={0.15} />
                        <stop offset="95%" stopColor={COLOR_GREEN}  stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="period" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} tick={AXIS_TICK} tickLine={false} axisLine={false} unit="%" />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#CBD5E1' }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    <Line type="monotone" dataKey="quality" stroke={COLOR_GREEN} strokeWidth={2.5} dot={{ r: 2, fill: COLOR_GREEN }} name="Quality %" />
                    <Line type="monotone" dataKey="calls"   stroke={COLOR_BLUE}  strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Audited Calls" />
                  </LineChart>
                </ResponsiveContainer>
              </SectionCard>
            </div>
          )}

          <div className={showInbound ? 'lg:col-span-2' : ''}>
            <SectionCard title="Calls by Hour" accent={COLOR_PURPLE}>
              <ResponsiveContainer width="100%" height={270}>
                <AreaChart data={byHour} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
                  <defs>
                    <linearGradient id="ibHourGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={COLOR_BLUE}   stopOpacity={0.35} />
                      <stop offset="95%" stopColor={COLOR_BLUE}   stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="obHourGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={COLOR_PURPLE} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={COLOR_PURPLE} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="hour" tick={AXIS_TICK} tickLine={false} axisLine={false} interval={3} />
                  <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  {showInbound  && <Area type="monotone" dataKey="inbound"  stroke={COLOR_BLUE}   fill="url(#ibHourGrad)" strokeWidth={2} name="Inbound" />}
                  {showOutbound && <Area type="monotone" dataKey="outbound" stroke={COLOR_PURPLE}  fill="url(#obHourGrad)" strokeWidth={2} name="Outbound" />}
                </AreaChart>
              </ResponsiveContainer>
            </SectionCard>
          </div>
        </div>

        {/* ── Row 4: 3-col volume charts ───────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <SectionCard title="Calls by Day of Week" accent={COLOR_BLUE}>
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={byDay} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="day" tick={{ ...AXIS_TICK, fontSize: 10 }} tickLine={false} axisLine={false}
                  tickFormatter={(v: string) => v.slice(0, 3)} />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                {showInbound  && <Bar dataKey="inbound"  fill={COLOR_BLUE}   name="Inbound"  radius={[3,3,0,0]} />}
                {showOutbound && <Bar dataKey="outbound" fill={COLOR_PURPLE}  name="Outbound" radius={[3,3,0,0]} />}
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard title="Monthly Volume" accent={COLOR_AMBER}>
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={byMonth} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="month" tick={{ ...AXIS_TICK, fontSize: 10 }} tickLine={false} axisLine={false}
                  tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                {showInbound  && <Bar dataKey="inbound"  fill={COLOR_BLUE}   name="Inbound"  radius={[3,3,0,0]} stackId="a" />}
                {showOutbound && <Bar dataKey="outbound" fill={COLOR_PURPLE}  name="Outbound" radius={[3,3,0,0]} stackId="a" />}
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>

          {showInbound ? (
            <SectionCard title="Inbound by Client" accent={COLOR_GREEN}>
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={byClient.inbound.slice(0, 8)} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 0 }}>
                  <CartesianGrid {...GRID} horizontal={false} />
                  <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                  <YAxis dataKey="client_name" type="category" tick={{ ...AXIS_TICK, fontSize: 10 }} tickLine={false} axisLine={false} width={80} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="audited" fill={COLOR_GREEN} name="Audited" radius={[0,3,3,0]} />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          ) : (
            <SectionCard title="Outbound by Client" accent={COLOR_PURPLE}>
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={byClient.outbound.slice(0, 8)} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 0 }}>
                  <CartesianGrid {...GRID} horizontal={false} />
                  <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                  <YAxis dataKey="client_name" type="category" tick={{ ...AXIS_TICK, fontSize: 10 }} tickLine={false} axisLine={false} width={80} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="calls" fill={COLOR_PURPLE} name="Calls" radius={[0,3,3,0]} />
                  <Bar dataKey="sales" fill={COLOR_GREEN}  name="Sales" radius={[0,3,3,0]} />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          )}
        </div>

        {/* ── Row 5: Sales Funnel (2/5) + CX Parameters (3/5) ────────────── */}
        <div className={`grid gap-5 ${showOutbound ? 'grid-cols-1 lg:grid-cols-5' : 'grid-cols-1'}`}>
          {showOutbound && (
            <div className="lg:col-span-2">
              <SectionCard title="Sales Funnel · Outbound" accent={COLOR_PURPLE}>
                <div className="space-y-3 pt-1">
                  {funnel.map((row) => <FunnelBar key={row.stage} row={row} max={maxFunnelValue} />)}
                  {funnel.length === 0 && <p className="text-center text-slate-600 text-sm py-8">No outbound data</p>}
                </div>
              </SectionCard>
            </div>
          )}
          <div className={showOutbound ? 'lg:col-span-3' : ''}>
            <CXParametersCard cxData={cxData} lob={filters.lob} />
          </div>
        </div>

        {/* ── Pareto Analysis ──────────────────────────────────────────────── */}
        {(showInbound || showOutbound) && (
          <div className={`grid gap-5 ${showInbound && showOutbound ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
            {showInbound && cxData.inbound.length > 0 && (
              <SectionCard title="Parameter Pareto · Inbound" accent={COLOR_GREEN}>
                <p className="text-xs text-slate-500 mb-3">Bars = adherence %, Line = cumulative %</p>
                <ParetoChart data={cxData.inbound} />
              </SectionCard>
            )}
            {showOutbound && cxData.outbound.length > 0 && (
              <SectionCard title="Parameter Pareto · Outbound" accent={COLOR_PURPLE}>
                <p className="text-xs text-slate-500 mb-3">Bars = adherence %, Line = cumulative %</p>
                <ParetoChart data={cxData.outbound} />
              </SectionCard>
            )}
          </div>
        )}

        {/* ── Scenario Distribution ────────────────────────────────────────── */}
        {showInbound && <ScenarioSection scenario={cxData.scenario} buildQS={buildParams} />}

        {/* ── Agent Leaderboard ────────────────────────────────────────────── */}
        {showInbound && (
          <SectionCard title="Agent Leaderboard" accent={COLOR_AMBER}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <AgentTable agents={agents.top}    type="top"    buildQS={buildParams} />
              <AgentTable agents={agents.bottom} type="bottom" buildQS={buildParams} />
            </div>
          </SectionCard>
        )}

        {/* ── Outbound Calls by Client (full width, "All" LOB only) ────────── */}
        {filters.lob === 'All' && byClient.outbound.length > 0 && (
          <SectionCard title="Outbound Calls by Client" accent={COLOR_PURPLE}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byClient.outbound.slice(0, 12)} layout="vertical" margin={{ top: 4, right: 32, bottom: 0, left: 0 }}>
                <CartesianGrid {...GRID} horizontal={false} />
                <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                <YAxis dataKey="client_name" type="category" tick={{ ...AXIS_TICK, fontSize: 10 }} tickLine={false} axisLine={false} width={90} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="calls" fill={COLOR_PURPLE} name="Total Calls" radius={[0,3,3,0]} />
                <Bar dataKey="sales" fill={COLOR_GREEN}  name="Sales"       radius={[0,3,3,0]} />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
