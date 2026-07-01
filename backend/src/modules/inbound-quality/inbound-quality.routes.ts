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
router.get('/social-threat-detail',   ctrl.getSocialThreatDetail);
router.get('/neg-signal-details',     ctrl.getTopNegativeSignalDetails);
router.get('/pos-signal-details',     ctrl.getTopPositiveSignals);
router.get('/pos-keyword-phrases',    ctrl.getPosKeywordPhrases);
router.get('/pos-keyword-leads',      ctrl.getPosKeywordLeads);
router.get('/transcript',             ctrl.getTranscript);
router.get('/abuse-detail',             ctrl.getAbuseDetail);
router.get('/neg-signal-detail',        ctrl.getNegSignalDetail);
router.get('/neg-keywords',             ctrl.getNegKeywords);
router.post('/neg-keywords',            ctrl.addNegKeyword);
router.patch('/neg-keywords/:id',       ctrl.updateNegKeyword);
router.post('/reload-neg-rules',        ctrl.reloadNegRules);
router.get('/potential-scams',          ctrl.getPotentialScams);
router.get('/potential-scams-detail',   ctrl.getPotentialScamsDetail);
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
router.get('/agent-master',             ctrl.getAgentMaster);
router.get('/missing-agents',           ctrl.getMissingAgents);
router.post('/agent-master',            ctrl.insertAgentMaster);
router.get('/repeat-call-detail',       ctrl.getRepeatCallDetail);
router.get('/raw-data',                 ctrl.getRawData);

export default router;
