import { Router } from 'express';
import { verifyToken } from '../../middleware/verifyToken';
import { injectTenant } from '../../middleware/injectTenant';
import { requireRole } from '../../middleware/requireRole';
import * as ctrl from './processes.controller';

const router = Router();

// All authenticated users can fetch their own allowed processes
router.use(verifyToken, injectTenant);
router.get('/my', ctrl.myProcesses);

// Everything below is super_admin only
router.use(requireRole('super_admin'));
router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.post('/', ctrl.create);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);
router.post('/assign-user', ctrl.assignUser);
router.delete('/unassign-user', ctrl.unassignUser);
router.get('/user/:userId', ctrl.getUserProcesses);

export default router;
