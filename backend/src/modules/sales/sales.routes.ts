import { Router } from 'express';
import { verifyToken } from '../../middleware/verifyToken';
import { injectTenant } from '../../middleware/injectTenant';
import { requireRole } from '../../middleware/requireRole';
import * as ctrl from './sales.controller';

const router = Router();

router.use(verifyToken, injectTenant, requireRole('super_admin', 'admin', 'manager', 'agent'));

router.get('/kpis',          ctrl.getKPIs);
router.get('/trend',         ctrl.getTrend);
router.get('/by-lob',        ctrl.getByLob);
router.get('/payment',       ctrl.getPayment);
router.get('/products',      ctrl.getProducts);
router.get('/agents',        ctrl.getAgents);
router.get('/sub-scenarios', ctrl.getSubScenarios);
router.get('/lob-list',      ctrl.getLobList);
router.get('/clients',       ctrl.getClients);
router.get('/export',        ctrl.exportSales);

export default router;
