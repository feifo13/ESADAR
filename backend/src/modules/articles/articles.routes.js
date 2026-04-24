import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  createAdminArticle,
  exportAdminArticles,
  getAdminArticle,
  getAdminArticles,
  getPublicArticle,
  getPublicArticles,
  importAdminArticles,
  previewAdminArticleImport,
  updateAdminArticle,
  updateAdminArticleStatus,
  uploadAdminArticleImages,
} from './articles.controller.js';
import { requireAuth } from '../../middlewares/auth.js';
import { requireRole } from '../../middlewares/require-role.js';
import { uploadArticleImages, uploadArticleImportFile } from '../../middlewares/upload.js';

const publicRouter = Router();
const adminRouter = Router();

publicRouter.get('/', asyncHandler(getPublicArticles));
publicRouter.get('/:slugOrId', asyncHandler(getPublicArticle));

adminRouter.use(requireAuth, requireRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR'));
adminRouter.get('/', asyncHandler(getAdminArticles));
adminRouter.get('/export', asyncHandler(exportAdminArticles));
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
adminRouter.patch('/:id/status', asyncHandler(updateAdminArticleStatus));
adminRouter.post(
  '/:id/images',
  uploadArticleImages.array('images', 10),
  asyncHandler(uploadAdminArticleImages),
);

export { adminRouter, publicRouter };
