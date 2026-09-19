import { Request, Response } from 'express';
import * as svc from './ai-bot.service';
import type { ChatRequestBody } from './ai-bot.types';

export async function chat(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const body = req.body as ChatRequestBody;
    if (!body?.message || typeof body.message !== 'string' || !body.message.trim()) {
      res.status(400).json({ success: false, message: 'message is required' });
      return;
    }
    if (body.message.length > 2000) {
      res.status(400).json({ success: false, message: 'message is too long (max 2000 characters)' });
      return;
    }

    const result = await svc.handleChat(userId, req.tenantId ?? null, body);
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('ai-bot chat error:', msg);
    res.status(500).json({ success: false, message: 'CAM BOT ran into an error processing that. Please try again.' });
  }
}

export async function listSessions(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const sessions = await svc.listSessions(userId);
    res.json({ success: true, data: sessions });
  } catch (err) {
    console.error('ai-bot listSessions error:', err);
    res.status(500).json({ success: false, message: 'Failed to load chat history' });
  }
}

export async function getSessionMessages(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const messages = await svc.getSessionMessages(req.params.sessionId, userId);
    res.json({ success: true, data: messages });
  } catch (err) {
    console.error('ai-bot getSessionMessages error:', err);
    res.status(500).json({ success: false, message: 'Failed to load conversation' });
  }
}

export async function feedback(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const { sessionId, messageId, feedback: value } = req.body as { sessionId: string; messageId: number; feedback: 'up' | 'down' };
    if (!sessionId || !messageId || (value !== 'up' && value !== 'down')) {
      res.status(400).json({ success: false, message: 'sessionId, messageId, and feedback (up|down) are required' });
      return;
    }
    const ok = await svc.setFeedback(sessionId, userId, messageId, value);
    if (!ok) { res.status(404).json({ success: false, message: 'Session not found' }); return; }
    res.json({ success: true });
  } catch (err) {
    console.error('ai-bot feedback error:', err);
    res.status(500).json({ success: false, message: 'Failed to record feedback' });
  }
}
