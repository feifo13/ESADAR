#!/usr/bin/env node
import 'dotenv/config';
import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createGzip } from 'node:zlib';

const requiredEnv = ['DB_HOST', 'DB_USER', 'DB_NAME'];
const missing = requiredEnv.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`[backup-db] Faltan variables requeridas: ${missing.join(', ')}`);
  process.exit(1);
}

const dbHost = process.env.DB_HOST;
const dbPort = process.env.DB_PORT || '3306';
const dbUser = process.env.DB_USER;
const dbPassword = process.env.DB_PASSWORD || '';
const dbName = process.env.DB_NAME;
const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS || 30);
const backupDir = path.resolve(process.env.BACKUP_DIR || path.join(process.cwd(), '..', 'backups'));

function timestamp() {
  return new Date().toISOString().replace(/[:T]/g, '-').replace(/\.\d+Z$/, '');
}

async function removeExpiredBackups() {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) return;
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const entries = await fs.readdir(backupDir, { withFileTypes: true }).catch(() => []);
  await Promise.all(entries
    .filter((entry) => entry.isFile() && entry.name.startsWith(`esadar-${dbName}-`) && entry.name.endsWith('.sql.gz'))
    .map(async (entry) => {
      const filePath = path.join(backupDir, entry.name);
      const stat = await fs.stat(filePath).catch(() => null);
      if (stat && stat.mtimeMs < cutoff) {
        await fs.unlink(filePath).catch(() => undefined);
        console.log(`[backup-db] Backup expirado eliminado: ${entry.name}`);
      }
    }));
}

async function runBackup() {
  await fs.mkdir(backupDir, { recursive: true, mode: 0o750 });
  const fileName = `esadar-${dbName}-${timestamp()}.sql.gz`;
  const outputPath = path.join(backupDir, fileName);

  const args = [
    `--host=${dbHost}`,
    `--port=${dbPort}`,
    `--user=${dbUser}`,
    '--single-transaction',
    '--quick',
    '--routines',
    '--triggers',
    dbName,
  ];

  const env = { ...process.env };
  if (dbPassword) env.MYSQL_PWD = dbPassword;

  console.log(`[backup-db] Generando backup ${fileName}`);
  const dump = spawn('mysqldump', args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
  const gzip = createGzip({ level: 9 });
  const output = createWriteStream(outputPath, { mode: 0o640 });

  dump.stderr.on('data', (chunk) => {
    const message = String(chunk).replace(dbPassword, '[redacted]').trim();
    if (message) console.error(`[mysqldump] ${message}`);
  });

  dump.stdout.pipe(gzip).pipe(output);

  const dumpExit = new Promise((resolve, reject) => {
    dump.on('error', reject);
    dump.on('close', (code) => {
      if (code === 0) resolve(code);
      else reject(new Error(`mysqldump terminó con código ${code}`));
    });
  });

  const outputWritten = new Promise((resolve, reject) => {
    gzip.on('error', reject);
    output.on('error', reject);
    output.on('finish', resolve);
  });

  await Promise.all([dumpExit, outputWritten]);

  const stat = await fs.stat(outputPath);
  if (!stat.size) {
    throw new Error('El archivo de backup quedó vacío.');
  }

  await removeExpiredBackups();
  console.log(`[backup-db] Backup generado correctamente: ${outputPath} (${stat.size} bytes)`);
}

runBackup().catch(async (error) => {
  console.error(`[backup-db] Error: ${error.message}`);
  process.exit(1);
});
