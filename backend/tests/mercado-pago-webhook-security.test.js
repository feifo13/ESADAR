import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  readFileSync,
} from 'node:fs';
import {
  dirname,
  resolve,
} from 'node:path';
import test from 'node:test';
import {
  fileURLToPath,
} from 'node:url';

import {
  getMercadoPagoSignedPaymentId,
  normalizeMercadoPagoPaymentId,
  verifyMercadoPagoSignature,
} from '../src/modules/webhooks/mercado-pago.webhook-security.js';

const currentDir =
  dirname(
    fileURLToPath(import.meta.url),
  );

const serviceSource =
  readFileSync(
    resolve(
      currentDir,
      '../src/modules/webhooks/mercado-pago.webhook.service.js',
    ),
    'utf8',
  );

function signature({
  secret,
  requestId,
  dataId,
  ts,
}) {
  const manifest =
    `id:${String(dataId).toLowerCase()};`
    + (
      requestId
        ? `request-id:${requestId};`
        : ''
    )
    + `ts:${ts};`;

  return crypto
    .createHmac(
      'sha256',
      secret,
    )
    .update(manifest)
    .digest('hex');
}

test(
  'signed payment id comes only from query data.id',
  () => {
    assert.equal(
      getMercadoPagoSignedPaymentId({
        'data.id': '123456',
        id: '999999',
      }),
      '123456',
    );

    assert.equal(
      getMercadoPagoSignedPaymentId({
        id: '999999',
      }),
      '',
    );

    assert.equal(
      getMercadoPagoSignedPaymentId({
        'data.id': 'not-numeric',
      }),
      '',
    );
  },
);

test(
  'payment id normalization is strict and bounded',
  () => {
    assert.equal(
      normalizeMercadoPagoPaymentId(' 123 '),
      '123',
    );

    assert.equal(
      normalizeMercadoPagoPaymentId('123abc'),
      '',
    );

    assert.equal(
      normalizeMercadoPagoPaymentId(
        '1'.repeat(41),
      ),
      '',
    );
  },
);

test(
  'valid canonical signature is accepted',
  () => {
    const secret =
      'test-webhook-secret';

    const requestId =
      'request-123';

    const dataId =
      '456789';

    const ts =
      '1720000000';

    const hash =
      signature({
        secret,
        requestId,
        dataId,
        ts,
      });

    assert.deepEqual(
      verifyMercadoPagoSignature({
        secret,
        requestId,
        dataId,
        signatureHeader:
          `ts=${ts},v1=${hash}`,
      }),
      {
        required: true,
        valid: true,
        skipped: false,
      },
    );
  },
);

test(
  'signature fails closed without secret',
  () => {
    assert.throws(
      () =>
        verifyMercadoPagoSignature({
          secret: '',
          requestId: 'request-1',
          dataId: '123',
          signatureHeader:
            'ts=1,v1=abcd',
        }),
      /sin secret configurado/i,
    );
  },
);

test(
  'signature requires request id and signed data id',
  () => {
    const hashWithoutRequestId =
      signature({
        secret: 'secret',
        requestId: '',
        dataId: '123',
        ts: '1',
      });

    assert.doesNotThrow(
      () =>
        verifyMercadoPagoSignature({
          secret: 'secret',
          requestId: '',
          dataId: '123',
          signatureHeader:
            `ts=1,v1=${hashWithoutRequestId}`,
        }),
    );

    assert.throws(
      () =>
        verifyMercadoPagoSignature({
          secret: 'secret',
          requestId: '',
          dataId: '123',
          signatureHeader:
            `ts=1,v1=${'0'.repeat(64)}`,
        }),
      /invalida/i,
    );

    assert.throws(
      () =>
        verifyMercadoPagoSignature({
          secret: 'secret',
          requestId: 'request-1',
          dataId: '',
          signatureHeader:
            'ts=1,v1=abcd',
        }),
      /data\.id/i,
    );
  },
);

test(
  'signature has no empty data-id fallback',
  () => {
    const secret =
      'secret';

    const requestId =
      'request-1';

    const ts =
      '12345';

    const emptyManifestHash =
      crypto
        .createHmac(
          'sha256',
          secret,
        )
        .update(
          `request-id:${requestId};ts:${ts};`,
        )
        .digest('hex');

    assert.throws(
      () =>
        verifyMercadoPagoSignature({
          secret,
          requestId,
          dataId: '',
          signatureHeader:
            `ts=${ts},v1=${emptyManifestHash}`,
        }),
      /data\.id/i,
    );
  },
);

test(
  'legacy empty data-id manifest fallback is absent',
  () => {
    assert.doesNotMatch(
      serviceSource,
      /dataIdCandidates/,
    );

    assert.doesNotMatch(
      serviceSource,
      /clean\(dataId\)\.toLowerCase\(\),\s*''/,
    );
  },
);

test(
  'invalid signature is rejected',
  () => {
    assert.throws(
      () =>
        verifyMercadoPagoSignature({
          secret: 'secret',
          requestId: 'request-1',
          dataId: '123',
          signatureHeader:
            'ts=123,v1=001122',
        }),
      /invalida/i,
    );
  },
);

test(
  'webhook transport ignores Mercado Pago before any signed processing when disabled',
  () => {
    const disabledIndex =
      serviceSource.indexOf(
        'if (!settings.isMercadoPagoEnabled)',
      );

    const verifyIndex =
      serviceSource.indexOf(
        'verifyMercadoPagoSignature({',
      );

    const fetchIndex =
      serviceSource.indexOf(
        'await fetchMercadoPagoPayment(',
      );

    assert.ok(disabledIndex >= 0);
    assert.ok(verifyIndex > disabledIndex);
    assert.ok(fetchIndex > verifyIndex);
  },
);

test(
  'webhook uses signed query payment id and verifies authoritative response identity',
  () => {
    assert.match(
      serviceSource,
      /paymentId\s*=\s*getMercadoPagoSignedPaymentId\(query\)/,
    );

    assert.match(
      serviceSource,
      /authoritativePaymentId !== paymentId/,
    );

    assert.doesNotMatch(
      serviceSource,
      /dataId:\s*getQueryValue\(query,\s*'data\.id'\)\s*\|\|/,
    );
  },
);

test(
  'duplicate terminal events are not fetched or applied twice',
  () => {
    assert.match(
      serviceSource,
      /\['PROCESSED', 'IGNORED'\]\.includes/,
    );

    assert.match(
      serviceSource,
      /Evento Mercado Pago ya procesado anteriormente/,
    );

    assert.match(
      serviceSource,
      /claimWebhookEventRetry/,
    );

    assert.match(
      serviceSource,
      /DATE_SUB\(NOW\(\), INTERVAL 30 SECOND\)/,
    );

    const recordStart =
      serviceSource.indexOf(
        "async function recordWebhookEvent(",
      );

    const retryStart =
      serviceSource.indexOf(
        "async function claimWebhookEventRetry(",
      );

    assert.ok(recordStart >= 0);
    assert.ok(retryStart > recordStart);

    const recordSource =
      serviceSource.slice(
        recordStart,
        retryStart,
      );

    assert.match(
      recordSource,
      /ON DUPLICATE KEY UPDATE/,
    );

    assert.doesNotMatch(
      recordSource,
      /processing_status = 'RECEIVED'/,
    );

    assert.doesNotMatch(
      recordSource,
      /processed_at = NULL/,
    );
  },
);

test(
  'diagnostico Mercado Pago es sanitizado y activable',
  () => {
    const envName =
      'MERCADO_PAGO_WEBHOOK_DIAGNOSTICS';

    const previousEnv =
      process.env[envName];

    const originalWarn =
      console.warn;

    const lines = [];

    const secret =
      'diag-secret-never-log';

    const requestId =
      'diag-request-never-log';

    const dataId =
      '987654321098765432';

    const ts =
      '1720001111';

    const validHash =
      signature({
        secret,
        requestId,
        dataId,
        ts,
      });

    const noRequestHash =
      signature({
        secret,
        requestId: '',
        dataId,
        ts,
      });

    try {
      process.env[envName] = '1';

      console.warn =
        (...args) => {
          lines.push(
            args.join(' '),
          );
        };

      assert.doesNotThrow(
        () =>
          verifyMercadoPagoSignature({
            secret,
            requestId,
            dataId,
            signatureHeader:
              `ts=${ts},v1=${validHash}`,
          }),
      );

      assert.throws(
        () =>
          verifyMercadoPagoSignature({
            secret,
            requestId: '',
            dataId,
            signatureHeader:
              `ts=${ts},v1=${'0'.repeat(64)}`,
          }),
        /invalida/i,
      );
    } finally {
      console.warn =
        originalWarn;

      if (previousEnv === undefined) {
        delete process.env[envName];
      } else {
        process.env[envName] =
          previousEnv;
      }
    }

    assert.equal(
      lines.length,
      2,
    );

    const prefix =
      'MERCADO_PAGO_SIGNATURE_DIAGNOSTIC ';

    for (const line of lines) {
      assert.match(
        line,
        /^MERCADO_PAGO_SIGNATURE_DIAGNOSTIC /,
      );

      assert.doesNotMatch(
        line,
        new RegExp(secret),
      );

      assert.doesNotMatch(
        line,
        new RegExp(requestId),
      );

      assert.doesNotMatch(
        line,
        new RegExp(dataId),
      );

      assert.doesNotMatch(
        line,
        new RegExp(ts),
      );

      assert.doesNotMatch(
        line,
        new RegExp(validHash),
      );

      assert.doesNotMatch(
        line,
        new RegExp(noRequestHash),
      );
    }

    const validDiagnostic =
      JSON.parse(
        lines[0].slice(prefix.length),
      );

    const invalidDiagnostic =
      JSON.parse(
        lines[1].slice(prefix.length),
      );

    assert.deepEqual(
      validDiagnostic,
      {
        signatureValid: true,
        requestIdPresent: true,
        dataIdPresent: true,
        dataIdDecimalOnly: true,
        signatureHeaderPresent: true,
        tsPresent: true,
        tsNumeric: true,
        v1Present: true,
        v1Hex64: true,
        manifestIncludesRequestId: true,
        hmacWithoutRequestIdMatches: false,
      },
    );

    assert.deepEqual(
      invalidDiagnostic,
      {
        signatureValid: false,
        requestIdPresent: false,
        dataIdPresent: true,
        dataIdDecimalOnly: true,
        signatureHeaderPresent: true,
        tsPresent: true,
        tsNumeric: true,
        v1Present: true,
        v1Hex64: true,
        manifestIncludesRequestId: false,
        hmacWithoutRequestIdMatches: false,
      },
    );
  },
);
