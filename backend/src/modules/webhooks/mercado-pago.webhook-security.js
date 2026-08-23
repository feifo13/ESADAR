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
  rawRequestId,
  dataId,
  bodyDataId,
}) {
  const signatureSecret =
    clean(secret);

  const effectiveRawRequestId =
    rawRequestId == null
      ? requestId
      : rawRequestId;

  const rawRequestIdText =
    effectiveRawRequestId == null
      ? ''
      : String(effectiveRawRequestId);

  const cleanRawRequestId =
    clean(effectiveRawRequestId);

  const normalizedRequestId =
    clean(requestId);

  const normalizedDataId =
    normalizeMercadoPagoPaymentId(
      dataId,
    ).toLowerCase();

  const normalizedBodyDataId =
    normalizeMercadoPagoPaymentId(
      bodyDataId,
    ).toLowerCase();

  if (!signatureSecret) {
    throw unauthorized(
      'Webhook Mercado Pago sin secret configurado.',
    );
  }

  if (!normalizedDataId) {
    throw unauthorized(
      'Firma Mercado Pago sin data.id valido.',
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
    + (
      normalizedRequestId
        ? `request-id:${normalizedRequestId};`
        : ''
    )
    + `ts:${ts};`;

  const calculatedHash =
    crypto
      .createHmac(
        'sha256',
        signatureSecret,
      )
      .update(manifest)
      .digest('hex');

  const signatureValid =
    safeEqualHex(
      calculatedHash,
      receivedHash,
    );

  if (
    process.env.MERCADO_PAGO_WEBHOOK_DIAGNOSTICS
      === '1'
  ) {
    const withoutRequestIdManifest =
      `id:${normalizedDataId};`
      + `ts:${ts};`;

    const withoutRequestIdHash =
      crypto
        .createHmac(
          'sha256',
          signatureSecret,
        )
        .update(withoutRequestIdManifest)
        .digest('hex');

    const diagnosticHash = (
      manifestValue,
    ) =>
      crypto
        .createHmac(
          'sha256',
          signatureSecret,
        )
        .update(manifestValue)
        .digest('hex');

    /*
     * Diagnostic only.
     *
     * Compare the exact provider request-id before
     * application trimming/storage bounding.
     */
    const rawRequestIdManifest =
      `id:${normalizedDataId};`
      + (
        rawRequestIdText
          ? `request-id:${rawRequestIdText};`
          : ''
      )
      + `ts:${ts};`;

    const rawRequestIdHash =
      diagnosticHash(
        rawRequestIdManifest,
      );

    const cleanUnslicedRequestIdManifest =
      `id:${normalizedDataId};`
      + (
        cleanRawRequestId
          ? `request-id:${cleanRawRequestId};`
          : ''
      )
      + `ts:${ts};`;

    const cleanUnslicedRequestIdHash =
      diagnosticHash(
        cleanUnslicedRequestIdManifest,
      );

    /*
     * Diagnostic only.
     *
     * Body data.id remains non-authoritative and is
     * never used to accept a signature or fetch payment.
     */
    const bodyDataIdManifest =
      normalizedBodyDataId
        ? (
          `id:${normalizedBodyDataId};`
          + (
            rawRequestIdText
              ? `request-id:${rawRequestIdText};`
              : ''
          )
          + `ts:${ts};`
        )
        : '';

    const bodyDataIdHash =
      bodyDataIdManifest
        ? diagnosticHash(
          bodyDataIdManifest,
        )
        : '';

    /*
     * Intentionally sanitized diagnostic.
     *
     * Never log secret, signature, request-id,
     * data.id, ts or any payment/customer data.
     */
    console.warn(
      'MERCADO_PAGO_SIGNATURE_DIAGNOSTIC '
      + JSON.stringify({
        signatureValid,
        requestIdPresent:
          Boolean(normalizedRequestId),
        dataIdPresent:
          Boolean(normalizedDataId),
        dataIdDecimalOnly:
          /^\d+$/.test(normalizedDataId),
        signatureHeaderPresent:
          Boolean(signatureHeader),
        tsPresent:
          Boolean(ts),
        tsNumeric:
          /^\d+$/.test(ts),
        v1Present:
          Boolean(receivedHash),
        v1Hex64:
          /^[a-f0-9]{64}$/i.test(
            receivedHash,
          ),
        manifestIncludesRequestId:
          Boolean(normalizedRequestId),
        rawRequestIdPresent:
          Boolean(rawRequestIdText),
        requestIdTrimChanged:
          rawRequestIdText
            !== cleanRawRequestId,
        requestIdTruncated:
          cleanRawRequestId
            !== normalizedRequestId,
        bodyDataIdPresent:
          Boolean(normalizedBodyDataId),
        bodyDataIdMatchesQuery:
          Boolean(normalizedBodyDataId)
          && normalizedBodyDataId
            === normalizedDataId,
        hmacRawRequestIdMatches:
          safeEqualHex(
            rawRequestIdHash,
            receivedHash,
          ),
        hmacCleanUnslicedRequestIdMatches:
          safeEqualHex(
            cleanUnslicedRequestIdHash,
            receivedHash,
          ),
        hmacBodyDataIdMatches:
          Boolean(bodyDataIdHash)
          && safeEqualHex(
            bodyDataIdHash,
            receivedHash,
          ),
        hmacWithoutRequestIdMatches:
          safeEqualHex(
            withoutRequestIdHash,
            receivedHash,
          ),
      }),
    );
  }

  if (!signatureValid) {
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
