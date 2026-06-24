import { Request, Response } from 'express';
import { z } from 'zod';
import * as authService from './auth.service';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const forgotSchema = z.object({ email: z.string().email() });
const resetSchema = z.object({ token: z.string(), password: z.string().min(8) });
const changeSchema = z.object({ oldPassword: z.string(), newPassword: z.string().min(8) });

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    const result = await authService.loginService(email, password, ip, userAgent);
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ accessToken: result.accessToken, user: result.user });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Login failed';
    res.status(401).json({ message: msg });
  }
}

export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) { res.status(401).json({ message: 'No refresh token' }); return; }
    const result = await authService.refreshService(token);
    res.json(result);
  } catch {
    res.status(401).json({ message: 'Invalid refresh token' });
  }
}

export function logout(_req: Request, res: Response): void {
  res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'strict' });
  res.json({ message: 'Logged out' });
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  try {
    const { email } = forgotSchema.parse(req.body);
    await authService.forgotPasswordService(email, process.env.FRONTEND_URL!);
    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch {
    res.status(400).json({ message: 'Invalid request' });
  }
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const { token, password } = resetSchema.parse(req.body);
    await authService.resetPasswordService(token, password);
    res.json({ message: 'Password reset successful' });
  } catch {
    res.status(400).json({ message: 'Invalid or expired reset token' });
  }
}

export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    const user = await authService.getMeService(req.user!.id);
    res.json(user);
  } catch {
    res.status(404).json({ message: 'User not found' });
  }
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  try {
    const { oldPassword, newPassword } = changeSchema.parse(req.body);
    await authService.changePasswordService(req.user!.id, oldPassword, newPassword);
    res.json({ message: 'Password changed successfully' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to change password';
    res.status(400).json({ message: msg });
  }
}
