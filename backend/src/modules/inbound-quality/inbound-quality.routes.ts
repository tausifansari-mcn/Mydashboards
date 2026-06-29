import { Router } from 'express';
import { verifyToken } from '../../middleware/verifyToken';
import { injectTenant } from '../../middleware/injectTenant';
import { requireRole } from '../../middleware/requireRole';
import * as ctrl from './inbound-quality.controller';

const router = Router();

router.use(verifyToken, injectTenant, requireRole('super_admin', 'admin', 'manager', 'agent'));

router.get('/clients',        ctrl.getInboundClients);
router.get('/kpis',           ctrl.getInboundProcessKPIs);
router.get('/top-performers', ctrl.getTopPerformers);
router.get('/daily-scores',   ctrl.getDailyScores);
router.get('/scenarios',              ctrl.getScenarios);
router.get('/social-media-threats',   ctrl.getSocialMediaThreats);
router.get('/neg-signal-details',     ctrl.getTopNegativeSignalDetails);
router.get('/potential-scams',          ctrl.getPotentialScams);
router.get('/sensitive-word-analysis',  ctrl.getSensitiveWordAnalysis);
router.get('/fatal-analysis',           ctrl.getFatalAnalysis);
router.get('/detail-analysis',          ctrl.getDetailAnalysis);
router.get('/agent-param',              ctrl.getAgentParameterWise);
router.get('/quality-parameters',        ctrl.getQualityParameters);
router.get('/week-wise-quality',         ctrl.getWeekWiseQuality);
router.get('/day-wise-quality',         ctrl.getDayWiseQuality);
router.get('/repeat-analysis',          ctrl.getRepeatAnalysis);
router.get('/agent-audit-band',         ctrl.getAgentAuditBandSummary);
router.get('/band-detail',              ctrl.getBandDetail);
router.get('/repeat-call-detail',       ctrl.getRepeatCallDetail);
router.get('/raw-data',                 ctrl.getRawData);

export default router;
