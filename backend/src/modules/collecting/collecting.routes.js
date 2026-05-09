import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { requireRole } from '../../middlewares/require-role.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { getAdminCollectingSettings, updateAdminCollectingSettings } from './collecting.controller.js';

const router = Router();

router.use(requireAuth, requireRole('SUPER_ADMIN', 'ADMIN'));
router.get('/collecting', asyncHandler(getAdminCollectingSettings));
router.put('/collecting', asyncHandler(updateAdminCollectingSettings));

export default router;
