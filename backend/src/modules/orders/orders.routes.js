import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { optionalAuth, requireAuth } from '../../middlewares/auth.js';
import { requireRole } from '../../middlewares/require-role.js';
import {
  approveAdminOrder,
  cancelAdminOrder,
  createPublicOrder,
  getAdminOrder,
  getAdminOrders,
  shipAdminOrder,
} from './orders.controller.js';

const publicRouter = Router();
const adminRouter = Router();

publicRouter.post('/', optionalAuth, asyncHandler(createPublicOrder));

adminRouter.use(requireAuth, requireRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR'));
adminRouter.get('/', asyncHandler(getAdminOrders));
adminRouter.get('/:id', asyncHandler(getAdminOrder));
adminRouter.patch('/:id/approve', asyncHandler(approveAdminOrder));
adminRouter.patch('/:id/cancel', asyncHandler(cancelAdminOrder));
adminRouter.patch('/:id/ship', asyncHandler(shipAdminOrder));

export { adminRouter, publicRouter };
