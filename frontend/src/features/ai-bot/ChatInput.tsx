import { useState, useRef, KeyboardEvent } from 'react';
import { Send, Sparkles } from 'lucide-react';

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
}

// Matches the backend's actual limit (ai-bot.controller.ts rejects messages over 2000 chars) —
// not an arbitrary UI number, so the counter never lies about what will actually be accepted.
const MAX_LENGTH = 2000;

export function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    if (ref.current) ref.current.style.height = 'auto';
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div>
      <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/15 transition-all">
        <textarea
          ref={ref}
          value={value}
          maxLength={MAX_LENGTH}
          onChange={(e) => {
            setValue(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
          }}
          onKeyDown={onKeyDown}
          placeholder="Ask anything about your calls, audits and quality..."
          rows={1}
          disabled={disabled}
          className="flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={submit}
          disabled={disabled || !value.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white transition-all disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #1565C0, #0D47A1)' }}
        >
          <Send size={15} />
        </button>
      </div>
      <div className="flex items-center justify-between mt-1.5 px-1">
        <p className="flex items-center gap-1 text-[10px] text-slate-400">
          <Sparkles size={10} className="text-blue-400" />
          Tip: Try asking about a specific client, process or date range
        </p>
        <span className="text-[10px] text-slate-300 shrink-0">{value.length}/{MAX_LENGTH}</span>
      </div>
    </div>
  );
}
