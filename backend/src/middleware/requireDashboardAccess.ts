import { Request, Response, NextFunction } from 'express';
import { querySource } from '../lib/sourceDb';

/**
 * Gates a single route behind a specific md_dashboards.slug — for sub-features (like the Raw Data
 * tab) that need finer-grained control than the whole Quality/Inbound dashboard, granted per-user
 * via the existing Admin > Access page (md_dashboard_access), same table/UI as every other
 * dashboard permission. super_admin always passes, matching resolveUserScope's convention elsewhere.
 */
export function requireDashboardAccess(slug: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) { res.status(401).json({ message: 'Unauthorized' }); return; }
      if (req.user.role === 'super_admin') { next(); return; }

      const rows = await querySource<{ cnt: number }>(
        `SELECT COUNT(*) AS cnt
           FROM shivamgiri.md_dashboard_access a
           JOIN shivamgiri.md_dashboards d ON d.id = a.dashboard_id
          WHERE a.user_id = ? AND d.slug = ?`,
        [req.user.id, slug],
      );
      if (Number(rows[0]?.cnt ?? 0) === 0) {
        res.status(403).json({ message: 'You do not have access to this page' });
        return;
      }
      next();
    } catch {
      res.status(500).json({ message: 'Failed to verify page access' });
    }
  };
}
