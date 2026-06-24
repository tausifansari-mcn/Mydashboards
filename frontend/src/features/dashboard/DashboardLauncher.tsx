import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Phone, Star, TrendingUp, Users, BarChart2, UserCheck, Lock,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/axios';
import { Dashboard } from '@/types';

const iconMap: Record<string, React.ElementType> = {
  Phone, Star, TrendingUp, Users, BarChart2, UserCheck,
};

const slugToRoute: Record<string, string> = {
  'call-master': '/call-master',
  quality: '/quality',
  sales: '/sales',
  client: '/client',
  operations: '/operations',
  agent: '/agent',
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const container = {
  hidden: {}, visible: { transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export default function DashboardLauncher() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
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

  return (
    <div className="min-h-full p-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800">
          {greeting()}, {user?.name?.split(' ')[0]} 👋
        </h2>
        <p className="mt-1 text-sm text-slate-500">Select a dashboard to get started</p>
      </motion.div>

      {/* Stats row */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
        className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4"
      >
        {[
          { label: 'Dashboards Available', value: dashboards.filter((d) => d.is_active).length, color: 'bg-blue-50 text-blue-700' },
          { label: 'Your Role', value: user?.roleDisplay || '—', color: 'bg-amber-50 text-amber-700' },
          { label: 'Client', value: user?.clientName || 'All Clients', color: 'bg-emerald-50 text-emerald-700' },
          { label: 'Platform', value: 'My Dashboard', color: 'bg-violet-50 text-violet-700' },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl p-4 ${s.color}`}>
            <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{s.label}</p>
            <p className="mt-1 text-lg font-bold">{s.value}</p>
          </div>
        ))}
      </motion.div>

      {/* Dashboard grid */}
      <motion.div
        variants={container} initial="hidden" animate="visible"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {allDashboards.map((dash) => {
          const accessible = isAccessible(dash.slug);
          const Icon = iconMap[dash.icon] || BarChart2;
          return (
            <motion.div key={dash.id} variants={item}>
              <motion.div
                whileHover={accessible ? { y: -4, boxShadow: '0 12px 32px rgba(30,64,175,0.12)' } : {}}
                whileTap={accessible ? { scale: 0.98 } : {}}
                onClick={() => accessible && navigate(slugToRoute[dash.slug] || '/dashboard')}
                className={`relative rounded-xl border bg-white p-6 transition-all duration-200 ${
                  accessible
                    ? 'cursor-pointer border-primary/30 hover:border-primary shadow-sm'
                    : 'cursor-not-allowed border-slate-200 opacity-50'
                }`}
              >
                <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${accessible ? 'bg-primary/10' : 'bg-slate-100'}`}>
                  <Icon className={`h-6 w-6 ${accessible ? 'text-primary' : 'text-slate-400'}`} />
                </div>
                <h3 className="font-bold text-slate-800">{dash.name}</h3>
                <p className="mt-1 text-xs text-slate-500">{dash.description}</p>
                {!accessible && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
                    <Lock className="h-3 w-3" /> No access assigned
                  </div>
                )}
                {accessible && (
                  <div className="mt-3 text-xs font-semibold text-primary">Open dashboard →</div>
                )}
              </motion.div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
