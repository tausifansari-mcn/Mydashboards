import { FileText } from 'lucide-react';
import type { ChatSource } from './types';

export function SourceCitation({ sources }: { sources: ChatSource[] }) {
  if (sources.length === 0) return null;
  return (
    <div className="mt-2 pt-2 border-t border-slate-100">
      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Sources</p>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((s, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-slate-200 px-2 py-1 text-[10px] text-slate-600">
            <FileText size={10} className="text-slate-400" />
            {s.label}{s.detail ? <span className="text-slate-400">· {s.detail}</span> : null}
          </span>
        ))}
      </div>
    </div>
  );
}
