import { Router } from 'express';
import multer from 'multer';
import { verifyToken } from '../../middleware/verifyToken';
import { injectTenant } from '../../middleware/injectTenant';
import { requireRole } from '../../middleware/requireRole';
import * as ctrl from './sales.controller';

const ALLOWED_UPLOAD_MIMES = new Set([
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/csv',
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    if (ALLOWED_UPLOAD_MIMES.has(file.mimetype) || ext === '.xlsx' || ext === '.xls' || ext === '.csv') {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx, .xls, or .csv files are allowed'));
    }
  },
});
const router = Router();

router.use(verifyToken, injectTenant, requireRole('super_admin', 'admin', 'manager', 'agent', 'client_admin'));

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
router.post('/upload-bellavita-order-export', upload.single('file'), ctrl.uploadBellavitaOrderExport);
router.post('/upload-neemans-cart',       upload.single('file'), ctrl.uploadNeemansCart);
router.post('/upload-neemans-sale-raw',   upload.single('file'), ctrl.uploadNeemansSaleRaw);
router.post('/upload-neemans-allocation', upload.single('file'), ctrl.uploadNeemansAllocation);
router.get('/upload-logs',              ctrl.getUploadLogs);
router.delete('/upload-log/:batchId',   ctrl.deleteUploadLog);
router.get('/bellavita-dashboard',      ctrl.getBellavitaDashboard);
router.get('/neemans-targets',          ctrl.getNeemansTargets);
router.post('/neemans-targets',         requireRole('super_admin'), ctrl.setNeemansTarget);
router.get('/neemans-dashboard',        ctrl.getNeemansDashboard);
router.get('/neemans-agent-data',       ctrl.getNeemansAgentData);
router.get('/neemans-agent-weekly',     ctrl.getNeemansAgentWeeklyAchievement);
router.get('/neemans-sale-raw-export',  ctrl.getNeemansSaleRawExport);
router.get('/neemans-cdr-export',       ctrl.getNeemansCdrExport);
router.post('/upload-neemans-apr',      upload.single('file'), ctrl.uploadNeemansApr);
router.get('/neemans-apr-dashboard',    ctrl.getNeemansAprDashboard);
router.get('/neemans-apr-export',       ctrl.getNeemansAprExport);
router.get('/neemans-abc-cart-snap',    ctrl.getAbcCartSnap);
router.get   ('/nms-agent-details',       ctrl.listNmsAgentDetails);
router.post  ('/nms-agent-details',       ctrl.createNmsAgentDetail);
router.put   ('/nms-agent-details/:id',   ctrl.updateNmsAgentDetail);
router.delete('/nms-agent-details/:id',   ctrl.deleteNmsAgentDetail);

export default router;
