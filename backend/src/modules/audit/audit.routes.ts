import { Router } from 'express';
import { verifyToken } from '../../middleware/verifyToken';
import { injectTenant } from '../../middleware/injectTenant';
import { requireRole } from '../../middleware/requireRole';
import * as ctrl from './audit.controller';

const router = Router();
router.use(verifyToken, injectTenant, requireRole('super_admin'));

router.get('/logs', ctrl.auditLogs);
router.get('/login-history', ctrl.loginHistory);

export default router;
