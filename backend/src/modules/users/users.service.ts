import bcrypt from 'bcryptjs';
import prisma from '../../lib/prismaClient';
import { sendWelcomeEmail } from '../../lib/mailer';
import { querySource } from '../../lib/sourceDb';

const ENSURE_SALE_BRAND_TABLE = `
  CREATE TABLE IF NOT EXISTS shivamgiri.md_sale_brand_access (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    brand VARCHAR(50) NOT NULL,
    granted_at DATETIME DEFAULT NOW(),
    UNIQUE KEY uq_user_brand (user_id, brand)
  )
`;

const ENSURE_SALE_UPLOADER_TABLE = `
  CREATE TABLE IF NOT EXISTS shivamgiri.md_sale_uploader_access (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    brand VARCHAR(50) NOT NULL,
    granted_at DATETIME DEFAULT NOW(),
    UNIQUE KEY uq_user_uploader_brand (user_id, brand)
  )
`;

export async function getSaleBrands(userId: number): Promise<string[]> {
  await querySource(ENSURE_SALE_BRAND_TABLE, []);
  const rows = await querySource<{ brand: string }>(
    'SELECT brand FROM shivamgiri.md_sale_brand_access WHERE user_id = ? ORDER BY brand',
    [userId],
  );
  return rows.map((r) => r.brand);
}

export async function setSaleBrands(userId: number, brands: string[]): Promise<void> {
  await querySource(ENSURE_SALE_BRAND_TABLE, []);
  await querySource('DELETE FROM shivamgiri.md_sale_brand_access WHERE user_id = ?', [userId]);
  for (const brand of brands) {
    await querySource(
      'INSERT INTO shivamgiri.md_sale_brand_access (user_id, brand) VALUES (?, ?)',
      [userId, brand],
    );
  }
}

export async function getSaleUploaderBrands(userId: number): Promise<string[]> {
  await querySource(ENSURE_SALE_UPLOADER_TABLE, []);
  const rows = await querySource<{ brand: string }>(
    'SELECT brand FROM shivamgiri.md_sale_uploader_access WHERE user_id = ? ORDER BY brand',
    [userId],
  );
  return rows.map((r) => r.brand);
}

export async function setSaleUploaderBrands(userId: number, brands: string[]): Promise<void> {
  await querySource(ENSURE_SALE_UPLOADER_TABLE, []);
  await querySource('DELETE FROM shivamgiri.md_sale_uploader_access WHERE user_id = ?', [userId]);
  for (const brand of brands) {
    await querySource(
      'INSERT INTO shivamgiri.md_sale_uploader_access (user_id, brand) VALUES (?, ?)',
      [userId, brand],
    );
  }
}

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
  } catch (err: unknown) {
    console.error('[users] Welcome email failed for', user.email, (err instanceof Error ? err.message : err));
  }
  return user;
}

export async function updateUser(id: number, data: Partial<{ name: string; role_id: number; client_id: number; is_active: boolean }>) {
  return prisma.md_users.update({ where: { id }, data, include: { role: true } });
}

export async function deleteUser(id: number) {
  return prisma.md_users.update({ where: { id }, data: { is_active: false } });
}

export async function permanentDeleteUser(id: number) {
  await prisma.$transaction([
    prisma.md_dashboard_access.deleteMany({ where: { user_id: id } }),
    prisma.md_user_process_mapping.deleteMany({ where: { user_id: id } }),
    prisma.md_login_logs.deleteMany({ where: { user_id: id } }),
    prisma.md_audit_logs.deleteMany({ where: { user_id: id } }),
    prisma.md_users.delete({ where: { id } }),
  ]);
}

export async function adminResetPassword(id: number) {
  const tempPassword = generateTempPassword();
  const hash = await bcrypt.hash(tempPassword, 12);
  const user = await prisma.md_users.update({ where: { id }, data: { password_hash: hash } });
  try {
    await sendWelcomeEmail(user.email, user.name, tempPassword);
  } catch (err: unknown) {
    console.error('[users] Reset password email failed for', user.email, (err instanceof Error ? err.message : err));
  }
}
