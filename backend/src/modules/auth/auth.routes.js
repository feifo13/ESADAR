import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { optionalAuth } from '../../middlewares/auth.js';
import { forgotPassword, login, logout, me, register, resetPassword } from './auth.controller.js';

const router = Router();

router.post('/register', asyncHandler(register));
router.post('/login', asyncHandler(login));
router.post('/logout', asyncHandler(logout));
router.post('/forgot-password', asyncHandler(forgotPassword));
router.post('/reset-password', asyncHandler(resetPassword));
router.get('/me', optionalAuth, asyncHandler(me));

export default router;
