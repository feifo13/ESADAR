import path from 'node:path';
import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function toNumber(value, fallback) {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getSmtpPassword() {
  const password = process.env.SMTP_PASSWORD || '';
  const host = String(process.env.SMTP_HOST || '').toLowerCase();

  if (host.includes('smtp.gmail.com')) {
    return password.replace(/\s+/g, '');
  }

  return password;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: (process.env.NODE_ENV || 'development') === 'production',
  port: toNumber(process.env.PORT, 4000),
  appOrigin: process.env.APP_ORIGIN || 'http://localhost:5173',
  publicSiteUrl: (process.env.PUBLIC_SITE_URL || 'http://localhost:5173').replace(/\/$/, ''),
  storeName: process.env.STORE_NAME || 'ESADAR',
  storeDescription: process.env.STORE_DESCRIPTION || 'Ropa second hand seleccionada: sportswear, vintage y prendas modernas.',
  db: {
    host: required('DB_HOST'),
    port: toNumber(process.env.DB_PORT, 3306),
    user: required('DB_USER'),
    password: process.env.DB_PASSWORD || '',
    database: required('DB_NAME'),
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: false,
  },
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  uploadDir: path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads'),
  articleUploadDir: path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads', 'articles'),
  bundledUploadDir: path.resolve(process.cwd(), 'public', 'uploads'),
  maxUploadBytes: toNumber(process.env.MAX_UPLOAD_MB, 10) * 1024 * 1024,
  mail: {
    host: process.env.SMTP_HOST || '',
    port: toNumber(process.env.SMTP_PORT, 587),
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    user: process.env.SMTP_USER || '',
    password: getSmtpPassword(),
    fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || '',
    fromName: process.env.SMTP_FROM_NAME || process.env.STORE_NAME || 'ESADAR',
    replyTo: process.env.SMTP_REPLY_TO || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || '',
  },
};
