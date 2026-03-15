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

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: (process.env.NODE_ENV || 'development') === 'production',
  port: toNumber(process.env.PORT, 4000),
  appOrigin: process.env.APP_ORIGIN || 'http://localhost:5173',
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
  maxUploadBytes: toNumber(process.env.MAX_UPLOAD_MB, 10) * 1024 * 1024,
};
