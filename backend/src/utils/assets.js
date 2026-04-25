import path from 'node:path';
import { env } from '../config/env.js';

export function normalizePublicAssetPath(filePath) {
  if (!filePath) return '';

  const normalized = String(filePath).trim().replace(/\\/g, '/');

  if (/^(https?:|data:|blob:)/i.test(normalized)) {
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

export function toAbsoluteSiteUrl(value) {
  const normalized = normalizePublicAssetPath(value);
  if (!normalized) return '';
  if (/^https?:/i.test(normalized)) return normalized;
  return `${env.publicSiteUrl}${normalized}`;
}

export function joinPublicSiteUrl(pathname = '/') {
  const safePath = String(pathname || '/').startsWith('/')
    ? String(pathname || '/')
    : `/${pathname}`;
  return `${env.publicSiteUrl}${safePath}`;
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
