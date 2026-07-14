import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './Sidebar';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/authStore';
import { useProcessStore } from '@/store/processStore';

export default function AppShell() {
  const location = useLocation();
  const { user } = useAuthStore();
  const { loaded, setProcesses, setDashboardSlugs } = useProcessStore();

  useEffect(() => {
    if (user && !loaded) {
      Promise.all([
        api.get('/processes/my'),
        api.get<{ id: number; slug: string }[]>('/dashboards/my'),
      ]).then(([procRes, dashRes]) => {
        setProcesses(procRes.data, user.role === 'super_admin');
        setDashboardSlugs(dashRes.data.map((d) => d.slug));
      }).catch(() => {
        setProcesses([], user?.role === 'super_admin');
        setDashboardSlugs([]);
      });
    }
  }, [user, loaded, setProcesses, setDashboardSlugs]);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#C8CDD6' }}>
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto" style={{ background: '#C8CDD6' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
