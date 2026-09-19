import { useEffect, useRef } from 'react';
import { Bot, BarChart3, TrendingUp, Users, FileText, Target } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import type { ChatMessageData } from './types';

interface Props {
  messages: ChatMessageData[];
  onFeedback: (id: string, value: 'up' | 'down') => void;
}

const CAPABILITIES = [
  { icon: BarChart3, bg: '#DCFCE7', color: '#16A34A', title: 'Call Quality (CQ) scores', text: 'and agent performance' },
  { icon: TrendingUp, bg: '#DBEAFE', color: '#2563EB', title: 'Sales KPIs', text: 'and call analytics' },
  { icon: Users, bg: '#EDE9FE', color: '#7C3AED', title: 'Agent performance reports', text: 'and trends' },
  { icon: FileText, bg: '#FFEDD5', color: '#EA580C', title: 'Call transcripts', text: 'and compliance monitoring' },
  { icon: Target, bg: '#FCE7F3', color: '#DB2777', title: 'Objection analysis', text: 'and coaching insights' },
];

function WelcomeCard() {
  return (
    <div className="flex gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-full shrink-0 shadow-sm" style={{ background: 'linear-gradient(135deg, #1565C0, #0D47A1)' }}>
        <Bot size={15} className="text-white" />
      </div>
      <div className="max-w-[92%] rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm shadow-sm">
        <p className="font-bold text-slate-900 mb-2">Hi! I'm CAM BOT 👋</p>
        <p className="text-slate-600 mb-3">Your call-center quality analytics assistant. I can help you with:</p>
        <div className="space-y-2.5 mb-3">
          {CAPABILITIES.map((c, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0" style={{ background: c.bg }}>
                <c.icon size={14} style={{ color: c.color }} />
              </div>
              <p className="text-slate-600 leading-snug pt-1">
                <span className="font-bold text-slate-800">{c.title}</span> {c.text}
              </p>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-100 pt-3">
          <p className="text-slate-500 text-xs">Just let me know which client/process you're working with and what data you need!</p>
        </div>
      </div>
    </div>
  );
}

export function ChatWindow({ messages, onFeedback }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, messages[messages.length - 1]?.content]);

  return (
    <div className="flex-1 overflow-y-auto py-4 space-y-4">
      {messages.length === 0 && <WelcomeCard />}
      {messages.map((m) => <ChatMessage key={m.id} message={m} onFeedback={m.role === 'assistant' ? onFeedback : undefined} />)}
      <div ref={bottomRef} />
    </div>
  );
}
