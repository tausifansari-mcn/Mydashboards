import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Pencil, Trash2, Loader2, X, AlertTriangle, Play, CalendarClock, CheckCircle2, XCircle, FileText } from 'lucide-react';
import api from '@/lib/axios';

interface TaskPage { module: string; target_key: string; target_label: string; }

interface Task {
  id: number;
  name: string;
  pages: TaskPage[];
  frequency: string;
  time_of_day: string;
  day_of_week: number | null;
  day_of_month: number | null;
  recipients: string;
  is_active: boolean;
  next_run_at: string;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_message: string | null;
}

interface TargetOption { key: string; label: string; }

const MODULES: { key: string; label: string }[] = [
  { key: 'inbound',             label: 'Inbound' },
  { key: 'ai_quality_inbound',  label: 'AI Quality — Inbound' },
  { key: 'ai_quality_outbound', label: 'AI Quality — Outbound' },
  { key: 'sales',               label: 'Sales' },
];
const MODULE_LABELS: Record<string, string> = Object.fromEntries(MODULES.map(m => [m.key, m.label]));

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function scheduleLabel(t: Task): string {
  if (t.frequency === 'daily') return `Daily at ${t.time_of_day}`;
  if (t.frequency === 'weekly') return `Weekly · ${DOW_LABELS[t.day_of_week ?? 0]} · ${t.time_of_day}`;
  return `Monthly · Day ${t.day_of_month ?? 1} · ${t.time_of_day}`;
}

function fmtDateTime(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const emptyForm = {
  name: '', pages: [] as TaskPage[],
  frequency: 'daily', time_of_day: '08:00', day_of_week: 1, day_of_month: 1,
  recipients: '', is_active: true,
};

export default function TaskSchedulerPage() {
  const [tasks, setTasks]     = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState<'create' | 'edit' | null>(null);
  const [selected, setSelected] = useState<Task | null>(null);
  const [form, setForm]       = useState(emptyForm);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [running, setRunning] = useState<number | null>(null);

  // "Add a page" picker row — independent of already-added pages
  const [newPageModule, setNewPageModule] = useState('ai_quality_inbound');
  const [newPageTargetKey, setNewPageTargetKey] = useState('');
  const [pickerTargets, setPickerTargets] = useState<TargetOption[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ data: Task[] }>('/task-scheduler');
      setTasks(data.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchTasks(); }, []);

  useEffect(() => {
    if (!modal) return;
    setPickerLoading(true);
    setNewPageTargetKey('');
    api.get<{ data: TargetOption[] }>('/task-scheduler/targets', { params: { module: newPageModule } })
      .then(r => setPickerTargets(r.data.data))
      .catch(() => setPickerTargets([]))
      .finally(() => setPickerLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal, newPageModule]);

  const openCreate = () => {
    setForm(emptyForm); setError(''); setSelected(null);
    setNewPageModule('ai_quality_inbound'); setNewPageTargetKey('');
    setModal('create');
  };
  const openEdit = (t: Task) => {
    setSelected(t);
    setForm({
      name: t.name, pages: t.pages,
      frequency: t.frequency, time_of_day: t.time_of_day,
      day_of_week: t.day_of_week ?? 1, day_of_month: t.day_of_month ?? 1,
      recipients: t.recipients, is_active: t.is_active,
    });
    setError('');
    setNewPageModule('ai_quality_inbound'); setNewPageTargetKey('');
    setModal('edit');
  };

  const handleAddPage = () => {
    if (!newPageTargetKey) return;
    const opt = pickerTargets.find(t => t.key === newPageTargetKey);
    const label = opt?.label ?? newPageTargetKey;
    // Avoid attaching the exact same module+target twice
    if (form.pages.some(p => p.module === newPageModule && p.target_key === newPageTargetKey)) return;
    setForm(f => ({ ...f, pages: [...f.pages, { module: newPageModule, target_key: newPageTargetKey, target_label: label }] }));
    setNewPageTargetKey('');
  };

  const handleRemovePage = (idx: number) => {
    setForm(f => ({ ...f, pages: f.pages.filter((_, i) => i !== idx) }));
  };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      if (!form.name.trim()) throw new Error('Name is required');
      if (form.pages.length === 0) throw new Error('Add at least one page to attach');
      if (!form.recipients.trim()) throw new Error('At least one recipient email is required');

      const payload = {
        name: form.name, pages: form.pages,
        frequency: form.frequency, time_of_day: form.time_of_day,
        day_of_week: form.frequency === 'weekly' ? Number(form.day_of_week) : null,
        day_of_month: form.frequency === 'monthly' ? Number(form.day_of_month) : null,
        recipients: form.recipients, is_active: form.is_active,
      };
      if (modal === 'create') await api.post('/task-scheduler', payload);
      else await api.patch(`/task-scheduler/${selected?.id}`, payload);
      setModal(null);
      fetchTasks();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string });
      setError(msg?.response?.data?.message || msg?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/task-scheduler/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchTasks();
    } finally { setDeleting(false); }
  };

  const handleRunNow = async (id: number) => {
    setRunning(id);
    try {
      await api.post(`/task-scheduler/${id}/run-now`);
      await fetchTasks();
    } catch {
      await fetchTasks();
    } finally { setRunning(null); }
  };

  const toggleActive = async (t: Task) => {
    await api.patch(`/task-scheduler/${t.id}`, { is_active: !t.is_active });
    fetchTasks();
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Task Scheduler</h2>
            <p className="text-sm text-slate-500">Automated email reports for Inbound, AI Quality and Sales</p>
          </div>
        </div>
        <motion.button whileTap={{ scale: 0.97 }} onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm">
          <Plus className="h-4 w-4" /> New Task
        </motion.button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {['Name', 'Pages Attached', 'Schedule', 'Recipients', 'Last Run', 'Next Run', 'Active', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></td></tr>
            ) : tasks.length === 0 ? (
              <tr><td colSpan={8} className="py-12 text-center text-slate-400">No scheduled tasks yet.</td></tr>
            ) : tasks.map((t, i) => (
              <motion.tr key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{t.name}</td>
                <td className="px-4 py-3 text-slate-600">
                  <div className="flex flex-wrap gap-1 max-w-[260px]">
                    {t.pages.map((p, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600" title={MODULE_LABELS[p.module] ?? p.module}>
                        <FileText className="h-3 w-3" />{p.target_label}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{scheduleLabel(t)}</td>
                <td className="px-4 py-3 text-slate-500 max-w-[180px] truncate" title={t.recipients}>{t.recipients}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {t.last_run_status === 'success' && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700"><CheckCircle2 className="h-3.5 w-3.5" /> {fmtDateTime(t.last_run_at)}</span>
                  )}
                  {t.last_run_status === 'failed' && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700" title={t.last_run_message ?? ''}><XCircle className="h-3.5 w-3.5" /> {fmtDateTime(t.last_run_at)}</span>
                  )}
                  {!t.last_run_status && <span className="text-xs text-slate-400">Never run</span>}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{fmtDateTime(t.next_run_at)}</td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleActive(t)}
                    className={`relative h-5 w-9 rounded-full transition-colors ${t.is_active ? 'bg-primary' : 'bg-slate-200'}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${t.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleRunNow(t.id)} disabled={running === t.id}
                      title="Run now" className="rounded p-1 hover:bg-green-50 text-slate-400 hover:text-green-600 disabled:opacity-50">
                      {running === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    </button>
                    <button onClick={() => openEdit(t)} className="rounded p-1 hover:bg-blue-50 text-slate-400 hover:text-primary"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => setDeleteTarget(t)} className="rounded p-1 hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex flex-col items-center text-center gap-3 mb-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Delete Task</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Delete <span className="font-semibold text-slate-700">{deleteTarget.name}</span>?
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

      {/* Create / Edit modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">{modal === 'create' ? 'New Scheduled Task' : 'Edit Scheduled Task'}</h3>
              <button onClick={() => setModal(null)} className="rounded-lg p-1 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Task Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Neeman's Daily Quality Report"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
              </div>

              {/* Pages to attach — multiple */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Pages to Attach</label>

                {form.pages.length > 0 && (
                  <div className="mb-2 space-y-1.5">
                    {form.pages.map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">{MODULE_LABELS[p.module] ?? p.module}</span>
                          <span className="font-medium text-slate-700">{p.target_label}</span>
                        </div>
                        <button onClick={() => handleRemovePage(idx)} className="text-slate-400 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                  <div>
                    <select value={newPageModule} onChange={(e) => setNewPageModule(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-primary">
                      {MODULES.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <select value={newPageTargetKey} onChange={(e) => setNewPageTargetKey(e.target.value)} disabled={pickerLoading}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-primary disabled:opacity-60">
                      <option value="">{pickerLoading ? 'Loading…' : '— Select —'}</option>
                      {pickerTargets.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                    </select>
                  </div>
                  <button type="button" onClick={handleAddPage} disabled={!newPageTargetKey}
                    className="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/20 disabled:opacity-40">
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">Each page adds its own CSV attachment; AI Quality and Inbound pages also add a KPI summary to the email body.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Frequency</label>
                  <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-primary">
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Time</label>
                  <input type="time" value={form.time_of_day} onChange={(e) => setForm({ ...form, time_of_day: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-primary" />
                </div>
              </div>

              {form.frequency === 'weekly' && (
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Day of Week</label>
                  <select value={form.day_of_week} onChange={(e) => setForm({ ...form, day_of_week: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-primary">
                    {DOW_LABELS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                  </select>
                </div>
              )}

              {form.frequency === 'monthly' && (
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Day of Month</label>
                  <input type="number" min={1} max={31} value={form.day_of_month}
                    onChange={(e) => setForm({ ...form, day_of_month: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-primary" />
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Recipients</label>
                <input value={form.recipients} onChange={(e) => setForm({ ...form, recipients: e.target.value })}
                  placeholder="ops@company.com, manager@company.com"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                <p className="mt-1 text-[11px] text-slate-400">Comma-separated email addresses.</p>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5">
                <span className="text-sm font-medium text-slate-700">Active</span>
                <button onClick={() => setForm({ ...form, is_active: !form.is_active })}
                  className={`relative h-5 w-9 rounded-full transition-colors ${form.is_active ? 'bg-primary' : 'bg-slate-200'}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>
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
