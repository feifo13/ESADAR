import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { badRequest, notFound } from '../../utils/app-error.js';
import { logAudit } from '../audit/audit.service.js';
import { findCustomerByUserId } from '../customers/customer-helpers.js';

export async function getCartForUser(userId) {
  const cart = await getOrCreateActiveCartForUser(userId, pool);
  return getCartById(cart.id, pool);
}

export async function addCartItem(userId, input, auditContext) {
  return withTransaction(async (connection) => {
    const cart = await getOrCreateActiveCartForUser(userId, connection);
    const article = await getArticleForCart(input.articleId, connection);

    const [existingRows] = await connection.execute(
      `
        SELECT
          id,
          quantity
        FROM cart_items
        WHERE cart_id = ? AND article_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [cart.id, input.articleId],
    );

    const existing = existingRows[0] || null;
    const nextQuantity = Number(existing?.quantity || 0) + input.quantity;

    ensureCartStock(article, nextQuantity);

    if (existing) {
      await connection.execute(
        `
          UPDATE cart_items
          SET
            quantity = ?,
            unit_price_snapshot = ?,
            discount_type_snapshot = ?,
            discount_value_snapshot = ?,
            final_unit_price_snapshot = ?
          WHERE id = ?
        `,
        [
          nextQuantity,
          article.salePrice,
          article.discountType,
          article.discountValue,
          article.discountedPrice,
          existing.id,
        ],
      );
    } else {
      await connection.execute(
        `
          INSERT INTO cart_items (
            cart_id,
            article_id,
            quantity,
            unit_price_snapshot,
            discount_type_snapshot,
            discount_value_snapshot,
            final_unit_price_snapshot
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          cart.id,
          input.articleId,
          input.quantity,
          article.salePrice,
          article.discountType,
          article.discountValue,
          article.discountedPrice,
        ],
      );
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
          quantity: input.quantity,
          nextQuantity,
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

    ensureCartStock(article, input.quantity);

    await connection.execute(
      `
        UPDATE cart_items
        SET
          quantity = ?,
          unit_price_snapshot = ?,
          discount_type_snapshot = ?,
          discount_value_snapshot = ?,
          final_unit_price_snapshot = ?
        WHERE id = ?
      `,
      [
        input.quantity,
        article.salePrice,
        article.discountType,
        article.discountValue,
        article.discountedPrice,
        itemId,
      ],
    );

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
          quantity: input.quantity,
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
    throw notFound('Cart not found');
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
        a.slug,
        a.title,
        a.quantity_available AS quantityAvailable,
        a.status AS articleStatus,
        b.name AS brandName,
        COALESCE(s.code, a.size_text) AS sizeLabel,
        (
          SELECT ai.file_path
          FROM article_images ai
          WHERE ai.article_id = a.id
          ORDER BY ai.is_primary DESC, ai.sort_order ASC, ai.id ASC
          LIMIT 1
        ) AS image
      FROM cart_items ci
      INNER JOIN articles a ON a.id = ci.article_id
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
    quantity: Number(row.quantity),
    maxQuantity: Math.max(Number(row.quantityAvailable || 0), Number(row.quantity || 0)),
    articleStatus: row.articleStatus,
  }));

  return {
    ...cartRows[0],
    items,
    summary: {
      count: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: items.reduce((sum, item) => sum + item.discountedPrice * item.quantity, 0),
    },
  };
}

async function getArticleForCart(articleId, connection) {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        sale_price AS salePrice,
        discount_type AS discountType,
        discount_value AS discountValue,
        discounted_price AS discountedPrice,
        quantity_available AS quantityAvailable,
        status
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

  if (article.status !== 'ACTIVE') {
    throw badRequest('This article is not available for the cart');
  }

  return {
    ...article,
    salePrice: Number(article.salePrice),
    discountValue: Number(article.discountValue),
    discountedPrice: Number(article.discountedPrice),
    quantityAvailable: Number(article.quantityAvailable),
  };
}

async function getOwnedCartItem(cartId, itemId, connection) {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        article_id AS articleId,
        quantity
      FROM cart_items
      WHERE id = ? AND cart_id = ?
      LIMIT 1
      FOR UPDATE
    `,
    [itemId, cartId],
  );

  if (!rows.length) {
    throw notFound('Cart item not found');
  }

  return rows[0];
}

function ensureCartStock(article, requestedQuantity) {
  if (requestedQuantity > Number(article.quantityAvailable || 0)) {
    throw badRequest('Article does not have enough stock available for the cart');
  }
}
