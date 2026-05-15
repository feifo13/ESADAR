import path from 'node:path';
import { env } from '../config/env.js';

function isLocalHostname(hostname = '') {
  const normalized = String(hostname).toLowerCase().replace(/^\[|\]$/g, '');
  return ['localhost', '127.0.0.1', '::1'].includes(normalized);
}

function isIpHostname(hostname = '') {
  const normalized = String(hostname).toLowerCase().replace(/^\[|\]$/g, '');
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(normalized) || normalized.includes(':');
}

export function isUnsafePublicUrl(value) {
  if (!value || !/^https?:\/\//i.test(String(value))) return false;

  try {
    const parsed = new URL(value);
    return isIpHostname(parsed.hostname) && !isLocalHostname(parsed.hostname);
  } catch {
    return false;
  }
}

export function sanitizePublicUrl(value) {
  const raw = String(value || '').trim();
  if (!raw || isUnsafePublicUrl(raw)) return '';
  return raw.replace(/\/$/, '');
}

export function normalizePublicAssetPath(filePath) {
  if (!filePath) return '';

  const normalized = String(filePath).trim().replace(/\\/g, '/');

  if (/^https?:/i.test(normalized)) {
    return sanitizePublicUrl(normalized);
  }

  if (/^(data:|blob:)/i.test(normalized)) {
    return normalized;
  }

  if (normalized.startsWith('/')) {
    return normalized.replace(/\/{2,}/g, '/');
  }

  return `/${normalized}`.replace(/\/{2,}/g, '/');
}

export function buildArticleUploadPublicPath(fileName) {
  const safeFileName = path.basename(String(fileName || ''));
  return normalizePublicAssetPath(`uploads/articles/${safeFileName}`);
}

export function buildUploadPublicPathFromDiskPath(diskPath) {
  const safeDiskPath = path.resolve(String(diskPath || ''));
  const uploadRoot = path.resolve(env.uploadDir);
  const relativePath = path.relative(uploadRoot, safeDiskPath);

  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return buildArticleUploadPublicPath(path.basename(safeDiskPath));
  }

  return normalizePublicAssetPath(`uploads/${relativePath.split(path.sep).join('/')}`);
}

export function buildSiblingUploadPublicPath(originalPublicPath, fileName) {
  const normalized = normalizePublicAssetPath(originalPublicPath);
  const directory = normalized.split('/').slice(0, -1).join('/') || '/uploads/articles';
  return normalizePublicAssetPath(`${directory}/${path.basename(String(fileName || ''))}`);
}

export function toAbsoluteSiteUrl(value) {
  const normalized = normalizePublicAssetPath(value);
  if (!normalized) return '';
  if (/^https?:/i.test(normalized)) return sanitizePublicUrl(normalized);
  const baseUrl = sanitizePublicUrl(env.publicSiteUrl);
  return baseUrl ? `${baseUrl}${normalized}` : normalized;
}

export function joinPublicSiteUrl(pathname = '/') {
  const safePath = String(pathname || '/').startsWith('/')
    ? String(pathname || '/')
    : `/${pathname}`;
  const baseUrl = sanitizePublicUrl(env.publicSiteUrl);
  return baseUrl ? `${baseUrl}${safePath}` : safePath;
}

export function isManagedUploadPath(filePath) {
  const normalized = normalizePublicAssetPath(filePath);
  return normalized.startsWith('/uploads/');
}

export function resolveUploadDiskPath(filePath) {
  const normalized = normalizePublicAssetPath(filePath);
  if (!isManagedUploadPath(normalized)) return '';
  const relativePath = normalized.replace(/^\/uploads\/?/, '').replace(/\//g, path.sep);
  return path.join(env.uploadDir, relativePath);
}
