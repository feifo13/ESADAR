import { createRateLimiter } from './rate-limit.js';

const minute = 60 * 1000;
const hour = 60 * minute;

function normalizeIp(ip) {
  return String(ip || 'unknown').replace(/^::ffff:/, '');
}

function userOrIpKey(req) {
  const ip = normalizeIp(req.ip);
  const identity = req.auth?.userId ? `user:${req.auth.userId}` : 'guest';
  return `ip:${ip}:${identity}:${req.method}:${req.baseUrl}${req.route?.path || req.path}`;
}

export const loginRateLimit = createRateLimiter({
  name: 'auth-login',
  windowMs: 15 * minute,
  max: 10,
  message: 'Demasiados intentos de login. Intenta nuevamente en unos minutos.',
});

export const registerRateLimit = createRateLimiter({
  name: 'auth-register',
  windowMs: hour,
  max: 5,
  message: 'Demasiados registros desde este origen. Intenta nuevamente más tarde.',
});

export const passwordResetRateLimit = createRateLimiter({
  name: 'auth-password-reset',
  windowMs: hour,
  max: 5,
  message: 'Demasiadas solicitudes de recuperación. Intenta nuevamente más tarde.',
});

export const contactRateLimit = createRateLimiter({
  name: 'public-contact',
  windowMs: 15 * minute,
  max: 8,
  message: 'Demasiados mensajes enviados. Intenta nuevamente más tarde.',
});

export const leadRateLimit = createRateLimiter({
  name: 'public-leads',
  windowMs: 15 * minute,
  max: 15,
  message: 'Demasiadas solicitudes enviadas. Intenta nuevamente más tarde.',
});

export const offerRateLimit = createRateLimiter({
  name: 'public-offers',
  windowMs: 15 * minute,
  max: 20,
  message: 'Demasiadas solicitudes de ofertas. Intenta nuevamente más tarde.',
  keyGenerator: userOrIpKey,
});

export const checkoutRateLimit = createRateLimiter({
  name: 'public-checkout',
  windowMs: 15 * minute,
  max: 10,
  message: 'Demasiados intentos de checkout. Intenta nuevamente más tarde.',
  keyGenerator: userOrIpKey,
});

export const webhookRateLimit = createRateLimiter({
  name: 'webhooks',
  windowMs: minute,
  max: 120,
  message: 'Demasiadas notificaciones recibidas. Intenta nuevamente más tarde.',
});
