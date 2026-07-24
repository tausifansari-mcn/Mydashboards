import { Request, Response, NextFunction } from 'express';
import { resolveUserScope } from '../modules/call-master/call-master.service';

/**
 * Blocks cross-tenant access via ?clientId=. Restricted users (those with a
 * non-null scope from resolveUserScope) may only request a clientId that's in
 * their resolved allowlist; unrestricted users (super_admin, scope.clientIds
 * === null) pass through untouched. Requests that omit clientId entirely are
 * not modified here — downstream handlers that treat "no clientId" as
 * "aggregate across all clients" are a separate, lower-severity gap.
 */
export function enforceClientScope() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      const requested = req.query.clientId as string | undefined;
      if (!requested) { next(); return; }

      const scope = await resolveUserScope(req.user.id, req.tenantId ?? null);
      if (scope.clientIds === null) { next(); return; }

      if (!scope.clientIds.includes(Number(requested))) {
        res.status(403).json({ message: 'Forbidden: no access to this client' });
        return;
      }
      next();
    } catch {
      res.status(500).json({ message: 'Failed to verify client access' });
    }
  };
}
