import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {
  buildSiblingUploadPublicPath,
  buildUploadPublicPathFromDiskPath,
  isManagedUploadPath,
  normalizePublicAssetPath,
  resolveUploadDiskPath,
} from '../../utils/assets.js';

const VARIANTS = [
  { key: 'thumb', width: 360, quality: 82 },
  { key: 'card', width: 900, quality: 88 },
  { key: 'detail', width: 1600, quality: 90 },
  { key: 'zoom', width: 2400, quality: 92 },
];

const VARIANT_SUFFIX_PATTERN = /-(thumb|card|detail|zoom)\.webp$/i;

function rgbToHex(value) {
  const normalized = Number(value || 0);
  return normalized.toString(16).padStart(2, '0');
}

function dominantToHex(color) {
  if (!color) return null;
  return `#${rgbToHex(color.r)}${rgbToHex(color.g)}${rgbToHex(color.b)}`;
}

function getMimeTypeFromMetadata(metadata, fallback = null) {
  if (fallback) return fallback;
  if (!metadata?.format) return null;
  if (metadata.format === 'jpg') return 'image/jpeg';
  return `image/${metadata.format}`;
}

function buildVariantFileName(sourceFileName, variantKey) {
  const parsed = path.parse(sourceFileName);
  const baseName = parsed.name.replace(VARIANT_SUFFIX_PATTERN, '');
  return `${baseName}-${variantKey}.webp`;
}

async function processArticleImageDiskPath(diskPath, options = {}) {
  const safeDiskPath = path.resolve(String(diskPath || ''));
  const parsed = path.parse(safeDiskPath);
  const originalPublicPath = normalizePublicAssetPath(
    options.originalPublicPath || buildUploadPublicPathFromDiskPath(safeDiskPath),
  );

  const baseImage = sharp(safeDiskPath, { failOn: 'none' });
  const metadata = await baseImage.metadata();
  const stats = await baseImage.stats();
  const fileStats = await fs.stat(safeDiskPath);

  const variants = {};
  for (const variant of VARIANTS) {
    const outputFileName = buildVariantFileName(parsed.base, variant.key);
    const outputDiskPath = path.join(parsed.dir, outputFileName);

    await sharp(safeDiskPath, { failOn: 'none' })
      .rotate()
      .resize({
        width: variant.width,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .flatten({ background: options.background || '#f3eee7' })
      .webp({ quality: variant.quality, effort: 5 })
      .toFile(outputDiskPath);

    variants[`${variant.key}FilePath`] = buildSiblingUploadPublicPath(
      originalPublicPath,
      outputFileName,
    );
  }

  return {
    // Keep filePath as a detail-size optimized asset for backwards compatibility.
    // Cards/lists must prefer cardFilePath/thumbFilePath from the API response.
    filePath: variants.detailFilePath || originalPublicPath,
    originalFilePath: originalPublicPath,
    thumbFilePath: variants.thumbFilePath || originalPublicPath,
    cardFilePath: variants.cardFilePath || variants.thumbFilePath || originalPublicPath,
    detailFilePath: variants.detailFilePath || originalPublicPath,
    zoomFilePath: variants.zoomFilePath || variants.detailFilePath || originalPublicPath,
    width: metadata.width || null,
    height: metadata.height || null,
    mimeType: getMimeTypeFromMetadata(metadata, options.mimeType),
    fileSizeBytes: Number(fileStats.size || 0),
    dominantColor: dominantToHex(stats?.dominant),
    processedStatus: 'DONE',
    processingError: null,
  };
}

export async function processUploadedArticleImage(file, options = {}) {
  return processArticleImageDiskPath(file?.path, {
    ...options,
    mimeType: file?.mimetype || null,
  });
}

export async function processManagedArticleImagePath(imagePath, options = {}) {
  const normalized = normalizePublicAssetPath(imagePath);
  if (!normalized || !isManagedUploadPath(normalized)) {
    throw new Error('La imagen no pertenece a uploads.');
  }

  const diskPath = resolveUploadDiskPath(normalized);
  await fs.access(diskPath);
  return processArticleImageDiskPath(diskPath, {
    ...options,
    originalPublicPath: normalized,
  });
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

  try {
    return await processManagedArticleImagePath(normalized);
  } catch (error) {
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
      processingError: error?.message || 'La imagen referenciada todavia no se pudo procesar.',
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
