import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { requireRole } from '../../middlewares/require-role.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { getAdminUsers, removeAdminUser, updateAdminUserStatus } from './users.controller.js';

const router = Router();

router.use(requireAuth, requireRole('SUPER_ADMIN', 'ADMIN'));
router.get('/users', asyncHandler(getAdminUsers));
router.patch('/users/:id/status', asyncHandler(updateAdminUserStatus));
router.delete('/users/:id', asyncHandler(removeAdminUser));

export default router;
