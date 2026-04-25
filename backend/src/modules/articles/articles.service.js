import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { badRequest, notFound } from '../../utils/app-error.js';
import {
  buildArticleUploadPublicPath,
  normalizePublicAssetPath,
} from '../../utils/assets.js';
import { appendDateRangeFilters, buildLikeValue, resolveSortClause } from '../../utils/listing.js';
import { slugify, uniqueSlug } from '../../utils/slug.js';
import { logAudit } from '../audit/audit.service.js';
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
    a.quantity_total AS quantityTotal,
    a.quantity_available AS quantityAvailable,
    a.quantity_reserved AS quantityReserved,
    a.quantity_sold AS quantitySold,
    a.status,
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
      SELECT COALESCE(ai.card_file_path, ai.detail_file_path, ai.file_path)
      FROM article_images ai
      WHERE ai.article_id = a.id
      ORDER BY ai.is_primary DESC, ai.sort_order ASC, ai.id ASC
      LIMIT 1
    ) AS primaryImage,
    (
      SELECT COALESCE(ai.detail_file_path, ai.file_path)
      FROM article_images ai
      WHERE ai.article_id = a.id
      ORDER BY ai.is_primary DESC, ai.sort_order ASC, ai.id ASC
      LIMIT 1
    ) AS primaryImageDetail,
    (
      SELECT COALESCE(ai.thumb_file_path, ai.file_path)
      FROM article_images ai
      WHERE ai.article_id = a.id
      ORDER BY ai.is_primary DESC, ai.sort_order ASC, ai.id ASC
      LIMIT 1
    ) AS primaryImageThumb,
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
`;

const ADMIN_ARTICLE_SORTS = {
  intakeDate: (direction) => `a.intake_date ${direction}, a.id ${direction}`,
  updatedAt: (direction) => `a.updated_at ${direction}, a.id ${direction}`,
  title: (direction) => `a.title ${direction}, a.id DESC`,
  salePrice: (direction) => `a.sale_price ${direction}, a.id DESC`,
  discountedPrice: (direction) => `a.discounted_price ${direction}, a.id DESC`,
  status: (direction) => `a.status ${direction}, a.id DESC`,
  quantityAvailable: (direction) => `a.quantity_available ${direction}, a.id DESC`,
  categoryName: (direction) => `c.name ${direction}, a.id DESC`,
  brandName: (direction) => `COALESCE(b.name, '') ${direction}, a.id DESC`,
  internalCode: (direction) => `a.internal_code ${direction}, a.id DESC`,
};

function buildPublicFilters(query, includeInactive = false) {
  const clauses = [];
  const params = [];

  if (!includeInactive) {
    clauses.push(`a.status IN ('ACTIVE', 'SOLD_OUT')`);
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

  if (query.featured === 'true') {
    clauses.push('a.is_featured = 1');
  }

  if (query.discounted === 'true') {
    clauses.push(`a.discount_type <> 'NONE'`);
    clauses.push('a.discount_value > 0');
  }

  if (query.offerable === 'true') {
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

  if (filters.status) {
    clauses.push('a.status = ?');
    params.push(filters.status);
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

  throw badRequest('No se pudo generar un codigo interno unico');
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
      ) VALUES ('Sin categoría', 'sin-categoria', 'Categoria generada automaticamente para articulos sin clasificar.', 1, ?, ?)
    `,
    [actorUserId || null, actorUserId || null],
  );

  return Number(insertResult.insertId);
}

export async function findLookupByName(tableName, fieldName, value, connection = pool) {
  if (!value) return null;

  const [rows] = await connection.execute(
    `SELECT id, ${fieldName} AS value FROM ${tableName} WHERE LOWER(${fieldName}) = LOWER(?) LIMIT 1`,
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
  const baseSlug = baseValue || uniqueSlug('item');
  let candidate = baseSlug;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const [rows] = await connection.execute(
      `SELECT id FROM ${tableName} WHERE slug = ? LIMIT 1`,
      [candidate],
    );

    if (!rows.length) {
      return candidate;
    }

    candidate = `${baseSlug}-${attempt + 1}`;
  }

  return uniqueSlug(baseSlug);
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
  const quantityTotal = Number(input.quantityTotal ?? 1);
  const quantityReserved = Number(input.quantityReserved ?? 0);
  const quantitySold = Number(input.quantitySold ?? 0);
  const quantityAvailable = Number(input.quantityAvailable ?? quantityTotal - quantityReserved - quantitySold);

  if (quantityTotal < quantityAvailable + quantityReserved + quantitySold) {
    throw badRequest('Invalid quantity balance');
  }

  if (Boolean(input.allowOffers) && input.discountType !== 'NONE' && Number(input.discountValue || 0) > 0) {
    throw badRequest('Articles with discount cannot allow offers');
  }

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
    canonicalUrl: input.canonicalUrl || null,
    categoryId: input.categoryId ? Number(input.categoryId) : await ensureDefaultCategoryId(connection, auditContext.actorUserId),
    brandId: input.brandId ? Number(input.brandId) : null,
    sizeId: input.sizeId ? Number(input.sizeId) : null,
    sizeText: input.sizeText || null,
    measurementsText: input.measurementsText || null,
    description: input.description || null,
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
    status: input.status || 'ACTIVE',
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
    canonicalUrl: row.canonicalUrl || null,
    googleProductCategory: row.googleProductCategory || null,
    conditionLabel: row.conditionLabel || null,
    color: row.color || null,
    material: row.material || null,
    gender: row.gender || null,
    ageGroup: row.ageGroup || null,
    imageAltOverride: row.imageAltOverride || null,
    measurementsText: row.measurementsText || null,
    description: row.description || null,
    purchasePriceItem: row.purchasePriceItem != null ? Number(row.purchasePriceItem) : 0,
    purchasePriceShipping: row.purchasePriceShipping != null ? Number(row.purchasePriceShipping) : 0,
    purchasePriceCourier: row.purchasePriceCourier != null ? Number(row.purchasePriceCourier) : 0,
    purchasePriceTotal: row.purchasePriceTotal != null ? Number(row.purchasePriceTotal) : 0,
    salePrice: Number(row.salePrice),
    discountType: row.discountType,
    discountValue: Number(row.discountValue),
    discountedPrice: Number(row.discountedPrice),
    allowOffers: Boolean(row.allowOffers),
    isFeatured: Boolean(row.isFeatured),
    intakeDate: row.intakeDate,
    quantityTotal: row.quantityTotal != null ? Number(row.quantityTotal) : 0,
    quantityAvailable: Number(row.quantityAvailable),
    quantityReserved: row.quantityReserved != null ? Number(row.quantityReserved) : 0,
    quantitySold: row.quantitySold != null ? Number(row.quantitySold) : 0,
    status: row.status,
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
    primaryImage: normalizePublicAssetPath(row.primaryImage || row.primaryImageDetail || ''),
    primaryImageDetail: normalizePublicAssetPath(row.primaryImageDetail || row.primaryImage || ''),
    primaryImageThumb: normalizePublicAssetPath(row.primaryImageThumb || row.primaryImage || ''),
    primaryImageAlt: row.primaryImageAlt || row.imageAltOverride || row.title,
  };

  return enrichArticleSeo(normalized);
}

async function getArticleImagesMap(articleIds, connection = pool) {
  if (!articleIds.length) {
    return new Map();
  }

  const placeholders = articleIds.map(() => '?').join(',');
  const [rows] = await connection.query(
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

export async function listPublicArticles({ filters, pagination }) {
  const { where, params } = buildPublicFilters(filters, false);
  const orderBy = resolveArticleSort(filters.sort);

  const [items] = await pool.query(
    `${publicBaseSelect}
     ${where}
     ORDER BY ${orderBy}
     LIMIT ${pagination.limit} OFFSET ${pagination.offset}`,
    params,
  );

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total
     FROM articles a
     INNER JOIN categories c ON c.id = a.category_id
     LEFT JOIN brands b ON b.id = a.brand_id
     LEFT JOIN sizes s ON s.id = a.size_id
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
    `WHERE a.status IN ('ACTIVE', 'SOLD_OUT') AND (a.slug = ? OR a.id = ?) LIMIT 1`,
    [slugOrId, Number(slugOrId) || 0],
  );

  if (!rows.length) {
    throw notFound('Article not found');
  }

  const article = rows[0];
  article.images = await getArticleImages(article.id);
  return article;
}

export async function listAdminArticles({ filters, pagination }) {
  const { where, params } = buildAdminArticleFilters(filters);
  const orderBy = resolveAdminArticleSort(filters);

  const [items] = await pool.query(
    `${publicBaseSelect}
     ${where}
     ORDER BY ${orderBy}
     LIMIT ${pagination.limit} OFFSET ${pagination.offset}`,
    params,
  );

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total
     FROM articles a
     INNER JOIN categories c ON c.id = a.category_id
     LEFT JOIN brands b ON b.id = a.brand_id
     LEFT JOIN sizes s ON s.id = a.size_id
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
  const [rows] = await pool.query(
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
          purchase_price_item,
          purchase_price_shipping,
          purchase_price_courier,
          sale_price,
          discount_type,
          discount_value,
          allow_offers,
          is_featured,
          intake_date,
          quantity_total,
          quantity_available,
          quantity_reserved,
          quantity_sold,
          status,
          origin_notes,
          created_by,
          updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        payload.purchasePriceItem,
        payload.purchasePriceShipping,
        payload.purchasePriceCourier,
        payload.salePrice,
        payload.discountType,
        payload.discountValue,
        payload.allowOffers ? 1 : 0,
        payload.isFeatured ? 1 : 0,
        payload.intakeDate,
        payload.quantityTotal,
        payload.quantityAvailable,
        payload.quantityReserved,
        payload.quantitySold,
        payload.status,
        payload.originNotes,
        auditContext.actorUserId,
        auditContext.actorUserId,
      ],
    );

    const articleId = result.insertId;
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
    const payload = await normalizeArticleWritePayload({ ...before, ...input }, connection, auditContext, true, id);

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
          purchase_price_item = ?,
          purchase_price_shipping = ?,
          purchase_price_courier = ?,
          sale_price = ?,
          discount_type = ?,
          discount_value = ?,
          allow_offers = ?,
          is_featured = ?,
          intake_date = ?,
          quantity_total = ?,
          quantity_available = ?,
          quantity_reserved = ?,
          quantity_sold = ?,
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
        payload.purchasePriceItem,
        payload.purchasePriceShipping,
        payload.purchasePriceCourier,
        payload.salePrice,
        payload.discountType,
        payload.discountValue,
        payload.allowOffers ? 1 : 0,
        payload.isFeatured ? 1 : 0,
        payload.intakeDate,
        payload.quantityTotal,
        payload.quantityAvailable,
        payload.quantityReserved,
        payload.quantitySold,
        payload.status,
        payload.originNotes,
        auditContext.actorUserId,
        id,
      ],
    );

    const after = await getAdminArticleByIdWithConnection(id, connection);

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

export async function changeArticleStatus(id, status, auditContext) {
  return withTransaction(async (connection) => {
    const before = await getAdminArticleByIdWithConnection(id, connection);

    await connection.execute(
      'UPDATE articles SET status = ?, updated_by = ? WHERE id = ?',
      [status, auditContext.actorUserId, id],
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
