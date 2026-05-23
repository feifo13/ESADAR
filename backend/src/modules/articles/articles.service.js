import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { badRequest, notFound } from '../../utils/app-error.js';
import {
  buildArticleUploadPublicPath,
  normalizePublicAssetPath,
  sanitizePublicUrl,
} from '../../utils/assets.js';
import { appendDateRangeFilters, buildLikeValue, resolveSortClause } from '../../utils/listing.js';
import { buildSqlLimitClause, buildSqlLimitOffsetClause, buildSqlPlaceholders, normalizeSqlLimit, normalizeSqlOffset, resolveAllowedSqlIdentifier } from '../../utils/sql-safety.js';
import { slugify, uniqueSlug } from '../../utils/slug.js';
import { logAudit } from '../audit/audit.service.js';
import {
  adjustInventory,
  createInitialInventory,
} from '../inventory/inventory.service.js';
import { deriveStockStatus } from '../inventory/inventory.constants.js';
import { buildImportedImageRecord, deleteArticleImageFiles, processUploadedArticleImage } from './article-image-processing.js';
import { enrichArticleSeo } from './articles.seo.js';

const publicBaseSelect = `
  SELECT
    a.id,
    a.internal_code AS internalCode,
    a.slug,
    a.title,
    a.seo_title AS seoTitle,
    a.seo_description AS seoDescription,
    a.google_product_category AS googleProductCategory,
    a.condition_label AS conditionLabel,
    a.color,
    a.material,
    a.gender,
    a.age_group AS ageGroup,
    a.image_alt_override AS imageAltOverride,
    a.canonical_url AS canonicalUrl,
    a.measurements_text AS measurementsText,
    a.description,
    a.weight_kg AS weightKg,
    a.purchase_price_item AS purchasePriceItem,
    a.purchase_price_shipping AS purchasePriceShipping,
    a.purchase_price_courier AS purchasePriceCourier,
    a.purchase_price_total AS purchasePriceTotal,
    a.sale_price AS salePrice,
    a.discount_type AS discountType,
    a.discount_value AS discountValue,
    a.discounted_price AS discountedPrice,
    a.allow_offers AS allowOffers,
    a.is_featured AS isFeatured,
    a.intake_date AS intakeDate,
    inv.quantity_total AS quantityTotal,
    inv.quantity_available AS quantityAvailable,
    inv.quantity_reserved AS quantityReserved,
    inv.quantity_sold AS quantitySold,
    inv.quantity_lost AS quantityLost,
    a.status AS publicationStatus,
    a.origin_notes AS originNotes,
    a.created_at AS createdAt,
    a.updated_at AS updatedAt,
    a.created_by AS createdBy,
    a.updated_by AS updatedBy,
    c.id AS categoryId,
    c.name AS categoryName,
    c.slug AS categorySlug,
    b.id AS brandId,
    b.name AS brandName,
    b.slug AS brandSlug,
    s.id AS sizeId,
    s.code AS sizeCode,
    a.size_text AS sizeText,
    (
      SELECT COALESCE(ai.card_file_path, ai.thumb_file_path, ai.detail_file_path, ai.file_path)
      FROM article_images ai
      WHERE ai.article_id = a.id
      ORDER BY ai.is_primary DESC, ai.sort_order ASC, ai.id ASC
      LIMIT 1
    ) AS primaryImage,
    (
      SELECT COALESCE(ai.card_file_path, ai.thumb_file_path, ai.detail_file_path, ai.file_path)
      FROM article_images ai
      WHERE ai.article_id = a.id
      ORDER BY ai.is_primary DESC, ai.sort_order ASC, ai.id ASC
      LIMIT 1
    ) AS primaryImageCard,
    (
      SELECT COALESCE(ai.detail_file_path, ai.card_file_path, ai.file_path)
      FROM article_images ai
      WHERE ai.article_id = a.id
      ORDER BY ai.is_primary DESC, ai.sort_order ASC, ai.id ASC
      LIMIT 1
    ) AS primaryImageDetail,
    (
      SELECT COALESCE(ai.thumb_file_path, ai.card_file_path, ai.file_path)
      FROM article_images ai
      WHERE ai.article_id = a.id
      ORDER BY ai.is_primary DESC, ai.sort_order ASC, ai.id ASC
      LIMIT 1
    ) AS primaryImageThumb,
    (
      SELECT COALESCE(ai.zoom_file_path, ai.detail_file_path, ai.original_file_path, ai.file_path)
      FROM article_images ai
      WHERE ai.article_id = a.id
      ORDER BY ai.is_primary DESC, ai.sort_order ASC, ai.id ASC
      LIMIT 1
    ) AS primaryImageZoom,
    (
      SELECT COALESCE(ai.original_file_path, ai.file_path)
      FROM article_images ai
      WHERE ai.article_id = a.id
      ORDER BY ai.is_primary DESC, ai.sort_order ASC, ai.id ASC
      LIMIT 1
    ) AS primaryImageOriginal,
    (
      SELECT COALESCE(ai.alt_text, a.image_alt_override, a.title)
      FROM article_images ai
      WHERE ai.article_id = a.id
      ORDER BY ai.is_primary DESC, ai.sort_order ASC, ai.id ASC
      LIMIT 1
    ) AS primaryImageAlt
  FROM articles a
  INNER JOIN categories c ON c.id = a.category_id
  LEFT JOIN brands b ON b.id = a.brand_id
  LEFT JOIN sizes s ON s.id = a.size_id
  INNER JOIN article_inventory inv ON inv.article_id = a.id
`;

const ADMIN_ARTICLE_SORTS = {
  intakeDate: (direction) => `a.intake_date ${direction}, a.id ${direction}`,
  updatedAt: (direction) => `a.updated_at ${direction}, a.id ${direction}`,
  title: (direction) => `a.title ${direction}, a.id DESC`,
  salePrice: (direction) => `a.sale_price ${direction}, a.id DESC`,
  discountedPrice: (direction) => `a.discounted_price ${direction}, a.id DESC`,
  status: (direction) => `a.status ${direction}, a.id DESC`,
  quantityAvailable: (direction) => `inv.quantity_available ${direction}, a.id DESC`,
  categoryName: (direction) => `c.name ${direction}, a.id DESC`,
  brandName: (direction) => `COALESCE(b.name, '') ${direction}, a.id DESC`,
  internalCode: (direction) => `a.internal_code ${direction}, a.id DESC`,
};

const ARTICLE_LOOKUP_IDENTIFIERS = {
  categories: { tableName: 'categories', fields: { name: 'name', slug: 'slug' } },
  brands: { tableName: 'brands', fields: { name: 'name', slug: 'slug' } },
};

function resolveArticleLookupIdentifiers(tableName, fieldName = null) {
  const tableConfig = resolveAllowedSqlIdentifier(tableName, ARTICLE_LOOKUP_IDENTIFIERS, 'lookup de articulo');
  if (!fieldName) return { tableName: tableConfig.tableName };
  return {
    tableName: tableConfig.tableName,
    fieldName: resolveAllowedSqlIdentifier(fieldName, tableConfig.fields, 'campo de lookup de articulo'),
  };
}

function buildPublicFilters(query, includeInactive = false) {
  const clauses = [];
  const params = [];

  if (!includeInactive) {
    clauses.push(`a.status = 'ACTIVE'`);
  }

  if (query.search) {
    clauses.push('(a.title LIKE ? OR b.name LIKE ? OR c.name LIKE ? OR a.internal_code LIKE ?)');
    const like = `%${query.search}%`;
    params.push(like, like, like, like);
  }

  if (query.categoryId) {
    clauses.push('a.category_id = ?');
    params.push(Number(query.categoryId));
  }

  if (query.brandId) {
    clauses.push('a.brand_id = ?');
    params.push(Number(query.brandId));
  }

  if (query.sizeId) {
    clauses.push('a.size_id = ?');
    params.push(Number(query.sizeId));
  }

  if (query.featured === true || query.featured === 'true') {
    clauses.push('a.is_featured = 1');
  }

  if (query.discounted === true || query.discounted === 'true') {
    clauses.push(`a.discount_type <> 'NONE'`);
    clauses.push('a.discount_value > 0');
  }

  if (query.offerable === true || query.offerable === 'true') {
    clauses.push('a.allow_offers = 1');
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return { where, params };
}

function resolveArticleSort(sort) {
  switch (sort) {
    case 'price_asc':
      return 'a.discounted_price ASC, a.id DESC';
    case 'price_desc':
      return 'a.discounted_price DESC, a.id DESC';
    case 'intake_asc':
      return 'a.intake_date ASC, a.id ASC';
    case 'intake_desc':
    default:
      return 'a.intake_date DESC, a.id DESC';
  }
}

function buildAdminArticleFilters(filters) {
  const clauses = [];
  const params = [];
  const searchTerm = filters.q || filters.search;

  if (searchTerm) {
    const like = buildLikeValue(searchTerm);
    clauses.push(`(
      a.internal_code LIKE ?
      OR a.title LIKE ?
      OR a.slug LIKE ?
      OR a.description LIKE ?
      OR COALESCE(a.seo_title, '') LIKE ?
      OR COALESCE(a.seo_description, '') LIKE ?
      OR c.name LIKE ?
      OR COALESCE(b.name, '') LIKE ?
      OR COALESCE(s.code, '') LIKE ?
      OR COALESCE(a.size_text, '') LIKE ?
    )`);
    params.push(like, like, like, like, like, like, like, like, like, like);
  }

  if (filters.status === 'RESERVED') {
    clauses.push('inv.quantity_available = 0 AND inv.quantity_reserved > 0');
  } else if (filters.status === 'SOLD_OUT') {
    clauses.push('inv.quantity_available = 0 AND inv.quantity_reserved = 0 AND inv.quantity_sold > 0');
  } else if (filters.status) {
    clauses.push('a.status = ?');
    params.push(filters.status);
  }

  if (filters.featured !== undefined) {
    clauses.push('a.is_featured = ?');
    params.push(filters.featured ? 1 : 0);
  }

  if (filters.offerable !== undefined) {
    clauses.push('a.allow_offers = ?');
    params.push(filters.offerable ? 1 : 0);
  }

  if (filters.categoryId) {
    clauses.push('a.category_id = ?');
    params.push(filters.categoryId);
  }

  if (filters.brandId) {
    clauses.push('a.brand_id = ?');
    params.push(filters.brandId);
  }

  if (filters.sizeId) {
    clauses.push('a.size_id = ?');
    params.push(filters.sizeId);
  }

  appendDateRangeFilters('a.intake_date', filters, clauses, params);

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return { where, params };
}

function resolveAdminArticleSort(filters) {
  if (filters.sortBy) {
    return resolveSortClause({
      sortBy: filters.sortBy,
      sortDir: filters.sortDir,
      sortMap: ADMIN_ARTICLE_SORTS,
      fallbackKey: 'intakeDate',
    });
  }

  if (filters.sort) {
    return resolveArticleSort(filters.sort);
  }

  return resolveSortClause({
    sortBy: 'intakeDate',
    sortDir: filters.sortDir,
    sortMap: ADMIN_ARTICLE_SORTS,
    fallbackKey: 'intakeDate',
  });
}

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function resolveWritableArticleStatus(status = 'ACTIVE') {
  const normalizedStatus = String(status || 'ACTIVE').trim().toUpperCase();
  if (['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'].includes(normalizedStatus)) {
    return normalizedStatus;
  }
  if (['RESERVED', 'SOLD_OUT'].includes(normalizedStatus)) {
    return 'ACTIVE';
  }
  return 'ACTIVE';
}

export async function generateUniqueInternalCode(connection = pool) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = `ART-${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
    const [rows] = await connection.execute(
      'SELECT id FROM articles WHERE internal_code = ? LIMIT 1',
      [code],
    );

    if (!rows.length) {
      return code;
    }
  }

  throw badRequest('No se pudo generar un código interno único');
}

async function ensureUniqueSlug(connection, rawValue, excludeId = null) {
  const baseSlug = slugify(rawValue) || uniqueSlug('articulo');
  let candidate = baseSlug;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const params = excludeId != null ? [candidate, excludeId] : [candidate];
    const [rows] = await connection.execute(
      `SELECT id FROM articles WHERE slug = ?${excludeId != null ? ' AND id <> ?' : ''} LIMIT 1`,
      params,
    );

    if (!rows.length) {
      return candidate;
    }

    candidate = `${baseSlug}-${attempt + 1}`;
  }

  return uniqueSlug(baseSlug);
}

async function ensureDefaultCategoryId(connection, actorUserId = null) {
  const [rows] = await connection.execute(
    'SELECT id FROM categories WHERE slug = ? OR LOWER(name) = LOWER(?) ORDER BY id ASC LIMIT 1',
    ['sin-categoria', 'Sin categoría'],
  );

  if (rows.length) {
    return Number(rows[0].id);
  }

  const [insertResult] = await connection.execute(
    `
      INSERT INTO categories (
        name,
        slug,
        description,
        is_active,
        created_by,
        updated_by
      ) VALUES ('Sin categoría', 'sin-categoria', 'Categoría generada automáticamente para artículos sin clasificar.', 1, ?, ?)
    `,
    [actorUserId || null, actorUserId || null],
  );

  return Number(insertResult.insertId);
}

export async function findLookupByName(tableName, fieldName, value, connection = pool) {
  if (!value) return null;

  const identifiers = resolveArticleLookupIdentifiers(tableName, fieldName);
  const [rows] = await connection.execute(
    `SELECT id, ${identifiers.fieldName} AS value FROM ${identifiers.tableName} WHERE LOWER(${identifiers.fieldName}) = LOWER(?) LIMIT 1`,
    [String(value).trim()],
  );

  return rows[0] || null;
}

export async function findOrCreateCategoryByName(name, auditContext, connection = pool) {
  const normalizedName = String(name || '').trim();
  if (!normalizedName) return null;

  const existing = await findLookupByName('categories', 'name', normalizedName, connection);
  if (existing) return Number(existing.id);

  const [insertResult] = await connection.execute(
    `
      INSERT INTO categories (name, slug, description, is_active, created_by, updated_by)
      VALUES (?, ?, NULL, 1, ?, ?)
    `,
    [normalizedName, await ensureUniqueCategorySlug(normalizedName, connection), auditContext?.actorUserId || null, auditContext?.actorUserId || null],
  );

  return Number(insertResult.insertId);
}

export async function findOrCreateBrandByName(name, auditContext, connection = pool) {
  const normalizedName = String(name || '').trim();
  if (!normalizedName) return null;

  const existing = await findLookupByName('brands', 'name', normalizedName, connection);
  if (existing) return Number(existing.id);

  const [insertResult] = await connection.execute(
    `
      INSERT INTO brands (name, slug, is_active, created_by, updated_by)
      VALUES (?, ?, 1, ?, ?)
    `,
    [normalizedName, await ensureUniqueBrandSlug(normalizedName, connection), auditContext?.actorUserId || null, auditContext?.actorUserId || null],
  );

  return Number(insertResult.insertId);
}

export async function findOrCreateSizeByCode(code, auditContext, connection = pool) {
  const normalizedCode = String(code || '').trim();
  if (!normalizedCode) return null;

  const [rows] = await connection.execute(
    'SELECT id FROM sizes WHERE LOWER(code) = LOWER(?) LIMIT 1',
    [normalizedCode],
  );

  if (rows.length) {
    return Number(rows[0].id);
  }

  const [insertResult] = await connection.execute(
    `
      INSERT INTO sizes (code, description, sort_order, is_active)
      VALUES (?, ?, NULL, 1)
    `,
    [normalizedCode, normalizedCode],
  );

  return Number(insertResult.insertId);
}

async function ensureUniqueCategorySlug(name, connection) {
  return ensureUniqueSlugByTable('categories', slugify(name), connection);
}

async function ensureUniqueBrandSlug(name, connection) {
  return ensureUniqueSlugByTable('brands', slugify(name), connection);
}

async function ensureUniqueSlugByTable(tableName, baseValue, connection) {
  const { tableName: safeTableName } = resolveArticleLookupIdentifiers(tableName);
  const baseSlug = baseValue || uniqueSlug('item');
  let candidate = baseSlug;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const [rows] = await connection.execute(
      `SELECT id FROM ${safeTableName} WHERE slug = ? LIMIT 1`,
      [candidate],
    );

    if (!rows.length) {
      return candidate;
    }

    candidate = `${baseSlug}-${attempt + 1}`;
  }

  return uniqueSlug(baseSlug);
}

async function resolveArticleCategoryId(input, connection, auditContext) {
  if (input.categoryId) return Number(input.categoryId);
  if (input.categoryName) {
    return findOrCreateCategoryByName(input.categoryName, auditContext, connection);
  }
  return ensureDefaultCategoryId(connection, auditContext.actorUserId);
}

async function resolveArticleBrandId(input, connection, auditContext) {
  if (input.brandId) return Number(input.brandId);
  if (input.brandName) {
    return findOrCreateBrandByName(input.brandName, auditContext, connection);
  }
  return null;
}

async function resolveArticleSizeId(input, connection, auditContext) {
  if (input.sizeId) return Number(input.sizeId);
  if (input.sizeCode) {
    return findOrCreateSizeByCode(input.sizeCode, auditContext, connection);
  }
  return null;
}

async function normalizeArticleWritePayload(input, connection, auditContext = {}, isUpdate = false, currentId = null) {
  const title = String(input.title || '').trim();
  if (!title) {
    throw badRequest('Title is required');
  }

  const internalCode = input.internalCode
    ? String(input.internalCode).trim()
    : await generateUniqueInternalCode(connection);
  const slug = await ensureUniqueSlug(connection, input.slug || title, currentId);
  let quantityTotal = Number(input.quantityTotal ?? 1);
  const quantityReserved = Number(input.quantityReserved ?? 0);
  const quantitySold = Number(input.quantitySold ?? 0);
  const quantityAvailable = Number(input.quantityAvailable ?? quantityTotal - quantityReserved - quantitySold);
  let quantityLost = Number(input.quantityLost ?? quantityTotal - quantityAvailable - quantityReserved - quantitySold);
  const minimumQuantityTotal = quantityAvailable + quantityReserved + quantitySold;

  if (
    [quantityTotal, quantityAvailable, quantityReserved, quantitySold, quantityLost].some(
      (value) => !Number.isFinite(value) || !Number.isInteger(value) || value < 0,
    )
  ) {
    throw badRequest('Las cantidades de stock no pueden ser negativas.');
  }

  if (quantityTotal < minimumQuantityTotal) {
    if (!isUpdate) {
      throw badRequest('El stock total debe cubrir disponible, reservado y vendido.');
    }
    quantityTotal = minimumQuantityTotal;
    quantityLost = 0;
  } else if (quantityLost !== quantityTotal - minimumQuantityTotal) {
    quantityLost = quantityTotal - minimumQuantityTotal;
  }

  if (Boolean(input.allowOffers) && input.discountType !== 'NONE' && Number(input.discountValue || 0) > 0) {
    throw badRequest('Articles with discount cannot allow offers');
  }

  const status = resolveWritableArticleStatus(input.status || input.publicationStatus || 'ACTIVE');

  return {
    internalCode,
    slug,
    title,
    seoTitle: input.seoTitle || null,
    seoDescription: input.seoDescription || null,
    googleProductCategory: input.googleProductCategory || null,
    conditionLabel: input.conditionLabel || null,
    color: input.color || null,
    material: input.material || null,
    gender: input.gender || null,
    ageGroup: input.ageGroup || null,
    imageAltOverride: input.imageAltOverride || null,
    canonicalUrl: sanitizePublicUrl(input.canonicalUrl) || null,
    categoryId: await resolveArticleCategoryId(input, connection, auditContext),
    brandId: await resolveArticleBrandId(input, connection, auditContext),
    sizeId: await resolveArticleSizeId(input, connection, auditContext),
    sizeText: input.sizeText || null,
    measurementsText: input.measurementsText || null,
    description: input.description || null,
    weightKg: Number(input.weightKg || 0),
    purchasePriceItem: Number(input.purchasePriceItem || 0),
    purchasePriceShipping: Number(input.purchasePriceShipping || 0),
    purchasePriceCourier: Number(input.purchasePriceCourier || 0),
    salePrice: Number(input.salePrice),
    discountType: input.discountType || 'NONE',
    discountValue: Number(input.discountValue || 0),
    allowOffers: Boolean(input.allowOffers),
    isFeatured: Boolean(input.isFeatured),
    intakeDate: input.intakeDate || getTodayDateString(),
    quantityTotal,
    quantityAvailable,
    quantityReserved,
    quantitySold,
    quantityLost,
    status,
    originNotes: input.originNotes || null,
    isUpdate,
  };
}

async function getArticleRows(whereClause, params = [], connection = pool) {
  const [rows] = await connection.execute(
    `${publicBaseSelect} ${whereClause}`,
    params,
  );

  return rows.map(normalizeArticleRow);
}

function normalizeArticleRow(row) {
  const normalized = {
    id: Number(row.id),
    internalCode: row.internalCode,
    slug: row.slug,
    title: row.title,
    seoTitle: row.seoTitle || null,
    seoDescription: row.seoDescription || null,
    canonicalUrl: sanitizePublicUrl(row.canonicalUrl) || null,
    googleProductCategory: row.googleProductCategory || null,
    conditionLabel: row.conditionLabel || null,
    color: row.color || null,
    material: row.material || null,
    gender: row.gender || null,
    ageGroup: row.ageGroup || null,
    imageAltOverride: row.imageAltOverride || null,
    measurementsText: row.measurementsText || null,
    description: row.description || null,
    weightKg: row.weightKg != null ? Number(row.weightKg) : 0,
    purchasePriceItem: row.purchasePriceItem != null ? Number(row.purchasePriceItem) : 0,
    purchasePriceShipping: row.purchasePriceShipping != null ? Number(row.purchasePriceShipping) : 0,
    purchasePriceCourier: row.purchasePriceCourier != null ? Number(row.purchasePriceCourier) : 0,
    purchasePriceTotal: row.purchasePriceTotal != null ? Number(row.purchasePriceTotal) : 0,
    salePrice: Number(row.salePrice),
    discountType: row.discountType,
    discountValue: Number(row.discountValue),
    discountedPrice: Number(row.discountedPrice),
    allowOffers: Boolean(Number(row.allowOffers || 0)),
    isFeatured: Boolean(Number(row.isFeatured || 0)),
    intakeDate: row.intakeDate,
    quantityTotal: row.quantityTotal != null ? Number(row.quantityTotal) : 0,
    quantityAvailable: row.quantityAvailable != null ? Number(row.quantityAvailable) : 0,
    quantityReserved: row.quantityReserved != null ? Number(row.quantityReserved) : 0,
    quantitySold: row.quantitySold != null ? Number(row.quantitySold) : 0,
    quantityLost: row.quantityLost != null ? Number(row.quantityLost) : 0,
    status: row.publicationStatus || row.status,
    publicationStatus: row.publicationStatus || row.status,
    stockStatus: deriveStockStatus({
      quantityAvailable: row.quantityAvailable,
      quantityReserved: row.quantityReserved,
      quantitySold: row.quantitySold,
    }),
    originNotes: row.originNotes || null,
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
    createdBy: row.createdBy || null,
    updatedBy: row.updatedBy || null,
    categoryId: Number(row.categoryId),
    categoryName: row.categoryName,
    categorySlug: row.categorySlug,
    category: {
      id: Number(row.categoryId),
      name: row.categoryName,
      slug: row.categorySlug,
    },
    brandId: row.brandId != null ? Number(row.brandId) : null,
    brandName: row.brandName || null,
    brandSlug: row.brandSlug || null,
    brand: row.brandId != null ? {
      id: Number(row.brandId),
      name: row.brandName,
      slug: row.brandSlug,
    } : null,
    sizeId: row.sizeId != null ? Number(row.sizeId) : null,
    sizeCode: row.sizeCode || null,
    sizeText: row.sizeText || null,
    size: row.sizeId != null ? {
      id: Number(row.sizeId),
      code: row.sizeCode,
    } : null,
    primaryImage: normalizePublicAssetPath(row.primaryImage || row.primaryImageCard || row.primaryImageDetail || ''),
    primaryImageCard: normalizePublicAssetPath(row.primaryImageCard || row.primaryImage || row.primaryImageDetail || ''),
    primaryImageDetail: normalizePublicAssetPath(row.primaryImageDetail || row.primaryImageCard || row.primaryImage || ''),
    primaryImageThumb: normalizePublicAssetPath(row.primaryImageThumb || row.primaryImageCard || row.primaryImage || ''),
    primaryImageZoom: normalizePublicAssetPath(row.primaryImageZoom || row.primaryImageDetail || row.primaryImageOriginal || row.primaryImage || ''),
    primaryImageOriginal: normalizePublicAssetPath(row.primaryImageOriginal || row.primaryImageDetail || row.primaryImage || ''),
    imageThumbUrl: normalizePublicAssetPath(row.primaryImageThumb || row.primaryImageCard || row.primaryImage || ''),
    imageCardUrl: normalizePublicAssetPath(row.primaryImageCard || row.primaryImageDetail || row.primaryImage || ''),
    imageDetailUrl: normalizePublicAssetPath(row.primaryImageDetail || row.primaryImageZoom || row.primaryImageCard || row.primaryImage || ''),
    imageZoomUrl: normalizePublicAssetPath(row.primaryImageZoom || row.primaryImageDetail || row.primaryImageOriginal || row.primaryImage || ''),
    imageOriginalUrl: normalizePublicAssetPath(row.primaryImageOriginal || row.primaryImageZoom || row.primaryImageDetail || row.primaryImage || ''),
    primaryImageAlt: row.primaryImageAlt || row.imageAltOverride || row.title,
  };

  return enrichArticleSeo(normalized);
}

async function getArticleImagesMap(articleIds, connection = pool) {
  if (!articleIds.length) {
    return new Map();
  }

  const placeholders = buildSqlPlaceholders(articleIds);
  const [rows] = await connection.execute(
    `
      SELECT
        ai.id,
        ai.article_id AS articleId,
        ai.file_path AS filePath,
        ai.original_file_path AS originalFilePath,
        ai.thumb_file_path AS thumbFilePath,
        ai.card_file_path AS cardFilePath,
        ai.detail_file_path AS detailFilePath,
        ai.zoom_file_path AS zoomFilePath,
        ai.width,
        ai.height,
        ai.mime_type AS mimeType,
        ai.file_size_bytes AS fileSizeBytes,
        ai.dominant_color AS dominantColor,
        ai.processed_status AS processedStatus,
        ai.processing_error AS processingError,
        COALESCE(ai.alt_text, a.image_alt_override, a.title) AS altText,
        ai.sort_order AS sortOrder,
        ai.is_primary AS isPrimary,
        ai.created_at AS createdAt,
        ai.created_by AS createdBy
      FROM article_images ai
      INNER JOIN articles a ON a.id = ai.article_id
      WHERE ai.article_id IN (${placeholders})
      ORDER BY ai.article_id ASC, ai.is_primary DESC, ai.sort_order ASC, ai.id ASC
    `,
    articleIds,
  );

  const map = new Map();
  for (const row of rows) {
    const articleId = Number(row.articleId);
    const current = map.get(articleId) || [];
    current.push(normalizeArticleImageRow(row));
    map.set(articleId, current);
  }

  return map;
}

function normalizeArticleImageRow(row) {
  return {
    id: Number(row.id),
    filePath: normalizePublicAssetPath(row.filePath),
    originalFilePath: normalizePublicAssetPath(row.originalFilePath || row.filePath),
    thumbFilePath: normalizePublicAssetPath(row.thumbFilePath || row.filePath),
    cardFilePath: normalizePublicAssetPath(row.cardFilePath || row.detailFilePath || row.filePath),
    detailFilePath: normalizePublicAssetPath(row.detailFilePath || row.filePath),
    zoomFilePath: normalizePublicAssetPath(row.zoomFilePath || row.detailFilePath || row.filePath),
    width: row.width != null ? Number(row.width) : null,
    height: row.height != null ? Number(row.height) : null,
    mimeType: row.mimeType || null,
    fileSizeBytes: row.fileSizeBytes != null ? Number(row.fileSizeBytes) : null,
    dominantColor: row.dominantColor || null,
    processedStatus: row.processedStatus || 'DONE',
    processingError: row.processingError || null,
    altText: row.altText || '',
    sortOrder: Number(row.sortOrder || 0),
    isPrimary: Boolean(row.isPrimary),
    createdAt: row.createdAt || null,
    createdBy: row.createdBy || null,
  };
}

export async function getArticleImages(articleId, connection = pool) {
  const imagesMap = await getArticleImagesMap([Number(articleId)], connection);
  return imagesMap.get(Number(articleId)) || [];
}

export async function listPublicArticleAvailabilityByIds(articleIds = []) {
  const ids = [...new Set((articleIds || [])
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0))]
    .slice(0, 100);

  if (!ids.length) {
    return [];
  }

  const placeholders = buildSqlPlaceholders(ids);
  const [rows] = await pool.execute(
    `
      SELECT
        a.id,
        a.status AS publicationStatus,
        inv.quantity_available AS quantityAvailable,
        inv.quantity_reserved AS quantityReserved,
        inv.quantity_sold AS quantitySold
      FROM articles a
      INNER JOIN article_inventory inv ON inv.article_id = a.id
      WHERE a.id IN (${placeholders})
    `,
    ids,
  );

  return rows.map((row) => ({
    id: Number(row.id),
    publicationStatus: row.publicationStatus || 'INACTIVE',
    status: row.publicationStatus === 'ACTIVE'
      ? deriveStockStatus(row)
      : 'INACTIVE',
    stockStatus: deriveStockStatus(row),
    quantityAvailable: Number(row.quantityAvailable || 0),
    quantityReserved: Number(row.quantityReserved || 0),
    quantitySold: Number(row.quantitySold || 0),
  }));
}

export async function listPublicArticles({ filters, pagination }) {
  const { where, params } = buildPublicFilters(filters, false);
  const orderBy = resolveArticleSort(filters.sort);
  const safeLimit = normalizeSqlLimit(pagination.limit, 20, 100);
  const safeOffset = normalizeSqlOffset(pagination.offset);
  const limitOffsetClause = buildSqlLimitOffsetClause(safeLimit, safeOffset, 20, 100);

  const [items] = await pool.execute(
    `${publicBaseSelect}
     ${where}
     ORDER BY ${orderBy}
     ${limitOffsetClause}`,
    params,
  );

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total
     FROM articles a
     INNER JOIN categories c ON c.id = a.category_id
     LEFT JOIN brands b ON b.id = a.brand_id
     LEFT JOIN sizes s ON s.id = a.size_id
     INNER JOIN article_inventory inv ON inv.article_id = a.id
     ${where}`,
    params,
  );

  return {
    items: items.map(normalizeArticleRow),
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: countRows[0].total,
    },
  };
}

export async function getPublicArticleBySlugOrId(slugOrId) {
  const rows = await getArticleRows(
    `WHERE (a.slug = ? OR a.id = ?) LIMIT 1`,
    [slugOrId, Number(slugOrId) || 0],
  );

  if (!rows.length) {
    throw notFound('Article not found');
  }

  const article = rows[0];
  article.images = await getArticleImages(article.id);
  article.isUnavailable = article.publicationStatus !== 'ACTIVE';

  return article;
}

export async function getRelatedPublicArticles(slugOrId, limit = 8) {
  const article = await getPublicArticleBySlugOrId(slugOrId);
  const safeLimit = Math.max(1, Math.min(Number(limit) || 8, 12));
  const limitClause = buildSqlLimitClause(safeLimit, 8, 12);

  const [sameCategoryRows] = await pool.execute(
    `
      ${publicBaseSelect}
      WHERE
        a.id <> ?
        AND a.status = 'ACTIVE'
        AND COALESCE(inv.quantity_available, 0) > 0
        AND a.category_id = ?
      ORDER BY
        a.is_featured DESC,
        CASE WHEN a.brand_id <=> ? THEN 0 ELSE 1 END ASC,
        CASE WHEN COALESCE(a.color, '') = COALESCE(?, '') THEN 0 ELSE 1 END ASC,
        CASE WHEN COALESCE(a.size_text, s.code, '') = COALESCE(?, '') THEN 0 ELSE 1 END ASC,
        a.intake_date DESC,
        a.id DESC
      ${limitClause}
    `,
    [
      article.id,
      article.categoryId,
      article.brandId,
      article.color || null,
      article.sizeText || article.sizeCode || null,
    ],
  );

  if (sameCategoryRows.length) {
    return {
      mode: 'same_category',
      categoryName: article.categoryName || null,
      items: sameCategoryRows.map(normalizeArticleRow),
    };
  }

  const [fallbackRows] = await pool.execute(
    `
      ${publicBaseSelect}
      WHERE
        a.id <> ?
        AND a.status = 'ACTIVE'
        AND COALESCE(inv.quantity_available, 0) > 0
      ORDER BY
        a.is_featured DESC,
        a.intake_date DESC,
        a.id DESC
      ${limitClause}
    `,
    [article.id],
  );

  if (!fallbackRows.length) {
    return {
      mode: 'empty',
      categoryName: article.categoryName || null,
      items: [],
    };
  }

  return {
    mode: 'fallback',
    categoryName: article.categoryName || null,
    items: fallbackRows.map(normalizeArticleRow),
  };
}

export async function listAdminArticles({ filters, pagination }) {
  const { where, params } = buildAdminArticleFilters(filters);
  const orderBy = resolveAdminArticleSort(filters);
  const safeLimit = normalizeSqlLimit(pagination.limit, 25, 100);
  const safeOffset = normalizeSqlOffset(pagination.offset);
  const limitOffsetClause = buildSqlLimitOffsetClause(safeLimit, safeOffset, 25, 100);

  const [items] = await pool.execute(
    `${publicBaseSelect}
     ${where}
     ORDER BY ${orderBy}
     ${limitOffsetClause}`,
    params,
  );

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total
     FROM articles a
     INNER JOIN categories c ON c.id = a.category_id
     LEFT JOIN brands b ON b.id = a.brand_id
     LEFT JOIN sizes s ON s.id = a.size_id
     INNER JOIN article_inventory inv ON inv.article_id = a.id
     ${where}`,
    params,
  );

  return {
    items: items.map(normalizeArticleRow),
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: countRows[0].total,
    },
  };
}

export async function listAdminArticlesForExport({ filters }) {
  const { where, params } = buildAdminArticleFilters(filters);
  const orderBy = resolveAdminArticleSort(filters);
  const [rows] = await pool.execute(
    `${publicBaseSelect}
     ${where}
     ORDER BY ${orderBy}`,
    params,
  );

  const normalizedRows = rows.map(normalizeArticleRow);
  const imagesMap = await getArticleImagesMap(normalizedRows.map((row) => row.id));

  return normalizedRows.map((row) => {
    const images = imagesMap.get(row.id) || [];
    const primaryImage = images[0] || null;
    const additionalImages = images.slice(primaryImage ? 1 : 0);

    return {
      ...row,
      primaryImage: primaryImage?.originalFilePath || row.primaryImage || '',
      additionalImages: additionalImages
        .map((image) => image.originalFilePath || image.filePath)
        .filter(Boolean)
        .join(','),
      images,
    };
  });
}

export async function getAdminArticleById(id) {
  const article = await getAdminArticleByIdWithConnection(id, pool);
  return article;
}

export async function createArticle(input, auditContext) {
  return withTransaction(async (connection) => {
    const payload = await normalizeArticleWritePayload(input, connection, auditContext, false, null);

    const [result] = await connection.execute(
      `
        INSERT INTO articles (
          internal_code,
          slug,
          title,
          seo_title,
          seo_description,
          google_product_category,
          condition_label,
          color,
          material,
          gender,
          age_group,
          image_alt_override,
          canonical_url,
          category_id,
          brand_id,
          size_id,
          size_text,
          measurements_text,
          description,
          weight_kg,
          purchase_price_item,
          purchase_price_shipping,
          purchase_price_courier,
          sale_price,
          discount_type,
          discount_value,
          allow_offers,
          is_featured,
          intake_date,
          status,
          origin_notes,
          created_by,
          updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        payload.internalCode,
        payload.slug,
        payload.title,
        payload.seoTitle,
        payload.seoDescription,
        payload.googleProductCategory,
        payload.conditionLabel,
        payload.color,
        payload.material,
        payload.gender,
        payload.ageGroup,
        payload.imageAltOverride,
        payload.canonicalUrl,
        payload.categoryId,
        payload.brandId,
        payload.sizeId,
        payload.sizeText,
        payload.measurementsText,
        payload.description,
        payload.weightKg,
        payload.purchasePriceItem,
        payload.purchasePriceShipping,
        payload.purchasePriceCourier,
        payload.salePrice,
        payload.discountType,
        payload.discountValue,
        payload.allowOffers ? 1 : 0,
        payload.isFeatured ? 1 : 0,
        payload.intakeDate,
        payload.status,
        payload.originNotes,
        auditContext.actorUserId,
        auditContext.actorUserId,
      ],
    );

    const articleId = result.insertId;

    await createInitialInventory(connection, {
      articleId,
      quantityTotal: payload.quantityTotal,
      quantityAvailable: payload.quantityAvailable,
      quantityReserved: payload.quantityReserved,
      quantitySold: payload.quantitySold,
      quantityLost: payload.quantityLost,
      createdBy: auditContext.actorUserId || null,
      reason: 'Stock inicial',
    });

    const created = await getAdminArticleByIdWithConnection(articleId, connection);

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: 'ARTICLE_CREATED',
        entityType: 'articles',
        entityId: articleId,
        afterJson: created,
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return created;
  });
}

export async function updateArticle(id, input, auditContext) {
  return withTransaction(async (connection) => {
    const before = await getAdminArticleByIdWithConnection(id, connection);
    const payload = await normalizeArticleWritePayload(
      {
        ...before,
        ...input,
        quantityReserved: before.quantityReserved,
        quantitySold: before.quantitySold,
        quantityLost: before.quantityLost,
      },
      connection,
      auditContext,
      true,
      id,
    );
    const stockChanged =
      Number(payload.quantityTotal) !== Number(before.quantityTotal) ||
      Number(payload.quantityAvailable) !== Number(before.quantityAvailable) ||
      Number(payload.quantityLost) !== Number(before.quantityLost);

    await connection.execute(
      `
        UPDATE articles
        SET
          internal_code = ?,
          slug = ?,
          title = ?,
          seo_title = ?,
          seo_description = ?,
          google_product_category = ?,
          condition_label = ?,
          color = ?,
          material = ?,
          gender = ?,
          age_group = ?,
          image_alt_override = ?,
          canonical_url = ?,
          category_id = ?,
          brand_id = ?,
          size_id = ?,
          size_text = ?,
          measurements_text = ?,
          description = ?,
          weight_kg = ?,
          purchase_price_item = ?,
          purchase_price_shipping = ?,
          purchase_price_courier = ?,
          sale_price = ?,
          discount_type = ?,
          discount_value = ?,
          allow_offers = ?,
          is_featured = ?,
          intake_date = ?,
          status = ?,
          origin_notes = ?,
          updated_by = ?
        WHERE id = ?
      `,
      [
        payload.internalCode,
        payload.slug,
        payload.title,
        payload.seoTitle,
        payload.seoDescription,
        payload.googleProductCategory,
        payload.conditionLabel,
        payload.color,
        payload.material,
        payload.gender,
        payload.ageGroup,
        payload.imageAltOverride,
        payload.canonicalUrl,
        payload.categoryId,
        payload.brandId,
        payload.sizeId,
        payload.sizeText,
        payload.measurementsText,
        payload.description,
        payload.weightKg,
        payload.purchasePriceItem,
        payload.purchasePriceShipping,
        payload.purchasePriceCourier,
        payload.salePrice,
        payload.discountType,
        payload.discountValue,
        payload.allowOffers ? 1 : 0,
        payload.isFeatured ? 1 : 0,
        payload.intakeDate,
        payload.status,
        payload.originNotes,
        auditContext.actorUserId,
        id,
      ],
    );

    if (stockChanged) {
      const reason = input.stockAdjustmentReason || 'Ajuste manual desde edicion de articulo';

      await adjustInventory(connection, {
        articleId: id,
        quantityTotal: payload.quantityTotal,
        quantityAvailable: payload.quantityAvailable,
        quantityReserved: payload.quantityReserved,
        quantitySold: payload.quantitySold,
        quantityLost: payload.quantityLost,
        reason,
        userId: auditContext.actorUserId || null,
      });
    }

    const after = await getAdminArticleByIdWithConnection(id, connection);

    if (stockChanged) {
      const reason = input.stockAdjustmentReason || 'Ajuste manual desde edicion de articulo';
      await logAudit(
        {
          actorUserId: auditContext.actorUserId,
          actorLabel: auditContext.actorLabel,
          actionCode: 'ARTICLE_STOCK_ADJUSTED',
          entityType: 'articles',
          entityId: id,
          beforeJson: {
            quantityAvailable: before.quantityAvailable,
            quantityReserved: before.quantityReserved,
            quantitySold: before.quantitySold,
            status: before.status,
          },
          afterJson: {
            quantityAvailable: after.quantityAvailable,
            quantityReserved: after.quantityReserved,
            quantitySold: after.quantitySold,
            status: after.status,
          },
          metadataJson: { reason, source: 'ARTICLE_EDIT' },
          source: auditContext.source,
          ipAddress: auditContext.ipAddress,
          userAgent: auditContext.userAgent,
        },
        connection,
      );
    }

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: 'ARTICLE_UPDATED',
        entityType: 'articles',
        entityId: id,
        beforeJson: before,
        afterJson: after,
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return after;
  });
}

export async function adjustArticleStock(id, input, auditContext) {
  return withTransaction(async (connection) => {
    const beforeArticle = await getAdminArticleByIdWithConnection(id, connection);

    await adjustInventory(connection, {
      articleId: id,
      quantityAvailable: input.quantityAvailable,
      reason: input.reason || 'Ajuste manual desde edicion de articulo',
      userId: auditContext.actorUserId || null,
    });

    const afterArticle = await getAdminArticleByIdWithConnection(id, connection);

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: 'ARTICLE_STOCK_ADJUSTED',
        entityType: 'articles',
        entityId: id,
        beforeJson: {
          quantityAvailable: beforeArticle.quantityAvailable,
          quantityReserved: beforeArticle.quantityReserved,
          quantitySold: beforeArticle.quantitySold,
          status: beforeArticle.status,
        },
        afterJson: {
          quantityAvailable: afterArticle.quantityAvailable,
          quantityReserved: afterArticle.quantityReserved,
          quantitySold: afterArticle.quantitySold,
          status: afterArticle.status,
        },
        metadataJson: {
          reason: input.reason || 'Ajuste manual desde edicion de articulo',
          source: 'STOCK_ADJUSTMENT_ENDPOINT',
        },
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return afterArticle;
  });
}

export async function changeArticleStatus(id, status, auditContext) {
  return withTransaction(async (connection) => {
    const before = await getAdminArticleByIdWithConnection(id, connection);
    const nextStatus = resolveWritableArticleStatus(status);

    await connection.execute(
      'UPDATE articles SET status = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [nextStatus, auditContext.actorUserId, id],
    );

    const after = await getAdminArticleByIdWithConnection(id, connection);

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: 'ARTICLE_STATUS_CHANGED',
        entityType: 'articles',
        entityId: id,
        beforeJson: before,
        afterJson: after,
        metadataJson: { fromStatus: before.status, toStatus: after.status },
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return after;
  });
}


const ARTICLE_BATCH_ACTION_CONFIG = {
  ACTIVATE: { payload: { status: 'ACTIVE' } },
  DEACTIVATE: { payload: { status: 'INACTIVE' } },
  FEATURE: { payload: { isFeatured: true } },
  UNFEATURE: { payload: { isFeatured: false } },
  ALLOW_OFFERS: { payload: { allowOffers: true } },
  DISALLOW_OFFERS: { payload: { allowOffers: false } },
};

export async function batchUpdateArticles({ ids = [], action, auditContext }) {
  const config = ARTICLE_BATCH_ACTION_CONFIG[action];
  if (!config) {
    throw badRequest('Acción batch de artículos inválida.');
  }

  const uniqueIds = [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))].slice(0, 100);
  const results = [];

  for (const id of uniqueIds) {
    try {
      const article = await updateArticleQuickFlags(id, config.payload, auditContext);
      results.push({ id, ok: true, article });
    } catch (error) {
      results.push({
        id,
        ok: false,
        message: error?.message || 'No se pudo actualizar el artículo.',
      });
    }
  }

  const succeeded = results.filter((result) => result.ok).length;
  const failed = results.length - succeeded;

  return {
    action,
    requested: uniqueIds.length,
    succeeded,
    failed,
    results,
  };
}

export async function updateArticleQuickFlags(id, input, auditContext) {
  return withTransaction(async (connection) => {
    const before = await getAdminArticleByIdWithConnection(id, connection);
    const nextStatus = input.status ? resolveWritableArticleStatus(input.status) : before.status;
    const nextIsFeatured = input.isFeatured ?? before.isFeatured;
    const nextAllowOffers = input.allowOffers ?? before.allowOffers;

    if (
      nextAllowOffers &&
      before.discountType !== 'NONE' &&
      Number(before.discountValue || 0) > 0
    ) {
      throw badRequest('No se puede activar ofertas en un artículo con descuento.');
    }

    await connection.execute(
      `
        UPDATE articles
        SET
          status = ?,
          is_featured = ?,
          allow_offers = ?,
          updated_by = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [
        nextStatus,
        nextIsFeatured ? 1 : 0,
        nextAllowOffers ? 1 : 0,
        auditContext.actorUserId,
        id,
      ],
    );

    const after = await getAdminArticleByIdWithConnection(id, connection);

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: 'ARTICLE_QUICK_FLAGS_UPDATED',
        entityType: 'articles',
        entityId: id,
        beforeJson: before,
        afterJson: after,
        metadataJson: {
          status: input.status !== undefined ? { from: before.status, to: after.status } : undefined,
          isFeatured: input.isFeatured !== undefined ? { from: before.isFeatured, to: after.isFeatured } : undefined,
          allowOffers: input.allowOffers !== undefined ? { from: before.allowOffers, to: after.allowOffers } : undefined,
        },
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return after;
  });
}

async function buildProcessedImagePayload(file) {
  try {
    return await processUploadedArticleImage(file);
  } catch (error) {
    const fallbackPath = buildArticleUploadPublicPath(path.basename(String(file?.path || '')));
    return {
      filePath: fallbackPath,
      originalFilePath: fallbackPath,
      thumbFilePath: fallbackPath,
      cardFilePath: fallbackPath,
      detailFilePath: fallbackPath,
      zoomFilePath: fallbackPath,
      width: null,
      height: null,
      mimeType: file?.mimetype || null,
      fileSizeBytes: file?.size != null ? Number(file.size) : null,
      dominantColor: null,
      processedStatus: 'FAILED',
      processingError: error.message || 'No se pudo procesar la imagen',
    };
  }
}

async function insertArticleImage(connection, articleId, image, options = {}) {
  const [result] = await connection.execute(
    `
      INSERT INTO article_images (
        article_id,
        file_path,
        original_file_path,
        thumb_file_path,
        card_file_path,
        detail_file_path,
        zoom_file_path,
        width,
        height,
        mime_type,
        file_size_bytes,
        dominant_color,
        processed_status,
        processing_error,
        alt_text,
        sort_order,
        is_primary,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      articleId,
      image.filePath || null,
      image.originalFilePath || null,
      image.thumbFilePath || null,
      image.cardFilePath || null,
      image.detailFilePath || null,
      image.zoomFilePath || null,
      image.width,
      image.height,
      image.mimeType || null,
      image.fileSizeBytes,
      image.dominantColor || null,
      image.processedStatus || 'DONE',
      image.processingError || null,
      options.altText || null,
      Number(options.sortOrder || 0),
      options.isPrimary ? 1 : 0,
      options.actorUserId || null,
    ],
  );

  return Number(result.insertId);
}

async function getArticleImageById(articleId, imageId, connection = pool) {
  const [rows] = await connection.execute(
    `
      SELECT
        ai.id,
        ai.article_id AS articleId,
        ai.file_path AS filePath,
        ai.original_file_path AS originalFilePath,
        ai.thumb_file_path AS thumbFilePath,
        ai.card_file_path AS cardFilePath,
        ai.detail_file_path AS detailFilePath,
        ai.zoom_file_path AS zoomFilePath,
        ai.width,
        ai.height,
        ai.mime_type AS mimeType,
        ai.file_size_bytes AS fileSizeBytes,
        ai.dominant_color AS dominantColor,
        ai.processed_status AS processedStatus,
        ai.processing_error AS processingError,
        COALESCE(ai.alt_text, a.image_alt_override, a.title) AS altText,
        ai.sort_order AS sortOrder,
        ai.is_primary AS isPrimary,
        ai.created_at AS createdAt,
        ai.created_by AS createdBy
      FROM article_images ai
      INNER JOIN articles a ON a.id = ai.article_id
      WHERE ai.article_id = ? AND ai.id = ?
      LIMIT 1
    `,
    [articleId, imageId],
  );

  if (!rows.length) {
    throw notFound('Article image not found');
  }

  return normalizeArticleImageRow(rows[0]);
}

async function ensurePrimaryImageExists(connection, articleId) {
  const [rows] = await connection.execute(
    `
      SELECT id, is_primary AS isPrimary
      FROM article_images
      WHERE article_id = ?
      ORDER BY is_primary DESC, sort_order ASC, id ASC
    `,
    [articleId],
  );

  if (!rows.length) {
    return;
  }

  const hasPrimary = rows.some((row) => Number(row.id) && row.id && row.is_primary);
  if (hasPrimary) {
    return;
  }

  await connection.execute(
    'UPDATE article_images SET is_primary = 1 WHERE id = ?',
    [rows[0].id],
  );
}

export async function addArticleImages(articleId, files, auditContext) {
  if (!files?.length) {
    throw badRequest('At least one image file is required');
  }

  return withTransaction(async (connection) => {
    const article = await getAdminArticleByIdWithConnection(articleId, connection);
    const images = await getArticleImages(articleId, connection);
    const hasPrimary = images.some((image) => image.isPrimary);
    const nextSortOrder = images.length;

    for (const [index, file] of files.entries()) {
      const processed = await buildProcessedImagePayload(file);
      await insertArticleImage(connection, articleId, processed, {
        altText: article.imageAltOverride || article.title,
        sortOrder: nextSortOrder + index,
        isPrimary: !hasPrimary && index === 0,
        actorUserId: auditContext.actorUserId,
      });
    }

    await ensurePrimaryImageExists(connection, articleId);
    const afterImages = await getArticleImages(articleId, connection);

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: 'ARTICLE_IMAGES_ADDED',
        entityType: 'articles',
        entityId: articleId,
        metadataJson: {
          fileCount: files.length,
          files: afterImages,
        },
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return afterImages;
  });
}

export async function updateArticleImage(articleId, imageId, input, auditContext) {
  return withTransaction(async (connection) => {
    const before = await getArticleImageById(articleId, imageId, connection);

    if (input.isPrimary === true) {
      await connection.execute(
        'UPDATE article_images SET is_primary = 0 WHERE article_id = ?',
        [articleId],
      );
    }

    await connection.execute(
      `
        UPDATE article_images
        SET
          alt_text = ?,
          sort_order = ?,
          is_primary = ?
        WHERE article_id = ? AND id = ?
      `,
      [
        input.altText ?? before.altText,
        input.sortOrder ?? before.sortOrder,
        input.isPrimary != null ? (input.isPrimary ? 1 : 0) : (before.isPrimary ? 1 : 0),
        articleId,
        imageId,
      ],
    );

    await ensurePrimaryImageExists(connection, articleId);
    const after = await getArticleImageById(articleId, imageId, connection);
    const images = await getArticleImages(articleId, connection);

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: 'ARTICLE_IMAGE_UPDATED',
        entityType: 'article_images',
        entityId: imageId,
        beforeJson: before,
        afterJson: after,
        metadataJson: { articleId },
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return images;
  });
}

export async function deleteArticleImage(articleId, imageId, auditContext) {
  const result = await withTransaction(async (connection) => {
    const before = await getArticleImageById(articleId, imageId, connection);

    await connection.execute(
      'DELETE FROM article_images WHERE article_id = ? AND id = ?',
      [articleId, imageId],
    );

    await ensurePrimaryImageExists(connection, articleId);
    const images = await getArticleImages(articleId, connection);

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: 'ARTICLE_IMAGE_DELETED',
        entityType: 'article_images',
        entityId: imageId,
        beforeJson: before,
        metadataJson: { articleId },
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return { deletedImage: before, images };
  });

  await deleteArticleImageFiles(result.deletedImage);
  return result.images;
}

export async function reorderArticleImages(articleId, imageIds, auditContext) {
  return withTransaction(async (connection) => {
    const existing = await getArticleImages(articleId, connection);
    const existingIds = existing.map((image) => image.id);

    if (existingIds.length !== imageIds.length || existingIds.some((id) => !imageIds.includes(id))) {
      throw badRequest('The provided imageIds must match the current article image set');
    }

    for (const [index, imageId] of imageIds.entries()) {
      await connection.execute(
        'UPDATE article_images SET sort_order = ? WHERE article_id = ? AND id = ?',
        [index, articleId, imageId],
      );
    }

    await ensurePrimaryImageExists(connection, articleId);
    const images = await getArticleImages(articleId, connection);

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: 'ARTICLE_IMAGES_REORDERED',
        entityType: 'articles',
        entityId: articleId,
        metadataJson: { imageIds },
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return images;
  });
}

export async function syncArticleImageSources(articleId, sources = {}, auditContext = {}) {
  const primarySource = String(sources.primaryImage || '').trim();
  const additionalSources = Array.isArray(sources.additionalImages)
    ? sources.additionalImages.map((value) => String(value || '').trim()).filter(Boolean)
    : [];

  if (!primarySource && !additionalSources.length) {
    return getArticleImages(articleId);
  }

  return withTransaction(async (connection) => {
    const article = await getAdminArticleByIdWithConnection(articleId, connection);
    const currentImages = await getArticleImages(articleId, connection);
    const currentByPath = new Map();

    for (const image of currentImages) {
      currentByPath.set(image.filePath, image);
      currentByPath.set(image.originalFilePath, image);
    }

    if (primarySource) {
      const prepared = await buildImportedImageRecord(primarySource);
      if (prepared) {
        const existingPrimary = currentImages.find((image) => image.isPrimary) || currentByPath.get(prepared.filePath) || currentByPath.get(prepared.originalFilePath);

        if (existingPrimary) {
          await connection.execute(
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
                processing_error = ?,
                alt_text = ?,
                is_primary = 1
              WHERE article_id = ? AND id = ?
            `,
            [
              prepared.filePath,
              prepared.originalFilePath,
              prepared.thumbFilePath,
              prepared.cardFilePath,
              prepared.detailFilePath,
              prepared.zoomFilePath,
              prepared.width,
              prepared.height,
              prepared.mimeType,
              prepared.fileSizeBytes,
              prepared.dominantColor,
              prepared.processedStatus,
              prepared.processingError,
              article.imageAltOverride || article.title,
              articleId,
              existingPrimary.id,
            ],
          );
        } else {
          await insertArticleImage(connection, articleId, prepared, {
            altText: article.imageAltOverride || article.title,
            sortOrder: currentImages.length,
            isPrimary: true,
            actorUserId: auditContext.actorUserId || null,
          });
        }

        await connection.execute(
          'UPDATE article_images SET is_primary = CASE WHEN id = (SELECT chosen.id FROM (SELECT id FROM article_images WHERE article_id = ? ORDER BY is_primary DESC, sort_order ASC, id ASC LIMIT 1) AS chosen) THEN 1 ELSE 0 END WHERE article_id = ?',
          [articleId, articleId],
        );
      }
    }

    const latestImages = await getArticleImages(articleId, connection);
    let nextSortOrder = latestImages.length;
    const knownPaths = new Set(
      latestImages.flatMap((image) => [image.filePath, image.originalFilePath]).filter(Boolean),
    );

    for (const source of additionalSources) {
      const prepared = await buildImportedImageRecord(source);
      if (!prepared) continue;
      if (knownPaths.has(prepared.filePath) || knownPaths.has(prepared.originalFilePath)) {
        continue;
      }

      await insertArticleImage(connection, articleId, prepared, {
        altText: article.imageAltOverride || article.title,
        sortOrder: nextSortOrder,
        isPrimary: false,
        actorUserId: auditContext.actorUserId || null,
      });
      nextSortOrder += 1;
      knownPaths.add(prepared.filePath);
      knownPaths.add(prepared.originalFilePath);
    }

    await ensurePrimaryImageExists(connection, articleId);
    const afterImages = await getArticleImages(articleId, connection);

    await logAudit(
      {
        actorUserId: auditContext.actorUserId || null,
        actorLabel: auditContext.actorLabel || null,
        actionCode: 'ARTICLE_IMAGES_SYNCED',
        entityType: 'articles',
        entityId: articleId,
        metadataJson: {
          primaryImage: primarySource || null,
          additionalImageCount: additionalSources.length,
        },
        source: auditContext.source || 'API',
        ipAddress: auditContext.ipAddress || null,
        userAgent: auditContext.userAgent || null,
      },
      connection,
    );

    return afterImages;
  });
}

async function getAdminArticleByIdWithConnection(id, connection) {
  const rows = await getArticleRows('WHERE a.id = ? LIMIT 1', [id], connection);

  if (!rows.length) {
    throw notFound('Article not found');
  }

  const article = rows[0];
  article.images = await getArticleImages(id, connection);
  return article;
}

export async function deleteArticle(id, auditContext) {
  const result = await withTransaction(async (connection) => {
    const before = await getAdminArticleByIdWithConnection(id, connection);

    const referenceQueries = [
      ['órdenes', 'SELECT COUNT(*) AS total FROM order_items WHERE article_id = ?', true],
      ['ofertas', 'SELECT COUNT(*) AS total FROM offers WHERE article_id = ?', true],
      ['movimientos de inventario', 'SELECT COUNT(*) AS total FROM article_inventory_movements WHERE article_id = ?', true],
      ['carritos', 'SELECT COUNT(*) AS total FROM cart_items WHERE article_id = ?', false],
    ];

    const blockers = [];
    for (const [label, query, isHistorical] of referenceQueries) {
      const [rows] = await connection.execute(query, [id]);
      const total = Number(rows[0]?.total || 0);
      if (total > 0 && isHistorical) blockers.push(`${label}: ${total}`);
    }

    if (blockers.length) {
      throw badRequest(`No se puede eliminar porque tiene registros históricos vinculados (${blockers.join(', ')}). Se recomienda desactivarlo.`);
    }

    await connection.execute('DELETE FROM cart_items WHERE article_id = ?', [id]);
    await connection.execute('DELETE FROM article_images WHERE article_id = ?', [id]);

    try {
      const [deleteResult] = await connection.execute('DELETE FROM articles WHERE id = ?', [id]);
      if (!deleteResult.affectedRows) throw notFound('Article not found');
    } catch (error) {
      if (error?.code === 'ER_ROW_IS_REFERENCED_2' || error?.errno === 1451) {
        throw badRequest('No se puede eliminar porque tiene movimientos, órdenes u ofertas asociadas. Se recomienda desactivarlo.');
      }
      throw error;
    }

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: 'ARTICLE_DELETED',
        entityType: 'articles',
        entityId: id,
        beforeJson: before,
        metadataJson: { mode: 'admin-hard-delete' },
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return { deleted: true, article: before, images: before.images || [] };
  });

  await Promise.allSettled((result.images || []).map((image) => deleteArticleImageFiles(image)));
  return { deleted: true, article: result.article };
}
