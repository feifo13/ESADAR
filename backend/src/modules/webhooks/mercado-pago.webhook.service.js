import crypto from 'node:crypto';
import { pool } from '../../db/pool.js';
import { forbidden } from '../../utils/app-error.js';
import { getCollectingSettings } from '../collecting/collecting.service.js';
import { applyMercadoPagoPaymentToOrder } from '../orders/orders.service.js';

const MERCADO_PAGO_PAYMENT_URL = 'https://api.mercadopago.com/v1/payments';

function clean(value) {
  if (value == null) return '';
  return String(value).trim();
}

function normalizeEventType(value) {
  const text = clean(value).toLowerCase().slice(0, 80);
  if (text === 'payments') return 'payment';
  return text;
}

function normalizeMercadoPagoPaymentId(value) {
  const text = clean(value);
  return /^\d{1,40}$/.test(text) ? text : '';
}

function normalizeJson(value) {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return JSON.stringify({ serializationError: true });
  }
}

function getQueryValue(query, key) {
  const value = query?.[key];
  if (Array.isArray(value)) return clean(value[0]);
  return clean(value);
}

function getNotificationPaymentId({ payload, query }) {
  const candidates = [
    getQueryValue(query, 'data.id'),
    clean(payload?.data?.id),
    getQueryValue(query, 'id'),
    clean(payload?.id),
  ];

  return candidates.map(normalizeMercadoPagoPaymentId).find(Boolean) || '';
}

function getProviderEventId(payload, query) {
  const value = clean(payload?.id) || getQueryValue(query, 'id') || '';
  return value ? value.slice(0, 120) : null;
}

function parseSignatureHeader(signatureHeader) {
  const parts = String(signatureHeader || '').split(',');
  const parsed = {};

  for (const part of parts) {
    const [rawKey, ...rest] = part.split('=');
    const key = clean(rawKey);
    const value = clean(rest.join('='));
    if (key && value) parsed[key] = value;
  }

  return parsed;
}

function safeEqualHex(a, b) {
  const left = Buffer.from(String(a || ''), 'hex');
  const right = Buffer.from(String(b || ''), 'hex');
  if (!left.length || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function verifyMercadoPagoSignature({ secret, signatureHeader, requestId, dataId }) {
  const signatureSecret = clean(secret);
  if (!signatureSecret) {
    return { required: false, valid: false, skipped: true };
  }

  const parsed = parseSignatureHeader(signatureHeader);
  const ts = parsed.ts;
  const receivedHash = parsed.v1;

  if (!signatureHeader || !ts || !receivedHash) {
    throw forbidden('Firma Mercado Pago ausente o incompleta.');
  }

  const normalizedRequestId = clean(requestId);
  const dataIdCandidates = [...new Set([clean(dataId).toLowerCase(), ''])];
  const manifests = dataIdCandidates.map((candidateDataId) => {
    const manifestParts = [];
    if (candidateDataId) manifestParts.push(`id:${candidateDataId};`);
    if (normalizedRequestId) manifestParts.push(`request-id:${normalizedRequestId};`);
    manifestParts.push(`ts:${ts};`);
    return manifestParts.join('');
  });

  const isValid = manifests.some((manifest) => {
    const calculatedHash = crypto
      .createHmac('sha256', signatureSecret)
      .update(manifest)
      .digest('hex');
    return safeEqualHex(calculatedHash, receivedHash);
  });

  if (!isValid) {
    throw forbidden('Firma Mercado Pago invalida.');
  }

  return { required: true, valid: true, skipped: false };
}

async function recordWebhookEvent({ providerEventId, requestId, eventType, action, paymentId, payload, signatureValidated }) {
  const [result] = await pool.execute(
    `
      INSERT INTO mercado_pago_webhook_events (
        provider_event_id,
        request_id,
        event_type,
        action,
        payment_id,
        processing_status,
        signature_validated,
        payload_json
      ) VALUES (?, ?, ?, ?, ?, 'RECEIVED', ?, ?)
      ON DUPLICATE KEY UPDATE
        request_id = VALUES(request_id),
        event_type = VALUES(event_type),
        action = VALUES(action),
        payment_id = VALUES(payment_id),
        processing_status = 'RECEIVED',
        signature_validated = VALUES(signature_validated),
        payload_json = VALUES(payload_json),
        received_at = NOW(),
        processed_at = NULL,
        attempt_count = attempt_count + 1
    `,
    [
      providerEventId,
      requestId || null,
      eventType || null,
      action || null,
      paymentId || null,
      signatureValidated ? 1 : 0,
      normalizeJson(payload),
    ],
  );

  if (result.insertId) return result.insertId;

  if (providerEventId) {
    const [rows] = await pool.execute(
      'SELECT id FROM mercado_pago_webhook_events WHERE provider_event_id = ? LIMIT 1',
      [providerEventId],
    );
    return rows[0]?.id || null;
  }

  return null;
}

async function finishWebhookEvent(eventId, { status, message, orderId = null, payment = null }) {
  if (!eventId) return;

  await pool.execute(
    `
      UPDATE mercado_pago_webhook_events
      SET
        processing_status = ?,
        status_message = ?,
        order_id = ?,
        payment_json = ?,
        processed_at = NOW()
      WHERE id = ?
    `,
    [
      status,
      message ? String(message).slice(0, 500) : null,
      orderId || null,
      payment ? normalizeJson(payment) : null,
      eventId,
    ],
  );
}

async function fetchMercadoPagoPayment(paymentId, accessToken) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${MERCADO_PAGO_PAYMENT_URL}/${encodeURIComponent(paymentId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    const responseText = await response.text();
    let body = null;
    try {
      body = responseText ? JSON.parse(responseText) : null;
    } catch {
      body = { raw: responseText };
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        body,
        message: body?.message || `Mercado Pago respondio ${response.status}`,
      };
    }

    return { ok: true, payment: body };
  } finally {
    clearTimeout(timeout);
  }
}

export async function handleMercadoPagoWebhook({ payload, query, headers, auditContext }) {
  const settings = await getCollectingSettings();
  const requestId = clean(headers['x-request-id']).slice(0, 120);
  const eventType = normalizeEventType(payload?.type || getQueryValue(query, 'type') || getQueryValue(query, 'topic'));
  const action = clean(payload?.action || getQueryValue(query, 'action')).slice(0, 120) || null;
  const paymentId = getNotificationPaymentId({ payload, query });
  const providerEventId = getProviderEventId(payload, query);

  const signature = verifyMercadoPagoSignature({
    secret: settings.mercadoPagoWebhookSecret,
    signatureHeader: headers['x-signature'],
    requestId,
    dataId: getQueryValue(query, 'data.id') || paymentId,
  });

  const eventId = await recordWebhookEvent({
    providerEventId,
    requestId,
    eventType,
    action,
    paymentId,
    payload,
    signatureValidated: signature.valid,
  });

  if (eventType !== 'payment') {
    const message = `Evento Mercado Pago ignorado: ${eventType || 'sin tipo'}.`;
    await finishWebhookEvent(eventId, { status: 'IGNORED', message });
    return { status: 'ignored', message };
  }

  if (!paymentId) {
    const message = 'Notificacion Mercado Pago sin data.id/payment id.';
    await finishWebhookEvent(eventId, { status: 'IGNORED', message });
    return { status: 'ignored', message };
  }

  if (!settings.mercadoPagoAccessToken) {
    const message = 'No hay Access Token de Mercado Pago configurado.';
    await finishWebhookEvent(eventId, { status: 'FAILED', message });
    return { status: 'failed', message };
  }

  const paymentResponse = await fetchMercadoPagoPayment(paymentId, settings.mercadoPagoAccessToken);
  if (!paymentResponse.ok) {
    const message = `No se pudo consultar el pago ${paymentId}: ${paymentResponse.message}`;
    await finishWebhookEvent(eventId, {
      status: 'FAILED',
      message,
      payment: paymentResponse.body,
    });
    return { status: 'failed', message };
  }

  const result = await applyMercadoPagoPaymentToOrder(paymentResponse.payment, auditContext);
  const eventStatus = result.status === 'processed'
    ? 'PROCESSED'
    : result.status === 'ignored'
      ? 'IGNORED'
      : 'FAILED';

  await finishWebhookEvent(eventId, {
    status: eventStatus,
    message: result.message,
    orderId: result.orderId,
    payment: paymentResponse.payment,
  });

  return result;
}
