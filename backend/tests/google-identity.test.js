import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeGoogleIdentityPayload } from '../src/modules/auth/google-identity.js';

test('normalizes a verified Google identity payload', () => {
  assert.deepEqual(
    normalizeGoogleIdentityPayload({
      sub: 'google-subject-123',
      email: 'CLIENTE@EXAMPLE.COM ',
      email_verified: true,
      given_name: '  Ana  María ',
      family_name: ' Pérez ',
    }),
    {
      provider: 'GOOGLE',
      subject: 'google-subject-123',
      email: 'cliente@example.com',
      firstName: 'Ana María',
      lastName: 'Pérez',
    },
  );
});

test('falls back to the display name when split names are absent', () => {
  assert.deepEqual(
    normalizeGoogleIdentityPayload({
      sub: 'google-subject-456',
      email: 'cliente@example.com',
      email_verified: true,
      name: 'Ana Pérez Silva',
    }),
    {
      provider: 'GOOGLE',
      subject: 'google-subject-456',
      email: 'cliente@example.com',
      firstName: 'Ana',
      lastName: 'Pérez Silva',
    },
  );
});

test('rejects unverified Google email payloads', () => {
  assert.throws(
    () => normalizeGoogleIdentityPayload({
      sub: 'google-subject-789',
      email: 'cliente@example.com',
      email_verified: false,
    }),
    /No se pudo validar la cuenta de Google/,
  );
});
