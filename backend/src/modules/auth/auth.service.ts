import bcrypt from 'bcryptjs';
import prisma from '../../lib/prismaClient';
import { signAccessToken, signRefreshToken, signResetToken, verifyRefreshToken, verifyResetToken, TokenPayload } from '../../lib/token';
import { sendPasswordResetEmail } from '../../lib/mailer';

export async function loginService(email: string, password: string, ip: string, userAgent: string) {
  const user = await prisma.md_users.findUnique({
    where: { email },
    include: { role: true },
  });

  if (!user || !user.is_active) {
    await logLoginAttempt(user?.id, ip, userAgent, 'failed');
    throw new Error('Invalid credentials');
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    await logLoginAttempt(user.id, ip, userAgent, 'failed');
    throw new Error('Invalid credentials');
  }

  await prisma.md_users.update({ where: { id: user.id }, data: { last_login: new Date() } });
  await logLoginAttempt(user.id, ip, userAgent, 'success');

  const payload: TokenPayload = {
    id: user.id,
    email: user.email,
    role: user.role.name,
    clientId: user.client_id,
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name,
      roleDisplay: user.role.display_name,
      clientId: user.client_id,
    },
  };
}

export async function refreshService(token: string) {
  const payload = verifyRefreshToken(token);
  const user = await prisma.md_users.findUnique({
    where: { id: payload.id },
    include: { role: true },
  });
  if (!user || !user.is_active) throw new Error('User not found');

  const newPayload: TokenPayload = {
    id: user.id,
    email: user.email,
    role: user.role.name,
    clientId: user.client_id,
  };
  return { accessToken: signAccessToken(newPayload) };
}

export async function forgotPasswordService(email: string, frontendUrl: string) {
  const user = await prisma.md_users.findUnique({ where: { email } });
  if (!user) return;
  const token = signResetToken(user.id);
  const resetLink = `${frontendUrl}/reset-password/${token}`;
  await sendPasswordResetEmail(user.email, user.name, resetLink);
}

export async function resetPasswordService(token: string, newPassword: string) {
  const { id } = verifyResetToken(token);
  const hash = await bcrypt.hash(newPassword, 12);
  await prisma.md_users.update({ where: { id }, data: { password_hash: hash } });
}

export async function changePasswordService(userId: number, oldPassword: string, newPassword: string) {
  const user = await prisma.md_users.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');
  const valid = await bcrypt.compare(oldPassword, user.password_hash);
  if (!valid) throw new Error('Current password is incorrect');
  const hash = await bcrypt.hash(newPassword, 12);
  await prisma.md_users.update({ where: { id: userId }, data: { password_hash: hash } });
}

export async function getMeService(userId: number) {
  const user = await prisma.md_users.findUnique({
    where: { id: userId },
    include: { role: true, client: true },
  });
  if (!user) throw new Error('User not found');
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role.name,
    roleDisplay: user.role.display_name,
    clientId: user.client_id,
    clientName: user.client?.name ?? null,
    lastLogin: user.last_login,
  };
}

async function logLoginAttempt(userId: number | undefined, ip: string, userAgent: string, status: string) {
  if (!userId) return;
  await prisma.md_login_logs.create({
    data: { user_id: userId, ip_address: ip, user_agent: userAgent, status },
  });
}
