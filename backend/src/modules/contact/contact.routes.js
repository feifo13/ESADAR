import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { requireRole } from '../../middlewares/require-role.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  createPublicContactMessage,
  getAdminContactMessage,
  getAdminContactMessages,
  replyAdminContactMessage,
  updateAdminContactMessageStatus,
} from './contact.controller.js';

const publicRouter = Router();
const adminRouter = Router();

publicRouter.post('/', asyncHandler(createPublicContactMessage));

adminRouter.use(requireAuth, requireRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR'));
adminRouter.get('/', asyncHandler(getAdminContactMessages));
adminRouter.get('/:id', asyncHandler(getAdminContactMessage));
adminRouter.patch('/:id/status', asyncHandler(updateAdminContactMessageStatus));
adminRouter.post('/:id/reply', asyncHandler(replyAdminContactMessage));

export { adminRouter, publicRouter };
