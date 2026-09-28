import { Request, Response, NextFunction, Router } from 'express';
import multer from 'multer';
import { verifyToken } from '../../middleware/verifyToken';
import { injectTenant } from '../../middleware/injectTenant';
import { requireDashboardAccess } from '../../middleware/requireDashboardAccess';
import { requireRole } from '../../middleware/requireRole';
import * as ctrl from './call-rec-upload.controller';
import { hasCallRecProcessAccess, CallRecProcessKey } from './call-rec-upload.service';

// Having 'call-rec' dashboard access only means "can see the Call Rec Upload page" — it no longer
// implies "can upload for every process type" now that per-process grants exist. super_admin always
// passes, matching requireDashboardAccess's own convention elsewhere.
function requireCallRecProcess(processKey: CallRecProcessKey) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }
      if (req.user.role === 'super_admin') { next(); return; }
      const ok = await hasCallRecProcessAccess(req.user.id, processKey);
      if (!ok) { res.status(403).json({ success: false, message: 'You do not have upload access for this process — ask a Super Admin to grant it.' }); return; }
      next();
    } catch {
      res.status(500).json({ success: false, message: 'Failed to verify process access' });
    }
  };
}

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

router.get('/my-processes', ctrl.getMyProcesses);
router.get('/upload-limits', ctrl.getUploadLimits);
router.put('/upload-limits/:processKey', requireRole('super_admin'), ctrl.setUploadLimit);

router.post('/upload-housing-owner',     requireCallRecProcess('housingOwner'),   upload.single('file'), ctrl.uploadHousingOwner);
router.post('/upload-housing-premium',   requireCallRecProcess('housingPremium'), upload.single('file'), ctrl.uploadHousingPremium);
router.post('/upload-lp-feedback',       requireCallRecProcess('lpFeedback'),     upload.single('file'), ctrl.uploadLPFeedback);
router.post('/upload-lp-regional',       requireCallRecProcess('lpRegional'),     upload.single('file'), ctrl.uploadLPRegional);
router.post('/upload-lp-non-regional',   requireCallRecProcess('lpNonRegional'),  upload.single('file'), ctrl.uploadLPNonRegional);

router.get('/upload-logs',            ctrl.getCallRecUploadLogs);
router.delete('/upload-log/:batchId', ctrl.deleteCallRecUploadLog);

export default router;
