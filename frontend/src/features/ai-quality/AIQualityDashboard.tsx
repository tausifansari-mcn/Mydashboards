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
  return '#64748B';
}

function ibCqBg(score: number): string {
  if (score >= 90) return '#DCFCE7';
  if (score >= 85) return '#FEF3C7';
  if (score > 0)   return '#FEE2E2';
  return '#F1F5F9';
}

const SLIDES = [
  { label: 'Inbound',  accent: 'sky',    icon: PhoneCall,  gradient: 'from-sky-500 to-cyan-400'   },
  { label: 'Outbound', accent: 'purple',  icon: TrendingUp, gradient: 'from-purple-500 to-violet-400' },
] as const;

function npsColor(score: number): string {
  if (score >= 50) return '#16A34A';
  if (score >= 20) return '#D97706';
  if (score >= 0)  return '#EA580C';
  return '#DC2626';
}
function npsBg(score: number): string {
  if (score >= 50) return '#DCFCE7';
  if (score >= 20) return '#FEF3C7';
  if (score >= 0)  return '#FFEDD5';
  return '#FEE2E2';
}

function convColor(pct: number): string {
  if (pct >= 15) return '#16A34A';
  if (pct >= 7)  return '#D97706';
  return '#DC2626';
}
function convBg(pct: number): string {
  if (pct >= 15) return '#DCFCE7';
  if (pct >= 7)  return '#FEF3C7';
  return '#FEE2E2';
}

function posColor(pct: number): string {
  if (pct >= 60) return '#16A34A';
  if (pct >= 40) return '#D97706';
  return '#DC2626';
}
function posBg(pct: number): string {
  if (pct >= 60) return '#DCFCE7';
  if (pct >= 40) return '#FEF3C7';
  return '#FEE2E2';
}

function opsRate(c: ClientKPISummary): number {
  if (!c.valid_calls) return 0;
  return Math.round((c.ops / c.valid_calls) * 100);
}

interface KPIChipProps {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
  bg: string;
}

function KPIChip({ icon: Icon, label, value, color, bg }: KPIChipProps) {
  return (
    <div
      className="flex flex-col items-center justify-center px-2 py-3 rounded-xl border-2 gap-1 transition-all duration-200 cursor-default hover:scale-[1.06] hover:shadow-lg hover:z-10 relative"
      style={{
        backgroundColor: bg,
        borderColor: `${color}40`,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.backgroundColor = color;
        (e.currentTarget as HTMLDivElement).style.borderColor = color;
        const texts = (e.currentTarget as HTMLDivElement).querySelectorAll('[data-val],[data-lbl]');
        texts.forEach(t => ((t as HTMLElement).style.color = '#ffffff'));
        const icon = (e.currentTarget as HTMLDivElement).querySelector('[data-ico]');
        if (icon) (icon as HTMLElement).style.color = '#ffffff';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.backgroundColor = bg;
        (e.currentTarget as HTMLDivElement).style.borderColor = `${color}40`;
        const val = (e.currentTarget as HTMLDivElement).querySelector('[data-val]');
        const lbl = (e.currentTarget as HTMLDivElement).querySelector('[data-lbl]');
        const ico = (e.currentTarget as HTMLDivElement).querySelector('[data-ico]');
        if (val) (val as HTMLElement).style.color = color;
        if (lbl) (lbl as HTMLElement).style.color = '#475569';
        if (ico) (ico as HTMLElement).style.color = color;
      }}
    >
      <Icon data-ico size={14} style={{ color }} className="shrink-0 transition-colors duration-200" />
      <span data-val className="text-[15px] font-black leading-tight transition-colors duration-200" style={{ color }}>{value}</span>
      <span data-lbl className="text-[9px] font-bold uppercase tracking-wider text-center transition-colors duration-200 text-slate-500">{label}</span>
    </div>
  );
}

export default function AIQualityDashboard() {
  const navigate = useNavigate();
  const { canAccessInboundClient, canAccessOutboundClient } = useProcessStore();
  const now = new Date();
  const [activeSlide, setActiveSlide] = useState(0);

  const defaultStart = toLocalDT(new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0));
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
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col">

      {/* ── Hero Header ── */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 shadow-xl">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4 flex-wrap">
          <button onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors text-xs font-semibold bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg border border-white/10">
            <ChevronLeft size={14} /> Back
          </button>
          <div className="w-px h-6 bg-white/20" />
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-md border border-white/20">
              <img src="/Logo.png" alt="MAS" className="h-9 w-9 object-contain p-0.5" />
            </div>
            <div>
              <h1 className="text-base font-black text-white leading-none tracking-tight">AI Quality Dashboard</h1>
              <p className="text-[11px] mt-0.5 font-semibold" style={{ color: '#43A832' }}>Mas CallNet Analytics Platform</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Activity size={12} className="text-emerald-400 animate-pulse" />
            <span className="text-[11px] text-emerald-400 font-semibold">Live Data</span>
          </div>
        </div>

        {/* ── Slide Tabs inside header ── */}
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 pb-0 flex gap-2">
          {SLIDES.map((s, i) => {
            const isActive = activeSlide === i;
            const SlideIcon = s.icon;
            return (
              <button
                key={s.label}
                onClick={() => setActiveSlide(i)}
                className={`relative flex items-center gap-2 px-5 py-2.5 text-xs font-bold uppercase tracking-widest transition-all duration-200 rounded-t-xl border-b-2 ${
                  isActive
                    ? 'bg-white text-slate-900 border-transparent -mb-px shadow-lg'
                    : 'bg-white/10 text-slate-300 hover:text-white hover:bg-white/20 border-transparent'
                }`}
              >
                <SlideIcon size={13} className={isActive ? (i === 0 ? 'text-sky-500' : 'text-purple-500') : ''} />
                {s.label}
                {isActive && (
                  <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-8 h-0.5 bg-gradient-to-r ${s.gradient} rounded-full`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 w-full">

        {/* ── Slide 0: Inbound ── */}
        {activeSlide === 0 && (
          <>
            {/* Date filter */}
            <div className="flex items-center gap-3 flex-wrap mb-6 bg-white border border-slate-200 rounded-2xl px-5 py-3 shadow-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-sky-500" />
                <span className="text-xs font-black text-slate-800 uppercase tracking-widest">Inbound Period</span>
              </div>
              <div className="w-px h-5 bg-slate-200 mx-1" />
              <label className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">From</label>
              <input type="datetime-local" value={ibStart} onChange={e => setIbStart(e.target.value)}
                className="bg-sky-50 border-2 border-sky-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-semibold focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all" />
              <label className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">To</label>
              <input type="datetime-local" value={ibEnd} onChange={e => setIbEnd(e.target.value)}
                className="bg-sky-50 border-2 border-sky-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-semibold focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all" />
            </div>

            {/* Section header */}
            <div className="flex items-center gap-2 mb-4">
              <Building2 size={14} className="text-sky-500" />
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-800">All Inbound Processes</h2>
              {!ibLoading && (
                <span className="ml-auto text-[11px] font-bold text-slate-500 bg-white border border-slate-200 px-3 py-1 rounded-full shadow-sm">
                  {ibClients.length} processes
                </span>
              )}
            </div>

            {ibLoading ? (
              <div className="flex flex-col gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="rounded-2xl bg-white border border-slate-200 px-5 py-4 animate-pulse shadow-sm">
                    <div className="h-4 bg-slate-100 rounded-lg w-1/3 mb-4" />
                    <div className="grid grid-cols-6 gap-2">
                      {[...Array(6)].map((__, j) => <div key={j} className="h-16 bg-slate-100 rounded-xl" />)}
                    </div>
                  </div>
                ))}
              </div>
            ) : ibClients.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="p-4 rounded-2xl bg-slate-100">
                  <Building2 size={32} className="text-slate-300" />
                </div>
                <p className="text-slate-500 font-semibold text-sm">No inbound audit data for this period</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 w-full">
                {ibClients.filter((c) => canAccessInboundClient(c.client_id)).map((c, i) => {
                  const accentColor = CARD_COLORS[i % CARD_COLORS.length];
                  const total = c.audit_count;
                  const pct = (n: number) => total > 0 ? `${((n / total) * 100).toFixed(0)}%` : '—';
                  return (
                    <div key={c.client_id}
                      onClick={() => navigate(`/quality/inbound/${c.client_id}`)}
                      className="group relative bg-white rounded-2xl border-2 border-slate-100 hover:border-sky-300 transition-all duration-200 cursor-pointer hover:-translate-y-0.5 hover:shadow-xl w-full overflow-hidden shadow-sm"
                    >
                      {/* Top color band */}
                      <div className="h-1.5 w-full" style={{ backgroundColor: accentColor }} />
                      <div className="px-5 pt-3 pb-4">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black shadow-sm"
                            style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`, color: '#fff' }}>
                            {(c.client_name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[15px] font-black text-slate-900 truncate" title={c.client_name}>
                              {c.client_name}
                            </p>
                            <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Click to view full report →</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border"
                              style={{ color: accentColor, backgroundColor: `${accentColor}15`, borderColor: `${accentColor}40` }}>
                              Inbound
                            </span>
                            <ChevronRight size={15} className="text-slate-300 group-hover:text-sky-500 transition-colors" />
                          </div>
                        </div>
                        <div className="grid grid-cols-6 gap-2">
                          <KPIChip icon={ClipboardCheck} label="Audit Count"    value={total.toLocaleString()}                       color="#3B82F6"              bg="#EFF6FF" />
                          <KPIChip icon={Star}           label="CQ Score %"     value={c.cq_score ? `${c.cq_score}%` : '—'}          color={ibCqColor(c.cq_score)}              bg={ibCqBg(c.cq_score)} />
                          <KPIChip icon={TrendingUp}     label="W/O Fatal CQ%"  value={c.cq_score_no_fatal ? `${c.cq_score_no_fatal}%` : '—'} color={ibCqColor(c.cq_score_no_fatal)} bg={ibCqBg(c.cq_score_no_fatal)} />
                          <KPIChip icon={ThumbsUp}       label="Excellent"      value={c.excellent ? `${c.excellent} (${pct(c.excellent)})` : '0'} color="#16A34A" bg="#DCFCE7" />
                          <KPIChip icon={PhoneCall}      label="Good"           value={c.good ? `${c.good} (${pct(c.good)})` : '0'}  color="#2563EB"              bg="#DBEAFE" />
                          <KPIChip icon={Target}         label="Below Avg"      value={c.below_average ? `${c.below_average} (${pct(c.below_average)})` : '0'} color={c.below_average > 0 ? '#DC2626' : '#64748B'} bg={c.below_average > 0 ? '#FEE2E2' : '#F1F5F9'} />
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
            <div className="flex items-center gap-3 flex-wrap mb-6 bg-white border border-slate-200 rounded-2xl px-5 py-3 shadow-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                <span className="text-xs font-black text-slate-800 uppercase tracking-widest">Outbound Period</span>
              </div>
              <div className="w-px h-5 bg-slate-200 mx-1" />
              <label className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">From</label>
              <input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="bg-purple-50 border-2 border-purple-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-semibold focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all" />
              <label className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">To</label>
              <input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="bg-purple-50 border-2 border-purple-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-semibold focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all" />
            </div>

            {/* Section header */}
            <div className="flex items-center gap-2 mb-4">
              <Building2 size={14} className="text-purple-500" />
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-800">All Outbound Processes</h2>
              {!loading && (
                <span className="ml-auto text-[11px] font-bold text-slate-500 bg-white border border-slate-200 px-3 py-1 rounded-full shadow-sm">
                  {clients.length} processes · Avg Conv {avgConv}%
                </span>
              )}
            </div>

            {loading ? (
              <div className="flex flex-col gap-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="rounded-2xl bg-white border border-slate-200 px-5 py-4 animate-pulse shadow-sm">
                    <div className="h-4 bg-slate-100 rounded-lg w-1/3 mb-4" />
                    <div className="grid grid-cols-6 gap-2">
                      {[...Array(6)].map((__, j) => <div key={j} className="h-16 bg-slate-100 rounded-xl" />)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-3 w-full">
                {clients.filter((c) => canAccessOutboundClient(c.client_id)).map((c, i) => {
                  const accentColor = CARD_COLORS[i % CARD_COLORS.length];
                  const rate = opsRate(c);
                  return (
                    <div
                      key={c.client_id}
                      onClick={() => navigate(`/quality/${c.client_id}`)}
                      className="group relative bg-white rounded-2xl border-2 border-slate-100 hover:border-purple-300 transition-all duration-200 cursor-pointer hover:-translate-y-0.5 hover:shadow-xl w-full overflow-hidden shadow-sm"
                    >
                      {/* Top color band */}
                      <div className="h-1.5 w-full" style={{ backgroundColor: accentColor }} />
                      <div className="px-5 pt-3 pb-4">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black shadow-sm"
                            style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`, color: '#fff' }}>
                            {(c.client_name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[15px] font-black text-slate-900 truncate" title={c.client_name}>
                              {c.client_name || `Client ${c.client_id}`}
                            </p>
                            <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Click to view full report →</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border"
                              style={{ color: accentColor, backgroundColor: `${accentColor}15`, borderColor: `${accentColor}40` }}>
                              Outbound
                            </span>
                            <ChevronRight size={15} className="text-slate-300 group-hover:text-purple-500 transition-colors" />
                          </div>
                        </div>
                        <div className="grid grid-cols-6 gap-2">
                          <KPIChip icon={PhoneCall}    label="Total Calls"  value={c.total_calls.toLocaleString()}                                                  color="#0EA5E9"              bg="#E0F2FE" />
                          <KPIChip icon={ShoppingCart} label="Sales"        value={c.sales.toLocaleString()}                                                         color="#16A34A"              bg="#DCFCE7" />
                          <KPIChip icon={TrendingUp}   label="Conv. Rate"   value={`${c.conversion_pct}%`}                                                           color={convColor(c.conversion_pct)} bg={convBg(c.conversion_pct)} />
                          <KPIChip icon={Star}         label="NPS Score"    value={c.nps_score > 0 ? `+${c.nps_score}` : String(c.nps_score)}                       color={npsColor(c.nps_score)}      bg={npsBg(c.nps_score)} />
                          <KPIChip icon={ThumbsUp}     label="Positive"     value={c.total_feedback ? `${c.positive_pct}%` : '—'}                                   color={c.total_feedback ? posColor(c.positive_pct) : '#64748B'} bg={c.total_feedback ? posBg(c.positive_pct) : '#F1F5F9'} />
                          <KPIChip icon={Target}       label="Opening Rate" value={c.valid_calls ? `${rate}%` : '—'}                                                 color={c.valid_calls ? (rate >= 70 ? '#16A34A' : rate >= 50 ? '#D97706' : '#DC2626') : '#64748B'} bg={c.valid_calls ? (rate >= 70 ? '#DCFCE7' : rate >= 50 ? '#FEF3C7' : '#FEE2E2') : '#F1F5F9'} />
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
