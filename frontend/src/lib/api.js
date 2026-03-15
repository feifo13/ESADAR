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

export function resolveAssetUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function apiFetch(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = new Headers(options.headers || {});
  const token = options.token ?? getStoredToken();

  if (!isFormData) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
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
