import { Router } from 'express';
import { createRateLimiter } from '../../middlewares/rate-limit.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { postPublicPageVisit } from './page-visits.controller.js';

const router = Router();

const pageVisitRateLimit = createRateLimiter({
  name: 'public-page-visits',
  windowMs: 60 * 1000,
  max: 120,
  message: 'Demasiados ingresos registrados. Intenta nuevamente más tarde.',
});

router.post('/', pageVisitRateLimit, asyncHandler(postPublicPageVisit));

export default router;
