import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ensureViteServer, waitForHttp } from './lib/dev-server.mjs';

const OUTPUT_DIR = path.resolve('.artifacts', 'visual-smoke');
const API_URL = (process.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');
const SMOKE_EMAIL = process.env.ESADAR_SMOKE_EMAIL || 'admin@miamicloset.test';
const SMOKE_PASSWORD = process.env.ESADAR_SMOKE_PASSWORD || '123456';
const SMOKE_CART_ITEMS = [
  {
    id: null,
    cartLineKey: 'visual-smoke:regular',
    articleId: 900001,
    slug: 'visual-smoke-article',
    title: 'Prenda smoke test',
    brandName: 'ESADAR',
    sizeLabel: 'M',
    image: '',
    salePrice: 1200,
    discountType: 'NONE',
    discountValue: 0,
    discountedPrice: 1200,
    acceptedOffer: null,
    quantity: 1,
    maxQuantity: 1,
    lineTotal: 1200,
  },
];

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result || {});
        return;
      }

      const key = `${message.sessionId || ''}:${message.method}`;
      for (const listener of this.listeners.get(key) || []) {
        listener(message.params || {});
      }
    });
  }

  static async connect(webSocketUrl) {
    const socket = new WebSocket(webSocketUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    return new CdpClient(socket);
  }

  send(method, params = {}, sessionId = null) {
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;

    const promise = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.socket.send(JSON.stringify(payload));
    return promise;
  }

  waitFor(method, sessionId, timeoutMs = 10000) {
    const key = `${sessionId || ''}:${method}`;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);

      const listener = (params) => {
        clearTimeout(timeout);
        this.listeners.set(
          key,
          (this.listeners.get(key) || []).filter((item) => item !== listener),
        );
        resolve(params);
      };

      this.listeners.set(key, [...(this.listeners.get(key) || []), listener]);
    });
  }

  close() {
    this.socket.close();
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function removeTempDir(dirPath) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
      return;
    } catch (error) {
      if (!['EBUSY', 'ENOTEMPTY', 'EPERM'].includes(error.code)) throw error;
      await sleep(250);
    }
  }

  console.warn(`Warning: could not remove temporary browser profile at ${dirPath}.`);
}

async function stopProcess(processHandle) {
  if (processHandle.killed || processHandle.exitCode !== null) return;

  const exited = new Promise((resolve) => {
    processHandle.once('exit', resolve);
  });

  processHandle.kill();
  await Promise.race([exited, sleep(1500)]);
}

async function pathExists(filePath) {
  if (!filePath) return false;
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findBrowserExecutable() {
  const candidates = [
    process.env.ESADAR_BROWSER_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
  ];

  for (const candidate of candidates) {
    if (await pathExists(candidate)) return candidate;
  }

  throw new Error('No Chromium-based browser found. Set ESADAR_BROWSER_PATH to run visual smoke tests.');
}

async function launchBrowser() {
  const port = Number(process.env.ESADAR_CDP_PORT || 9223);
  const browserPath = await findBrowserExecutable();
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'esadar-visual-'));
  const browser = spawn(
    browserPath,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      '--disable-gpu',
      '--hide-scrollbars=false',
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank',
    ],
    { stdio: 'ignore', windowsHide: true },
  );

  const versionUrl = `http://127.0.0.1:${port}/json/version`;
  await waitForHttp(versionUrl, { timeoutMs: 12000 });
  const version = await (await fetch(versionUrl)).json();

  return {
    webSocketUrl: version.webSocketDebuggerUrl,
    stop: async () => {
      await stopProcess(browser);
      await removeTempDir(userDataDir);
    },
  };
}

async function createPage(client) {
  const { targetId } = await client.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await client.send('Target.attachToTarget', {
    targetId,
    flatten: true,
  });

  await client.send('Page.enable', {}, sessionId);
  await client.send('Runtime.enable', {}, sessionId);
  return sessionId;
}

async function setViewport(client, sessionId, { width, height, mobile = false }) {
  await client.send(
    'Emulation.setDeviceMetricsOverride',
    {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
    },
    sessionId,
  );
}

async function navigate(client, sessionId, url) {
  const load = client.waitFor('Page.loadEventFired', sessionId, 12000);
  await client.send('Page.navigate', { url }, sessionId);
  await load;
  await sleep(900);
}

async function evaluate(client, sessionId, expression) {
  const result = await client.send(
    'Runtime.evaluate',
    {
      expression,
      awaitPromise: true,
      returnByValue: true,
    },
    sessionId,
  );

  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Runtime evaluation failed');
  }

  return result.result?.value;
}

async function waitForExpression(client, sessionId, expression, message, timeoutMs = 6000) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      if (await evaluate(client, sessionId, expression)) return;
    } catch (error) {
      lastError = error;
    }

    await sleep(150);
  }

  throw new Error(lastError ? `${message}: ${lastError.message}` : message);
}

async function screenshot(client, sessionId, name) {
  const result = await client.send(
    'Page.captureScreenshot',
    { format: 'png', captureBeyondViewport: false },
    sessionId,
  );
  const filePath = path.join(OUTPUT_DIR, `${name}.png`);
  await fs.writeFile(filePath, Buffer.from(result.data, 'base64'));
  return filePath;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function backendIsAvailable() {
  try {
    const response = await fetch(`${API_URL}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}

const server = await ensureViteServer();
const browser = await launchBrowser();
const client = await CdpClient.connect(browser.webSocketUrl);
const sessionId = await createPage(client);
const screenshots = [];
const skipped = [];

try {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  await setViewport(client, sessionId, { width: 1366, height: 900 });
  await navigate(client, sessionId, `${server.baseUrl}/articles`);
  const desktopArticles = await evaluate(
    client,
    sessionId,
    `(() => {
      const rail = document.querySelector('.featured-motion-shell .scroll-rail-controls--left');
      const heading = rail?.closest('.section-heading');
      const railRect = rail?.getBoundingClientRect();
      const headingRect = heading?.getBoundingClientRect();
      const style = rail ? getComputedStyle(rail) : null;
      document.querySelector('.app-snackbar')?.remove();
      document.body.insertAdjacentHTML('beforeend', '<div class="app-snackbar app-snackbar--success" role="status"><svg viewBox="0 0 24 24" aria-hidden="true"></svg><span class="app-snackbar__message">Smoke snackbar</span><button type="button" class="app-snackbar__close" aria-label="Cerrar aviso">x</button></div>');
      const snackbar = document.querySelector('.app-snackbar');
      const close = document.querySelector('.app-snackbar__close');
      const closeStyle = getComputedStyle(close);
      const before = getComputedStyle(close, '::before');
      const after = getComputedStyle(close, '::after');
      return {
        railExists: Boolean(rail),
        railMarginTop: style?.marginTop,
        railJustify: style?.justifyContent,
        railLeftAligned: Boolean(railRect && headingRect && railRect.left <= headingRect.left + 2),
        snackbarExists: Boolean(snackbar),
        closeFontSize: closeStyle.fontSize,
        closeLineHeight: closeStyle.lineHeight,
        beforeWidth: before.width,
        afterWidth: after.width,
      };
    })()`,
  );

  assert(desktopArticles.railExists, 'Desktop articles rail is missing.');
  assert(desktopArticles.railMarginTop === '10px', 'Desktop articles rail margin-top is not 10px.');
  assert(desktopArticles.railJustify === 'flex-start', 'Desktop articles rail is not left aligned.');
  assert(desktopArticles.railLeftAligned, 'Desktop articles rail is visually right aligned.');
  assert(desktopArticles.snackbarExists, 'Snackbar did not render in desktop smoke.');
  assert(desktopArticles.closeFontSize === '0px', 'Snackbar close glyph is still text-sized.');
  assert(desktopArticles.closeLineHeight === '0px', 'Snackbar close glyph line-height is not neutralized.');
  assert(desktopArticles.beforeWidth !== 'auto' && desktopArticles.afterWidth !== 'auto', 'Snackbar close pseudo-elements are missing.');
  screenshots.push(await screenshot(client, sessionId, 'desktop-articles-snackbar-rail'));

  await setViewport(client, sessionId, { width: 390, height: 844, mobile: true });
  await navigate(client, sessionId, `${server.baseUrl}/articles`);
  const mobileArticles = await evaluate(
    client,
    sessionId,
    `(() => {
      document.querySelector('.app-snackbar')?.remove();
      document.body.insertAdjacentHTML('beforeend', '<div class="app-snackbar app-snackbar--success" role="status"><svg viewBox="0 0 24 24" aria-hidden="true"></svg><span class="app-snackbar__message">Smoke snackbar</span><button type="button" class="app-snackbar__close" aria-label="Cerrar aviso">x</button></div>');
      const visibleRails = [...document.querySelectorAll('.scroll-rail-controls')]
        .filter((rail) => getComputedStyle(rail).display !== 'none').length;
      const snackbar = document.querySelector('.app-snackbar');
      snackbar.getAnimations?.().forEach((animation) => animation.finish());
      const snackbarRect = snackbar.getBoundingClientRect();
      return {
        visibleRails,
        snackbarNearBottom: window.innerHeight - snackbarRect.bottom <= 14,
      };
    })()`,
  );
  assert(mobileArticles.visibleRails === 0, 'Rail controls should be hidden on mobile articles.');
  assert(mobileArticles.snackbarNearBottom, 'Mobile snackbar is not anchored near the bottom.');
  screenshots.push(await screenshot(client, sessionId, 'mobile-articles-snackbar'));

  await setViewport(client, sessionId, { width: 390, height: 844, mobile: true });
  await evaluate(
    client,
    sessionId,
    `(() => {
      window.localStorage.setItem('miami-closet-cart', JSON.stringify(${JSON.stringify(SMOKE_CART_ITEMS)}));
      window.localStorage.removeItem('miami-closet-cart-owner');
    })()`,
  );
  await navigate(client, sessionId, `${server.baseUrl}/checkout/resumen`);
  const checkout = await evaluate(
    client,
    sessionId,
    `(() => ({
      page: Boolean(document.querySelector('.checkout-page-stack')),
      steps: Boolean(document.querySelector('.checkout-steps-row')),
      overflowing: document.documentElement.scrollWidth > window.innerWidth + 2,
    }))()`,
  );
  assert(checkout.page, 'Checkout page did not render.');
  assert(checkout.steps, 'Checkout steps did not render.');
  assert(!checkout.overflowing, 'Checkout mobile has horizontal overflow.');
  screenshots.push(await screenshot(client, sessionId, 'mobile-checkout-summary'));

  if (await backendIsAvailable()) {
    await setViewport(client, sessionId, { width: 390, height: 844, mobile: true });
    await navigate(client, sessionId, `${server.baseUrl}/login`);
    await waitForExpression(
      client,
      sessionId,
      `Boolean(document.querySelector('input[name="email"]') && document.querySelector('input[name="password"]') && document.querySelector('button[type="submit"]'))`,
      'Login form did not render before admin visual smoke.',
    );
    await evaluate(
      client,
      sessionId,
      `(() => {
        const setValue = (selector, value) => {
          const input = document.querySelector(selector);
          if (!input) throw new Error(\`Missing input: \${selector}\`);
          const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set;
          setter.call(input, value);
          input.dispatchEvent(new Event('input', { bubbles: true }));
        };
        setValue('input[name="email"]', ${JSON.stringify(SMOKE_EMAIL)});
        setValue('input[name="password"]', ${JSON.stringify(SMOKE_PASSWORD)});
        document.querySelector('button[type="submit"]').click();
      })()`,
    );
    await sleep(1400);
    await navigate(client, sessionId, `${server.baseUrl}/admin/articles`);
    const admin = await evaluate(
      client,
      sessionId,
      `(() => ({
        shell: Boolean(document.querySelector('.admin-page-shell')),
        filters: Boolean(document.querySelector('.responsive-filter-trigger, .responsive-filter-panel')),
        table: Boolean(document.querySelector('.data-table')),
        overflowing: document.documentElement.scrollWidth > window.innerWidth + 2,
      }))()`,
    );
    assert(admin.shell, 'Admin articles shell did not render.');
    assert(admin.filters, 'Admin mobile filters did not render.');
    assert(admin.table, 'Admin articles table did not render.');
    assert(!admin.overflowing, 'Admin mobile has horizontal overflow.');
    screenshots.push(await screenshot(client, sessionId, 'mobile-admin-articles'));
  } else {
    skipped.push('admin mobile visual smoke (backend unavailable)');
  }

  console.log('Visual smoke passed.');
  if (screenshots.length) {
    console.log('Screenshots:');
    for (const filePath of screenshots) console.log(`- ${filePath}`);
  }
  if (skipped.length) {
    console.log('Skipped:');
    for (const item of skipped) console.log(`- ${item}`);
  }
} finally {
  client.close();
  await browser.stop();
  await server.stop();
}
