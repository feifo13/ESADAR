import path from 'node:path';
import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { badRequest, notFound } from '../../utils/app-error.js';
import { uniqueSlug } from '../../utils/slug.js';
import { logAudit } from '../audit/audit.service.js';

const publicBaseSelect = `
  SELECT
    a.id,
    a.internal_code AS internalCode,
    a.slug,
    a.title,
    a.measurements_text AS measurementsText,
    a.description,
    a.sale_price AS salePrice,
    a.discount_type AS discountType,
    a.discount_value AS discountValue,
    a.discounted_price AS discountedPrice,
    a.allow_offers AS allowOffers,
    a.is_featured AS isFeatured,
    a.intake_date AS intakeDate,
    a.quantity_available AS quantityAvailable,
    a.status,
    c.id AS categoryId,
    c.name AS categoryName,
    b.id AS brandId,
    b.name AS brandName,
    s.id AS sizeId,
    s.code AS sizeCode,
    a.size_text AS sizeText,
    (
      SELECT ai.file_path
      FROM article_images ai
      WHERE ai.article_id = a.id
      ORDER BY ai.is_primary DESC, ai.sort_order ASC, ai.id ASC
      LIMIT 1
    ) AS primaryImage
  FROM articles a
  INNER JOIN categories c ON c.id = a.category_id
  LEFT JOIN brands b ON b.id = a.brand_id
  LEFT JOIN sizes s ON s.id = a.size_id
`;

function buildPublicFilters(query, includeInactive = false) {
  const clauses = [];
  const params = [];

  if (!includeInactive) {
    clauses.push(`a.status = 'ACTIVE'`);
  }

  if (query.search) {
    clauses.push('(a.title LIKE ? OR b.name LIKE ? OR c.name LIKE ?)');
    const like = `%${query.search}%`;
    params.push(like, like, like);
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

  if (!includeInactive && query.inStock !== 'false') {
    clauses.push('a.quantity_available > 0');
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
    items: normalizeArticleRows(items),
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: countRows[0].total,
    },
  };
}

export async function getPublicArticleBySlugOrId(slugOrId) {
  const [rows] = await pool.execute(
    `${publicBaseSelect}
     WHERE a.status = 'ACTIVE' AND (a.slug = ? OR a.id = ?)
     LIMIT 1`,
    [slugOrId, Number(slugOrId) || 0],
  );

  if (!rows.length) {
    throw notFound('Article not found');
  }

  const article = normalizeArticleRows(rows)[0];
  article.images = await getArticleImages(article.id);
  return article;
}

export async function listAdminArticles({ filters, pagination }) {
  const { where, params } = buildPublicFilters(filters, true);
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
    items: normalizeArticleRows(items),
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: countRows[0].total,
    },
  };
}

export async function getAdminArticleById(id) {
  const [rows] = await pool.execute(
    `${publicBaseSelect}
     WHERE a.id = ?
     LIMIT 1`,
    [id],
  );

  if (!rows.length) {
    throw notFound('Article not found');
  }

  const article = normalizeArticleRows(rows)[0];
  const [extraRows] = await pool.execute(
    `
      SELECT
        purchase_price_item AS purchasePriceItem,
        purchase_price_shipping AS purchasePriceShipping,
        purchase_price_courier AS purchasePriceCourier,
        purchase_price_total AS purchasePriceTotal,
        quantity_total AS quantityTotal,
        quantity_reserved AS quantityReserved,
        quantity_sold AS quantitySold,
        origin_notes AS originNotes,
        created_at AS createdAt,
        updated_at AS updatedAt,
        created_by AS createdBy,
        updated_by AS updatedBy
      FROM articles
      WHERE id = ?
      LIMIT 1
    `,
    [id],
  );

  article.images = await getArticleImages(article.id);
  return { ...article, ...extraRows[0] };
}

export async function createArticle(input, auditContext) {
  const payload = normalizeArticleWritePayload(input);

  return withTransaction(async (connection) => {
    const [result] = await connection.execute(
      `
        INSERT INTO articles (
          internal_code,
          slug,
          title,
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        payload.internalCode,
        payload.slug,
        payload.title,
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
    const payload = normalizeArticleWritePayload({ ...before, ...input }, true);

    await connection.execute(
      `
        UPDATE articles
        SET
          internal_code = ?,
          slug = ?,
          title = ?,
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
      const relativePath = `uploads/${path.basename(file.path)}`;
      await connection.execute(
        `
          INSERT INTO article_images (
            article_id,
            file_path,
            alt_text,
            sort_order,
            is_primary,
            created_by
          ) VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          articleId,
          relativePath,
          article.title,
          nextSortOrder + index,
          !hasPrimary && index === 0 ? 1 : 0,
          auditContext.actorUserId,
        ],
      );
    }

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

export async function getArticleImages(articleId, connection = pool) {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        file_path AS filePath,
        alt_text AS altText,
        sort_order AS sortOrder,
        is_primary AS isPrimary,
        created_at AS createdAt,
        created_by AS createdBy
      FROM article_images
      WHERE article_id = ?
      ORDER BY is_primary DESC, sort_order ASC, id ASC
    `,
    [articleId],
  );

  return rows.map((row) => ({ ...row, isPrimary: Boolean(row.isPrimary) }));
}

function normalizeArticleRows(rows) {
  return rows.map((row) => ({
    id: row.id,
    internalCode: row.internalCode,
    slug: row.slug,
    title: row.title,
    measurementsText: row.measurementsText,
    description: row.description,
    salePrice: Number(row.salePrice),
    discountType: row.discountType,
    discountValue: Number(row.discountValue),
    discountedPrice: Number(row.discountedPrice),
    allowOffers: Boolean(row.allowOffers),
    isFeatured: Boolean(row.isFeatured),
    intakeDate: row.intakeDate,
    quantityAvailable: Number(row.quantityAvailable),
    status: row.status,
    category: {
      id: row.categoryId,
      name: row.categoryName,
    },
    brand: row.brandId ? { id: row.brandId, name: row.brandName } : null,
    size: row.sizeId ? { id: row.sizeId, code: row.sizeCode } : null,
    sizeText: row.sizeText,
    primaryImage: row.primaryImage,
  }));
}

function normalizeArticleWritePayload(input, isUpdate = false) {
  const title = input.title;
  const internalCode = input.internalCode || `ART-${Date.now().toString(36).toUpperCase()}`;
  const slug = input.slug || uniqueSlug(title);
  const quantityTotal = Number(input.quantityTotal ?? 1);
  const quantityReserved = Number(input.quantityReserved ?? 0);
  const quantitySold = Number(input.quantitySold ?? 0);
  const quantityAvailable = Number(input.quantityAvailable ?? quantityTotal - quantityReserved - quantitySold);

  if (quantityTotal < quantityAvailable + quantityReserved + quantitySold) {
    throw badRequest('Invalid quantity balance');
  }

  if (!isUpdate && input.allowOffers && input.discountType !== 'NONE' && Number(input.discountValue || 0) > 0) {
    throw badRequest('Articles with discount cannot allow offers');
  }

  if (isUpdate && input.allowOffers && input.discountType !== 'NONE' && Number(input.discountValue || 0) > 0) {
    throw badRequest('Articles with discount cannot allow offers');
  }

  return {
    internalCode,
    slug,
    title,
    categoryId: Number(input.categoryId),
    brandId: input.brandId || null,
    sizeId: input.sizeId || null,
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
    intakeDate: input.intakeDate,
    quantityTotal,
    quantityAvailable,
    quantityReserved,
    quantitySold,
    status: input.status || 'ACTIVE',
    originNotes: input.originNotes || null,
  };
}

async function getAdminArticleByIdWithConnection(id, connection) {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        internal_code AS internalCode,
        slug,
        title,
        category_id AS categoryId,
        brand_id AS brandId,
        size_id AS sizeId,
        size_text AS sizeText,
        measurements_text AS measurementsText,
        description,
        purchase_price_item AS purchasePriceItem,
        purchase_price_shipping AS purchasePriceShipping,
        purchase_price_courier AS purchasePriceCourier,
        purchase_price_total AS purchasePriceTotal,
        sale_price AS salePrice,
        discount_type AS discountType,
        discount_value AS discountValue,
        discounted_price AS discountedPrice,
        allow_offers AS allowOffers,
        is_featured AS isFeatured,
        intake_date AS intakeDate,
        quantity_total AS quantityTotal,
        quantity_available AS quantityAvailable,
        quantity_reserved AS quantityReserved,
        quantity_sold AS quantitySold,
        status,
        origin_notes AS originNotes,
        created_at AS createdAt,
        updated_at AS updatedAt,
        created_by AS createdBy,
        updated_by AS updatedBy
      FROM articles
      WHERE id = ?
      LIMIT 1
    `,
    [id],
  );

  if (!rows.length) {
    throw notFound('Article not found');
  }

  const article = rows[0];
  article.allowOffers = Boolean(article.allowOffers);
  article.isFeatured = Boolean(article.isFeatured);
  article.purchasePriceItem = Number(article.purchasePriceItem);
  article.purchasePriceShipping = Number(article.purchasePriceShipping);
  article.purchasePriceCourier = Number(article.purchasePriceCourier);
  article.purchasePriceTotal = Number(article.purchasePriceTotal);
  article.salePrice = Number(article.salePrice);
  article.discountValue = Number(article.discountValue);
  article.discountedPrice = Number(article.discountedPrice);
  article.images = await getArticleImages(id, connection);
  return article;
}
