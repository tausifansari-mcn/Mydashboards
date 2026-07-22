import { Router } from 'express';
import { verifyToken } from '../../middleware/verifyToken';
import { injectTenant } from '../../middleware/injectTenant';
import { requireRole } from '../../middleware/requireRole';
import * as ctrl from './quality.controller';

const router = Router();

router.use(verifyToken, injectTenant, requireRole('super_admin', 'admin', 'manager', 'agent', 'client_admin'));

router.get('/clients',            ctrl.getClients);
router.get('/clients-summary',    ctrl.getClientsSummary);
router.get('/kpis',               ctrl.getKPIs);
router.get('/detail-analysis',    ctrl.getDetailAnalysis);
router.get('/customer-interaction-insights', ctrl.getCustomerInteractionInsights);
router.get('/objection-analysis', ctrl.getObjectionAnalysis);
router.get('/agent-nps-csat',     ctrl.getAgentNPSCSAT);
router.get('/clap-analysis',     ctrl.getClapAnalysis);
router.get('/agent-nps',          ctrl.getAgentNPS);
router.get('/missing-agents',     ctrl.getMissingAgents);
router.post('/agent-master',      ctrl.insertAgentMaster);
router.get('/magical-script',     ctrl.getMagicalScript);

export default router;
