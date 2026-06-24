import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Pencil, Trash2, Loader2, X } from 'lucide-react';
import api from '@/lib/axios';
import { Process, Client, PaginatedResponse } from '@/types';

export default function ProcessesPage() {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [selected, setSelected] = useState<Process | null>(null);
  const [form, setForm] = useState({ client_id: '', process_name: '', lob: 'Inbound', dialdesk_client_id: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchProcesses = async () => {
    setLoading(true);
    try { const { data } = await api.get<Process[]>('/processes'); setProcesses(data); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchProcesses();
    api.get<PaginatedResponse<Client>>('/clients', { params: { limit: 100 } }).then((r) => setClients(r.data.data));
  }, []);

  const filtered = processes.filter((p) =>
    p.process_name.toLowerCase().includes(search.toLowerCase()) ||
    (p.client?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => { setForm({ client_id: '', process_name: '', lob: 'Inbound', dialdesk_client_id: '' }); setError(''); setModal('create'); };
  const openEdit = (p: Process) => { setSelected(p); setForm({ client_id: String(p.client_id), process_name: p.process_name, lob: p.lob, dialdesk_client_id: String(p.dialdesk_client_id) }); setError(''); setModal('edit'); };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const payload = { client_id: Number(form.client_id), process_name: form.process_name, lob: form.lob as Process['lob'], dialdesk_client_id: Number(form.dialdesk_client_id) };
      if (modal === 'create') await api.post('/processes', payload);
      else await api.patch(`/processes/${selected?.id}`, payload);
      setModal(null); fetchProcesses();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Deactivate this process?')) return;
    await api.delete(`/processes/${id}`); fetchProcesses();
  };

  const lobColor = { Inbound: 'bg-blue-100 text-blue-700', Outbound: 'bg-amber-100 text-amber-700', 'IB/OB': 'bg-purple-100 text-purple-700' };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div><h2 className="text-xl font-bold text-slate-800">Processes</h2><p className="text-sm text-slate-500">{filtered.length} processes</p></div>
        <motion.button whileTap={{ scale: 0.97 }} onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm">
          <Plus className="h-4 w-4" /> Add Process
        </motion.button>
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm w-72">
        <Search className="h-4 w-4 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search processes..." className="flex-1 text-sm outline-none bg-transparent" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {['Process Name', 'Client', 'LOB', 'Dialdesk ID', 'Status', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></td></tr>
            ) : filtered.map((p, i) => (
              <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-semibold text-slate-800">{p.process_name}</td>
                <td className="px-4 py-3 text-slate-600">{p.client?.name || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${lobColor[p.lob] || 'bg-slate-100 text-slate-700'}`}>{p.lob}</span>
                </td>
                <td className="px-4 py-3 font-mono text-slate-600">{p.dialdesk_client_id}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {p.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(p)} className="rounded p-1 hover:bg-blue-50 text-slate-400 hover:text-primary"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => handleDelete(p.id)} className="rounded p-1 hover:bg-red-50 text-slate-400 hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">{modal === 'create' ? 'Add Process' : 'Edit Process'}</h3>
              <button onClick={() => setModal(null)} className="rounded-lg p-1 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <div className="space-y-4">
              <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Client</label>
                <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-primary">
                  <option value="">Select client...</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></div>
              <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Process Name</label>
                <input value={form.process_name} onChange={(e) => setForm({ ...form, process_name: e.target.value })} placeholder="e.g. Bellavita"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-primary" /></div>
              <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">LOB</label>
                <select value={form.lob} onChange={(e) => setForm({ ...form, lob: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-primary">
                  {['Inbound', 'Outbound', 'IB/OB'].map((l) => <option key={l}>{l}</option>)}
                </select></div>
              <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Dialdesk Client ID</label>
                <input type="number" value={form.dialdesk_client_id} onChange={(e) => setForm({ ...form, dialdesk_client_id: e.target.value })} placeholder="375"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-primary" /></div>
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
