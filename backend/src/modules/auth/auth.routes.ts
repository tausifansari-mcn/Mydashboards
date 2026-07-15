import { Router } from 'express';
import * as ctrl from './auth.controller';
import { verifyToken } from '../../middleware/verifyToken';
import rateLimit from 'express-rate-limit';
import { getSaleBrands, getSaleUploaderBrands } from '../users/users.service';

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
router.patch('/avatar', verifyToken, ctrl.updateAvatar);
router.post('/send-test-email', verifyToken, ctrl.sendTestEmail);
router.get('/me/sale-brands', verifyToken, async (req, res) => {
  try {
    const brands = await getSaleBrands(req.user!.id);
    res.json(brands);
  } catch { res.json([]); }
});

router.get('/me/sale-uploader-brands', verifyToken, async (req, res) => {
  try {
    const brands = await getSaleUploaderBrands(req.user!.id);
    res.json(brands);
  } catch { res.json([]); }
});

export default router;
