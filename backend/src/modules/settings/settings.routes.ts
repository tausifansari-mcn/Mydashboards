import { Router } from 'express';
import { verifyToken } from '../../middleware/verifyToken';
import { requireRole } from '../../middleware/requireRole';
import { getSmtpStatusCtrl, updateSmtpPasswordCtrl } from './settings.controller';

const router = Router();

router.use(verifyToken, requireRole('super_admin'));
router.get('/smtp-status', getSmtpStatusCtrl);
router.put('/smtp-password', updateSmtpPasswordCtrl);

export default router;
