import { pool } from '../../db/pool.js';
import { getCollectingSettings } from '../collecting/collecting.service.js';
import { applyMercadoPagoPaymentToOrder } from '../orders/orders.service.js';
import {
  getMercadoPagoSignedPaymentId,
  normalizeMercadoPagoPaymentId,
  verifyMercadoPagoSignature,
} from './mercado-pago.webhook-security.js';

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

function getProviderEventId(payload, query, requestId) {
  const value =
    clean(payload?.id)
    || getQueryValue(query, 'id')
    || clean(requestId);

  return value
    ? value.slice(0, 120)
    : null;
}

async function recordWebhookEvent({
  providerEventId,
  requestId,
  eventType,
  action,
  paymentId,
  payload,
  signatureValidated,
}) {
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
        signature_validated =
          GREATEST(
            signature_validated,
            VALUES(signature_validated)
          ),
        payload_json = VALUES(payload_json),
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

  const inserted =
    Number(result.affectedRows || 0) === 1;

  const [rows] = await pool.execute(
    `
      SELECT
        id,
        processing_status AS processingStatus,
        received_at AS receivedAt
      FROM mercado_pago_webhook_events
      WHERE provider_event_id = ?
      LIMIT 1
    `,
    [providerEventId],
  );

  const event = rows[0] || null;

  return {
    id: event?.id || result.insertId || null,
    duplicate: !inserted,
    processingStatus:
      event?.processingStatus || 'RECEIVED',
    receivedAt:
      event?.receivedAt || null,
  };
}

async function claimWebhookEventRetry(event) {
  if (!event?.id) return false;

  const [result] = await pool.execute(
    `
      UPDATE mercado_pago_webhook_events
      SET
        processing_status = 'RECEIVED',
        status_message = NULL,
        processed_at = NULL,
        received_at = NOW()
      WHERE id = ?
        AND (
          processing_status = 'FAILED'
          OR (
            processing_status = 'RECEIVED'
            AND received_at < DATE_SUB(NOW(), INTERVAL 30 SECOND)
          )
        )
    `,
    [event.id],
  );

  return Number(result.affectedRows || 0) === 1;
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

export async function handleMercadoPagoWebhook({
  payload,
  query,
  headers,
  auditContext,
}) {
  const settings = await getCollectingSettings();

  if (!settings.isMercadoPagoEnabled) {
    return {
      status: 'ignored',
      message: 'Mercado Pago esta deshabilitado.',
    };
  }

  const rawRequestId =
    headers['x-request-id'];

  const requestId =
    clean(rawRequestId).slice(0, 120);

  const eventType = normalizeEventType(
    payload?.type
    || getQueryValue(query, 'type')
    || getQueryValue(query, 'topic'),
  );

  const action =
    clean(
      payload?.action
      || getQueryValue(query, 'action'),
    ).slice(0, 120) || null;

  /*
   * Security boundary:
   * the payment identity used for signature verification and
   * provider lookup comes ONLY from query data.id.
   *
   * Body id/data.id and generic query id are not trusted as
   * substitutes for the signed resource identity.
   */
  const paymentId =
    getMercadoPagoSignedPaymentId(query);

  const signature =
    verifyMercadoPagoSignature({
      secret: settings.mercadoPagoWebhookSecret,
      signatureHeader: headers['x-signature'],
      requestId,
      rawRequestId,
      dataId: paymentId,
      bodyDataId: payload?.data?.id,
    });

  const providerEventId =
    getProviderEventId(
      payload,
      query,
      requestId,
    );

  const event =
    await recordWebhookEvent({
      providerEventId,
      requestId,
      eventType,
      action,
      paymentId,
      payload,
      signatureValidated: signature.valid,
    });

  /*
   * Provider notifications are at-least-once.
   * A terminal event is never fetched/applied twice.
   */
  if (
    event.duplicate
    && ['PROCESSED', 'IGNORED'].includes(
      event.processingStatus,
    )
  ) {
    return {
      status: 'ignored',
      message:
        'Evento Mercado Pago ya procesado anteriormente.',
    };
  }

  if (event.duplicate) {
    const retryClaimed =
      await claimWebhookEventRetry(event);

    if (!retryClaimed) {
      return {
        status: 'ignored',
        message:
          'Evento Mercado Pago ya se encuentra en procesamiento.',
      };
    }
  }

  const eventId = event.id;

  if (eventType !== 'payment') {
    const message =
      `Evento Mercado Pago ignorado: ${
        eventType || 'sin tipo'
      }.`;

    await finishWebhookEvent(
      eventId,
      {
        status: 'IGNORED',
        message,
      },
    );

    return {
      status: 'ignored',
      message,
    };
  }

  if (!settings.mercadoPagoAccessToken) {
    const message =
      'No hay Access Token de Mercado Pago configurado.';

    await finishWebhookEvent(
      eventId,
      {
        status: 'FAILED',
        message,
      },
    );

    return {
      status: 'failed',
      message,
    };
  }

  const paymentResponse =
    await fetchMercadoPagoPayment(
      paymentId,
      settings.mercadoPagoAccessToken,
    );

  if (!paymentResponse.ok) {
    const message =
      `No se pudo consultar el pago ${paymentId}: `
      + paymentResponse.message;

    await finishWebhookEvent(
      eventId,
      {
        status: 'FAILED',
        message,
        payment: paymentResponse.body,
      },
    );

    return {
      status: 'failed',
      message,
    };
  }

  const authoritativePaymentId =
    normalizeMercadoPagoPaymentId(
      paymentResponse.payment?.id,
    );

  if (
    !authoritativePaymentId
    || authoritativePaymentId !== paymentId
  ) {
    const message =
      'El pago consultado no coincide con el data.id '
      + 'firmado por Mercado Pago.';

    await finishWebhookEvent(
      eventId,
      {
        status: 'FAILED',
        message,
        payment: paymentResponse.payment,
      },
    );

    return {
      status: 'failed',
      message,
    };
  }

  const result =
    await applyMercadoPagoPaymentToOrder(
      paymentResponse.payment,
      auditContext,
    );

  const eventStatus =
    result.status === 'processed'
      ? 'PROCESSED'
      : result.status === 'ignored'
        ? 'IGNORED'
        : 'FAILED';

  await finishWebhookEvent(
    eventId,
    {
      status: eventStatus,
      message: result.message,
      orderId: result.orderId,
      payment: paymentResponse.payment,
    },
  );

  return result;
}
