import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/authStore';
import { useProcessStore } from '@/store/processStore';
import { useUIStore } from '@/store/uiStore';

export default function AppShell() {
  const location = useLocation();
  const { user } = useAuthStore();
  const { loaded, setProcesses, setDashboardSlugs } = useProcessStore();
  const { mobileOpen, toggleMobile, closeMobile } = useUIStore();

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

  // Close mobile sidebar on route change
  useEffect(() => { closeMobile(); }, [location.pathname]);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#C8CDD6' }}>
      {/* Mobile backdrop overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={closeMobile}
          />
        )}
      </AnimatePresence>

      {/* Sidebar — on mobile it's fixed/overlay so it takes no flex space */}
      <Sidebar />

      {/* Main content — takes all available space (sidebar is fixed on mobile, flex on desktop) */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0 w-0">
        {/* Mobile top bar — hamburger + logo */}
        <div
          className="flex md:hidden h-14 items-center px-4 gap-3 flex-shrink-0 shadow-md"
          style={{ background: 'linear-gradient(90deg,#0D47A1,#1565C0)' }}
        >
          <button
            onClick={toggleMobile}
            className="p-2 rounded-xl text-white/80 hover:bg-white/15 transition active:scale-95"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <img src="/Logo.png" alt="MAS" className="h-8 w-8 rounded-xl bg-white object-contain p-0.5 shadow-sm flex-shrink-0" />
            <span className="font-bold text-white text-sm truncate">My Dashboard</span>
          </div>
          {user && (
            <div className="flex-shrink-0">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.name} className="w-8 h-8 rounded-full object-cover border-2 border-white/30" />
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/20 border-2 border-white/30">
                  <span className="text-xs font-bold text-white">{user.name?.charAt(0).toUpperCase()}</span>
                </div>
              )}
            </div>
          )}
        </div>

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
