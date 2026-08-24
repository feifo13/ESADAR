import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  REPORT_CATALOG,
  buildReportDownloadRequest,
  createReportFilters,
  getVisibleReportFields,
} from '../src/lib/reports.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = (relativePath) => readFileSync(resolve(root, relativePath), 'utf8');

test('declarative catalog exposes six explicit report endpoints', () => {
  assert.equal(REPORT_CATALOG.length, 6);
  assert.deepEqual(REPORT_CATALOG.map(({ title }) => title), [
    'Ventas',
    'Proyección de ganancias',
    'Ganancias',
    'Stock',
    'Rotación de stock',
    'Integridad de costos',
  ]);
  assert.deepEqual(REPORT_CATALOG.map(({ endpoint }) => endpoint), [
    '/api/admin/reports/sales',
    '/api/admin/reports/profit-projection',
    '/api/admin/reports/realized-profits',
    '/api/admin/reports/stock',
    '/api/admin/reports/stock-rotation',
    '/api/admin/reports/cost-integrity',
  ]);
});

test('report filters are specific, cost scope hides inapplicable current controls, and XLSX is the default', () => {
  assert.deepEqual(
    getVisibleReportFields('sales', {}).map(({ key }) => key),
    ['dateFrom', 'dateTo', 'lotId', 'paymentMethod', 'shippingMethod', 'q'],
  );
  assert.deepEqual(
    getVisibleReportFields('stock', {}).map(({ key }) => key),
    ['q', 'lotId', 'categoryId', 'brandId', 'sizeId', 'publicationStatus', 'stockStatus'],
  );
  assert.equal(createReportFilters('cost-integrity').scope, 'ALL');
  assert.equal(createReportFilters('cost-integrity').unreliableOnly, 'true');
  assert.equal(
    getVisibleReportFields('cost-integrity', { scope: 'ALL' }).some(({ key }) => key === 'categoryId'),
    false,
  );
  assert.equal(
    getVisibleReportFields('cost-integrity', { scope: 'CURRENT_ARTICLES' }).some(({ key }) => key === 'categoryId'),
    true,
  );

  const defaultRequest = buildReportDownloadRequest('sales', { dateFrom: '2026-08-01' });
  assert.equal(defaultRequest.path, '/api/admin/reports/sales?dateFrom=2026-08-01&format=xlsx');
  assert.equal(defaultRequest.extension, 'xlsx');

  const costRequest = buildReportDownloadRequest('cost-integrity', {
    scope: 'ALL',
    categoryId: 10,
    unreliableOnly: 'false',
    unknown: 'discard-me',
  }, 'csv');
  assert.equal(costRequest.path, '/api/admin/reports/cost-integrity?scope=ALL&unreliableOnly=false&format=csv');
  assert.throws(() => buildReportDownloadRequest('sales', {}, 'pdf'));
});

test('Reports route, RBAC, navigation, breadcrumb, inline panel and notifications are wired', () => {
  const app = source('src/App.jsx');
  const page = source('src/pages/admin/AdminReportsPage.jsx');
  const header = source('src/components/Header.jsx');
  const toolbar = source('src/components/admin/AdminToolbar.jsx');
  const breadcrumbs = source('src/components/AppBreadcrumbs.jsx');

  assert.match(app, /path="admin\/reports"/);
  assert.match(app, /<AdminReportsPage \/>/);
  assert.match(app, /ProtectedRoute roles=\{\['SUPER_ADMIN', 'ADMIN', 'OPERATOR'\]\}/);
  assert.match(header, /label: "Reportes", to: "\/admin\/reports"/);
  assert.match(toolbar, /to: '\/admin\/reports', label: 'Reportes'/);
  assert.match(breadcrumbs, /reports: "Reportes"/);
  assert.match(page, /REPORT_CATALOG\.map/);
  assert.match(page, /<ResponsiveFilterPanel/);
  assert.match(page, /defaultOpen/);
  assert.match(page, /<span>Formato<\/span>/);
  assert.match(page, /<option value="csv">CSV<\/option>/);
  assert.match(page, /<option value="xlsx">XLSX<\/option>/);
  assert.match(page, /apiDownload\(request\.path/);
  assert.match(page, /notifySuccess/);
  assert.match(page, /notifyError/);
});

test('legacy local downloads are removed while operational and transactional surfaces remain', () => {
  const articles = source('src/pages/admin/AdminArticlesPage.jsx');
  const lot = source('src/pages/admin/AdminArticleLotDetailPage.jsx');
  const statistics = source('src/pages/admin/AdminStatisticsPage.jsx');
  const adminOrder = source('src/pages/admin/AdminOrderDetailPage.jsx');
  const adminOrders = source('src/pages/admin/AdminOrdersPage.jsx');
  const account = source('src/pages/AccountPage.jsx');
  const accountOrder = source('src/pages/AccountOrderDetailPage.jsx');

  assert.match(articles, /Importar CSV/);
  assert.match(articles, /Exportar CSV/);
  assert.match(articles, /Exportar XLSX/);
  assert.match(articles, /Descargar plantilla simple CSV/);
  assert.match(articles, /Descargar plantilla completa CSV/);
  assert.doesNotMatch(articles, /profit-projection\/export|Exportar proyección de ganancias/);

  assert.match(lot, /Resumen economico/);
  assert.match(lot, /\/api\/admin\/article-lots\/\$\{id\}\/report/);
  assert.doesNotMatch(lot, /profit-projection\/export|Exportar CSV|Exportar XLSX/);

  assert.match(statistics, /Indicadores principales/);
  assert.match(statistics, /\/api\/admin\/statistics\/sales-over-time/);
  assert.match(statistics, /market-study/);
  assert.doesNotMatch(statistics, /apiDownload|statistics\/export\.xlsx|article-margins\.pdf|Exportar reporte/);

  assert.match(adminOrder, /\/api\/admin\/orders\/\$\{id\}\/receipt\.pdf/);
  assert.match(adminOrders, /\/api\/admin\/orders\/\$\{order\.id\}\/receipt\.pdf/);
  assert.match(account, /\/api\/public\/account\/orders\/\$\{order\.id\}\/receipt\.pdf/);
  assert.match(accountOrder, /\/api\/public\/account\/orders\/\$\{order\.id\}\/receipt\.pdf/);
});
