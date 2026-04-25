import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { requireAuth } from '../../middlewares/auth.js';
import { requireRole } from '../../middlewares/require-role.js';
import {
  getAdminWishlist,
  getAdminWishlists,
  getAdminWishlistsSummary,
  getAdminWishlistsTopArticles,
  getAdminWishlistsTopUsers,
} from './wishlists.controller.js';

const router = Router();

router.use(requireAuth, requireRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR'));
router.get('/wishlists/summary', asyncHandler(getAdminWishlistsSummary));
router.get('/wishlists/top-articles', asyncHandler(getAdminWishlistsTopArticles));
router.get('/wishlists/top-users', asyncHandler(getAdminWishlistsTopUsers));
router.get('/wishlists/:id', asyncHandler(getAdminWishlist));
router.get('/wishlists', asyncHandler(getAdminWishlists));

export default router;
