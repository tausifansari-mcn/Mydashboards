import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, ShieldCheck, ShieldOff, Loader2 } from 'lucide-react';
import api from '@/lib/axios';
import { User, Dashboard, PaginatedResponse } from '@/types';

interface AccessRow { dashboard: Dashboard; can_export: boolean }

export default function AccessPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [access, setAccess] = useState<AccessRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<PaginatedResponse<User>>('/users', { params: { limit: 100 } }),
      api.get<Dashboard[]>('/dashboards'),
    ]).then(([u, d]) => { setUsers(u.data.data); setDashboards(d.data); });
  }, []);

  const loadAccess = async (user: User) => {
    setSelectedUser(user);
    setLoading(true);
    try {
      const { data } = await api.get<AccessRow[]>(`/dashboards/user/${user.id}/access`);
      setAccess(data);
    } finally { setLoading(false); }
  };

  const hasAccess = (dashId: number) => access.some((a) => a.dashboard.id === dashId);

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

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-full gap-0">
      {/* User list panel */}
      <div className="w-72 flex-shrink-0 border-r border-slate-200 bg-white">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 mb-3">Select User</h3>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..."
              className="flex-1 text-sm outline-none bg-transparent" />
          </div>
        </div>
        <div className="overflow-y-auto">
          {filteredUsers.map((u) => (
            <button key={u.id} onClick={() => loadAccess(u)}
              className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${selectedUser?.id === u.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}>
              <p className="font-semibold text-sm text-slate-800">{u.name}</p>
              <p className="text-xs text-slate-500">{u.email}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Access panel */}
      <div className="flex-1 p-6 bg-[#F8FAFC] overflow-y-auto">
        {!selectedUser ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-slate-400">
              <ShieldCheck className="mx-auto h-12 w-12 mb-3 opacity-30" />
              <p className="font-medium">Select a user to manage dashboard access</p>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-800">{selectedUser.name}</h2>
              <p className="text-sm text-slate-500">{selectedUser.email} · {selectedUser.roleDisplay}</p>
            </div>
            {loading ? (
              <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {dashboards.map((dash) => {
                  const granted = hasAccess(dash.id);
                  return (
                    <motion.div key={dash.id} whileHover={{ y: -2 }}
                      className={`rounded-xl border bg-white p-4 shadow-sm transition-all ${granted ? 'border-primary/30' : 'border-slate-200'}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-slate-800">{dash.name}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{dash.description}</p>
                        </div>
                        <button onClick={() => toggleAccess(dash.id)} disabled={saving === dash.id}
                          className={`rounded-lg p-2 transition-colors ${granted ? 'bg-primary/10 text-primary hover:bg-red-50 hover:text-danger' : 'bg-slate-100 text-slate-400 hover:bg-primary/10 hover:text-primary'}`}>
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
            )}
          </>
        )}
      </div>
    </div>
  );
}
