import { env } from '../config/env.js';

const GOOGLE_IDENTITY_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "script-src 'self' https://accounts.google.com/gsi/client",
  "frame-src 'self' https://accounts.google.com/gsi/",
  "connect-src 'self' https://accounts.google.com/gsi/",
  "style-src 'self' https://accounts.google.com/gsi/style",
].join('; ');

const DEFAULT_PERMISSIONS_POLICY = [
  'accelerometer=()',
  'autoplay=()',
  'camera=()',
  'display-capture=()',
  'encrypted-media=()',
  'fullscreen=(self)',
  'geolocation=()',
  'gyroscope=()',
  'magnetometer=()',
  'microphone=()',
  'payment=()',
  'usb=()',
].join(', ');

export function securityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', DEFAULT_PERMISSIONS_POLICY);
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');

  if (env.isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }

  if (env.security.enableCsp) {
    res.setHeader(
      'Content-Security-Policy',
      GOOGLE_IDENTITY_CSP,
    );
  }

  next();
}
