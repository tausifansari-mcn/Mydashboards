import prisma from '../../lib/prismaClient';

export async function getAuditLogs(page = 1, limit = 50, userId?: number, action?: string) {
  const where: Record<string, unknown> = {};
  if (userId) where.user_id = userId;
  if (action) where.action = { contains: action };

  const [data, total] = await Promise.all([
    prisma.md_audit_logs.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { created_at: 'desc' },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.md_audit_logs.count({ where }),
  ]);
  return { data, total, page, limit };
}

export async function getLoginHistory(page = 1, limit = 50, userId?: number, status?: string) {
  const where: Record<string, unknown> = {};
  if (userId) where.user_id = userId;
  if (status) where.status = status;

  const [data, total] = await Promise.all([
    prisma.md_login_logs.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { logged_at: 'desc' },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.md_login_logs.count({ where }),
  ]);
  return { data, total, page, limit };
}
