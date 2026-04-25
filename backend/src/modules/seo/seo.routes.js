import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { requireAuth } from '../../middlewares/auth.js';
import { requireRole } from '../../middlewares/require-role.js';
import {
  getAdminSeoPages,
  getGoogleProductsFeed,
  getPublicArticleSeoConfig,
  getPublicSiteSeoConfig,
  getRobotsTxt,
  getSitemapXml,
  putAdminSeoPage,
} from './seo.controller.js';

const publicRouter = Router();
const adminRouter = Router();

publicRouter.get('/site', asyncHandler(getPublicSiteSeoConfig));
publicRouter.get('/articles/:slugOrId', asyncHandler(getPublicArticleSeoConfig));

adminRouter.use(requireAuth, requireRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR'));
adminRouter.get('/seo-pages', asyncHandler(getAdminSeoPages));
adminRouter.put('/seo-pages/:id', asyncHandler(putAdminSeoPage));

export const seoSpecialRouter = Router();
seoSpecialRouter.get('/robots.txt', asyncHandler(getRobotsTxt));
seoSpecialRouter.get('/sitemap.xml', asyncHandler(getSitemapXml));
seoSpecialRouter.get('/feeds/google-products.xml', asyncHandler(getGoogleProductsFeed));

export { adminRouter, publicRouter };
