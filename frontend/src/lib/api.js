import { reportApiError } from './clientLogger.js';
import { sanitizePublicUrl } from './seo.js';

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export function getApiUrl() {
  return API_URL;
}


function getApiErrorMessage(payload) {
  const rawMessage = payload?.message || payload?.error || '';
  if (String(rawMessage).toLowerCase() !== 'validation error') {
    return rawMessage;
  }

  const fieldErrors = payload?.details?.fieldErrors || payload?.details?.field_errors;
  if (fieldErrors && typeof fieldErrors === 'object') {
    const firstKey = Object.keys(fieldErrors).find((key) => {
      const value = fieldErrors[key];
      return Array.isArray(value) ? Boolean(value.length) : Boolean(value);
    });

    if (firstKey) {
      const detail = fieldErrors[firstKey];
      if (Array.isArray(detail) && detail[0]) return String(detail[0]);
      if (typeof detail === 'string' && detail) return detail;
      return 'Revisa los campos requeridos antes de continuar.';
    }
  }

  return 'Revisa los campos requeridos antes de continuar.';
}

function getAuthHeaders(headers = {}, tokenOverride) {
  const headersInstance = new Headers(headers);

  if (tokenOverride) {
    headersInstance.set('Authorization', `Bearer ${tokenOverride}`);
  }

  return headersInstance;
}

export function resolveAssetUrl(path) {
  if (!path) return '';
  const normalized = String(path).trim().replace(/\\/g, '/');
  if (/^https?:/i.test(normalized)) return sanitizePublicUrl(normalized);
  if (/^(data:|blob:)/i.test(normalized)) return normalized;
  const safeApiUrl = sanitizePublicUrl(API_URL);
  const safePath = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return safeApiUrl ? `${safeApiUrl}${safePath}` : safePath;
}

export async function apiFetch(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = getAuthHeaders(options.headers || {}, options.token);

  if (!isFormData) {
    headers.set('Content-Type', 'application/json');
  }

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: options.credentials || 'include',
      headers,
      body: isFormData ? options.body : options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (error) {
    reportApiError(error, { path, method: options.method || 'GET', type: 'network' });
    throw error;
  }

  let payload = null;
  const text = await response.text();
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { message: text || 'Unexpected response' };
  }

  if (!response.ok) {
    const message = getApiErrorMessage(payload) || 'Ocurrió un error en la API';
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    reportApiError(error, { path, method: options.method || 'GET', statusCode: response.status });
    throw error;
  }

  maybeInvalidatePublicCacheAfterMutation(path, options.method || 'GET');

  return payload;
}


const PUBLIC_CACHE_PREFIX = 'esadar-public-cache:';
const publicResponseCache = new Map();
const publicInFlightRequests = new Map();
const PUBLIC_CACHE_BUST_KEY = 'esadar-public-cache-bust';

function broadcastPublicCacheInvalidation(match = '') {
  if (typeof window === 'undefined') return;

  try {
    const payload = JSON.stringify({ match, at: Date.now() });
    window.localStorage?.setItem(PUBLIC_CACHE_BUST_KEY, payload);
    window.dispatchEvent(new CustomEvent('esadar:public-cache-invalidated', { detail: { match } }));
  } catch {
    // Cross-tab cache invalidation must never block the app.
  }
}

export function listenPublicCacheInvalidation(handler) {
  if (typeof window === 'undefined' || typeof handler !== 'function') {
    return () => {};
  }

  const handleInvalidation = (detail = {}) => {
    clearPublicCache(detail.match || '');
    handler(detail);
  };

  const handleCustom = (event) => {
    handleInvalidation(event?.detail || {});
  };

  const handleStorage = (event) => {
    if (event.key !== PUBLIC_CACHE_BUST_KEY || !event.newValue) return;
    try {
      handleInvalidation(JSON.parse(event.newValue));
    } catch {
      handleInvalidation({ match: '' });
    }
  };

  window.addEventListener('esadar:public-cache-invalidated', handleCustom);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener('esadar:public-cache-invalidated', handleCustom);
    window.removeEventListener('storage', handleStorage);
  };
}

function getPublicCacheStorageKey(cacheKey) {
  return `${PUBLIC_CACHE_PREFIX}${cacheKey}`;
}

function clearPublicCache(match = '') {
  const shouldRemove = (cacheKey) => {
    if (typeof match === 'function') return Boolean(match(cacheKey));
    if (!match) return true;
    return String(cacheKey).startsWith(String(match));
  };

  Array.from(publicResponseCache.keys()).forEach((cacheKey) => {
    if (shouldRemove(cacheKey)) publicResponseCache.delete(cacheKey);
  });

  Array.from(publicInFlightRequests.keys()).forEach((cacheKey) => {
    if (shouldRemove(cacheKey)) publicInFlightRequests.delete(cacheKey);
  });

  if (typeof window === 'undefined' || !window.sessionStorage) return;

  try {
    const keysToRemove = [];
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const storageKey = window.sessionStorage.key(index);
      if (!storageKey?.startsWith(PUBLIC_CACHE_PREFIX)) continue;
      const cacheKey = storageKey.slice(PUBLIC_CACHE_PREFIX.length);
      if (shouldRemove(cacheKey)) keysToRemove.push(storageKey);
    }
    keysToRemove.forEach((storageKey) => window.sessionStorage.removeItem(storageKey));
  } catch {
    // Cache invalidation must never block the app.
  }
}

export function invalidatePublicCache(match = '') {
  clearPublicCache(match);
  broadcastPublicCacheInvalidation(match);
}

function maybeInvalidatePublicCacheAfterMutation(path, method) {
  if (String(method || 'GET').toUpperCase() === 'GET') return;

  const normalizedPath = String(path || '');

  if (normalizedPath.startsWith('/api/admin/articles')) {
    invalidatePublicCache('/api/public/articles');
  }

  if (normalizedPath.startsWith('/api/admin/article-lots')) {
    invalidatePublicCache('/api/public/articles');
  }

  if (normalizedPath.startsWith('/api/admin/shipping')) {
    invalidatePublicCache('/api/public/lookups');
  }

  if (normalizedPath.startsWith('/api/admin/site')) {
    invalidatePublicCache('/api/site');
  }
}

function getCacheTimestamp() {
  return Date.now();
}

function readSessionCache(cacheKey) {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;

  try {
    const rawValue = window.sessionStorage.getItem(getPublicCacheStorageKey(cacheKey));
    return rawValue ? JSON.parse(rawValue) : null;
  } catch {
    return null;
  }
}

function writeSessionCache(cacheKey, entry) {
  if (typeof window === 'undefined' || !window.sessionStorage) return;

  try {
    window.sessionStorage.setItem(getPublicCacheStorageKey(cacheKey), JSON.stringify(entry));
  } catch {
    // Storage quotas or privacy settings should never block the app.
  }
}

function getCachedPublicResponse(cacheKey, ttlMs) {
  if (!cacheKey || ttlMs <= 0) return null;
  const now = getCacheTimestamp();
  const memoryEntry = publicResponseCache.get(cacheKey);

  if (memoryEntry && now - memoryEntry.cachedAt <= ttlMs) {
    return memoryEntry.payload;
  }

  const sessionEntry = readSessionCache(cacheKey);
  if (sessionEntry && now - sessionEntry.cachedAt <= ttlMs) {
    publicResponseCache.set(cacheKey, sessionEntry);
    return sessionEntry.payload;
  }

  return null;
}

function setCachedPublicResponse(cacheKey, payload) {
  if (!cacheKey) return payload;
  const entry = { cachedAt: getCacheTimestamp(), payload };
  publicResponseCache.set(cacheKey, entry);
  writeSessionCache(cacheKey, entry);
  return payload;
}

export async function cachedApiFetch(path, { ttlMs = 300000, cacheKey = path, force = false, ...options } = {}) {
  const method = String(options.method || 'GET').toUpperCase();

  if (method !== 'GET') {
    return apiFetch(path, options);
  }

  if (!force) {
    const cached = getCachedPublicResponse(cacheKey, ttlMs);
    if (cached) return cached;
  }

  if (publicInFlightRequests.has(cacheKey)) {
    return publicInFlightRequests.get(cacheKey);
  }

  const request = apiFetch(path, options)
    .then((payload) => setCachedPublicResponse(cacheKey, payload))
    .finally(() => {
      publicInFlightRequests.delete(cacheKey);
    });

  publicInFlightRequests.set(cacheKey, request);
  return request;
}

function getDownloadFileName(disposition = '') {
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim().replace(/^"|"$/g, ''));
    } catch {
      return utf8Match[1].trim().replace(/^"|"$/g, '');
    }
  }

  const quotedMatch = disposition.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) return quotedMatch[1].trim();

  const plainMatch = disposition.match(/filename=([^;]+)/i);
  if (plainMatch?.[1]) return plainMatch[1].trim().replace(/^"|"$/g, '');

  return '';
}

export async function apiDownload(path, options = {}) {
  const headers = getAuthHeaders(options.headers || {}, options.token);
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method || 'GET',
      credentials: options.credentials || 'include',
      headers,
      body: options.body,
    });
  } catch (error) {
    reportApiError(error, { path, method: options.method || 'GET', type: 'network' });
    throw error;
  }

  if (!response.ok) {
    let payload = null;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    const message = getApiErrorMessage(payload) || 'Ocurrio un error al exportar';
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    reportApiError(error, { path, method: options.method || 'GET', statusCode: response.status });
    throw error;
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const headerFileName = getDownloadFileName(disposition);
  const fallbackExtension = options.extension ? String(options.extension).replace(/^./, '') : 'bin';
  const fileName = headerFileName || options.fileName || `export.${fallbackExtension}`;
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);

  return { fileName };
}
