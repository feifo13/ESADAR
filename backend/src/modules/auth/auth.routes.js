import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { requireAuth } from '../../middlewares/auth.js';
import { forgotPassword, login, me, register, resetPassword } from './auth.controller.js';

const router = Router();

router.post('/register', asyncHandler(register));
router.post('/login', asyncHandler(login));
router.post('/forgot-password', asyncHandler(forgotPassword));
router.post('/reset-password', asyncHandler(resetPassword));
router.get('/me', requireAuth, asyncHandler(me));

export default router;
