import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3, Building2, ChevronLeft, ChevronRight,
  PhoneCall, ShoppingCart, TrendingUp, Star, ThumbsUp, Target,
  ClipboardCheck,
} from 'lucide-react';
import api from '@/lib/axios';

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

// ─── Inbound client summary ───────────────────────────────────────────────────
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
  if (score >= 90) return '#22C55E';
  if (score >= 85) return '#F59E0B';
  if (score > 0)   return '#EF4444';
  return '#64748B';
}

const SLIDES = [
  { label: 'Inbound',  accent: 'sky'    },
  { label: 'Outbound', accent: 'purple' },
] as const;

function npsColor(score: number): string {
  if (score >= 50) return '#22C55E';
  if (score >= 20) return '#F59E0B';
  if (score >= 0)  return '#F97316';
  return '#EF4444';
}

function convColor(pct: number): string {
  if (pct >= 15) return '#22C55E';
  if (pct >= 7)  return '#F59E0B';
  return '#EF4444';
}

function posColor(pct: number): string {
  if (pct >= 60) return '#22C55E';
  if (pct >= 40) return '#F59E0B';
  return '#EF4444';
}

function opsRate(c: ClientKPISummary): number {
  if (!c.valid_calls) return 0;
  return Math.round((c.ops / c.valid_calls) * 100);
}

interface KPIChipProps {
  icon: React.ElementType;
  label: string;
  value: string;
  valueColor?: string;
}

function KPIChip({ icon: Icon, label, value, valueColor = '#fff' }: KPIChipProps) {
  return (
    <div className="flex flex-col items-center justify-center px-2 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] gap-1">
      <Icon size={13} className="text-slate-500" />
      <span className="text-[15px] font-bold leading-none" style={{ color: valueColor }}>{value}</span>
      <span className="text-[9px] text-slate-500 uppercase tracking-wider whitespace-nowrap">{label}</span>
    </div>
  );
}

export default function AIQualityDashboard() {
  const navigate = useNavigate();
  const now = new Date();
  const [activeSlide, setActiveSlide] = useState(0);

  // Inbound state
  const [ibStart, setIbStart] = useState(toLocalDT(new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)));
  const [ibEnd,   setIbEnd]   = useState(toLocalDT(now));
  const [ibClients, setIbClients] = useState<InboundClientSummary[]>([]);
  const [ibLoading, setIbLoading] = useState(false);

  // Outbound state
  const [startDate, setStartDate] = useState(toLocalDT(new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)));
  const [endDate, setEndDate]     = useState(toLocalDT(now));
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
    <div className="min-h-screen bg-[#0F172A] text-white flex flex-col">
      {/* Top bar */}
      <div className="bg-[#0B1120] border-b border-white/5 sticky top-0 z-30">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3 flex-wrap">
          <button onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-xs">
            <ChevronLeft size={16} /> Dashboard
          </button>
          <div className="w-px h-4 bg-slate-700" />
          <BarChart3 size={15} className="text-purple-400 shrink-0" />
          <div>
            <h1 className="text-sm font-bold text-white leading-none">AI Quality</h1>
            <p className="text-[10px] text-slate-500 mt-0.5">Select a LOB to view details</p>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 w-full">

        {/* Slide tabs */}
        <div className="flex gap-2 mb-6">
          {SLIDES.map((s, i) => {
            const isActive = activeSlide === i;
            const activeColors: Record<string, string> = {
              sky:    'bg-sky-500/20 border-sky-500/60 text-sky-300',
              purple: 'bg-purple-500/20 border-purple-500/60 text-purple-300',
            };
            const inactiveColors = 'bg-white/[0.03] border-white/10 text-slate-500 hover:text-slate-300 hover:border-white/20';
            return (
              <button
                key={s.label}
                onClick={() => setActiveSlide(i)}
                className={`px-5 py-2 rounded-lg border text-xs font-bold uppercase tracking-widest transition-all duration-150 ${isActive ? activeColors[s.accent] : inactiveColors}`}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        {/* ── Slide 0: Inbound ── */}
        {activeSlide === 0 && (
          <>
            {/* Date filter */}
            <div className="flex items-center gap-3 flex-wrap mb-6">
              <label className="text-[11px] text-slate-500 uppercase tracking-wider">From</label>
              <input type="datetime-local" value={ibStart} onChange={e => setIbStart(e.target.value)}
                className="bg-[#1E293B] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500" />
              <label className="text-[11px] text-slate-500 uppercase tracking-wider">To</label>
              <input type="datetime-local" value={ibEnd} onChange={e => setIbEnd(e.target.value)}
                className="bg-[#1E293B] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500" />
            </div>

            {/* Process list */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Building2 size={13} className="text-slate-500" />
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">All Process</h2>
                {!ibLoading && (
                  <span className="text-[11px] text-slate-600 ml-auto">{ibClients.length} Process</span>
                )}
              </div>

              {ibLoading ? (
                <div className="flex flex-col gap-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="rounded-xl bg-[#1E293B] border border-white/5 px-5 py-4 animate-pulse">
                      <div className="h-4 bg-white/5 rounded w-1/3 mb-3" />
                      <div className="grid grid-cols-6 gap-2">
                        {[...Array(6)].map((__, j) => <div key={j} className="h-16 bg-white/5 rounded-xl" />)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : ibClients.length === 0 ? (
                <div className="flex items-center justify-center py-16 text-slate-600 text-sm">
                  No inbound audit data for this period.
                </div>
              ) : (
                <div className="flex flex-col gap-2 w-full">
                  {ibClients.map((c, i) => {
                    const accentColor = CARD_COLORS[i % CARD_COLORS.length];
                    const total = c.audit_count;
                    const pct = (n: number) => total > 0 ? `${((n / total) * 100).toFixed(0)}%` : '—';
                    return (
                      <div key={c.client_id}
                        onClick={() => navigate(`/quality/inbound/${c.client_id}`)}
                        className="group relative bg-gradient-to-br from-[#1E293B] to-[#16213a] rounded-xl border border-white/5 hover:border-sky-500/40 transition-all duration-200 cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:shadow-sky-900/20 w-full overflow-hidden"
                      >
                        <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ backgroundColor: accentColor }} />
                        <div className="pl-5 pr-4 pt-3 pb-3">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-bold shrink-0"
                              style={{ backgroundColor: `${accentColor}20`, color: accentColor }}>
                              {(c.client_name || '?').charAt(0).toUpperCase()}
                            </div>
                            <p className="text-[14px] font-semibold text-white truncate flex-1" title={c.client_name}>
                              {c.client_name}
                            </p>
                            <ChevronRight size={14} className="text-slate-600 group-hover:text-sky-400 transition-colors shrink-0" />
                          </div>
                          <div className="grid grid-cols-6 gap-2">
                            <KPIChip icon={ClipboardCheck} label="Audit Count"   value={total.toLocaleString()} />
                            <KPIChip icon={Star}           label="CQ Score%"     value={c.cq_score ? `${c.cq_score}%` : '—'}          valueColor={ibCqColor(c.cq_score)} />
                            <KPIChip icon={TrendingUp}     label="W/O Fatal CQ%" value={c.cq_score_no_fatal ? `${c.cq_score_no_fatal}%` : '—'} valueColor={ibCqColor(c.cq_score_no_fatal)} />
                            <KPIChip icon={ThumbsUp}       label="Excellent"     value={c.excellent ? `${c.excellent} (${pct(c.excellent)})` : '0'} valueColor="#22C55E" />
                            <KPIChip icon={PhoneCall}      label="Good"          value={c.good ? `${c.good} (${pct(c.good)})` : '0'}            valueColor="#3B82F6" />
                            <KPIChip icon={Target}         label="Below Avg"     value={c.below_average ? `${c.below_average} (${pct(c.below_average)})` : '0'} valueColor={c.below_average > 0 ? '#EF4444' : '#64748B'} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Slide 1: Outbound ── */}
        {activeSlide === 1 && (
          <>
            {/* Date Range */}
            <div className="flex items-center gap-3 flex-wrap mb-6">
              <label className="text-[11px] text-slate-500 uppercase tracking-wider">From</label>
              <input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="bg-[#1E293B] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500" />
              <label className="text-[11px] text-slate-500 uppercase tracking-wider">To</label>
              <input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="bg-[#1E293B] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500" />
            </div>

            {/* Process list */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Building2 size={13} className="text-slate-500" />
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">All Process</h2>
                {!loading && (
                  <span className="text-[11px] text-slate-600 ml-auto">
                    {clients.length} Process · Avg Conv {avgConv}%
                  </span>
                )}
              </div>

              {loading ? (
                <div className="flex flex-col gap-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="rounded-xl bg-[#1E293B] border border-white/5 px-5 py-4 animate-pulse">
                      <div className="h-4 bg-white/5 rounded w-1/3 mb-3" />
                      <div className="grid grid-cols-6 gap-2">
                        {[...Array(6)].map((__, j) => (
                          <div key={j} className="h-16 bg-white/5 rounded-xl" />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-2 w-full">
                  {clients.map((c, i) => {
                    const accentColor = CARD_COLORS[i % CARD_COLORS.length];
                    const rate = opsRate(c);
                    return (
                      <div
                        key={c.client_id}
                        onClick={() => navigate(`/quality/${c.client_id}`)}
                        className="group relative bg-gradient-to-br from-[#1E293B] to-[#16213a] rounded-xl border border-white/5 hover:border-purple-500/40 transition-all duration-200 cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:shadow-purple-900/20 w-full overflow-hidden"
                      >
                        <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ backgroundColor: accentColor }} />
                        <div className="pl-5 pr-4 pt-3 pb-3">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-bold shrink-0"
                              style={{ backgroundColor: `${accentColor}20`, color: accentColor }}>
                              {(c.client_name || '?').charAt(0).toUpperCase()}
                            </div>
                            <p className="text-[14px] font-semibold text-white truncate flex-1" title={c.client_name}>
                              {c.client_name || `Client ${c.client_id}`}
                            </p>
                            <ChevronRight size={14} className="text-slate-600 group-hover:text-purple-400 transition-colors shrink-0" />
                          </div>
                          <div className="grid grid-cols-6 gap-2">
                            <KPIChip icon={PhoneCall}    label="Total Calls"   value={c.total_calls.toLocaleString()} />
                            <KPIChip icon={ShoppingCart} label="Sales"         value={c.sales.toLocaleString()}        valueColor="#22C55E" />
                            <KPIChip icon={TrendingUp}   label="Conv. Rate"    value={`${c.conversion_pct}%`}          valueColor={convColor(c.conversion_pct)} />
                            <KPIChip icon={Star}         label="NPS Score"     value={c.nps_score > 0 ? `+${c.nps_score}` : String(c.nps_score)} valueColor={npsColor(c.nps_score)} />
                            <KPIChip icon={ThumbsUp}     label="Positive"      value={c.total_feedback ? `${c.positive_pct}%` : '—'} valueColor={c.total_feedback ? posColor(c.positive_pct) : '#64748B'} />
                            <KPIChip icon={Target}       label="Opening Rate"  value={c.valid_calls ? `${rate}%` : '—'} valueColor={c.valid_calls ? (rate >= 70 ? '#22C55E' : rate >= 50 ? '#F59E0B' : '#EF4444') : '#64748B'} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
