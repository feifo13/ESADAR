import { Router } from 'express';
import { optionalAuth, requireAuth } from '../../middlewares/auth.js';
import { requireRole } from '../../middlewares/require-role.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  createPublicOffer,
  getAcceptedOffers,
  getArticleOfferEligibility,
  getMyOffers,
  getAdminOffers,
  updateAdminOfferStatus,
} from './offers.controller.js';

const publicRouter = Router();
const adminRouter = Router();

publicRouter.get('/mine', requireAuth, asyncHandler(getMyOffers));
publicRouter.get('/accepted', requireAuth, asyncHandler(getAcceptedOffers));
publicRouter.get('/article/:articleId/eligibility', requireAuth, asyncHandler(getArticleOfferEligibility));
publicRouter.post('/', optionalAuth, asyncHandler(createPublicOffer));

adminRouter.use(requireAuth, requireRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR'));
adminRouter.get('/', asyncHandler(getAdminOffers));
adminRouter.patch('/:id/status', asyncHandler(updateAdminOfferStatus));

export { adminRouter, publicRouter };
