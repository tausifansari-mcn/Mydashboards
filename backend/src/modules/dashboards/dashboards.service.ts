import { querySource } from '../../lib/sourceDb';

const DASH_COLS = 'id, name, slug, icon, description, is_active, sort_order';

export async function getAllDashboards() {
  return querySource<Record<string, unknown>>(
    `SELECT ${DASH_COLS} FROM shivamgiri.md_dashboards ORDER BY sort_order ASC`,
  );
}

export async function getMyDashboards(userId: number, isSuperAdmin: boolean) {
  if (isSuperAdmin) {
    return querySource<Record<string, unknown>>(
      `SELECT ${DASH_COLS} FROM shivamgiri.md_dashboards WHERE is_active = 1 ORDER BY sort_order ASC`,
    );
  }
  const rows = await querySource<Record<string, unknown>>(
    `SELECT d.id, d.name, d.slug, d.icon, d.description, d.is_active, d.sort_order, a.can_export
       FROM shivamgiri.md_dashboard_access a
       JOIN shivamgiri.md_dashboards d ON d.id = a.dashboard_id
      WHERE a.user_id = ?
      ORDER BY d.sort_order ASC`,
    [userId],
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    icon: r.icon,
    description: r.description,
    is_active: Boolean(r.is_active),
    sort_order: r.sort_order,
    can_export: Boolean(r.can_export),
  }));
}

export async function grantAccess(userId: number, dashboardId: number, canExport: boolean, grantedBy: number) {
  await querySource(
    `INSERT INTO shivamgiri.md_dashboard_access (user_id, dashboard_id, can_export, granted_by)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE can_export = VALUES(can_export)`,
    [userId, dashboardId, canExport ? 1 : 0, grantedBy],
  );
  const rows = await querySource<Record<string, unknown>>(
    `SELECT id, user_id, dashboard_id, can_export, granted_by, granted_at
       FROM shivamgiri.md_dashboard_access
      WHERE user_id = ? AND dashboard_id = ?`,
    [userId, dashboardId],
  );
  return rows[0];
}

export async function revokeAccess(userId: number, dashboardId: number) {
  return querySource(
    `DELETE FROM shivamgiri.md_dashboard_access WHERE user_id = ? AND dashboard_id = ?`,
    [userId, dashboardId],
  );
}

export async function getUserAccess(userId: number) {
  const rows = await querySource<Record<string, unknown>>(
    `SELECT a.id, a.user_id, a.dashboard_id, a.can_export, a.granted_by, a.granted_at,
            d.id AS d_id, d.name AS d_name, d.slug, d.icon, d.description,
            d.is_active AS d_is_active, d.sort_order
       FROM shivamgiri.md_dashboard_access a
       JOIN shivamgiri.md_dashboards d ON d.id = a.dashboard_id
      WHERE a.user_id = ?`,
    [userId],
  );
  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    dashboard_id: r.dashboard_id,
    can_export: Boolean(r.can_export),
    granted_by: r.granted_by,
    granted_at: r.granted_at,
    dashboard: {
      id: r.d_id,
      name: r.d_name,
      slug: r.slug,
      icon: r.icon,
      description: r.description,
      is_active: Boolean(r.d_is_active),
      sort_order: r.sort_order,
    },
  }));
}
