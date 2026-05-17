import path from "node:path";
import "dotenv/config";

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function toNumber(value, fallback) {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value, fallback = false) {
  if (value == null || value === "") return fallback;
  if (typeof value === "boolean") return value;

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "si", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseDurationMs(value, fallbackMs) {
  if (!value) return fallbackMs;
  const raw = String(value).trim();
  const match = raw.match(/^(\d+)\s*([smhd])?$/i);
  if (!match) return fallbackMs;

  const amount = Number(match[1]);
  const unit = String(match[2] || "ms").toLowerCase();
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    ms: 1,
  };

  return amount * (multipliers[unit] || multipliers.ms);
}

function getSmtpPassword() {
  const password = process.env.SMTP_PASSWORD || "";
  const host = String(process.env.SMTP_HOST || "").toLowerCase();

  if (host.includes("smtp.gmail.com")) {
    return password.replace(/\s+/g, "");
  }

  return password;
}

const nodeEnv = process.env.NODE_ENV || "development";
const appOrigin = process.env.APP_ORIGIN || "http://localhost:5173";
const publicSiteUrl = (
  process.env.PUBLIC_SITE_URL || appOrigin
).replace(/\/$/, "");
const defaultCorsOrigins = [
  appOrigin,
  "http://localhost:5173",
  "https://sandbox.esadar.com.uy",
  "https://esadar.com.uy",
];
const configuredCorsOrigins = parseCsv(process.env.CORS_ORIGINS);
const resolvedCorsOrigins = configuredCorsOrigins.length
  ? configuredCorsOrigins
  : [...new Set(defaultCorsOrigins)];
const configuredMailAllowedSiteUrls = parseCsv(process.env.MAIL_ALLOWED_SITE_URLS);

export const env = {
  nodeEnv,
  isProduction: nodeEnv === "production",
  port: toNumber(process.env.PORT, 4000),
  appOrigin,
  publicSiteUrl,
  trustProxy: toBoolean(process.env.TRUST_PROXY, false),
  cors: {
    allowedOrigins: resolvedCorsOrigins,
    allowLocalhostInDevelopment: toBoolean(process.env.CORS_ALLOW_LOCALHOST_IN_DEVELOPMENT, true),
  },
  security: {
    enableCsp: toBoolean(process.env.SECURITY_ENABLE_CSP, false),
  },
  storeName: process.env.STORE_NAME || "ESADAR",
  storeDescription:
    process.env.STORE_DESCRIPTION ||
    "Ropa: sportswear, vintage y prendas modernas.",
  db: {
    host: required("DB_HOST"),
    port: toNumber(process.env.DB_PORT, 3306),
    user: required("DB_USER"),
    password: process.env.DB_PASSWORD || "",
    database: required("DB_NAME"),
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: false,
  },
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  authCookieMaxAgeMs: parseDurationMs(
    process.env.AUTH_COOKIE_MAX_AGE || process.env.JWT_EXPIRES_IN || "7d",
    7 * 24 * 60 * 60 * 1000,
  ),
  uploadDir: path.resolve(process.cwd(), process.env.UPLOAD_DIR || "uploads"),
  articleUploadDir: path.resolve(
    process.cwd(),
    process.env.UPLOAD_DIR || "uploads",
    "articles",
  ),
  bundledUploadDir: path.resolve(process.cwd(), "public", "uploads"),
  maxUploadBytes: toNumber(process.env.MAX_UPLOAD_MB, 10) * 1024 * 1024,
  mail: {
    allowedSiteOrigins: configuredMailAllowedSiteUrls.length
      ? configuredMailAllowedSiteUrls
      : [...new Set([publicSiteUrl, appOrigin, ...resolvedCorsOrigins])],
    host: process.env.SMTP_HOST || "",
    port: toNumber(process.env.SMTP_PORT, 587),
    secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
    user: process.env.SMTP_USER || "",
    password: getSmtpPassword(),
    fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "",
    fromName: process.env.SMTP_FROM_NAME || process.env.STORE_NAME || "ESADAR",
    replyTo:
      process.env.SMTP_REPLY_TO ||
      process.env.SMTP_FROM_EMAIL ||
      process.env.SMTP_USER ||
      "",
    tlsRejectUnauthorized:
      String(
        process.env.SMTP_TLS_REJECT_UNAUTHORIZED || "true",
      ).toLowerCase() !== "false",
  },
  mercadoPago: {
    environment:
      String(process.env.MERCADO_PAGO_ENV || "test").toLowerCase() ===
      "production"
        ? "production"
        : "test",
    publicKey: process.env.MERCADO_PAGO_PUBLIC_KEY || "",
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || "",
    userId: process.env.MERCADO_PAGO_USER_ID || "",
    checkoutUrl: process.env.MERCADO_PAGO_CHECKOUT_URL || "",
    notificationUrl: process.env.MERCADO_PAGO_NOTIFICATION_URL || "",
    webhookSecret: process.env.MERCADO_PAGO_WEBHOOK_SECRET || "",
  },
};
