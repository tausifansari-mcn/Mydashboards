import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Loader2 } from 'lucide-react';
import api from '@/lib/axios';

export interface CaseAction { action: string; note: string; updated_by?: string; updated_at?: string }

export const ACTION_OPTIONS: { key: string; label: string; color: string }[] = [
  { key: 'no_action',  label: 'No Action',            color: '#64748B' },
  { key: 'monitoring', label: 'Monitoring',            color: '#0EA5E9' },
  { key: 'contacted',  label: 'Customer Contacted',    color: '#8B5CF6' },
  { key: 'escalated',  label: 'Escalated to Manager',  color: '#F59E0B' },
  { key: 'legal',      label: 'Escalated to Legal',    color: '#EF4444' },
  { key: 'resolved',   label: 'Resolved',              color: '#22C55E' },
];

export function actionMeta(action: string | undefined) {
  return ACTION_OPTIONS.find((o) => o.key === action) ?? ACTION_OPTIONS[0];
}

// Inline action-status control used on every flagged-case row across Social Threat, Potential
// Scam, Fraud Call, and TNI — "what did we actually do about this one". Shared so all four
// features present/behave identically instead of each growing its own bespoke widget.
export default function CaseActionPicker({
  apiBase, feature, leadId, clientId, current, onSaved, compact,
}: {
  apiBase:  string; // '/inbound-quality' or '/quality'
  feature:  'social_threat' | 'potential_scam' | 'fraud_call' | 'tni';
  leadId:   string;
  clientId: string;
  current?: CaseAction;
  onSaved:  (next: CaseAction) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState(current?.note ?? '');
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const meta = actionMeta(current?.action);

  const MENU_WIDTH = 288;  // w-72
  const MENU_HEIGHT = 340; // 6 options + note + save button, roughly

  const openMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const top = spaceBelow >= MENU_HEIGHT + 8
      ? r.bottom + 6
      : Math.max(8, r.top - MENU_HEIGHT - 6);
    const left = Math.min(
      Math.max(8, r.right - MENU_WIDTH),
      window.innerWidth - MENU_WIDTH - 8,
    );
    setAnchor({ top: Math.min(top, window.innerHeight - MENU_HEIGHT - 8), left });
    setNote(current?.note ?? '');
    setOpen(true);
  };

  const save = async (nextAction: string, nextNote: string) => {
    setSaving(true);
    try {
      await api.post(`${apiBase}/case-actions`, {
        feature, leadId, clientId, action: nextAction, note: nextNote,
      });
      onSaved({ action: nextAction, note: nextNote });
      setOpen(false);
    } catch {
      // leave the menu open on failure so the click doesn't silently vanish with nothing saved
    } finally { setSaving(false); }
  };

  return (
    <>
      <button
        onClick={openMenu}
        title="Set the action taken for this case"
        className={`inline-flex items-center gap-1 rounded-full font-semibold transition-colors ${compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-xs'}`}
        style={{ color: meta.color, background: `${meta.color}15`, border: `1px solid ${meta.color}30` }}
      >
        {meta.label}
        <ChevronDown className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      </button>

      {open && anchor && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[9999] w-72 max-h-[80vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl"
            style={{ top: anchor.top, left: anchor.left }}
          >
            <div className="p-2 space-y-0.5">
              {ACTION_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => save(opt.key, note)}
                  disabled={saving}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: opt.color }} />
                    {opt.label}
                  </span>
                  {current?.action === opt.key && <Check className="h-3.5 w-3.5 text-slate-400" />}
                </button>
              ))}
            </div>
            <div className="border-t border-slate-100 p-2.5">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note…"
                rows={2}
                className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs outline-none focus:border-primary"
              />
              <button
                onClick={() => save(current?.action ?? 'no_action', note)}
                disabled={saving}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save Note'}
              </button>
              {current?.updated_by && (
                <p className="mt-1.5 text-[10px] text-slate-400">Last updated by {current.updated_by}</p>
              )}
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
