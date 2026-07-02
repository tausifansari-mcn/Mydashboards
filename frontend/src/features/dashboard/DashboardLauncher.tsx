import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Phone, Star, TrendingUp, Users, BarChart2, UserCheck, Lock, BarChart3,
  ArrowRight, Activity, Shield, Zap,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/axios';
import { Dashboard } from '@/types';

const MAS_BLUE  = '#1565C0';
const MAS_GREEN = '#43A832';
const MAS_RED   = '#D32F2F';

const iconMap: Record<string, React.ElementType> = {
  Phone, Star, TrendingUp, Users, BarChart2, UserCheck, BarChart3,
};

const HIDDEN_SLUGS = ['call-master', 'sales'];

const slugToRoute: Record<string, string> = {
  'call-master': '/call-master',
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

export default function DashboardLauncher() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [dashboards, setDashboards]       = useState<Dashboard[]>([]);
  const [allDashboards, setAllDashboards] = useState<Dashboard[]>([]);

  useEffect(() => {
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
  }, []);

  const isAccessible = (slug: string) => dashboards.some((d) => d.slug === slug);
  const accessibleCount = dashboards.filter((d) => d.is_active).length;

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
          {/* AI Quality — always shown if not in API list */}
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
              return (
                <motion.div key={dash.id} variants={item}>
                  <DashCard
                    icon={Icon}
                    name={dash.name}
                    description={dash.description}
                    accessible={accessible}
                    accent={accent}
                    onClick={() => accessible && navigate(slugToRoute[dash.slug] || '/dashboard')}
                  />
                </motion.div>
              );
            })}
        </motion.div>

        {/* ── Sales Dashboards Section ── */}
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
              accessible={isAccessible('sales')}
              accent={CARD_ACCENTS[1]}
              onClick={() => isAccessible('sales') && navigate('/sales')}
            />
          </motion.div>
        </motion.div>

      </div>
    </div>
  );
}

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
