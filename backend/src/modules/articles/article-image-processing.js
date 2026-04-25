import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { buildArticleUploadPublicPath, isManagedUploadPath, normalizePublicAssetPath, resolveUploadDiskPath } from '../../utils/assets.js';

const VARIANTS = [
  { key: 'thumb', width: 320 },
  { key: 'card', width: 800 },
  { key: 'detail', width: 1200 },
  { key: 'zoom', width: 1800 },
];

function rgbToHex(value) {
  const normalized = Number(value || 0);
  return normalized.toString(16).padStart(2, '0');
}

function dominantToHex(color) {
  if (!color) return null;
  return `#${rgbToHex(color.r)}${rgbToHex(color.g)}${rgbToHex(color.b)}`;
}

export async function processUploadedArticleImage(file, options = {}) {
  const diskPath = String(file?.path || '');
  const parsed = path.parse(diskPath);
  const originalPublicPath = buildArticleUploadPublicPath(parsed.base);

  const baseImage = sharp(diskPath, { failOn: 'none' });
  const metadata = await baseImage.metadata();
  const stats = await baseImage.stats();
  const fileStats = await fs.stat(diskPath);

  const variants = {};
  for (const variant of VARIANTS) {
    const outputFileName = `${parsed.name}-${variant.key}.webp`;
    const outputDiskPath = path.join(parsed.dir, outputFileName);
    await sharp(diskPath, { failOn: 'none' })
      .rotate()
      .resize({
        width: variant.width,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .flatten({ background: options.background || '#f3eee7' })
      .webp({ quality: 84 })
      .toFile(outputDiskPath);

    variants[`${variant.key}FilePath`] = buildArticleUploadPublicPath(outputFileName);
  }

  return {
    filePath: variants.detailFilePath || originalPublicPath,
    originalFilePath: originalPublicPath,
    thumbFilePath: variants.thumbFilePath || originalPublicPath,
    cardFilePath: variants.cardFilePath || originalPublicPath,
    detailFilePath: variants.detailFilePath || originalPublicPath,
    zoomFilePath: variants.zoomFilePath || originalPublicPath,
    width: metadata.width || null,
    height: metadata.height || null,
    mimeType: file?.mimetype || (metadata.format ? `image/${metadata.format}` : null),
    fileSizeBytes: Number(fileStats.size || 0),
    dominantColor: dominantToHex(stats?.dominant),
    processedStatus: 'DONE',
    processingError: null,
  };
}

export async function buildImportedImageRecord(imagePath) {
  const normalized = normalizePublicAssetPath(imagePath);
  const isRemote = /^https?:/i.test(normalized);

  if (!normalized) {
    return null;
  }

  if (isRemote || !isManagedUploadPath(normalized)) {
    return {
      filePath: normalized,
      originalFilePath: isRemote ? normalized : null,
      thumbFilePath: null,
      cardFilePath: null,
      detailFilePath: null,
      zoomFilePath: null,
      width: null,
      height: null,
      mimeType: null,
      fileSizeBytes: null,
      dominantColor: null,
      processedStatus: isRemote ? 'DONE' : 'PENDING',
      processingError: null,
    };
  }

  const diskPath = resolveUploadDiskPath(normalized);
  try {
    await fs.access(diskPath);
    return {
      filePath: normalized,
      originalFilePath: normalized,
      thumbFilePath: normalized,
      cardFilePath: normalized,
      detailFilePath: normalized,
      zoomFilePath: normalized,
      width: null,
      height: null,
      mimeType: null,
      fileSizeBytes: null,
      dominantColor: null,
      processedStatus: 'DONE',
      processingError: null,
    };
  } catch {
    return {
      filePath: normalized,
      originalFilePath: normalized,
      thumbFilePath: null,
      cardFilePath: null,
      detailFilePath: null,
      zoomFilePath: null,
      width: null,
      height: null,
      mimeType: null,
      fileSizeBytes: null,
      dominantColor: null,
      processedStatus: 'PENDING',
      processingError: 'La imagen referenciada todavia no existe en uploads.',
    };
  }
}

export async function deleteArticleImageFiles(image) {
  const candidates = [
    image?.originalFilePath,
    image?.thumbFilePath,
    image?.cardFilePath,
    image?.detailFilePath,
    image?.zoomFilePath,
    image?.filePath,
  ]
    .map((value) => normalizePublicAssetPath(value))
    .filter(Boolean);

  const uniqueCandidates = [...new Set(candidates)];
  for (const candidate of uniqueCandidates) {
    if (!isManagedUploadPath(candidate)) continue;

    const diskPath = resolveUploadDiskPath(candidate);
    if (!diskPath) continue;

    try {
      await fs.unlink(diskPath);
    } catch {
      // Ignore missing files so deletes remain idempotent.
    }
  }
}
