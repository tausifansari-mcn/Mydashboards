import prisma from '../../lib/prismaClient';

export async function getAllProcesses(clientId?: number) {
  return prisma.md_processes.findMany({
    where: clientId ? { client_id: clientId } : {},
    include: { client: { select: { id: true, name: true } } },
    orderBy: [{ client: { name: 'asc' } }, { process_name: 'asc' }],
  });
}

export async function getProcessById(id: number) {
  return prisma.md_processes.findUnique({ where: { id }, include: { client: true } });
}

export async function createProcess(data: { client_id: number; process_name: string; lob: string; dialdesk_client_id: number }) {
  return prisma.md_processes.create({ data, include: { client: true } });
}

export async function updateProcess(id: number, data: Partial<{ process_name: string; lob: string; dialdesk_client_id: number; is_active: boolean }>) {
  return prisma.md_processes.update({ where: { id }, data, include: { client: true } });
}

export async function deleteProcess(id: number) {
  return prisma.md_processes.update({ where: { id }, data: { is_active: false } });
}

export async function assignUserToProcess(userId: number, processId: number) {
  return prisma.md_user_process_mapping.upsert({
    where: { user_id_process_id: { user_id: userId, process_id: processId } },
    update: {},
    create: { user_id: userId, process_id: processId },
  });
}

export async function unassignUserFromProcess(userId: number, processId: number) {
  return prisma.md_user_process_mapping.deleteMany({
    where: { user_id: userId, process_id: processId },
  });
}

export async function getUserProcesses(userId: number) {
  return prisma.md_user_process_mapping.findMany({
    where: { user_id: userId },
    include: { process: { include: { client: true } } },
  });
}
