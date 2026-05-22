import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { uploadSiteHeroImage } from '../../middlewares/upload.js';
import {
  getAdminHero,
  getSiteHero,
  postAdminHeroImage,
  putAdminHero,
} from './site.controller.js';

const publicRouter = Router();
const adminRouter = Router();

publicRouter.get('/hero', asyncHandler(getSiteHero));

adminRouter.use(requireAuth, requireRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR'));
adminRouter.get('/hero', asyncHandler(getAdminHero));
adminRouter.put('/hero', asyncHandler(putAdminHero));
adminRouter.post(
  '/hero/image',
  uploadSiteHeroImage.fields([
    { name: 'image', maxCount: 1 },
    { name: 'images', maxCount: 10 },
  ]),
  asyncHandler(postAdminHeroImage),
);

export { adminRouter, publicRouter };
