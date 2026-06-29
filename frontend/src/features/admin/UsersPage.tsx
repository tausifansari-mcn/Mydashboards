import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Pencil, Trash2, Loader2, X, KeyRound, AlertTriangle } from 'lucide-react';
import api from '@/lib/axios';
import { User, Client, PaginatedResponse } from '@/types';

interface UserRow extends User { role: 'super_admin' | 'client_admin' | 'manager' | 'qa'; roleDisplay: string; is_active: boolean; }

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ name: '', email: '', role_id: '2', client_id: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const roles = [
    { id: 1, name: 'Super Admin' }, { id: 2, name: 'Client Admin' }, { id: 3, name: 'Manager' }, { id: 4, name: 'QA' },
  ];

  const fetchUsers = async (q = search) => {
    setLoading(true);
    try {
      const { data } = await api.get<PaginatedResponse<UserRow>>('/users', { params: { search: q, limit: 50 } });
      setUsers(data.data);
      setTotal(data.total);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchUsers();
    api.get<PaginatedResponse<Client>>('/clients', { params: { limit: 100 } }).then((r) => setClients(r.data.data));
  }, []);

  const openCreate = () => { setForm({ name: '', email: '', role_id: '2', client_id: '' }); setError(''); setSelected(null); setModal('create'); };
  const openEdit = (u: UserRow) => { setSelected(u); setForm({ name: u.name, email: u.email, role_id: '2', client_id: String(u.clientId || '') }); setError(''); setModal('edit'); };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const payload: Record<string, unknown> = { name: form.name, email: form.email, role_id: Number(form.role_id) };
      if (form.client_id) payload.client_id = Number(form.client_id);
      if (modal === 'create') await api.post('/users', payload);
      else await api.patch(`/users/${selected?.id}`, payload);
      setModal(null);
      fetchUsers();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/users/${deleteTarget.id}/permanent`);
      setDeleteTarget(null);
      fetchUsers();
    } catch {
      /* ignore */
    } finally {
      setDeleting(false);
    }
  };

  const handleResetPassword = async (id: number) => {
    if (!confirm('Send a temporary password to this user?')) return;
    await api.post(`/users/${id}/reset-password`);
    alert('Temporary password sent.');
  };

  const roleColor: Record<string, string> = {
    super_admin: 'bg-purple-100 text-purple-700',
    client_admin: 'bg-blue-100 text-blue-700',
    manager: 'bg-amber-100 text-amber-700',
    qa: 'bg-green-100 text-green-700',
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div><h2 className="text-xl font-bold text-slate-800">Users</h2><p className="text-sm text-slate-500">{total} users total</p></div>
        <motion.button whileTap={{ scale: 0.97 }} onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm">
          <Plus className="h-4 w-4" /> Add User
        </motion.button>
      </div>
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm w-72">
        <Search className="h-4 w-4 text-slate-400" />
        <input value={search} onChange={(e) => { setSearch(e.target.value); fetchUsers(e.target.value); }}
          placeholder="Search users..." className="flex-1 text-sm outline-none bg-transparent" />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {['Name', 'Email', 'Role', 'Client', 'Status', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></td></tr>
            ) : users.map((u, i) => (
              <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-semibold text-slate-800">{u.name}</td>
                <td className="px-4 py-3 text-slate-600">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleColor[u.role] || 'bg-slate-100 text-slate-700'}`}>{u.roleDisplay}</span>
                </td>
                <td className="px-4 py-3 text-slate-600">{u.clientName || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(u)} className="rounded p-1 hover:bg-blue-50 text-slate-400 hover:text-primary"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => handleResetPassword(u.id)} className="rounded p-1 hover:bg-amber-50 text-slate-400 hover:text-amber-600"><KeyRound className="h-4 w-4" /></button>
                    <button onClick={() => setDeleteTarget(u)} className="rounded p-1 hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Delete confirmation modal ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex flex-col items-center text-center gap-3 mb-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Delete User</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Permanently delete <span className="font-semibold text-slate-700">{deleteTarget.name}</span>?<br />
                  <span className="text-xs text-slate-400">{deleteTarget.email}</span>
                </p>
                <p className="mt-2 text-xs text-red-500 font-medium">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium hover:bg-slate-50">
                Cancel
              </button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleDelete} disabled={deleting}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-70">
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Trash2 className="h-4 w-4" /> Delete</>}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">{modal === 'create' ? 'Add User' : 'Edit User'}</h3>
              <button onClick={() => setModal(null)} className="rounded-lg p-1 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <div className="space-y-4">
              <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Full Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Doe"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" /></div>
              <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="user@company.com"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" /></div>
              <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Role</label>
                <select value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-primary">
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select></div>
              <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Client (leave blank for Super Admin)</label>
                <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-primary">
                  <option value="">— None (Super Admin) —</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></div>
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium hover:bg-slate-50">Cancel</button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleSave} disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2 text-sm font-semibold text-white disabled:opacity-70">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
