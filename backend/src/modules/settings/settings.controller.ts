import { Request, Response } from 'express';
import { z } from 'zod';
import { getSmtpStatus, updateSmtpPassword } from '../../lib/mailer';

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
