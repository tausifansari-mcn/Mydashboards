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
  const { loaded, setProcesses } = useProcessStore();

  useEffect(() => {
    if (user && !loaded) {
      api.get('/processes/my')
        .then((r) => setProcesses(r.data, user.role === 'super_admin'))
        .catch(() => setProcesses([], user?.role === 'super_admin'));
    }
  }, [user, loaded, setProcesses]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">
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
