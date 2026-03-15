import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { badRequest, notFound } from '../../utils/app-error.js';
import { generateOrderNumber } from '../../utils/order-number.js';
import { logAudit } from '../audit/audit.service.js';

export async function createOrder(input, actor, auditContext) {
  return withTransaction(async (connection) => {
    const owner = await resolveOrderOwner(input, actor, connection);
    const shipping = input.shippingMethodId
      ? await getShippingMethod(input.shippingMethodId, connection)
      : null;

    const requestedArticleIds = input.items.map((item) => item.articleId);
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

    const orderItems = [];
    let subtotal = 0;
    let discountTotal = 0;

    for (const item of input.items) {
      const article = articlesById.get(item.articleId);
      if (!article) {
        throw notFound(`Article ${item.articleId} not found`);
      }

      if (article.status !== 'ACTIVE') {
        throw badRequest(`Article ${article.id} is not available for purchase`);
      }

      if (Number(article.quantityAvailable) < item.quantity) {
        throw badRequest(`Article ${article.id} does not have enough stock available`);
      }

      const salePrice = Number(article.salePrice);
      const finalUnitPrice = Number(article.discountedPrice);
      const perUnitDiscount = salePrice - finalUnitPrice;
      const lineTotal = finalUnitPrice * item.quantity;

      subtotal += salePrice * item.quantity;
      discountTotal += perUnitDiscount * item.quantity;

      orderItems.push({
        articleId: article.id,
        quantity: item.quantity,
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
      });
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
            line_total_snapshot
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        ],
      );

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

export async function listOrders({ page, pageSize, offset, status }) {
  const params = [];
  let where = '';
  if (status) {
    where = 'WHERE o.order_status = ?';
    params.push(status);
  }

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
        ) AS previewTitle
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN potential_customers pc ON pc.id = o.potential_customer_id
      ${where}
      ORDER BY o.id DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `,
    params,
  );

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM orders o ${where}`,
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
            quantity_available = quantity_available + ?,
            quantity_reserved = GREATEST(quantity_reserved - ?, 0),
            status = CASE
              WHEN quantity_available + ? > 0 THEN 'ACTIVE'
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

async function resolveOrderOwner(input, actor, connection) {
  if (actor?.userId) {
    const [customerRows] = await connection.execute(
      'SELECT id FROM customers WHERE user_id = ? LIMIT 1',
      [actor.userId],
    );

    return {
      userId: actor.userId,
      customerId: customerRows[0]?.id || null,
      potentialCustomerId: null,
    };
  }

  if (!input.guest) {
    throw badRequest('Guest checkout data is required when there is no authenticated user');
  }

  const [potentialInsert] = await connection.execute(
    `
      INSERT INTO potential_customers (
        first_name,
        last_name,
        birth_date,
        email,
        address,
        phone,
        instagram,
        source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'CHECKOUT')
    `,
    [
      input.guest.firstName,
      input.guest.lastName,
      input.guest.birthDate || null,
      input.guest.email || null,
      input.guest.address || null,
      input.guest.phone || null,
      input.guest.instagram || null,
    ],
  );

  return {
    userId: null,
    customerId: null,
    potentialCustomerId: potentialInsert.insertId,
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
        o.user_id AS userId
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
        line_total_snapshot AS lineTotal
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

  order.items = itemRows.map((row) => ({
    ...row,
    salePrice: Number(row.salePrice),
    discountValue: Number(row.discountValue),
    finalUnitPrice: Number(row.finalUnitPrice),
    lineTotal: Number(row.lineTotal),
  }));
  order.history = historyRows;
  return order;
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
  };
}
