import { Router } from 'express';
import { verifyToken } from '../../middleware/verifyToken';
import { injectTenant } from '../../middleware/injectTenant';
import { requireRole } from '../../middleware/requireRole';
import * as ctrl from './sbi-quality.controller';

const router = Router();

// Super-admin only — this dataset/dashboard isn't scoped to a client the normal way (see
// sbi-quality.service.ts), so it's gated purely by role rather than enforceClientScope/
// requireDashboardAccess.
router.use(verifyToken, injectTenant, requireRole('super_admin'));

router.get('/overview',           ctrl.getOverview);
router.get('/scenario-analysis',  ctrl.getScenarioAnalysis);
router.get('/agent-performance',  ctrl.getAgentPerformance);
router.get('/quality-insights',   ctrl.getQualityInsights);
router.get('/filter-options',     ctrl.getFilterOptions);
router.get('/export-csv',         ctrl.exportCsv);

export default router;
