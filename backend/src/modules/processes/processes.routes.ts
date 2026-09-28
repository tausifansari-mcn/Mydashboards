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
router.post('/', ctrl.create);
// Literal paths ('/assign-user', '/unassign-user') must come before the '/:id' wildcard below —
// Express matches routes in registration order, and '/:id' matches any single path segment
// including these literal ones. With '/:id' registered first, DELETE /unassign-user was being
// swallowed by DELETE /:id (treating "unassign-user" as the id, which then 400'd as "Invalid
// process id" from ctrl.remove) — meaning removing a user's process assignment never actually
// reached ctrl.unassignUser and always silently failed.
router.post('/assign-user', ctrl.assignUser);
router.delete('/unassign-user', ctrl.unassignUser);
router.get('/user/:userId', ctrl.getUserProcesses);
router.get('/:id', ctrl.getOne);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

export default router;
