import { Router } from 'express';
import multer from 'multer';
import { verifyToken } from '../../middleware/verifyToken';
import { injectTenant } from '../../middleware/injectTenant';
import { requireRole } from '../../middleware/requireRole';
import * as ctrl from './sales.controller';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const router = Router();

router.use(verifyToken, injectTenant, requireRole('super_admin', 'admin', 'manager', 'agent'));

router.get('/kpis',          ctrl.getKPIs);
router.get('/trend',         ctrl.getTrend);
router.get('/by-lob',        ctrl.getByLob);
router.get('/payment',       ctrl.getPayment);
router.get('/products',      ctrl.getProducts);
router.get('/agents',        ctrl.getAgents);
router.get('/sub-scenarios', ctrl.getSubScenarios);
router.get('/lob-list',      ctrl.getLobList);
router.get('/clients',       ctrl.getClients);
router.get('/export',        ctrl.exportSales);
router.post('/upload-bellavita',  upload.single('file'), ctrl.uploadBellavita);
router.post('/upload-gnc',        upload.single('file'), ctrl.uploadGnc);
router.post('/upload-gnc-apr',    upload.single('file'), ctrl.uploadGncApr);
router.post('/upload-gnc-allocation', upload.single('file'), ctrl.uploadGncAllocation);
router.post('/upload-bellavita-apr',  upload.single('file'), ctrl.uploadBellavitaApr);
router.post('/upload-bellavita-chat', upload.single('file'), ctrl.uploadBellavitaChat);
router.post('/upload-bellavita-cart', upload.single('file'), ctrl.uploadBellavitaCart);
router.get('/upload-logs',              ctrl.getUploadLogs);
router.delete('/upload-log/:batchId',   ctrl.deleteUploadLog);

export default router;
