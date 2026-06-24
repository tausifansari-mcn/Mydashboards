import { Router } from 'express';
import { verifyToken } from '../../middleware/verifyToken';
import { injectTenant } from '../../middleware/injectTenant';
import { requireRole } from '../../middleware/requireRole';
import * as ctrl from './call-master.controller';

const router = Router();

router.use(verifyToken, injectTenant, requireRole('super_admin', 'admin', 'manager', 'agent'));

router.get('/kpis', ctrl.getKPIs);
router.get('/quality-trend', ctrl.getQualityTrend);
router.get('/calls-by-client', ctrl.getCallsByClient);
router.get('/calls-by-hour', ctrl.getCallsByHour);
router.get('/calls-by-day', ctrl.getCallsByDay);
router.get('/calls-by-month', ctrl.getCallsByMonth);
router.get('/top-agents', ctrl.getTopAgents);
router.get('/sales-funnel', ctrl.getSalesFunnel);
router.get('/cx-parameters', ctrl.getCXParameters);
router.get('/agent-params', ctrl.getAgentParams);
router.get('/scenario-detail', ctrl.getScenarioDetail);
router.get('/clients', ctrl.getClientList);

export default router;
