import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  createCartItem,
  deleteCartItem,
  deleteCurrentCart,
  getCurrentCart,
  patchCartItem,
} from './cart.controller.js';

const router = Router();

router.use(requireAuth);
router.get('/', asyncHandler(getCurrentCart));
router.post('/items', asyncHandler(createCartItem));
router.patch('/items/:id', asyncHandler(patchCartItem));
router.delete('/items/:id', asyncHandler(deleteCartItem));
router.delete('/', asyncHandler(deleteCurrentCart));

export default router;
