import { pool } from '../../db/pool.js';
import { notFound } from '../../utils/app-error.js';
import { appendDateRangeFilters, buildLikeValue, resolveSortClause } from '../../utils/listing.js';
import { buildSqlLimitClause, buildSqlLimitOffsetClause, normalizeSqlLimit, normalizeSqlOffset } from '../../utils/sql-safety.js';

const resolvedSourceExpr = `
  COALESCE(
    pc.source,
    CASE
      WHEN w.customer_id IS NOT NULL THEN 'REGISTERED'
      WHEN w.session_token IS NOT NULL THEN 'SESSION'
      ELSE 'MANUAL'
    END
  )
`;

const ownerNameExpr = `
  COALESCE(
    NULLIF(TRIM(CONCAT_WS(' ', c.first_name, c.last_name)), ''),
    NULLIF(TRIM(CONCAT_WS(' ', pc.first_name, pc.last_name)), ''),
    'Sesion anonima'
  )
`;

const WISHLIST_SORTS = {
  updatedAt: (direction) => `w.updated_at ${direction}, w.id ${direction}`,
  lastSavedAt: (direction) => `MAX(wi.created_at) ${direction}, w.id DESC`,
  itemCount: (direction) => `COUNT(DISTINCT wi.id) ${direction}, w.id DESC`,
  ownerName: (direction) => `${ownerNameExpr} ${direction}, w.id DESC`,
  source: (direction) => `${resolvedSourceExpr} ${direction}, w.id DESC`,
};

function normalizePositiveInt(value, fallback, max = 50) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.min(max, Math.floor(numeric));
}

function parseMetadata(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function buildWishlistFilters(filters = {}) {
  const clauses = [];
  const params = [];

  if (filters.q) {
    const like = buildLikeValue(filters.q);
    clauses.push(`(
      ${ownerNameExpr} LIKE ?
      OR COALESCE(c.email, pc.email, '') LIKE ?
      OR COALESCE(c.phone, pc.phone, '') LIKE ?
      OR COALESCE(c.instagram, pc.instagram, '') LIKE ?
      OR COALESCE(w.session_token, '') LIKE ?
      OR EXISTS (
        SELECT 1
        FROM wishlist_items wi_q
        INNER JOIN articles a_q ON a_q.id = wi_q.article_id
        WHERE wi_q.wishlist_id = w.id
          AND (a_q.title LIKE ? OR a_q.slug LIKE ? OR a_q.internal_code LIKE ?)
      )
    )`);
    params.push(like, like, like, like, like, like, like, like);
  }

  if (filters.articleId) {
    clauses.push('EXISTS (SELECT 1 FROM wishlist_items wi_a WHERE wi_a.wishlist_id = w.id AND wi_a.article_id = ?)');
    params.push(filters.articleId);
  }

  if (filters.categoryId) {
    clauses.push(`EXISTS (
      SELECT 1
      FROM wishlist_items wi_category
      INNER JOIN articles a_category ON a_category.id = wi_category.article_id
      WHERE wi_category.wishlist_id = w.id
        AND a_category.category_id = ?
    )`);
    params.push(filters.categoryId);
  }

  if (filters.brandId) {
    clauses.push(`EXISTS (
      SELECT 1
      FROM wishlist_items wi_brand
      INNER JOIN articles a_brand ON a_brand.id = wi_brand.article_id
      WHERE wi_brand.wishlist_id = w.id
        AND a_brand.brand_id = ?
    )`);
    params.push(filters.brandId);
  }

  if (filters.status) {
    clauses.push(`EXISTS (
      SELECT 1
      FROM wishlist_items wi_status
      INNER JOIN articles a_status ON a_status.id = wi_status.article_id
      INNER JOIN article_inventory inv_status ON inv_status.article_id = a_status.id
      WHERE wi_status.wishlist_id = w.id
        AND ${
          filters.status === 'RESERVED'
            ? 'inv_status.quantity_available = 0 AND inv_status.quantity_reserved > 0'
            : filters.status === 'SOLD_OUT'
              ? 'inv_status.quantity_available = 0 AND inv_status.quantity_reserved = 0 AND inv_status.quantity_sold > 0'
              : 'a_status.status = ?'
        }
    )`);
    if (!['RESERVED', 'SOLD_OUT'].includes(filters.status)) {
      params.push(filters.status);
    }
  }

  if (filters.source) {
    clauses.push(`${resolvedSourceExpr} = ?`);
    params.push(filters.source);
  }

  if (filters.onlyWithStock) {
    clauses.push(`EXISTS (
      SELECT 1
      FROM wishlist_items wi_stock
      INNER JOIN articles a_stock ON a_stock.id = wi_stock.article_id
      INNER JOIN article_inventory inv_stock ON inv_stock.article_id = a_stock.id
      WHERE wi_stock.wishlist_id = w.id
        AND COALESCE(inv_stock.quantity_available, 0) > 0
    )`);
  }

  if (filters.onlySoldOut) {
    clauses.push(`EXISTS (
      SELECT 1
      FROM wishlist_items wi_sold
      INNER JOIN articles a_sold ON a_sold.id = wi_sold.article_id
      INNER JOIN article_inventory inv_sold ON inv_sold.article_id = a_sold.id
      WHERE wi_sold.wishlist_id = w.id
        AND COALESCE(inv_sold.quantity_available, 0) <= 0
    )`);
  }

  appendDateRangeFilters('COALESCE(w.updated_at, w.created_at)', filters, clauses, params);

  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

function buildWishlistOwnerIdentity(row) {
  return {
    customerId: row.customerId != null ? Number(row.customerId) : null,
    potentialCustomerId: row.potentialCustomerId != null ? Number(row.potentialCustomerId) : null,
    sessionToken: row.sessionToken || null,
    name: row.ownerName || 'Sesion anonima',
    email: row.email || null,
    phone: row.phone || null,
    instagram: row.instagram || null,
    source: row.source || null,
  };
}

function normalizeWishlistListRow(row) {
  return {
    id: Number(row.id),
    ...buildWishlistOwnerIdentity(row),
    itemCount: Number(row.itemCount || 0),
    lastSavedAt: row.lastSavedAt || null,
    lastArticleTitle: row.lastArticleTitle || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listAdminWishlists({ filters, pagination }) {
  const { where, params } = buildWishlistFilters(filters);
  const sort = resolveSortClause({
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
    sortMap: WISHLIST_SORTS,
    fallbackKey: 'updatedAt',
  });
  const limit = normalizeSqlLimit(pagination.limit, 25, 100);
  const offset = normalizeSqlOffset(pagination.offset);
  const limitOffsetClause = buildSqlLimitOffsetClause(limit, offset, 25, 100);

  const baseFrom = `
    FROM wishlists w
    LEFT JOIN customers c ON c.id = w.customer_id
    LEFT JOIN potential_customers pc ON pc.id = w.potential_customer_id
    LEFT JOIN wishlist_items wi ON wi.wishlist_id = w.id
  `;

  const [countRows] = await pool.execute(
    `
      SELECT COUNT(*) AS total
      FROM (
        SELECT w.id
        ${baseFrom}
        ${where}
        GROUP BY w.id
      ) AS wishlist_totals
    `,
    params,
  );

  const [rows] = await pool.execute(
    `
      SELECT
        w.id,
        w.customer_id AS customerId,
        w.potential_customer_id AS potentialCustomerId,
        w.session_token AS sessionToken,
        w.created_at AS createdAt,
        w.updated_at AS updatedAt,
        ${ownerNameExpr} AS ownerName,
        COALESCE(c.email, pc.email) AS email,
        COALESCE(c.phone, pc.phone) AS phone,
        COALESCE(c.instagram, pc.instagram) AS instagram,
        ${resolvedSourceExpr} AS source,
        COUNT(DISTINCT wi.id) AS itemCount,
        MAX(wi.created_at) AS lastSavedAt,
        (
          SELECT a_latest.title
          FROM wishlist_items wi_latest
          INNER JOIN articles a_latest ON a_latest.id = wi_latest.article_id
          WHERE wi_latest.wishlist_id = w.id
          ORDER BY wi_latest.created_at DESC, wi_latest.id DESC
          LIMIT 1
        ) AS lastArticleTitle
      ${baseFrom}
      ${where}
      GROUP BY
        w.id,
        w.customer_id,
        w.potential_customer_id,
        w.session_token,
        w.created_at,
        w.updated_at,
        ownerName,
        email,
        phone,
        instagram,
        source
      ORDER BY ${sort}
      ${limitOffsetClause}
    `,
    params,
  );

  return {
    items: rows.map(normalizeWishlistListRow),
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: Number(countRows[0]?.total || 0),
    },
  };
}

export async function getAdminWishlistById(id) {
  const [rows] = await pool.execute(
    `
      SELECT
        w.id,
        w.customer_id AS customerId,
        w.potential_customer_id AS potentialCustomerId,
        w.session_token AS sessionToken,
        w.created_at AS createdAt,
        w.updated_at AS updatedAt,
        ${ownerNameExpr} AS ownerName,
        COALESCE(c.email, pc.email) AS email,
        COALESCE(c.phone, pc.phone) AS phone,
        COALESCE(c.instagram, pc.instagram) AS instagram,
        ${resolvedSourceExpr} AS source
      FROM wishlists w
      LEFT JOIN customers c ON c.id = w.customer_id
      LEFT JOIN potential_customers pc ON pc.id = w.potential_customer_id
      WHERE w.id = ?
      LIMIT 1
    `,
    [id],
  );

  if (!rows.length) {
    throw notFound('Wishlist not found');
  }

  const wishlist = rows[0];

  const [items] = await pool.execute(
    `
      SELECT
        wi.id,
        wi.created_at AS savedAt,
        a.id AS articleId,
        a.slug,
        a.title,
        a.status AS publicationStatus,
        a.condition_label AS conditionLabel,
        a.color,
        a.material,
        a.sale_price AS salePrice,
        a.discounted_price AS discountedPrice,
        inv.quantity_available AS quantityAvailable,
        inv.quantity_reserved AS quantityReserved,
        inv.quantity_sold AS quantitySold,
        COALESCE(a.size_text, s.code) AS sizeLabel,
        (
          SELECT COALESCE(ai.card_file_path, ai.detail_file_path, ai.file_path)
          FROM article_images ai
          WHERE ai.article_id = a.id
          ORDER BY ai.is_primary DESC, ai.sort_order ASC, ai.id ASC
          LIMIT 1
        ) AS image,
        EXISTS (
          SELECT 1
          FROM orders o
          INNER JOIN order_items oi ON oi.order_id = o.id
          WHERE oi.article_id = a.id
            AND o.order_status IN ('APPROVED', 'SHIPPED')
            AND (
              (? IS NOT NULL AND o.customer_id = ?)
              OR (? IS NOT NULL AND o.potential_customer_id = ?)
            )
        ) AS wasPurchasedByOwner
      FROM wishlist_items wi
      INNER JOIN articles a ON a.id = wi.article_id
      INNER JOIN article_inventory inv ON inv.article_id = a.id
      LEFT JOIN sizes s ON s.id = a.size_id
      WHERE wi.wishlist_id = ?
      ORDER BY wi.created_at DESC, wi.id DESC
    `,
    [
      wishlist.customerId,
      wishlist.customerId,
      wishlist.potentialCustomerId,
      wishlist.potentialCustomerId,
      id,
    ],
  );

  const [alerts] = await pool.execute(
    `
      SELECT
        aia.id,
        aia.article_id AS articleId,
        aia.alert_type AS alertType,
        aia.status,
        aia.created_at AS createdAt,
        aia.updated_at AS updatedAt,
        a.title AS articleTitle,
        a.slug AS articleSlug
      FROM article_interest_alerts aia
      LEFT JOIN articles a ON a.id = aia.article_id
      WHERE aia.potential_customer_id <=> ?
      ORDER BY aia.created_at DESC, aia.id DESC
      LIMIT 20
    `,
    [wishlist.potentialCustomerId || null],
  );

  const [events] = await pool.execute(
    `
      SELECT
        ae.id,
        ae.article_id AS articleId,
        ae.event_type AS eventType,
        ae.session_token AS sessionToken,
        ae.metadata_json AS metadataJson,
        ae.created_at AS createdAt,
        a.title AS articleTitle,
        a.slug AS articleSlug
      FROM article_events ae
      LEFT JOIN articles a ON a.id = ae.article_id
      WHERE
        (? IS NOT NULL AND ae.customer_id = ?)
        OR (? IS NOT NULL AND ae.potential_customer_id = ?)
        OR (? IS NOT NULL AND ae.session_token = ?)
      ORDER BY ae.created_at DESC, ae.id DESC
      LIMIT 30
    `,
    [
      wishlist.customerId,
      wishlist.customerId,
      wishlist.potentialCustomerId,
      wishlist.potentialCustomerId,
      wishlist.sessionToken,
      wishlist.sessionToken,
    ],
  );

  return {
    id: Number(wishlist.id),
    ...buildWishlistOwnerIdentity(wishlist),
    createdAt: wishlist.createdAt,
    updatedAt: wishlist.updatedAt,
    items: items.map((row) => ({
      id: Number(row.id),
      savedAt: row.savedAt,
      articleId: Number(row.articleId),
      slug: row.slug,
      title: row.title,
      status: row.publicationStatus === 'ACTIVE' && Number(row.quantityAvailable || 0) > 0
        ? 'ACTIVE'
        : (Number(row.quantityReserved || 0) > 0 ? 'RESERVED' : 'SOLD_OUT'),
      publicationStatus: row.publicationStatus,
      conditionLabel: row.conditionLabel || null,
      color: row.color || null,
      material: row.material || null,
      salePrice: Number(row.salePrice || 0),
      discountedPrice: Number(row.discountedPrice || 0),
      quantityAvailable: Number(row.quantityAvailable || 0),
      sizeLabel: row.sizeLabel || null,
      image: row.image || '',
      wasPurchasedByOwner: Boolean(row.wasPurchasedByOwner),
    })),
    alerts: alerts.map((row) => ({
      id: Number(row.id),
      articleId: row.articleId != null ? Number(row.articleId) : null,
      alertType: row.alertType,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      articleTitle: row.articleTitle || null,
      articleSlug: row.articleSlug || null,
    })),
    events: events.map((row) => ({
      id: Number(row.id),
      articleId: row.articleId != null ? Number(row.articleId) : null,
      eventType: row.eventType,
      sessionToken: row.sessionToken || null,
      metadata: parseMetadata(row.metadataJson),
      createdAt: row.createdAt,
      articleTitle: row.articleTitle || null,
      articleSlug: row.articleSlug || null,
    })),
  };
}

export async function getAdminWishlistSummary(filters = {}) {
  const { where, params } = buildWishlistFilters(filters);
  const [rows] = await pool.execute(
    `
      SELECT
        COUNT(DISTINCT w.id) AS totalWishlists,
        COUNT(wi.id) AS totalSavedItems,
        COUNT(DISTINCT COALESCE(CONCAT('c:', w.customer_id), CONCAT('p:', w.potential_customer_id), CONCAT('s:', w.session_token), CONCAT('w:', w.id))) AS totalOwners,
        MAX(COALESCE(wi.created_at, w.updated_at)) AS lastActivity
      FROM wishlists w
      LEFT JOIN customers c ON c.id = w.customer_id
      LEFT JOIN potential_customers pc ON pc.id = w.potential_customer_id
      LEFT JOIN wishlist_items wi ON wi.wishlist_id = w.id
      ${where}
    `,
    params,
  );

  const topArticles = await getAdminWishlistTopArticles(filters, 1);
  const totals = rows[0] || {};
  const totalWishlists = Number(totals.totalWishlists || 0);
  const totalSavedItems = Number(totals.totalSavedItems || 0);

  return {
    totalWishlists,
    totalSavedItems,
    totalOwners: Number(totals.totalOwners || 0),
    averageItemsPerWishlist: totalWishlists ? Number((totalSavedItems / totalWishlists).toFixed(2)) : 0,
    topArticle: topArticles[0] || null,
    lastActivity: totals.lastActivity || null,
  };
}

export async function getAdminWishlistTopArticles(filters = {}, limit = 10) {
  const { where, params } = buildWishlistFilters(filters);
  const safeLimit = normalizePositiveInt(limit, 10);
  const limitClause = buildSqlLimitClause(safeLimit, 10, 50);
  const [rows] = await pool.execute(
    `
      SELECT
        a.id,
        a.slug,
        a.title,
        cat.name AS categoryName,
        b.name AS brandName,
        COALESCE(a.size_text, s.code) AS sizeLabel,
        a.discounted_price AS discountedPrice,
        a.sale_price AS salePrice,
        inv.quantity_available AS quantityAvailable,
        inv.quantity_reserved AS quantityReserved,
        inv.quantity_sold AS quantitySold,
        a.status AS publicationStatus,
        COUNT(wi.id) AS savesCount,
        (
          SELECT COALESCE(ai.thumb_file_path, ai.card_file_path, ai.file_path)
          FROM article_images ai
          WHERE ai.article_id = a.id
          ORDER BY ai.is_primary DESC, ai.sort_order ASC, ai.id ASC
          LIMIT 1
        ) AS image
      FROM wishlists w
      LEFT JOIN customers c ON c.id = w.customer_id
      LEFT JOIN potential_customers pc ON pc.id = w.potential_customer_id
      INNER JOIN wishlist_items wi ON wi.wishlist_id = w.id
      INNER JOIN articles a ON a.id = wi.article_id
      INNER JOIN article_inventory inv ON inv.article_id = a.id
      INNER JOIN categories cat ON cat.id = a.category_id
      LEFT JOIN brands b ON b.id = a.brand_id
      LEFT JOIN sizes s ON s.id = a.size_id
      ${where}
      GROUP BY
        a.id,
        a.slug,
        a.title,
        cat.name,
        b.name,
        sizeLabel,
        a.discounted_price,
        a.sale_price,
        inv.quantity_available,
        inv.quantity_reserved,
        inv.quantity_sold,
        a.status
      ORDER BY savesCount DESC, a.is_featured DESC, a.updated_at DESC
      ${limitClause}
    `,
    params,
  );

  return rows.map((row) => ({
    id: Number(row.id),
    slug: row.slug,
    title: row.title,
    categoryName: row.categoryName,
    brandName: row.brandName || null,
    sizeLabel: row.sizeLabel || null,
    discountedPrice: Number(row.discountedPrice || 0),
    salePrice: Number(row.salePrice || 0),
    quantityAvailable: Number(row.quantityAvailable || 0),
    status: row.publicationStatus === 'ACTIVE' && Number(row.quantityAvailable || 0) > 0
      ? 'ACTIVE'
      : (Number(row.quantityReserved || 0) > 0 ? 'RESERVED' : 'SOLD_OUT'),
    publicationStatus: row.publicationStatus,
    savesCount: Number(row.savesCount || 0),
    image: row.image || '',
  }));
}

export async function getAdminWishlistTopUsers(filters = {}, limit = 10) {
  const { where, params } = buildWishlistFilters(filters);
  const safeLimit = normalizePositiveInt(limit, 10);
  const limitClause = buildSqlLimitClause(safeLimit, 10, 50);
  const [rows] = await pool.execute(
    `
      SELECT
        w.id,
        w.customer_id AS customerId,
        w.potential_customer_id AS potentialCustomerId,
        w.session_token AS sessionToken,
        ${ownerNameExpr} AS ownerName,
        COALESCE(c.email, pc.email) AS email,
        COALESCE(c.phone, pc.phone) AS phone,
        COALESCE(c.instagram, pc.instagram) AS instagram,
        ${resolvedSourceExpr} AS source,
        COUNT(DISTINCT wi.id) AS itemCount,
        MAX(wi.created_at) AS lastSavedAt,
        GROUP_CONCAT(DISTINCT a.title ORDER BY wi.created_at DESC SEPARATOR ' | ') AS savedTitles
      FROM wishlists w
      LEFT JOIN customers c ON c.id = w.customer_id
      LEFT JOIN potential_customers pc ON pc.id = w.potential_customer_id
      LEFT JOIN wishlist_items wi ON wi.wishlist_id = w.id
      LEFT JOIN articles a ON a.id = wi.article_id
      ${where}
      GROUP BY
        w.id,
        w.customer_id,
        w.potential_customer_id,
        w.session_token,
        ownerName,
        email,
        phone,
        instagram,
        source
      ORDER BY itemCount DESC, lastSavedAt DESC, w.id DESC
      ${limitClause}
    `,
    params,
  );

  return rows.map((row) => ({
    id: Number(row.id),
    ...buildWishlistOwnerIdentity(row),
    itemCount: Number(row.itemCount || 0),
    lastSavedAt: row.lastSavedAt || null,
    savedTitlesPreview: String(row.savedTitles || '')
      .split(' | ')
      .filter(Boolean)
      .slice(0, 3),
  }));
}
