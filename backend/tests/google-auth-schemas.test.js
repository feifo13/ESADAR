import assert from 'node:assert/strict';
import test from 'node:test';
import { googleCredentialSchema, googleLinkSchema } from '../src/modules/auth/auth.schemas.js';

test('accepts a Google credential payload', () => {
  assert.deepEqual(
    googleCredentialSchema.parse({ credential: 'a'.repeat(120) }),
    { credential: 'a'.repeat(120) },
  );
});

test('rejects a short Google credential payload', () => {
  assert.throws(() => googleCredentialSchema.parse({ credential: 'short' }));
});

test('requires a password when linking an existing account', () => {
  assert.deepEqual(
    googleLinkSchema.parse({ credential: 'b'.repeat(120), password: '123456' }),
    { credential: 'b'.repeat(120), password: '123456' },
  );
  assert.throws(() => googleLinkSchema.parse({ credential: 'b'.repeat(120), password: '123' }));
});
