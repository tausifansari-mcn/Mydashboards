import { BarChart3, Users, TrendingUp, PhoneCall, Lightbulb, Search } from 'lucide-react';
import type { DashboardContext } from './types';

interface Props {
  context?: DashboardContext;
  onPick: (question: string) => void;
}

// Context-aware per Rule 27 — if opened from a specific process, ask about THAT process by name
// instead of a generic one.
function buildQuestions(context?: DashboardContext): { icon: typeof BarChart3; label: string; question: string }[] {
  const p = context?.clientName;
  return [
    { icon: BarChart3, label: "Today's QA Summary", question: p ? `Give me today's QA summary for ${p}` : "Give me today's QA summary" },
    { icon: Users, label: 'Agent Performance', question: p ? `Show ${p} agent performance` : 'Show agent performance for my processes' },
    { icon: TrendingUp, label: 'Process Analysis', question: p ? `Analyze ${p}'s CQ trend this month` : 'What is BellaVita CQ this month?' },
    { icon: PhoneCall, label: 'Analyze a Call', question: 'Analyze call ' },
    { icon: Lightbulb, label: 'Major Objections', question: p ? `What are the major objections for ${p}?` : 'What are the major customer objections?' },
    { icon: Search, label: 'Compare Periods', question: p ? `Compare this month vs last month for ${p}` : 'Compare this month vs last month' },
  ];
}

export function SuggestedQuestions({ context, onPick }: Props) {
  const questions = buildQuestions(context);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {questions.map((q) => (
        <button key={q.label} onClick={() => onPick(q.question)}
          className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700 transition-colors whitespace-nowrap overflow-hidden">
          <q.icon size={13} className="text-blue-500 shrink-0" />
          <span className="truncate">{q.label}</span>
        </button>
      ))}
    </div>
  );
}
