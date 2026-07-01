import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { requireRole } from '../../middlewares/require-role.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  createAdminArticleLot,
  exportAdminArticleLotProfitProjection,
  getAdminArticleLot,
  getAdminArticleLotOptions,
  getAdminArticleLotReport,
  getAdminArticleLots,
  updateAdminArticleLot,
  updateAdminArticleLotStatus,
} from './article-lots.controller.js';

const router = Router();

router.use(requireAuth, requireRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR'));

router.get('/article-lots', asyncHandler(getAdminArticleLots));
router.get('/article-lots/options', asyncHandler(getAdminArticleLotOptions));
router.get('/article-lots/:id', asyncHandler(getAdminArticleLot));
router.get('/article-lots/:id/report', asyncHandler(getAdminArticleLotReport));
router.get('/article-lots/:id/profit-projection/export', asyncHandler(exportAdminArticleLotProfitProjection));
router.post('/article-lots', requireRole('SUPER_ADMIN', 'ADMIN'), asyncHandler(createAdminArticleLot));
router.patch('/article-lots/:id', requireRole('SUPER_ADMIN', 'ADMIN'), asyncHandler(updateAdminArticleLot));
router.patch('/article-lots/:id/status', requireRole('SUPER_ADMIN', 'ADMIN'), asyncHandler(updateAdminArticleLotStatus));

export default router;
