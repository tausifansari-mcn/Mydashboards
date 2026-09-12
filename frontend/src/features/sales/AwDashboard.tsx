import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, PhoneCall, PhoneOutgoing, Users, Clock, Wallet, Percent, Package } from 'lucide-react';
import api from '@/lib/axios';

interface Kpis {
  totalCalls: number; connectedCalls: number; notConnectedCalls: number; connectedPct: number;
  activeAgents: number; totalLoginHrs: number; totalRevenue: number;
  lrsAmount: number; tradeAmount: number; mfAmount: number;
}

interface AgentRow {
  agentId: string; agentName: string; empId: string; lob: string;
  totalCalls: number; connectedCalls: number; connectedPct: number;
  netLoginHrs: number; acht: number; occupancy: string;
  lrsAmount: number; tradeAmount: number; mfAmount: number;
}

interface AwDashboardData { months: string[]; kpis: Kpis; agents: AgentRow[] }

function fmt(n: number): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function fmtMoney(n: number): string {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

const sectionVariants = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const cardVariants = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } } };

export default function AwDashboard() {
  const [month, setMonth] = useState<string | null>(null);
  const [data, setData] = useState<AwDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/sales/aw-dashboard', { params: month ? { month } : {} })
      .then(res => {
        setData(res.data.data);
        if (!month && res.data.data?.months?.[0]) setMonth(res.data.data.months[0]);
      })
      .catch(err => console.error('AW dashboard fetch error:', err))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-slate-900 animate-spin" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <BarChart3 size={40} className="mb-3 text-slate-300" />
        <p className="text-sm font-medium">No data available</p>
      </div>
    );
  }

  const k = data.kpis;

  return (
    <div className="space-y-7">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl px-6 py-5"
        style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 55%, #334155 100%)' }}
      >
        <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full opacity-20 blur-3xl" style={{ background: '#38BDF8' }} />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">AW Dashboard</h1>
              <p className="text-xs text-white/50">Outbound calling &amp; billing performance</p>
            </div>
          </div>
          {data.months.length > 0 && (
            <select value={month ?? ''} onChange={e => setMonth(e.target.value)}
              className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white shadow-sm backdrop-blur-sm outline-none focus:ring-2 focus:ring-white/30 [&>option]:text-slate-900">
              {data.months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
        </div>
      </motion.div>

      {data.months.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <BarChart3 size={40} className="mb-3 text-slate-300" />
          <p className="text-sm font-medium">No AW data uploaded yet</p>
          <p className="text-xs mt-1">Upload aw_out data from the Data Uploader to see this dashboard.</p>
        </div>
      ) : (
        <>
          {/* Calling KPIs */}
          <Section label="Calling">
            <MetricCard title="Total Calls" value={fmt(k.totalCalls)} icon={PhoneCall} color="#0EA5E9" />
            <MetricCard title="Connected Calls" value={fmt(k.connectedCalls)} sub={`${k.connectedPct}% connect rate`} icon={PhoneOutgoing} color="#16A34A" />
            <MetricCard title="Not Connected" value={fmt(k.notConnectedCalls)} icon={Percent} color="#DC2626" />
            <MetricCard title="Active Agents" value={fmt(k.activeAgents)} icon={Users} color="#7C3AED" />
          </Section>

          {/* Login & Revenue KPIs */}
          <Section label="Login & Revenue">
            <MetricCard title="Total Login Hrs" value={fmt(k.totalLoginHrs)} icon={Clock} color="#0F172A" />
            <MetricCard title="LRS Amount" value={fmtMoney(k.lrsAmount)} icon={Wallet} color="#D97706" />
            <MetricCard title="Trade Amount" value={fmtMoney(k.tradeAmount)} icon={Wallet} color="#D97706" />
            <MetricCard title="Total Revenue" value={fmtMoney(k.totalRevenue)} sub={`MF: ${fmtMoney(k.mfAmount)}`} icon={Wallet} color="#16A34A" />
          </Section>

          {/* Agent-wise table */}
          {data.agents.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              <div className="flex items-center gap-2.5 px-5 py-3.5"
                style={{ background: 'linear-gradient(135deg, #0F172A, #334155)' }}>
                <div className="w-1.5 h-4 rounded-full bg-white/60" />
                <h3 className="text-xs font-semibold uppercase tracking-widest flex-1 text-white">Agent-wise Performance</h3>
                <span className="text-[10px] text-white/50 font-medium">{data.agents.length} agent{data.agents.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="py-2.5 px-3 text-left text-slate-500 font-semibold uppercase tracking-wider">Agent</th>
                      <th className="py-2.5 px-3 text-left text-slate-500 font-semibold uppercase tracking-wider">Emp ID</th>
                      <th className="py-2.5 px-3 text-left text-slate-500 font-semibold uppercase tracking-wider">LOB</th>
                      <th className="py-2.5 px-3 text-right text-slate-500 font-semibold uppercase tracking-wider">Calls</th>
                      <th className="py-2.5 px-3 text-right text-slate-500 font-semibold uppercase tracking-wider">Connected</th>
                      <th className="py-2.5 px-3 text-right text-slate-500 font-semibold uppercase tracking-wider">Connect%</th>
                      <th className="py-2.5 px-3 text-right text-slate-500 font-semibold uppercase tracking-wider">Login Hrs</th>
                      <th className="py-2.5 px-3 text-right text-slate-500 font-semibold uppercase tracking-wider">ACHT</th>
                      <th className="py-2.5 px-3 text-right text-slate-500 font-semibold uppercase tracking-wider">Occupancy</th>
                      <th className="py-2.5 px-3 text-right text-slate-500 font-semibold uppercase tracking-wider">LRS Amt</th>
                      <th className="py-2.5 px-3 text-right text-slate-500 font-semibold uppercase tracking-wider">Trade Amt</th>
                      <th className="py-2.5 px-3 text-right text-slate-500 font-semibold uppercase tracking-wider">MF Amt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.agents.map((r, i) => (
                      <tr key={r.agentId} className={`border-b border-slate-100 transition-colors hover:bg-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                        <td className="py-2.5 px-3 text-slate-700 font-medium whitespace-nowrap">{r.agentName || r.agentId}</td>
                        <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{r.empId}</td>
                        <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{r.lob}</td>
                        <td className="py-2.5 px-3 text-right text-slate-600 tabular-nums">{fmt(r.totalCalls)}</td>
                        <td className="py-2.5 px-3 text-right text-slate-600 tabular-nums">{fmt(r.connectedCalls)}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">
                          <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${r.connectedPct >= 40 ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'}`}>{r.connectedPct}%</span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-600 tabular-nums">{fmt(r.netLoginHrs)}</td>
                        <td className="py-2.5 px-3 text-right text-slate-600 tabular-nums">{fmt(r.acht)}</td>
                        <td className="py-2.5 px-3 text-right text-slate-600 tabular-nums">{r.occupancy || '—'}</td>
                        <td className="py-2.5 px-3 text-right text-slate-600 tabular-nums">{fmtMoney(r.lrsAmount)}</td>
                        <td className="py-2.5 px-3 text-right text-slate-600 tabular-nums">{fmtMoney(r.tradeAmount)}</td>
                        <td className="py-2.5 px-3 text-right text-slate-600 tabular-nums font-medium">{fmtMoney(r.mfAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2.5">{label}</p>
      <motion.div variants={sectionVariants} initial="hidden" animate="show"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {children}
      </motion.div>
    </div>
  );
}

function MetricCard({
  title, value, sub, icon: Icon, color,
}: {
  title: string; value: string; sub?: string; icon: typeof PhoneCall; color: string;
}) {
  return (
    <motion.div variants={cardVariants} whileHover={{ y: -3 }}
      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 transition-shadow duration-300 hover:shadow-lg">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0 transition-transform duration-300 group-hover:scale-110" style={{ backgroundColor: color + '15' }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </motion.div>
  );
}
