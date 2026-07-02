import { Router } from 'express';
import { verifyToken } from '../../middleware/verifyToken';
import { injectTenant } from '../../middleware/injectTenant';
import { requireRole } from '../../middleware/requireRole';
import * as ctrl from './quality.controller';

const router = Router();

router.use(verifyToken, injectTenant, requireRole('super_admin', 'admin', 'manager', 'agent'));

router.get('/clients',            ctrl.getClients);
router.get('/clients-summary',    ctrl.getClientsSummary);
router.get('/kpis',               ctrl.getKPIs);
router.get('/detail-analysis',    ctrl.getDetailAnalysis);
router.get('/objection-analysis', ctrl.getObjectionAnalysis);
router.get('/agent-nps-csat',     ctrl.getAgentNPSCSAT);

export default router;
