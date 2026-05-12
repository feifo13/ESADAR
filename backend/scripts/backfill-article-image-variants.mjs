import '../src/config/env.js';
import { pool } from '../src/db/pool.js';
import { processManagedArticleImagePath } from '../src/modules/articles/article-image-processing.js';
import { isManagedUploadPath, normalizePublicAssetPath } from '../src/utils/assets.js';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const force = args.has('--force');
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const limit = limitArg ? Math.max(1, Number(limitArg.split('=')[1]) || 0) : null;

function isLikelyGeneratedVariant(value) {
  return /-(thumb|card|detail|zoom)\.webp$/i.test(String(value || ''));
}

function resolveSourcePath(row) {
  const original = normalizePublicAssetPath(row.originalFilePath || '');
  const file = normalizePublicAssetPath(row.filePath || '');

  if (original && isManagedUploadPath(original) && !isLikelyGeneratedVariant(original)) {
    return original;
  }

  if (file && isManagedUploadPath(file) && !isLikelyGeneratedVariant(file)) {
    return file;
  }

  return '';
}

function needsBackfill(row) {
  if (force) return true;
  const filePath = normalizePublicAssetPath(row.filePath || '');
  const thumb = normalizePublicAssetPath(row.thumbFilePath || '');
  const card = normalizePublicAssetPath(row.cardFilePath || '');
  const detail = normalizePublicAssetPath(row.detailFilePath || '');

  return (
    row.processedStatus !== 'DONE'
    || !thumb
    || !card
    || !detail
    || thumb === filePath
    || card === filePath
    || detail === filePath
    || !thumb.endsWith('.webp')
    || !card.endsWith('.webp')
    || !detail.endsWith('.webp')
  );
}

async function main() {
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        article_id AS articleId,
        file_path AS filePath,
        original_file_path AS originalFilePath,
        thumb_file_path AS thumbFilePath,
        card_file_path AS cardFilePath,
        detail_file_path AS detailFilePath,
        zoom_file_path AS zoomFilePath,
        processed_status AS processedStatus
      FROM article_images
      ORDER BY id ASC
    `,
  );

  const candidates = rows
    .filter((row) => needsBackfill(row))
    .map((row) => ({ ...row, sourcePath: resolveSourcePath(row) }))
    .filter((row) => row.sourcePath)
    .slice(0, limit || undefined);

  const summary = {
    dryRun,
    force,
    scanned: rows.length,
    candidates: candidates.length,
    processed: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    failures: [],
  };

  console.log(`[article-image-backfill] scanned=${summary.scanned} candidates=${summary.candidates} dryRun=${dryRun} force=${force}`);

  for (const row of candidates) {
    try {
      const processed = await processManagedArticleImagePath(row.sourcePath);
      summary.processed += 1;

      if (dryRun) {
        console.log(`[dry-run] image=${row.id} article=${row.articleId} source=${row.sourcePath}`);
        console.log(`          thumb=${processed.thumbFilePath}`);
        console.log(`          card=${processed.cardFilePath}`);
        console.log(`          detail=${processed.detailFilePath}`);
        summary.skipped += 1;
        continue;
      }

      await pool.execute(
        `
          UPDATE article_images
          SET
            file_path = ?,
            original_file_path = ?,
            thumb_file_path = ?,
            card_file_path = ?,
            detail_file_path = ?,
            zoom_file_path = ?,
            width = ?,
            height = ?,
            mime_type = ?,
            file_size_bytes = ?,
            dominant_color = ?,
            processed_status = ?,
            processing_error = ?
          WHERE id = ?
        `,
        [
          processed.filePath,
          processed.originalFilePath,
          processed.thumbFilePath,
          processed.cardFilePath,
          processed.detailFilePath,
          processed.zoomFilePath,
          processed.width,
          processed.height,
          processed.mimeType,
          processed.fileSizeBytes,
          processed.dominantColor,
          processed.processedStatus,
          processed.processingError,
          row.id,
        ],
      );

      summary.updated += 1;
      console.log(`[updated] image=${row.id} article=${row.articleId} source=${row.sourcePath}`);
    } catch (error) {
      summary.failed += 1;
      const failure = {
        id: row.id,
        articleId: row.articleId,
        sourcePath: row.sourcePath,
        message: error?.message || 'Unknown error',
      };
      summary.failures.push(failure);
      console.warn(`[failed] image=${row.id} article=${row.articleId} source=${row.sourcePath}: ${failure.message}`);
    }
  }

  console.log('[article-image-backfill] summary');
  console.log(JSON.stringify(summary, null, 2));

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error('[article-image-backfill] fatal', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
