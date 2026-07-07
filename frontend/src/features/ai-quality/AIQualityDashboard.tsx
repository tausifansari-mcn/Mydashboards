import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3, Building2, ChevronLeft, ChevronRight,
  PhoneCall, ShoppingCart, TrendingUp, Star, ThumbsUp, Target,
  ClipboardCheck, Activity,
} from 'lucide-react';
import api from '@/lib/axios';
import { useProcessStore } from '@/store/processStore';

function toLocalDT(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface ClientKPISummary {
  client_id:      number;
  client_name:    string;
  total_calls:    number;
  sales:          number;
  conversion_pct: number;
  total_feedback: number;
  promoters:      number;
  detractors:     number;
  nps_score:      number;
  positive_pct:   number;
  valid_calls:    number;
  ops:            number;
}

const CARD_COLORS = [
  '#3B82F6', '#22C55E', '#F59E0B', '#EF4444',
  '#14B8A6', '#A78BFA', '#EC4899', '#F97316',
  '#06B6D4', '#8B5CF6', '#84CC16', '#E11D48',
  '#0EA5E9', '#10B981', '#D946EF', '#FB923C',
];

interface InboundClientSummary {
  client_id:         string;
  client_name:       string;
  audit_count:       number;
  cq_score:          number;
  cq_score_no_fatal: number;
  excellent:         number;
  good:              number;
  average_count:     number;
  below_average:     number;
  fatal_count:       number;
}

function ibCqColor(score: number): string {
  if (score >= 90) return '#16A34A';
  if (score >= 85) return '#D97706';
  if (score > 0)   return '#DC2626';
  return '#94A3B8';
}

const SLIDES = [
  { label: 'Inbound',  icon: PhoneCall  },
  { label: 'Outbound', icon: TrendingUp },
] as const;

function npsColor(score: number): string {
  if (score >= 50) return '#16A34A';
  if (score >= 20) return '#D97706';
  if (score >= 0)  return '#EA580C';
  return '#DC2626';
}
function convColor(pct: number): string {
  if (pct >= 15) return '#16A34A';
  if (pct >= 7)  return '#D97706';
  return '#DC2626';
}
function posColor(pct: number): string {
  if (pct >= 60) return '#16A34A';
  if (pct >= 40) return '#D97706';
  return '#DC2626';
}
function opsRate(c: ClientKPISummary): number {
  if (!c.valid_calls) return 0;
  return Math.round((c.ops / c.valid_calls) * 100);
}

/* ── Compact KPI stat chip — no color inversion hover ── */
interface KPIChipProps {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}
function KPIChip({ icon: Icon, label, value, color }: KPIChipProps) {
  return (
    <div className="flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-white hover:shadow-sm transition-all duration-150 cursor-default min-w-0">
      <Icon size={13} style={{ color }} className="shrink-0" />
      <span className="text-sm font-bold leading-tight tabular-nums" style={{ color }}>{value}</span>
      <span className="text-[10px] font-medium text-slate-400 text-center leading-tight">{label}</span>
    </div>
  );
}

export default function AIQualityDashboard() {
  const navigate = useNavigate();
  const { canAccessInboundClient, canAccessOutboundClient } = useProcessStore();
  const now = new Date();
  const [activeSlide, setActiveSlide] = useState(0);

  const defaultStart = toLocalDT(new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0));
  const defaultEnd   = toLocalDT(now);

  const [ibStart, setIbStart] = useState(defaultStart);
  const [ibEnd,   setIbEnd]   = useState(defaultEnd);
  const [ibClients, setIbClients] = useState<InboundClientSummary[]>([]);
  const [ibLoading, setIbLoading] = useState(false);

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate]     = useState(defaultEnd);
  const [clients, setClients]     = useState<ClientKPISummary[]>([]);
  const [loading, setLoading]     = useState(true);

  const ibSd = ibStart.replace('T', ' ');
  const ibEd = ibEnd.replace('T', ' ');
  const sd   = startDate.replace('T', ' ');
  const ed   = endDate.replace('T', ' ');

  const fetchInboundClients = useCallback(() => {
    setIbLoading(true);
    api.get<{ data: InboundClientSummary[] }>(`/inbound-quality/clients?startDate=${ibSd}&endDate=${ibEd}`)
      .then(r => setIbClients(r.data?.data ?? []))
      .catch(() => {})
      .finally(() => setIbLoading(false));
  }, [ibSd, ibEd]);

  const fetchOutboundClients = useCallback(() => {
    setLoading(true);
    api.get<{ data: ClientKPISummary[] }>(`/quality/clients-summary?startDate=${sd}&endDate=${ed}`)
      .then(r => setClients(r.data?.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sd, ed]);

  useEffect(() => { if (activeSlide === 0) fetchInboundClients(); }, [fetchInboundClients, activeSlide]);
  useEffect(() => { if (activeSlide === 1) fetchOutboundClients(); }, [fetchOutboundClients, activeSlide]);

  const avgConv = clients.length
    ? (clients.reduce((s, c) => s + c.conversion_pct, 0) / clients.length).toFixed(1)
    : '0.0';

  return (
    <div className="min-h-screen text-slate-900 flex flex-col">

      {/* ── Page Header ── */}
      <div className="sticky top-0 z-30 shadow-md" style={{ background: 'linear-gradient(135deg, #0D47A1 0%, #1565C0 100%)' }}>
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4 flex-wrap">
          <button onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
            style={{ color: 'rgba(255,255,255,0.85)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.15)'; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.85)'; }}
          >
            <ChevronLeft size={14} /> Back
          </button>
          <div className="w-px h-5" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white shadow-md">
              <img src="/Logo.png" alt="MAS" className="h-7 w-7 object-contain" />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-none text-white">AI Quality Dashboard</h1>
              <p className="text-[11px] mt-0.5 font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>MAS CallNet Analytics</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Activity size={11} className="animate-pulse" style={{ color: '#86EFAC' }} />
            <span className="text-[11px] font-semibold" style={{ color: '#86EFAC' }}>Live</span>
          </div>
        </div>

        {/* ── Pill tabs ── */}
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 pb-3 pt-1">
          <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
            {SLIDES.map((s, i) => {
              const isActive = activeSlide === i;
              const SlideIcon = s.icon;
              return (
                <button
                  key={s.label}
                  onClick={() => setActiveSlide(i)}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer"
                  style={{
                    backgroundColor: isActive ? '#fff' : 'transparent',
                    color: isActive ? '#1565C0' : 'rgba(255,255,255,0.75)',
                  }}
                >
                  <SlideIcon size={13} />
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5 w-full">

        {/* ── Slide 0: Inbound ── */}
        {activeSlide === 0 && (
          <>
            {/* Date filter */}
            <div className="mb-5 rounded-xl px-4 py-2.5 flex items-center gap-3 flex-wrap"
              style={{ background: 'linear-gradient(135deg, #0D47A1 0%, #1565C0 100%)', boxShadow: '0 2px 8px rgba(21,101,192,0.25)' }}>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
                <span className="text-xs font-semibold text-white">Inbound Period</span>
              </div>
              <div className="w-px h-4 mx-0.5" style={{ backgroundColor: 'rgba(255,255,255,0.25)' }} />
              <label className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>From</label>
              <input type="datetime-local" value={ibStart} onChange={e => setIbStart(e.target.value)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium focus:outline-none transition-all"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff' }} />
              <label className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>To</label>
              <input type="datetime-local" value={ibEnd} onChange={e => setIbEnd(e.target.value)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium focus:outline-none transition-all"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff' }} />
            </div>

            {/* Section header */}
            <div className="section-header">
              <Building2 size={13} className="text-slate-400" />
              <h2 className="section-title">All Inbound Processes</h2>
              {!ibLoading && (
                <span className="ml-auto text-[11px] text-slate-500">
                  {ibClients.length} processes
                </span>
              )}
            </div>

            {ibLoading ? (
              <div className="flex flex-col gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="rounded-xl bg-white border border-slate-200 px-5 py-4 animate-pulse">
                    <div className="h-4 bg-slate-100 rounded-lg w-1/3 mb-4" />
                    <div className="grid grid-cols-6 gap-2">
                      {[...Array(6)].map((__, j) => <div key={j} className="h-16 bg-slate-100 rounded-xl" />)}
                    </div>
                  </div>
                ))}
              </div>
            ) : ibClients.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="p-4 rounded-xl bg-slate-100">
                  <Building2 size={28} className="text-slate-300" />
                </div>
                <p className="text-slate-400 font-medium text-sm">No inbound audit data for this period</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 w-full">
                {ibClients.filter((c) => canAccessInboundClient(c.client_id)).map((c, i) => {
                  const accentColor = CARD_COLORS[i % CARD_COLORS.length];
                  const total = c.audit_count;
                  const pct = (n: number) => total > 0 ? `${((n / total) * 100).toFixed(0)}%` : '—';
                  const cqColor = ibCqColor(c.cq_score);
                  return (
                    <div key={c.client_id}
                      onClick={() => navigate(`/quality/inbound/${c.client_id}`)}
                      className="group bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all duration-150 cursor-pointer hover:-translate-y-0.5 w-full overflow-hidden"
                    >
                      <div className="h-0.5 w-full" style={{ backgroundColor: accentColor }} />
                      <div className="px-5 pt-3 pb-4">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                            style={{ backgroundColor: accentColor }}>
                            {(c.client_name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{c.client_name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-slate-400">{total.toLocaleString()} audits</span>
                              <span className="text-[10px] font-bold" style={{ color: cqColor }}>
                                CQ {c.cq_score ? `${c.cq_score}%` : '—'}
                              </span>
                            </div>
                          </div>
                          <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-600 transition-colors" />
                        </div>
                        <div className="grid grid-cols-6 gap-2">
                          <KPIChip icon={ClipboardCheck} label="Audits"       value={total.toLocaleString()}                              color="#3B82F6" />
                          <KPIChip icon={Star}           label="CQ Score"      value={c.cq_score ? `${c.cq_score}%` : '—'}               color={cqColor} />
                          <KPIChip icon={TrendingUp}     label="W/O Fatal"     value={c.cq_score_no_fatal ? `${c.cq_score_no_fatal}%` : '—'} color={ibCqColor(c.cq_score_no_fatal)} />
                          <KPIChip icon={ThumbsUp}       label="Excellent"     value={c.excellent ? `${c.excellent} (${pct(c.excellent)})` : '0'} color="#16A34A" />
                          <KPIChip icon={PhoneCall}      label="Good"          value={c.good ? `${c.good} (${pct(c.good)})` : '0'}       color="#2563EB" />
                          <KPIChip icon={Target}         label="Below Avg"     value={c.below_average ? `${c.below_average} (${pct(c.below_average)})` : '0'} color={c.below_average > 0 ? '#DC2626' : '#94A3B8'} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Slide 1: Outbound ── */}
        {activeSlide === 1 && (
          <>
            {/* Date filter */}
            <div className="mb-5 rounded-xl px-4 py-2.5 flex items-center gap-3 flex-wrap"
              style={{ background: 'linear-gradient(135deg, #0D47A1 0%, #1565C0 100%)', boxShadow: '0 2px 8px rgba(21,101,192,0.25)' }}>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
                <span className="text-xs font-semibold text-white">Outbound Period</span>
              </div>
              <div className="w-px h-4 mx-0.5" style={{ backgroundColor: 'rgba(255,255,255,0.25)' }} />
              <label className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>From</label>
              <input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium focus:outline-none transition-all"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff' }} />
              <label className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>To</label>
              <input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium focus:outline-none transition-all"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff' }} />
            </div>

            {/* Section header */}
            <div className="section-header">
              <Building2 size={13} className="text-slate-400" />
              <h2 className="section-title">All Outbound Processes</h2>
              {!loading && (
                <span className="ml-auto text-[11px] text-slate-500">
                  {clients.length} processes · Avg Conv {avgConv}%
                </span>
              )}
            </div>

            {loading ? (
              <div className="flex flex-col gap-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="rounded-xl bg-white border border-slate-200 px-5 py-4 animate-pulse">
                    <div className="h-4 bg-slate-100 rounded-lg w-1/3 mb-4" />
                    <div className="grid grid-cols-6 gap-2">
                      {[...Array(6)].map((__, j) => <div key={j} className="h-16 bg-slate-100 rounded-xl" />)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 w-full">
                {clients.filter((c) => canAccessOutboundClient(c.client_id)).map((c, i) => {
                  const accentColor = CARD_COLORS[i % CARD_COLORS.length];
                  const rate = opsRate(c);
                  return (
                    <div key={c.client_id}
                      onClick={() => navigate(`/quality/${c.client_id}`)}
                      className="group bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all duration-150 cursor-pointer hover:-translate-y-0.5 w-full overflow-hidden"
                    >
                      <div className="h-0.5 w-full" style={{ backgroundColor: accentColor }} />
                      <div className="px-5 pt-3 pb-4">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                            style={{ backgroundColor: accentColor }}>
                            {(c.client_name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{c.client_name || `Client ${c.client_id}`}</p>
                            <span className="text-[10px] text-slate-400">{c.total_calls.toLocaleString()} calls</span>
                          </div>
                          <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-600 transition-colors" />
                        </div>
                        <div className="grid grid-cols-6 gap-2">
                          <KPIChip icon={PhoneCall}    label="Total Calls"  value={c.total_calls.toLocaleString()}                            color="#0EA5E9" />
                          <KPIChip icon={ShoppingCart} label="Sales"        value={c.sales.toLocaleString()}                                   color="#16A34A" />
                          <KPIChip icon={TrendingUp}   label="Conv. Rate"   value={`${c.conversion_pct}%`}                                     color={convColor(c.conversion_pct)} />
                          <KPIChip icon={Star}         label="NPS Score"    value={c.nps_score > 0 ? `+${c.nps_score}` : String(c.nps_score)}  color={npsColor(c.nps_score)} />
                          <KPIChip icon={ThumbsUp}     label="Positive"     value={c.total_feedback ? `${c.positive_pct}%` : '—'}              color={c.total_feedback ? posColor(c.positive_pct) : '#94A3B8'} />
                          <KPIChip icon={Target}       label="Opening Rate" value={c.valid_calls ? `${rate}%` : '—'}                           color={c.valid_calls ? (rate >= 70 ? '#16A34A' : rate >= 50 ? '#D97706' : '#DC2626') : '#94A3B8'} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
