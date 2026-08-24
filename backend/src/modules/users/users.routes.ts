import { Router } from 'express';
import { verifyToken } from '../../middleware/verifyToken';
import { injectTenant } from '../../middleware/injectTenant';
import { requireRole } from '../../middleware/requireRole';
import * as ctrl from './users.controller';

const router = Router();
router.use(verifyToken, injectTenant, requireRole('super_admin'));

router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.post('/', ctrl.create);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);
router.delete('/:id/permanent', ctrl.permanentDelete);
router.post('/:id/reset-password', ctrl.resetPassword);
router.get('/:id/sale-brands',          ctrl.getSaleBrands);
router.put('/:id/sale-brands',          ctrl.setSaleBrands);
router.get('/:id/sale-uploader-brands', ctrl.getSaleUploaderBrands);
router.put('/:id/sale-uploader-brands', ctrl.setSaleUploaderBrands);
router.get('/callrec/processes',        ctrl.getCallRecProcessCatalog);
router.get('/:id/callrec-processes',    ctrl.getCallRecProcesses);
router.put('/:id/callrec-processes',    ctrl.setCallRecProcesses);

export default router;
