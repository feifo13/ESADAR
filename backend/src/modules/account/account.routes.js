import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { requireAuth } from '../../middlewares/auth.js';
import {
  getPublicAccountAlerts,
  getPublicAccountOrders,
  getPublicAccountProfile,
  putPublicAccountProfile,
} from './account.controller.js';

const router = Router();

router.use(requireAuth);
router.get('/profile', asyncHandler(getPublicAccountProfile));
router.put('/profile', asyncHandler(putPublicAccountProfile));
router.patch('/profile', asyncHandler(putPublicAccountProfile));
router.get('/orders', asyncHandler(getPublicAccountOrders));
router.get('/alerts', asyncHandler(getPublicAccountAlerts));

export default router;
