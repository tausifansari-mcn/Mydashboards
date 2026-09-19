import { Router } from 'express';
import { verifyToken } from '../../middleware/verifyToken';
import { requireRole } from '../../middleware/requireRole';
import { getSmtpStatusCtrl, updateSmtpPasswordCtrl, getAiSettingsStatusCtrl, updateAiSettingsCtrl } from './settings.controller';

const router = Router();

router.use(verifyToken, requireRole('super_admin'));
router.get('/smtp-status', getSmtpStatusCtrl);
router.put('/smtp-password', updateSmtpPasswordCtrl);
router.get('/ai-status', getAiSettingsStatusCtrl);
router.put('/ai-settings', updateAiSettingsCtrl);

export default router;
