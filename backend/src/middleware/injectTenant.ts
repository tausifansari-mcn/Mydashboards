import { Request, Response, NextFunction } from 'express';

export function injectTenant(req: Request, _res: Response, next: NextFunction): void {
  if (req.user) {
    // super_admin is always unrestricted, regardless of whether client_id happens to be
    // set on their user record (e.g. left over from before they were promoted, or set by
    // mistake) — a non-null client_id here would otherwise scope them down to just the
    // processes assigned to that one client via resolveUserScope's process-mapping path.
    req.tenantId = req.user.role === 'super_admin' ? null : (req.user.clientId ?? null);
  }
  next();
}
