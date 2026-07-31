import { Router } from 'express';
import { verifyToken } from '../../middleware/verifyToken';
import { injectTenant } from '../../middleware/injectTenant';
import { requireRole } from '../../middleware/requireRole';
import { requireDashboardAccess } from '../../middleware/requireDashboardAccess';
import * as ctrl from './task-scheduler.controller';

const router = Router();

router.use(
  verifyToken, injectTenant,
  requireRole('super_admin', 'admin', 'manager', 'client_admin'),
  requireDashboardAccess('task-scheduler'),
);

router.get('/targets',   ctrl.getTargets);
router.get('/',          ctrl.list);
router.post('/',         ctrl.create);
router.patch('/:id',     ctrl.update);
router.delete('/:id',    ctrl.remove);
router.post('/:id/run-now', ctrl.runNow);

export default router;
