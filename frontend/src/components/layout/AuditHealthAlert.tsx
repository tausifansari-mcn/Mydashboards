import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldAlert, X, ArrowRight, Clock } from 'lucide-react';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/authStore';

// Mirrors the roles the backend's /audit-monitor routes actually allow (requireRole in
// audit-monitor.routes.ts) — fetching for anyone else would just draw a 403 with nothing to show.
const CAN_VIEW_AUDIT_HEALTH = new Set(['super_admin', 'client_admin', 'manager', 'qa']);

// Re-checks occasionally while the app stays open, so a problem that starts (or clears) mid-session
// still surfaces without the user needing to reload — but far less often than the dedicated Audit
// Monitor page's own optional 2-minute "Live" toggle, since this runs for every signed-in session
// on every page rather than only while someone has that page open and asked for live updates.
const RECHECK_MS = 10 * 60 * 1000;

interface UnhealthyProcess {
  processId: number; processName: string; clientName: string; lob: string;
  status: 'not_auditing' | 'stalled'; reason: string;
}

interface OverviewSummary { notAuditing: number; stalled: number }

// Site-wide watchdog for the AI audit-grading pipeline quietly going blank — previously the only
// way to notice was to manually open AI Audit Monitor. This surfaces the same signal (the overview
// endpoint that page already uses) as a modal the moment someone opens the app, instead of leaving
// it undiscovered until someone happens to go looking.
export default function AuditHealthAlert() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [problems, setProblems] = useState<UnhealthyProcess[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const checkedOnce = useRef(false);

  useEffect(() => {
    if (!user || !CAN_VIEW_AUDIT_HEALTH.has(user.role)) return;

    const check = () => {
      api.get<{ success: boolean; data: { summary: OverviewSummary; processes: UnhealthyProcess[] } }>('/audit-monitor/overview')
        .then(r => {
          const d = r.data.data;
          const bad = d.processes.filter(p => p.status === 'not_auditing' || p.status === 'stalled');
          setProblems(bad);
          // Only auto-pop the modal on the very first check of this session — later re-checks just
          // keep the data behind the persistent pill fresh, they don't re-interrupt someone who
          // already saw and dismissed it (that would just be nagging, not new information) unless
          // the pill itself is clicked.
          if (!checkedOnce.current && bad.length > 0) setModalOpen(true);
          checkedOnce.current = true;
        })
        .catch(() => {}); // silent — this is a bonus signal, not core functionality; never blocks the app
    };

    check();
    const t = setInterval(check, RECHECK_MS);
    return () => clearInterval(t);
  }, [user]);

  if (!problems || problems.length === 0) return null;

  const goToMonitor = () => {
    setModalOpen(false);
    if (location.pathname !== '/monitoring/audit') navigate('/monitoring/audit');
  };

  return (
    <>
      {/* Persistent pill — stays visible after the modal is dismissed/closed so the warning doesn't
          just vanish; clicking it re-opens the same modal with current data. */}
      {!modalOpen && (
        <button onClick={() => setModalOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold pl-3 pr-4 py-2.5 shadow-lg shadow-red-900/30 transition-colors animate-pulse">
          <ShieldAlert size={14} /> Audit issue — {problems.length} process{problems.length !== 1 ? 'es' : ''}
        </button>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 px-6 py-5 bg-red-50 border-b border-red-100">
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <ShieldAlert size={18} className="text-red-600" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-red-900">Auditing has stopped for {problems.length} process{problems.length !== 1 ? 'es' : ''}</h2>
                <p className="text-xs text-red-700 mt-0.5">Calls are coming in but not being graded — this was caught automatically, not manually.</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="ml-auto text-red-400 hover:text-red-700 transition-colors shrink-0">
                <X size={18} />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {problems.slice(0, 8).map(p => (
                <div key={`${p.processId}-${p.lob}`} className="px-6 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800 truncate">{p.processName} <span className="text-slate-400 font-normal">· {p.lob}</span></p>
                    <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${p.status === 'not_auditing' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                      {p.status === 'not_auditing' ? 'Not Auditing' : 'Stalled'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                    <Clock size={10} /> {p.reason}
                  </p>
                </div>
              ))}
              {problems.length > 8 && (
                <p className="px-6 py-2.5 text-[11px] text-slate-400">+{problems.length - 8} more on the Audit Monitor page</p>
              )}
            </div>
            <div className="flex items-center gap-2 px-6 py-4 bg-slate-50 border-t border-slate-100">
              <button onClick={() => setModalOpen(false)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors">
                Dismiss
              </button>
              <button onClick={goToMonitor}
                className="ml-auto flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 transition-colors">
                View Audit Monitor <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
