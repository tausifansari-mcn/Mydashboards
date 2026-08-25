import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Lightbulb, X } from 'lucide-react';

export interface ActionableGuideItem { scenario: string; action: string; }

// Icon-triggered popover listing every scenario → action pair for a given context (CLAP branch,
// Fraud Call, Potential Scam, Social/Court Threat). Shared across all of them instead of each
// growing its own bespoke panel — same portal + viewport-boundary-aware positioning as
// CaseActionPicker, so it can't get clipped off-screen near the bottom/edge of a modal.
export default function ActionableGuide({ title, items, accent = '#F59E0B' }: {
  title: string; items: ActionableGuideItem[]; accent?: string;
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);

  const PANEL_WIDTH = 360;
  const PANEL_MAX_HEIGHT = 420;

  const openPanel = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const top = spaceBelow >= PANEL_MAX_HEIGHT + 8
      ? r.bottom + 6
      : Math.max(8, r.top - PANEL_MAX_HEIGHT - 6);
    const left = Math.min(
      Math.max(8, r.left),
      window.innerWidth - PANEL_WIDTH - 8,
    );
    setAnchor({ top: Math.min(top, window.innerHeight - PANEL_MAX_HEIGHT - 8), left });
    setOpen(true);
  };

  return (
    <>
      <button
        onClick={openPanel}
        title={`Actionable guide — ${title}`}
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-bold transition-colors"
        style={{ color: accent, background: `${accent}15`, border: `1px solid ${accent}40` }}
      >
        <Lightbulb className="h-3.5 w-3.5" />
        Actionable Guide
      </button>

      {open && anchor && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[9999] rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden flex flex-col"
            style={{ top: anchor.top, left: anchor.left, width: PANEL_WIDTH, maxHeight: PANEL_MAX_HEIGHT }}
          >
            <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 shrink-0" style={{ background: accent }}>
              <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-white">
                <Lightbulb className="h-3.5 w-3.5" /> {title}
              </span>
              <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="overflow-y-auto p-2.5 space-y-2">
              {items.map((it, i) => (
                <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                  <p className="text-[11px] font-bold text-slate-800 mb-1">{it.scenario}</p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    <span className="font-semibold" style={{ color: accent }}>Action: </span>
                    {it.action}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
