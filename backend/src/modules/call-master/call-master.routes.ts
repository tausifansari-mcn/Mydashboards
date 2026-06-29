import { Router } from 'express';
import { verifyToken } from '../../middleware/verifyToken';
import { injectTenant } from '../../middleware/injectTenant';
import { requireRole } from '../../middleware/requireRole';
import * as ctrl from './call-master.controller';
import * as oiCtrl from './opening-intelligence.controller';
import * as ciCtrl from './customer-intelligence.controller';

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
router.get('/active-agents-list', ctrl.getActiveAgentsList);
router.get('/clients',      ctrl.getClientList);
router.get('/process-list', ctrl.getProcessList);
router.get('/fatal-by-day',            ctrl.getFatalByDay);
router.get('/export',                  ctrl.exportData);
router.get('/fatal-agent-summary',     ctrl.getFatalAgentSummary);
router.get('/agent-audit-summary',    ctrl.getAgentAuditSummary);

// ── Outbound Sales Intelligence ──
router.get('/outbound/summary',        ctrl.getOBSummary);
router.get('/outbound/daily-trend',    ctrl.getOBDailyTrend);
router.get('/outbound/hourly',         ctrl.getOBHourly);
router.get('/outbound/agents',         ctrl.getOBAgentPerf);
router.get('/outbound/agent-daily',    ctrl.getOBAgentDaily);
router.get('/outbound/disposition',    ctrl.getOBDisposition);
router.get('/outbound/products',       ctrl.getOBProductMix);
router.get('/outbound/not-interested', ctrl.getOBNotInterested);
router.get('/outbound/quality-params', ctrl.getOBQualityParams);

// ── Opening Intelligence & Context Setting Intelligence ──
router.get('/opening-intelligence/executive-summary',  oiCtrl.getOIExecutiveSummary);
router.get('/opening-intelligence/opening-categories', oiCtrl.getOpeningByCategory);
router.get('/opening-intelligence/opening-raw',        oiCtrl.getOpeningRawCategories);
router.get('/opening-intelligence/opening-trend',      oiCtrl.getOpeningTrend);
router.get('/opening-intelligence/opening-by-dim',     oiCtrl.getOpeningByDimension);
router.get('/opening-intelligence/context-categories', oiCtrl.getContextByCategory);
router.get('/opening-intelligence/context-trend',      oiCtrl.getContextTrend);
router.get('/opening-intelligence/context-by-dim',     oiCtrl.getContextByDimension);
router.get('/opening-intelligence/opening-vs-sales',   oiCtrl.getOpeningVsSales);
router.get('/opening-intelligence/leaderboard',        oiCtrl.getOpeningLeaderboard);
router.get('/opening-intelligence/ai-insights',        oiCtrl.getOIAIInsights);

// ── Customer Intelligence & VOC ──
router.get('/customer-intelligence/executive-summary',   ciCtrl.getCIExecutiveSummary);
router.get('/customer-intelligence/sentiment',           ciCtrl.getSentimentDistribution);
router.get('/customer-intelligence/sentiment-trend',     ciCtrl.getSentimentTrend);
router.get('/customer-intelligence/feedback-categories', ciCtrl.getFeedbackCategories);
router.get('/customer-intelligence/feedback-subcats',    ciCtrl.getFeedbackSubCategories);
router.get('/customer-intelligence/top-objections',      ciCtrl.getTopObjections);
router.get('/customer-intelligence/journey',             ciCtrl.getCustomerJourney);
router.get('/customer-intelligence/feedback-by-dim',     ciCtrl.getFeedbackByDimension);
router.get('/customer-intelligence/client-comparison',   ciCtrl.getClientComparison);
router.get('/customer-intelligence/campaign-comparison', ciCtrl.getCampaignComparison);
router.get('/customer-intelligence/agent-ranking',       ciCtrl.getAgentCXRanking);
router.get('/customer-intelligence/product-feedback',    ciCtrl.getProductFeedback);
router.get('/customer-intelligence/offering-funnel',     ciCtrl.getOfferingFunnel);
router.get('/customer-intelligence/ai-insights',         ciCtrl.getCIAIInsights);

export default router;
