import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, X, Maximize2, Minimize2, RotateCcw, Sparkles, ChevronRight } from 'lucide-react';
import { useProcessStore } from '@/store/processStore';
import { useAuthStore } from '@/store/authStore';
import { ChatWindow } from './ChatWindow';
import { ChatInput } from './ChatInput';
import { SuggestedQuestions } from './SuggestedQuestions';
import { useAiBotChat } from './useAiBotChat';

const FULL_PAGE_PATH = '/ai-quality-copilot';

// Mounted once in AppShell so it's present on every page (per explicit request) — a fixed
// bottom-right bubble that pops open a chat panel without leaving the current page. Hidden on the
// full CAM BOT page itself (no reason to show a popup on top of the same feature).
//
// Two sizes, toggled by the header's expand button: a small corner "peek" panel (default), and an
// "expanded" panel sized to the main content area — clear of the sidebar (240px expanded / 64px
// collapsed, see Sidebar.tsx) rather than pinned into a corner or covering it.
export default function FloatingChatBot() {
  const { user } = useAuthStore();
  const { isSuperAdmin, dashboardSlugs } = useProcessStore();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { messages, sending, send, onFeedback, newChat } = useAiBotChat({});

  const [showBanner, setShowBanner] = useState(true);
  const hasAccess = !!user && (isSuperAdmin || dashboardSlugs.includes('ai-quality-copilot'));
  if (!hasAccess || location.pathname === FULL_PAGE_PATH) return null;

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className={expanded
              ? 'fixed z-50 flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden top-6 bottom-6 left-4 right-4 md:left-[272px] md:right-8'
              : 'fixed bottom-24 right-5 z-50 flex flex-col w-[380px] max-w-[calc(100vw-2.5rem)] h-[560px] max-h-[calc(100vh-8rem)] rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden'}
          >
            {/* Header */}
            <div className="shrink-0" style={{ background: 'linear-gradient(135deg, #1565C0, #0D47A1)' }}>
              <div className="flex items-center gap-2.5 px-4 pt-3 pb-2.5">
                <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white shrink-0 shadow-sm">
                  <Bot size={17} style={{ color: '#1565C0' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold text-white leading-none">CAM BOT</p>
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-1.5 py-0.5">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      </span>
                      <span className="text-[9px] font-medium text-emerald-50">Online</span>
                    </span>
                  </div>
                  <p className="text-[10px] text-white/70 mt-0.5">Ask about calls, CQ & performance</p>
                </div>
                {messages.length > 0 && (
                  <button onClick={newChat} title="New chat" className="p-1.5 rounded-lg text-white/70 hover:bg-white/15 hover:text-white transition-colors">
                    <RotateCcw size={14} />
                  </button>
                )}
                <button onClick={() => setExpanded(e => !e)} title={expanded ? 'Shrink' : 'Expand'} className="p-1.5 rounded-lg text-white/70 hover:bg-white/15 hover:text-white transition-colors">
                  {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
                <button onClick={() => setOpen(false)} title="Close" className="p-1.5 rounded-lg text-white/70 hover:bg-white/15 hover:text-white transition-colors">
                  <X size={16} />
                </button>
              </div>
              {showBanner && messages.length === 0 && (
                <button
                  onClick={() => setShowBanner(false)}
                  className="flex w-full items-center gap-2 bg-white/10 px-4 py-2 text-left hover:bg-white/[0.14] transition-colors"
                >
                  <Sparkles size={12} className="text-white/80 shrink-0" />
                  <span className="flex-1 text-[11px] text-white/80 truncate">Your AI assistant for call quality, analytics and insights</span>
                  <ChevronRight size={13} className="text-white/60 shrink-0" />
                </button>
              )}
            </div>

            {/* Body */}
            <div className={`flex-1 overflow-hidden flex flex-col px-3 ${expanded ? 'max-w-3xl w-full mx-auto' : ''}`}>
              <ChatWindow messages={messages} onFeedback={onFeedback} />
            </div>

            {/* Composer */}
            <div className={`shrink-0 px-3 pb-3 pt-1 space-y-2 border-t border-slate-100 ${expanded ? 'max-w-3xl w-full mx-auto' : ''}`}>
              {messages.length === 0 && (
                <div className="pt-2">
                  <SuggestedQuestions context={{}} onPick={send} />
                </div>
              )}
              <ChatInput onSend={send} disabled={sending} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating launcher bubble */}
      <motion.button
        onClick={() => setOpen(o => !o)}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl"
        style={{ background: 'linear-gradient(135deg, #1565C0, #0D47A1)' }}
        aria-label="Open CAM BOT"
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <X size={22} />
            </motion.span>
          ) : (
            <motion.span key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <Bot size={24} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </>
  );
}
