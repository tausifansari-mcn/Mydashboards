import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Pencil, Trash2, Loader2, X, Check } from 'lucide-react';
import api from '@/lib/axios';
import { Client } from '@/types';

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [selected, setSelected] = useState<Client | null>(null);
  const [form, setForm] = useState({ name: '', dialdesk_client_id: '', logo_url: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchClients = async (q = search) => {
    setLoading(true);
    try {
      const { data } = await api.get('/clients', { params: { search: q, limit: 50 } });
      setClients(data.data);
      setTotal(data.total);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchClients(); }, []);

  const openCreate = () => { setForm({ name: '', dialdesk_client_id: '', logo_url: '' }); setError(''); setModal('create'); };
  const openEdit = (c: Client) => { setSelected(c); setForm({ name: c.name, dialdesk_client_id: String(c.dialdesk_client_id), logo_url: c.logo_url || '' }); setError(''); setModal('edit'); };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const payload = { name: form.name, dialdesk_client_id: Number(form.dialdesk_client_id), logo_url: form.logo_url || undefined };
      if (modal === 'create') await api.post('/clients', payload);
      else await api.patch(`/clients/${selected?.id}`, payload);
      setModal(null);
      fetchClients();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Deactivate this client?')) return;
    await api.delete(`/clients/${id}`);
    fetchClients();
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Clients</h2>
          <p className="text-sm text-slate-500">{total} clients total</p>
        </div>
        <motion.button whileTap={{ scale: 0.97 }} onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark">
          <Plus className="h-4 w-4" /> Add Client
        </motion.button>
      </div>

      {/* Search */}
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm w-72">
        <Search className="h-4 w-4 text-slate-400" />
        <input value={search} onChange={(e) => { setSearch(e.target.value); fetchClients(e.target.value); }}
          placeholder="Search clients..." className="flex-1 text-sm outline-none bg-transparent" />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {['Client Name', 'Dialdesk ID', 'Users', 'Processes', 'Status', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></td></tr>
            ) : clients.map((c, i) => (
              <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-semibold text-slate-800">{c.name}</td>
                <td className="px-4 py-3 font-mono text-slate-600">{c.dialdesk_client_id}</td>
                <td className="px-4 py-3 text-slate-600">{c._count?.users ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">{c._count?.processes ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {c.is_active ? <><Check className="h-3 w-3" />Active</> : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(c)} className="rounded p-1 hover:bg-blue-50 text-slate-400 hover:text-primary"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => handleDelete(c.id)} className="rounded p-1 hover:bg-red-50 text-slate-400 hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">{modal === 'create' ? 'Add Client' : 'Edit Client'}</h3>
              <button onClick={() => setModal(null)} className="rounded-lg p-1 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <div className="space-y-4">
              {[
                { label: 'Client Name', key: 'name', type: 'text', placeholder: 'e.g. Bellavita' },
                { label: 'Dialdesk Client ID', key: 'dialdesk_client_id', type: 'number', placeholder: 'e.g. 375' },
                { label: 'Logo URL (optional)', key: 'logo_url', type: 'url', placeholder: 'https://...' },
              ].map((field) => (
                <div key={field.key}>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">{field.label}</label>
                  <input type={field.type} value={form[field.key as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                </div>
              ))}
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleSave} disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-70">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
