import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import express from 'express';
import { createApp } from '../src/app.js';
import { errorHandler, notFoundHandler } from '../src/middlewares/error-handler.js';
import { createReportsRouter } from '../src/modules/reports/reports.routes.js';
import { createReportDownloadHandler } from '../src/modules/reports/reports.controller.js';
import { salesReportQuerySchema } from '../src/modules/reports/reports.schemas.js';
import { signAccessToken } from '../src/utils/jwt.js';

const REPORT_PATHS = [
  '/sales',
  '/profit-projection',
  '/realized-profits',
  '/stock',
  '/stock-rotation',
  '/cost-integrity',
];

async function withServer(app, callback) {
  const server = createServer(app);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const address = server.address();
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

function tokenFor(role) {
  return signAccessToken({ userId: 1, email: 'admin@example.test', roles: [role] });
}

function createRbacTestApp() {
  const handler = (_req, res) => res.status(200).json({ ok: true });
  const router = createReportsRouter({
    sales: handler,
    profitProjection: handler,
    realizedProfits: handler,
    stock: handler,
    stockRotation: handler,
    costIntegrity: handler,
  });
  const app = express();
  app.use('/api/admin/reports', router);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

test('all six report routes require auth and allow the existing financial roles', async () => {
  await withServer(createRbacTestApp(), async (baseUrl) => {
    const unauthenticated = await fetch(`${baseUrl}/api/admin/reports/sales`);
    assert.equal(unauthenticated.status, 401);

    const customer = await fetch(`${baseUrl}/api/admin/reports/sales`, {
      headers: { Authorization: `Bearer ${tokenFor('CUSTOMER')}` },
    });
    assert.equal(customer.status, 403);

    for (const role of ['SUPER_ADMIN', 'ADMIN', 'OPERATOR']) {
      for (const path of REPORT_PATHS) {
        const response = await fetch(`${baseUrl}/api/admin/reports${path}`, {
          headers: { Authorization: `Bearer ${tokenFor(role)}` },
        });
        assert.equal(response.status, 200, `${role} ${path}`);
      }
    }
  });
});

test('report controller applies its specific schema and stable download headers', async () => {
  let captured = null;
  const handler = createReportDownloadHandler('sales', salesReportQuerySchema, {
    buildDownload: async (input) => {
      captured = input;
      return {
        contentType: 'text/csv; charset=utf-8',
        fileName: 'esadar-ventas-2026-08-23.csv',
        itemCount: 2,
        payload: Buffer.from('csv'),
      };
    },
  });
  const headers = new Map();
  const response = {
    setHeader: (name, value) => headers.set(name, value),
    send: (payload) => payload,
  };
  const payload = await handler({
    query: { format: 'csv', dateFrom: '2026-08-01' },
    auth: { userId: 1, email: 'admin@example.test' },
    headers: { 'user-agent': 'node-test' },
    ip: '127.0.0.1',
    auditSource: 'TEST',
  }, response);

  assert.equal(payload.toString(), 'csv');
  assert.equal(captured.reportId, 'sales');
  assert.deepEqual(captured.query, { format: 'csv', dateFrom: '2026-08-01' });
  assert.equal(headers.get('Content-Type'), 'text/csv; charset=utf-8');
  assert.match(headers.get('Content-Disposition'), /esadar-ventas-2026-08-23\.csv/);
  assert.equal(headers.get('X-Export-Count'), '2');

  await assert.rejects(() => handler({
    query: { status: 'PENDING' },
    auth: {},
    headers: {},
  }, response));
});

test('authorized legacy analytical export endpoints now return 404', async () => {
  const legacyPaths = [
    '/api/admin/statistics/export.xlsx',
    '/api/admin/statistics/article-margins.pdf',
    '/api/admin/articles/profit-projection/export',
    '/api/admin/article-lots/1/profit-projection/export',
  ];
  await withServer(createApp(), async (baseUrl) => {
    for (const path of legacyPaths) {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: { Authorization: `Bearer ${tokenFor('ADMIN')}` },
      });
      assert.equal(response.status, 404, path);
    }
  });
});
