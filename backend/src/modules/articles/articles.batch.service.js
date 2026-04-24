import path from 'node:path';
import * as XLSX from 'xlsx';
import { pool } from '../../db/pool.js';
import { badRequest } from '../../utils/app-error.js';
import { normalizePublicAssetPath } from '../../utils/assets.js';
import { logAudit } from '../audit/audit.service.js';
import { createArticle, listAdminArticlesForExport, updateArticle } from './articles.service.js';
import { articleCreateSchema } from './articles.schemas.js';

const EXPORT_COLUMNS = [
  'internalCode',
  'slug',
  'title',
  'categoryId',
  'categoryName',
  'brandId',
  'brandName',
  'sizeId',
  'sizeCode',
  'sizeText',
  'measurementsText',
  'description',
  'purchasePriceItem',
  'purchasePriceShipping',
  'purchasePriceCourier',
  'purchasePriceTotal',
  'salePrice',
  'discountType',
  'discountValue',
  'discountedPrice',
  'allowOffers',
  'isFeatured',
  'intakeDate',
  'quantityTotal',
  'quantityAvailable',
  'quantityReserved',
  'quantitySold',
  'status',
  'originNotes',
  'primaryImage',
];

const HEADER_ALIASES = new Map([
  ['internalcode', 'internalCode'],
  ['code', 'internalCode'],
  ['sku', 'internalCode'],
  ['slug', 'slug'],
  ['title', 'title'],
  ['titulo', 'title'],
  ['categoryid', 'categoryId'],
  ['category', 'categoryName'],
  ['categoryname', 'categoryName'],
  ['categoria', 'categoryName'],
  ['brandid', 'brandId'],
  ['brand', 'brandName'],
  ['brandname', 'brandName'],
  ['marca', 'brandName'],
  ['sizeid', 'sizeId'],
  ['size', 'sizeCode'],
  ['sizecode', 'sizeCode'],
  ['talle', 'sizeCode'],
  ['sizetext', 'sizeText'],
  ['measurements', 'measurementsText'],
  ['measurementstext', 'measurementsText'],
  ['medidas', 'measurementsText'],
  ['description', 'description'],
  ['descripcion', 'description'],
  ['purchasepriceitem', 'purchasePriceItem'],
  ['purchasepriceshipping', 'purchasePriceShipping'],
  ['purchasepricecourier', 'purchasePriceCourier'],
  ['saleprice', 'salePrice'],
  ['precioventa', 'salePrice'],
  ['discounttype', 'discountType'],
  ['discountvalue', 'discountValue'],
  ['allowoffers', 'allowOffers'],
  ['isfeatured', 'isFeatured'],
  ['intakedate', 'intakeDate'],
  ['fechadeingreso', 'intakeDate'],
  ['quantitytotal', 'quantityTotal'],
  ['quantityavailable', 'quantityAvailable'],
  ['quantityreserved', 'quantityReserved'],
  ['quantitysold', 'quantitySold'],
  ['status', 'status'],
  ['estado', 'status'],
  ['originnotes', 'originNotes'],
  ['notes', 'originNotes'],
  ['primaryimage', 'primaryImage'],
  ['image', 'primaryImage'],
  ['imageurl', 'primaryImage'],
]);

function normalizeHeaderKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function normalizeLookupKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeSpreadsheetValue(value) {
  if (value == null) return undefined;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }

  return value;
}

function parseBooleanCell(value, fallback = false) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'boolean') return value;

  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'si', 'sí', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function detectBatchType(fileName) {
  const extension = path.extname(String(fileName || '')).toLowerCase();
  if (extension === '.csv') return 'CSV';
  if (extension === '.xlsx' || extension === '.xls') return 'XLSX';
  throw badRequest('Solo se permiten archivos CSV o XLSX');
}

function normalizeImportedRow(rawRow) {
  const normalized = {};

  for (const [rawKey, rawValue] of Object.entries(rawRow || {})) {
    const canonicalKey = HEADER_ALIASES.get(normalizeHeaderKey(rawKey));
    if (!canonicalKey) continue;
    normalized[canonicalKey] = normalizeSpreadsheetValue(rawValue);
  }

  return normalized;
}

function normalizeImportedDate(value) {
  if (!value) return undefined;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const normalized = String(value).trim();
  if (!normalized) return undefined;

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;

  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return normalized;
}

async function loadImportReferenceData() {
  const [categories] = await pool.query('SELECT id, name FROM categories');
  const [brands] = await pool.query('SELECT id, name FROM brands');
  const [sizes] = await pool.query('SELECT id, code FROM sizes');

  return {
    categoriesById: new Map(categories.map((row) => [String(row.id), Number(row.id)])),
    categoriesByName: new Map(categories.map((row) => [normalizeLookupKey(row.name), Number(row.id)])),
    brandsById: new Map(brands.map((row) => [String(row.id), Number(row.id)])),
    brandsByName: new Map(brands.map((row) => [normalizeLookupKey(row.name), Number(row.id)])),
    sizesById: new Map(sizes.map((row) => [String(row.id), Number(row.id)])),
    sizesByCode: new Map(sizes.map((row) => [normalizeLookupKey(row.code), Number(row.id)])),
  };
}

async function loadExistingArticlesByCode(internalCodes) {
  if (!internalCodes.length) {
    return new Map();
  }

  const placeholders = internalCodes.map(() => '?').join(',');
  const [rows] = await pool.execute(
    `
      SELECT id, internal_code AS internalCode
      FROM articles
      WHERE internal_code IN (${placeholders})
    `,
    internalCodes,
  );

  return new Map(rows.map((row) => [row.internalCode, { id: Number(row.id), internalCode: row.internalCode }]));
}

function resolveRequiredLookup({ valueId, valueName, byId, byName, label }) {
  if (valueId != null && valueId !== '') {
    const resolved = byId.get(String(valueId));
    if (!resolved) {
      throw new Error(`${label} inexistente: ${valueId}`);
    }
    return resolved;
  }

  if (valueName != null && valueName !== '') {
    const resolved = byName.get(normalizeLookupKey(valueName));
    if (!resolved) {
      throw new Error(`${label} inexistente: ${valueName}`);
    }
    return resolved;
  }

  throw new Error(`${label} es obligatorio`);
}

function resolveOptionalLookup({ valueId, valueName, byId, byName, label }) {
  if (valueId == null && valueName == null) {
    return null;
  }

  if (valueId != null && valueId !== '') {
    const resolved = byId.get(String(valueId));
    if (!resolved) {
      throw new Error(`${label} inexistente: ${valueId}`);
    }
    return resolved;
  }

  if (valueName != null && valueName !== '') {
    const resolved = byName.get(normalizeLookupKey(valueName));
    if (!resolved) {
      throw new Error(`${label} inexistente: ${valueName}`);
    }
    return resolved;
  }

  return null;
}

function buildImportPayload(row, referenceData) {
  if (!row.internalCode) {
    throw new Error('internalCode / code / sku es obligatorio para importar');
  }

  const payload = {
    internalCode: String(row.internalCode).trim(),
    slug: row.slug || undefined,
    title: row.title,
    categoryId: resolveRequiredLookup({
      valueId: row.categoryId,
      valueName: row.categoryName,
      byId: referenceData.categoriesById,
      byName: referenceData.categoriesByName,
      label: 'Categoria',
    }),
    brandId: resolveOptionalLookup({
      valueId: row.brandId,
      valueName: row.brandName,
      byId: referenceData.brandsById,
      byName: referenceData.brandsByName,
      label: 'Marca',
    }),
    sizeId: resolveOptionalLookup({
      valueId: row.sizeId,
      valueName: row.sizeCode,
      byId: referenceData.sizesById,
      byName: referenceData.sizesByCode,
      label: 'Talle',
    }),
    sizeText: row.sizeText || null,
    measurementsText: row.measurementsText || null,
    description: row.description || null,
    purchasePriceItem: row.purchasePriceItem ?? 0,
    purchasePriceShipping: row.purchasePriceShipping ?? 0,
    purchasePriceCourier: row.purchasePriceCourier ?? 0,
    salePrice: row.salePrice,
    discountType: row.discountType ? String(row.discountType).trim().toUpperCase() : 'NONE',
    discountValue: row.discountValue ?? 0,
    allowOffers: parseBooleanCell(row.allowOffers, false),
    isFeatured: parseBooleanCell(row.isFeatured, false),
    intakeDate: normalizeImportedDate(row.intakeDate),
    quantityTotal: row.quantityTotal ?? 1,
    quantityAvailable: row.quantityAvailable ?? undefined,
    quantityReserved: row.quantityReserved ?? 0,
    quantitySold: row.quantitySold ?? 0,
    status: row.status ? String(row.status).trim().toUpperCase() : 'ACTIVE',
    originNotes: row.originNotes || null,
  };

  const validation = articleCreateSchema.safeParse(payload);
  if (!validation.success) {
    throw new Error(validation.error.issues.map((issue) => issue.message).join('; '));
  }

  return {
    payload: validation.data,
    primaryImage: row.primaryImage ? normalizePublicAssetPath(row.primaryImage) : '',
  };
}

function parseImportFile(file) {
  if (!file?.buffer?.length) {
    throw badRequest('El archivo de importacion esta vacio o es invalido');
  }

  const workbook = XLSX.read(file.buffer, {
    type: 'buffer',
    cellDates: true,
    raw: false,
    dateNF: 'yyyy-mm-dd',
  });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw badRequest('No se encontro ninguna hoja para importar');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    defval: undefined,
    raw: false,
    dateNF: 'yyyy-mm-dd',
  });

  if (!rows.length) {
    throw badRequest('El archivo no tiene filas para importar');
  }

  return rows.map((rawRow, index) => ({
    rowNumber: index + 2,
    rawRow,
    normalizedRow: normalizeImportedRow(rawRow),
  }));
}

async function prepareImportRows(file, { updateExisting = false } = {}) {
  const parsedRows = parseImportFile(file);
  const referenceData = await loadImportReferenceData();
  const codes = parsedRows
    .map((entry) => entry.normalizedRow.internalCode)
    .filter(Boolean)
    .map((value) => String(value).trim());

  const existingByCode = await loadExistingArticlesByCode([...new Set(codes)]);
  const duplicateCodes = new Set();
  const seenCodes = new Set();

  for (const code of codes) {
    if (seenCodes.has(code)) duplicateCodes.add(code);
    seenCodes.add(code);
  }

  return parsedRows.map((entry) => {
    const internalCode = entry.normalizedRow.internalCode ? String(entry.normalizedRow.internalCode).trim() : '';

    if (internalCode && duplicateCodes.has(internalCode)) {
      return {
        ...entry,
        action: 'FAILED',
        errors: [`El codigo ${internalCode} esta repetido dentro del archivo`],
      };
    }

    try {
      const { payload, primaryImage } = buildImportPayload(entry.normalizedRow, referenceData);
      const existingArticle = existingByCode.get(payload.internalCode) || null;

      if (existingArticle && !updateExisting) {
        return {
          ...entry,
          internalCode: payload.internalCode,
          title: payload.title,
          action: 'SKIPPED',
          errors: [],
          payload,
          existingArticle,
          primaryImage,
        };
      }

      return {
        ...entry,
        internalCode: payload.internalCode,
        title: payload.title,
        action: existingArticle ? 'UPDATED' : 'CREATED',
        errors: [],
        payload,
        existingArticle,
        primaryImage,
      };
    } catch (error) {
      return {
        ...entry,
        internalCode,
        title: entry.normalizedRow.title || '',
        action: 'FAILED',
        errors: [error.message || 'Fila invalida'],
      };
    }
  });
}

function buildImportSummary(preparedRows) {
  return preparedRows.reduce(
    (summary, row) => {
      summary.rowsReceived += 1;
      if (row.action === 'CREATED') summary.rowsCreated += 1;
      if (row.action === 'UPDATED') summary.rowsUpdated += 1;
      if (row.action === 'SKIPPED') summary.rowsSkipped += 1;
      if (row.action === 'FAILED') summary.rowsFailed += 1;
      return summary;
    },
    {
      rowsReceived: 0,
      rowsCreated: 0,
      rowsUpdated: 0,
      rowsSkipped: 0,
      rowsFailed: 0,
    },
  );
}

async function createImportBatch({ fileName, batchType, rowsReceived, actorUserId }) {
  const [result] = await pool.execute(
    `
      INSERT INTO article_import_batches (
        batch_type,
        source_file_name,
        rows_received,
        status,
        created_by
      ) VALUES (?, ?, ?, 'PROCESSING', ?)
    `,
    [batchType, fileName || null, rowsReceived, actorUserId || null],
  );

  return result.insertId;
}

async function appendImportBatchItem(batchId, row) {
  await pool.execute(
    `
      INSERT INTO article_import_batch_items (
        batch_id,
        import_row_number,
        article_id,
        action,
        raw_payload_json,
        error_message
      ) VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      batchId,
      row.rowNumber,
      row.articleId || row.existingArticle?.id || null,
      row.action,
      JSON.stringify(row.normalizedRow || {}),
      row.errors?.length ? row.errors.join('; ') : null,
    ],
  );
}

async function finalizeImportBatch(batchId, summary) {
  const status = summary.rowsFailed > 0
    ? (summary.rowsCreated || summary.rowsUpdated ? 'DONE_WITH_ERRORS' : 'FAILED')
    : 'DONE';

  const notes = summary.rowsSkipped
    ? `Rows skipped because the code already exists and updateExisting=false: ${summary.rowsSkipped}`
    : null;

  await pool.execute(
    `
      UPDATE article_import_batches
      SET
        rows_created = ?,
        rows_updated = ?,
        rows_failed = ?,
        finished_at = NOW(),
        status = ?,
        notes = ?
      WHERE id = ?
    `,
    [
      summary.rowsCreated,
      summary.rowsUpdated,
      summary.rowsFailed,
      status,
      notes,
      batchId,
    ],
  );

  return status;
}

async function syncImportedPrimaryImage(articleId, imagePath, articleTitle, actorUserId) {
  if (!imagePath) return;

  const [existingRows] = await pool.execute(
    `
      SELECT id
      FROM article_images
      WHERE article_id = ? AND is_primary = 1
      ORDER BY id ASC
      LIMIT 1
    `,
    [articleId],
  );

  if (existingRows.length) {
    await pool.execute(
      `
        UPDATE article_images
        SET
          file_path = ?,
          alt_text = ?
        WHERE id = ?
      `,
      [imagePath, articleTitle || null, existingRows[0].id],
    );
    return;
  }

  const [countRows] = await pool.execute(
    'SELECT COUNT(*) AS total FROM article_images WHERE article_id = ?',
    [articleId],
  );

  await pool.execute(
    `
      INSERT INTO article_images (
        article_id,
        file_path,
        alt_text,
        sort_order,
        is_primary,
        created_by
      ) VALUES (?, ?, ?, ?, 1, ?)
    `,
    [
      articleId,
      imagePath,
      articleTitle || null,
      Number(countRows[0]?.total || 0),
      actorUserId || null,
    ],
  );
}

function buildPreviewRows(preparedRows) {
  return preparedRows.slice(0, 50).map((row) => ({
    rowNumber: row.rowNumber,
    action: row.action,
    internalCode: row.internalCode || row.normalizedRow.internalCode || '',
    title: row.title || row.normalizedRow.title || '',
    errors: row.errors || [],
  }));
}

export async function previewArticleImport({ file, options = {} }) {
  const batchType = detectBatchType(file?.originalname);
  const preparedRows = await prepareImportRows(file, options);

  return {
    batchType,
    columns: EXPORT_COLUMNS,
    summary: buildImportSummary(preparedRows),
    rows: buildPreviewRows(preparedRows),
  };
}

export async function runArticleImport({ file, options = {}, auditContext }) {
  const batchType = detectBatchType(file?.originalname);
  const preparedRows = await prepareImportRows(file, options);
  const initialSummary = buildImportSummary(preparedRows);
  const batchId = await createImportBatch({
    fileName: file?.originalname || null,
    batchType,
    rowsReceived: initialSummary.rowsReceived,
    actorUserId: auditContext.actorUserId,
  });

  const results = [];
  const summary = {
    rowsReceived: initialSummary.rowsReceived,
    rowsCreated: 0,
    rowsUpdated: 0,
    rowsSkipped: 0,
    rowsFailed: 0,
  };

  for (const row of preparedRows) {
    if (row.action === 'FAILED') {
      summary.rowsFailed += 1;
      await appendImportBatchItem(batchId, row);
      results.push({
        rowNumber: row.rowNumber,
        action: row.action,
        internalCode: row.internalCode || '',
        error: row.errors?.join('; ') || 'Fila invalida',
      });
      continue;
    }

    if (row.action === 'SKIPPED') {
      summary.rowsSkipped += 1;
      await appendImportBatchItem(batchId, row);
      results.push({
        rowNumber: row.rowNumber,
        action: row.action,
        internalCode: row.internalCode || '',
        articleId: row.existingArticle?.id || null,
        message: 'El codigo ya existe y updateExisting esta desactivado',
      });
      continue;
    }

    try {
      const article = row.existingArticle
        ? await updateArticle(row.existingArticle.id, row.payload, auditContext)
        : await createArticle(row.payload, auditContext);

      await syncImportedPrimaryImage(
        article.id,
        row.primaryImage,
        article.title,
        auditContext.actorUserId,
      );

      if (row.existingArticle) {
        summary.rowsUpdated += 1;
      } else {
        summary.rowsCreated += 1;
      }

      await appendImportBatchItem(batchId, {
        ...row,
        articleId: article.id,
      });

      results.push({
        rowNumber: row.rowNumber,
        action: row.action,
        internalCode: row.internalCode,
        articleId: article.id,
      });
    } catch (error) {
      summary.rowsFailed += 1;

      const failedRow = {
        ...row,
        action: 'FAILED',
        errors: [error.message || 'No se pudo procesar la fila'],
      };

      await appendImportBatchItem(batchId, failedRow);
      results.push({
        rowNumber: row.rowNumber,
        action: 'FAILED',
        internalCode: row.internalCode || '',
        error: failedRow.errors[0],
      });
    }
  }

  const batchStatus = await finalizeImportBatch(batchId, summary);

  await logAudit({
    actorUserId: auditContext.actorUserId,
    actorLabel: auditContext.actorLabel,
    actionCode: 'ARTICLE_IMPORT_COMPLETED',
    entityType: 'article_import_batches',
    entityId: batchId,
    metadataJson: {
      batchType,
      fileName: file?.originalname || null,
      batchStatus,
      ...summary,
      updateExisting: Boolean(options.updateExisting),
    },
    source: auditContext.source,
    ipAddress: auditContext.ipAddress,
    userAgent: auditContext.userAgent,
  });

  return {
    batchId,
    batchType,
    batchStatus,
    summary,
    results,
  };
}

export async function buildArticleExport({ filters, format, auditContext }) {
  const rows = await listAdminArticlesForExport({ filters });
  const exportRows = rows.map((row) => ({
    internalCode: row.internalCode,
    slug: row.slug,
    title: row.title,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    brandId: row.brandId || '',
    brandName: row.brandName || '',
    sizeId: row.sizeId || '',
    sizeCode: row.sizeCode || '',
    sizeText: row.sizeText || '',
    measurementsText: row.measurementsText || '',
    description: row.description || '',
    purchasePriceItem: row.purchasePriceItem,
    purchasePriceShipping: row.purchasePriceShipping,
    purchasePriceCourier: row.purchasePriceCourier,
    purchasePriceTotal: row.purchasePriceTotal,
    salePrice: row.salePrice,
    discountType: row.discountType,
    discountValue: row.discountValue,
    discountedPrice: row.discountedPrice,
    allowOffers: row.allowOffers,
    isFeatured: row.isFeatured,
    intakeDate: row.intakeDate ? String(row.intakeDate).slice(0, 10) : '',
    quantityTotal: row.quantityTotal,
    quantityAvailable: row.quantityAvailable,
    quantityReserved: row.quantityReserved,
    quantitySold: row.quantitySold,
    status: row.status,
    originNotes: row.originNotes || '',
    primaryImage: row.primaryImage || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportRows, {
    header: EXPORT_COLUMNS,
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'articles');

  const today = new Date().toISOString().slice(0, 10);
  const safeFormat = format === 'csv' ? 'csv' : 'xlsx';
  const fileName = `esadar-articulos-${today}.${safeFormat}`;

  await logAudit({
    actorUserId: auditContext.actorUserId,
    actorLabel: auditContext.actorLabel,
    actionCode: 'ARTICLE_EXPORT_CREATED',
    entityType: 'articles',
    entityId: null,
    metadataJson: {
      format: safeFormat,
      itemCount: exportRows.length,
    },
    source: auditContext.source,
    ipAddress: auditContext.ipAddress,
    userAgent: auditContext.userAgent,
  });

  if (safeFormat === 'csv') {
    const csv = XLSX.utils.sheet_to_csv(worksheet, { FS: ',', RS: '\n' });
    return {
      contentType: 'text/csv; charset=utf-8',
      fileName,
      payload: Buffer.from(`\uFEFF${csv}`, 'utf8'),
      itemCount: exportRows.length,
    };
  }

  return {
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fileName,
    payload: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
    itemCount: exportRows.length,
  };
}
