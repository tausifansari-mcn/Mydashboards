import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyToken } from '../../middleware/verifyToken';
import { injectTenant } from '../../middleware/injectTenant';
import { requireDashboardAccess } from '../../middleware/requireDashboardAccess';
import * as ctrl from './call-audit.controller';

const router = Router();

// Each run downloads audio, calls an external transcription API, and an LLM call — meaningfully
// more expensive than a chat message, so a tighter limit than CAM BOT's chat endpoint.
const auditLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 6,
  message: { success: false, message: 'Too many audits in a short time. Please wait a moment and try again.' },
});

router.use(verifyToken, injectTenant, requireDashboardAccess('call-audit'));

router.post('/run', auditLimiter, ctrl.run);
router.post('/run-bulk', auditLimiter, ctrl.runBulk);
router.get('/history', ctrl.history);
router.get('/:id', ctrl.getOne);

export default router;
