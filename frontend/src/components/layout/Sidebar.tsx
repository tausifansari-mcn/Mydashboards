import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, Building2, LogOut,
  ChevronLeft, ChevronRight, User, ClipboardList, GitBranch, ShieldCheck,
  PhoneCall, Phone, ChevronDown, BarChart3, Package,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { useProcessStore } from '@/store/processStore';
import { cn } from '@/lib/utils';
import api from '@/lib/axios';

const BLUE      = '#1565C0';
const BLUE_DARK = '#0D47A1';

const mainLinks = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Launcher' },
  { to: '/sales',     icon: Package,         label: 'Sales' },
  { to: '/quality',   icon: BarChart3,       label: 'AI Quality' },
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
  { to: '/admin/clients',   icon: Building2,  label: 'Clients' },
  { to: '/admin/users',     icon: Users,       label: 'Users' },
  { to: '/admin/processes', icon: GitBranch,   label: 'Processes' },
  { to: '/admin/access',    icon: ShieldCheck, label: 'Access' },
];

const accountLinks = [
  { to: '/profile', icon: User,          label: 'Profile' },
  { to: '/audit',   icon: ClipboardList, label: 'Audit Logs' },
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
      className="relative flex h-screen flex-col overflow-hidden flex-shrink-0"
      style={{ background: `linear-gradient(180deg, ${BLUE_DARK} 0%, ${BLUE} 100%)` }}
    >
      {/* Logo */}
      <div
        className="flex h-16 items-center px-3 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', backgroundColor: BLUE_DARK }}
      >
        {!sidebarExpanded && (
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl overflow-hidden bg-white shadow-md">
            <img src="/Logo.png" alt="MAS" className="h-8 w-8 object-contain p-0.5" />
          </div>
        )}
        <AnimatePresence>
          {sidebarExpanded && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-3 whitespace-nowrap w-full"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl overflow-hidden bg-white shadow-md">
                <img src="/Logo.png" alt="MAS" className="h-9 w-9 object-contain p-0.5" />
              </div>
              <div>
                <p className="font-bold text-white text-sm leading-none">My Dashboard</p>
                <p className="text-[10px] font-medium mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  Analytics Platform
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1 scrollbar-thin">
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

      {/* User info */}
      {sidebarExpanded && user && (
        <div className="px-3 py-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
              <span className="text-[11px] font-bold text-white">{user.name?.charAt(0).toUpperCase()}</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user.name}</p>
              <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>{user.email}</p>
            </div>
          </div>
        </div>
      )}

      {/* Logout */}
      <div className="px-2 pb-4 flex-shrink-0">
        <button
          onClick={handleLogout}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
            !sidebarExpanded && 'justify-center'
          )}
          style={{ color: '#ffffff' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#ffffff'; }}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          <AnimatePresence>
            {sidebarExpanded && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm font-medium">
                Logout
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Toggle button */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md z-10 transition-colors hover:bg-blue-50"
        style={{ color: BLUE, border: `1px solid rgba(21,101,192,0.3)` }}
      >
        {sidebarExpanded ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>
    </motion.aside>
  );
}

function SidebarSection({ label, expanded, children }: { label: string; expanded: boolean; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <AnimatePresence>
        {expanded && (
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="mb-1 px-3 text-[9px] font-bold tracking-widest uppercase"
            style={{ color: 'rgba(255,255,255,0.4)' }}
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
        isActive ? 'bg-white font-semibold' : '',
        !expanded && 'justify-center'
      )}
      style={({ isActive }) => isActive
        ? { color: '#ffffff' }
        : { color: '#ffffff' }
      }
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        if (!el.classList.contains('bg-white')) {
          el.style.backgroundColor = 'rgba(255,255,255,0.12)';
          el.style.color = '#fff';
        }
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        if (!el.classList.contains('bg-white')) {
          el.style.backgroundColor = 'transparent';
          el.style.color = '#ffffff';
        }
      }}
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
        className="flex w-full justify-center rounded-lg px-3 py-2 transition-colors"
        style={{
          backgroundColor: isParentActive ? 'rgba(255,255,255,0.18)' : 'transparent',
          color: '#ffffff',
        }}
      >
        <Icon className="h-4 w-4 flex-shrink-0" />
      </button>
    );
  }

  return (
    <div>
      <div
        className="flex items-center rounded-lg transition-all duration-150"
        style={{ backgroundColor: isParentActive ? 'rgba(255,255,255,0.12)' : 'transparent' }}
      >
        <button
          onClick={() => { navigate(parentTo); setOpen(v => !v); }}
          className="flex flex-1 items-center gap-3 px-3 py-2 text-sm"
          style={{ color: '#ffffff' }}
        >
          <Icon className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1 whitespace-nowrap text-left font-medium">{label}</span>
        </button>
        <button
          onClick={() => setOpen(v => !v)}
          className="px-2 py-2 transition-colors"
          style={{ color: 'rgba(255,255,255,0.6)' }}
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
            <div className="ml-3 mt-0.5 pl-2 space-y-0.5 py-1" style={{ borderLeft: '2px solid rgba(255,255,255,0.2)' }}>
              <NavLink
                to={parentTo}
                end
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-all"
                style={({ isActive }) => ({
                  backgroundColor: isActive ? 'rgba(255,255,255,0.18)' : 'transparent',
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.65)',
                  fontWeight: isActive ? 600 : 400,
                })}
              >
                <span className="text-sm">📊</span>
                <span className="whitespace-nowrap">All Projects</span>
              </NavLink>
              {subItems.map((sub) => (
                <NavLink
                  key={sub.to}
                  to={sub.to}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-all"
                  style={({ isActive }) => ({
                    backgroundColor: isActive ? 'rgba(255,255,255,0.18)' : 'transparent',
                    color: isActive ? '#fff' : 'rgba(255,255,255,0.65)',
                    fontWeight: isActive ? 600 : 400,
                  })}
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
