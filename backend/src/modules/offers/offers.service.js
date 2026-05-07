import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { badRequest, notFound } from '../../utils/app-error.js';
import { getPagination } from '../../utils/pagination.js';
import { appendDateRangeFilters, buildLikeValue, resolveSortClause } from '../../utils/listing.js';
import { logAudit } from '../audit/audit.service.js';
import { sendAcceptedOfferEmail } from './offers.mailer.js';
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

export async function createOffer(input, actor, auditContext) {
  return withTransaction(async (connection) => {
    const article = await getOfferableArticle(input.articleId, connection);
    assertOfferedAmountIsValid(input.offeredAmount, article);

    const owner = actor?.userId
      ? await resolveAuthenticatedOfferOwner(actor.userId, connection)
      : await resolveGuestOfferOwner(input.guest, connection);

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

  const [rows] = await pool.query(
    `
      SELECT
        o.id,
        o.article_id AS articleId,
        a.title AS articleTitle,
        a.slug AS articleSlug,
        a.internal_code AS articleInternalCode,
        a.sale_price AS articleSalePrice,
        a.discounted_price AS articleDiscountedPrice,
        a.quantity_available AS articleQuantityAvailable,
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
      INNER JOIN categories cat ON cat.id = a.category_id
      LEFT JOIN brands b ON b.id = a.brand_id
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN potential_customers pc ON pc.id = o.potential_customer_id
      ${where}
      ORDER BY ${orderBy}
      LIMIT ${pageSize} OFFSET ${offset}
    `,
    params,
  );

  const [countRows] = await pool.execute(
    `
      SELECT COUNT(*) AS total
      FROM offers o
      INNER JOIN articles a ON a.id = o.article_id
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
        a.quantity_available AS articleQuantityAvailable,
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
        a.quantity_available AS articleQuantityAvailable,
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
      throw badRequest('Solo se pueden actualizar ofertas pendientes desde administracion.');
    }

    if (input.status === 'ACCEPTED') {
      assertOfferedAmountIsValid(before.offeredAmount, before.article);
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
      throw badRequest('La oferta ya fue respondida o no esta disponible.');
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
        input.reason || `Oferta ${getStatusReasonLabel(input.status)} desde administracion`,
        auditContext.actorUserId,
        auditContext.source,
      ],
    );

    const after = await getOfferById(id, connection);

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
    sendAcceptedOfferEmail(offer).catch((error) => {
      console.warn('[offers] accepted offer email failed', error?.message || error);
    });
  }

  return offer;
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

async function getOfferableArticle(articleId, connection) {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        title,
        sale_price AS salePrice,
        allow_offers AS allowOffers,
        status,
        quantity_available AS quantityAvailable
      FROM articles
      WHERE id = ?
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

  if (article.status !== 'ACTIVE' || Number(article.quantityAvailable) <= 0) {
    throw badRequest('Esta prenda no esta disponible para ofertas en este momento.');
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
        a.quantity_available AS articleQuantityAvailable,
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

export function getOfferPagination(query, defaults = {}) {
  return getPagination(query, defaults);
}

function assertOfferedAmountIsValid(offeredAmount, article) {
  const amount = Number(offeredAmount);
  const publishedPrice = Number(article?.salePrice || article?.discountedPrice || 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw badRequest('Ingresa un monto de oferta valido.');
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
