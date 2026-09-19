import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyToken } from '../../middleware/verifyToken';
import { injectTenant } from '../../middleware/injectTenant';
import { requireDashboardAccess } from '../../middleware/requireDashboardAccess';
import * as ctrl from './ai-bot.controller';

const router = Router();

// Chat calls an external AI API — rate-limit distinctly from the general API to bound cost/abuse,
// separate from any per-route limits elsewhere.
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many messages. Please wait a moment and try again.' },
});

router.use(verifyToken, injectTenant, requireDashboardAccess('ai-quality-copilot'));

router.post('/chat', chatLimiter, ctrl.chat);
router.get('/sessions', ctrl.listSessions);
router.get('/sessions/:sessionId/messages', ctrl.getSessionMessages);
router.post('/feedback', ctrl.feedback);

export default router;
