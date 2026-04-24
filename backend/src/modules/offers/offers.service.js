import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { badRequest, notFound } from '../../utils/app-error.js';
import { getPagination } from '../../utils/pagination.js';
import { logAudit } from '../audit/audit.service.js';
import {
  createPotentialCustomerFromInput,
  ensureCustomerForUser,
  findCustomerByUserId,
} from '../customers/customer-helpers.js';

export async function createOffer(input, actor, auditContext) {
  return withTransaction(async (connection) => {
    const article = await getOfferableArticle(input.articleId, connection);

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
        'Oferta creada desde la vista pública.',
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

export async function listOffers({ page, pageSize, offset, status }) {
  const params = [];
  let where = '';

  if (status) {
    where = 'WHERE o.status = ?';
    params.push(status);
  }

  const [rows] = await pool.query(
    `
      SELECT
        o.id,
        o.article_id AS articleId,
        a.title AS articleTitle,
        a.slug AS articleSlug,
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
        COALESCE(c.first_name, pc.first_name) AS contactFirstName,
        COALESCE(c.last_name, pc.last_name) AS contactLastName,
        COALESCE(c.email, pc.email) AS contactEmail,
        COALESCE(c.phone, pc.phone) AS contactPhone,
        COALESCE(c.instagram, pc.instagram) AS contactInstagram
      FROM offers o
      INNER JOIN articles a ON a.id = o.article_id
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN potential_customers pc ON pc.id = o.potential_customer_id
      ${where}
      ORDER BY o.id DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `,
    params,
  );

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM offers o ${where}`,
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

export async function changeOfferStatus(id, input, auditContext) {
  return withTransaction(async (connection) => {
    const before = await getOfferById(id, connection);

    if (before.status !== 'PENDING') {
      throw badRequest('Only pending offers can be updated from backoffice');
    }

    const sql = `
      UPDATE offers
      SET
        status = ?,
        accepted_at = ${input.status === 'ACCEPTED' ? 'NOW()' : 'accepted_at'},
        rejected_at = ${input.status === 'REJECTED' ? 'NOW()' : 'rejected_at'},
        cancelled_at = ${input.status === 'CANCELLED' ? 'NOW()' : 'cancelled_at'},
        updated_by = ?
      WHERE id = ?
    `;

    await connection.execute(sql, [input.status, auditContext.actorUserId, id]);

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
        input.reason || `Offer ${String(input.status || '').toLowerCase()} from backoffice`,
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

    return after;
  });
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
    throw badRequest('Guest contact data is required to create an offer');
  }

  const potentialCustomer = await createPotentialCustomerFromInput(
    guest,
    { source: 'OFFER' },
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
    throw notFound('Article not found');
  }

  const article = rows[0];

  if (!article.allowOffers) {
    throw badRequest('This article does not accept offers');
  }

  if (article.status !== 'ACTIVE' || Number(article.quantityAvailable) <= 0) {
    throw badRequest('This article is not available for offers right now');
  }

  return article;
}

async function getOfferById(id, connection) {
  const [rows] = await connection.execute(
    `
      SELECT
        o.id,
        o.article_id AS articleId,
        a.title AS articleTitle,
        a.slug AS articleSlug,
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
    `,
    [id],
  );

  if (!rows.length) {
    throw notFound('Offer not found');
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
