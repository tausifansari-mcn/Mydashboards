import { useSearchParams } from 'react-router-dom';
import { Bot, RotateCcw } from 'lucide-react';
import { ChatWindow } from './ChatWindow';
import { ChatInput } from './ChatInput';
import { SuggestedQuestions } from './SuggestedQuestions';
import { useAiBotChat } from './useAiBotChat';
import type { DashboardContext } from './types';

// Dashboard context (Rule 14) travels via query params so another dashboard can deep-link in with
// its current client/date-range selection, e.g. /ai-quality-copilot?clientId=375&clientName=Bellavita
function useDashboardContext(): DashboardContext {
  const [params] = useSearchParams();
  const clientId = params.get('clientId');
  return {
    clientId: clientId ? Number(clientId) : undefined,
    clientName: params.get('clientName') ?? undefined,
    dateFrom: params.get('dateFrom') ?? undefined,
    dateTo: params.get('dateTo') ?? undefined,
    dashboard: params.get('dashboard') ?? undefined,
  };
}

export default function AIBotPage() {
  const context = useDashboardContext();
  const { messages, sending, send, onFeedback, newChat } = useAiBotChat(context);

  return (
    <div className="min-h-screen flex flex-col p-3 sm:p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm" style={{ background: 'linear-gradient(135deg, #1565C0, #0D47A1)' }}>
          <Bot className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="text-lg font-bold text-slate-900">CAM BOT</h1>
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 border border-emerald-100">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[10px] font-medium text-emerald-700">Online</span>
            </span>
          </div>
          <p className="text-xs text-slate-500">Your AI assistant for Call Quality & Performance{context.clientName ? ` — ${context.clientName}` : ''}</p>
        </div>
        {messages.length > 0 && (
          <button onClick={newChat} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-100">
            <RotateCcw size={13} /> New chat
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto">
        <ChatWindow messages={messages} onFeedback={onFeedback} />

        <div className="sticky bottom-0 bg-transparent pt-2 space-y-3">
          {messages.length === 0 && <SuggestedQuestions context={context} onPick={send} />}
          <ChatInput onSend={send} disabled={sending} />
        </div>
      </div>
    </div>
  );
}
