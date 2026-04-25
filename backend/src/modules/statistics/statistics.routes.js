import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { requireAuth } from '../../middlewares/auth.js';
import { requireRole } from '../../middlewares/require-role.js';
import {
  exportAdminStatisticsReport,
  getAdminStatisticsMarketStudy,
  getAdminStatisticsProfit,
  getAdminStatisticsSalesOverTime,
  getAdminStatisticsSummary,
  getAdminStatisticsTopArticles,
  getAdminStatisticsTopCategories,
  getAdminStatisticsTopCustomers,
  getAdminStatisticsWishlist,
} from './statistics.controller.js';

const router = Router();

router.use(requireAuth, requireRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR'));
router.get('/statistics/summary', asyncHandler(getAdminStatisticsSummary));
router.get('/statistics/sales-over-time', asyncHandler(getAdminStatisticsSalesOverTime));
router.get('/statistics/top-articles', asyncHandler(getAdminStatisticsTopArticles));
router.get('/statistics/top-customers', asyncHandler(getAdminStatisticsTopCustomers));
router.get('/statistics/top-categories', asyncHandler(getAdminStatisticsTopCategories));
router.get('/statistics/profit', asyncHandler(getAdminStatisticsProfit));
router.get('/statistics/wishlist', asyncHandler(getAdminStatisticsWishlist));
router.get('/statistics/market-study', asyncHandler(getAdminStatisticsMarketStudy));
router.get('/statistics/export.xlsx', asyncHandler(exportAdminStatisticsReport));

export default router;
