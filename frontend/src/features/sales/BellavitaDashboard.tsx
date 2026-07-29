import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, DollarSign, ShoppingCart, TrendingUp, TrendingDown, Percent, Target, Package, Sparkles } from 'lucide-react';
import api from '@/lib/axios';

interface Metrics {
  totalRevenue: number;
  totalSaleCount: number;
  rtoPct: number;
  codPct: number;
  codCount: number;
  paidPct: number;
  paidCount: number;
  aov: number;
  rtoAmount: number;
  netRevenue: number;
  netSaleCount: number;
  netRevenueWithoutGst: number;
}

interface LobRow {
  campaign: string;
  totalRevenue: number;
  totalSaleCount: number;
  rtoPct: number;
  codPct: number;
  paidPct: number;
  aov: number;
  rtoAmount: number;
  netRevenue: number;
  netSaleCount: number;
  netRevenueWithoutGst: number;
}

function fmt(n: number): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function fmtMoney(n: number): string {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function fmtMoneyDec(n: number): string {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const months = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(2026, i, 1);
  const v = `2026-${String(i + 1).padStart(2, '0')}`;
  return { value: v, label: d.toLocaleString('en-US', { month: 'short', year: 'numeric' }) };
});

const sectionVariants = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const cardVariants = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } } };

export default function BellavitaDashboard() {
  const [month, setMonth] = useState('2026-06');
  const [data, setData] = useState<{ metrics: Metrics; lob: LobRow[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/sales/bellavita-dashboard', { params: { month } })
      .then(res => setData(res.data.data))
      .catch(err => console.error('Bellavita dashboard fetch error:', err))
      .finally(() => setLoading(false));
  }, [month]);

  if (loading) {
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

  const m = data.metrics;
  const topCampaign = [...data.lob].sort((a, b) => b.totalRevenue - a.totalRevenue)[0]?.campaign;

  return (
    <div className="space-y-7">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl px-6 py-5"
        style={{ background: 'linear-gradient(135deg, #0A0A0B 0%, #232326 55%, #3F3F46 100%)' }}
      >
        <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full opacity-20 blur-3xl" style={{ background: '#A78BFA' }} />
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.4) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white">Bellavita Dashboard</h1>
                <span className="flex items-center gap-1 rounded-full bg-white/10 border border-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70">
                  <Sparkles size={9} /> Premium
                </span>
              </div>
              <p className="text-xs text-white/50">Sales performance metrics</p>
            </div>
          </div>
          <select value={month} onChange={e => setMonth(e.target.value)}
            className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white shadow-sm backdrop-blur-sm outline-none focus:ring-2 focus:ring-white/30 [&>option]:text-slate-900">
            {months.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
      </motion.div>

      {/* Revenue metrics */}
      <Section label="Revenue">
        <MetricCard title="Total Revenue" value={fmtMoney(m.totalRevenue)} icon={DollarSign} color="#1A1A1A" />
        <MetricCard title="Sale Count" value={fmt(m.totalSaleCount)} icon={ShoppingCart} color="#1A1A1A" />
        <MetricCard title="AOV" value={fmtMoneyDec(m.aov)} icon={TrendingUp} color="#1A1A1A" />
        <MetricCard title="Net Revenue" value={fmtMoney(m.netRevenue)} icon={DollarSign} color="#1A1A1A" />
      </Section>

      {/* Performance metrics — with target progress bars */}
      <Section label="Performance vs Target">
        <MetricCard title="RTO %" value={`${m.rtoPct}%`} sub="Target: ≤ 10%" icon={Percent}
          color={m.rtoPct <= 10 ? '#16A34A' : '#DC2626'} target={10} actual={m.rtoPct} lowerIsBetter />
        <MetricCard title="COD %" value={`${m.codPct}%`} sub={`COD Count: ${fmt(m.codCount)}`} icon={Target} color="#1A1A1A" />
        <MetricCard title="Paid %" value={`${m.paidPct}%`} sub={`Paid Count: ${fmt(m.paidCount)} · Target: ≥ 75%`} icon={Percent}
          color={m.paidPct >= 75 ? '#16A34A' : '#DC2626'} target={75} actual={m.paidPct} />
      </Section>

      {/* Additional metrics */}
      <Section label="Additional">
        <MetricCard title="RTO Amount" value={fmtMoney(m.rtoAmount)} icon={TrendingDown} color="#DC2626" />
        <MetricCard title="Net Sale Count" value={fmt(m.netSaleCount)} icon={ShoppingCart} color="#1A1A1A" />
        <MetricCard title="Net Rev. Without GST" value={fmtMoneyDec(m.netRevenueWithoutGst)} icon={DollarSign} color="#1A1A1A" />
      </Section>

      {/* LOB-wise table */}
      {data.lob.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="flex items-center gap-2.5 px-5 py-3.5"
            style={{ background: 'linear-gradient(135deg, #0A0A0B, #3F3F46)' }}>
            <div className="w-1.5 h-4 rounded-full bg-white/60" />
            <h3 className="text-xs font-semibold uppercase tracking-widest flex-1 text-white">Campaign-wise Breakdown</h3>
            <span className="text-[10px] text-white/50 font-medium">{data.lob.length} campaign{data.lob.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="py-2.5 px-3 text-left text-slate-500 font-semibold uppercase tracking-wider">Campaign</th>
                  <th className="py-2.5 px-3 text-right text-slate-500 font-semibold uppercase tracking-wider">Revenue</th>
                  <th className="py-2.5 px-3 text-right text-slate-500 font-semibold uppercase tracking-wider">Sales</th>
                  <th className="py-2.5 px-3 text-right text-slate-500 font-semibold uppercase tracking-wider">AOV</th>
                  <th className="py-2.5 px-3 text-right text-slate-500 font-semibold uppercase tracking-wider">RTO%</th>
                  <th className="py-2.5 px-3 text-right text-slate-500 font-semibold uppercase tracking-wider">COD%</th>
                  <th className="py-2.5 px-3 text-right text-slate-500 font-semibold uppercase tracking-wider">Paid%</th>
                  <th className="py-2.5 px-3 text-right text-slate-500 font-semibold uppercase tracking-wider">RTO Amt</th>
                  <th className="py-2.5 px-3 text-right text-slate-500 font-semibold uppercase tracking-wider">Net Rev</th>
                  <th className="py-2.5 px-3 text-right text-slate-500 font-semibold uppercase tracking-wider">Net Sales</th>
                  <th className="py-2.5 px-3 text-right text-slate-500 font-semibold uppercase tracking-wider">Net Rev (excl GST)</th>
                </tr>
              </thead>
              <tbody>
                {data.lob.map((r, i) => (
                  <tr key={r.campaign} className={`border-b border-slate-100 transition-colors hover:bg-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                    <td className="py-2.5 px-3 text-slate-700 font-medium whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {r.campaign === topCampaign && (
                          <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1 py-0.5">TOP</span>
                        )}
                        {r.campaign}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600 tabular-nums">{fmtMoney(r.totalRevenue)}</td>
                    <td className="py-2.5 px-3 text-right text-slate-600 tabular-nums">{fmt(r.totalSaleCount)}</td>
                    <td className="py-2.5 px-3 text-right text-slate-600 tabular-nums">{fmtMoneyDec(r.aov)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${r.rtoPct <= 10 ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'}`}>{r.rtoPct}%</span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600 tabular-nums">{r.codPct}%</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${r.paidPct >= 75 ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'}`}>{r.paidPct}%</span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600 tabular-nums">{fmtMoney(r.rtoAmount)}</td>
                    <td className="py-2.5 px-3 text-right text-slate-600 tabular-nums font-medium">{fmtMoney(r.netRevenue)}</td>
                    <td className="py-2.5 px-3 text-right text-slate-600 tabular-nums">{fmt(r.netSaleCount)}</td>
                    <td className="py-2.5 px-3 text-right text-slate-600 tabular-nums font-medium">{fmtMoneyDec(r.netRevenueWithoutGst)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
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
  title, value, sub, icon: Icon, color, target, actual, lowerIsBetter,
}: {
  title: string; value: string; sub?: string; icon: typeof DollarSign; color: string; target?: number; actual?: number; lowerIsBetter?: boolean;
}) {
  const hasTarget = target !== undefined && actual !== undefined;
  const isGood = hasTarget ? (lowerIsBetter ? actual! <= target! : actual! >= target!) : undefined;
  const progressPct = hasTarget ? Math.min(100, Math.max(4, lowerIsBetter ? (100 - Math.min(100, (actual! / (target! * 2)) * 100)) : (actual! / target!) * 100)) : 0;

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
      {hasTarget && (
        <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <motion.div
            initial={{ width: 0 }} animate={{ width: `${progressPct}%` }} transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
            className="h-full rounded-full"
            style={{ background: isGood ? '#16A34A' : '#DC2626' }}
          />
        </div>
      )}
    </motion.div>
  );
}
