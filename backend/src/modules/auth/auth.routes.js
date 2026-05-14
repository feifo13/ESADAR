import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { optionalAuth } from '../../middlewares/auth.js';
import {
  loginRateLimit,
  passwordResetRateLimit,
  registerRateLimit,
} from '../../middlewares/sensitive-rate-limits.js';
import { forgotPassword, login, logout, me, register, resetPassword } from './auth.controller.js';

const router = Router();

router.post('/register', registerRateLimit, asyncHandler(register));
router.post('/login', loginRateLimit, asyncHandler(login));
router.post('/logout', asyncHandler(logout));
router.post('/forgot-password', passwordResetRateLimit, asyncHandler(forgotPassword));
router.post('/reset-password', passwordResetRateLimit, asyncHandler(resetPassword));
router.get('/me', optionalAuth, asyncHandler(me));

export default router;
