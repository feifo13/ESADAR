import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveMailSiteUrl, resolveMailSiteUrlFromRequest } from '../src/modules/mail/mail.url-context.js';

test('mail URL resolver accepts only configured site origins', () => {
  assert.equal(resolveMailSiteUrl('https://sandbox.esadar.com.uy/cuenta/ordenes/10'), 'https://sandbox.esadar.com.uy');
  assert.equal(resolveMailSiteUrl('https://esadar.com.uy/articles/campera'), 'https://esadar.com.uy');
  assert.equal(resolveMailSiteUrl('http://localhost:5173/reset-password?token=abc'), 'http://localhost:5173');
});

test('mail URL resolver rejects unconfigured external domains and falls back to public site', () => {
  assert.equal(resolveMailSiteUrl('https://evil.example/phishing'), 'https://esadar.com.uy');
  assert.equal(resolveMailSiteUrl('https://3.216.66.79'), 'https://esadar.com.uy');
});

test('mail URL resolver uses allowed forwarded host from request headers', () => {
  const req = {
    protocol: 'http',
    headers: {
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'sandbox.esadar.com.uy',
      origin: 'https://evil.example',
    },
  };

  assert.equal(resolveMailSiteUrlFromRequest(req), 'https://sandbox.esadar.com.uy');
});
