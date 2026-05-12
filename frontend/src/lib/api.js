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
      return 'Revisa los campos requeridos antes de continuar.';
    }
  }

  return 'Revisa los campos requeridos antes de continuar.';
}

function getStoredToken() {
  try {
    return JSON.parse(window.localStorage.getItem('miami-closet-token') || 'null');
  } catch {
    return null;
  }
}

function getAuthHeaders(headers = {}, tokenOverride) {
  const headersInstance = new Headers(headers);
  const token = tokenOverride ?? getStoredToken();

  if (token) {
    headersInstance.set('Authorization', `Bearer ${token}`);
  }

  return headersInstance;
}

export function resolveAssetUrl(path) {
  if (!path) return '';
  const normalized = String(path).trim().replace(/\\/g, '/');
  if (/^(https?:|data:|blob:)/i.test(normalized)) return normalized;
  return `${API_URL}${normalized.startsWith('/') ? normalized : `/${normalized}`}`;
}

export async function apiFetch(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = getAuthHeaders(options.headers || {}, options.token);

  if (!isFormData) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body: isFormData ? options.body : options.body ? JSON.stringify(options.body) : undefined,
  });

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
    throw error;
  }

  return payload;
}


const PUBLIC_CACHE_PREFIX = 'esadar-public-cache:';
const publicResponseCache = new Map();
const publicInFlightRequests = new Map();

function getCacheTimestamp() {
  return Date.now();
}

function readSessionCache(cacheKey) {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;

  try {
    const rawValue = window.sessionStorage.getItem(`${PUBLIC_CACHE_PREFIX}${cacheKey}`);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch {
    return null;
  }
}

function writeSessionCache(cacheKey, entry) {
  if (typeof window === 'undefined' || !window.sessionStorage) return;

  try {
    window.sessionStorage.setItem(`${PUBLIC_CACHE_PREFIX}${cacheKey}`, JSON.stringify(entry));
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
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body,
  });

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
