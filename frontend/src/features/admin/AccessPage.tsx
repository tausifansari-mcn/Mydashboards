import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, ShieldCheck, ShieldOff, Loader2, GitBranch, LayoutDashboard } from 'lucide-react';
import api from '@/lib/axios';
import { User, Dashboard, PaginatedResponse } from '@/types';

interface AccessRow   { dashboard: Dashboard; can_export: boolean }
interface ProcessItem { id: number; process_name: string; lob: string; dialdesk_client_id: number; client_id: number; is_active: boolean; client?: { name: string } }
interface MappingItem { process: ProcessItem }

const LOB_COLOR: Record<string, { bg: string; text: string }> = {
  Inbound:  { bg: '#EFF6FF', text: '#1D4ED8' },
  Outbound: { bg: '#FFFBEB', text: '#D97706' },
  'IB/OB':  { bg: '#F5F3FF', text: '#7C3AED' },
};

export default function AccessPage() {
  const [users,      setUsers]      = useState<User[]>([]);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [processes,  setProcesses]  = useState<ProcessItem[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [access,     setAccess]     = useState<AccessRow[]>([]);
  const [userProcs,  setUserProcs]  = useState<number[]>([]);
  const [search,     setSearch]     = useState('');
  const [tab,        setTab]        = useState<'dashboards' | 'processes'>('dashboards');
  const [loading,    setLoading]    = useState(false);
  const [saving,     setSaving]     = useState<number | null>(null);
  const [procSaving, setProcSaving] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<PaginatedResponse<User>>('/users', { params: { limit: 100 } }),
      api.get<Dashboard[]>('/dashboards'),
      api.get<ProcessItem[]>('/processes'),
    ]).then(([u, d, p]) => {
      setUsers(u.data.data);
      setDashboards(d.data);
      setProcesses(p.data);
    });
  }, []);

  const loadUser = async (user: User) => {
    setSelectedUser(user);
    setLoading(true);
    try {
      const [dashRes, procRes] = await Promise.all([
        api.get<AccessRow[]>(`/dashboards/user/${user.id}/access`),
        api.get<MappingItem[]>(`/processes/user/${user.id}`),
      ]);
      setAccess(dashRes.data);
      setUserProcs(procRes.data.map((m) => m.process.id));
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

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  const activeProcs   = userProcs.length;
  const activeDashes  = access.length;

  return (
    <div className="flex h-full gap-0">
      {/* ── User list panel ── */}
      <div className="w-72 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-4 border-b border-slate-100 flex-shrink-0">
          <h3 className="font-bold text-slate-800 mb-3">Select User</h3>
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

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col bg-[#F8FAFC] overflow-hidden">
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
            <div className="px-6 pt-6 pb-0 border-b border-slate-200 bg-white flex-shrink-0">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">{selectedUser.name}</h2>
                  <p className="text-sm text-slate-500">{selectedUser.email} · {selectedUser.roleDisplay}</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="px-2.5 py-1 rounded-full font-semibold bg-blue-50 text-blue-700">{activeDashes} Dashboard{activeDashes !== 1 ? 's' : ''}</span>
                  <span className="px-2.5 py-1 rounded-full font-semibold bg-purple-50 text-purple-700">{activeProcs} Process{activeProcs !== 1 ? 'es' : ''}</span>
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
            <div className="flex-1 overflow-y-auto p-6">
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
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
