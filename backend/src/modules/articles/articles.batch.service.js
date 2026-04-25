import path from 'node:path';
import * as XLSX from 'xlsx';
import { pool } from '../../db/pool.js';
import { badRequest } from '../../utils/app-error.js';
import { normalizePublicAssetPath } from '../../utils/assets.js';
import { logAudit } from '../audit/audit.service.js';
import {
  createArticle,
  findOrCreateBrandByName,
  findOrCreateCategoryByName,
  findOrCreateSizeByCode,
  listAdminArticlesForExport,
  syncArticleImageSources,
  updateArticle,
} from './articles.service.js';
import { articleCreateSchema } from './articles.schemas.js';

const SIMPLE_TEMPLATE_COLUMNS = [
  'title',
  'salePrice',
  'categoryName',
  'brandName',
  'sizeText',
  'measurementsText',
  'description',
  'conditionLabel',
  'color',
  'material',
  'quantityTotal',
  'allowOffers',
  'isFeatured',
  'primaryImage',
  'additionalImages',
];

const FULL_EXPORT_COLUMNS = [
  'internalCode',
  'slug',
  'title',
  'seoTitle',
  'seoDescription',
  'canonicalUrl',
  'googleProductCategory',
  'conditionLabel',
  'color',
  'material',
  'gender',
  'ageGroup',
  'imageAltOverride',
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
  'additionalImages',
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
  ['sizetext', 'sizeText'],
  ['talle', 'sizeText'],
  ['measurements', 'measurementsText'],
  ['measurementstext', 'measurementsText'],
  ['medidas', 'measurementsText'],
  ['description', 'description'],
  ['descripcion', 'description'],
  ['purchasepriceitem', 'purchasePriceItem'],
  ['purchasepriceshipping', 'purchasePriceShipping'],
  ['purchasepricecourier', 'purchasePriceCourier'],
  ['saleprice', 'salePrice'],
  ['price', 'salePrice'],
  ['precio', 'salePrice'],
  ['precioventa', 'salePrice'],
  ['precioventafinal', 'salePrice'],
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
  ['estadoprenda', 'conditionLabel'],
  ['condicion', 'conditionLabel'],
  ['conditionlabel', 'conditionLabel'],
  ['originnotes', 'originNotes'],
  ['notes', 'originNotes'],
  ['color', 'color'],
  ['material', 'material'],
  ['genero', 'gender'],
  ['gender', 'gender'],
  ['edad', 'ageGroup'],
  ['grupoedad', 'ageGroup'],
  ['agegroup', 'ageGroup'],
  ['seotitle', 'seoTitle'],
  ['seotitulo', 'seoTitle'],
  ['seodescription', 'seoDescription'],
  ['seodescripcion', 'seoDescription'],
  ['googleproductcategory', 'googleProductCategory'],
  ['imagealtoverride', 'imageAltOverride'],
  ['canonicalurl', 'canonicalUrl'],
  ['primaryimage', 'primaryImage'],
  ['imagenprincipal', 'primaryImage'],
  ['image', 'primaryImage'],
  ['imageurl', 'primaryImage'],
  ['additionalimages', 'additionalImages'],
  ['imagenes', 'additionalImages'],
  ['imagenesadicionales', 'additionalImages'],
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

function normalizeDelimitedImages(value) {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  return String(value)
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isStoredPublicImagePath(value) {
  const normalized = String(value || '').trim();
  return /^\/?uploads\//i.test(normalized);
}

function isAbsoluteImageUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function isRawLocalFileName(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return false;
  if (isAbsoluteImageUrl(normalized) || isStoredPublicImagePath(normalized)) return false;
  return !normalized.includes('/');
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

function validateReferenceId(byId, valueId, label) {
  if (valueId == null || valueId === '') return null;
  const resolved = byId.get(String(valueId));
  if (!resolved) {
    throw new Error(`${label} inexistente: ${valueId}`);
  }
  return resolved;
}

function buildRowWarnings(row, referenceData, options) {
  const warnings = [];

  if (!row.internalCode) {
    warnings.push('Se generará un código automático.');
  }

  if (!normalizeImportedDate(row.intakeDate)) {
    warnings.push('Se usará la fecha actual como fecha de ingreso.');
  }

  if (!row.categoryId && !row.categoryName) {
    warnings.push('Se usará la categoría Sin categoría.');
  }

  if (row.categoryName && !referenceData.categoriesByName.get(normalizeLookupKey(row.categoryName))) {
    if (options.createMissingLookups) {
      warnings.push(`Se creará la categoría "${row.categoryName}".`);
    } else {
      warnings.push(`La categoría "${row.categoryName}" no existe. Se usará Sin categoría.`);
    }
  }

  if (row.brandName && !referenceData.brandsByName.get(normalizeLookupKey(row.brandName))) {
    if (options.createMissingLookups) {
      warnings.push(`Se creará la marca "${row.brandName}".`);
    } else {
      warnings.push(`La marca "${row.brandName}" no existe. Se importará sin marca normalizada.`);
    }
  }

  if (row.sizeCode && !referenceData.sizesByCode.get(normalizeLookupKey(row.sizeCode))) {
    if (options.createMissingLookups) {
      warnings.push(`Se creará el talle "${row.sizeCode}".`);
    } else {
      warnings.push(`El talle "${row.sizeCode}" no existe. Se conservará como texto libre.`);
    }
  }

  for (const imageValue of [row.primaryImage, ...normalizeDelimitedImages(row.additionalImages)]) {
    if (isRawLocalFileName(imageValue)) {
      warnings.push(`La imagen "${imageValue}" debe subirse o vincularse manualmente luego.`);
    }
  }

  return warnings;
}

function validateImportRow(row, referenceData) {
  const errors = [];

  if (!row.title || String(row.title).trim().length < 2) {
    errors.push('title / titulo es obligatorio');
  }

  if (row.salePrice == null || row.salePrice === '' || Number(row.salePrice) <= 0) {
    errors.push('salePrice / precio es obligatorio y debe ser mayor a 0');
  }

  try {
    validateReferenceId(referenceData.categoriesById, row.categoryId, 'Categoría');
    validateReferenceId(referenceData.brandsById, row.brandId, 'Marca');
    validateReferenceId(referenceData.sizesById, row.sizeId, 'Talle');
  } catch (error) {
    errors.push(error.message || 'Referencia inválida');
  }

  return errors;
}

function parseImportFile(file) {
  if (!file?.buffer?.length) {
    throw badRequest('El archivo de importación está vacío o es inválido');
  }

  const workbook = XLSX.read(file.buffer, {
    type: 'buffer',
    cellDates: true,
    raw: false,
    dateNF: 'yyyy-mm-dd',
  });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw badRequest('No se encontró ninguna hoja para importar');
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

async function prepareImportRows(file, { updateExisting = false, createMissingLookups = false } = {}) {
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
    const row = entry.normalizedRow;
    const internalCode = row.internalCode ? String(row.internalCode).trim() : '';
    const warnings = buildRowWarnings(row, referenceData, { createMissingLookups });
    const errors = validateImportRow(row, referenceData);

    if (internalCode && duplicateCodes.has(internalCode)) {
      errors.push(`El código ${internalCode} está repetido dentro del archivo`);
    }

    const existingArticle = internalCode ? (existingByCode.get(internalCode) || null) : null;
    let action = existingArticle ? 'UPDATED' : 'CREATED';

    if (existingArticle && !updateExisting) {
      action = 'SKIPPED';
    }

    if (errors.length) {
      action = 'FAILED';
    }

    return {
      ...entry,
      internalCode,
      title: row.title || '',
      action,
      errors,
      warnings,
      existingArticle,
      normalizedImages: {
        primaryImage: row.primaryImage ? String(row.primaryImage).trim() : '',
        additionalImages: normalizeDelimitedImages(row.additionalImages),
      },
    };
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
      if (row.warnings?.length) {
        summary.rowsWithWarnings += 1;
        summary.warningsCount += row.warnings.length;
      }
      return summary;
    },
    {
      rowsReceived: 0,
      rowsCreated: 0,
      rowsUpdated: 0,
      rowsSkipped: 0,
      rowsFailed: 0,
      rowsWithWarnings: 0,
      warningsCount: 0,
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
      JSON.stringify({
        ...(row.normalizedRow || {}),
        _warnings: row.warnings || [],
      }),
      row.errors?.length ? row.errors.join('; ') : null,
    ],
  );
}

async function finalizeImportBatch(batchId, summary) {
  const status = summary.rowsFailed > 0
    ? (summary.rowsCreated || summary.rowsUpdated ? 'DONE_WITH_ERRORS' : 'FAILED')
    : 'DONE';

  const notes = [
    summary.rowsSkipped
      ? `Rows skipped because the code already exists and updateExisting=false: ${summary.rowsSkipped}`
      : null,
    summary.rowsWithWarnings
      ? `Rows with warnings: ${summary.rowsWithWarnings}`
      : null,
  ].filter(Boolean).join(' | ') || null;

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

function buildPreviewRows(preparedRows) {
  return preparedRows.slice(0, 100).map((row) => ({
    rowNumber: row.rowNumber,
    action: row.action,
    internalCode: row.internalCode || '',
    title: row.title || row.normalizedRow.title || '',
    errors: row.errors || [],
    warnings: row.warnings || [],
  }));
}

async function resolveCategoryId(row, options, referenceData, auditContext) {
  if (row.categoryId != null && row.categoryId !== '') {
    const resolved = referenceData.categoriesById.get(String(row.categoryId));
    if (!resolved) {
      throw new Error(`Categoría inexistente: ${row.categoryId}`);
    }
    return resolved;
  }

  if (row.categoryName) {
    const key = normalizeLookupKey(row.categoryName);
    const existing = referenceData.categoriesByName.get(key);
    if (existing) {
      return existing;
    }

    if (options.createMissingLookups) {
      const createdId = await findOrCreateCategoryByName(row.categoryName, auditContext);
      referenceData.categoriesByName.set(key, createdId);
      referenceData.categoriesById.set(String(createdId), createdId);
      return createdId;
    }

    return null;
  }

  return null;
}

async function resolveBrandId(row, options, referenceData, auditContext) {
  if (row.brandId != null && row.brandId !== '') {
    const resolved = referenceData.brandsById.get(String(row.brandId));
    if (!resolved) {
      throw new Error(`Marca inexistente: ${row.brandId}`);
    }
    return resolved;
  }

  if (row.brandName) {
    const key = normalizeLookupKey(row.brandName);
    const existing = referenceData.brandsByName.get(key);
    if (existing) {
      return existing;
    }

    if (options.createMissingLookups) {
      const createdId = await findOrCreateBrandByName(row.brandName, auditContext);
      referenceData.brandsByName.set(key, createdId);
      referenceData.brandsById.set(String(createdId), createdId);
      return createdId;
    }
  }

  return null;
}

async function resolveSizeData(row, options, referenceData, auditContext) {
  if (row.sizeId != null && row.sizeId !== '') {
    const resolved = referenceData.sizesById.get(String(row.sizeId));
    if (!resolved) {
      throw new Error(`Talle inexistente: ${row.sizeId}`);
    }

    return {
      sizeId: resolved,
      sizeText: row.sizeText || null,
    };
  }

  const sizeCode = row.sizeCode || null;
  if (sizeCode) {
    const key = normalizeLookupKey(sizeCode);
    const existing = referenceData.sizesByCode.get(key);
    if (existing) {
      return {
        sizeId: existing,
        sizeText: row.sizeText || null,
      };
    }

    if (options.createMissingLookups) {
      const createdId = await findOrCreateSizeByCode(sizeCode, auditContext);
      referenceData.sizesByCode.set(key, createdId);
      referenceData.sizesById.set(String(createdId), createdId);
      return {
        sizeId: createdId,
        sizeText: row.sizeText || null,
      };
    }

    return {
      sizeId: null,
      sizeText: row.sizeText || sizeCode,
    };
  }

  return {
    sizeId: null,
    sizeText: row.sizeText || null,
  };
}

async function materializeImportPayload(preparedRow, referenceData, options, auditContext) {
  const row = preparedRow.normalizedRow;
  const categoryId = await resolveCategoryId(row, options, referenceData, auditContext);
  const brandId = await resolveBrandId(row, options, referenceData, auditContext);
  const sizeData = await resolveSizeData(row, options, referenceData, auditContext);

  const payload = {
    internalCode: preparedRow.internalCode || undefined,
    slug: row.slug || undefined,
    title: row.title,
    seoTitle: row.seoTitle || null,
    seoDescription: row.seoDescription || null,
    canonicalUrl: row.canonicalUrl || null,
    googleProductCategory: row.googleProductCategory || null,
    conditionLabel: row.conditionLabel || null,
    color: row.color || null,
    material: row.material || null,
    gender: row.gender ? String(row.gender).trim().toUpperCase() : null,
    ageGroup: row.ageGroup ? String(row.ageGroup).trim().toUpperCase() : null,
    imageAltOverride: row.imageAltOverride || null,
    categoryId,
    brandId,
    sizeId: sizeData.sizeId,
    sizeText: sizeData.sizeText,
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
    intakeDate: normalizeImportedDate(row.intakeDate) || new Date().toISOString().slice(0, 10),
    quantityTotal: row.quantityTotal ?? 1,
    quantityAvailable: row.quantityAvailable ?? (row.quantityTotal ?? 1),
    quantityReserved: row.quantityReserved ?? 0,
    quantitySold: row.quantitySold ?? 0,
    status: row.status ? String(row.status).trim().toUpperCase() : 'ACTIVE',
    originNotes: row.originNotes || null,
  };

  const validation = articleCreateSchema.safeParse(payload);
  if (!validation.success) {
    throw new Error(validation.error.issues.map((issue) => issue.message).join('; '));
  }

  return validation.data;
}

export async function previewArticleImport({ file, options = {} }) {
  const batchType = detectBatchType(file?.originalname);
  const preparedRows = await prepareImportRows(file, options);

  return {
    batchType,
    columns: FULL_EXPORT_COLUMNS,
    summary: buildImportSummary(preparedRows),
    rows: buildPreviewRows(preparedRows),
  };
}

export async function runArticleImport({ file, options = {}, auditContext }) {
  const batchType = detectBatchType(file?.originalname);
  const preparedRows = await prepareImportRows(file, options);
  const referenceData = await loadImportReferenceData();
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
    rowsWithWarnings: initialSummary.rowsWithWarnings,
    warningsCount: initialSummary.warningsCount,
  };

  for (const row of preparedRows) {
    if (row.action === 'FAILED') {
      summary.rowsFailed += 1;
      await appendImportBatchItem(batchId, row);
      results.push({
        rowNumber: row.rowNumber,
        action: row.action,
        internalCode: row.internalCode || '',
        error: row.errors?.join('; ') || 'Fila inválida',
        warnings: row.warnings || [],
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
        message: 'El código ya existe y updateExisting está desactivado',
        warnings: row.warnings || [],
      });
      continue;
    }

    try {
      const payload = await materializeImportPayload(row, referenceData, options, auditContext);
      const article = row.existingArticle
        ? await updateArticle(row.existingArticle.id, payload, auditContext)
        : await createArticle(payload, auditContext);

      const validPrimaryImage = isRawLocalFileName(row.normalizedImages.primaryImage)
        ? ''
        : (row.normalizedImages.primaryImage ? normalizePublicAssetPath(row.normalizedImages.primaryImage) : '');
      const validAdditionalImages = row.normalizedImages.additionalImages
        .filter((image) => !isRawLocalFileName(image))
        .map((image) => normalizePublicAssetPath(image));

      if (validPrimaryImage || validAdditionalImages.length) {
        await syncArticleImageSources(
          article.id,
          {
            primaryImage: validPrimaryImage,
            additionalImages: validAdditionalImages,
          },
          auditContext,
        );
      }

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
        internalCode: article.internalCode,
        articleId: article.id,
        warnings: row.warnings || [],
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
        warnings: row.warnings || [],
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
      createMissingLookups: Boolean(options.createMissingLookups),
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

function buildTemplateRows(type) {
  if (type === 'full') {
    return [{
      internalCode: '',
      slug: '',
      title: 'Buzo vintage seleccionado',
      seoTitle: '',
      seoDescription: '',
      canonicalUrl: '',
      googleProductCategory: 'Apparel & Accessories > Clothing',
      conditionLabel: 'Muy buen estado',
      color: 'Gris',
      material: 'Algodón',
      gender: 'UNISEX',
      ageGroup: 'ADULT',
      imageAltOverride: '',
      categoryId: '',
      categoryName: 'Buzos',
      brandId: '',
      brandName: 'Champion',
      sizeId: '',
      sizeCode: 'M',
      sizeText: '',
      measurementsText: 'Pecho 58 cm / Largo 68 cm',
      description: 'Prenda seleccionada una por una.',
      purchasePriceItem: 0,
      purchasePriceShipping: 0,
      purchasePriceCourier: 0,
      purchasePriceTotal: '',
      salePrice: 1490,
      discountType: 'NONE',
      discountValue: 0,
      discountedPrice: '',
      allowOffers: false,
      isFeatured: false,
      intakeDate: '',
      quantityTotal: 1,
      quantityAvailable: '',
      quantityReserved: 0,
      quantitySold: 0,
      status: 'ACTIVE',
      originNotes: '',
      primaryImage: '/uploads/articles/ejemplo-principal.jpg',
      additionalImages: 'https://ejemplo.com/foto-espalda.jpg,/uploads/articles/ejemplo-detalle.jpg',
    }];
  }

  return [{
    title: 'Campera seleccionada',
    salePrice: 1890,
    categoryName: 'Camperas',
    brandName: 'Nike',
    sizeText: 'L',
    measurementsText: 'Pecho 63 cm / Largo 72 cm',
    description: 'Prenda única en muy buen estado.',
    conditionLabel: 'Muy buen estado',
    color: 'Azul marino',
    material: 'Nylon',
    quantityTotal: 1,
    allowOffers: true,
    isFeatured: false,
    primaryImage: '/uploads/articles/ejemplo-principal.jpg',
    additionalImages: 'https://ejemplo.com/espalda.jpg,/uploads/articles/ejemplo-detalle.jpg',
  }];
}

export async function buildArticleImportTemplate({ format, type }) {
  const safeFormat = format === 'csv' ? 'csv' : 'xlsx';
  const rows = buildTemplateRows(type);
  const columns = type === 'full' ? FULL_EXPORT_COLUMNS : SIMPLE_TEMPLATE_COLUMNS;
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: columns });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, type === 'full' ? 'template_full' : 'template_simple');
  const fileName = `esadar-plantilla-${type}.${safeFormat}`;

  if (safeFormat === 'csv') {
    const csv = XLSX.utils.sheet_to_csv(worksheet, { FS: ',', RS: '\n' });
    return {
      contentType: 'text/csv; charset=utf-8',
      fileName,
      payload: Buffer.from(`\uFEFF${csv}`, 'utf8'),
    };
  }

  return {
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fileName,
    payload: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
  };
}

export async function buildArticleExport({ filters, format, auditContext }) {
  const rows = await listAdminArticlesForExport({ filters });
  const exportRows = rows.map((row) => ({
    internalCode: row.internalCode,
    slug: row.slug,
    title: row.title,
    seoTitle: row.seoTitle || '',
    seoDescription: row.seoDescription || '',
    canonicalUrl: row.canonicalUrl || '',
    googleProductCategory: row.googleProductCategory || '',
    conditionLabel: row.conditionLabel || '',
    color: row.color || '',
    material: row.material || '',
    gender: row.gender || '',
    ageGroup: row.ageGroup || '',
    imageAltOverride: row.imageAltOverride || '',
    categoryId: row.categoryId || '',
    categoryName: row.categoryName || '',
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
    additionalImages: row.additionalImages || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportRows, {
    header: FULL_EXPORT_COLUMNS,
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
