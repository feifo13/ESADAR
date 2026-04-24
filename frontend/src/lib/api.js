const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');

export function getApiUrl() {
  return API_URL;
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
    const message = payload?.message || payload?.error || 'Ocurrió un error en la API';
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
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

    const message = payload?.message || payload?.error || 'Ocurrio un error al exportar';
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const matchedFileName = disposition.match(/filename="([^"]+)"/i)?.[1];
  const fileName = options.fileName || matchedFileName || 'export.bin';
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
