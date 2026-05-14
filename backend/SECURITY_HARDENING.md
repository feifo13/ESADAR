# ESADAR backend security hardening

## Rate limiting

Sensitive public routes now have in-memory rate limiting:

- `POST /api/auth/login`: 10 requests / 15 minutes.
- `POST /api/auth/register`: 5 requests / hour.
- `POST /api/auth/forgot-password`: 5 requests / hour.
- `POST /api/auth/reset-password`: 5 requests / hour.
- `POST /api/public/contact-messages`: 8 requests / 15 minutes.
- `POST /api/public/leads/newsletter`: 15 requests / 15 minutes.
- `POST /api/public/leads/preferences`: 15 requests / 15 minutes.
- `POST /api/public/leads/stock-alert`: 15 requests / 15 minutes.
- `POST /api/public/article-events`: 15 requests / 15 minutes.
- `POST /api/public/offers`: 20 requests / 15 minutes.
- `POST /api/public/orders`: 10 requests / 15 minutes.
- `POST /api/webhooks/mercado-pago`: 120 requests / minute.

The limiter is intentionally dependency-free and safe for a single Node process. For multi-instance production, replace it with a shared store such as Redis.

## CORS

Configure allowed frontend origins with:

```env
CORS_ORIGINS=http://localhost:5173,https://sandbox.esadar.com.uy,https://esadar.com.uy
```

In production, only origins listed in `CORS_ORIGINS` are allowed. Requests without an `Origin` header remain allowed for server-to-server calls and tools such as curl or Mercado Pago webhooks.

When deploying behind Nginx, set:

```env
TRUST_PROXY=true
```

so rate limiting uses the real client IP from proxy headers.

## Security headers

The API now sets baseline security headers without adding a new dependency:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` with high-risk browser APIs disabled
- `Strict-Transport-Security` in production

Optional CSP can be enabled after testing all production assets/integrations:

```env
SECURITY_ENABLE_CSP=true
```

## Regression tests

Run:

```bash
npm test
```

Current tests cover:

- public article search/filter/pagination schema parsing;
- defaulting unsafe sort inputs and rejecting unsafe pagination/ID inputs;
- admin article sort field/direction whitelisting;
- bounded related-articles limit;
- SQL limit/offset literal safety helpers;
- sort/identifier safety helpers;
- rate limiter blocking behavior.
