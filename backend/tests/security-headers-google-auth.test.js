import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from '../src/config/env.js';
import { securityHeaders } from '../src/middlewares/security-headers.js';

function collectHeaders({ enableCsp }) {
  const originalEnableCsp = env.security.enableCsp;
  const headers = new Map();
  let nextCalled = false;

  env.security.enableCsp = enableCsp;
  try {
    securityHeaders(
      {},
      {
        setHeader(name, value) {
          headers.set(name, value);
        },
      },
      () => {
        nextCalled = true;
      },
    );
  } finally {
    env.security.enableCsp = originalEnableCsp;
  }

  assert.equal(nextCalled, true);
  return headers;
}

test('allows Google popup communication through COOP', () => {
  const headers = collectHeaders({ enableCsp: false });
  assert.equal(
    headers.get('Cross-Origin-Opener-Policy'),
    'same-origin-allow-popups',
  );
});

test('allows Google Identity Services when CSP is enabled', () => {
  const headers = collectHeaders({ enableCsp: true });
  const csp = headers.get('Content-Security-Policy');

  assert.match(csp, /script-src 'self' https:\/\/accounts\.google\.com\/gsi\/client/);
  assert.match(csp, /frame-src 'self' https:\/\/accounts\.google\.com\/gsi\//);
  assert.match(csp, /connect-src 'self' https:\/\/accounts\.google\.com\/gsi\//);
  assert.match(csp, /style-src 'self' https:\/\/accounts\.google\.com\/gsi\/style/);
});
