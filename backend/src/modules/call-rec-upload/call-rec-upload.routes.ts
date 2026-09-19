import { Router } from 'express';
import multer from 'multer';
import { verifyToken } from '../../middleware/verifyToken';
import { injectTenant } from '../../middleware/injectTenant';
import { requireDashboardAccess } from '../../middleware/requireDashboardAccess';
import * as ctrl from './call-rec-upload.controller';

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

// Same 'call-rec' dashboard-access slug the sidebar already gates the Call Rec UI nav item on —
// this replaces the iframe that page used to embed, so access stays exactly as before.
router.use(verifyToken, injectTenant, requireDashboardAccess('call-rec'));

router.post('/upload-housing-owner',     upload.single('file'), ctrl.uploadHousingOwner);
router.post('/upload-housing-premium',   upload.single('file'), ctrl.uploadHousingPremium);
router.post('/upload-lp-feedback',       upload.single('file'), ctrl.uploadLPFeedback);
router.post('/upload-lp-regional',       upload.single('file'), ctrl.uploadLPRegional);
router.post('/upload-lp-non-regional',   upload.single('file'), ctrl.uploadLPNonRegional);

router.get('/upload-logs',            ctrl.getCallRecUploadLogs);
router.delete('/upload-log/:batchId', ctrl.deleteCallRecUploadLog);

export default router;
