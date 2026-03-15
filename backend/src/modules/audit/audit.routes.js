import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { getAuditLog } from './audit.controller.js';
import { requireAuth } from '../../middlewares/auth.js';
import { requireRole } from '../../middlewares/require-role.js';

const router = Router();

router.use(requireAuth, requireRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR'));
router.get('/', asyncHandler(getAuditLog));

export default router;
