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

test('does not parse an unstructured Google display name', () => {
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
      firstName: null,
      lastName: null,
    },
  );
});

test('preserves a missing Google family name as missing', () => {
  assert.deepEqual(
    normalizeGoogleIdentityPayload({
      sub: 'google-subject-no-family',
      email: 'juan@example.com',
      email_verified: true,
      given_name: 'Juan',
      name: 'Juan Persona',
    }),
    {
      provider: 'GOOGLE',
      subject: 'google-subject-no-family',
      email: 'juan@example.com',
      firstName: 'Juan',
      lastName: null,
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
