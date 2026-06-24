import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, Building2, LogOut,
  ChevronLeft, ChevronRight, User, ClipboardList, GitBranch, ShieldCheck, PhoneCall,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';
import api from '@/lib/axios';

const mainLinks = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Launcher' },
  { to: '/call-master', icon: PhoneCall, label: 'Call Master' },
];

const adminLinks = [
  { to: '/admin/clients', icon: Building2, label: 'Clients' },
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/processes', icon: GitBranch, label: 'Processes' },
  { to: '/admin/access', icon: ShieldCheck, label: 'Access' },
];

const accountLinks = [
  { to: '/profile', icon: User, label: 'Profile' },
  { to: '/audit', icon: ClipboardList, label: 'Audit Logs' },
];

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const { sidebarExpanded, toggleSidebar } = useUIStore();
  const navigate = useNavigate();
  const isSuperAdmin = user?.role === 'super_admin';

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    logout();
    navigate('/login');
  };

  return (
    <motion.aside
      animate={{ width: sidebarExpanded ? 240 : 64 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="relative flex h-screen flex-col bg-[#0F172A] overflow-hidden flex-shrink-0"
    >
      {/* Logo */}
      <div className="flex h-16 items-center px-4 border-b border-white/10">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg overflow-hidden bg-white/5">
          <img src="/mas-call-logo.png" alt="MAS Call" className="h-7 w-7 object-contain" />
        </div>
        <AnimatePresence>
          {sidebarExpanded && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="ml-3 font-bold text-white text-sm whitespace-nowrap"
            >
              My Dashboard
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        <SidebarSection label="MAIN" expanded={sidebarExpanded}>
          {mainLinks.map((l) => <SidebarLink key={l.to} {...l} expanded={sidebarExpanded} />)}
        </SidebarSection>

        {isSuperAdmin && (
          <SidebarSection label="ADMIN" expanded={sidebarExpanded}>
            {adminLinks.map((l) => <SidebarLink key={l.to} {...l} expanded={sidebarExpanded} />)}
          </SidebarSection>
        )}

        <SidebarSection label="ACCOUNT" expanded={sidebarExpanded}>
          {accountLinks.filter(l => isSuperAdmin || l.to !== '/audit').map((l) => (
            <SidebarLink key={l.to} {...l} expanded={sidebarExpanded} />
          ))}
        </SidebarSection>
      </nav>

      {/* Logout */}
      <div className="px-2 pb-4">
        <button
          onClick={handleLogout}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-red-400 hover:bg-red-500/10 transition-colors',
            !sidebarExpanded && 'justify-center'
          )}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          <AnimatePresence>
            {sidebarExpanded && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm">
                Logout
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Toggle button */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full bg-[#1E40AF] text-white shadow-lg z-10"
      >
        {sidebarExpanded ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>
    </motion.aside>
  );
}

function SidebarSection({ label, expanded, children }: { label: string; expanded: boolean; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <AnimatePresence>
        {expanded && (
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="mb-1 px-3 text-[10px] font-bold tracking-widest text-slate-500 uppercase"
          >
            {label}
          </motion.p>
        )}
      </AnimatePresence>
      {children}
    </div>
  );
}

function SidebarLink({ to, icon: Icon, label, expanded }: { to: string; icon: React.ElementType; label: string; expanded: boolean }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150',
        isActive ? 'bg-primary text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white',
        !expanded && 'justify-center'
      )}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      <AnimatePresence>
        {expanded && (
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="whitespace-nowrap">
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </NavLink>
  );
}
