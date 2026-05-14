import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { optionalAuth, requireAuth } from '../../middlewares/auth.js';
import { requireRole } from '../../middlewares/require-role.js';
import { checkoutRateLimit } from '../../middlewares/sensitive-rate-limits.js';
import {
  approveAdminOrder,
  cancelAdminOrder,
  createAdminOrderPayment,
  createPublicOrder,
  expireAdminOrderReservations,
  getAdminOrder,
  getAdminOrderReceiptPdf,
  getAdminOrders,
  shipAdminOrder,
} from './orders.controller.js';

const publicRouter = Router();
const adminRouter = Router();

publicRouter.post('/', optionalAuth, checkoutRateLimit, asyncHandler(createPublicOrder));

adminRouter.use(requireAuth, requireRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR'));
adminRouter.get('/', asyncHandler(getAdminOrders));
adminRouter.post('/expire-reservations', asyncHandler(expireAdminOrderReservations));
adminRouter.get('/:id/receipt.pdf', asyncHandler(getAdminOrderReceiptPdf));
adminRouter.get('/:id', asyncHandler(getAdminOrder));
adminRouter.post('/:id/payments', asyncHandler(createAdminOrderPayment));
adminRouter.patch('/:id/approve', asyncHandler(approveAdminOrder));
adminRouter.patch('/:id/cancel', asyncHandler(cancelAdminOrder));
adminRouter.patch('/:id/ship', asyncHandler(shipAdminOrder));

export { adminRouter, publicRouter };
