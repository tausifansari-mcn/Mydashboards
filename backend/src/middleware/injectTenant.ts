import { Request, Response, NextFunction } from 'express';

export function injectTenant(req: Request, _res: Response, next: NextFunction): void {
  if (req.user) {
    req.tenantId = req.user.clientId ?? null;
  }
  next();
}
