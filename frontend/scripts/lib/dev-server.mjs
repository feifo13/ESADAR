import { spawn } from 'node:child_process';
import path from 'node:path';

export async function waitForHttp(url, { timeoutMs = 12000 } = {}) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
      // Keep polling until the timeout; the dev server may still be starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

export async function ensureViteServer({
  baseUrl = process.env.ESADAR_SMOKE_BASE_URL || 'http://127.0.0.1:5173',
} = {}) {
  try {
    await waitForHttp(baseUrl, { timeoutMs: 1200 });
    return { baseUrl, stop: async () => undefined, started: false };
  } catch {
    // Start a local dev server below.
  }

  const viteBin = path.resolve('node_modules', 'vite', 'bin', 'vite.js');
  const serverUrl = new URL(baseUrl);
  const host = serverUrl.hostname || 'localhost';
  const port = serverUrl.port || '5173';
  const server = spawn(
    process.execPath,
    [viteBin, '--host', host, '--port', port, '--strictPort'],
    {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  );

  let output = '';
  server.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  server.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });

  try {
    await waitForHttp(baseUrl, { timeoutMs: 15000 });
  } catch (error) {
    server.kill();
    throw new Error(`${error.message}\n${output.trim()}`);
  }

  return {
    baseUrl,
    started: true,
    stop: async () => {
      if (!server.killed) server.kill();
    },
  };
}
