import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter, resetRateLimitBucketsForTests } from '../src/middlewares/rate-limit.js';

function createResponse() {
  const headers = new Map();
  return {
    headers,
    setHeader(name, value) {
      headers.set(name, value);
    },
  };
}

test('rate limiter blocks requests above the configured threshold', () => {
  resetRateLimitBucketsForTests();
  const limiter = createRateLimiter({ name: 'test-login', windowMs: 60_000, max: 2 });
  const req = { ip: '127.0.0.1', method: 'POST', baseUrl: '/api/auth', path: '/login' };

  for (let index = 0; index < 2; index += 1) {
    let error = null;
    limiter(req, createResponse(), (nextError) => {
      error = nextError || null;
    });
    assert.equal(error, null);
  }

  let blocked = null;
  const res = createResponse();
  limiter(req, res, (nextError) => {
    blocked = nextError || null;
  });

  assert.equal(blocked?.statusCode, 429);
  assert.equal(res.headers.get('RateLimit-Limit'), '2');
  assert.equal(res.headers.get('RateLimit-Remaining'), '0');
  assert.ok(Number(res.headers.get('Retry-After')) > 0);
});
