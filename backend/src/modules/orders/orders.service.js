import { pool } from "../../db/pool.js";
import { withTransaction } from "../../db/transaction.js";
import { badRequest, notFound } from "../../utils/app-error.js";
import { generateOrderNumber } from "../../utils/order-number.js";
import {
  appendDateRangeFilters,
  buildLikeValue,
  resolveSortClause,
} from "../../utils/listing.js";
import {
  buildSqlLimitOffsetClause,
  buildSqlPlaceholders,
  normalizeSqlLimit,
  normalizeSqlOffset,
} from "../../utils/sql-safety.js";
import { logAudit } from "../audit/audit.service.js";
import {
  confirmSale,
  releaseReservation,
  reserveForOrder,
} from "../inventory/inventory.service.js";
import { convertActiveCartForUser } from "../cart/cart.service.js";
import {
  sendApprovedOrderEmail,
  sendReceivedOrderPendingPaymentEmail,
  sendShippedOrderEmail,
} from "./orders.mailer.js";
import {
  createPotentialCustomerFromInput,
  findCustomerByUserId,
} from "../customers/customer-helpers.js";
import { markUsedOffersConsumedByCancelledOrder } from "../offers/offers.service.js";
import { getCollectingSettings } from "../collecting/collecting.service.js";
import { calculateShippingCost, usesWeightRanges } from "../shipping/shipping-pricing.js";

const ORDER_SORTS = {
  createdAt: (direction) => `o.created_at ${direction}, o.id ${direction}`,
  orderNumber: (direction) => `o.order_number ${direction}, o.id DESC`,
  total: (direction) => `o.total_snapshot ${direction}, o.id DESC`,
  orderStatus: (direction) => `o.order_status ${direction}, o.id DESC`,
  paymentStatus: (direction) => `o.payment_status ${direction}, o.id DESC`,
  customerName: (direction) =>
    `COALESCE(c.last_name, pc.last_name) ${direction}, COALESCE(c.first_name, pc.first_name) ${direction}, o.id DESC`,
};

function parseJsonValue(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function buildOrderItemCostSnapshot(article, quantity, lineTotal) {
  const itemQuantity = Number(quantity || 0);
  const purchasePriceItemSnapshot =
    Number(article.purchasePriceItem || 0) * itemQuantity;
  const purchasePriceShippingSnapshot =
    Number(article.purchasePriceShipping || 0) * itemQuantity;
  const purchasePriceCourierSnapshot =
    Number(article.purchasePriceCourier || 0) * itemQuantity;
  const purchasePriceTotalSnapshot =
    Number(article.purchasePriceTotal || 0) * itemQuantity;

  return {
    purchasePriceItemSnapshot,
    purchasePriceShippingSnapshot,
    purchasePriceCourierSnapshot,
    purchasePriceTotalSnapshot,
    profitSnapshot: Number(lineTotal || 0) - purchasePriceTotalSnapshot,
  };
}

function aggregateOrderItemQuantities(items = []) {
  const quantitiesByArticle = new Map();

  for (const item of items) {
    if (!item.articleId) continue;
    quantitiesByArticle.set(
      Number(item.articleId),
      Number(quantitiesByArticle.get(Number(item.articleId)) || 0) +
        Number(item.quantity || 0),
    );
  }

  return quantitiesByArticle;
}

export async function createOrder(input, actor, auditContext) {
  const order = await withTransaction(async (connection) => {
    const owner = await resolveOrderOwner(input, actor, connection);
    await assertPaymentMethodIsAvailable(input.paymentMethod, connection);
    if (!input.shippingMethodId) {
      throw badRequest(
        "Selecciona un método de envío para confirmar la orden.",
      );
    }
    const shipping = input.shippingMethodId
      ? await getShippingMethod(input.shippingMethodId, connection)
      : null;

    const requestedArticleIds = [
      ...new Set(input.items.map((item) => item.articleId)),
    ];
    const placeholders = buildSqlPlaceholders(requestedArticleIds);
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
          a.purchase_price_item AS purchasePriceItem,
          a.purchase_price_shipping AS purchasePriceShipping,
          a.purchase_price_courier AS purchasePriceCourier,
          a.purchase_price_total AS purchasePriceTotal,
          a.weight_kg AS weightKg,
          inv.quantity_available AS quantityAvailable,
          inv.quantity_reserved AS quantityReserved,
          inv.quantity_sold AS quantitySold,
          a.status AS publicationStatus,
          c.name AS categoryName,
          b.name AS brandName,
          COALESCE(s.code, a.size_text) AS sizeSnapshot,
          (
            SELECT COALESCE(ai.thumb_file_path, ai.card_file_path, ai.file_path)
            FROM article_images ai
            WHERE ai.article_id = a.id
            ORDER BY ai.is_primary DESC, ai.sort_order ASC, ai.id ASC
            LIMIT 1
          ) AS imageSnapshot
        FROM articles a
        INNER JOIN article_inventory inv ON inv.article_id = a.id
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
        Number(requestedQuantityByArticle.get(item.articleId) || 0) +
          Number(item.quantity || 0),
      );
    }

    for (const [articleId, quantity] of requestedQuantityByArticle.entries()) {
      const article = articlesById.get(articleId);
      if (!article) {
        throw notFound(`Articulo ${articleId} no encontrado.`);
      }
      if (article.publicationStatus !== "ACTIVE") {
        throw badRequest(
          `La prenda ${article.id} no está disponible para comprar.`,
        );
      }
      if (Number(article.quantityAvailable) < quantity) {
        throw badRequest(
          `No hay stock suficiente para la prenda ${article.id}.`,
        );
      }
    }

    const orderItems = [];
    let subtotal = 0;
    let discountTotal = 0;

    for (const item of input.items) {
      const article = articlesById.get(item.articleId);
      if (!article) {
        throw notFound(`Articulo ${item.articleId} no encontrado.`);
      }

      const salePrice = Number(article.salePrice);
      const finalUnitPrice = Number(article.discountedPrice);
      const perUnitDiscount = salePrice - finalUnitPrice;
      const acceptedOffer =
        item.acceptedOfferId && owner.userId
          ? await getAcceptedOfferForOrder(
              owner.userId,
              article.id,
              item.acceptedOfferId,
              connection,
            )
          : null;

      const offerQuantity = acceptedOffer
        ? Math.min(1, Number(item.quantity || 1))
        : 0;
      const regularQuantity = Math.max(
        Number(item.quantity || 0) - offerQuantity,
        0,
      );

      if (acceptedOffer && offerQuantity > 0) {
        const acceptedOfferPrice = Number(acceptedOffer.offeredAmount);
        if (acceptedOfferPrice > salePrice) {
          throw badRequest(
            "La oferta aceptada supera el precio publicado actual.",
          );
        }
        const lineTotal = acceptedOfferPrice * offerQuantity;
        const costSnapshot = buildOrderItemCostSnapshot(
          article,
          offerQuantity,
          lineTotal,
        );
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
          finalUnitPriceSnapshot: acceptedOfferPrice,
          lineTotalSnapshot: lineTotal,
          weightKgSnapshot: Number(article.weightKg || 0),
          lineWeightKgSnapshot: Number(article.weightKg || 0) * offerQuantity,
          ...costSnapshot,
          acceptedOfferId: acceptedOffer.id,
          acceptedOfferPriceSnapshot: acceptedOfferPrice,
          acceptedOfferQuantitySnapshot: 1,
        });
      }

      if (regularQuantity > 0) {
        const lineTotal = finalUnitPrice * regularQuantity;
        const costSnapshot = buildOrderItemCostSnapshot(
          article,
          regularQuantity,
          lineTotal,
        );
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
          weightKgSnapshot: Number(article.weightKg || 0),
          lineWeightKgSnapshot: Number(article.weightKg || 0) * regularQuantity,
          ...costSnapshot,
          acceptedOfferId: null,
          acceptedOfferPriceSnapshot: null,
          acceptedOfferQuantitySnapshot: 0,
        });
      }
    }

    const packageWeightKg = Number(
      orderItems.reduce((sum, item) => sum + Number(item.lineWeightKgSnapshot || 0), 0).toFixed(3),
    );
    const shippingQuote = shipping ? calculateShippingCost(shipping, packageWeightKg) : { cost: 0, rate: null };
    if (shipping && usesWeightRanges(shipping.pricingType) && shippingQuote.cost == null) {
      throw badRequest(
        `El método de envío seleccionado no tiene una tarifa configurada para ${packageWeightKg.toFixed(3)} kg.`,
      );
    }
    const shippingCost = Number(shippingQuote.cost || 0);
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
          package_weight_kg_snapshot,
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 'RESERVED', ?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR), ?, ?, ?)
      `,
      [
        orderNumber,
        owner.customerId,
        owner.potentialCustomerId,
        owner.userId,
        shipping?.id || null,
        shipping?.description || null,
        shippingCost,
        packageWeightKg,
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
            weight_kg_snapshot,
            line_weight_kg_snapshot,
            purchase_price_item_snapshot,
            purchase_price_shipping_snapshot,
            purchase_price_courier_snapshot,
            purchase_price_total_snapshot,
            profit_snapshot,
            accepted_offer_id,
            accepted_offer_price_snapshot,
            accepted_offer_quantity_snapshot
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          item.weightKgSnapshot,
          item.lineWeightKgSnapshot,
          item.purchasePriceItemSnapshot,
          item.purchasePriceShippingSnapshot,
          item.purchasePriceCourierSnapshot,
          item.purchasePriceTotalSnapshot,
          item.profitSnapshot,
          item.acceptedOfferId,
          item.acceptedOfferPriceSnapshot,
          item.acceptedOfferQuantitySnapshot,
        ],
      );

      if (item.acceptedOfferId) {
        const [offerUpdateResult] = await connection.execute(
          `
            UPDATE offers
            SET status = 'USED', consumed_at = NOW(), consumed_order_id = ?, updated_by = ?
            WHERE id = ? AND status = 'ACCEPTED' AND consumed_at IS NULL
          `,
          [orderId, auditContext.actorUserId, item.acceptedOfferId],
        );

        if (!offerUpdateResult.affectedRows) {
          throw badRequest(
            "La oferta aceptada ya fue usada o no está disponible.",
          );
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
            ) VALUES (?, 'ACCEPTED', 'USED', 'Oferta usada en una orden', ?, ?)
          `,
          [item.acceptedOfferId, auditContext.actorUserId, auditContext.source],
        );
      }
    }

    for (const [articleId, quantity] of requestedQuantityByArticle.entries()) {
      await reserveForOrder(connection, {
        articleId,
        quantity,
        orderId,
        userId: auditContext.actorUserId || null,
        reason: "Orden creada, stock reservado",
      });
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
        ) VALUES (?, NULL, 'RESERVED', 'Orden creada, stock reservado', ?, ?)
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
        actionCode: "ORDER_CREATED",
        entityType: "orders",
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

  sendReceivedOrderPendingPaymentEmail(order, {
    publicSiteUrl: auditContext.publicSiteUrl,
  }).catch((error) => {
    console.warn(
      "[orders] received order pending payment email failed",
      error?.message || error,
    );
  });

  return order;
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
  const safePageSize = normalizeSqlLimit(pageSize, 25, 100);
  const safeOffset = normalizeSqlOffset(offset);
  const limitOffsetClause = buildSqlLimitOffsetClause(
    safePageSize,
    safeOffset,
    25,
    100,
  );
  const params = [];
  const clauses = [];

  if (status) {
    clauses.push("o.order_status = ?");
    params.push(status);
  }

  if (paymentStatus) {
    clauses.push("o.payment_status = ?");
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

  appendDateRangeFilters("o.created_at", { dateFrom, dateTo }, clauses, params);

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const orderBy = resolveSortClause({
    sortBy,
    sortDir,
    sortMap: ORDER_SORTS,
    fallbackKey: "createdAt",
  });

  const [rows] = await pool.execute(
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
        o.package_weight_kg_snapshot AS packageWeightKg,
        o.created_at AS createdAt,
        o.reserved_until AS reservedUntil,
        o.approved_at AS approvedAt,
        o.cancelled_at AS cancelledAt,
        o.shipped_at AS shippedAt,
        o.tracking_code AS trackingCode,
        COALESCE(c.first_name, pc.first_name) AS customerFirstName,
        COALESCE(c.last_name, pc.last_name) AS customerLastName,
        COALESCE(c.email, pc.email) AS customerEmail,
        (
          SELECT COUNT(*)
          FROM order_items oi
          WHERE oi.order_id = o.id
        ) AS itemCount,
        (
          SELECT COALESCE(SUM(oi.quantity), 0)
          FROM order_items oi
          WHERE oi.order_id = o.id
        ) AS totalQuantity,
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
      ${limitOffsetClause}
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


function normalizeBatchError(error) {
  return error?.message || 'No se pudo procesar el elemento.';
}

export async function batchUpdateOrders(input, auditContext) {
  const actionLabels = {
    APPROVE: 'aprobada',
    CANCEL: 'cancelada',
    SHIP: 'enviada',
  };
  const results = [];

  for (const id of input.ids) {
    try {
      let order;
      if (input.action === 'APPROVE') {
        order = await approveOrder(id, auditContext);
      } else if (input.action === 'CANCEL') {
        order = await cancelOrder(
          id,
          input.reason || 'Orden cancelada en lote por super admin.',
          auditContext,
        );
      } else if (input.action === 'SHIP') {
        order = await shipOrder(id, auditContext);
      } else {
        throw badRequest('Acción de lote no permitida para órdenes.');
      }

      results.push({
        id,
        ok: true,
        status: order.orderStatus,
        orderNumber: order.orderNumber,
        message: `Orden ${actionLabels[input.action] || 'actualizada'}.`,
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

export async function approveOrder(id, auditContext) {
  const order = await withTransaction(async (connection) => {
    await lockOrderForUpdate(id, connection);
    const before = await getOrderById(id, connection);
    if (!["RESERVED", "PENDING"].includes(before.orderStatus)) {
      throw badRequest(
        "Solo se pueden aprobar órdenes reservadas o pendientes.",
      );
    }

    const [orderUpdateResult] = await connection.execute(
      `
        UPDATE orders
        SET
          order_status = 'APPROVED',
          payment_status = 'PAID',
          approved_at = NOW(),
          updated_by = ?
        WHERE id = ?
          AND order_status IN ('RESERVED', 'PENDING')
      `,
      [auditContext.actorUserId, id],
    );

    if (!orderUpdateResult.affectedRows) {
      throw badRequest("La orden ya fue actualizada por otro proceso.");
    }

    const [items] = await connection.execute(
      "SELECT article_id AS articleId, quantity FROM order_items WHERE order_id = ?",
      [id],
    );

    for (const [articleId, quantity] of aggregateOrderItemQuantities(
      items,
    ).entries()) {
      await confirmSale(connection, {
        articleId,
        quantity,
        orderId: id,
        userId: auditContext.actorUserId || null,
        reason: "Aprobada por administración",
      });
    }

    await ensureApprovedPaymentRecordForOrder(connection, before, auditContext);

    await connection.execute(
      `
        INSERT INTO order_status_history (
          order_id,
          from_status,
          to_status,
          reason,
          changed_by,
          source
        ) VALUES (?, ?, 'APPROVED', 'Aprobada por administración', ?, ?)
      `,
      [id, before.orderStatus, auditContext.actorUserId, auditContext.source],
    );

    const after = await getOrderById(id, connection);

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: "ORDER_APPROVED",
        entityType: "orders",
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

  sendApprovedOrderEmail(order, {
    publicSiteUrl: auditContext.publicSiteUrl,
  }).catch((error) => {
    console.warn(
      "[orders] approved order email failed",
      error?.message || error,
    );
  });

  return order;
}

export async function cancelOrder(id, reason, auditContext) {
  return withTransaction(async (connection) => {
    await lockOrderForUpdate(id, connection);
    const before = await getOrderById(id, connection);
    if (!["RESERVED", "PENDING"].includes(before.orderStatus)) {
      throw badRequest(
        "Solo se pueden cancelar órdenes reservadas o pendientes.",
      );
    }

    const [items] = await connection.execute(
      "SELECT article_id AS articleId, quantity FROM order_items WHERE order_id = ?",
      [id],
    );

    for (const [articleId, quantity] of aggregateOrderItemQuantities(
      items,
    ).entries()) {
      await releaseReservation(connection, {
        articleId,
        quantity,
        orderId: id,
        userId: auditContext.actorUserId || null,
        reason: reason || "Orden cancelada",
      });
    }

    const [orderUpdateResult] = await connection.execute(
      `
        UPDATE orders
        SET
          order_status = 'CANCELLED',
          cancelled_at = NOW(),
          cancellation_reason = ?,
          updated_by = ?
        WHERE id = ?
          AND order_status IN ('RESERVED', 'PENDING')
      `,
      [reason, auditContext.actorUserId, id],
    );

    if (!orderUpdateResult.affectedRows) {
      throw badRequest("La orden ya fue actualizada por otro proceso.");
    }

    const consumedOffers = await markUsedOffersConsumedByCancelledOrder(connection, {
      orderId: id,
      auditContext,
      reason: reason || "Orden cancelada; intento de oferta consumido",
    });

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
      [
        id,
        before.orderStatus,
        reason,
        auditContext.actorUserId,
        auditContext.source,
      ],
    );

    const after = await getOrderById(id, connection);

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: "ORDER_CANCELLED",
        entityType: "orders",
        entityId: id,
        beforeJson: before,
        afterJson: after,
        metadataJson: {
          reason,
          consumedOfferAttemptCount: consumedOffers.consumedCount,
          consumedOfferIds: consumedOffers.offerIds,
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

export async function shipOrder(id, auditContext) {
  const order = await withTransaction(async (connection) => {
    const before = await getOrderById(id, connection);
    if (before.orderStatus !== "APPROVED") {
      throw badRequest(
        "Solo se pueden marcar como enviadas las órdenes aprobadas.",
      );
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
        ) VALUES (?, ?, 'SHIPPED', 'Enviada por ESADAR', ?, ?)
      `,
      [id, before.orderStatus, auditContext.actorUserId, auditContext.source],
    );

    const after = await getOrderById(id, connection);

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: "ORDER_SHIPPED",
        entityType: "orders",
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

  sendShippedOrderEmail(order, {
    publicSiteUrl: auditContext.publicSiteUrl,
  }).catch((error) => {
    console.warn(
      "[orders] shipped order email failed",
      error?.message || error,
    );
  });

  return order;
}

export async function updateOrderTrackingCode(id, input, auditContext) {
  return withTransaction(async (connection) => {
    await lockOrderForUpdate(id, connection);
    const before = await getOrderById(id, connection);
    const trackingCode = String(input.trackingCode || '').trim() || null;
    const previousTrackingCode = before.trackingCode || null;

    if (previousTrackingCode === trackingCode) {
      return before;
    }

    await connection.execute(
      `
        UPDATE orders
        SET
          tracking_code = ?,
          updated_by = ?
        WHERE id = ?
      `,
      [trackingCode, auditContext.actorUserId || null, id],
    );

    const shippingMethod =
      before.shippingMethodDescription ||
      before.shippingMethodName ||
      'Sin datos';
    const trackingReason = trackingCode
      ? 'Seguimiento actualizado'
      : 'Seguimiento limpiado';

    await connection.execute(
      `
        INSERT INTO order_status_history (
          event_type,
          order_id,
          from_status,
          to_status,
          reason,
          metadata_json,
          changed_by,
          source
        ) VALUES ('TRACKING_UPDATED', ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        before.orderStatus,
        before.orderStatus,
        trackingReason,
        JSON.stringify({
          trackingCode,
          previousTrackingCode,
          shippingMethod,
        }),
        auditContext.actorUserId || null,
        auditContext.source,
      ],
    );

    const after = await getOrderById(id, connection);

    await logAudit(
      {
        actorUserId: auditContext.actorUserId || null,
        actorLabel: auditContext.actorLabel || null,
        actionCode: 'ORDER_TRACKING_UPDATED',
        entityType: 'orders',
        entityId: id,
        beforeJson: { trackingCode: before.trackingCode || null },
        afterJson: { trackingCode: after.trackingCode || null },
        metadataJson: {
          orderNumber: after.orderNumber,
          cleared: !after.trackingCode,
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

export async function createOrderPayment(id, input, auditContext) {
  return withTransaction(async (connection) => {
    await lockOrderForUpdate(id, connection);
    const before = await getOrderById(id, connection);

    if (!["RESERVED", "PENDING", "APPROVED"].includes(before.orderStatus)) {
      throw badRequest("Solo se pueden registrar pagos en órdenes vigentes.");
    }

    if (before.payments.length) {
      throw badRequest("Esta orden ya tiene un pago registrado.");
    }

    if (input.status === "APPROVED" && before.orderStatus !== "APPROVED") {
      throw badRequest(
        "Primero aprueba la orden para registrar un pago aprobado.",
      );
    }

    const amount = Number(input.amount ?? before.total);
    if (!amountsMatch(amount, before.total)) {
      throw badRequest(
        "El monto del pago debe coincidir con el total de la orden.",
      );
    }

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
        ) VALUES (?, ?, ?, ?, ?, 'UYU', ?, ?, ?, ?, ?)
      `,
      [
        id,
        before.paymentMethod,
        input.providerName || "Internal admin record",
        input.providerReference || null,
        amount,
        input.status,
        input.status === "APPROVED" ? new Date() : null,
        JSON.stringify({ origin: "admin_manual" }),
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
    const payment =
      after.payments.find((entry) => entry.id === insertResult.insertId) ||
      null;

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: "PAYMENT_REGISTERED",
        entityType: "payments",
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

export async function applyMercadoPagoPaymentToOrder(
  payment,
  auditContext = {},
) {
  const result = await withTransaction(async (connection) => {
    const paymentId = cleanProviderReference(payment?.id);
    if (!paymentId) {
      return {
        status: "ignored",
        message: "Notificacion sin payment id.",
        order: null,
        orderId: null,
        shouldSendApprovedEmail: false,
      };
    }

    const orderLookup = getMercadoPagoOrderLookup(payment);
    const orderRow = await findOrderForMercadoPagoPayment(
      orderLookup,
      connection,
    );
    if (!orderRow) {
      return {
        status: "ignored",
        message: "No se encontro una orden asociada al pago de Mercado Pago.",
        order: null,
        orderId: null,
        shouldSendApprovedEmail: false,
      };
    }

    const before = await getOrderById(orderRow.id, connection);
    if (before.paymentMethod !== "MERCADO_PAGO") {
      return {
        status: "ignored",
        message: "La orden asociada no usa Mercado Pago como método de pago.",
        order: before,
        orderId: before.id,
        shouldSendApprovedEmail: false,
      };
    }

    const mappedPaymentStatus = mapMercadoPagoPaymentStatus(payment?.status);
    const paymentAmount = getMercadoPagoPaymentAmount(payment);
    const amountMatches = amountsMatch(paymentAmount, before.total);
    const paidAt = getMercadoPagoPaidAt(payment, mappedPaymentStatus);

    await upsertMercadoPagoPayment(connection, {
      orderId: before.id,
      payment,
      paymentId,
      amount: paymentAmount,
      currencyCode: payment?.currency_id || "UYU",
      status: mappedPaymentStatus,
      paidAt,
    });

    let status = "processed";
    let message = `Pago Mercado Pago ${paymentId} registrado.`;
    let shouldSendApprovedEmail = false;

    if (mappedPaymentStatus === "APPROVED") {
      if (!amountMatches) {
        status = "failed";
        message =
          "Pago aprobado con monto distinto al total de la orden. Requiere revision manual.";

        await logAudit(
          {
            actorUserId: auditContext.actorUserId || null,
            actorLabel: auditContext.actorLabel || null,
            actionCode: "MERCADO_PAGO_AMOUNT_MISMATCH",
            entityType: "orders",
            entityId: before.id,
            beforeJson: {
              total: before.total,
              paymentStatus: before.paymentStatus,
            },
            afterJson: {
              mercadoPagoAmount: paymentAmount,
              mercadoPagoStatus: payment?.status,
            },
            metadataJson: {
              paymentId,
              externalReference: payment?.external_reference || null,
            },
            source: auditContext.source || "API",
            ipAddress: auditContext.ipAddress || null,
            userAgent: auditContext.userAgent || null,
          },
          connection,
        );
      } else if (["RESERVED", "PENDING"].includes(before.orderStatus)) {
        const [items] = await connection.execute(
          "SELECT article_id AS articleId, quantity FROM order_items WHERE order_id = ?",
          [before.id],
        );

        for (const [articleId, quantity] of aggregateOrderItemQuantities(
          items,
        ).entries()) {
          await confirmSale(connection, {
            articleId,
            quantity,
            orderId: before.id,
            userId: auditContext.actorUserId || null,
            reason: "Pago aprobado automáticamente por Mercado Pago",
          });
        }

        const [orderUpdateResult] = await connection.execute(
          `
            UPDATE orders
            SET
              order_status = 'APPROVED',
              payment_status = 'PAID',
              approved_at = COALESCE(approved_at, NOW()),
              updated_by = NULL
            WHERE id = ?
              AND order_status IN ('RESERVED', 'PENDING')
          `,
          [before.id],
        );

        if (!orderUpdateResult.affectedRows) {
          status = "ignored";
          message = "La orden ya fue actualizada por otro proceso.";
        } else {
          await connection.execute(
            `
              INSERT INTO order_status_history (
                order_id,
                from_status,
                to_status,
                reason,
                changed_by,
                source
              ) VALUES (?, ?, 'APPROVED', 'Pago aprobado automáticamente por Mercado Pago', NULL, ?)
            `,
            [before.id, before.orderStatus, auditContext.source || "API"],
          );

          await logAudit(
            {
              actorUserId: null,
              actorLabel: "Mercado Pago webhook",
              actionCode: "ORDER_APPROVED_BY_MERCADO_PAGO",
              entityType: "orders",
              entityId: before.id,
              beforeJson: before,
              afterJson: {
                orderStatus: "APPROVED",
                paymentStatus: "PAID",
                paymentId,
              },
              source: auditContext.source || "API",
              ipAddress: auditContext.ipAddress || null,
              userAgent: auditContext.userAgent || null,
            },
            connection,
          );

          shouldSendApprovedEmail = true;
          message = "Pago aprobado y orden aprobada automáticamente.";
        }
      } else {
        await connection.execute(
          `
            UPDATE orders
            SET payment_status = 'PAID', updated_by = NULL
            WHERE id = ?
          `,
          [before.id],
        );

        message = `Pago aprobado registrado sobre orden en estado ${before.orderStatus}.`;
      }
    } else if (mappedPaymentStatus === "REFUNDED") {
      await connection.execute(
        `
          UPDATE orders
          SET payment_status = 'REFUNDED', updated_by = NULL
          WHERE id = ?
        `,
        [before.id],
      );
      message = "Pago Mercado Pago marcado como reembolsado.";
    } else if (
      mappedPaymentStatus === "REJECTED" ||
      mappedPaymentStatus === "FAILED"
    ) {
      if (!["PAID", "REFUNDED"].includes(before.paymentStatus)) {
        await connection.execute(
          `
            UPDATE orders
            SET payment_status = 'FAILED', updated_by = NULL
            WHERE id = ?
          `,
          [before.id],
        );
      }
      message = "Pago Mercado Pago rechazado/fallido registrado.";
    } else if (mappedPaymentStatus === "PENDING") {
      if (!["PAID", "REFUNDED"].includes(before.paymentStatus)) {
        await connection.execute(
          `
            UPDATE orders
            SET payment_status = 'PENDING', updated_by = NULL
            WHERE id = ?
          `,
          [before.id],
        );
      }
      message = "Pago Mercado Pago pendiente registrado.";
    }

    const after = await getOrderById(before.id, connection);

    await logAudit(
      {
        actorUserId: null,
        actorLabel: "Mercado Pago webhook",
        actionCode: "MERCADO_PAGO_PAYMENT_SYNCED",
        entityType: "orders",
        entityId: before.id,
        beforeJson: {
          orderStatus: before.orderStatus,
          paymentStatus: before.paymentStatus,
        },
        afterJson: {
          orderStatus: after.orderStatus,
          paymentStatus: after.paymentStatus,
          mercadoPagoStatus: payment?.status || null,
          mercadoPagoPaymentStatus: mappedPaymentStatus,
        },
        metadataJson: {
          paymentId,
          amount: paymentAmount,
          amountMatches,
          externalReference: payment?.external_reference || null,
        },
        source: auditContext.source || "API",
        ipAddress: auditContext.ipAddress || null,
        userAgent: auditContext.userAgent || null,
      },
      connection,
    );

    return {
      status,
      message,
      order: after,
      orderId: after.id,
      shouldSendApprovedEmail,
    };
  });

  if (result.shouldSendApprovedEmail && result.order) {
    sendApprovedOrderEmail(result.order, {
      publicSiteUrl: auditContext.publicSiteUrl,
    }).catch((error) => {
      console.warn(
        "[orders] approved order email after Mercado Pago webhook failed",
        error?.message || error,
      );
    });
  }

  return result;
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
    throw badRequest(
      "Necesitamos los datos del comprador para confirmar la orden.",
    );
  }

  const potentialCustomer = await createPotentialCustomerFromInput(
    input.guest,
    { source: "CHECKOUT" },
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
      SELECT
        id,
        description,
        base_cost AS baseCost,
        pricing_type AS pricingType
      FROM shipping_methods
      WHERE id = ? AND is_active = 1
      LIMIT 1
    `,
    [id],
  );

  if (!rows.length) {
    throw notFound("Método de envío no encontrado o no disponible.");
  }

  const method = {
    ...rows[0],
    baseCost: Number(rows[0].baseCost || 0),
    pricingType: rows[0].pricingType || 'FIXED',
    rates: [],
  };

  const [rateRows] = await connection.execute(
    `
      SELECT
        id,
        min_weight_kg AS minWeightKg,
        max_weight_kg AS maxWeightKg,
        price,
        label,
        sort_order AS sortOrder,
        is_active AS isActive
      FROM shipping_method_weight_rates
      WHERE shipping_method_id = ?
        AND is_active = 1
      ORDER BY sort_order ASC, min_weight_kg ASC, max_weight_kg ASC, id ASC
    `,
    [id],
  );

  method.rates = rateRows.map((row) => ({
    id: row.id,
    minWeightKg: Number(row.minWeightKg || 0),
    maxWeightKg: Number(row.maxWeightKg || 0),
    price: Number(row.price || 0),
    label: row.label || '',
    sortOrder: Number(row.sortOrder || 0),
    isActive: Boolean(row.isActive),
  }));

  return method;
}

async function lockOrderForUpdate(id, connection) {
  const [rows] = await connection.execute(
    `
      SELECT id
      FROM orders
      WHERE id = ?
      LIMIT 1
      FOR UPDATE
    `,
    [id],
  );

  if (!rows.length) {
    throw notFound("Orden no encontrada.");
  }
}

function amountsMatch(a, b) {
  return Math.round(Number(a || 0) * 100) === Math.round(Number(b || 0) * 100);
}

function hasText(value) {
  return String(value || "").trim().length > 0;
}

async function assertPaymentMethodIsAvailable(paymentMethod, connection) {
  const settings = await getCollectingSettings(connection);

  if (paymentMethod === "BANK_TRANSFER" && settings.isBankTransferEnabled) {
    return;
  }

  if (
    paymentMethod === "MERCADO_PAGO" &&
    settings.isMercadoPagoEnabled &&
    (hasText(settings.mercadoPagoAccessToken) ||
      hasText(settings.mercadoPagoCheckoutUrl))
  ) {
    return;
  }

  throw badRequest(
    "El medio de pago seleccionado no está disponible. Actualizá el checkout e intentalo nuevamente.",
  );
}

async function ensureApprovedPaymentRecordForOrder(
  connection,
  order,
  auditContext = {},
) {
  if (!order || amountsMatch(0, order.total)) return null;

  const approvedPayment = order.payments.find(
    (payment) =>
      payment.status === "APPROVED" &&
      amountsMatch(payment.amount, order.total),
  );
  if (approvedPayment) return approvedPayment.id;

  const pendingPayment = order.payments.find(
    (payment) =>
      payment.status === "PENDING" && amountsMatch(payment.amount, order.total),
  );

  if (pendingPayment) {
    await connection.execute(
      `
        UPDATE payments
        SET
          status = 'APPROVED',
          paid_at = COALESCE(paid_at, NOW()),
          provider_name = COALESCE(provider_name, 'Admin manual approval'),
          raw_response_json = COALESCE(raw_response_json, ?),
          updated_by = ?
        WHERE id = ?
      `,
      [
        JSON.stringify({ origin: "admin_manual_approval" }),
        auditContext.actorUserId || null,
        pendingPayment.id,
      ],
    );

    await logAudit(
      {
        actorUserId: auditContext.actorUserId || null,
        actorLabel: auditContext.actorLabel || null,
        actionCode: "PAYMENT_APPROVED_BY_ADMIN",
        entityType: "payments",
        entityId: pendingPayment.id,
        beforeJson: pendingPayment,
        afterJson: {
          ...pendingPayment,
          status: "APPROVED",
          paidAt: new Date().toISOString(),
        },
        metadataJson: {
          orderId: order.id,
          orderNumber: order.orderNumber,
        },
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return pendingPayment.id;
  }

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
      ) VALUES (?, ?, 'Admin manual approval', NULL, ?, 'UYU', 'APPROVED', NOW(), ?, ?, ?)
    `,
    [
      order.id,
      order.paymentMethod,
      Number(order.total || 0),
      JSON.stringify({ origin: "admin_manual_approval" }),
      auditContext.actorUserId || null,
      auditContext.actorUserId || null,
    ],
  );

  await logAudit(
    {
      actorUserId: auditContext.actorUserId || null,
      actorLabel: auditContext.actorLabel || null,
      actionCode: "PAYMENT_APPROVED_BY_ADMIN",
      entityType: "payments",
      entityId: insertResult.insertId,
      afterJson: {
        orderId: order.id,
        paymentMethod: order.paymentMethod,
        providerName: "Admin manual approval",
        amount: Number(order.total || 0),
        currencyCode: "UYU",
        status: "APPROVED",
      },
      metadataJson: {
        orderId: order.id,
        orderNumber: order.orderNumber,
      },
      source: auditContext.source,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    },
    connection,
  );

  return insertResult.insertId;
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
        o.package_weight_kg_snapshot AS packageWeightKg,
        o.subtotal_snapshot AS subtotal,
        o.discount_total_snapshot AS discountTotal,
        o.total_snapshot AS total,
        o.reserved_until AS reservedUntil,
        o.approved_at AS approvedAt,
        o.cancelled_at AS cancelledAt,
        o.shipped_at AS shippedAt,
        o.cancellation_reason AS cancellationReason,
        o.internal_notes AS internalNotes,
        o.tracking_code AS trackingCode,
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
    throw notFound("Orden no encontrada.");
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
        weight_kg_snapshot AS weightKgSnapshot,
        line_weight_kg_snapshot AS lineWeightKgSnapshot,
        purchase_price_item_snapshot AS purchasePriceItemSnapshot,
        purchase_price_shipping_snapshot AS purchasePriceShippingSnapshot,
        purchase_price_courier_snapshot AS purchasePriceCourierSnapshot,
        purchase_price_total_snapshot AS purchasePriceTotalSnapshot,
        profit_snapshot AS profitSnapshot,
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
        osh.id,
        osh.event_type AS eventType,
        osh.from_status AS fromStatus,
        osh.to_status AS toStatus,
        osh.reason,
        osh.metadata_json AS metadataJson,
        osh.changed_at AS changedAt,
        osh.changed_by AS changedBy,
        osh.source,
        CONCAT_WS(' ', u.first_name, u.last_name) AS changedByName
      FROM order_status_history
      osh
      LEFT JOIN users u ON u.id = osh.changed_by
      WHERE osh.order_id = ?
      ORDER BY osh.id ASC
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
    weightKgSnapshot: row.weightKgSnapshot != null ? Number(row.weightKgSnapshot) : 0,
    lineWeightKgSnapshot: row.lineWeightKgSnapshot != null ? Number(row.lineWeightKgSnapshot) : 0,
    purchasePriceItemSnapshot:
      row.purchasePriceItemSnapshot != null
        ? Number(row.purchasePriceItemSnapshot)
        : null,
    purchasePriceShippingSnapshot:
      row.purchasePriceShippingSnapshot != null
        ? Number(row.purchasePriceShippingSnapshot)
        : null,
    purchasePriceCourierSnapshot:
      row.purchasePriceCourierSnapshot != null
        ? Number(row.purchasePriceCourierSnapshot)
        : null,
    purchasePriceTotalSnapshot:
      row.purchasePriceTotalSnapshot != null
        ? Number(row.purchasePriceTotalSnapshot)
        : null,
    profitSnapshot:
      row.profitSnapshot != null ? Number(row.profitSnapshot) : null,
    acceptedOffer: row.acceptedOfferId
      ? {
          id: row.acceptedOfferId,
          price: Number(row.acceptedOfferPrice),
          quantity: Number(row.acceptedOfferQuantity || 1),
        }
      : null,
  }));
  order.history = historyRows.map((row) => ({
    ...row,
    eventType: row.eventType || 'STATUS_CHANGE',
    metadataJson: parseJsonValue(row.metadataJson),
  }));
  order.payments = paymentRows.map((row) => ({
    ...row,
    amount: Number(row.amount),
  }));
  return order;
}

function cleanProviderReference(value) {
  if (value == null) return "";
  return String(value).trim();
}

function toMysqlDateTime(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function getMercadoPagoOrderLookup(payment = {}) {
  const metadata =
    payment.metadata && typeof payment.metadata === "object"
      ? payment.metadata
      : {};
  const rawOrderId = metadata.order_id ?? metadata.orderId ?? null;
  const numericOrderId = Number(rawOrderId);
  const orderId =
    Number.isInteger(numericOrderId) && numericOrderId > 0
      ? numericOrderId
      : null;
  const orderNumber = cleanProviderReference(
    metadata.order_number ||
      metadata.orderNumber ||
      payment.external_reference ||
      "",
  );

  return { orderId, orderNumber };
}

async function findOrderForMercadoPagoPayment(
  { orderId, orderNumber },
  connection,
) {
  if (!orderId && !orderNumber) return null;

  const clauses = [];
  const params = [];

  if (orderId) {
    clauses.push("id = ?");
    params.push(orderId);
  }

  if (orderNumber) {
    clauses.push("order_number = ?");
    params.push(orderNumber);
  }

  const [rows] = await connection.execute(
    `
      SELECT id
      FROM orders
      WHERE ${clauses.join(" OR ")}
      ORDER BY id DESC
      LIMIT 1
      FOR UPDATE
    `,
    params,
  );

  return rows[0] || null;
}

function getMercadoPagoPaymentAmount(payment = {}) {
  const candidates = [
    payment.transaction_amount,
    payment.transaction_details?.total_paid_amount,
    payment.transaction_details?.net_received_amount,
  ];

  for (const candidate of candidates) {
    const amount = Number(candidate);
    if (Number.isFinite(amount) && amount > 0) return Number(amount.toFixed(2));
  }

  return 0;
}

function getMercadoPagoPaidAt(payment = {}, mappedPaymentStatus) {
  if (mappedPaymentStatus !== "APPROVED") return null;
  return toMysqlDateTime(
    payment.date_approved ||
      payment.money_release_date ||
      payment.date_last_updated ||
      new Date(),
  );
}

function mapMercadoPagoPaymentStatus(status) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();

  if (normalized === "approved" || normalized === "accredited")
    return "APPROVED";
  if (normalized === "refunded" || normalized === "charged_back")
    return "REFUNDED";
  if (["rejected", "cancelled", "canceled"].includes(normalized))
    return "REJECTED";
  if (
    ["pending", "in_process", "authorized", "in_mediation"].includes(normalized)
  )
    return "PENDING";
  return "PENDING";
}

async function upsertMercadoPagoPayment(
  connection,
  { orderId, payment, paymentId, amount, currencyCode, status, paidAt },
) {
  const rawJson = JSON.stringify(payment || {});
  const [existingRows] = await connection.execute(
    `
      SELECT id
      FROM payments
      WHERE provider_name = 'Mercado Pago'
        AND provider_reference = ?
      LIMIT 1
      FOR UPDATE
    `,
    [paymentId],
  );

  if (existingRows.length) {
    await connection.execute(
      `
        UPDATE payments
        SET
          order_id = ?,
          payment_method = 'MERCADO_PAGO',
          amount = ?,
          currency_code = ?,
          status = ?,
          paid_at = CASE WHEN ? IS NOT NULL THEN ? ELSE paid_at END,
          raw_response_json = ?,
          updated_by = NULL
        WHERE id = ?
      `,
      [
        orderId,
        amount,
        currencyCode || "UYU",
        status,
        paidAt,
        paidAt,
        rawJson,
        existingRows[0].id,
      ],
    );
    return existingRows[0].id;
  }

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
      ) VALUES (?, 'MERCADO_PAGO', 'Mercado Pago', ?, ?, ?, ?, ?, ?, NULL, NULL)
    `,
    [
      orderId,
      paymentId,
      amount,
      currencyCode || "UYU",
      status,
      paidAt,
      rawJson,
    ],
  );

  return insertResult.insertId;
}

function mapOrderPaymentStatus(paymentStatus) {
  if (paymentStatus === "APPROVED") return "PAID";
  if (paymentStatus === "REFUNDED") return "REFUNDED";
  if (paymentStatus === "FAILED" || paymentStatus === "REJECTED")
    return "FAILED";
  return "PENDING";
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
    packageWeightKg: row.packageWeightKg != null ? Number(row.packageWeightKg) : 0,
    createdAt: row.createdAt,
    reservedUntil: row.reservedUntil,
    approvedAt: row.approvedAt,
    cancelledAt: row.cancelledAt,
    shippedAt: row.shippedAt,
    trackingCode: row.trackingCode || null,
    itemCount: Number(row.itemCount),
    totalQuantity: Number(row.totalQuantity || 0),
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
    packageWeightKg: row.packageWeightKg != null ? Number(row.packageWeightKg) : 0,
    subtotal: Number(row.subtotal),
    discountTotal: Number(row.discountTotal),
    total: Number(row.total),
    reservedUntil: row.reservedUntil,
    approvedAt: row.approvedAt,
    cancelledAt: row.cancelledAt,
    shippedAt: row.shippedAt,
    trackingCode: row.trackingCode || null,
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

async function getAcceptedOfferForOrder(
  userId,
  articleId,
  acceptedOfferId,
  connection,
) {
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
    throw badRequest("La oferta aceptada ya fue usada o no está disponible.");
  }

  return {
    id: rows[0].id,
    offeredAmount: Number(rows[0].offeredAmount),
  };
}
