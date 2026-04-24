import path from 'node:path';

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
