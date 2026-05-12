import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { requireAuth } from '../../middlewares/auth.js';
import { requireRole } from '../../middlewares/require-role.js';
import { createRateLimiter } from '../../middlewares/rate-limit.js';
import { getAdminClientLogs, postClientLog } from './client-logs.controller.js';

const publicRouter = Router();
const adminRouter = Router();

const clientLogRateLimit = createRateLimiter({
  name: 'client-logs',
  windowMs: 60 * 1000,
  max: 30,
  message: 'Demasiados reportes de errores recibidos. Intentá nuevamente más tarde.',
});

publicRouter.post('/', clientLogRateLimit, asyncHandler(postClientLog));
adminRouter.use(requireAuth, requireRole('SUPER_ADMIN', 'ADMIN'));
adminRouter.get('/client-logs', asyncHandler(getAdminClientLogs));

export { publicRouter, adminRouter };
