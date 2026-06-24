import prisma from '../../lib/prismaClient';

export async function getAllClients(page = 1, limit = 20, search = '') {
  const where = search ? { name: { contains: search } } : {};
  const [data, total] = await Promise.all([
    prisma.md_clients.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { name: 'asc' },
      include: { _count: { select: { users: true, processes: true } } },
    }),
    prisma.md_clients.count({ where }),
  ]);
  return { data, total, page, limit };
}

export async function getClientById(id: number) {
  return prisma.md_clients.findUnique({
    where: { id },
    include: { processes: true, _count: { select: { users: true } } },
  });
}

export async function createClient(data: { name: string; dialdesk_client_id: number; logo_url?: string }) {
  return prisma.md_clients.create({ data });
}

export async function updateClient(id: number, data: Partial<{ name: string; logo_url: string; is_active: boolean }>) {
  return prisma.md_clients.update({ where: { id }, data });
}

export async function deleteClient(id: number) {
  return prisma.md_clients.update({ where: { id }, data: { is_active: false } });
}
