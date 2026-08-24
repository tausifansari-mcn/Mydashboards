import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, ShieldCheck, ShieldOff, Loader2, GitBranch, LayoutDashboard, TrendingUp, Upload, ChevronLeft, PanelLeftClose, PanelLeftOpen, UploadCloud, AlertTriangle } from 'lucide-react';
import api from '@/lib/axios';
import { User, Dashboard, PaginatedResponse } from '@/types';

interface AccessRow   { dashboard: Dashboard; can_export: boolean }
interface ProcessItem { id: number; process_name: string; lob: string; dialdesk_client_id: number; client_id: number; is_active: boolean; client?: { name: string } }
interface MappingItem { process: ProcessItem }
interface CallRecProcess { id: number; name: string; parentId: number | null; campaigns?: CallRecProcess[] }

const LOB_COLOR: Record<string, { bg: string; text: string }> = {
  Inbound:  { bg: '#EFF6FF', text: '#1D4ED8' },
  Outbound: { bg: '#FFFBEB', text: '#D97706' },
  'IB/OB':  { bg: '#F5F3FF', text: '#7C3AED' },
};

const SALE_BRANDS = [
  { key: 'bellavita', label: 'Bellavita', desc: 'Bellavita sales dashboard & data uploader', color: '#1A1A1A', bg: '#F0F0F0' },
  { key: 'gnc',       label: 'GNC',       desc: 'GNC sales dashboard & data uploader',       color: '#ED1C24', bg: '#FFE0E0' },
  { key: 'neemans',   label: 'Neemans',   desc: 'Neemans cart data uploader',                color: '#2D6A4F', bg: '#D8F3DC' },
];

export default function AccessPage() {
  const [users,      setUsers]      = useState<User[]>([]);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [processes,  setProcesses]  = useState<ProcessItem[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [access,     setAccess]     = useState<AccessRow[]>([]);
  const [userProcs,  setUserProcs]  = useState<number[]>([]);
  const [saleBrands,    setSaleBrands]    = useState<string[]>([]);
  const [uploaderBrands, setUploaderBrands] = useState<string[]>([]);
  const [callRecCatalog, setCallRecCatalog] = useState<CallRecProcess[]>([]);
  const [callRecCatalogError, setCallRecCatalogError] = useState('');
  const [userCallRecProcs, setUserCallRecProcs] = useState<number[]>([]);
  const [callRecSaving, setCallRecSaving] = useState<number | null>(null);
  const [search,        setSearch]        = useState('');
  const [tab,           setTab]           = useState<'dashboards' | 'processes'>('dashboards');
  // Mobile: only one of the two panels is visible at a time. Desktop always shows both
  // side-by-side (the md:flex / md:hidden pairs below override this state entirely at md+),
  // so it's safe to flip this on every selection without checking viewport size in JS.
  const [showUserList,  setShowUserList]  = useState(true);
  const [loading,       setLoading]       = useState(false);
  const [saving,        setSaving]        = useState<number | null>(null);
  const [procSaving,    setProcSaving]    = useState<number | null>(null);
  const [brandSaving,   setBrandSaving]   = useState<string | null>(null);
  const [uploaderSaving, setUploaderSaving] = useState<string | null>(null);

  useEffect(() => {
    // Independent per-request error handling — previously one Promise.all with no catch at all
    // meant a single failed request (e.g. a transient DB hiccup) silently left users/dashboards/
    // processes all empty forever, with the Access page rendering as if nothing existed.
    api.get<PaginatedResponse<User>>('/users', { params: { limit: 100 } })
      .then((u) => setUsers(u.data.data)).catch(() => {});
    api.get<Dashboard[]>('/dashboards')
      .then((d) => setDashboards(d.data)).catch(() => {});
    api.get<ProcessItem[]>('/processes')
      .then((p) => setProcesses(p.data)).catch(() => {});
    // Call Rec UI is a separate app — this hits it through the backend, so it can fail
    // independently (e.g. Call Rec UI down) without breaking anything else on this page.
    api.get<CallRecProcess[]>('/users/callrec/processes')
      .then((p) => setCallRecCatalog(p.data))
      .catch(() => setCallRecCatalogError('Call Rec UI is currently unreachable — process access can’t be managed right now.'));
  }, []);

  const loadUser = async (user: User) => {
    setSelectedUser(user);
    // Auto-switch to the detail view only on mobile-sized viewports — on desktop the list stays
    // put so you can click through users quickly; the collapse toggle there is manual-only.
    if (window.innerWidth < 768) setShowUserList(false);
    setLoading(true);
    try {
      const [dashRes, procRes, brandRes, uploaderRes, callRecRes] = await Promise.allSettled([
        api.get<AccessRow[]>(`/dashboards/user/${user.id}/access`),
        api.get<MappingItem[]>(`/processes/user/${user.id}`),
        api.get<string[]>(`/users/${user.id}/sale-brands`),
        api.get<string[]>(`/users/${user.id}/sale-uploader-brands`),
        api.get<number[]>(`/users/${user.id}/callrec-processes`),
      ]);
      setAccess(dashRes.status === 'fulfilled' ? dashRes.value.data : []);
      setUserProcs(procRes.status === 'fulfilled' ? procRes.value.data.map((m) => m.process.id) : []);
      setSaleBrands(brandRes.status === 'fulfilled' ? brandRes.value.data : []);
      setUploaderBrands(uploaderRes.status === 'fulfilled' ? uploaderRes.value.data : []);
      setUserCallRecProcs(callRecRes.status === 'fulfilled' ? callRecRes.value.data : []);
    } finally { setLoading(false); }
  };

  const hasAccess    = (dashId: number)  => access.some((a) => a.dashboard.id === dashId);
  const hasProcess   = (procId: number)  => userProcs.includes(procId);

  const toggleAccess = async (dashId: number) => {
    if (!selectedUser) return;
    setSaving(dashId);
    try {
      if (hasAccess(dashId)) {
        await api.delete('/dashboards/revoke', { data: { user_id: selectedUser.id, dashboard_id: dashId } });
        setAccess(access.filter((a) => a.dashboard.id !== dashId));
      } else {
        await api.post('/dashboards/grant', { user_id: selectedUser.id, dashboard_id: dashId, can_export: false });
        const dash = dashboards.find((d) => d.id === dashId)!;
        setAccess([...access, { dashboard: dash, can_export: false }]);
      }
    } finally { setSaving(null); }
  };

  const toggleProcess = async (procId: number) => {
    if (!selectedUser) return;
    setProcSaving(procId);
    try {
      if (hasProcess(procId)) {
        await api.delete('/processes/unassign-user', { data: { user_id: selectedUser.id, process_id: procId } });
        setUserProcs(userProcs.filter((id) => id !== procId));
      } else {
        await api.post('/processes/assign-user', { user_id: selectedUser.id, process_id: procId });
        setUserProcs([...userProcs, procId]);
      }
    } finally { setProcSaving(null); }
  };

  const toggleBrand = async (brandKey: string) => {
    if (!selectedUser) return;
    setBrandSaving(brandKey);
    try {
      const next = saleBrands.includes(brandKey)
        ? saleBrands.filter((b) => b !== brandKey)
        : [...saleBrands, brandKey];
      await api.put(`/users/${selectedUser.id}/sale-brands`, { brands: next });
      setSaleBrands(next);
    } finally { setBrandSaving(null); }
  };

  const hasSalesAccess = access.some((a) => a.dashboard.slug === 'sales');
  const hasCallRecAccess = access.some((a) => a.dashboard.slug === 'call-rec');

  // Toggling here calls through to Call Rec UI's own backend (creating/updating its account for
  // this user, keyed by email) — it's not just a local flag, it actually changes what that
  // person sees the next time they log into Call Rec UI.
  const toggleCallRecProcess = async (procId: number) => {
    if (!selectedUser) return;
    setCallRecSaving(procId);
    try {
      const next = userCallRecProcs.includes(procId)
        ? userCallRecProcs.filter((id) => id !== procId)
        : [...userCallRecProcs, procId];
      await api.put(`/users/${selectedUser.id}/callrec-processes`, { processIds: next });
      setUserCallRecProcs(next);
    } catch {
      // leave state as-is on failure so the toggle doesn't silently claim success
    } finally { setCallRecSaving(null); }
  };

  const toggleUploaderBrand = async (brandKey: string) => {
    if (!selectedUser) return;
    setUploaderSaving(brandKey);
    try {
      const next = uploaderBrands.includes(brandKey)
        ? uploaderBrands.filter((b) => b !== brandKey)
        : [...uploaderBrands, brandKey];
      await api.put(`/users/${selectedUser.id}/sale-uploader-brands`, { brands: next });
      setUploaderBrands(next);
    } finally { setUploaderSaving(null); }
  };

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  const activeProcs   = userProcs.length;
  const activeDashes  = access.length;

  return (
    <div className="flex h-full gap-0 overflow-hidden">
      {/* ── User list panel — full-width on mobile when shown, fixed-width sidebar on desktop.
           No `md:flex` override here on purpose: showUserList must control visibility at every
           breakpoint so the desktop collapse toggle actually does something, not just mobile. ── */}
      <div className={`${showUserList ? 'flex' : 'hidden'} w-full md:w-72 flex-shrink-0 border-r border-slate-200 bg-white flex-col`}>
        <div className="p-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-800">Select User</h3>
            {/* Manual hide/unhide toggle — desktop only; on mobile the panel already swaps
                automatically on selection, and this collapses the sidebar to give the access
                cards the full width instead of squeezing them into a sliver next to the list. */}
            <button onClick={() => setShowUserList(false)}
              title="Hide user list"
              className="hidden md:flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..."
              className="flex-1 text-sm outline-none bg-transparent" />
          </div>
        </div>
        <div className="overflow-y-auto flex-1">
          {filteredUsers.map((u) => (
            <button key={u.id} onClick={() => loadUser(u)}
              className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${selectedUser?.id === u.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}>
              <p className="font-semibold text-sm text-slate-800">{u.name}</p>
              <p className="text-xs text-slate-500 truncate">{u.email}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Collapsed-sidebar reopen tab — desktop only, appears when the list is hidden */}
      {!showUserList && (
        <button onClick={() => setShowUserList(true)}
          title="Show user list"
          className="hidden md:flex flex-shrink-0 w-8 items-center justify-center border-r border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-primary transition-colors">
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      )}

      {/* ── Right panel — full-width on mobile when the list is hidden ── */}
      <div className={`${showUserList ? 'hidden' : 'flex'} md:flex flex-1 flex-col bg-[#F8FAFC] overflow-hidden min-w-0`}>
        {!selectedUser ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-slate-400">
              <ShieldCheck className="mx-auto h-12 w-12 mb-3 opacity-30" />
              <p className="font-medium">Select a user to manage access</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-0 border-b border-slate-200 bg-white flex-shrink-0">
              {/* Back to list — mobile only */}
              <button onClick={() => setShowUserList(true)}
                className="flex md:hidden items-center gap-1 text-xs font-semibold text-slate-500 hover:text-primary mb-3">
                <ChevronLeft className="h-3.5 w-3.5" /> All Users
              </button>
              <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-800 truncate">{selectedUser.name}</h2>
                  <p className="text-sm text-slate-500 truncate">{selectedUser.email} · {selectedUser.roleDisplay}</p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 text-xs flex-shrink-0">
                  <span className="px-2.5 py-1 rounded-full font-semibold bg-blue-50 text-blue-700 whitespace-nowrap">{activeDashes} Dashboard{activeDashes !== 1 ? 's' : ''}</span>
                  <span className="px-2.5 py-1 rounded-full font-semibold bg-purple-50 text-purple-700 whitespace-nowrap">{activeProcs} Process{activeProcs !== 1 ? 'es' : ''}</span>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1">
                {[
                  { id: 'dashboards' as const, label: 'Dashboard Access', icon: LayoutDashboard },
                  { id: 'processes'  as const, label: 'Process Access',   icon: GitBranch },
                ].map(({ id, label, icon: Icon }) => (
                  <button key={id} onClick={() => setTab(id)}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
                      tab === id
                        ? 'border-primary text-primary bg-primary/5'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}>
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {loading ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : tab === 'dashboards' ? (
                /* ── Dashboard Access ── */
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {dashboards.map((dash) => {
                    const granted = hasAccess(dash.id);
                    return (
                      <motion.div key={dash.id} whileHover={{ y: -2 }}
                        className={`rounded-xl border bg-white p-4 shadow-sm transition-all ${granted ? 'border-primary/30' : 'border-slate-200'}`}>
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 pr-2">
                            <p className="font-semibold text-slate-800 truncate">{dash.name}</p>
                            <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{dash.description}</p>
                          </div>
                          <button onClick={() => toggleAccess(dash.id)} disabled={saving === dash.id}
                            className={`rounded-lg p-2 shrink-0 transition-colors ${granted ? 'bg-primary/10 text-primary hover:bg-red-50 hover:text-red-600' : 'bg-slate-100 text-slate-400 hover:bg-primary/10 hover:text-primary'}`}>
                            {saving === dash.id ? <Loader2 className="h-4 w-4 animate-spin" /> : granted ? <ShieldCheck className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
                          </button>
                        </div>
                        <div className={`mt-3 text-xs font-semibold ${granted ? 'text-primary' : 'text-slate-400'}`}>
                          {granted ? '✓ Access granted' : 'No access'}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                /* ── Process Access ── */
                <div className="space-y-8">
                  <div>
                    <p className="text-xs text-slate-500 mb-4">
                      Toggle the processes this user can access. Enabled processes appear in their Inbound sidebar and restrict their data view.
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {processes.filter((p) => p.is_active).map((proc) => {
                        const assigned = hasProcess(proc.id);
                        const lob = LOB_COLOR[proc.lob] ?? { bg: '#F8FAFC', text: '#64748B' };
                        return (
                          <motion.div key={proc.id} whileHover={{ y: -2 }}
                            className={`rounded-xl border bg-white p-4 shadow-sm transition-all ${assigned ? 'border-purple-300' : 'border-slate-200'}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-800 truncate">{proc.process_name}</p>
                                <p className="text-xs text-slate-500 mt-0.5 truncate">{proc.client?.name ?? `Client #${proc.client_id}`}</p>
                                <span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full"
                                      style={{ background: lob.bg, color: lob.text }}>
                                  {proc.lob}
                                </span>
                              </div>
                              <button onClick={() => toggleProcess(proc.id)} disabled={procSaving === proc.id}
                                className={`rounded-lg p-2 shrink-0 transition-colors ${assigned ? 'bg-purple-100 text-purple-700 hover:bg-red-50 hover:text-red-600' : 'bg-slate-100 text-slate-400 hover:bg-purple-100 hover:text-purple-700'}`}>
                                {procSaving === proc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : assigned ? <ShieldCheck className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
                              </button>
                            </div>
                            <div className={`mt-3 text-xs font-semibold ${assigned ? 'text-purple-700' : 'text-slate-400'}`}>
                              {assigned ? '✓ Process assigned' : 'Not assigned'}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Sales Dashboard Brand Access ── */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="h-4 w-4 text-emerald-600" />
                      <h3 className="text-sm font-bold text-slate-800">Sales Dashboard Brand Access</h3>
                      {!hasSalesAccess && (
                        <span className="ml-1 text-[10px] font-semibold bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full">
                          Requires Sales dashboard access
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mb-4">
                      Select which brand dashboards this user can access inside the Sales module.
                      {!hasSalesAccess && ' Grant "Sales" in the Dashboard Access tab first.'}
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {SALE_BRANDS.map((brand) => {
                        const granted = saleBrands.includes(brand.key);
                        const disabled = !hasSalesAccess;
                        return (
                          <motion.div key={brand.key} whileHover={disabled ? {} : { y: -2 }}
                            className={`rounded-xl border bg-white p-4 shadow-sm transition-all ${
                              disabled ? 'opacity-50 cursor-not-allowed' :
                              granted ? 'border-emerald-300' : 'border-slate-200'
                            }`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: brand.color }} />
                                  <p className="font-semibold text-slate-800">{brand.label}</p>
                                </div>
                                <p className="text-xs text-slate-500">{brand.desc}</p>
                              </div>
                              <button
                                onClick={() => !disabled && toggleBrand(brand.key)}
                                disabled={disabled || brandSaving === brand.key}
                                className={`rounded-lg p-2 shrink-0 transition-colors ${
                                  disabled ? 'bg-slate-100 text-slate-300 cursor-not-allowed' :
                                  granted
                                    ? 'bg-emerald-100 text-emerald-700 hover:bg-red-50 hover:text-red-600'
                                    : 'bg-slate-100 text-slate-400 hover:bg-emerald-100 hover:text-emerald-700'
                                }`}>
                                {brandSaving === brand.key
                                  ? <Loader2 className="h-4 w-4 animate-spin" />
                                  : granted ? <ShieldCheck className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
                              </button>
                            </div>
                            <div className={`mt-3 text-xs font-semibold ${granted && !disabled ? 'text-emerald-700' : 'text-slate-400'}`}>
                              {granted && !disabled ? '✓ Brand access granted' : 'No access'}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Sales Uploader Access ── */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Upload className="h-4 w-4 text-blue-600" />
                      <h3 className="text-sm font-bold text-slate-800">Sales Data Uploader Access</h3>
                      {!hasSalesAccess && (
                        <span className="ml-1 text-[10px] font-semibold bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full">
                          Requires Sales dashboard access
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mb-4">
                      Control which brands this user can upload data for. If not granted, the uploader section will be hidden for that brand.
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {SALE_BRANDS.map((brand) => {
                        const granted  = uploaderBrands.includes(brand.key);
                        const hasBrand = saleBrands.includes(brand.key);
                        const disabled = !hasSalesAccess || !hasBrand;
                        return (
                          <motion.div key={brand.key} whileHover={disabled ? {} : { y: -2 }}
                            className={`rounded-xl border bg-white p-4 shadow-sm transition-all ${
                              disabled ? 'opacity-50 cursor-not-allowed' :
                              granted ? 'border-blue-300' : 'border-slate-200'
                            }`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: brand.color }} />
                                  <p className="font-semibold text-slate-800">{brand.label}</p>
                                </div>
                                <p className="text-xs text-slate-500">
                                  {!hasBrand ? 'Grant brand access first' : 'Upload Excel / CSV files'}
                                </p>
                              </div>
                              <button
                                onClick={() => !disabled && toggleUploaderBrand(brand.key)}
                                disabled={disabled || uploaderSaving === brand.key}
                                className={`rounded-lg p-2 shrink-0 transition-colors ${
                                  disabled ? 'bg-slate-100 text-slate-300 cursor-not-allowed' :
                                  granted
                                    ? 'bg-blue-100 text-blue-700 hover:bg-red-50 hover:text-red-600'
                                    : 'bg-slate-100 text-slate-400 hover:bg-blue-100 hover:text-blue-700'
                                }`}>
                                {uploaderSaving === brand.key
                                  ? <Loader2 className="h-4 w-4 animate-spin" />
                                  : granted ? <ShieldCheck className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
                              </button>
                            </div>
                            <div className={`mt-3 text-xs font-semibold ${granted && !disabled ? 'text-blue-700' : 'text-slate-400'}`}>
                              {granted && !disabled ? '✓ Uploader access granted' : disabled && hasSalesAccess ? 'Requires brand access' : 'No access'}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Call Rec UI Processes — separate app, real integration ── */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <UploadCloud className="h-4 w-4 text-orange-600" />
                      <h3 className="text-sm font-bold text-slate-800">Call Rec UI Processes</h3>
                      {!hasCallRecAccess && (
                        <span className="ml-1 text-[10px] font-semibold bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full">
                          Requires Call Rec UI dashboard access
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mb-4">
                      Grants this person a real account in Call Rec UI (a separate app) and controls which
                      processes/campaigns they can upload data for there.
                      {!hasCallRecAccess && ' Grant "Call Rec UI" in the Dashboard Access tab first.'}
                    </p>
                    {callRecCatalogError ? (
                      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-700">
                        <AlertTriangle className="h-4 w-4 shrink-0" /> {callRecCatalogError}
                      </div>
                    ) : callRecCatalog.length === 0 ? (
                      <div className="flex h-20 items-center justify-center text-xs text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading Call Rec UI processes…
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {callRecCatalog.map((proc) => {
                          const disabled = !hasCallRecAccess;
                          const granted = userCallRecProcs.includes(proc.id);
                          return (
                            <div key={proc.id}
                              className={`rounded-xl border bg-white p-4 shadow-sm transition-all ${
                                disabled ? 'opacity-50' : granted ? 'border-orange-300' : 'border-slate-200'
                              }`}>
                              <div className="flex items-start justify-between gap-2">
                                <p className="font-semibold text-slate-800">{proc.name}</p>
                                <button
                                  onClick={() => !disabled && toggleCallRecProcess(proc.id)}
                                  disabled={disabled || callRecSaving === proc.id}
                                  className={`rounded-lg p-2 shrink-0 transition-colors ${
                                    disabled ? 'bg-slate-100 text-slate-300 cursor-not-allowed' :
                                    granted
                                      ? 'bg-orange-100 text-orange-700 hover:bg-red-50 hover:text-red-600'
                                      : 'bg-slate-100 text-slate-400 hover:bg-orange-100 hover:text-orange-700'
                                  }`}>
                                  {callRecSaving === proc.id
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : granted ? <ShieldCheck className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
                                </button>
                              </div>
                              <div className={`mt-2 text-xs font-semibold ${granted && !disabled ? 'text-orange-700' : 'text-slate-400'}`}>
                                {granted && !disabled ? '✓ Process access granted' : 'No access'}
                              </div>
                              {!!proc.campaigns?.length && (
                                <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5">
                                  {proc.campaigns.map((camp) => {
                                    const campGranted = userCallRecProcs.includes(camp.id);
                                    return (
                                      <button key={camp.id}
                                        onClick={() => !disabled && toggleCallRecProcess(camp.id)}
                                        disabled={disabled || callRecSaving === camp.id}
                                        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                                          disabled ? 'border-slate-200 text-slate-300 cursor-not-allowed' :
                                          campGranted
                                            ? 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-red-50 hover:border-red-200 hover:text-red-600'
                                            : 'border-slate-200 text-slate-500 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700'
                                        }`}>
                                        {callRecSaving === camp.id
                                          ? <Loader2 className="h-3 w-3 animate-spin" />
                                          : campGranted ? <ShieldCheck className="h-3 w-3" /> : <ShieldOff className="h-3 w-3" />}
                                        {camp.name}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
