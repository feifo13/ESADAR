import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { requireAuth } from '../../middlewares/auth.js';
import { requireRole } from '../../middlewares/require-role.js';
import { uploadSiteHeroImage } from '../../middlewares/upload.js';
import {
  getAdminHero,
  getSiteHero,
  deleteAdminHeroImage,
  postAdminHeroImage,
  putAdminHero,
} from './site.controller.js';

const publicRouter = Router();
const adminRouter = Router();

publicRouter.get('/hero', asyncHandler(getSiteHero));

adminRouter.use(requireAuth, requireRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR'));
adminRouter.get('/hero', asyncHandler(getAdminHero));
adminRouter.put('/hero', asyncHandler(putAdminHero));
adminRouter.delete('/hero/images/:imageId', asyncHandler(deleteAdminHeroImage));
adminRouter.post(
  '/hero/image',
  uploadSiteHeroImage.fields([
    { name: 'image', maxCount: 1 },
    { name: 'images', maxCount: 10 },
    { name: 'desktopImage', maxCount: 1 },
    { name: 'desktopImages', maxCount: 10 },
    { name: 'mobileImage', maxCount: 1 },
    { name: 'mobileImages', maxCount: 10 },
  ]),
  asyncHandler(postAdminHeroImage),
);

export { adminRouter, publicRouter };
