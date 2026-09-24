import { Router } from 'express';
import { verifyToken } from '../../middleware/verifyToken';
import { requireRole } from '../../middleware/requireRole';
import {
  getSmtpStatusCtrl, updateSmtpPasswordCtrl, getAiSettingsStatusCtrl, updateAiSettingsCtrl,
  getDeepgramStatusCtrl, updateDeepgramSettingsCtrl,
} from './settings.controller';

const router = Router();

router.use(verifyToken, requireRole('super_admin'));
router.get('/smtp-status', getSmtpStatusCtrl);
router.put('/smtp-password', updateSmtpPasswordCtrl);
router.get('/ai-status', getAiSettingsStatusCtrl);
router.put('/ai-settings', updateAiSettingsCtrl);
router.get('/deepgram-status', getDeepgramStatusCtrl);
router.put('/deepgram-settings', updateDeepgramSettingsCtrl);

export default router;
