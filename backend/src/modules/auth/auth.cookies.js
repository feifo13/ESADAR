import { env } from '../../config/env.js';

export const ACCESS_TOKEN_COOKIE_NAME = 'esadar_access_token';

function parseDurationMs(value, fallbackMs) {
  if (!value) return fallbackMs;
  const raw = String(value).trim();
  const match = raw.match(/^(\d+)\s*([smhd])?$/i);
  if (!match) return fallbackMs;

  const amount = Number(match[1]);
  const unit = String(match[2] || 'ms').toLowerCase();
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    ms: 1,
  };

  return amount * (multipliers[unit] || multipliers.ms);
}

export function getAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: env.authCookieMaxAgeMs,
  };
}

export function setAuthCookie(res, token) {
  res.cookie(ACCESS_TOKEN_COOKIE_NAME, token, getAuthCookieOptions());
}

export function clearAuthCookie(res) {
  res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/',
  });
}

export function readCookie(req, cookieName) {
  const rawCookieHeader = req.headers.cookie || '';
  if (!rawCookieHeader) return null;

  const parts = rawCookieHeader.split(';');
  for (const part of parts) {
    const [name, ...valueParts] = part.trim().split('=');
    if (name !== cookieName) continue;
    const rawValue = valueParts.join('=');
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }

  return null;
}

export function getDefaultAuthCookieMaxAgeMs() {
  return parseDurationMs(env.jwtExpiresIn, 7 * 24 * 60 * 60 * 1000);
}
