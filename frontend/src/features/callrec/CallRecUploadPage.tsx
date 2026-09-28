import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronRight, Home, Landmark, Building2, MessageSquare, MapPin, MapPinOff, Loader2, ShieldOff, Gauge, Save } from 'lucide-react';
import { CallRecUploadWidget } from './CallRecUploadWidget';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/authStore';

type UploadType = 'housingOwner' | 'housingPremium' | 'lpFeedback' | 'lpRegional' | 'lpNonRegional';

interface CallRecUploadLimit { processKey: string; maxRowsPerDay: number | null; uploadedToday: number; updatedByName: string | null; updatedAt: string | null }

const ACCENT = '#1565C0';
const ACCENT2 = '#0D47A1';

const UPLOAD_TYPES: { key: UploadType; icon: typeof Home; label: string; desc: string; endpoint: string; table: string }[] = [
  { key: 'housingOwner', icon: Home, label: 'Housing Owner', desc: 'Call recording dump for Housing Owner', endpoint: '/call-rec-upload/upload-housing-owner', table: 'CR_housing_owner' },
  { key: 'housingPremium', icon: Building2, label: 'Housing Premium', desc: 'Call recording dump for Housing Premium', endpoint: '/call-rec-upload/upload-housing-premium', table: 'CR_housing_premium' },
  { key: 'lpFeedback', icon: MessageSquare, label: 'LP Feedback', desc: 'Lawyer Panel feedback calls', endpoint: '/call-rec-upload/upload-lp-feedback', table: 'CR_lp_feedback' },
  { key: 'lpRegional', icon: MapPin, label: 'LP Regional', desc: 'Lawyer Panel regional campaign calls', endpoint: '/call-rec-upload/upload-lp-regional', table: 'CR_lp_regional' },
  { key: 'lpNonRegional', icon: MapPinOff, label: 'LP Non Regional', desc: 'Lawyer Panel non-regional campaign calls', endpoint: '/call-rec-upload/upload-lp-non-regional', table: 'CR_lp_non_regional' },
];

// Replaces the old iframe embed of a separate standalone app (own server on port 5050/5174) that
// only ever worked when the browser and that server happened to be on the same machine. This
// writes into the exact same db_masmis.CR_* tables that app already used — same data, native page.
export default function CallRecUploadPage() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin';
  const [selected, setSelected] = useState<UploadType | null>(null);
  const [allowed, setAllowed] = useState<UploadType[] | null>(null);
  const active = UPLOAD_TYPES.find(t => t.key === selected);

  useEffect(() => {
    api.get<{ success: boolean; data: UploadType[] }>('/call-rec-upload/my-processes')
      .then(r => setAllowed(r.data.data))
      .catch(() => setAllowed([]));
  }, []);

  const visibleTypes = UPLOAD_TYPES.filter(t => allowed?.includes(t.key));

  // ── Upload limits — Super Admin only (moved here from the Access page, since this is where the
  // person actually configuring it is already looking at the processes it applies to). One limit
  // per process (rows/day), not a shared per-agent+total pair — a Call Rec Upload is a single file
  // of many rows at once, not one action per agent.
  const [crUploadLimits, setCrUploadLimits] = useState<CallRecUploadLimit[]>([]);
  const [crLimitInputs, setCrLimitInputs] = useState<Record<string, string>>({});
  const [crLimitSaving, setCrLimitSaving] = useState<string | null>(null);
  const [crLimitSaved, setCrLimitSaved] = useState<string | null>(null);
  const [crLimitError, setCrLimitError] = useState('');

  useEffect(() => {
    if (!isSuperAdmin) return;
    api.get<{ success: boolean; data: CallRecUploadLimit[] }>('/call-rec-upload/upload-limits')
      .then(r => {
        setCrUploadLimits(r.data.data);
        setCrLimitInputs(Object.fromEntries(r.data.data.map(d => [d.processKey, d.maxRowsPerDay === null ? '' : String(d.maxRowsPerDay)])));
      })
      .catch(() => {});
  }, [isSuperAdmin]);

  const saveCrUploadLimit = async (processKey: string) => {
    setCrLimitSaving(processKey);
    setCrLimitError('');
    setCrLimitSaved(null);
    try {
      const raw = crLimitInputs[processKey] ?? '';
      const r = await api.put<{ success: boolean; data: CallRecUploadLimit[] }>(`/call-rec-upload/upload-limits/${processKey}`, {
        maxRowsPerDay: raw.trim() === '' ? null : Number(raw),
      });
      setCrUploadLimits(r.data.data);
      setCrLimitSaved(processKey);
      setTimeout(() => setCrLimitSaved(null), 2500);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setCrLimitError(msg || 'Failed to save limit');
    } finally {
      setCrLimitSaving(null);
    }
  };

  return (
    <div className="min-h-screen p-3 sm:p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm" style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})` }}>
          <Landmark className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Call Rec Upload</h1>
          <p className="text-xs text-slate-500">Upload call recording dumps for each process</p>
        </div>
      </div>

      {isSuperAdmin && (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-3">
            <Gauge className="h-4 w-4 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-800">Upload Limits</h3>
            <span className="text-[10px] text-slate-400">
              Controls how many rows non-admin uploaders can upload per day, per process — Super Admins are unaffected.
            </span>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            {UPLOAD_TYPES.map(p => {
              const limit = crUploadLimits.find(l => l.processKey === p.key);
              return (
                <div key={p.key} className="flex items-end gap-1.5">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                      {p.label} {limit ? <span className="text-slate-400">({limit.uploadedToday} used today)</span> : null}
                    </label>
                    <input type="number" min={0} placeholder="Unlimited"
                      value={crLimitInputs[p.key] ?? ''}
                      onChange={e => setCrLimitInputs(prev => ({ ...prev, [p.key]: e.target.value }))}
                      className="w-28 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-teal-400" />
                  </div>
                  <button onClick={() => saveCrUploadLimit(p.key)} disabled={crLimitSaving === p.key}
                    className="flex items-center gap-1 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-[11px] font-semibold px-2.5 py-1.5 transition-colors">
                    {crLimitSaving === p.key ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  </button>
                  {crLimitSaved === p.key && <span className="text-[10px] font-semibold text-emerald-600">✓</span>}
                </div>
              );
            })}
            {crLimitError && <span className="text-xs font-semibold text-red-600">{crLimitError}</span>}
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {selected && (
          <motion.button
            key="back" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 mb-4 transition-colors"
          >
            <ArrowLeft size={15} /> {active?.label}
          </motion.button>
        )}
      </AnimatePresence>

      {!selected && allowed === null && (
        <div className="flex items-center justify-center h-40 gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking your process access…
        </div>
      )}

      {!selected && allowed !== null && visibleTypes.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 gap-2 text-center text-slate-400">
          <ShieldOff className="h-8 w-8 opacity-40" />
          <p className="text-sm font-medium">No upload process assigned to you yet</p>
          <p className="text-xs">Ask a Super Admin to grant you access on the Access page.</p>
        </div>
      )}

      {!selected && visibleTypes.length > 0 && (
        <motion.div
          initial="hidden" animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {visibleTypes.map((t) => (
            <motion.button
              key={t.key}
              variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } } }}
              whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }}
              onClick={() => setSelected(t.key)}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white text-left p-6 transition-shadow duration-300 hover:shadow-xl"
              style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}
            >
              <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
                style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})` }} />
              <div className="relative flex items-center justify-center h-10 w-10 rounded-xl shrink-0 mb-3"
                style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})` }}>
                <t.icon className="h-5 w-5 text-white" />
              </div>
              <div className="relative flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{t.label}</h3>
                  <p className="text-slate-500 mt-1 text-xs">{t.desc}</p>
                </div>
                <ChevronRight size={16} className="mt-1 shrink-0 text-slate-300 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-slate-400" />
              </div>
              <div className="absolute inset-x-0 bottom-0 h-[3px] scale-x-0 transition-transform duration-300 group-hover:scale-x-100"
                style={{ background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT2})` }} />
            </motion.button>
          ))}
        </motion.div>
      )}

      {active && (
        <div className="mt-2">
          <CallRecUploadWidget endpoint={active.endpoint} table={active.table} title={`${active.label} Upload`} />
        </div>
      )}
    </div>
  );
}
