import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { requireRole } from '../../middlewares/require-role.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { getAdminUser, getAdminUsers, removeAdminUser, updateAdminUser, updateAdminUserPassword, updateAdminUserStatus } from './users.controller.js';

const router = Router();

router.use(requireAuth, requireRole('SUPER_ADMIN', 'ADMIN'));
router.get('/users', asyncHandler(getAdminUsers));
router.get('/users/:id', asyncHandler(getAdminUser));
router.put('/users/:id', asyncHandler(updateAdminUser));
router.patch('/users/:id/password', requireRole('SUPER_ADMIN'), asyncHandler(updateAdminUserPassword));
router.patch('/users/:id/status', asyncHandler(updateAdminUserStatus));
router.delete('/users/:id', asyncHandler(removeAdminUser));

export default router;
