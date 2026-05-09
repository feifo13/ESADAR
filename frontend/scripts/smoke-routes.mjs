import { ensureViteServer } from './lib/dev-server.mjs';

const ROUTES = [
  '/',
  '/articles',
  '/articles/buzo-phantom-xl-buzos-xl',
  '/articles/buzo-phantom-xl-buzos-xl/offer',
  '/checkout/resumen',
  '/checkout/comprador',
  '/cuenta/guardados',
  '/cuenta/ordenes',
  '/admin/articles',
  '/admin/offers',
];

const server = await ensureViteServer();

try {
  const failures = [];

  for (const route of ROUTES) {
    const url = new URL(route, server.baseUrl);
    const response = await fetch(url);
    const html = await response.text();

    if (!response.ok || !html.includes('<div id="root">')) {
      failures.push(`${route} returned ${response.status}`);
    }
  }

  if (failures.length) {
    console.error('Route smoke failures:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(`Route smoke passed (${ROUTES.length} routes).`);
} finally {
  await server.stop();
}
