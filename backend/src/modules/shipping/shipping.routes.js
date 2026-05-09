import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { requireRole } from '../../middlewares/require-role.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  createAdminShippingMethod,
  getAdminShippingMethod,
  getAdminShippingMethods,
  removeAdminShippingMethod,
  updateAdminShippingMethod,
  updateAdminShippingMethodStatus,
} from './shipping.controller.js';

const router = Router();

router.use(requireAuth, requireRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR'));
router.get('/shipping', asyncHandler(getAdminShippingMethods));
router.post('/shipping', asyncHandler(createAdminShippingMethod));
router.get('/shipping/:id', asyncHandler(getAdminShippingMethod));
router.put('/shipping/:id', asyncHandler(updateAdminShippingMethod));
router.patch('/shipping/:id/status', asyncHandler(updateAdminShippingMethodStatus));
router.delete('/shipping/:id', asyncHandler(removeAdminShippingMethod));

export default router;
