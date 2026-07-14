import { Router } from 'express';
import { verifyToken } from '../../middleware/verifyToken';
import { injectTenant } from '../../middleware/injectTenant';
import { requireRole } from '../../middleware/requireRole';
import * as ctrl from './inbound.controller';

const router = Router();

router.use(verifyToken, injectTenant, requireRole('super_admin', 'admin', 'manager', 'agent', 'client_admin'));

// Overall (all projects)
router.get('/summary',             ctrl.getSummary);
router.get('/trend',               ctrl.getTrend);
router.get('/today',               ctrl.getToday);
router.get('/projects',            ctrl.getProjectsMeta);
router.get('/consolidated-trend',  ctrl.getConsolidatedTrend);

// Per-project
router.get('/project/:key',         ctrl.getProjectDetail);
router.get('/project/:key/hourly',  ctrl.getProjectHourly);
router.get('/project/:key/trend',   ctrl.getProjectTrend);

// Agent-wise
router.get('/agent-summary',        ctrl.getAgentSummary);

export default router;
