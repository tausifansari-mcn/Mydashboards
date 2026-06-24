import { Router } from 'express';
import * as ctrl from './auth.controller';
import { verifyToken } from '../../middleware/verifyToken';
import rateLimit from 'express-rate-limit';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { message: 'Too many login attempts. Try again in a minute.' },
});

router.post('/login', loginLimiter, ctrl.login);
router.post('/refresh', ctrl.refresh);
router.post('/logout', ctrl.logout);
router.post('/forgot-password', ctrl.forgotPassword);
router.post('/reset-password', ctrl.resetPassword);
router.get('/me', verifyToken, ctrl.getMe);
router.patch('/change-password', verifyToken, ctrl.changePassword);

export default router;
