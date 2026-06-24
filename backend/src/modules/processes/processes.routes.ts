import { Router } from 'express';
import { verifyToken } from '../../middleware/verifyToken';
import { injectTenant } from '../../middleware/injectTenant';
import { requireRole } from '../../middleware/requireRole';
import * as ctrl from './processes.controller';

const router = Router();
router.use(verifyToken, injectTenant, requireRole('super_admin'));

router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.post('/', ctrl.create);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);
router.post('/assign-user', ctrl.assignUser);
router.delete('/unassign-user', ctrl.unassignUser);
router.get('/user/:userId', ctrl.getUserProcesses);

export default router;
