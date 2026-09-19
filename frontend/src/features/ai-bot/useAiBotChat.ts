import { useState, useCallback } from 'react';
import api from '@/lib/axios';
import type { ChatMessageData, DashboardContext, ChatSource } from './types';

interface ChatApiResponse {
  success: boolean;
  message: string;
  sessionId: string;
  messageId: number;
  sources: ChatSource[];
  toolsUsed: string[];
  metadata: { aiEnabled: boolean };
}

// Shared chat state/orchestration between the full-page copilot (AIBotPage) and the floating
// widget (FloatingChatBot) — both talk to the same session once one is opened, so starting a
// conversation in the popup and continuing it on the full page (or vice versa) just works.
export function useAiBotChat(context: DashboardContext) {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [sending, setSending] = useState(false);

  const send = useCallback(async (text: string) => {
    const userMsg: ChatMessageData = { id: crypto.randomUUID(), role: 'user', content: text, createdAt: Date.now() };
    const pendingId = crypto.randomUUID();
    setMessages(prev => [...prev, userMsg, { id: pendingId, role: 'assistant', content: '', createdAt: Date.now(), pending: true }]);
    setSending(true);
    try {
      const { data } = await api.post<ChatApiResponse>('/ai-bot/chat', {
        message: text,
        sessionId,
        context,
      });
      setSessionId(data.sessionId);
      setMessages(prev => prev.map(m => m.id === pendingId
        ? { id: pendingId, dbMessageId: data.messageId, role: 'assistant', content: data.message, createdAt: Date.now(), sources: data.sources, toolsUsed: data.toolsUsed }
        : m));
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Something went wrong reaching CAM BOT. Please try again.';
      setMessages(prev => prev.map(m => m.id === pendingId ? { id: pendingId, role: 'assistant', content: msg, createdAt: Date.now() } : m));
    } finally {
      setSending(false);
    }
  }, [sessionId, context]);

  const onFeedback = useCallback(async (localId: string, value: 'up' | 'down') => {
    const target = messages.find(m => m.id === localId);
    setMessages(prev => prev.map(m => m.id === localId ? { ...m, feedback: value } : m));
    if (!sessionId || !target?.dbMessageId) return;
    try {
      await api.post('/ai-bot/feedback', { sessionId, messageId: target.dbMessageId, feedback: value });
    } catch { /* best-effort */ }
  }, [sessionId, messages]);

  const newChat = useCallback(() => {
    setMessages([]);
    setSessionId(undefined);
  }, []);

  return { messages, sending, send, onFeedback, newChat };
}
