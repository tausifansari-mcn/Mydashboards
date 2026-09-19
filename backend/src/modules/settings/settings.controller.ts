import { Request, Response } from 'express';
import { z } from 'zod';
import { getSmtpStatus, updateSmtpPassword } from '../../lib/mailer';
import { getAiSettingsStatus, updateAiSettings } from '../../lib/aiSettings';

export async function getSmtpStatusCtrl(_req: Request, res: Response): Promise<void> {
  const status = await getSmtpStatus();
  res.json(status);
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
  const status = await getAiSettingsStatus();
  res.json(status);
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
