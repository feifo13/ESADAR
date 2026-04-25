import { randomUUID } from 'node:crypto';
import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { badRequest, notFound } from '../../utils/app-error.js';
import { appendDateRangeFilters, buildLikeValue, resolveSortClause } from '../../utils/listing.js';
import { logAudit } from '../audit/audit.service.js';
import {
  ensureCustomerForUser,
  findCustomerByUserId,
  findPotentialCustomerByContact,
  upsertPotentialCustomerByContact,
} from '../customers/customer-helpers.js';

const LEAD_SORTS = {
  createdAt: (direction) => `pc.created_at ${direction}, pc.id ${direction}`,
  updatedAt: (direction) => `pc.updated_at ${direction}, pc.id ${direction}`,
  source: (direction) => `pc.source ${direction}, pc.id DESC`,
  leadStatus: (direction) => `pc.lead_status ${direction}, pc.id DESC`,
  name: (direction) => `pc.last_name ${direction}, pc.first_name ${direction}, pc.id DESC`,
};

const ARTICLE_EVENT_SORTS = {
  createdAt: (direction) => `ae.created_at ${direction}, ae.id ${direction}`,
  eventType: (direction) => `ae.event_type ${direction}, ae.id DESC`,
};

function parseJsonField(value, fallback = null) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeLeadInput(input = {}) {
  return {
    firstName: input.firstName?.trim() || 'Lead',
    lastName: input.lastName?.trim() || 'ESADAR',
    birthDate: input.birthDate || null,
    email: input.email || null,
    phone: input.phone || null,
    instagram: input.instagram || null,
    address: input.address || null,
    notes: input.notes || null,
    preferredCategories: input.preferredCategories || [],
    preferredBrands: input.preferredBrands || [],
    preferredSizes: input.preferredSizes || [],
    preferredColors: input.preferredColors || [],
  };
}

async function upsertLeadPreferences(potentialCustomerId, preferences, connection) {
  if (!potentialCustomerId) {
    return null;
  }

  const payload = {
    preferredCategories: preferences.preferredCategories || [],
    preferredBrands: preferences.preferredBrands || [],
    preferredSizes: preferences.preferredSizes || [],
    preferredColors: preferences.preferredColors || [],
    notes: preferences.notes || null,
  };

  const [existingRows] = await connection.execute(
    `
      SELECT id
      FROM lead_preferences
      WHERE potential_customer_id = ?
      LIMIT 1
    `,
    [potentialCustomerId],
  );

  if (!existingRows.length) {
    await connection.execute(
      `
        INSERT INTO lead_preferences (
          potential_customer_id,
          preferred_categories_json,
          preferred_brands_json,
          preferred_sizes_json,
          preferred_colors_json,
          notes
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        potentialCustomerId,
        JSON.stringify(payload.preferredCategories),
        JSON.stringify(payload.preferredBrands),
        JSON.stringify(payload.preferredSizes),
        JSON.stringify(payload.preferredColors),
        payload.notes,
      ],
    );
  } else {
    await connection.execute(
      `
        UPDATE lead_preferences
        SET
          preferred_categories_json = ?,
          preferred_brands_json = ?,
          preferred_sizes_json = ?,
          preferred_colors_json = ?,
          notes = ?
        WHERE potential_customer_id = ?
      `,
      [
        JSON.stringify(payload.preferredCategories),
        JSON.stringify(payload.preferredBrands),
        JSON.stringify(payload.preferredSizes),
        JSON.stringify(payload.preferredColors),
        payload.notes,
        potentialCustomerId,
      ],
    );
  }

  return payload;
}

async function resolveAuthenticatedCustomer(userId, connection) {
  return findCustomerByUserId(userId, connection)
    || ensureCustomerForUser(userId, connection);
}

async function getWishlistOwner({ sessionToken, actor, contact, generateSessionToken = true }, connection) {
  if (actor?.userId) {
    const customer = await resolveAuthenticatedCustomer(actor.userId, connection);
    return {
      customerId: customer.id,
      potentialCustomerId: null,
      sessionToken: sessionToken || null,
    };
  }

  if (contact) {
    const potentialCustomer = await upsertPotentialCustomerByContact(
      normalizeLeadInput(contact),
      { source: 'WISHLIST', leadStatus: 'NEW' },
      connection,
    );

    return {
      customerId: null,
      potentialCustomerId: potentialCustomer.id,
      sessionToken: sessionToken || (generateSessionToken ? randomUUID() : null),
    };
  }

  return {
    customerId: null,
    potentialCustomerId: null,
    sessionToken: sessionToken || (generateSessionToken ? randomUUID() : null),
  };
}

function buildWishlistLookup(owner) {
  const clauses = [];
  const params = [];

  if (owner.customerId) {
    clauses.push('customer_id = ?');
    params.push(owner.customerId);
  }

  if (owner.potentialCustomerId) {
    clauses.push('potential_customer_id = ?');
    params.push(owner.potentialCustomerId);
  }

  if (owner.sessionToken) {
    clauses.push('session_token = ?');
    params.push(owner.sessionToken);
  }

  return { clauses, params };
}

async function findWishlist(owner, connection) {
  const { clauses, params } = buildWishlistLookup(owner);

  if (clauses.length) {
    const [rows] = await connection.execute(
      `
        SELECT id, session_token AS sessionToken
        FROM wishlists
        WHERE ${clauses.map((clause) => `(${clause})`).join(' OR ')}
        ORDER BY id DESC
        LIMIT 1
      `,
      params,
    );

    if (rows.length) {
      return {
        id: Number(rows[0].id),
        sessionToken: rows[0].sessionToken || owner.sessionToken || null,
      };
    }
  }

  return null;
}

async function getOrCreateWishlist(owner, connection) {
  const existing = await findWishlist(owner, connection);
  if (existing) {
    await connection.execute(
      `
        UPDATE wishlists
        SET
          customer_id = COALESCE(?, customer_id),
          potential_customer_id = COALESCE(?, potential_customer_id),
          session_token = COALESCE(session_token, ?)
        WHERE id = ?
      `,
      [
        owner.customerId || null,
        owner.potentialCustomerId || null,
        owner.sessionToken || null,
        existing.id,
      ],
    );

    return existing;
  }

  const [insertResult] = await connection.execute(
    `
      INSERT INTO wishlists (
        customer_id,
        potential_customer_id,
        session_token
      ) VALUES (?, ?, ?)
    `,
    [owner.customerId || null, owner.potentialCustomerId || null, owner.sessionToken || null],
  );

  return {
    id: Number(insertResult.insertId),
    sessionToken: owner.sessionToken || null,
  };
}

async function listWishlistItemsByWishlistId(wishlistId, connection) {
  const [rows] = await connection.execute(
    `
      SELECT
        wi.article_id AS articleId,
        a.slug,
        a.title,
        a.sale_price AS salePrice,
        a.discount_type AS discountType,
        a.discount_value AS discountValue,
        a.discounted_price AS discountedPrice,
        a.status,
        a.condition_label AS conditionLabel,
        a.color,
        a.material,
        a.quantity_available AS quantityAvailable,
        b.name AS brandName,
        COALESCE(a.size_text, s.code) AS sizeLabel,
        (
          SELECT COALESCE(ai.card_file_path, ai.detail_file_path, ai.file_path)
          FROM article_images ai
          WHERE ai.article_id = a.id
          ORDER BY ai.is_primary DESC, ai.sort_order ASC, ai.id ASC
          LIMIT 1
        ) AS image
      FROM wishlist_items wi
      INNER JOIN articles a ON a.id = wi.article_id
      LEFT JOIN brands b ON b.id = a.brand_id
      LEFT JOIN sizes s ON s.id = a.size_id
      WHERE wi.wishlist_id = ?
      ORDER BY wi.created_at DESC, wi.id DESC
    `,
    [wishlistId],
  );

  return rows.map((row) => ({
    articleId: Number(row.articleId),
    slug: row.slug,
    title: row.title,
    salePrice: Number(row.salePrice || 0),
    discountType: row.discountType || 'NONE',
    discountValue: Number(row.discountValue || 0),
    discountedPrice: Number(row.discountedPrice || 0),
    status: row.status,
    conditionLabel: row.conditionLabel || null,
    color: row.color || null,
    material: row.material || null,
    quantityAvailable: Number(row.quantityAvailable || 0),
    brandName: row.brandName || null,
    sizeLabel: row.sizeLabel || null,
    image: row.image || '',
  }));
}

async function getLeadPreferencesByPotentialCustomerId(id, connection) {
  const [rows] = await connection.execute(
    `
      SELECT
        preferred_categories_json AS preferredCategories,
        preferred_brands_json AS preferredBrands,
        preferred_sizes_json AS preferredSizes,
        preferred_colors_json AS preferredColors,
        notes
      FROM lead_preferences
      WHERE potential_customer_id = ?
      LIMIT 1
    `,
    [id],
  );

  if (!rows.length) {
    return null;
  }

  return {
    preferredCategories: parseJsonField(rows[0].preferredCategories, []),
    preferredBrands: parseJsonField(rows[0].preferredBrands, []),
    preferredSizes: parseJsonField(rows[0].preferredSizes, []),
    preferredColors: parseJsonField(rows[0].preferredColors, []),
    notes: rows[0].notes || null,
  };
}

async function getLeadByIdInternal(id, connection = pool) {
  const [rows] = await connection.execute(
    `
      SELECT
        pc.id,
        pc.first_name AS firstName,
        pc.last_name AS lastName,
        pc.birth_date AS birthDate,
        pc.email,
        pc.address,
        pc.phone,
        pc.instagram,
        pc.source,
        pc.lead_status AS leadStatus,
        pc.admin_notes AS adminNotes,
        pc.linked_customer_id AS linkedCustomerId,
        pc.created_at AS createdAt,
        pc.updated_at AS updatedAt
      FROM potential_customers pc
      WHERE pc.id = ?
      LIMIT 1
    `,
    [id],
  );

  if (!rows.length) {
    throw notFound('Lead not found');
  }

  const lead = rows[0];
  lead.preferences = await getLeadPreferencesByPotentialCustomerId(id, connection);

  const [alertRows] = await connection.execute(
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
      WHERE aia.potential_customer_id = ?
      ORDER BY aia.created_at DESC, aia.id DESC
    `,
    [id],
  );

  lead.alerts = alertRows;

  const [wishlistRows] = await connection.execute(
    `
      SELECT
        w.id,
        w.session_token AS sessionToken,
        COUNT(wi.id) AS itemCount
      FROM wishlists w
      LEFT JOIN wishlist_items wi ON wi.wishlist_id = w.id
      WHERE w.potential_customer_id = ?
      GROUP BY w.id, w.session_token
      ORDER BY w.updated_at DESC, w.id DESC
    `,
    [id],
  );

  lead.wishlists = wishlistRows.map((row) => ({
    id: Number(row.id),
    sessionToken: row.sessionToken || null,
    itemCount: Number(row.itemCount || 0),
  }));

  return lead;
}

export async function createNewsletterLead(input, auditContext) {
  return withTransaction(async (connection) => {
    const normalized = normalizeLeadInput(input);
    const existing = await findPotentialCustomerByContact(normalized, connection);
    const lead = await upsertPotentialCustomerByContact(
      normalized,
      { source: 'NEWSLETTER', leadStatus: existing?.leadStatus || 'NEW' },
      connection,
    );
    const preferences = await upsertLeadPreferences(lead.id, normalized, connection);

    await logAudit(
      {
        actorUserId: auditContext.actorUserId || null,
        actorLabel: normalized.email || normalized.phone || normalized.instagram || `${normalized.firstName} ${normalized.lastName}`.trim(),
        actionCode: existing ? 'LEAD_UPDATED' : 'LEAD_CAPTURED',
        entityType: 'potential_customers',
        entityId: lead.id,
        afterJson: { ...lead, preferences },
        metadataJson: { source: 'NEWSLETTER' },
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return getLeadByIdInternal(lead.id, connection);
  });
}

export async function saveLeadPreferences(input, auditContext) {
  return withTransaction(async (connection) => {
    const normalized = normalizeLeadInput(input);
    let leadId = input.potentialCustomerId || null;

    if (!leadId) {
      const existing = await findPotentialCustomerByContact(normalized, connection);
      const lead = await upsertPotentialCustomerByContact(
        normalized,
        { source: 'PRODUCT_INTEREST', leadStatus: existing?.leadStatus || 'NEW' },
        connection,
      );
      leadId = lead.id;
    }

    const preferences = await upsertLeadPreferences(leadId, normalized, connection);
    const lead = await getLeadByIdInternal(leadId, connection);

    await logAudit(
      {
        actorUserId: auditContext.actorUserId || null,
        actorLabel: lead.email || lead.phone || lead.instagram || `${lead.firstName} ${lead.lastName}`.trim(),
        actionCode: 'LEAD_PREFERENCES_SAVED',
        entityType: 'potential_customers',
        entityId: lead.id,
        metadataJson: preferences,
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return lead;
  });
}

export async function createStockAlert(input, auditContext) {
  return withTransaction(async (connection) => {
    const normalized = normalizeLeadInput(input);
    const existing = await findPotentialCustomerByContact(normalized, connection);
    const lead = await upsertPotentialCustomerByContact(
      normalized,
      { source: 'STOCK_ALERT', leadStatus: existing?.leadStatus || 'NEW' },
      connection,
    );
    await upsertLeadPreferences(lead.id, normalized, connection);

    const [articleRows] = input.articleId
      ? await connection.execute(
        'SELECT id, title, slug FROM articles WHERE id = ? LIMIT 1',
        [input.articleId],
      )
      : [[]];

    if (input.articleId && !articleRows.length) {
      throw notFound('Article not found');
    }

    const [existingAlertRows] = await connection.execute(
      `
        SELECT id
        FROM article_interest_alerts
        WHERE potential_customer_id = ?
          AND (${input.articleId ? 'article_id = ?' : 'article_id IS NULL'})
          AND alert_type = ?
        LIMIT 1
      `,
      input.articleId
        ? [lead.id, input.articleId, input.alertType]
        : [lead.id, input.alertType],
    );

    let alertId = existingAlertRows[0]?.id || null;
    if (alertId) {
      await connection.execute(
        `
          UPDATE article_interest_alerts
          SET status = 'ACTIVE'
          WHERE id = ?
        `,
        [alertId],
      );
    } else {
      const [insertResult] = await connection.execute(
        `
          INSERT INTO article_interest_alerts (
            article_id,
            potential_customer_id,
            alert_type,
            status
          ) VALUES (?, ?, ?, 'ACTIVE')
        `,
        [input.articleId || null, lead.id, input.alertType],
      );
      alertId = Number(insertResult.insertId);
    }

    await connection.execute(
      `
        INSERT INTO article_events (
          article_id,
          event_type,
          session_token,
          customer_id,
          potential_customer_id,
          metadata_json,
          ip_address,
          user_agent
        ) VALUES (?, 'STOCK_ALERT', ?, NULL, ?, ?, ?, ?)
      `,
      [
        input.articleId || null,
        null,
        lead.id,
        JSON.stringify({ alertType: input.alertType }),
        auditContext.ipAddress || null,
        auditContext.userAgent || null,
      ],
    );

    await logAudit(
      {
        actorUserId: auditContext.actorUserId || null,
        actorLabel: lead.email || lead.phone || lead.instagram || `${lead.firstName} ${lead.lastName}`.trim(),
        actionCode: 'STOCK_ALERT_CREATED',
        entityType: 'article_interest_alerts',
        entityId: alertId,
        metadataJson: {
          alertType: input.alertType,
          articleId: input.articleId || null,
        },
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return {
      lead: await getLeadByIdInternal(lead.id, connection),
      alertId,
      article: articleRows[0] || null,
    };
  });
}

export async function addWishlistItem(input, actor, auditContext) {
  return withTransaction(async (connection) => {
    const [articleRows] = await connection.execute(
      'SELECT id FROM articles WHERE id = ? LIMIT 1',
      [input.articleId],
    );

    if (!articleRows.length) {
      throw notFound('Article not found');
    }

    const owner = await getWishlistOwner(
      {
        sessionToken: input.sessionToken || null,
        actor,
        contact: input.contact || null,
      },
      connection,
    );
    const wishlist = await getOrCreateWishlist(owner, connection);

    await connection.execute(
      `
        INSERT INTO wishlist_items (wishlist_id, article_id)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE article_id = VALUES(article_id)
      `,
      [wishlist.id, input.articleId],
    );

    await connection.execute(
      `
        INSERT INTO article_events (
          article_id,
          event_type,
          session_token,
          customer_id,
          potential_customer_id,
          metadata_json,
          ip_address,
          user_agent
        ) VALUES (?, 'WISHLIST_ADD', ?, ?, ?, ?, ?, ?)
      `,
      [
        input.articleId,
        wishlist.sessionToken || null,
        owner.customerId || null,
        owner.potentialCustomerId || null,
        JSON.stringify({ wishlistId: wishlist.id }),
        auditContext.ipAddress || null,
        auditContext.userAgent || null,
      ],
    );

    await logAudit(
      {
        actorUserId: actor?.userId || null,
        actorLabel: auditContext.actorLabel || owner.sessionToken || 'wishlist',
        actionCode: 'WISHLIST_ITEM_ADDED',
        entityType: 'wishlists',
        entityId: wishlist.id,
        metadataJson: { articleId: input.articleId },
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return {
      wishlistId: wishlist.id,
      sessionToken: wishlist.sessionToken,
      items: await listWishlistItemsByWishlistId(wishlist.id, connection),
    };
  });
}

export async function removeWishlistItem(articleId, options, actor, auditContext) {
  return withTransaction(async (connection) => {
    const owner = await getWishlistOwner(
      {
        sessionToken: options.sessionToken || null,
        actor,
        contact: null,
        generateSessionToken: false,
      },
      connection,
    );

    const wishlist = await findWishlist(owner, connection);
    if (!wishlist) {
      return {
        wishlistId: null,
        sessionToken: owner.sessionToken || null,
        items: [],
      };
    }

    await connection.execute(
      'DELETE FROM wishlist_items WHERE wishlist_id = ? AND article_id = ?',
      [wishlist.id, articleId],
    );

    await logAudit(
      {
        actorUserId: actor?.userId || null,
        actorLabel: auditContext.actorLabel || owner.sessionToken || 'wishlist',
        actionCode: 'WISHLIST_ITEM_REMOVED',
        entityType: 'wishlists',
        entityId: wishlist.id,
        metadataJson: { articleId },
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return {
      wishlistId: wishlist.id,
      sessionToken: wishlist.sessionToken,
      items: await listWishlistItemsByWishlistId(wishlist.id, connection),
    };
  });
}

export async function getWishlist(options, actor) {
  return withTransaction(async (connection) => {
    const owner = await getWishlistOwner(
      {
        sessionToken: options.sessionToken || null,
        actor,
        contact: null,
        generateSessionToken: false,
      },
      connection,
    );

    const wishlist = await findWishlist(owner, connection);
    if (!wishlist) {
      return {
        wishlistId: null,
        sessionToken: owner.sessionToken || null,
        items: [],
      };
    }

    return {
      wishlistId: wishlist.id,
      sessionToken: wishlist.sessionToken,
      items: await listWishlistItemsByWishlistId(wishlist.id, connection),
    };
  });
}

export async function trackArticleEvent(input, actor, auditContext) {
  return withTransaction(async (connection) => {
    let customerId = null;
    if (actor?.userId) {
      const customer = await resolveAuthenticatedCustomer(actor.userId, connection);
      customerId = customer.id;
    }

    const [result] = await connection.execute(
      `
        INSERT INTO article_events (
          article_id,
          event_type,
          session_token,
          customer_id,
          potential_customer_id,
          metadata_json,
          ip_address,
          user_agent
        ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?)
      `,
      [
        input.articleId || null,
        input.eventType,
        input.sessionToken || null,
        customerId,
        input.metadata ? JSON.stringify(input.metadata) : null,
        auditContext.ipAddress || null,
        auditContext.userAgent || null,
      ],
    );

    return {
      id: Number(result.insertId),
      eventType: input.eventType,
    };
  });
}

export async function listLeads({ filters, pagination }) {
  const { page, pageSize, offset } = pagination;
  const clauses = [];
  const params = [];

  if (filters.q) {
    const like = buildLikeValue(filters.q);
    clauses.push(`(
      pc.first_name LIKE ?
      OR pc.last_name LIKE ?
      OR pc.email LIKE ?
      OR pc.phone LIKE ?
      OR pc.instagram LIKE ?
      OR COALESCE(pc.admin_notes, '') LIKE ?
    )`);
    params.push(like, like, like, like, like, like);
  }

  if (filters.source) {
    clauses.push('pc.source = ?');
    params.push(filters.source);
  }

  if (filters.leadStatus) {
    clauses.push('pc.lead_status = ?');
    params.push(filters.leadStatus);
  }

  appendDateRangeFilters('pc.created_at', filters, clauses, params);

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const orderBy = resolveSortClause({
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
    sortMap: LEAD_SORTS,
    fallbackKey: 'createdAt',
  });

  const [rows] = await pool.query(
    `
      SELECT
        pc.id,
        pc.first_name AS firstName,
        pc.last_name AS lastName,
        pc.birth_date AS birthDate,
        pc.email,
        pc.address,
        pc.phone,
        pc.instagram,
        pc.source,
        pc.lead_status AS leadStatus,
        pc.admin_notes AS adminNotes,
        pc.linked_customer_id AS linkedCustomerId,
        pc.created_at AS createdAt,
        pc.updated_at AS updatedAt,
        lp.preferred_categories_json AS preferredCategories,
        lp.preferred_brands_json AS preferredBrands,
        lp.preferred_sizes_json AS preferredSizes,
        lp.preferred_colors_json AS preferredColors,
        lp.notes AS preferenceNotes,
        (
          SELECT COUNT(*)
          FROM article_interest_alerts aia
          WHERE aia.potential_customer_id = pc.id AND aia.status = 'ACTIVE'
        ) AS activeAlertsCount,
        (
          SELECT COUNT(*)
          FROM wishlists w
          INNER JOIN wishlist_items wi ON wi.wishlist_id = w.id
          WHERE w.potential_customer_id = pc.id
        ) AS wishlistItemsCount
      FROM potential_customers pc
      LEFT JOIN lead_preferences lp ON lp.potential_customer_id = pc.id
      ${where}
      ORDER BY ${orderBy}
      LIMIT ${pageSize} OFFSET ${offset}
    `,
    params,
  );

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM potential_customers pc ${where}`,
    params,
  );

  return {
    items: rows.map((row) => ({
      ...row,
      activeAlertsCount: Number(row.activeAlertsCount || 0),
      wishlistItemsCount: Number(row.wishlistItemsCount || 0),
      preferences: {
        preferredCategories: parseJsonField(row.preferredCategories, []),
        preferredBrands: parseJsonField(row.preferredBrands, []),
        preferredSizes: parseJsonField(row.preferredSizes, []),
        preferredColors: parseJsonField(row.preferredColors, []),
        notes: row.preferenceNotes || null,
      },
    })),
    pagination: {
      page,
      pageSize,
      total: countRows[0].total,
    },
  };
}

export async function getLeadById(id) {
  return getLeadByIdInternal(id, pool);
}

export async function updateLeadStatus(id, input, auditContext) {
  return withTransaction(async (connection) => {
    const before = await getLeadByIdInternal(id, connection);

    await connection.execute(
      `
        UPDATE potential_customers
        SET
          lead_status = ?,
          admin_notes = ?
        WHERE id = ?
      `,
      [input.leadStatus, input.adminNotes || null, id],
    );

    const after = await getLeadByIdInternal(id, connection);

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: 'LEAD_STATUS_UPDATED',
        entityType: 'potential_customers',
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

export async function listArticleEvents({ filters, pagination }) {
  const { page, pageSize, offset } = pagination;
  const clauses = [];
  const params = [];

  if (filters.articleId) {
    clauses.push('ae.article_id = ?');
    params.push(filters.articleId);
  }

  if (filters.eventType) {
    clauses.push('ae.event_type = ?');
    params.push(filters.eventType);
  }

  if (filters.q) {
    const like = buildLikeValue(filters.q);
    clauses.push(`(
      COALESCE(a.title, '') LIKE ?
      OR COALESCE(pc.email, '') LIKE ?
      OR COALESCE(pc.phone, '') LIKE ?
      OR COALESCE(pc.instagram, '') LIKE ?
      OR COALESCE(c.email, '') LIKE ?
    )`);
    params.push(like, like, like, like, like);
  }

  appendDateRangeFilters('ae.created_at', filters, clauses, params);

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const orderBy = resolveSortClause({
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
    sortMap: ARTICLE_EVENT_SORTS,
    fallbackKey: 'createdAt',
  });

  const [rows] = await pool.query(
    `
      SELECT
        ae.id,
        ae.article_id AS articleId,
        ae.event_type AS eventType,
        ae.session_token AS sessionToken,
        ae.customer_id AS customerId,
        ae.potential_customer_id AS potentialCustomerId,
        ae.metadata_json AS metadata,
        ae.ip_address AS ipAddress,
        ae.user_agent AS userAgent,
        ae.created_at AS createdAt,
        a.title AS articleTitle,
        a.slug AS articleSlug,
        COALESCE(c.email, pc.email) AS contactEmail,
        COALESCE(c.phone, pc.phone) AS contactPhone,
        COALESCE(c.instagram, pc.instagram) AS contactInstagram
      FROM article_events ae
      LEFT JOIN articles a ON a.id = ae.article_id
      LEFT JOIN customers c ON c.id = ae.customer_id
      LEFT JOIN potential_customers pc ON pc.id = ae.potential_customer_id
      ${where}
      ORDER BY ${orderBy}
      LIMIT ${pageSize} OFFSET ${offset}
    `,
    params,
  );

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM article_events ae ${where}`,
    params,
  );

  return {
    items: rows.map((row) => ({
      ...row,
      metadata: parseJsonField(row.metadata, null),
    })),
    pagination: {
      page,
      pageSize,
      total: countRows[0].total,
    },
  };
}
