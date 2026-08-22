import crypto from 'node:crypto';
import { unauthorized } from '../../utils/app-error.js';

function clean(value) {
  if (value == null) return '';
  return String(value).trim();
}

function getQueryValue(query, key) {
  const value = query?.[key];

  if (Array.isArray(value)) {
    return clean(value[0]);
  }

  return clean(value);
}

export function normalizeMercadoPagoPaymentId(value) {
  const text = clean(value);

  return /^\d{1,40}$/.test(text)
    ? text
    : '';
}

export function getMercadoPagoSignedPaymentId(query) {
  return normalizeMercadoPagoPaymentId(
    getQueryValue(query, 'data.id'),
  );
}

function parseSignatureHeader(signatureHeader) {
  const parsed = {};

  for (
    const part
    of String(signatureHeader || '').split(',')
  ) {
    const [rawKey, ...rest] =
      part.split('=');

    const key = clean(rawKey);
    const value = clean(rest.join('='));

    if (key && value) {
      parsed[key] = value;
    }
  }

  return parsed;
}

function safeEqualHex(leftValue, rightValue) {
  const left =
    Buffer.from(
      String(leftValue || ''),
      'hex',
    );

  const right =
    Buffer.from(
      String(rightValue || ''),
      'hex',
    );

  if (
    !left.length
    || left.length !== right.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    left,
    right,
  );
}

export function verifyMercadoPagoSignature({
  secret,
  signatureHeader,
  requestId,
  dataId,
}) {
  const signatureSecret =
    clean(secret);

  const normalizedRequestId =
    clean(requestId);

  const normalizedDataId =
    normalizeMercadoPagoPaymentId(
      dataId,
    ).toLowerCase();

  if (!signatureSecret) {
    throw unauthorized(
      'Webhook Mercado Pago sin secret configurado.',
    );
  }

  if (
    !normalizedRequestId
    || !normalizedDataId
  ) {
    throw unauthorized(
      'Firma Mercado Pago sin request-id o data.id valido.',
    );
  }

  const parsed =
    parseSignatureHeader(
      signatureHeader,
    );

  const ts =
    clean(parsed.ts);

  const receivedHash =
    clean(parsed.v1);

  if (
    !signatureHeader
    || !ts
    || !receivedHash
  ) {
    throw unauthorized(
      'Firma Mercado Pago ausente o incompleta.',
    );
  }

  /*
   * Canonical Mercado Pago manifest.
   *
   * There is intentionally NO empty-data-id fallback.
   */
  const manifest =
    `id:${normalizedDataId};`
    + `request-id:${normalizedRequestId};`
    + `ts:${ts};`;

  const calculatedHash =
    crypto
      .createHmac(
        'sha256',
        signatureSecret,
      )
      .update(manifest)
      .digest('hex');

  if (
    !safeEqualHex(
      calculatedHash,
      receivedHash,
    )
  ) {
    throw unauthorized(
      'Firma Mercado Pago invalida.',
    );
  }

  return {
    required: true,
    valid: true,
    skipped: false,
  };
}
