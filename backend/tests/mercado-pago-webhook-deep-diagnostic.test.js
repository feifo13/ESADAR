import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import {
  verifyMercadoPagoSignature,
} from '../src/modules/webhooks/mercado-pago.webhook-security.js';

function hmac(secret, manifest) {
  return crypto
    .createHmac('sha256', secret)
    .update(manifest)
    .digest('hex');
}

function captureDiagnostic(fn) {
  const previous =
    process.env.MERCADO_PAGO_WEBHOOK_DIAGNOSTICS;

  const originalWarn =
    console.warn;

  const warnings = [];

  process.env.MERCADO_PAGO_WEBHOOK_DIAGNOSTICS =
    '1';

  console.warn = (...args) => {
    warnings.push(
      args.map(String).join(' '),
    );
  };

  try {
    fn();
  } finally {
    console.warn = originalWarn;

    if (previous == null) {
      delete process.env
        .MERCADO_PAGO_WEBHOOK_DIAGNOSTICS;
    } else {
      process.env
        .MERCADO_PAGO_WEBHOOK_DIAGNOSTICS =
        previous;
    }
  }

  const prefix =
    'MERCADO_PAGO_SIGNATURE_DIAGNOSTIC ';

  const line =
    warnings.find(
      value => value.startsWith(prefix),
    );

  assert.ok(line);

  return JSON.parse(
    line.slice(prefix.length),
  );
}

test(
  'raw request-id diagnostic detects full unsliced provider value',
  () => {
    const secret =
      'diagnostic-test-secret';

    const dataId =
      '123456789';

    const ts =
      '1700000000000';

    const rawRequestId =
      'AbCdEf0123456789'.repeat(10);

    const boundedRequestId =
      rawRequestId.slice(0, 120);

    const manifest =
      `id:${dataId};`
      + `request-id:${rawRequestId};`
      + `ts:${ts};`;

    const signatureHeader =
      `ts=${ts},v1=${hmac(secret, manifest)}`;

    let threw = false;

    const diagnostic =
      captureDiagnostic(() => {
        try {
          verifyMercadoPagoSignature({
            secret,
            signatureHeader,
            requestId: boundedRequestId,
            rawRequestId,
            dataId,
            bodyDataId: dataId,
          });
        } catch {
          threw = true;
        }
      });

    assert.equal(
      threw,
      true,
    );

    assert.equal(
      diagnostic.signatureValid,
      false,
    );

    assert.equal(
      diagnostic.requestIdTruncated,
      true,
    );

    assert.equal(
      diagnostic.requestIdTrimChanged,
      false,
    );

    assert.equal(
      diagnostic.hmacRawRequestIdMatches,
      true,
    );

    assert.equal(
      diagnostic
        .hmacCleanUnslicedRequestIdMatches,
      true,
    );
  },
);

test(
  'body data-id diagnostic remains non-authoritative',
  () => {
    const secret =
      'diagnostic-test-secret';

    const queryDataId =
      '123456789';

    const bodyDataId =
      '987654321';

    const requestId =
      'request-id-test';

    const ts =
      '1700000000001';

    const manifest =
      `id:${bodyDataId};`
      + `request-id:${requestId};`
      + `ts:${ts};`;

    const signatureHeader =
      `ts=${ts},v1=${hmac(secret, manifest)}`;

    let threw = false;

    const diagnostic =
      captureDiagnostic(() => {
        try {
          verifyMercadoPagoSignature({
            secret,
            signatureHeader,
            requestId,
            rawRequestId: requestId,
            dataId: queryDataId,
            bodyDataId,
          });
        } catch {
          threw = true;
        }
      });

    assert.equal(
      threw,
      true,
    );

    assert.equal(
      diagnostic.signatureValid,
      false,
    );

    assert.equal(
      diagnostic.bodyDataIdPresent,
      true,
    );

    assert.equal(
      diagnostic.bodyDataIdMatchesQuery,
      false,
    );

    assert.equal(
      diagnostic.hmacBodyDataIdMatches,
      true,
    );
  },
);
