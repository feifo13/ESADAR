import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { optionalAuth, requireAuth } from '../../middlewares/auth.js';
import { requireRole } from '../../middlewares/require-role.js';
import { leadRateLimit } from '../../middlewares/sensitive-rate-limits.js';
import {
  createPublicArticleEvent,
  createPublicNewsletterLead,
  createPublicStockAlert,
  createPublicWishlistItem,
  deletePublicWishlistItem,
  getAdminArticleEvents,
  getAdminLead,
  getAdminLeads,
  getPublicWishlist,
  patchAdminLeadStatus,
  savePublicLeadPreferences,
} from './leads.controller.js';

const publicLeadRouter = Router();
const publicInteractionRouter = Router();
const adminRouter = Router();

publicLeadRouter.post('/newsletter', leadRateLimit, asyncHandler(createPublicNewsletterLead));
publicLeadRouter.post('/preferences', leadRateLimit, asyncHandler(savePublicLeadPreferences));
publicLeadRouter.post('/stock-alert', leadRateLimit, asyncHandler(createPublicStockAlert));
publicInteractionRouter.post('/wishlist/items', optionalAuth, asyncHandler(createPublicWishlistItem));
publicInteractionRouter.delete('/wishlist/items/:articleId', optionalAuth, asyncHandler(deletePublicWishlistItem));
publicInteractionRouter.get('/wishlist', optionalAuth, asyncHandler(getPublicWishlist));
publicInteractionRouter.post('/article-events', optionalAuth, leadRateLimit, asyncHandler(createPublicArticleEvent));

adminRouter.use(requireAuth, requireRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR'));
adminRouter.get('/leads', asyncHandler(getAdminLeads));
adminRouter.get('/leads/:id', asyncHandler(getAdminLead));
adminRouter.patch('/leads/:id/status', asyncHandler(patchAdminLeadStatus));
adminRouter.get('/article-events', asyncHandler(getAdminArticleEvents));

export { adminRouter, publicInteractionRouter, publicLeadRouter };
