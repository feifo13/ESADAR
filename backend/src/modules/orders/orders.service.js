import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { badRequest, notFound } from '../../utils/app-error.js';
import { generateOrderNumber } from '../../utils/order-number.js';
import { appendDateRangeFilters, buildLikeValue, resolveSortClause } from '../../utils/listing.js';
import { logAudit } from '../audit/audit.service.js';
import { convertActiveCartForUser } from '../cart/cart.service.js';
import {
  createPotentialCustomerFromInput,
  findCustomerByUserId,
} from '../customers/customer-helpers.js';

const ORDER_SORTS = {
  createdAt: (direction) => `o.created_at ${direction}, o.id ${direction}`,
  orderNumber: (direction) => `o.order_number ${direction}, o.id DESC`,
  total: (direction) => `o.total_snapshot ${direction}, o.id DESC`,
  orderStatus: (direction) => `o.order_status ${direction}, o.id DESC`,
  paymentStatus: (direction) => `o.payment_status ${direction}, o.id DESC`,
  customerName: (direction) => `COALESCE(c.last_name, pc.last_name) ${direction}, COALESCE(c.first_name, pc.first_name) ${direction}, o.id DESC`,
};

export async function createOrder(input, actor, auditContext) {
  return withTransaction(async (connection) => {
    const owner = await resolveOrderOwner(input, actor, connection);
    const shipping = input.shippingMethodId
      ? await getShippingMethod(input.shippingMethodId, connection)
      : null;

    const requestedArticleIds = [...new Set(input.items.map((item) => item.articleId))];
    const placeholders = requestedArticleIds.map(() => '?').join(',');
    const [articleRows] = await connection.execute(
      `
        SELECT
          a.id,
          a.slug,
          a.title,
          a.measurements_text AS measurementsText,
          a.sale_price AS salePrice,
          a.discount_type AS discountType,
          a.discount_value AS discountValue,
          a.discounted_price AS discountedPrice,
          a.quantity_available AS quantityAvailable,
          a.quantity_reserved AS quantityReserved,
          a.quantity_sold AS quantitySold,
          a.status,
          c.name AS categoryName,
          b.name AS brandName,
          COALESCE(s.code, a.size_text) AS sizeSnapshot,
          (
            SELECT ai.file_path
            FROM article_images ai
            WHERE ai.article_id = a.id
            ORDER BY ai.is_primary DESC, ai.sort_order ASC, ai.id ASC
            LIMIT 1
          ) AS imageSnapshot
        FROM articles a
        INNER JOIN categories c ON c.id = a.category_id
        LEFT JOIN brands b ON b.id = a.brand_id
        LEFT JOIN sizes s ON s.id = a.size_id
        WHERE a.id IN (${placeholders})
        FOR UPDATE
      `,
      requestedArticleIds,
    );

    const articlesById = new Map(articleRows.map((row) => [row.id, row]));
    const requestedQuantityByArticle = new Map();
    for (const item of input.items) {
      requestedQuantityByArticle.set(
        item.articleId,
        Number(requestedQuantityByArticle.get(item.articleId) || 0) + Number(item.quantity || 0),
      );
    }

    for (const [articleId, quantity] of requestedQuantityByArticle.entries()) {
      const article = articlesById.get(articleId);
      if (!article) {
        throw notFound(`Article ${articleId} not found`);
      }
      if (article.status !== 'ACTIVE') {
        throw badRequest(`Article ${article.id} is not available for purchase`);
      }
      if (Number(article.quantityAvailable) < quantity) {
        throw badRequest(`Article ${article.id} does not have enough stock available`);
      }
    }

    const orderItems = [];
    let subtotal = 0;
    let discountTotal = 0;

    for (const item of input.items) {
      const article = articlesById.get(item.articleId);
      if (!article) {
        throw notFound(`Article ${item.articleId} not found`);
      }

      const salePrice = Number(article.salePrice);
      const finalUnitPrice = Number(article.discountedPrice);
      const perUnitDiscount = salePrice - finalUnitPrice;
      const acceptedOffer = item.acceptedOfferId && owner.userId
        ? await getAcceptedOfferForOrder(owner.userId, article.id, item.acceptedOfferId, connection)
        : null;

      const offerQuantity = acceptedOffer ? Math.min(1, Number(item.quantity || 1)) : 0;
      const regularQuantity = Math.max(Number(item.quantity || 0) - offerQuantity, 0);

      if (acceptedOffer && offerQuantity > 0) {
        const acceptedOfferPrice = Number(acceptedOffer.offeredAmount);
        const lineTotal = acceptedOfferPrice * offerQuantity;
        subtotal += salePrice * offerQuantity;
        discountTotal += (salePrice - acceptedOfferPrice) * offerQuantity;

        orderItems.push({
          articleId: article.id,
          quantity: offerQuantity,
          articleTitleSnapshot: article.title,
          articleSlugSnapshot: article.slug,
          categoryNameSnapshot: article.categoryName,
          brandNameSnapshot: article.brandName || null,
          sizeSnapshot: article.sizeSnapshot || null,
          measurementsSnapshot: article.measurementsText || null,
          imageSnapshot: article.imageSnapshot || null,
          salePriceSnapshot: salePrice,
          discountTypeSnapshot: article.discountType,
          discountValueSnapshot: Number(article.discountValue),
          finalUnitPriceSnapshot: finalUnitPrice,
          lineTotalSnapshot: lineTotal,
          acceptedOfferId: acceptedOffer.id,
          acceptedOfferPriceSnapshot: acceptedOfferPrice,
          acceptedOfferQuantitySnapshot: 1,
        });
      }

      if (regularQuantity > 0) {
        const lineTotal = finalUnitPrice * regularQuantity;
        subtotal += salePrice * regularQuantity;
        discountTotal += perUnitDiscount * regularQuantity;

        orderItems.push({
          articleId: article.id,
          quantity: regularQuantity,
          articleTitleSnapshot: article.title,
          articleSlugSnapshot: article.slug,
          categoryNameSnapshot: article.categoryName,
          brandNameSnapshot: article.brandName || null,
          sizeSnapshot: article.sizeSnapshot || null,
          measurementsSnapshot: article.measurementsText || null,
          imageSnapshot: article.imageSnapshot || null,
          salePriceSnapshot: salePrice,
          discountTypeSnapshot: article.discountType,
          discountValueSnapshot: Number(article.discountValue),
          finalUnitPriceSnapshot: finalUnitPrice,
          lineTotalSnapshot: lineTotal,
          acceptedOfferId: null,
          acceptedOfferPriceSnapshot: null,
          acceptedOfferQuantitySnapshot: 0,
        });
      }
    }

    const shippingCost = shipping ? Number(shipping.baseCost) : 0;
    const total = subtotal - discountTotal + shippingCost;
    const orderNumber = generateOrderNumber();

    const [orderInsert] = await connection.execute(
      `
        INSERT INTO orders (
          order_number,
          customer_id,
          potential_customer_id,
          user_id,
          shipping_method_id,
          shipping_method_description_snapshot,
          shipping_cost_snapshot,
          payment_method,
          payment_status,
          order_status,
          subtotal_snapshot,
          discount_total_snapshot,
          total_snapshot,
          reserved_until,
          internal_notes,
          created_by,
          updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 'RESERVED', ?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR), ?, ?, ?)
      `,
      [
        orderNumber,
        owner.customerId,
        owner.potentialCustomerId,
        owner.userId,
        shipping?.id || null,
        shipping?.description || null,
        shippingCost,
        input.paymentMethod,
        subtotal,
        discountTotal,
        total,
        input.notes || null,
        auditContext.actorUserId,
        auditContext.actorUserId,
      ],
    );

    const orderId = orderInsert.insertId;

    for (const item of orderItems) {
      await connection.execute(
        `
          INSERT INTO order_items (
            order_id,
            article_id,
            quantity,
            article_title_snapshot,
            article_slug_snapshot,
            category_name_snapshot,
            brand_name_snapshot,
            size_snapshot,
            measurements_snapshot,
            image_snapshot,
            sale_price_snapshot,
            discount_type_snapshot,
            discount_value_snapshot,
            final_unit_price_snapshot,
            line_total_snapshot,
            accepted_offer_id,
            accepted_offer_price_snapshot,
            accepted_offer_quantity_snapshot
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          orderId,
          item.articleId,
          item.quantity,
          item.articleTitleSnapshot,
          item.articleSlugSnapshot,
          item.categoryNameSnapshot,
          item.brandNameSnapshot,
          item.sizeSnapshot,
          item.measurementsSnapshot,
          item.imageSnapshot,
          item.salePriceSnapshot,
          item.discountTypeSnapshot,
          item.discountValueSnapshot,
          item.finalUnitPriceSnapshot,
          item.lineTotalSnapshot,
          item.acceptedOfferId,
          item.acceptedOfferPriceSnapshot,
          item.acceptedOfferQuantitySnapshot,
        ],
      );

      if (item.acceptedOfferId) {
        const [offerUpdateResult] = await connection.execute(
          `
            UPDATE offers
            SET consumed_at = NOW(), consumed_order_id = ?, updated_by = ?
            WHERE id = ? AND status = 'ACCEPTED' AND consumed_at IS NULL
          `,
          [orderId, auditContext.actorUserId, item.acceptedOfferId],
        );

        if (!offerUpdateResult.affectedRows) {
          throw badRequest('La oferta aceptada ya fue usada o no esta disponible.');
        }
      }

      await connection.execute(
        `
          UPDATE articles
          SET
            quantity_available = quantity_available - ?,
            quantity_reserved = quantity_reserved + ?,
            status = CASE
              WHEN quantity_available - ? <= 0 THEN 'RESERVED'
              ELSE status
            END,
            updated_by = ?
          WHERE id = ?
        `,
        [item.quantity, item.quantity, item.quantity, auditContext.actorUserId, item.articleId],
      );
    }

    await connection.execute(
      `
        INSERT INTO order_status_history (
          order_id,
          from_status,
          to_status,
          reason,
          changed_by,
          source
        ) VALUES (?, NULL, 'RESERVED', 'Order created and stock reserved', ?, ?)
      `,
      [orderId, auditContext.actorUserId, auditContext.source],
    );

    if (actor?.userId) {
      await convertActiveCartForUser(actor.userId, connection);
    }

    const order = await getOrderById(orderId, connection);

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: 'ORDER_CREATED',
        entityType: 'orders',
        entityId: orderId,
        afterJson: order,
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return order;
  });
}

export async function listOrders({ filters, pagination }) {
  const {
    q,
    status,
    paymentStatus,
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
    clauses.push('o.order_status = ?');
    params.push(status);
  }

  if (paymentStatus) {
    clauses.push('o.payment_status = ?');
    params.push(paymentStatus);
  }

  if (categoryId) {
    clauses.push(`
      EXISTS (
        SELECT 1
        FROM order_items oi_filter
        INNER JOIN articles a_filter ON a_filter.id = oi_filter.article_id
        WHERE oi_filter.order_id = o.id
          AND a_filter.category_id = ?
      )
    `);
    params.push(categoryId);
  }

  if (brandId) {
    clauses.push(`
      EXISTS (
        SELECT 1
        FROM order_items oi_filter
        INNER JOIN articles a_filter ON a_filter.id = oi_filter.article_id
        WHERE oi_filter.order_id = o.id
          AND a_filter.brand_id = ?
      )
    `);
    params.push(brandId);
  }

  if (q) {
    const like = buildLikeValue(q);
    clauses.push(`(
      o.order_number LIKE ?
      OR o.payment_method LIKE ?
      OR COALESCE(c.first_name, pc.first_name) LIKE ?
      OR COALESCE(c.last_name, pc.last_name) LIKE ?
      OR COALESCE(c.email, pc.email) LIKE ?
      OR EXISTS (
        SELECT 1
        FROM order_items oi_search
        WHERE oi_search.order_id = o.id
          AND (
            oi_search.article_title_snapshot LIKE ?
            OR oi_search.article_slug_snapshot LIKE ?
          )
      )
    )`);
    params.push(like, like, like, like, like, like, like);
  }

  appendDateRangeFilters('o.created_at', { dateFrom, dateTo }, clauses, params);

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const orderBy = resolveSortClause({
    sortBy,
    sortDir,
    sortMap: ORDER_SORTS,
    fallbackKey: 'createdAt',
  });

  const [rows] = await pool.query(
    `
      SELECT
        o.id,
        o.order_number AS orderNumber,
        o.order_status AS orderStatus,
        o.payment_status AS paymentStatus,
        o.payment_method AS paymentMethod,
        o.total_snapshot AS total,
        o.subtotal_snapshot AS subtotal,
        o.discount_total_snapshot AS discountTotal,
        o.shipping_cost_snapshot AS shippingCost,
        o.created_at AS createdAt,
        o.reserved_until AS reservedUntil,
        o.approved_at AS approvedAt,
        o.cancelled_at AS cancelledAt,
        o.shipped_at AS shippedAt,
        COALESCE(c.first_name, pc.first_name) AS customerFirstName,
        COALESCE(c.last_name, pc.last_name) AS customerLastName,
        COALESCE(c.email, pc.email) AS customerEmail,
        (
          SELECT COUNT(*)
          FROM order_items oi
          WHERE oi.order_id = o.id
        ) AS itemCount,
        (
          SELECT oi.image_snapshot
          FROM order_items oi
          WHERE oi.order_id = o.id
          ORDER BY oi.id ASC
          LIMIT 1
        ) AS previewImage,
        (
          SELECT oi.article_title_snapshot
          FROM order_items oi
          WHERE oi.order_id = o.id
          ORDER BY oi.id ASC
          LIMIT 1
        ) AS previewTitle,
        (
          SELECT COUNT(*)
          FROM order_items oi_offer
          WHERE oi_offer.order_id = o.id
            AND oi_offer.accepted_offer_id IS NOT NULL
        ) AS offerCount
      FROM orders o
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
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN potential_customers pc ON pc.id = o.potential_customer_id
      ${where}
    `,
    params,
  );

  return {
    items: rows.map(normalizeOrderListRow),
    pagination: {
      page,
      pageSize,
      total: countRows[0].total,
    },
  };
}

export async function getOrderDetail(id) {
  return getOrderById(id, pool);
}

export async function approveOrder(id, auditContext) {
  return withTransaction(async (connection) => {
    const before = await getOrderById(id, connection);
    if (!['RESERVED', 'PENDING'].includes(before.orderStatus)) {
      throw badRequest('Only reserved or pending orders can be approved');
    }

    await connection.execute(
      `
        UPDATE orders
        SET
          order_status = 'APPROVED',
          approved_at = NOW(),
          updated_by = ?
        WHERE id = ?
      `,
      [auditContext.actorUserId, id],
    );

    const [items] = await connection.execute(
      'SELECT article_id AS articleId, quantity FROM order_items WHERE order_id = ?',
      [id],
    );

    for (const item of items) {
      await connection.execute(
        `
          UPDATE articles
          SET
            quantity_reserved = GREATEST(quantity_reserved - ?, 0),
            quantity_sold = quantity_sold + ?,
            status = CASE
              WHEN quantity_available = 0 AND GREATEST(quantity_reserved - ?, 0) = 0 THEN 'SOLD_OUT'
              WHEN quantity_available > 0 THEN 'ACTIVE'
              ELSE status
            END,
            updated_by = ?
          WHERE id = ?
        `,
        [item.quantity, item.quantity, item.quantity, auditContext.actorUserId, item.articleId],
      );
    }

    await connection.execute(
      `
        INSERT INTO order_status_history (
          order_id,
          from_status,
          to_status,
          reason,
          changed_by,
          source
        ) VALUES (?, ?, 'APPROVED', 'Approved from backoffice', ?, ?)
      `,
      [id, before.orderStatus, auditContext.actorUserId, auditContext.source],
    );

    const after = await getOrderById(id, connection);

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: 'ORDER_APPROVED',
        entityType: 'orders',
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

export async function cancelOrder(id, reason, auditContext) {
  return withTransaction(async (connection) => {
    const before = await getOrderById(id, connection);
    if (!['RESERVED', 'PENDING'].includes(before.orderStatus)) {
      throw badRequest('Only reserved or pending orders can be cancelled in this starter');
    }

    const [items] = await connection.execute(
      'SELECT article_id AS articleId, quantity FROM order_items WHERE order_id = ?',
      [id],
    );

    for (const item of items) {
      await connection.execute(
        `
          UPDATE articles
          SET
            quantity_available = quantity_available + LEAST(quantity_reserved, ?),
            quantity_reserved = quantity_reserved - LEAST(quantity_reserved, ?),
            status = CASE
              WHEN quantity_available + LEAST(quantity_reserved, ?) > 0 THEN 'ACTIVE'
              ELSE status
            END,
            updated_by = ?
          WHERE id = ?
        `,
        [item.quantity, item.quantity, item.quantity, auditContext.actorUserId, item.articleId],
      );
    }

    await connection.execute(
      `
        UPDATE orders
        SET
          order_status = 'CANCELLED',
          cancelled_at = NOW(),
          cancellation_reason = ?,
          updated_by = ?
        WHERE id = ?
      `,
      [reason, auditContext.actorUserId, id],
    );

    await connection.execute(
      `
        INSERT INTO order_status_history (
          order_id,
          from_status,
          to_status,
          reason,
          changed_by,
          source
        ) VALUES (?, ?, 'CANCELLED', ?, ?, ?)
      `,
      [id, before.orderStatus, reason, auditContext.actorUserId, auditContext.source],
    );

    const after = await getOrderById(id, connection);

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: 'ORDER_CANCELLED',
        entityType: 'orders',
        entityId: id,
        beforeJson: before,
        afterJson: after,
        metadataJson: { reason },
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return after;
  });
}

export async function shipOrder(id, auditContext) {
  return withTransaction(async (connection) => {
    const before = await getOrderById(id, connection);
    if (before.orderStatus !== 'APPROVED') {
      throw badRequest('Only approved orders can be marked as shipped');
    }

    await connection.execute(
      `
        UPDATE orders
        SET
          order_status = 'SHIPPED',
          shipped_at = NOW(),
          updated_by = ?
        WHERE id = ?
      `,
      [auditContext.actorUserId, id],
    );

    await connection.execute(
      `
        INSERT INTO order_status_history (
          order_id,
          from_status,
          to_status,
          reason,
          changed_by,
          source
        ) VALUES (?, ?, 'SHIPPED', 'Marked as shipped from backoffice', ?, ?)
      `,
      [id, before.orderStatus, auditContext.actorUserId, auditContext.source],
    );

    const after = await getOrderById(id, connection);

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: 'ORDER_SHIPPED',
        entityType: 'orders',
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

export async function createOrderPayment(id, input, auditContext) {
  return withTransaction(async (connection) => {
    const before = await getOrderById(id, connection);

    if (before.payments.length) {
      throw badRequest('This order already has a registered payment');
    }

    const amount = Number(input.amount ?? before.total);
    const orderPaymentStatus = mapOrderPaymentStatus(input.status);

    const [insertResult] = await connection.execute(
      `
        INSERT INTO payments (
          order_id,
          payment_method,
          provider_name,
          provider_reference,
          amount,
          currency_code,
          status,
          paid_at,
          raw_response_json,
          created_by,
          updated_by
        ) VALUES (?, ?, ?, ?, ?, 'UYU', ?, ${input.status === 'APPROVED' ? 'NOW()' : 'NULL'}, ?, ?, ?)
      `,
      [
        id,
        before.paymentMethod,
        input.providerName || 'Internal admin record',
        input.providerReference || null,
        amount,
        input.status,
        JSON.stringify({ origin: 'admin_manual' }),
        auditContext.actorUserId,
        auditContext.actorUserId,
      ],
    );

    await connection.execute(
      `
        UPDATE orders
        SET
          payment_status = ?,
          updated_by = ?
        WHERE id = ?
      `,
      [orderPaymentStatus, auditContext.actorUserId, id],
    );

    const after = await getOrderById(id, connection);
    const payment = after.payments.find((entry) => entry.id === insertResult.insertId) || null;

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: 'PAYMENT_REGISTERED',
        entityType: 'payments',
        entityId: insertResult.insertId,
        afterJson: payment,
        metadataJson: {
          orderId: id,
          orderNumber: before.orderNumber,
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

async function resolveOrderOwner(input, actor, connection) {
  if (actor?.userId) {
    const customer = await findCustomerByUserId(actor.userId, connection);

    return {
      userId: actor.userId,
      customerId: customer?.id || null,
      potentialCustomerId: null,
    };
  }

  if (!input.guest) {
    throw badRequest('Guest checkout data is required when there is no authenticated user');
  }

  const potentialCustomer = await createPotentialCustomerFromInput(
    input.guest,
    { source: 'CHECKOUT' },
    connection,
  );

  return {
    userId: null,
    customerId: null,
    potentialCustomerId: potentialCustomer.id,
  };
}

async function getShippingMethod(id, connection) {
  const [rows] = await connection.execute(
    `
      SELECT id, description, base_cost AS baseCost
      FROM shipping_methods
      WHERE id = ? AND is_active = 1
      LIMIT 1
    `,
    [id],
  );

  if (!rows.length) {
    throw notFound('Shipping method not found');
  }

  return rows[0];
}

async function getOrderById(id, connection) {
  const [rows] = await connection.execute(
    `
      SELECT
        o.id,
        o.order_number AS orderNumber,
        o.order_status AS orderStatus,
        o.payment_status AS paymentStatus,
        o.payment_method AS paymentMethod,
        o.shipping_method_id AS shippingMethodId,
        o.shipping_method_description_snapshot AS shippingMethodDescription,
        o.shipping_cost_snapshot AS shippingCost,
        o.subtotal_snapshot AS subtotal,
        o.discount_total_snapshot AS discountTotal,
        o.total_snapshot AS total,
        o.reserved_until AS reservedUntil,
        o.approved_at AS approvedAt,
        o.cancelled_at AS cancelledAt,
        o.shipped_at AS shippedAt,
        o.cancellation_reason AS cancellationReason,
        o.internal_notes AS internalNotes,
        o.created_at AS createdAt,
        o.updated_at AS updatedAt,
        COALESCE(c.first_name, pc.first_name) AS customerFirstName,
        COALESCE(c.last_name, pc.last_name) AS customerLastName,
        COALESCE(c.email, pc.email) AS customerEmail,
        COALESCE(c.phone, pc.phone) AS customerPhone,
        COALESCE(c.address, pc.address) AS customerAddress,
        c.id AS customerId,
        pc.id AS potentialCustomerId,
        o.user_id AS userId,
        (
          SELECT COUNT(*)
          FROM order_items oi_offer
          WHERE oi_offer.order_id = o.id
            AND oi_offer.accepted_offer_id IS NOT NULL
        ) AS offerCount
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN potential_customers pc ON pc.id = o.potential_customer_id
      WHERE o.id = ?
      LIMIT 1
    `,
    [id],
  );

  if (!rows.length) {
    throw notFound('Order not found');
  }

  const order = normalizeOrderDetailRow(rows[0]);

  const [itemRows] = await connection.execute(
    `
      SELECT
        id,
        article_id AS articleId,
        quantity,
        article_title_snapshot AS articleTitle,
        article_slug_snapshot AS articleSlug,
        category_name_snapshot AS categoryName,
        brand_name_snapshot AS brandName,
        size_snapshot AS size,
        measurements_snapshot AS measurements,
        image_snapshot AS image,
        sale_price_snapshot AS salePrice,
        discount_type_snapshot AS discountType,
        discount_value_snapshot AS discountValue,
        final_unit_price_snapshot AS finalUnitPrice,
        line_total_snapshot AS lineTotal,
        accepted_offer_id AS acceptedOfferId,
        accepted_offer_price_snapshot AS acceptedOfferPrice,
        accepted_offer_quantity_snapshot AS acceptedOfferQuantity
      FROM order_items
      WHERE order_id = ?
      ORDER BY id ASC
    `,
    [id],
  );

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
      FROM order_status_history
      WHERE order_id = ?
      ORDER BY id ASC
    `,
    [id],
  );

  const [paymentRows] = await connection.execute(
    `
      SELECT
        id,
        payment_method AS paymentMethod,
        provider_name AS providerName,
        provider_reference AS providerReference,
        amount,
        currency_code AS currencyCode,
        status,
        paid_at AS paidAt,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM payments
      WHERE order_id = ?
      ORDER BY id ASC
    `,
    [id],
  );

  order.items = itemRows.map((row) => ({
    ...row,
    salePrice: Number(row.salePrice),
    discountValue: Number(row.discountValue),
    finalUnitPrice: Number(row.finalUnitPrice),
    lineTotal: Number(row.lineTotal),
    acceptedOffer: row.acceptedOfferId ? {
      id: row.acceptedOfferId,
      price: Number(row.acceptedOfferPrice),
      quantity: Number(row.acceptedOfferQuantity || 1),
    } : null,
  }));
  order.history = historyRows;
  order.payments = paymentRows.map((row) => ({
    ...row,
    amount: Number(row.amount),
  }));
  return order;
}

function mapOrderPaymentStatus(paymentStatus) {
  if (paymentStatus === 'APPROVED') return 'PAID';
  if (paymentStatus === 'REFUNDED') return 'REFUNDED';
  if (paymentStatus === 'FAILED' || paymentStatus === 'REJECTED') return 'FAILED';
  return 'PENDING';
}

function normalizeOrderListRow(row) {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    orderStatus: row.orderStatus,
    paymentStatus: row.paymentStatus,
    paymentMethod: row.paymentMethod,
    total: Number(row.total),
    subtotal: Number(row.subtotal),
    discountTotal: Number(row.discountTotal),
    shippingCost: Number(row.shippingCost),
    createdAt: row.createdAt,
    reservedUntil: row.reservedUntil,
    approvedAt: row.approvedAt,
    cancelledAt: row.cancelledAt,
    shippedAt: row.shippedAt,
    itemCount: Number(row.itemCount),
    previewImage: row.previewImage,
    previewTitle: row.previewTitle,
    offerCount: Number(row.offerCount || 0),
    hasOffers: Number(row.offerCount || 0) > 0,
    customer: {
      firstName: row.customerFirstName,
      lastName: row.customerLastName,
      email: row.customerEmail,
    },
  };
}

function normalizeOrderDetailRow(row) {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    orderStatus: row.orderStatus,
    paymentStatus: row.paymentStatus,
    paymentMethod: row.paymentMethod,
    shippingMethodId: row.shippingMethodId,
    shippingMethodDescription: row.shippingMethodDescription,
    shippingCost: Number(row.shippingCost),
    subtotal: Number(row.subtotal),
    discountTotal: Number(row.discountTotal),
    total: Number(row.total),
    reservedUntil: row.reservedUntil,
    approvedAt: row.approvedAt,
    cancelledAt: row.cancelledAt,
    shippedAt: row.shippedAt,
    cancellationReason: row.cancellationReason,
    internalNotes: row.internalNotes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    offerCount: Number(row.offerCount || 0),
    hasOffers: Number(row.offerCount || 0) > 0,
    customer: {
      customerId: row.customerId,
      potentialCustomerId: row.potentialCustomerId,
      userId: row.userId,
      firstName: row.customerFirstName,
      lastName: row.customerLastName,
      email: row.customerEmail,
      phone: row.customerPhone,
      address: row.customerAddress,
    },
    items: [],
    history: [],
    payments: [],
  };
}


async function getAcceptedOfferForOrder(userId, articleId, acceptedOfferId, connection) {
  const [rows] = await connection.execute(
    `
      SELECT
        o.id,
        o.offered_price AS offeredAmount
      FROM offers o
      INNER JOIN customers c ON c.id = o.customer_id
      WHERE c.user_id = ?
        AND o.article_id = ?
        AND o.id = ?
        AND o.status = 'ACCEPTED'
        AND o.consumed_at IS NULL
      LIMIT 1
      FOR UPDATE
    `,
    [userId, articleId, acceptedOfferId],
  );

  if (!rows.length) {
    throw badRequest('La oferta aceptada ya fue usada o no esta disponible.');
  }

  return {
    id: rows[0].id,
    offeredAmount: Number(rows[0].offeredAmount),
  };
}
