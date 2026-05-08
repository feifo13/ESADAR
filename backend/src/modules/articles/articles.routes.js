import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  createAdminBulkArticles,
  createAdminArticle,
  createAdminArticleStockAdjustment,
  deleteAdminArticleImage,
  downloadAdminArticleImportTemplate,
  exportAdminArticles,
  getAdminArticle,
  getAdminArticles,
  getPublicArticle,
  getPublicArticles,
  getPublicRelatedArticles,
  importAdminArticles,
  previewAdminArticleImport,
  reorderAdminArticleImages,
  updateAdminArticleImage,
  updateAdminArticle,
  updateAdminArticleQuickFlags,
  updateAdminArticleStatus,
  uploadAdminArticleImages,
} from './articles.controller.js';
import { requireAuth } from '../../middlewares/auth.js';
import { requireRole } from '../../middlewares/require-role.js';
import { uploadArticleImages, uploadArticleImportFile } from '../../middlewares/upload.js';

const publicRouter = Router();
const adminRouter = Router();

publicRouter.get('/', asyncHandler(getPublicArticles));
publicRouter.get('/:slugOrId/related', asyncHandler(getPublicRelatedArticles));
publicRouter.get('/:slugOrId', asyncHandler(getPublicArticle));

adminRouter.use(requireAuth, requireRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR'));
adminRouter.get('/', asyncHandler(getAdminArticles));
adminRouter.get('/export', asyncHandler(exportAdminArticles));
adminRouter.post('/bulk', asyncHandler(createAdminBulkArticles));
adminRouter.get('/import/template', asyncHandler(downloadAdminArticleImportTemplate));
adminRouter.post(
  '/import/preview',
  uploadArticleImportFile.single('file'),
  asyncHandler(previewAdminArticleImport),
);
adminRouter.post(
  '/import',
  uploadArticleImportFile.single('file'),
  asyncHandler(importAdminArticles),
);
adminRouter.get('/:id', asyncHandler(getAdminArticle));
adminRouter.post('/', asyncHandler(createAdminArticle));
adminRouter.put('/:id', asyncHandler(updateAdminArticle));
adminRouter.post('/:id/stock-adjustments', asyncHandler(createAdminArticleStockAdjustment));
adminRouter.patch('/:id/quick-flags', asyncHandler(updateAdminArticleQuickFlags));
adminRouter.patch('/:id/status', asyncHandler(updateAdminArticleStatus));
adminRouter.post(
  '/:id/images',
  uploadArticleImages.array('images', 10),
  asyncHandler(uploadAdminArticleImages),
);
adminRouter.patch('/:articleId/images/:imageId', asyncHandler(updateAdminArticleImage));
adminRouter.delete('/:articleId/images/:imageId', asyncHandler(deleteAdminArticleImage));
adminRouter.post('/:articleId/images/reorder', asyncHandler(reorderAdminArticleImages));

export { adminRouter, publicRouter };
