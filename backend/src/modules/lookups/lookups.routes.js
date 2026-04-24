import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  getPublicBrands,
  getPublicCategories,
  getPublicLookups,
  getPublicPaymentMethods,
  getPublicShippingMethods,
  getPublicSizes,
} from './lookups.controller.js';

const router = Router();

router.get('/', asyncHandler(getPublicLookups));
router.get('/categories', asyncHandler(getPublicCategories));
router.get('/brands', asyncHandler(getPublicBrands));
router.get('/sizes', asyncHandler(getPublicSizes));
router.get('/shipping-methods', asyncHandler(getPublicShippingMethods));
router.get('/payment-methods', asyncHandler(getPublicPaymentMethods));

export default router;
