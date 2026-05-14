import { Router } from 'express';
import { webhookRateLimit } from '../../middlewares/sensitive-rate-limits.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { receiveMercadoPagoWebhook } from './mercado-pago.webhook.controller.js';

const router = Router();

router.post('/mercado-pago', webhookRateLimit, asyncHandler(receiveMercadoPagoWebhook));

export default router;
