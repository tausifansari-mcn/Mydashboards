import bcrypt from 'bcryptjs';
import { querySource } from '../../lib/sourceDb';
import { signAccessToken, signRefreshToken, signResetToken, verifyRefreshToken, verifyResetToken, TokenPayload } from '../../lib/token';
import { sendPasswordResetEmail } from '../../lib/mailer';

// All queries run against shivamgiri (user-management DB) via the shared mysql2 pool.
// This avoids Prisma opening a separate connection pool which exhausts MySQL on the
// shared VICIdial server (max_connections ~151).

interface DBUser {
  id: number; name: string; email: string; password_hash: string;
  role_id: number; client_id: number | null; is_active: number | boolean;
  last_login: Date | null; created_at: Date;
  role_name: string; role_display_name: string;
  client_name: string | null;
  avatar_url?: string | null;
}

export async function loginService(email: string, password: string, ip: string, userAgent: string) {
  const rows = await querySource<DBUser>(`
    SELECT u.id, u.name, u.email, u.password_hash, u.role_id, u.client_id,
           u.is_active, u.last_login, u.avatar_url,
           r.name        AS role_name,
           r.display_name AS role_display_name,
           c.name        AS client_name
    FROM shivamgiri.md_users u
    JOIN shivamgiri.md_roles  r ON r.id = u.role_id
    LEFT JOIN shivamgiri.md_clients c ON c.id = u.client_id
    WHERE u.email = ?
    LIMIT 1
  `, [email]);

  const user = rows[0];

  if (!user || !user.is_active) {
    await logLoginAttempt(user?.id, ip, userAgent, 'failed');
    throw new Error('Invalid credentials');
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    await logLoginAttempt(user.id, ip, userAgent, 'failed');
    throw new Error('Invalid credentials');
  }

  await querySource(
    'UPDATE shivamgiri.md_users SET last_login = NOW() WHERE id = ?',
    [user.id]
  );
  await logLoginAttempt(user.id, ip, userAgent, 'success');

  const payload: TokenPayload = {
    id: user.id,
    email: user.email,
    role: user.role_name,
    clientId: user.client_id,
  };

  return {
    accessToken:  signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
    user: {
      id:          user.id,
      name:        user.name,
      email:       user.email,
      role:        user.role_name,
      roleDisplay: user.role_display_name,
      clientId:    user.client_id,
      clientName:  user.client_name ?? null,
      avatar_url:  user.avatar_url ?? null,
    },
  };
}

export async function refreshService(token: string) {
  const payload = verifyRefreshToken(token);

  const rows = await querySource<DBUser>(`
    SELECT u.id, u.email, u.is_active,
           r.name AS role_name
    FROM shivamgiri.md_users u
    JOIN shivamgiri.md_roles r ON r.id = u.role_id
    WHERE u.id = ?
    LIMIT 1
  `, [payload.id]);

  const user = rows[0];
  if (!user || !user.is_active) throw new Error('User not found');

  const newPayload: TokenPayload = {
    id:       user.id,
    email:    user.email,
    role:     user.role_name,
    clientId: payload.clientId,
  };
  return { accessToken: signAccessToken(newPayload) };
}

export async function forgotPasswordService(email: string, frontendUrl: string) {
  const rows = await querySource<{ id: number; name: string; email: string }>(
    'SELECT id, name, email FROM shivamgiri.md_users WHERE email = ? LIMIT 1',
    [email]
  );
  const user = rows[0];
  if (!user) return;

  const token = signResetToken(user.id);
  const resetLink = `${frontendUrl}/reset-password/${token}`;
  try {
    await sendPasswordResetEmail(user.email, user.name, resetLink);
  } catch (err: unknown) {
    console.error('[auth] Failed to send password reset email to', email, (err instanceof Error ? err.message : err));
  }
}

export async function resetPasswordService(token: string, newPassword: string) {
  const { id } = verifyResetToken(token);
  const hash = await bcrypt.hash(newPassword, 12);
  await querySource('UPDATE shivamgiri.md_users SET password_hash = ? WHERE id = ?', [hash, id]);
}

export async function changePasswordService(userId: number, oldPassword: string, newPassword: string) {
  const rows = await querySource<{ id: number; password_hash: string }>(
    'SELECT id, password_hash FROM shivamgiri.md_users WHERE id = ? LIMIT 1',
    [userId]
  );
  const user = rows[0];
  if (!user) throw new Error('User not found');

  const valid = await bcrypt.compare(oldPassword, user.password_hash);
  if (!valid) throw new Error('Current password is incorrect');

  const hash = await bcrypt.hash(newPassword, 12);
  await querySource('UPDATE shivamgiri.md_users SET password_hash = ? WHERE id = ?', [hash, userId]);
}

export async function getMeService(userId: number) {
  const rows = await querySource<DBUser>(`
    SELECT u.id, u.name, u.email, u.last_login, u.avatar_url,
           r.name        AS role_name,
           r.display_name AS role_display_name,
           u.client_id,
           c.name        AS client_name
    FROM shivamgiri.md_users u
    JOIN shivamgiri.md_roles  r ON r.id = u.role_id
    LEFT JOIN shivamgiri.md_clients c ON c.id = u.client_id
    WHERE u.id = ?
    LIMIT 1
  `, [userId]);

  const user = rows[0];
  if (!user) throw new Error('User not found');

  return {
    id:          user.id,
    name:        user.name,
    email:       user.email,
    role:        user.role_name,
    roleDisplay: user.role_display_name,
    clientId:    user.client_id,
    clientName:  user.client_name ?? null,
    lastLogin:   user.last_login,
    avatar_url:  user.avatar_url ?? null,
  };
}

export async function updateAvatarService(userId: number, avatarUrl: string | null) {
  await querySource('UPDATE shivamgiri.md_users SET avatar_url = ? WHERE id = ?', [avatarUrl, userId]);
}

async function logLoginAttempt(userId: number | undefined, ip: string, userAgent: string, status: string) {
  if (!userId) return;
  try {
    await querySource(
      'INSERT INTO shivamgiri.md_login_logs (user_id, ip_address, user_agent, status) VALUES (?, ?, ?, ?)',
      [userId, ip, userAgent, status]
    );
  } catch { /* non-critical — never block login because of log failure */ }
}
