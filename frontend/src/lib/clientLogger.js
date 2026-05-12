const MAX_MESSAGE_LENGTH = 500;
const MAX_STACK_LENGTH = 4000;
const MAX_METADATA_LENGTH = 6000;
let isSendingLog = false;
let listenersInstalled = false;

const SENSITIVE_KEYS = new Set([
  'authorization',
  'token',
  'access_token',
  'refresh_token',
  'password',
  'password_hash',
  'smtp_password',
  'secret',
  'cookie',
  'set-cookie',
]);

function truncate(value, maxLength) {
  const text = value == null ? '' : String(value);
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

function sanitizeValue(value, depth = 0) {
  if (depth > 4) return '[truncated-depth]';
  if (value == null) return value;
  if (typeof value === 'string') return truncate(value, 1000);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1));
  if (typeof value === 'object') {
    const sanitized = {};
    Object.entries(value).slice(0, 40).forEach(([key, item]) => {
      const normalizedKey = String(key).toLowerCase();
      sanitized[key] = SENSITIVE_KEYS.has(normalizedKey) || normalizedKey.includes('password') || normalizedKey.includes('token')
        ? '[redacted]'
        : sanitizeValue(item, depth + 1);
    });
    return sanitized;
  }
  return String(value);
}

function serializeMetadata(metadata) {
  try {
    return truncate(JSON.stringify(sanitizeValue(metadata || {})), MAX_METADATA_LENGTH);
  } catch {
    return '{}';
  }
}

function getRoute() {
  if (typeof window === 'undefined') return '';
  return `${window.location.pathname}${window.location.search}`;
}

function getUserAgent() {
  if (typeof navigator === 'undefined') return '';
  return navigator.userAgent || '';
}

function normalizeError(input) {
  if (input instanceof Error) return input;
  if (input?.reason instanceof Error) return input.reason;
  if (input?.error instanceof Error) return input.error;
  return new Error(typeof input === 'string' ? input : 'Error no capturado');
}

export async function logClientError(input, context = {}) {
  const error = normalizeError(input);
  const payload = {
    level: context.level || 'error',
    type: context.type || error.name || 'ClientError',
    message: truncate(error.message || context.message || 'Error no capturado', MAX_MESSAGE_LENGTH),
    stack: truncate(error.stack || '', MAX_STACK_LENGTH),
    route: truncate(context.route || getRoute(), 500),
    userAgent: truncate(getUserAgent(), 500),
    statusCode: Number(context.statusCode || error.status || 0) || null,
    requestId: truncate(context.requestId || error.payload?.requestId || error.requestId || '', 120),
    metadata: serializeMetadata({ ...context.metadata, source: context.source }),
  };

  if (import.meta.env.DEV) {
    console.error('[ESADAR client error]', payload, error);
  }

  if (typeof window === 'undefined' || isSendingLog) return;

  try {
    isSendingLog = true;
    const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
    await fetch(`${apiUrl}/api/client-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Logging must never break the app.
  } finally {
    isSendingLog = false;
  }
}

export function reportApiError(error, context = {}) {
  if (!error || error.__loggedByClientLogger) return;
  error.__loggedByClientLogger = true;
  void logClientError(error, {
    ...context,
    type: context.type || 'ApiError',
    statusCode: context.statusCode || error.status,
    requestId: context.requestId || error.payload?.requestId,
  });
}

export function installClientErrorListeners() {
  if (typeof window === 'undefined' || listenersInstalled) return;
  listenersInstalled = true;

  window.addEventListener('error', (event) => {
    void logClientError(event.error || event.message, {
      type: 'WindowError',
      source: 'window.error',
      metadata: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    void logClientError(event.reason, {
      type: 'UnhandledPromiseRejection',
      source: 'window.unhandledrejection',
    });
  });
}
