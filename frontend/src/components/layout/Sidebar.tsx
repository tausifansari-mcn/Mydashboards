import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, Building2, LogOut,
  ChevronLeft, ChevronRight, User, ClipboardList, GitBranch, ShieldCheck,
  PhoneCall, TrendingUp, Phone, ChevronDown, BarChart3,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { useProcessStore } from '@/store/processStore';
import { cn } from '@/lib/utils';
import api from '@/lib/axios';

const mainLinks = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Launcher' },
  // { to: '/call-master', icon: PhoneCall, label: 'Call Master' },  // hidden
  // { to: '/sales', icon: TrendingUp, label: 'Sales' },             // hidden
  { to: '/quality', icon: BarChart3, label: 'AI Quality' },
];

const ALL_INBOUND_PROJECTS = [
  { to: '/inbound/gnc',          slug: 'gnc',          icon: '🛒', label: 'GNC' },
  { to: '/inbound/bellavita',    slug: 'bellavita',    icon: '🌸', label: 'Bellavita' },
  { to: '/inbound/clovia',       slug: 'clovia',       icon: '👗', label: 'Clovia' },
  { to: '/inbound/neemans',      slug: 'neemans',      icon: '👟', label: 'Neemans' },
  { to: '/inbound/viega',        slug: 'viega',        icon: '🚰', label: 'Viega' },
  { to: '/inbound/exicom',       slug: 'exicom',       icon: '⚡', label: 'Exicom' },
  { to: '/inbound/dubangladesh', slug: 'dubangladesh', icon: '🇧🇩', label: 'DU Bangladesh' },
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
  const { canAccessInboundSlug } = useProcessStore();
  const navigate = useNavigate();
  const isSuperAdmin = user?.role === 'super_admin';

  const inboundProjects = ALL_INBOUND_PROJECTS.filter((p) => canAccessInboundSlug(p.slug));

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
          <SidebarExpandableItem
            icon={Phone}
            label="Inbound"
            parentTo="/inbound"
            subItems={inboundProjects}
            sidebarExpanded={sidebarExpanded}
          />
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
      end
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

function SidebarExpandableItem({
  icon: Icon,
  label,
  parentTo,
  subItems,
  sidebarExpanded,
}: {
  icon: React.ElementType;
  label: string;
  parentTo: string;
  subItems: Array<{ to: string; icon: string; label: string }>;
  sidebarExpanded: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const isParentActive = location.pathname.startsWith(parentTo);
  const [open, setOpen] = useState(isParentActive);

  useEffect(() => {
    if (isParentActive) setOpen(true);
  }, [location.pathname, isParentActive]);

  if (!sidebarExpanded) {
    return (
      <button
        onClick={() => navigate(parentTo)}
        className={cn(
          'flex w-full justify-center rounded-lg px-3 py-2 transition-colors',
          isParentActive ? 'bg-primary text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'
        )}
      >
        <Icon className="h-4 w-4 flex-shrink-0" />
      </button>
    );
  }

  return (
    <div>
      <div className={cn(
        'flex items-center rounded-lg transition-all duration-150',
        isParentActive ? 'bg-primary/20' : 'hover:bg-white/5'
      )}>
        <button
          onClick={() => { navigate(parentTo); setOpen(v => !v); }}
          className={cn(
            'flex flex-1 items-center gap-3 px-3 py-2 text-sm',
            isParentActive ? 'text-white' : 'text-slate-400 hover:text-white'
          )}
        >
          <Icon className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1 whitespace-nowrap text-left">{label}</span>
        </button>
        <button
          onClick={() => setOpen(v => !v)}
          className={cn('px-2 py-2 transition-colors', isParentActive ? 'text-white/70' : 'text-slate-500 hover:text-white')}
        >
          <ChevronDown className={cn('h-3 w-3 transition-transform duration-200', open && 'rotate-180')} />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="ml-3 mt-0.5 border-l border-white/10 pl-2 space-y-0.5 py-1">
              <NavLink
                to={parentTo}
                end
                className={({ isActive }) => cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-all',
                  isActive ? 'bg-primary text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                )}
              >
                <span className="text-sm">📊</span>
                <span className="whitespace-nowrap">All Projects</span>
              </NavLink>
              {subItems.map((sub) => (
                <NavLink
                  key={sub.to}
                  to={sub.to}
                  className={({ isActive }) => cn(
                    'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-all',
                    isActive ? 'bg-primary text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  )}
                >
                  <span className="text-sm">{sub.icon}</span>
                  <span className="whitespace-nowrap">{sub.label}</span>
                </NavLink>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
