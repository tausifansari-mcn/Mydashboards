import { useState } from 'react';
import { Wrench, ChevronDown } from 'lucide-react';

export function ToolExecutionCard({ toolsUsed }: { toolsUsed: string[] }) {
  const [open, setOpen] = useState(false);
  if (toolsUsed.length === 0) return null;
  return (
    <div className="mt-2">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 hover:text-slate-600 transition-colors">
        <Wrench size={10} />
        {toolsUsed.length} data lookup{toolsUsed.length === 1 ? '' : 's'} used
        <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {toolsUsed.map((t, i) => (
            <span key={i} className="rounded-md bg-blue-50 text-blue-600 px-2 py-0.5 text-[10px] font-mono">{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}
