import { Router } from 'express';
import { verifyToken } from '../../middleware/verifyToken';
import { injectTenant } from '../../middleware/injectTenant';
import { requireRole } from '../../middleware/requireRole';
import * as ctrl from './dashboards.controller';

const router = Router();
router.use(verifyToken, injectTenant);

router.get('/my', ctrl.myDashboards);
router.get('/', requireRole('super_admin'), ctrl.list);
router.post('/grant', requireRole('super_admin'), ctrl.grant);
router.delete('/revoke', requireRole('super_admin'), ctrl.revoke);
router.get('/user/:userId/access', requireRole('super_admin'), ctrl.userAccess);

export default router;
