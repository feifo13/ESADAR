import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { requireRole } from '../../middlewares/require-role.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  getAdminCostIntegrityReport,
  getAdminProfitProjectionReport,
  getAdminRealizedProfitsReport,
  getAdminSalesReport,
  getAdminStockReport,
  getAdminStockRotationReport,
} from './reports.controller.js';

const defaultHandlers = Object.freeze({
  sales: getAdminSalesReport,
  profitProjection: getAdminProfitProjectionReport,
  realizedProfits: getAdminRealizedProfitsReport,
  stock: getAdminStockReport,
  stockRotation: getAdminStockRotationReport,
  costIntegrity: getAdminCostIntegrityReport,
});

export function createReportsRouter(handlers = defaultHandlers) {
  const router = Router();
  router.use(requireAuth, requireRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR'));
  router.get('/sales', asyncHandler(handlers.sales));
  router.get('/profit-projection', asyncHandler(handlers.profitProjection));
  router.get('/realized-profits', asyncHandler(handlers.realizedProfits));
  router.get('/stock', asyncHandler(handlers.stock));
  router.get('/stock-rotation', asyncHandler(handlers.stockRotation));
  router.get('/cost-integrity', asyncHandler(handlers.costIntegrity));
  return router;
}

export default createReportsRouter();
