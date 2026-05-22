import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { badRequest, notFound } from '../../utils/app-error.js';
import { logAudit } from '../audit/audit.service.js';
import { findCustomerByUserId } from '../customers/customer-helpers.js';
import { deriveStockStatus } from '../inventory/inventory.constants.js';

export async function getCartForUser(userId) {
  const cart = await getOrCreateActiveCartForUser(userId, pool);
  return getCartById(cart.id, pool);
}

export async function applyAcceptedOfferToActiveCart(userId, offer, auditContext = {}, connection = pool) {
  if (!userId || !offer?.articleId || !offer?.id) return null;

  const [cartRows] = await connection.execute(
    `
      SELECT id
      FROM carts
      WHERE user_id = ? AND status = 'ACTIVE'
      ORDER BY id DESC
      LIMIT 1
      FOR UPDATE
    `,
    [userId],
  );

  if (!cartRows.length) return null;

  const cartId = cartRows[0].id;
  const [itemRows] = await connection.execute(
    `
      SELECT
        id,
        quantity,
        accepted_offer_id AS acceptedOfferId
      FROM cart_items
      WHERE cart_id = ? AND article_id = ?
      ORDER BY accepted_offer_id IS NULL ASC, id ASC
      FOR UPDATE
    `,
    [cartId, offer.articleId],
  );

  if (!itemRows.length) return null;

  const article = await getArticleSnapshotForCartSync(offer.articleId, connection);
  const acceptedOffer = {
    id: offer.id,
    offeredAmount: Number(offer.offeredAmount),
  };

  const existingOfferLine = itemRows.find(
    (item) => Number(item.acceptedOfferId) === Number(offer.id),
  );

  if (existingOfferLine) {
    await updateCartLineSnapshot(connection, {
      itemId: existingOfferLine.id,
      article,
      quantity: 1,
      acceptedOffer,
    });
  } else {
    const regularLine = itemRows.find((item) => item.acceptedOfferId == null);

    if (!regularLine) return null;

    const regularQuantity = Number(regularLine.quantity || 0);
    if (regularQuantity <= 1) {
      await updateCartLineSnapshot(connection, {
        itemId: regularLine.id,
        article,
        quantity: 1,
        acceptedOffer,
      });
    } else {
      await updateCartLineSnapshot(connection, {
        itemId: regularLine.id,
        article,
        quantity: regularQuantity - 1,
        acceptedOffer: null,
      });
      await insertCartLine(connection, {
        cartId,
        article,
        articleId: offer.articleId,
        quantity: 1,
        acceptedOffer,
      });
    }
  }

  const nextCart = await getCartById(cartId, connection);

  await logAudit(
    {
      actorUserId: auditContext.actorUserId || null,
      actorLabel: auditContext.actorLabel || null,
      actionCode: 'CART_UPDATED',
      entityType: 'carts',
      entityId: cartId,
      afterJson: nextCart,
      metadataJson: {
        operation: 'apply-accepted-offer',
        articleId: offer.articleId,
        acceptedOfferId: offer.id,
      },
      source: auditContext.source || 'SYSTEM',
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    },
    connection,
  );

  return nextCart;
}

export async function addCartItem(userId, input, auditContext) {
  return withTransaction(async (connection) => {
    const cart = await getOrCreateActiveCartForUser(userId, connection);
    const article = await getArticleForCart(input.articleId, connection);
    const acceptedOffer = await getAcceptedOfferForCart(userId, input.articleId, cart.id, connection);

    const [existingRows] = await connection.execute(
      `
        SELECT
          id,
          quantity,
          accepted_offer_id AS acceptedOfferId
        FROM cart_items
        WHERE cart_id = ? AND article_id = ?
        ORDER BY accepted_offer_id IS NULL ASC, id ASC
        FOR UPDATE
      `,
      [cart.id, input.articleId],
    );

    const currentArticleQuantity = existingRows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const requestedQuantity = Math.max(1, Number(input.quantity || 1));
    ensureCartStock(article, currentArticleQuantity + requestedQuantity);

    let remainingQuantity = requestedQuantity;
    let usedAcceptedOfferId = null;

    if (acceptedOffer && remainingQuantity > 0) {
      const existingOfferLine = existingRows.find((row) => Number(row.acceptedOfferId) === Number(acceptedOffer.id));
      if (!existingOfferLine) {
        await insertCartLine(connection, {
          cartId: cart.id,
          article,
          articleId: input.articleId,
          quantity: 1,
          acceptedOffer,
        });
        remainingQuantity -= 1;
        usedAcceptedOfferId = acceptedOffer.id;
      }
    }

    if (remainingQuantity > 0) {
      const regularLine = existingRows.find((row) => row.acceptedOfferId == null);
      if (regularLine) {
        await updateCartLineSnapshot(connection, {
          itemId: regularLine.id,
          article,
          quantity: Number(regularLine.quantity || 0) + remainingQuantity,
          acceptedOffer: null,
        });
      } else {
        await insertCartLine(connection, {
          cartId: cart.id,
          article,
          articleId: input.articleId,
          quantity: remainingQuantity,
          acceptedOffer: null,
        });
      }
    }

    const nextCart = await getCartById(cart.id, connection);

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: 'CART_UPDATED',
        entityType: 'carts',
        entityId: cart.id,
        afterJson: nextCart,
        metadataJson: {
          operation: 'add-item',
          articleId: input.articleId,
          quantity: requestedQuantity,
          acceptedOfferId: usedAcceptedOfferId,
          splitOfferAndRegular: Boolean(usedAcceptedOfferId && remainingQuantity > 0),
        },
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return nextCart;
  });
}

export async function updateCartItem(userId, itemId, input, auditContext) {
  return withTransaction(async (connection) => {
    const cart = await getOrCreateActiveCartForUser(userId, connection);
    const item = await getOwnedCartItem(cart.id, itemId, connection);
    const article = await getArticleForCart(item.articleId, connection);
    const requestedQuantity = Math.max(1, Number(input.quantity || 1));

    const [articleCartRows] = await connection.execute(
      `
        SELECT id, quantity, accepted_offer_id AS acceptedOfferId
        FROM cart_items
        WHERE cart_id = ? AND article_id = ? AND id <> ?
        FOR UPDATE
      `,
      [cart.id, item.articleId, itemId],
    );
    const otherQuantity = articleCartRows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    ensureCartStock(article, otherQuantity + requestedQuantity);

    if (item.acceptedOfferId) {
      await updateCartLineSnapshot(connection, {
        itemId,
        article,
        quantity: 1,
        acceptedOffer: {
          id: item.acceptedOfferId,
          offeredAmount: Number(item.acceptedOfferPrice || 0),
        },
      });

      const extraRegularQuantity = Math.max(requestedQuantity - 1, 0);
      if (extraRegularQuantity > 0) {
        const regularLine = articleCartRows.find((row) => row.acceptedOfferId == null);
        if (regularLine) {
          await updateCartLineSnapshot(connection, {
            itemId: regularLine.id,
            article,
            quantity: Number(regularLine.quantity || 0) + extraRegularQuantity,
            acceptedOffer: null,
          });
        } else {
          await insertCartLine(connection, {
            cartId: cart.id,
            article,
            articleId: item.articleId,
            quantity: extraRegularQuantity,
            acceptedOffer: null,
          });
        }
      }
    } else {
      await updateCartLineSnapshot(connection, {
        itemId,
        article,
        quantity: requestedQuantity,
        acceptedOffer: null,
      });
    }

    const nextCart = await getCartById(cart.id, connection);

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: 'CART_UPDATED',
        entityType: 'carts',
        entityId: cart.id,
        afterJson: nextCart,
        metadataJson: {
          operation: 'update-item',
          itemId,
          articleId: item.articleId,
          quantity: requestedQuantity,
          acceptedOfferId: item.acceptedOfferId || null,
        },
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return nextCart;
  });
}

export async function removeCartItem(userId, itemId, auditContext) {
  return withTransaction(async (connection) => {
    const cart = await getOrCreateActiveCartForUser(userId, connection);
    const item = await getOwnedCartItem(cart.id, itemId, connection);

    await connection.execute('DELETE FROM cart_items WHERE id = ?', [itemId]);

    const nextCart = await getCartById(cart.id, connection);

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: 'CART_UPDATED',
        entityType: 'carts',
        entityId: cart.id,
        afterJson: nextCart,
        metadataJson: {
          operation: 'remove-item',
          itemId,
          articleId: item.articleId,
        },
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return nextCart;
  });
}

export async function clearCart(userId, auditContext) {
  return withTransaction(async (connection) => {
    const cart = await getOrCreateActiveCartForUser(userId, connection);

    await connection.execute('DELETE FROM cart_items WHERE cart_id = ?', [cart.id]);

    const nextCart = await getCartById(cart.id, connection);

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: 'CART_UPDATED',
        entityType: 'carts',
        entityId: cart.id,
        afterJson: nextCart,
        metadataJson: {
          operation: 'clear',
        },
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return nextCart;
  });
}

export async function convertActiveCartForUser(userId, connection = pool) {
  if (!userId) return;

  await connection.execute(
    `
      UPDATE carts
      SET status = 'CONVERTED'
      WHERE user_id = ? AND status = 'ACTIVE'
    `,
    [userId],
  );
}

async function getOrCreateActiveCartForUser(userId, connection) {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        user_id AS userId,
        customer_id AS customerId,
        status
      FROM carts
      WHERE user_id = ? AND status = 'ACTIVE'
      ORDER BY id DESC
      LIMIT 1
    `,
    [userId],
  );

  if (rows.length) {
    return rows[0];
  }

  const customer = await findCustomerByUserId(userId, connection);
  const [insertResult] = await connection.execute(
    `
      INSERT INTO carts (
        user_id,
        customer_id,
        status
      ) VALUES (?, ?, 'ACTIVE')
    `,
    [userId, customer?.id || null],
  );

  return {
    id: insertResult.insertId,
    userId,
    customerId: customer?.id || null,
    status: 'ACTIVE',
  };
}

async function getCartById(cartId, connection) {
  const [cartRows] = await connection.execute(
    `
      SELECT
        id,
        user_id AS userId,
        customer_id AS customerId,
        status,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM carts
      WHERE id = ?
      LIMIT 1
    `,
    [cartId],
  );

  if (!cartRows.length) {
    throw notFound('Carrito no encontrado.');
  }

  const [itemRows] = await connection.execute(
    `
      SELECT
        ci.id,
        ci.article_id AS articleId,
        ci.quantity,
        ci.unit_price_snapshot AS salePrice,
        ci.discount_type_snapshot AS discountType,
        ci.discount_value_snapshot AS discountValue,
        ci.final_unit_price_snapshot AS discountedPrice,
        ci.accepted_offer_id AS acceptedOfferId,
        ci.accepted_offer_price_snapshot AS acceptedOfferPrice,
        ci.accepted_offer_quantity_snapshot AS acceptedOfferQuantity,
        a.slug,
        a.title,
        inv.quantity_available AS quantityAvailable,
        inv.quantity_reserved AS quantityReserved,
        inv.quantity_sold AS quantitySold,
        a.weight_kg AS weightKg,
        a.status AS publicationStatus,
        b.name AS brandName,
        COALESCE(s.code, a.size_text) AS sizeLabel,
        (
          SELECT COALESCE(ai.thumb_file_path, ai.card_file_path, ai.file_path)
          FROM article_images ai
          WHERE ai.article_id = a.id
          ORDER BY ai.is_primary DESC, ai.sort_order ASC, ai.id ASC
          LIMIT 1
        ) AS image
      FROM cart_items ci
      INNER JOIN articles a ON a.id = ci.article_id
      INNER JOIN article_inventory inv ON inv.article_id = a.id
      LEFT JOIN brands b ON b.id = a.brand_id
      LEFT JOIN sizes s ON s.id = a.size_id
      WHERE ci.cart_id = ?
      ORDER BY ci.id ASC
    `,
    [cartId],
  );

  const items = itemRows.map((row) => ({
    id: row.id,
    articleId: row.articleId,
    slug: row.slug,
    title: row.title,
    brandName: row.brandName,
    sizeLabel: row.sizeLabel || '',
    image: row.image || '',
    salePrice: Number(row.salePrice),
    discountType: row.discountType,
    discountValue: Number(row.discountValue),
    discountedPrice: Number(row.discountedPrice),
    weightKg: row.weightKg != null ? Number(row.weightKg) : 0,
    quantity: Number(row.quantity),
    acceptedOffer: row.acceptedOfferId ? {
      id: row.acceptedOfferId,
      price: Number(row.acceptedOfferPrice),
      quantity: Number(row.acceptedOfferQuantity || 1),
    } : null,
    lineTotal: calculateAcceptedOfferLineTotal(row),
    quantityAvailable: Number(row.quantityAvailable || 0),
    maxQuantity: Math.max(Number(row.quantityAvailable || 0), Number(row.quantity || 0)),
    articleStatus: row.publicationStatus === 'ACTIVE' ? deriveStockStatus(row) : 'INACTIVE',
    publicationStatus: row.publicationStatus,
    stockStatus: deriveStockStatus(row),
  }));

  return {
    ...cartRows[0],
    items,
    summary: {
      count: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: items.reduce((sum, item) => sum + Number(item.lineTotal ?? item.discountedPrice * item.quantity), 0),
    },
  };
}

async function getArticleForCart(articleId, connection) {
  const [rows] = await connection.execute(
    `
      SELECT
        a.id,
        a.sale_price AS salePrice,
        a.discount_type AS discountType,
        a.discount_value AS discountValue,
        a.discounted_price AS discountedPrice,
        a.weight_kg AS weightKg,
        inv.quantity_available AS quantityAvailable,
        inv.quantity_reserved AS quantityReserved,
        inv.quantity_sold AS quantitySold,
        a.status AS publicationStatus
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

  if (article.publicationStatus !== 'ACTIVE') {
    throw badRequest('Esta prenda no está disponible para agregar al carrito.');
  }

  return {
    ...article,
    salePrice: Number(article.salePrice),
    discountValue: Number(article.discountValue),
    discountedPrice: Number(article.discountedPrice),
    weightKg: article.weightKg != null ? Number(article.weightKg) : 0,
    quantityAvailable: Number(article.quantityAvailable),
    stockStatus: deriveStockStatus(article),
  };
}

async function getArticleSnapshotForCartSync(articleId, connection) {
  const [rows] = await connection.execute(
    `
      SELECT
        a.id,
        a.sale_price AS salePrice,
        a.discount_type AS discountType,
        a.discount_value AS discountValue,
        a.discounted_price AS discountedPrice,
        a.weight_kg AS weightKg,
        inv.quantity_available AS quantityAvailable,
        inv.quantity_reserved AS quantityReserved,
        inv.quantity_sold AS quantitySold,
        a.status AS publicationStatus
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
  return {
    ...article,
    salePrice: Number(article.salePrice),
    discountValue: Number(article.discountValue),
    discountedPrice: Number(article.discountedPrice),
    weightKg: article.weightKg != null ? Number(article.weightKg) : 0,
    quantityAvailable: Number(article.quantityAvailable),
    stockStatus: deriveStockStatus(article),
  };
}

async function getOwnedCartItem(cartId, itemId, connection) {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        article_id AS articleId,
        quantity,
        accepted_offer_id AS acceptedOfferId,
        accepted_offer_price_snapshot AS acceptedOfferPrice
      FROM cart_items
      WHERE id = ? AND cart_id = ?
      LIMIT 1
      FOR UPDATE
    `,
    [itemId, cartId],
  );

  if (!rows.length) {
    throw notFound('Item de carrito no encontrado.');
  }

  return rows[0];
}

function ensureCartStock(article, requestedQuantity) {
  if (requestedQuantity > Number(article.quantityAvailable || 0)) {
    throw badRequest('No hay stock suficiente para esa prenda.');
  }
}



async function insertCartLine(connection, { cartId, article, articleId, quantity, acceptedOffer }) {
  await connection.execute(
    `
      INSERT INTO cart_items (
        cart_id,
        article_id,
        quantity,
        unit_price_snapshot,
        discount_type_snapshot,
        discount_value_snapshot,
        final_unit_price_snapshot,
        accepted_offer_id,
        accepted_offer_price_snapshot,
        accepted_offer_quantity_snapshot
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      cartId,
      articleId,
      quantity,
      article.salePrice,
      article.discountType,
      article.discountValue,
      article.discountedPrice,
      acceptedOffer?.id || null,
      acceptedOffer?.offeredAmount || null,
      acceptedOffer ? 1 : 0,
    ],
  );
}

async function updateCartLineSnapshot(connection, { itemId, article, quantity, acceptedOffer }) {
  await connection.execute(
    `
      UPDATE cart_items
      SET
        quantity = ?,
        unit_price_snapshot = ?,
        discount_type_snapshot = ?,
        discount_value_snapshot = ?,
        final_unit_price_snapshot = ?,
        accepted_offer_id = ?,
        accepted_offer_price_snapshot = ?,
        accepted_offer_quantity_snapshot = ?
      WHERE id = ?
    `,
    [
      quantity,
      article.salePrice,
      article.discountType,
      article.discountValue,
      article.discountedPrice,
      acceptedOffer?.id || null,
      acceptedOffer?.offeredAmount || null,
      acceptedOffer ? 1 : 0,
      itemId,
    ],
  );
}

async function getAcceptedOfferForCart(userId, articleId, cartId, connection) {
  if (!userId) return null;

  const [rows] = await connection.execute(
    `
      SELECT
        o.id,
        o.offered_price AS offeredAmount
      FROM offers o
      INNER JOIN customers c ON c.id = o.customer_id
      WHERE c.user_id = ?
        AND o.article_id = ?
        AND o.status = 'ACCEPTED'
        AND o.consumed_at IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM cart_items ci
          WHERE ci.cart_id = ?
            AND ci.accepted_offer_id = o.id
        )
      ORDER BY o.accepted_at DESC, o.id DESC
      LIMIT 1
      FOR UPDATE
    `,
    [userId, articleId, cartId],
  );

  if (!rows.length) return null;
  return {
    id: rows[0].id,
    offeredAmount: Number(rows[0].offeredAmount),
  };
}

function calculateAcceptedOfferLineTotal(row) {
  const quantity = Number(row.quantity || 0);
  const basePrice = Number(row.discountedPrice || 0);
  const offerQuantity = Math.min(quantity, Number(row.acceptedOfferQuantity || 0));
  const offerPrice = Number(row.acceptedOfferPrice || 0);
  if (!row.acceptedOfferId || offerQuantity <= 0) {
    return basePrice * quantity;
  }
  return offerPrice * offerQuantity + basePrice * Math.max(quantity - offerQuantity, 0);
}
