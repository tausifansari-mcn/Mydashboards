import { Clock, ChevronRight } from 'lucide-react';
import type { CallAuditHistoryItem } from './types';

const VERDICT_DOT: Record<string, string> = {
  Excellent: '#22C55E',
  Good: '#3B82F6',
  'Needs Improvement': '#F59E0B',
  Poor: '#EF4444',
};

export function AuditHistoryPanel({ items, loading, onOpen }: { items: CallAuditHistoryItem[]; loading: boolean; onOpen: (id: number) => void }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-1.5">
        <Clock size={13} className="text-slate-400" />
        <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500">Recent Audits</h3>
      </div>
      <div className="max-h-[520px] overflow-y-auto">
        {loading ? (
          <p className="text-xs text-slate-400 italic px-4 py-6 text-center">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-slate-400 italic px-4 py-6 text-center">No audits yet — run your first one.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map(item => (
              <button key={item.id} onClick={() => onOpen(item.id)}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-slate-50 transition-colors">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: item.verdict ? VERDICT_DOT[item.verdict] ?? '#94A3B8' : '#94A3B8' }} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 truncate">{item.agentName} · {item.processName}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{new Date(item.createdAt).toLocaleString()}</p>
                </div>
                {item.overallScore !== null && (
                  <span className="text-xs font-black tabular-nums text-slate-600 shrink-0">{item.overallScore}</span>
                )}
                <ChevronRight size={13} className="text-slate-300 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
