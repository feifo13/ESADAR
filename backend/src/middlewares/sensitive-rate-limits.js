import { createRateLimiter } from './rate-limit.js';

const minute = 60 * 1000;
const hour = 60 * minute;

function userOrIpKey(req) {
  const userId = req.auth?.userId ? `user:${req.auth.userId}` : `ip:${req.ip}`;
  return `${userId}:${req.method}:${req.baseUrl}${req.route?.path || req.path}`;
}

export const loginRateLimit = createRateLimiter({
  name: 'auth-login',
  windowMs: 15 * minute,
  max: 10,
  message: 'Demasiados intentos de login. Intentá nuevamente en unos minutos.',
});

export const registerRateLimit = createRateLimiter({
  name: 'auth-register',
  windowMs: hour,
  max: 5,
  message: 'Demasiados registros desde este origen. Intentá nuevamente más tarde.',
});

export const passwordResetRateLimit = createRateLimiter({
  name: 'auth-password-reset',
  windowMs: hour,
  max: 5,
  message: 'Demasiadas solicitudes de recuperación. Intentá nuevamente más tarde.',
});

export const contactRateLimit = createRateLimiter({
  name: 'public-contact',
  windowMs: 15 * minute,
  max: 8,
  message: 'Demasiados mensajes enviados. Intentá nuevamente más tarde.',
});

export const leadRateLimit = createRateLimiter({
  name: 'public-leads',
  windowMs: 15 * minute,
  max: 15,
  message: 'Demasiadas solicitudes enviadas. Intentá nuevamente más tarde.',
});

export const offerRateLimit = createRateLimiter({
  name: 'public-offers',
  windowMs: 15 * minute,
  max: 20,
  message: 'Demasiadas solicitudes de ofertas. Intentá nuevamente más tarde.',
  keyGenerator: userOrIpKey,
});

export const checkoutRateLimit = createRateLimiter({
  name: 'public-checkout',
  windowMs: 15 * minute,
  max: 10,
  message: 'Demasiados intentos de checkout. Intentá nuevamente más tarde.',
  keyGenerator: userOrIpKey,
});

export const webhookRateLimit = createRateLimiter({
  name: 'webhooks',
  windowMs: minute,
  max: 120,
  message: 'Demasiadas notificaciones recibidas. Intentá nuevamente más tarde.',
});
