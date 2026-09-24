import { Request, Response } from 'express';
import { z } from 'zod';
import { getSmtpStatus, updateSmtpPassword } from '../../lib/mailer';
import { getAiSettingsStatus, updateAiSettings } from '../../lib/aiSettings';
import { getDeepgramSettingsStatus, updateDeepgramSettings } from '../../lib/deepgramSettings';

export async function getSmtpStatusCtrl(_req: Request, res: Response): Promise<void> {
  try {
    const status = await getSmtpStatus();
    res.json(status);
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Failed to load SMTP status' });
  }
}

const passwordSchema = z.object({ password: z.string().min(1, 'Password is required') });

export async function updateSmtpPasswordCtrl(req: Request, res: Response): Promise<void> {
  try {
    const { password } = passwordSchema.parse(req.body);
    const result = await updateSmtpPassword(password, req.user!.email);
    if (!result.ok) {
      res.status(400).json({ message: `SMTP verification failed — password was not saved: ${result.error}` });
      return;
    }
    res.json({ message: 'SMTP password updated and verified' });
  } catch (err: unknown) {
    res.status(400).json({ message: err instanceof Error ? err.message : 'Failed to update SMTP password' });
  }
}

export async function getAiSettingsStatusCtrl(_req: Request, res: Response): Promise<void> {
  try {
    const status = await getAiSettingsStatus();
    res.json(status);
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Failed to load AI settings status' });
  }
}

const aiSettingsSchema = z.object({
  provider: z.enum(['anthropic', 'openai-compatible']).default('anthropic'),
  apiKey: z.string().min(1, 'API key is required'),
  model: z.string().trim().optional(),
  baseUrl: z.string().trim().url('Base URL must be a valid URL').optional(),
}).refine(v => v.provider !== 'openai-compatible' || !!v.baseUrl, {
  message: 'baseUrl is required for an OpenAI-compatible provider', path: ['baseUrl'],
});

export async function updateAiSettingsCtrl(req: Request, res: Response): Promise<void> {
  try {
    const { provider, apiKey, model, baseUrl } = aiSettingsSchema.parse(req.body);
    const result = await updateAiSettings(provider, apiKey, model, baseUrl, req.user!.email);
    if (!result.ok) {
      res.status(400).json({ message: `Key verification failed — nothing was saved: ${result.error}` });
      return;
    }
    res.json({ message: 'AI settings updated and verified' });
  } catch (err: unknown) {
    res.status(400).json({ message: err instanceof Error ? err.message : 'Failed to update AI settings' });
  }
}

export async function getDeepgramStatusCtrl(_req: Request, res: Response): Promise<void> {
  try {
    const status = await getDeepgramSettingsStatus();
    res.json(status);
  } catch (err: unknown) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Failed to load Deepgram settings status' });
  }
}

const deepgramSettingsSchema = z.object({ apiKey: z.string().min(1, 'API key is required') });

export async function updateDeepgramSettingsCtrl(req: Request, res: Response): Promise<void> {
  try {
    const { apiKey } = deepgramSettingsSchema.parse(req.body);
    const result = await updateDeepgramSettings(apiKey, req.user!.email);
    if (!result.ok) {
      res.status(400).json({ message: `Key verification failed — nothing was saved: ${result.error}` });
      return;
    }
    res.json({ message: 'Deepgram key updated and verified' });
  } catch (err: unknown) {
    res.status(400).json({ message: err instanceof Error ? err.message : 'Failed to update Deepgram key' });
  }
}
