import { useEffect, useState } from 'react';
import { BarChart3, DollarSign, ShoppingCart, TrendingUp, TrendingDown, Percent, Target, Package } from 'lucide-react';
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
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-black border-t-transparent rounded-full" />
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black">
            <Package className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Bellavita Dashboard</h1>
            <p className="text-xs text-slate-500">Sales performance metrics</p>
          </div>
        </div>
        <select value={month} onChange={e => setMonth(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-black/20">
          {months.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total Revenue" value={fmtMoney(m.totalRevenue)} icon={DollarSign} color="#1A1A1A" />
        <MetricCard title="Sale Count" value={fmt(m.totalSaleCount)} icon={ShoppingCart} color="#1A1A1A" />
        <MetricCard title="AOV" value={fmtMoneyDec(m.aov)} icon={TrendingUp} color="#1A1A1A" />
        <MetricCard title="Net Revenue" value={fmtMoney(m.netRevenue)} icon={DollarSign} color="#1A1A1A" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard title="RTO %" value={`${m.rtoPct}%`} sub={`Target: ≤ 10%`} icon={Percent} color={m.rtoPct <= 10 ? '#16A34A' : '#DC2626'} target={10} actual={m.rtoPct} />
        <MetricCard title="COD %" value={`${m.codPct}%`} sub={`COD Count: ${fmt(m.codCount)}`} icon={Target} color="#1A1A1A" />
        <MetricCard title="Paid %" value={`${m.paidPct}%`} sub={`Paid Count: ${fmt(m.paidCount)} · Target: ≥ 75%`} icon={Percent} color={m.paidPct >= 75 ? '#16A34A' : '#DC2626'} target={75} actual={m.paidPct} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard title="RTO Amount" value={fmtMoney(m.rtoAmount)} icon={TrendingDown} color="#DC2626" />
        <MetricCard title="Net Sale Count" value={fmt(m.netSaleCount)} icon={ShoppingCart} color="#1A1A1A" />
        <MetricCard title="Net Rev. Without GST" value={fmtMoneyDec(m.netRevenueWithoutGst)} icon={DollarSign} color="#1A1A1A" />
      </div>

      {/* LOB-wise table */}
      {data.lob.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3 border-b bg-black">
            <div className="w-1.5 h-4 rounded-full bg-white/60" />
            <h3 className="text-xs font-semibold uppercase tracking-widest flex-1 text-white">Campaign-wise Breakdown</h3>
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
                  <tr key={r.campaign} className={`border-b border-slate-100 hover:bg-slate-50 ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                    <td className="py-2.5 px-3 text-slate-700 font-medium whitespace-nowrap">{r.campaign}</td>
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
        </div>
      )}
    </div>
  );
}

function MetricCard({
  title, value, sub, icon: Icon, color, target, actual,
}: {
  title: string; value: string; sub?: string; icon: typeof DollarSign; color: string; target?: number; actual?: number;
}) {
  const isGood = target !== undefined && actual !== undefined ? actual <= target : undefined;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0" style={{ backgroundColor: color + '15' }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}