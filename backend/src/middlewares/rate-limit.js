import { AppError } from '../utils/app-error.js';

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const bucketsByLimiter = new Map();

function normalizeIp(ip) {
  return String(ip || 'unknown').replace(/^::ffff:/, '');
}

function getBucket(limiterName, key, now, windowMs) {
  let limiterBuckets = bucketsByLimiter.get(limiterName);
  if (!limiterBuckets) {
    limiterBuckets = new Map();
    bucketsByLimiter.set(limiterName, limiterBuckets);
  }

  const bucketKey = `${limiterName}:${key}`;
  const current = limiterBuckets.get(bucketKey);
  if (!current || current.resetAt <= now) {
    const fresh = { count: 0, resetAt: now + windowMs };
    limiterBuckets.set(bucketKey, fresh);
    return fresh;
  }

  return current;
}

function cleanupExpiredBuckets(limiterName, now) {
  const limiterBuckets = bucketsByLimiter.get(limiterName);
  if (!limiterBuckets) return;

  for (const [key, bucket] of limiterBuckets.entries()) {
    if (bucket.resetAt <= now) limiterBuckets.delete(key);
  }
}

export function createRateLimiter({
  name,
  windowMs = DEFAULT_WINDOW_MS,
  max = 100,
  message = 'Demasiadas solicitudes. Intenta nuevamente más tarde.',
  keyGenerator,
} = {}) {
  if (!name) {
    throw new Error('createRateLimiter requires a name');
  }

  return function rateLimiter(req, res, next) {
    const now = Date.now();
    cleanupExpiredBuckets(name, now);

    const key = keyGenerator
      ? keyGenerator(req)
      : `${normalizeIp(req.ip)}:${req.method}:${req.baseUrl}${req.route?.path || req.path}`;
    const bucket = getBucket(name, key, now, windowMs);

    bucket.count += 1;

    const remaining = Math.max(max - bucket.count, 0);
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(retryAfterSeconds));

    if (bucket.count > max) {
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return next(new AppError(message, 429));
    }

    return next();
  };
}

export function resetRateLimitBucketsForTests() {
  bucketsByLimiter.clear();
}
