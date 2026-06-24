import bcrypt from 'bcryptjs';
import prisma from '../../lib/prismaClient';
import { sendWelcomeEmail } from '../../lib/mailer';

function generateTempPassword(): string {
  return Math.random().toString(36).slice(-8) + 'A1!';
}

const userSelect = {
  id: true, name: true, email: true, role_id: true, client_id: true,
  is_active: true, last_login: true, created_at: true,
  role: true, client: true,
};

export async function getAllUsers(page = 1, limit = 20, roleFilter?: string, clientFilter?: number, search = '') {
  const where: Record<string, unknown> = {};
  if (roleFilter) where.role = { name: roleFilter };
  if (clientFilter) where.client_id = clientFilter;
  if (search) where.OR = [{ name: { contains: search } }, { email: { contains: search } }];

  const [data, total] = await Promise.all([
    prisma.md_users.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { name: 'asc' },
      select: userSelect,
    }),
    prisma.md_users.count({ where }),
  ]);
  return { data, total, page, limit };
}

export async function getUserById(id: number) {
  return prisma.md_users.findUnique({
    where: { id },
    select: {
      ...userSelect,
      process_mappings: { include: { process: true } },
      dashboard_access: { include: { dashboard: true } },
    },
  });
}

export async function createUser(data: { name: string; email: string; role_id: number; client_id?: number }) {
  const tempPassword = generateTempPassword();
  const hash = await bcrypt.hash(tempPassword, 12);
  const user = await prisma.md_users.create({
    data: { ...data, password_hash: hash },
    include: { role: true },
  });
  try {
    await sendWelcomeEmail(user.email, user.name, tempPassword);
  } catch {
    // Email failure should not block user creation
  }
  return user;
}

export async function updateUser(id: number, data: Partial<{ name: string; role_id: number; client_id: number; is_active: boolean }>) {
  return prisma.md_users.update({ where: { id }, data, include: { role: true } });
}

export async function deleteUser(id: number) {
  return prisma.md_users.update({ where: { id }, data: { is_active: false } });
}

export async function adminResetPassword(id: number) {
  const tempPassword = generateTempPassword();
  const hash = await bcrypt.hash(tempPassword, 12);
  const user = await prisma.md_users.update({ where: { id }, data: { password_hash: hash } });
  try {
    await sendWelcomeEmail(user.email, user.name, tempPassword);
  } catch { /* ignore */ }
}
