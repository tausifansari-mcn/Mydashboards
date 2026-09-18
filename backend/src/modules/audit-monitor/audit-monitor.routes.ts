import { Router } from 'express';
import { verifyToken } from '../../middleware/verifyToken';
import { injectTenant } from '../../middleware/injectTenant';
import { requireRole } from '../../middleware/requireRole';
import * as ctrl from './audit-monitor.controller';

const router = Router();

router.use(verifyToken, injectTenant, requireRole('super_admin', 'admin', 'manager', 'qa'));

router.get('/overview',    ctrl.getOverview);
router.get('/timeline',    ctrl.getTimeline);
router.get('/blank-calls', ctrl.getBlankCalls);

export default router;
