import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { requireRole } from '../../middlewares/require-role.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  createPublicContactMessage,
  getAdminContactMessages,
  updateAdminContactMessageStatus,
} from './contact.controller.js';

const publicRouter = Router();
const adminRouter = Router();

publicRouter.post('/', asyncHandler(createPublicContactMessage));

adminRouter.use(requireAuth, requireRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR'));
adminRouter.get('/', asyncHandler(getAdminContactMessages));
adminRouter.patch('/:id/status', asyncHandler(updateAdminContactMessageStatus));

export { adminRouter, publicRouter };
