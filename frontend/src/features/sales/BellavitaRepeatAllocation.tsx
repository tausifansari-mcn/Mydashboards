import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, Download, Sparkles, CheckCircle2, AlertCircle, RefreshCw, PhoneCall, Ban, UserCheck } from 'lucide-react';
import api from '@/lib/axios';

function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const today = toDateInput(new Date());
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateInput(d);
}

interface AllocationResult { matched: number; alreadyAllocated: number; inserted: number; }

export default function BellavitaRepeatAllocation() {
  const [date, setDate] = useState(today);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; data?: AllocationResult } | null>(null);

  const createAllocation = async () => {
    setCreating(true);
    setResult(null);
    try {
      const { data } = await api.post('/sales/bellavita-repeat-allocation', { date });
      const d: AllocationResult = data.data;
      setResult({
        success: true,
        message: d.inserted > 0
          ? `Allocated ${d.inserted.toLocaleString()} new repeat customer${d.inserted !== 1 ? 's' : ''} for ${date}.`
          : `No new rows to allocate for ${date} — everything matched was already allocated in an earlier run.`,
        data: d,
      });
    } catch (err: any) {
      setResult({ success: false, message: err.response?.data?.message ?? err.message ?? 'Failed to create allocation' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Create Allocation */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl shadow-sm"
        style={{ background: 'linear-gradient(135deg, #0A0A0B 0%, #232326 55%, #3F3F46 100%)' }}>
        <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full opacity-20 blur-3xl" style={{ background: '#A78BFA' }} />
        <div className="relative p-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
              <Link2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Create Repeat Allocation</h2>
              <p className="text-xs text-white/50">Matches OrderExport For Repeat with Repeat CDR by phone number</p>
            </div>
          </div>
          <p className="text-xs text-white/40 mt-3 leading-relaxed max-w-xl">
            Picks orders placed on the selected date whose phone number was called (matched in Repeat CDR),
            skipping anything already allocated in an earlier run. Matched rows are stored in
            Repeat Allocation, stamped with this date as their <span className="text-white/70 font-medium">Raw Date</span>.
          </p>

          <div className="flex items-end gap-3 mt-5 flex-wrap">
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-white/50">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white outline-none focus:ring-2 focus:ring-white/30" />
            </div>
            <motion.button
              whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
              onClick={createAllocation} disabled={creating || !date}
              className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-900 shadow-lg disabled:opacity-50 transition-opacity"
            >
              {creating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {creating ? 'Creating...' : 'Create Allocation'}
            </motion.button>
          </div>

          <AnimatePresence>
            {result && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4">
                <div className={`flex items-start gap-2 rounded-xl p-3 text-sm border ${
                  result.success ? 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20' : 'bg-red-500/10 text-red-200 border-red-500/20'
                }`}>
                  {result.success ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                  <span>{result.message}</span>
                </div>
                {result.data && (
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    <StatPill icon={PhoneCall} label="Matched (Called)" value={result.data.matched} color="#60A5FA" />
                    <StatPill icon={Ban} label="Already Allocated" value={result.data.alreadyAllocated} color="#FBBF24" />
                    <StatPill icon={UserCheck} label="Newly Allocated" value={result.data.inserted} color="#34D399" />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Downloads */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DownloadCard
          title="OrderExport For Repeat"
          desc="Download bvo_order_export rows by order date range"
          endpoint="/sales/bellavita-order-export/download"
          filePrefix="bellavita-order-export"
        />
        <DownloadCard
          title="Repeat Allocation"
          desc="Download allocated rows by Raw Date range"
          endpoint="/sales/bellavita-repeat-allocation/download"
          filePrefix="bellavita-repeat-allocation"
        />
      </div>
    </div>
  );
}

function StatPill({ icon: Icon, label, value, color }: { icon: typeof PhoneCall; label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.05] p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon size={12} style={{ color }} />
        <span className="text-[9px] font-bold uppercase tracking-wider text-white/50">{label}</span>
      </div>
      <p className="text-xl font-black text-white tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}

function DownloadCard({ title, desc, endpoint, filePrefix }: { title: string; desc: string; endpoint: string; filePrefix: string }) {
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const download = async () => {
    setDownloading(true);
    setError('');
    try {
      const res = await api.get(endpoint, { params: { startDate: from, endDate: to }, responseType: 'blob' });
      const blob = new Blob([res.data as BlobPart], { type: 'text/csv' });
      const objUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = `${filePrefix}-${from}_to_${to}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(objUrl);
    } catch (err: any) {
      setError(err.response?.data?.message ?? err.message ?? 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      <p className="text-xs text-slate-500 mt-0.5 mb-4">{desc}</p>
      <div className="flex items-end gap-2 flex-wrap">
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-slate-900/10" />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-slate-900/10" />
        </div>
        <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
          onClick={download} disabled={downloading}
          className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white shadow-sm disabled:opacity-50 transition-opacity">
          {downloading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          {downloading ? 'Downloading...' : 'Download'}
        </motion.button>
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </motion.div>
  );
}
