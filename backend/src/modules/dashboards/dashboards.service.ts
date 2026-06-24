import prisma from '../../lib/prismaClient';

export async function getAllDashboards() {
  return prisma.md_dashboards.findMany({ orderBy: { sort_order: 'asc' } });
}

export async function getMyDashboards(userId: number, isSuperAdmin: boolean) {
  if (isSuperAdmin) {
    return prisma.md_dashboards.findMany({ where: { is_active: true }, orderBy: { sort_order: 'asc' } });
  }
  const access = await prisma.md_dashboard_access.findMany({
    where: { user_id: userId },
    include: { dashboard: true },
  });
  return access.map((a) => ({ ...a.dashboard, can_export: a.can_export }));
}

export async function grantAccess(userId: number, dashboardId: number, canExport: boolean, grantedBy: number) {
  return prisma.md_dashboard_access.upsert({
    where: { user_id_dashboard_id: { user_id: userId, dashboard_id: dashboardId } },
    update: { can_export: canExport },
    create: { user_id: userId, dashboard_id: dashboardId, can_export: canExport, granted_by: grantedBy },
  });
}

export async function revokeAccess(userId: number, dashboardId: number) {
  return prisma.md_dashboard_access.deleteMany({
    where: { user_id: userId, dashboard_id: dashboardId },
  });
}

export async function getUserAccess(userId: number) {
  return prisma.md_dashboard_access.findMany({
    where: { user_id: userId },
    include: { dashboard: true },
  });
}
