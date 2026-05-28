import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { badRequest, notFound, unauthorized } from '../../utils/app-error.js';
import { getPagination } from '../../utils/pagination.js';
import { appendDateRangeFilters, buildLikeValue, resolveSortClause } from '../../utils/listing.js';
import { buildSqlLimitOffsetClause, normalizeSqlLimit, normalizeSqlOffset } from '../../utils/sql-safety.js';
import { logAudit } from '../audit/audit.service.js';
import { sendAcceptedOfferEmail } from './offers.mailer.js';
import { applyAcceptedOfferToActiveCart } from '../cart/cart.service.js';
import {
  ensureCustomerForUser,
  findCustomerByUserId,
  findPotentialCustomerByContact,
  upsertPotentialCustomerByContact,
} from '../customers/customer-helpers.js';

const OFFER_SORTS = {
  createdAt: (direction) => `o.created_at ${direction}, o.id ${direction}`,
  offeredAmount: (direction) => `o.offered_price ${direction}, o.id DESC`,
  status: (direction) => `o.status ${direction}, o.id DESC`,
  articleTitle: (direction) => `a.title ${direction}, o.id DESC`,
  contactName: (direction) => `COALESCE(c.last_name, pc.last_name) ${direction}, COALESCE(c.first_name, pc.first_name) ${direction}, o.id DESC`,
};



function normalizeBatchError(error) {
  return error?.message || 'No se pudo procesar el elemento.';
}

export async function batchUpdateOffers(input, auditContext) {
  const nextStatus = input.action === 'ACCEPT' ? 'ACCEPTED' : 'CANCELLED';
  const actionLabels = {
    ACCEPT: 'aceptada',
    CANCEL: 'cancelada',
  };
  const results = [];

  for (const id of input.ids) {
    try {
      const offer = await changeOfferStatus(
        id,
        {
          status: nextStatus,
          reason: input.reason || `Oferta ${actionLabels[input.action]} en lote por super admin.`,
        },
        auditContext,
      );

      results.push({
        id,
        ok: true,
        status: offer.status,
        articleTitle: offer.article?.title || null,
        message: `Oferta ${actionLabels[input.action] || 'actualizada'}.`,
      });
    } catch (error) {
      results.push({
        id,
        ok: false,
        message: normalizeBatchError(error),
      });
    }
  }

  return {
    action: input.action,
    total: results.length,
    succeeded: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    results,
  };
}

export async function createOffer(input, actor, auditContext) {
  if (!actor?.userId) {
    throw unauthorized('Debes iniciar sesión para enviar una oferta.');
  }

  return withTransaction(async (connection) => {
    const article = await getOfferableArticle(input.articleId, connection);
    assertOfferedAmountIsValid(input.offeredAmount, article);

    const owner = await resolveAuthenticatedOfferOwner(actor.userId, connection);

    const eligibility = await getOfferEligibilityForOwner(article.id, owner, connection, { forUpdate: true });
    assertOfferCreationIsAllowed(eligibility);

    const [insertResult] = await connection.execute(
      `
        INSERT INTO offers (
          article_id,
          customer_id,
          potential_customer_id,
          offered_price,
          currency_code,
          status,
          notes,
          created_by,
          updated_by
        ) VALUES (?, ?, ?, ?, 'UYU', 'PENDING', ?, ?, ?)
      `,
      [
        article.id,
        owner.customerId,
        owner.potentialCustomerId,
        input.offeredAmount,
        input.message,
        actor?.userId || null,
        actor?.userId || null,
      ],
    );

    const offerId = insertResult.insertId;

    await connection.execute(
      `
        INSERT INTO offer_status_history (
          offer_id,
          from_status,
          to_status,
          reason,
          changed_by,
          source
        ) VALUES (?, NULL, 'PENDING', ?, ?, ?)
      `,
      [
        offerId,
        'Oferta creada desde la vista publica.',
        auditContext.actorUserId || null,
        auditContext.source,
      ],
    );

    const offer = await getOfferById(offerId, connection);

    await logAudit(
      {
        actorUserId: auditContext.actorUserId || null,
        actorLabel: owner.actorLabel,
        actionCode: 'OFFER_CREATED',
        entityType: 'offers',
        entityId: offerId,
        afterJson: offer,
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return offer;
  });
}

export async function listOffers({ filters, pagination }) {
  const {
    q,
    status,
    categoryId,
    brandId,
    dateFrom,
    dateTo,
    sortBy,
    sortDir,
  } = filters;
  const { page, pageSize, offset } = pagination;
  const safePageSize = normalizeSqlLimit(pageSize, 25, 100);
  const safeOffset = normalizeSqlOffset(offset);
  const limitOffsetClause = buildSqlLimitOffsetClause(safePageSize, safeOffset, 25, 100);
  const params = [];
  const clauses = [];

  if (status) {
    clauses.push('o.status = ?');
    params.push(status);
  }

  if (categoryId) {
    clauses.push('a.category_id = ?');
    params.push(categoryId);
  }

  if (brandId) {
    clauses.push('a.brand_id = ?');
    params.push(brandId);
  }

  if (q) {
    const like = buildLikeValue(q);
    clauses.push(`(
      a.title LIKE ?
      OR a.internal_code LIKE ?
      OR o.notes LIKE ?
      OR COALESCE(c.first_name, pc.first_name) LIKE ?
      OR COALESCE(c.last_name, pc.last_name) LIKE ?
      OR COALESCE(c.email, pc.email) LIKE ?
      OR COALESCE(c.phone, pc.phone) LIKE ?
      OR COALESCE(c.instagram, pc.instagram) LIKE ?
    )`);
    params.push(like, like, like, like, like, like, like, like);
  }

  appendDateRangeFilters('o.created_at', { dateFrom, dateTo }, clauses, params);

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const orderBy = resolveSortClause({
    sortBy,
    sortDir,
    sortMap: OFFER_SORTS,
    fallbackKey: 'createdAt',
  });

  const [rows] = await pool.execute(
    `
      SELECT
        o.id,
        o.article_id AS articleId,
        a.title AS articleTitle,
        a.slug AS articleSlug,
        a.internal_code AS articleInternalCode,
        a.sale_price AS articleSalePrice,
        a.discounted_price AS articleDiscountedPrice,
        a.gender AS articleGender,
        a.age_group AS articleAgeGroup,
        a.description AS articleDescription,
        a.measurements_text AS articleMeasurementsText,
        inv.quantity_available AS articleQuantityAvailable,
        (
          SELECT COALESCE(ai.thumb_file_path, ai.card_file_path, ai.file_path)
          FROM article_images ai
          WHERE ai.article_id = a.id
          ORDER BY ai.is_primary DESC, ai.sort_order ASC, ai.id ASC
          LIMIT 1
        ) AS articleImage,
        cat.name AS categoryName,
        b.name AS brandName,
        o.customer_id AS customerId,
        o.potential_customer_id AS potentialCustomerId,
        o.offered_price AS offeredAmount,
        o.currency_code AS currencyCode,
        o.status,
        o.notes AS message,
        o.created_at AS createdAt,
        o.updated_at AS updatedAt,
        o.accepted_at AS acceptedAt,
        o.rejected_at AS rejectedAt,
        o.cancelled_at AS cancelledAt,
        o.consumed_at AS consumedAt,
        o.consumed_order_id AS consumedOrderId,
        COALESCE(c.first_name, pc.first_name) AS contactFirstName,
        COALESCE(c.last_name, pc.last_name) AS contactLastName,
        COALESCE(c.email, pc.email) AS contactEmail,
        COALESCE(c.phone, pc.phone) AS contactPhone,
        COALESCE(c.instagram, pc.instagram) AS contactInstagram
      FROM offers o
      INNER JOIN articles a ON a.id = o.article_id
      INNER JOIN article_inventory inv ON inv.article_id = a.id
      INNER JOIN categories cat ON cat.id = a.category_id
      LEFT JOIN brands b ON b.id = a.brand_id
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN potential_customers pc ON pc.id = o.potential_customer_id
      ${where}
      ORDER BY ${orderBy}
      ${limitOffsetClause}
    `,
    params,
  );

  const [countRows] = await pool.execute(
    `
      SELECT COUNT(*) AS total
      FROM offers o
      INNER JOIN articles a ON a.id = o.article_id
      INNER JOIN article_inventory inv ON inv.article_id = a.id
      INNER JOIN categories cat ON cat.id = a.category_id
      LEFT JOIN brands b ON b.id = a.brand_id
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN potential_customers pc ON pc.id = o.potential_customer_id
      ${where}
    `,
    params,
  );

  return {
    items: rows.map(normalizeOfferRow),
    pagination: {
      page,
      pageSize,
      total: countRows[0].total,
    },
  };
}

export async function listAcceptedOffersForUser(userId) {
  if (!userId) return [];

  const [rows] = await pool.execute(
    `
      SELECT
        o.id,
        o.article_id AS articleId,
        a.title AS articleTitle,
        a.slug AS articleSlug,
        a.sale_price AS articleSalePrice,
        a.discounted_price AS articleDiscountedPrice,
        a.gender AS articleGender,
        a.age_group AS articleAgeGroup,
        a.description AS articleDescription,
        a.measurements_text AS articleMeasurementsText,
        inv.quantity_available AS articleQuantityAvailable,
        (
          SELECT COALESCE(ai.thumb_file_path, ai.card_file_path, ai.file_path)
          FROM article_images ai
          WHERE ai.article_id = a.id
          ORDER BY ai.is_primary DESC, ai.sort_order ASC, ai.id ASC
          LIMIT 1
        ) AS articleImage,
        o.customer_id AS customerId,
        o.potential_customer_id AS potentialCustomerId,
        o.offered_price AS offeredAmount,
        o.currency_code AS currencyCode,
        o.status,
        o.notes AS message,
        o.created_at AS createdAt,
        o.updated_at AS updatedAt,
        o.accepted_at AS acceptedAt,
        o.rejected_at AS rejectedAt,
        o.cancelled_at AS cancelledAt,
        o.consumed_at AS consumedAt,
        o.consumed_order_id AS consumedOrderId,
        c.first_name AS contactFirstName,
        c.last_name AS contactLastName,
        c.email AS contactEmail,
        c.phone AS contactPhone,
        c.instagram AS contactInstagram
      FROM offers o
      INNER JOIN articles a ON a.id = o.article_id
      INNER JOIN article_inventory inv ON inv.article_id = a.id
      INNER JOIN customers c ON c.id = o.customer_id
      WHERE c.user_id = ?
        AND o.status = 'ACCEPTED'
        AND o.consumed_at IS NULL
      ORDER BY o.accepted_at DESC, o.id DESC
    `,
    [userId],
  );

  return rows.map(normalizeOfferRow);
}


export async function getOfferEligibilityForUser(userId, articleId) {
  if (!userId) {
    return buildOfferEligibility({ attemptCount: 0, activeOffer: null });
  }

  const customer = await findCustomerByUserId(userId, pool);
  if (!customer?.id) {
    return buildOfferEligibility({ attemptCount: 0, activeOffer: null });
  }

  return getOfferEligibilityForOwner(
    Number(articleId),
    { customerId: customer.id, potentialCustomerId: null },
    pool,
  );
}

export async function listOffersForUser(userId) {
  if (!userId) return [];

  const [rows] = await pool.execute(
    `
      SELECT
        o.id,
        o.article_id AS articleId,
        a.title AS articleTitle,
        a.slug AS articleSlug,
        a.internal_code AS articleInternalCode,
        a.sale_price AS articleSalePrice,
        a.discounted_price AS articleDiscountedPrice,
        a.gender AS articleGender,
        a.age_group AS articleAgeGroup,
        a.description AS articleDescription,
        a.measurements_text AS articleMeasurementsText,
        inv.quantity_available AS articleQuantityAvailable,
        (
          SELECT COALESCE(ai.thumb_file_path, ai.card_file_path, ai.file_path)
          FROM article_images ai
          WHERE ai.article_id = a.id
          ORDER BY ai.is_primary DESC, ai.sort_order ASC, ai.id ASC
          LIMIT 1
        ) AS articleImage,
        cat.name AS categoryName,
        b.name AS brandName,
        o.customer_id AS customerId,
        o.potential_customer_id AS potentialCustomerId,
        o.offered_price AS offeredAmount,
        o.currency_code AS currencyCode,
        o.status,
        o.notes AS message,
        o.created_at AS createdAt,
        o.updated_at AS updatedAt,
        o.accepted_at AS acceptedAt,
        o.rejected_at AS rejectedAt,
        o.cancelled_at AS cancelledAt,
        o.consumed_at AS consumedAt,
        o.consumed_order_id AS consumedOrderId,
        c.first_name AS contactFirstName,
        c.last_name AS contactLastName,
        c.email AS contactEmail,
        c.phone AS contactPhone,
        c.instagram AS contactInstagram
      FROM offers o
      INNER JOIN articles a ON a.id = o.article_id
      INNER JOIN article_inventory inv ON inv.article_id = a.id
      INNER JOIN categories cat ON cat.id = a.category_id
      LEFT JOIN brands b ON b.id = a.brand_id
      INNER JOIN customers c ON c.id = o.customer_id
      WHERE c.user_id = ?
      ORDER BY o.created_at DESC, o.id DESC
    `,
    [userId],
  );

  return rows.map(normalizeOfferRow);
}

export async function changeOfferStatus(id, input, auditContext) {
  let shouldSendAcceptedEmail = false;

  const offer = await withTransaction(async (connection) => {
    const before = await getOfferById(id, connection, { forUpdate: true });

    if (before.status !== 'PENDING') {
      throw badRequest('Solo se pueden actualizar ofertas pendientes desde administración.');
    }

    if (input.status === 'ACCEPTED') {
      assertOfferedAmountIsValid(before.offeredAmount, before.article);
      await assertArticleCanStillAcceptOffer(before.article.id, connection);
    }

    const sql = `
      UPDATE offers
      SET
        status = ?,
        accepted_at = ${input.status === 'ACCEPTED' ? 'NOW()' : 'accepted_at'},
        rejected_at = ${input.status === 'REJECTED' ? 'NOW()' : 'rejected_at'},
        cancelled_at = ${input.status === 'CANCELLED' ? 'NOW()' : 'cancelled_at'},
        updated_by = ?
      WHERE id = ? AND status = 'PENDING'
    `;

    const [updateResult] = await connection.execute(sql, [input.status, auditContext.actorUserId, id]);
    if (!updateResult.affectedRows) {
      throw badRequest('La oferta ya fue respondida o no está disponible.');
    }

    await connection.execute(
      `
        INSERT INTO offer_status_history (
          offer_id,
          from_status,
          to_status,
          reason,
          changed_by,
          source
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        before.status,
        input.status,
        input.reason || `Oferta ${getStatusReasonLabel(input.status)} desde administración`,
        auditContext.actorUserId,
        auditContext.source,
      ],
    );

    const after = await getOfferById(id, connection);

    if (input.status === 'ACCEPTED' && after.customerId) {
      const userId = await getUserIdForOfferCustomer(after.customerId, connection);
      if (userId) {
        await applyAcceptedOfferToActiveCart(
          userId,
          {
            id: after.id,
            articleId: after.article.id,
            offeredAmount: after.offeredAmount,
          },
          auditContext,
          connection,
        );
      }
    }

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: 'OFFER_STATUS_CHANGED',
        entityType: 'offers',
        entityId: id,
        beforeJson: before,
        afterJson: after,
        metadataJson: {
          status: input.status,
          reason: input.reason || null,
        },
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    if (input.status === 'ACCEPTED') {
      shouldSendAcceptedEmail = true;
    }

    return after;
  });

  if (shouldSendAcceptedEmail) {
    sendAcceptedOfferEmail(offer, { publicSiteUrl: auditContext.publicSiteUrl }).catch((error) => {
      console.warn('[offers] accepted offer email failed', error?.message || error);
    });
  }

  return offer;
}

async function getOfferEligibilityForOwner(articleId, owner, connection, options = {}) {
  const ownerClause = owner.customerId
    ? 'o.customer_id = ?'
    : 'o.potential_customer_id = ?';
  const ownerId = owner.customerId || owner.potentialCustomerId;
  const lockClause = options.forUpdate ? 'FOR UPDATE' : '';

  const [rows] = await connection.execute(
    `
      SELECT
        o.id,
        o.status,
        o.offered_price AS offeredAmount,
        o.created_at AS createdAt,
        o.accepted_at AS acceptedAt,
        o.consumed_at AS consumedAt
      FROM offers o
      WHERE o.article_id = ?
        AND ${ownerClause}
      ORDER BY
        CASE WHEN o.status IN ('PENDING', 'ACCEPTED') AND o.consumed_at IS NULL THEN 0 ELSE 1 END ASC,
        o.created_at DESC,
        o.id DESC
      ${lockClause}
    `,
    [articleId, ownerId],
  );

  const activeOffer = rows.find(
    (row) => ['PENDING', 'ACCEPTED'].includes(row.status) && row.consumedAt == null,
  );

  return buildOfferEligibility({
    attemptCount: rows.length,
    activeOffer: activeOffer || null,
  });
}

function buildOfferEligibility({ attemptCount, activeOffer }) {
  const maxAttempts = 3;
  let canOffer = true;
  let reasonCode = null;
  let message = '';

  if (activeOffer) {
    canOffer = false;
    reasonCode = activeOffer.status === 'ACCEPTED' ? 'ACTIVE_ACCEPTED_OFFER' : 'ACTIVE_PENDING_OFFER';
    message = activeOffer.status === 'ACCEPTED'
      ? 'Ya tenes una oferta aceptada para esta prenda. Puedes usarla desde el carrito.'
      : 'Ya tenes una oferta pendiente para esta prenda. Espera la respuesta antes de enviar otra.';
  } else if (Number(attemptCount || 0) >= maxAttempts) {
    canOffer = false;
    reasonCode = 'MAX_ATTEMPTS_REACHED';
    message = 'Ya alcanzaste el maximo de 3 ofertas para esta prenda.';
  }

  return {
    canOffer,
    reasonCode,
    message,
    attemptCount: Number(attemptCount || 0),
    remainingAttempts: Math.max(0, maxAttempts - Number(attemptCount || 0)),
    maxAttempts,
    activeOffer: activeOffer
      ? {
          id: activeOffer.id,
          status: activeOffer.status,
          offeredAmount: Number(activeOffer.offeredAmount),
          createdAt: activeOffer.createdAt,
          acceptedAt: activeOffer.acceptedAt || null,
        }
      : null,
  };
}

function assertOfferCreationIsAllowed(eligibility) {
  if (eligibility.canOffer) return;
  throw badRequest(eligibility.message || 'No puedes crear otra oferta para esta prenda.');
}

async function getUserIdForOfferCustomer(customerId, connection) {
  if (!customerId) return null;

  const [rows] = await connection.execute(
    `
      SELECT user_id AS userId
      FROM customers
      WHERE id = ?
      LIMIT 1
    `,
    [customerId],
  );

  return rows[0]?.userId || null;
}

async function resolveAuthenticatedOfferOwner(userId, connection) {
  const customer = await findCustomerByUserId(userId, connection)
    || await ensureCustomerForUser(userId, connection);

  return {
    customerId: customer.id,
    potentialCustomerId: null,
    actorLabel: customer.email || `${customer.firstName} ${customer.lastName}`.trim(),
  };
}

async function resolveGuestOfferOwner(guest, connection) {
  if (!guest) {
    throw badRequest('Necesitamos tus datos de contacto para crear la oferta.');
  }

  const existingLead = await findPotentialCustomerByContact(guest, connection);
  const potentialCustomer = await upsertPotentialCustomerByContact(
    guest,
    {
      source: 'OFFER',
      leadStatus: existingLead?.leadStatus || 'NEW',
    },
    connection,
  );

  return {
    customerId: null,
    potentialCustomerId: potentialCustomer.id,
    actorLabel: potentialCustomer.email || `${potentialCustomer.firstName} ${potentialCustomer.lastName}`.trim(),
  };
}


async function assertArticleCanStillAcceptOffer(articleId, connection) {
  const [rows] = await connection.execute(
    `
      SELECT
        a.id,
        a.status AS publicationStatus,
        a.allow_offers AS allowOffers,
        inv.quantity_available AS quantityAvailable,
        inv.quantity_reserved AS quantityReserved,
        inv.quantity_sold AS quantitySold
      FROM articles a
      INNER JOIN article_inventory inv ON inv.article_id = a.id
      WHERE a.id = ?
      LIMIT 1
      FOR UPDATE
    `,
    [articleId],
  );

  if (!rows.length) {
    throw notFound('Articulo no encontrado.');
  }

  const article = rows[0];
  if (!article.allowOffers) {
    throw badRequest('Esta prenda ya no acepta ofertas.');
  }

  if (article.publicationStatus !== 'ACTIVE' || Number(article.quantityAvailable) <= 0) {
    throw badRequest('Esta prenda ya no está disponible para aceptar ofertas.');
  }
}

async function getOfferableArticle(articleId, connection) {
  const [rows] = await connection.execute(
    `
      SELECT
        a.id,
        a.title,
        a.sale_price AS salePrice,
        a.allow_offers AS allowOffers,
        a.status AS publicationStatus,
        inv.quantity_available AS quantityAvailable,
        inv.quantity_reserved AS quantityReserved,
        inv.quantity_sold AS quantitySold
      FROM articles a
      INNER JOIN article_inventory inv ON inv.article_id = a.id
      WHERE a.id = ?
      LIMIT 1
      FOR UPDATE
    `,
    [articleId],
  );

  if (!rows.length) {
    throw notFound('Articulo no encontrado.');
  }

  const article = rows[0];

  if (!article.allowOffers) {
    throw badRequest('Esta prenda no acepta ofertas.');
  }

  if (article.publicationStatus !== 'ACTIVE' || Number(article.quantityAvailable) <= 0) {
    throw badRequest('Esta prenda no está disponible para ofertas en este momento.');
  }

  return article;
}

async function getOfferById(id, connection, options = {}) {
  const lockClause = options.forUpdate ? 'FOR UPDATE' : '';
  const [rows] = await connection.execute(
    `
      SELECT
        o.id,
        o.article_id AS articleId,
        a.title AS articleTitle,
        a.slug AS articleSlug,
        a.sale_price AS articleSalePrice,
        a.discounted_price AS articleDiscountedPrice,
        a.gender AS articleGender,
        a.age_group AS articleAgeGroup,
        a.description AS articleDescription,
        a.measurements_text AS articleMeasurementsText,
        inv.quantity_available AS articleQuantityAvailable,
        (
          SELECT COALESCE(ai.thumb_file_path, ai.card_file_path, ai.file_path)
          FROM article_images ai
          WHERE ai.article_id = a.id
          ORDER BY ai.is_primary DESC, ai.sort_order ASC, ai.id ASC
          LIMIT 1
        ) AS articleImage,
        o.customer_id AS customerId,
        o.potential_customer_id AS potentialCustomerId,
        o.offered_price AS offeredAmount,
        o.currency_code AS currencyCode,
        o.status,
        o.notes AS message,
        o.created_at AS createdAt,
        o.updated_at AS updatedAt,
        o.accepted_at AS acceptedAt,
        o.rejected_at AS rejectedAt,
        o.cancelled_at AS cancelledAt,
        o.consumed_at AS consumedAt,
        o.consumed_order_id AS consumedOrderId,
        COALESCE(c.first_name, pc.first_name) AS contactFirstName,
        COALESCE(c.last_name, pc.last_name) AS contactLastName,
        COALESCE(c.email, pc.email) AS contactEmail,
        COALESCE(c.phone, pc.phone) AS contactPhone,
        COALESCE(c.instagram, pc.instagram) AS contactInstagram
      FROM offers o
      INNER JOIN articles a ON a.id = o.article_id
      INNER JOIN article_inventory inv ON inv.article_id = a.id
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN potential_customers pc ON pc.id = o.potential_customer_id
      WHERE o.id = ?
      LIMIT 1
      ${lockClause}
    `,
    [id],
  );

  if (!rows.length) {
    throw notFound('Oferta no encontrada.');
  }

  const offer = normalizeOfferRow(rows[0]);

  const [historyRows] = await connection.execute(
    `
      SELECT
        id,
        from_status AS fromStatus,
        to_status AS toStatus,
        reason,
        changed_at AS changedAt,
        changed_by AS changedBy,
        source
      FROM offer_status_history
      WHERE offer_id = ?
      ORDER BY id ASC
    `,
    [id],
  );

  offer.history = historyRows;
  return offer;
}

function normalizeOfferRow(row) {
  return {
    id: row.id,
    article: {
      id: row.articleId,
      title: row.articleTitle,
      slug: row.articleSlug,
      internalCode: row.articleInternalCode,
      categoryName: row.categoryName,
      brandName: row.brandName,
      gender: row.articleGender || null,
      ageGroup: row.articleAgeGroup || null,
      description: row.articleDescription || null,
      measurementsText: row.articleMeasurementsText || null,
      salePrice: row.articleSalePrice != null ? Number(row.articleSalePrice) : null,
      discountedPrice: row.articleDiscountedPrice != null ? Number(row.articleDiscountedPrice) : null,
      quantityAvailable: row.articleQuantityAvailable != null ? Number(row.articleQuantityAvailable) : null,
      image: row.articleImage || '',
    },
    customerId: row.customerId,
    potentialCustomerId: row.potentialCustomerId,
    offeredAmount: Number(row.offeredAmount),
    currencyCode: row.currencyCode,
    status: row.status,
    message: row.message,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    acceptedAt: row.acceptedAt,
    rejectedAt: row.rejectedAt,
    cancelledAt: row.cancelledAt,
    consumedAt: row.consumedAt,
    consumedOrderId: row.consumedOrderId,
    contact: {
      firstName: row.contactFirstName,
      lastName: row.contactLastName,
      email: row.contactEmail,
      phone: row.contactPhone,
      instagram: row.contactInstagram,
    },
    history: [],
  };
}


export async function restoreUsedOffersForOrder(connection, { orderId, auditContext = {}, reason = 'Orden liberada' } = {}) {
  if (!orderId) return { restoredCount: 0, offerIds: [] };

  const [rows] = await connection.execute(
    `
      SELECT
        o.id,
        o.status,
        o.consumed_at AS consumedAt,
        o.consumed_order_id AS consumedOrderId
      FROM offers o
      WHERE o.consumed_order_id = ?
        AND o.status = 'USED'
        AND o.consumed_at IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM order_items oi
          WHERE oi.order_id = ?
            AND oi.accepted_offer_id = o.id
        )
      FOR UPDATE
    `,
    [orderId, orderId],
  );

  const restoredOfferIds = [];

  for (const row of rows) {
    const [updateResult] = await connection.execute(
      `
        UPDATE offers
        SET
          status = 'ACCEPTED',
          consumed_at = NULL,
          consumed_order_id = NULL,
          updated_by = ?
        WHERE id = ?
          AND status = 'USED'
          AND consumed_order_id = ?
      `,
      [auditContext.actorUserId || null, row.id, orderId],
    );

    if (!updateResult.affectedRows) continue;

    await connection.execute(
      `
        INSERT INTO offer_status_history (
          offer_id,
          from_status,
          to_status,
          reason,
          changed_by,
          source
        ) VALUES (?, 'USED', 'ACCEPTED', ?, ?, ?)
      `,
      [
        row.id,
        reason,
        auditContext.actorUserId || null,
        auditContext.source || 'SYSTEM',
      ],
    );

    await logAudit(
      {
        actorUserId: auditContext.actorUserId || null,
        actorLabel: auditContext.actorLabel || null,
        actionCode: 'OFFER_RESTORED_AFTER_ORDER_RELEASE',
        entityType: 'offers',
        entityId: row.id,
        beforeJson: {
          status: row.status,
          consumedAt: row.consumedAt,
          consumedOrderId: row.consumedOrderId,
        },
        afterJson: {
          status: 'ACCEPTED',
          consumedAt: null,
          consumedOrderId: null,
        },
        metadataJson: { orderId, reason },
        source: auditContext.source || 'SYSTEM',
        ipAddress: auditContext.ipAddress || null,
        userAgent: auditContext.userAgent || null,
      },
      connection,
    );

    restoredOfferIds.push(Number(row.id));
  }

  return {
    restoredCount: restoredOfferIds.length,
    offerIds: restoredOfferIds,
  };
}

export async function markUsedOffersConsumedByCancelledOrder(
  connection,
  { orderId, auditContext = {}, reason = 'Orden cancelada; intento de oferta consumido' } = {},
) {
  if (!orderId) return { consumedCount: 0, offerIds: [] };

  const [rows] = await connection.execute(
    `
      SELECT
        o.id,
        o.status,
        o.consumed_at AS consumedAt,
        o.consumed_order_id AS consumedOrderId
      FROM offers o
      WHERE o.consumed_order_id = ?
        AND o.status = 'USED'
        AND o.consumed_at IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM order_items oi
          WHERE oi.order_id = ?
            AND oi.accepted_offer_id = o.id
        )
      FOR UPDATE
    `,
    [orderId, orderId],
  );

  const consumedOfferIds = [];

  for (const row of rows) {
    await connection.execute(
      `
        INSERT INTO offer_status_history (
          offer_id,
          from_status,
          to_status,
          reason,
          changed_by,
          source
        ) VALUES (?, 'USED', 'USED', ?, ?, ?)
      `,
      [
        row.id,
        reason,
        auditContext.actorUserId || null,
        auditContext.source || 'SYSTEM',
      ],
    );

    await logAudit(
      {
        actorUserId: auditContext.actorUserId || null,
        actorLabel: auditContext.actorLabel || null,
        actionCode: 'OFFER_ATTEMPT_CONSUMED_AFTER_ORDER_CANCEL',
        entityType: 'offers',
        entityId: row.id,
        beforeJson: {
          status: row.status,
          consumedAt: row.consumedAt,
          consumedOrderId: row.consumedOrderId,
        },
        afterJson: {
          status: row.status,
          consumedAt: row.consumedAt,
          consumedOrderId: row.consumedOrderId,
        },
        metadataJson: { orderId, reason },
        source: auditContext.source || 'SYSTEM',
        ipAddress: auditContext.ipAddress || null,
        userAgent: auditContext.userAgent || null,
      },
      connection,
    );

    consumedOfferIds.push(Number(row.id));
  }

  return {
    consumedCount: consumedOfferIds.length,
    offerIds: consumedOfferIds,
  };
}

export function getOfferPagination(query, defaults = {}) {
  return getPagination(query, defaults);
}

function assertOfferedAmountIsValid(offeredAmount, article) {
  const amount = Number(offeredAmount);
  const publishedPrice = Number(article?.salePrice || article?.discountedPrice || 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw badRequest('Ingresa un monto de oferta válido.');
  }

  if (publishedPrice > 0 && amount > publishedPrice) {
    throw badRequest('La oferta no puede superar el precio publicado.');
  }
}

function getStatusReasonLabel(status) {
  if (status === 'ACCEPTED') return 'aceptada';
  if (status === 'REJECTED') return 'rechazada';
  if (status === 'CANCELLED') return 'cancelada';
  return String(status || '').toLowerCase();
}
