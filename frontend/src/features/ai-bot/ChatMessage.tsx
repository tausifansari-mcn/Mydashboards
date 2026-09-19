import { useState } from 'react';
import { Bot, User, ThumbsUp, ThumbsDown, Copy, Check, CheckCheck } from 'lucide-react';
import { SourceCitation } from './SourceCitation';
import { ToolExecutionCard } from './ToolExecutionCard';
import { SimpleMarkdown } from './SimpleMarkdown';
import { DownloadReportButton } from './DownloadReportButton';
import type { ChatMessageData } from './types';

const ACCENT = '#1565C0';

interface Props {
  message: ChatMessageData;
  onFeedback?: (id: string, value: 'up' | 'down') => void;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard?.writeText(text).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      title="Copy"
      className="p-1 rounded-md text-slate-300 hover:text-slate-500 hover:bg-slate-50 transition-colors"
    >
      {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
    </button>
  );
}

export function ChatMessage({ message, onFeedback }: Props) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className="flex h-8 w-8 items-center justify-center rounded-full shrink-0 shadow-sm"
        style={{ background: isUser ? 'linear-gradient(135deg, #7C3AED, #6D28D9)' : `linear-gradient(135deg, ${ACCENT}, #0D47A1)` }}>
        {isUser ? <User size={14} className="text-white" /> : <Bot size={15} className="text-white" />}
      </div>
      <div className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${isUser ? 'max-w-[75%] bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 text-slate-800' : 'max-w-[92%] bg-white border border-slate-200 text-slate-800'}`}>
        {message.pending ? (
          <div className="flex items-center gap-2">
            <span className="flex gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-bounce" />
            </span>
            <div>
              <p className="text-slate-600 font-medium text-xs">Thinking...</p>
              <p className="text-slate-400 text-[11px]">Gathering the data to answer that...</p>
            </div>
          </div>
        ) : (
          <>
            {isUser ? <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p> : <SimpleMarkdown content={message.content} />}
            {!isUser && <DownloadReportButton content={message.content} />}
            {!isUser && message.toolsUsed && <ToolExecutionCard toolsUsed={message.toolsUsed} />}
            {!isUser && message.sources && <SourceCitation sources={message.sources} />}

            <div className={`mt-1.5 flex items-center gap-1.5 ${isUser ? 'justify-end' : 'justify-between'}`}>
              {!isUser && onFeedback && (
                <div className="flex items-center gap-1">
                  <button onClick={() => onFeedback(message.id, 'up')}
                    className={`p-1 rounded-md transition-colors ${message.feedback === 'up' ? 'bg-emerald-50 text-emerald-600' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-50'}`}>
                    <ThumbsUp size={12} />
                  </button>
                  <button onClick={() => onFeedback(message.id, 'down')}
                    className={`p-1 rounded-md transition-colors ${message.feedback === 'down' ? 'bg-red-50 text-red-600' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-50'}`}>
                    <ThumbsDown size={12} />
                  </button>
                  <CopyButton text={message.content} />
                </div>
              )}
              <span className="flex items-center gap-1 text-[10px] text-slate-400 shrink-0">
                {formatTime(message.createdAt)}
                {isUser && <CheckCheck size={13} className="text-blue-400" />}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
