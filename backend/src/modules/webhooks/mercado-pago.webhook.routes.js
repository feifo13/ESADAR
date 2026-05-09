import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { receiveMercadoPagoWebhook } from './mercado-pago.webhook.controller.js';

const router = Router();

router.post('/mercado-pago', asyncHandler(receiveMercadoPagoWebhook));

export default router;
