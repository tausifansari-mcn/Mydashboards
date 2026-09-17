import { Router } from 'express';
import { verifyToken } from '../../middleware/verifyToken';
import { injectTenant } from '../../middleware/injectTenant';
import { requireRole } from '../../middleware/requireRole';
import { enforceClientScope } from '../../middleware/enforceClientScope';
import { requireDashboardAccess } from '../../middleware/requireDashboardAccess';
import * as ctrl from './quality.controller';

const router = Router();

router.use(
  verifyToken, injectTenant,
  requireRole('super_admin', 'admin', 'manager', 'agent', 'client_admin', 'qa'),
  enforceClientScope(),
  requireDashboardAccess('quality'),
);

router.get('/clients',            ctrl.getClients);
router.get('/clients-summary',    ctrl.getClientsSummary);
router.get('/fraud-calls',        ctrl.getFraudCalls);
router.get('/case-actions',       ctrl.getCaseActions);
router.post('/case-actions',      ctrl.upsertCaseActionCtrl);
router.get('/kpis',               ctrl.getKPIs);
router.get('/sale-done-calls',    ctrl.getSaleDoneCalls);
router.get('/missed-opportunity-category-detail', ctrl.getMissedOpportunityCategoryDetail);
router.get('/housing-owner-cq-score', ctrl.getHousingOwnerCQScore);
router.get('/housing-owner-cq-score/details', ctrl.getHousingOwnerCQScoreDetails);
router.get('/housing-owner-cq-score/date-wise', ctrl.getHousingOwnerCQScoreDateWise);
router.get('/bellavita-cq-score', ctrl.getBellavitaCQScore);
router.get('/bellavita-cq-score/details', ctrl.getBellavitaCQScoreDetails);
router.get('/bellavita-cq-score/date-wise', ctrl.getBellavitaCQScoreDateWise);
router.get('/housing-premium-cq-score', ctrl.getHousingPremiumCQScore);
router.get('/housing-premium-cq-score/details', ctrl.getHousingPremiumCQScoreDetails);
router.get('/housing-premium-cq-score/date-wise', ctrl.getHousingPremiumCQScoreDateWise);
router.get('/gnc-cq-score', ctrl.getGncCQScore);
router.get('/gnc-cq-score/details', ctrl.getGncCQScoreDetails);
router.get('/gnc-cq-score/date-wise', ctrl.getGncCQScoreDateWise);
router.get('/housing-owner-compliance', ctrl.getHousingOwnerCompliance);
router.get('/housing-owner-compliance/drill', ctrl.getHousingOwnerComplianceDrill);
router.get('/bellavita-compliance/parameters',       ctrl.getBellavitaComplianceParameters);
router.post('/bellavita-compliance/parameters',      requireRole('super_admin', 'manager', 'client_admin'), ctrl.upsertBellavitaComplianceParameter);
router.get('/bellavita-compliance/product-master',   ctrl.getBellavitaProductMaster);
router.post('/bellavita-compliance/product-master',  requireRole('super_admin', 'manager', 'client_admin'), ctrl.upsertBellavitaProductMaster);
router.post('/bellavita-compliance/ingest',          ctrl.ingestBellavitaComplianceAudit);
router.get('/bellavita-compliance/monthly',          ctrl.getBellavitaComplianceMonthly);
router.get('/bellavita-compliance/calls',            ctrl.getBellavitaComplianceCalls);
router.get('/bellavita-compliance/calls/:callId',    ctrl.getBellavitaComplianceCallDetail);
router.get('/bellavita-compliance/calls/:callId/transcript', ctrl.getBellavitaComplianceCallTranscript);
router.get('/magical-script-category-sale-done', ctrl.getMagicalCategorySaleDoneCalls);
router.get('/magical-script-category-call-end', ctrl.getMagicalCategoryCallEndCalls);
router.get('/magical-script-stage-call-end',     ctrl.getMagicalStageCallEndCalls);
router.get('/raw-data',                          requireDashboardAccess('raw-data'), ctrl.getRawCallData);
router.get('/raw-data/campaigns',                requireDashboardAccess('raw-data'), ctrl.getRawDataCampaigns);
router.get('/detail-analysis',    ctrl.getDetailAnalysis);
router.get('/customer-interaction-insights', ctrl.getCustomerInteractionInsights);
router.get('/customer-interaction-insights/drill', ctrl.getOutboundInsightDrill);
router.get('/customer-interaction-insights/transcript', ctrl.getOutboundCallTranscript);
router.get('/objection-analysis', ctrl.getObjectionAnalysis);
router.get('/agent-nps-csat',     ctrl.getAgentNPSCSAT);
router.get('/clap-analysis',     ctrl.getClapAnalysis);
router.get('/agent-nps',          ctrl.getAgentNPS);
router.get('/missing-agents',     ctrl.getMissingAgents);
router.get('/lob-options',        ctrl.getLOBOptions);
router.post('/agent-master',      ctrl.insertAgentMaster);
router.get('/magical-script',     ctrl.getMagicalScript);
router.get('/magical-script-config',    ctrl.getMagicalScriptConfig);
router.get('/export-all-csv',           ctrl.exportAllCsv);
router.post('/magical-script-config',   requireRole('super_admin', 'manager', 'client_admin'), ctrl.saveMagicalScriptConfig);
router.delete('/magical-script-config/:id', requireRole('super_admin', 'manager', 'client_admin'), ctrl.deleteMagicalScriptConfig);

export default router;
