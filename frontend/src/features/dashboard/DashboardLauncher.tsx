import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Phone, Star, TrendingUp, Users, BarChart2, UserCheck, Lock, BarChart3,
  ArrowRight, Activity, Shield, Zap, ChevronRight, LayoutDashboard,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useProcessStore } from '@/store/processStore';
import api from '@/lib/axios';
import { Dashboard } from '@/types';

const MAS_BLUE  = '#1565C0';
const MAS_GREEN = '#43A832';
const MAS_RED   = '#D32F2F';

const iconMap: Record<string, React.ElementType> = {
  Phone, Star, TrendingUp, Users, BarChart2, UserCheck, BarChart3,
};

const HIDDEN_SLUGS = ['sales', 'call-master'];

const slugToRoute: Record<string, string> = {
  quality: '/quality',
  sales: '/sales',
  inbound: '/inbound',
  client: '/client',
  operations: '/operations',
  agent: '/agent',
};

/* Rotating card accent colors using MAS brand palette */
const CARD_ACCENTS = [
  { border: MAS_BLUE,  bg: '#E3F2FD', icon: MAS_BLUE  },
  { border: MAS_GREEN, bg: '#E8F5E9', icon: MAS_GREEN  },
  { border: MAS_RED,   bg: '#FFEBEE', icon: MAS_RED    },
  { border: '#6A1B9A', bg: '#F3E5F5', icon: '#6A1B9A'  },
  { border: '#E65100', bg: '#FFF3E0', icon: '#E65100'  },
  { border: '#00695C', bg: '#E0F2F1', icon: '#00695C'  },
];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

const INBOUND_SLUGS = ['gnc', 'bellavita', 'clovia', 'neemans', 'viega', 'exicom', 'dubangladesh'];

export default function DashboardLauncher() {
  const { user } = useAuthStore();
  const { processes, canAccessInboundSlug, dashboardSlugs, loaded: processLoaded } = useProcessStore();
  const navigate = useNavigate();
  const [dashboards, setDashboards]       = useState<Dashboard[]>([]);
  const [allDashboards, setAllDashboards] = useState<Dashboard[]>([]);
  const redirected = useRef(false);

  const isSuperAdmin = user?.role === 'super_admin';

  // Redirect client users to their first accessible module
  useEffect(() => {
    if (isSuperAdmin || redirected.current || !processLoaded) return;
    redirected.current = true;
    const inboundProjects = INBOUND_SLUGS.filter((s) => canAccessInboundSlug(s));
    if (inboundProjects.length === 1) {
      navigate(`/inbound/${inboundProjects[0]}`, { replace: true });
    } else if (inboundProjects.length > 1) {
      navigate('/inbound', { replace: true });
    } else if (dashboardSlugs.includes('quality')) {
      navigate('/quality', { replace: true });
    } else if (dashboardSlugs.includes('sales')) {
      navigate('/sales', { replace: true });
    }
  }, [isSuperAdmin, processLoaded, canAccessInboundSlug, dashboardSlugs, navigate]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    (async () => {
      try {
        const [myRes, allRes] = await Promise.all([
          api.get<Dashboard[]>('/dashboards/my'),
          api.get<Dashboard[]>('/dashboards'),
        ]);
        setDashboards(myRes.data);
        setAllDashboards(allRes.data);
      } catch { /* ignore */ }
    })();
  }, [isSuperAdmin]);

  const isAccessible = (slug: string) => dashboards.some((d) => d.slug === slug);
  const accessibleCount = isSuperAdmin
    ? dashboards.filter((d) => d.is_active).length
    : dashboards.length;

  // Non-admin: show nothing while redirecting (processLoaded will fire the effect)
  if (!isSuperAdmin) return null;

  return (
    <div className="min-h-full" style={{ background: '#EEF4FF' }}>

      {/* ── MAS Hero Banner ── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${MAS_BLUE} 0%, #1976D2 55%, #0D47A1 100%)` }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full opacity-10" style={{ background: MAS_GREEN }} />
        <div className="absolute -bottom-8 right-48 w-40 h-40 rounded-full opacity-10" style={{ background: MAS_RED }} />
        <div className="absolute top-4 right-4 w-24 h-24 rounded-full opacity-5 bg-white" />

        <div className="relative px-8 py-8 flex items-center justify-between gap-6 flex-wrap">
          {/* Left: Logo + greeting */}
          <div className="flex items-center gap-5">
            <div className="bg-white rounded-2xl p-2 shadow-xl flex-shrink-0" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}>
              <img src="/Logo.png" alt="MAS" className="h-14 w-14 object-contain" />
            </div>
            <div>
              <p className="text-blue-200 text-sm font-semibold uppercase tracking-widest mb-0.5">Mas CallNet Analytics</p>
              <h1 className="text-3xl font-black text-white leading-tight">
                {greeting()}, {user?.name?.split(' ')[0] ?? 'User'} 👋
              </h1>
              <p className="text-blue-200 text-sm font-medium mt-1">Select a dashboard below to start your session</p>
            </div>
          </div>

          {/* Right: Live badge */}
          <div className="flex items-center gap-2 bg-white/15 border border-white/20 rounded-xl px-4 py-2.5 backdrop-blur-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: MAS_GREEN }} />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: MAS_GREEN }} />
            </span>
            <span className="text-white text-xs font-bold">Live Platform</span>
          </div>
        </div>

        {/* Brand color stripe */}
        <div className="flex h-1">
          <div className="flex-1" style={{ background: MAS_GREEN }} />
          <div className="flex-1" style={{ background: MAS_RED }} />
          <div className="flex-1 bg-white/30" />
          <div className="flex-1" style={{ background: MAS_GREEN }} />
          <div className="flex-1" style={{ background: MAS_RED }} />
          <div className="flex-1 bg-white/30" />
        </div>
      </motion.div>

      <div className="px-8 py-7">

        {/* ── Stats Row ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8"
        >
          {[
            { label: 'Dashboards', value: accessibleCount || '—', Icon: BarChart3,  color: MAS_BLUE,  bg: '#E3F2FD' },
            { label: 'Your Role',  value: user?.roleDisplay || '—', Icon: Shield,   color: MAS_GREEN, bg: '#E8F5E9' },
            { label: 'Client',     value: user?.clientName || 'All Process', Icon: Users, color: MAS_RED, bg: '#FFEBEE' },
            { label: 'Platform',   value: 'MAS Analytics',  Icon: Zap,             color: '#6A1B9A', bg: '#F3E5F5' },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl p-4 border-2 flex items-center gap-3 transition-all duration-200 hover:-translate-y-0.5"
              style={{ background: s.bg, borderColor: `${s.color}30`,
                       boxShadow: `0 2px 12px ${s.color}12` }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 24px ${s.color}25`}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = `0 2px 12px ${s.color}12`}
            >
              <div className="p-2.5 rounded-xl shrink-0" style={{ background: `${s.color}18` }}>
                <s.Icon size={18} style={{ color: s.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: s.color }}>{s.label}</p>
                <p className="text-base font-black text-slate-900 truncate mt-0.5">{s.value}</p>
              </div>
            </div>
          ))}
        </motion.div>

        {/* ── Section header ── */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 rounded-full" style={{ background: MAS_BLUE }} />
            <div className="w-1 h-5 rounded-full" style={{ background: MAS_GREEN }} />
            <div className="w-1 h-5 rounded-full" style={{ background: MAS_RED }} />
          </div>
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">Your Dashboards</h2>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, #1565C020, transparent)' }} />
          <div className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border-2"
               style={{ color: MAS_BLUE, background: '#E3F2FD', borderColor: `${MAS_BLUE}30` }}>
            <Activity size={11} />
            {accessibleCount} Active
          </div>
        </div>

        {/* ── Dashboard Grid ── */}
        <motion.div
          variants={container} initial="hidden" animate="visible"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {isSuperAdmin ? (
            /* Super admin: show all dashboards with accessible indicator */
            <>
              {!allDashboards.some(d => d.slug === 'quality') && (
                <motion.div variants={item}>
                  <DashCard
                    icon={BarChart3}
                    name="AI Quality"
                    description="Inbound & outbound quality scoring, fatal analysis, and agent performance."
                    accessible
                    accent={CARD_ACCENTS[0]}
                    onClick={() => navigate('/quality')}
                  />
                </motion.div>
              )}
              {allDashboards
                .filter(d => !HIDDEN_SLUGS.includes(d.slug))
                .map((dash, i) => {
                  const accessible = isAccessible(dash.slug) || dash.slug === 'quality';
                  const Icon = iconMap[dash.icon] || BarChart2;
                  const accent = CARD_ACCENTS[i % CARD_ACCENTS.length];
                  const displayName = dash.slug === 'quality' ? 'AI Quality' : dash.name;
                  const displayDesc = dash.slug === 'quality'
                    ? 'Inbound & outbound quality scoring, fatal analysis, and agent performance.'
                    : dash.description;
                  return (
                    <motion.div key={dash.id} variants={item}>
                      <DashCard
                        icon={dash.slug === 'quality' ? BarChart3 : (iconMap[dash.icon] || BarChart2)}
                        name={displayName}
                        description={displayDesc}
                        accessible={accessible}
                        accent={accent}
                        onClick={() => accessible && navigate(slugToRoute[dash.slug] || '/dashboard')}
                      />
                    </motion.div>
                  );
                })}
            </>
          ) : (
            /* Client users: only show dashboards granted to them */
            <>
              {/* Always show AI Quality if user has quality access */}
              {isAccessible('quality') && (
                <motion.div variants={item}>
                  <DashCard
                    icon={BarChart3}
                    name="AI Quality"
                    description="Inbound & outbound quality scoring, fatal analysis, and agent performance."
                    accessible
                    accent={CARD_ACCENTS[0]}
                    onClick={() => navigate('/quality')}
                  />
                </motion.div>
              )}
              {/* Other granted dashboards (excluding quality shown above, and hidden slugs) */}
              {dashboards
                .filter(d => d.slug !== 'quality' && !HIDDEN_SLUGS.includes(d.slug))
                .map((dash, i) => {
                  const Icon = iconMap[dash.icon] || BarChart2;
                  const accent = CARD_ACCENTS[(i + 1) % CARD_ACCENTS.length];
                  return (
                    <motion.div key={dash.id} variants={item}>
                      <DashCard
                        icon={Icon}
                        name={dash.name}
                        description={dash.description}
                        accessible
                        accent={accent}
                        onClick={() => navigate(slugToRoute[dash.slug] || '/dashboard')}
                      />
                    </motion.div>
                  );
                })}
            </>
          )}
        </motion.div>

        {/* ── Sales Dashboards Section — only shown if user has access ── */}
        {isAccessible('sales') && (
          <>
            <div className="flex items-center gap-3 mt-10 mb-5">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 rounded-full" style={{ background: MAS_GREEN }} />
                <div className="w-1 h-5 rounded-full" style={{ background: MAS_BLUE }} />
              </div>
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">Sales Dashboards</h2>
              <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, #43A83220, transparent)' }} />
            </div>
            <motion.div
              variants={container} initial="hidden" animate="visible"
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              <motion.div variants={item}>
                <DashCard
                  icon={TrendingUp}
                  name="Sales Dashboard"
                  description="Sales funnel, conversion analytics, revenue, and agent performance."
                  accessible
                  accent={CARD_ACCENTS[1]}
                  onClick={() => navigate('/sales')}
                />
              </motion.div>
            </motion.div>
          </>
        )}

      </div>
    </div>
  );
}

// ─── Client Portal ────────────────────────────────────────────────────────────

const SLUG_META: Record<string, { icon: React.ElementType; label: string; desc: string; route: string }> = {
  inbound:    { icon: Phone,       label: 'Inbound Operations', desc: 'Live call metrics, SL%, AL%, ACHT and agent performance.', route: '/inbound' },
  quality:    { icon: BarChart3,   label: 'AI Quality',         desc: 'Quality scoring, fatal analysis and audit trails.',        route: '/quality' },
  sales:      { icon: TrendingUp,  label: 'Sales Dashboard',    desc: 'Sales funnel, revenue and conversion analytics.',          route: '/sales' },
  operations: { icon: Activity,    label: 'Operations',         desc: 'Operational KPIs and performance overview.',               route: '/operations' },
  agent:      { icon: UserCheck,   label: 'Agent Analytics',    desc: 'Agent-level productivity and quality metrics.',            route: '/agent' },
  client:     { icon: Users,       label: 'Client Overview',    desc: 'Client KPIs and business performance summary.',            route: '/client' },
};

const LOB_ICON: Record<string, string> = { Inbound: '📞', Outbound: '📤', 'IB/OB': '🔄' };

interface PortalProps {
  user: { name: string; clientName?: string | null; role?: string } | null;
  dashboards: Dashboard[];
  processes: { id: number; process_name: string; lob: string; dialdesk_client_id: number; client_id: number; is_active: boolean }[];
  navigate: (to: string) => void;
}

const portalContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};
const portalItem = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.38, ease: 'easeOut' } },
};

function ClientPortal({ user, dashboards, processes, navigate }: PortalProps) {
  const firstName  = user?.name?.split(' ')[0] ?? 'User';
  const clientName = user?.clientName ?? 'Operations';
  const visibleDash = dashboards.filter((d) => d.slug !== 'call-master');

  const h = new Date().getHours();
  const greet = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';

  return (
    <div className="min-h-full" style={{ background: '#EEF4FF' }}>

      {/* ── Hero ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, #0D2B6B 0%, #1565C0 55%, #1976D2 100%)` }}
      >
        {/* Decorative shapes */}
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-[0.07]" style={{ background: MAS_GREEN }} />
        <div className="absolute -bottom-10 right-60 w-48 h-48 rounded-full opacity-[0.07]" style={{ background: MAS_RED }} />
        <svg className="absolute bottom-0 left-0 w-full opacity-[0.04]" viewBox="0 0 1200 80" preserveAspectRatio="none">
          <path d="M0,40 C300,80 900,0 1200,40 L1200,80 L0,80 Z" fill="white" />
        </svg>

        <div className="relative px-8 py-10 max-w-6xl mx-auto">
          <div className="flex items-center justify-between flex-wrap gap-6">
            {/* Left */}
            <div className="flex items-center gap-5">
              <div className="bg-white rounded-2xl p-2 shadow-2xl flex-shrink-0" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
                <img src="/Logo.png" alt="MAS" className="h-14 w-14 object-contain" />
              </div>
              <div>
                <p className="text-blue-300 text-xs font-bold uppercase tracking-widest mb-1">{clientName} Analytics Hub</p>
                <h1 className="text-3xl font-black text-white leading-tight">
                  {greet}, {firstName} 👋
                </h1>
                <p className="text-blue-200 text-sm mt-1.5 font-medium">Your workspace is ready — select a module to begin</p>
              </div>
            </div>

            {/* Right: stats chips */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 backdrop-blur-sm">
                <LayoutDashboard size={14} className="text-blue-200" />
                <span className="text-white text-sm font-bold">{visibleDash.length} Modules</span>
              </div>
              {processes.length > 0 && (
                <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 backdrop-blur-sm">
                  <Phone size={14} className="text-blue-200" />
                  <span className="text-white text-sm font-bold">{processes.length} Process{processes.length > 1 ? 'es' : ''}</span>
                </div>
              )}
              <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 backdrop-blur-sm">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: MAS_GREEN }} />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: MAS_GREEN }} />
                </span>
                <span className="text-white text-xs font-bold">Live</span>
              </div>
            </div>
          </div>
        </div>

        {/* Color stripe */}
        <div className="flex h-[3px]">
          {[MAS_GREEN, MAS_RED, 'rgba(255,255,255,0.3)', MAS_GREEN, MAS_RED, 'rgba(255,255,255,0.3)'].map((c, i) => (
            <div key={i} className="flex-1" style={{ background: c }} />
          ))}
        </div>
      </motion.div>

      <div className="px-8 py-8 max-w-6xl mx-auto">

        {/* ── Module Access ── */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex gap-1">
            {[MAS_BLUE, MAS_GREEN, MAS_RED].map((c) => <div key={c} className="w-1 h-5 rounded-full" style={{ background: c }} />)}
          </div>
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-700">Your Modules</h2>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, #1565C020, transparent)' }} />
        </div>

        <motion.div
          variants={portalContainer} initial="hidden" animate="visible"
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 mb-10"
        >
          {visibleDash.map((dash, i) => {
            const meta  = SLUG_META[dash.slug];
            const Icon  = meta?.icon ?? BarChart2;
            const label = meta?.label ?? dash.name;
            const desc  = meta?.desc  ?? dash.description;
            const route = meta?.route ?? slugToRoute[dash.slug] ?? '/dashboard';
            const accent = CARD_ACCENTS[i % CARD_ACCENTS.length];
            return (
              <motion.div key={dash.id} variants={portalItem}>
                <motion.div
                  whileHover={{ y: -6, boxShadow: `0 20px 48px ${accent.border}28` }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(route)}
                  className="relative bg-white rounded-2xl overflow-hidden cursor-pointer"
                  style={{ border: `2px solid ${accent.border}25`, borderTopWidth: 5, borderTopColor: accent.border }}
                >
                  <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                       style={{ background: `linear-gradient(145deg, ${accent.border}06, transparent)` }} />
                  <div className="relative p-6">
                    <div className="mb-5 flex items-center justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm"
                           style={{ background: accent.bg, border: `2px solid ${accent.border}20` }}>
                        <Icon size={22} style={{ color: accent.icon }} />
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full"
                           style={{ color: accent.border, background: accent.bg }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent.border }} />
                        Active
                      </div>
                    </div>
                    <h3 className="text-base font-black text-slate-900 mb-2">{label}</h3>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed mb-5">{desc}</p>
                    <div className="flex items-center gap-1.5 text-xs font-black" style={{ color: accent.border }}>
                      Open Module <ChevronRight size={13} />
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-[3px]"
                       style={{ background: `linear-gradient(90deg, ${accent.border}, ${accent.border}30)` }} />
                </motion.div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* ── Assigned Processes ── */}
        {processes.length > 0 && (
          <>
            <div className="flex items-center gap-3 mb-5">
              <div className="flex gap-1">
                {[MAS_GREEN, MAS_BLUE].map((c) => <div key={c} className="w-1 h-5 rounded-full" style={{ background: c }} />)}
              </div>
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-700">Your Assigned Processes</h2>
              <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, #43A83220, transparent)' }} />
            </div>
            <motion.div
              variants={portalContainer} initial="hidden" animate="visible"
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
            >
              {processes.map((proc, i) => (
                <motion.div key={proc.id} variants={portalItem}>
                  <div className="bg-white rounded-xl border-2 p-4 flex items-center gap-4 hover:-translate-y-0.5 transition-all duration-200"
                       style={{ borderColor: `${MAS_GREEN}30`, boxShadow: `0 2px 12px ${MAS_GREEN}10` }}>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0 text-lg"
                         style={{ background: `${MAS_BLUE}12` }}>
                      {LOB_ICON[proc.lob] ?? '📊'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{proc.process_name}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block"
                            style={{ background: `${MAS_GREEN}15`, color: MAS_GREEN }}>
                        {proc.lob}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Super-Admin Dash Card ─────────────────────────────────────────────────────

function DashCard({
  icon: Icon, name, description, accessible, accent, onClick,
}: {
  icon: React.ElementType;
  name: string;
  description?: string;
  accessible: boolean;
  accent: { border: string; bg: string; icon: string };
  onClick?: () => void;
}) {
  return (
    <motion.div
      whileHover={accessible ? { y: -5, boxShadow: `0 16px 40px ${accent.border}28` } : {}}
      whileTap={accessible ? { scale: 0.98 } : {}}
      onClick={onClick}
      className={`relative bg-white rounded-2xl overflow-hidden transition-all duration-200 ${accessible ? 'cursor-pointer' : 'cursor-not-allowed opacity-55'}`}
      style={{ border: `2px solid ${accessible ? accent.border + '30' : '#E2E8F0'}`,
               borderTopWidth: 4, borderTopColor: accessible ? accent.border : '#CBD5E1' }}
    >
      {/* Hover tint */}
      {accessible && (
        <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none"
             style={{ background: `linear-gradient(145deg, ${accent.border}06, transparent)` }} />
      )}

      <div className="relative p-6">
        {/* Icon */}
        <div className="mb-4 flex h-13 w-13 items-center justify-center rounded-2xl shadow-sm"
             style={{ background: accessible ? accent.bg : '#F1F5F9',
                      border: `2px solid ${accessible ? accent.border + '25' : '#E2E8F0'}` }}>
          <Icon size={24} style={{ color: accessible ? accent.icon : '#94A3B8' }} />
        </div>

        {/* Text */}
        <h3 className="text-base font-black text-slate-900 mb-1.5">{name}</h3>
        {description && (
          <p className="text-xs text-slate-600 font-medium leading-relaxed mb-4">{description}</p>
        )}

        {/* Footer */}
        {accessible ? (
          <div className="flex items-center gap-1.5 text-xs font-black" style={{ color: accent.border }}>
            Open Dashboard <ArrowRight size={12} />
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold">
            <Lock size={11} /> No access assigned
          </div>
        )}
      </div>

      {/* Bottom gradient bar */}
      {accessible && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px]"
             style={{ background: `linear-gradient(90deg, ${accent.border}, ${accent.border}40)` }} />
      )}
    </motion.div>
  );
}
