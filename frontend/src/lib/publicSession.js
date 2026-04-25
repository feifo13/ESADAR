import { storage } from './storage.js';

const PUBLIC_SESSION_KEY = 'esadar-public-session-token';

export function getPublicSessionToken() {
  let token = storage.get(PUBLIC_SESSION_KEY, '');
  if (token) return token;

  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    token = crypto.randomUUID();
  } else {
    token = `esadar-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  storage.set(PUBLIC_SESSION_KEY, token);
  return token;
}
