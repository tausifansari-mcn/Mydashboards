import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronRight, Home, Landmark, Building2, MessageSquare, MapPin, MapPinOff } from 'lucide-react';
import { CallRecUploadWidget } from './CallRecUploadWidget';

type UploadType = 'housingOwner' | 'housingPremium' | 'lpFeedback' | 'lpRegional' | 'lpNonRegional';

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
  const [selected, setSelected] = useState<UploadType | null>(null);
  const active = UPLOAD_TYPES.find(t => t.key === selected);

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

      {!selected && (
        <motion.div
          initial="hidden" animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {UPLOAD_TYPES.map((t) => (
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
