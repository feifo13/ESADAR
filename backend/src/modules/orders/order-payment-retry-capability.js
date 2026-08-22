import crypto from "node:crypto";

import { pool } from "../../db/pool.js";

function clean(value) {
  if (value == null) return "";
  return String(value).trim();
}

export function generateOrderPaymentRetryToken() {
  return crypto
    .randomBytes(32)
    .toString("hex");
}

export function hashOrderPaymentRetryToken(token) {
  const normalized =
    clean(token);

  if (!/^[a-f0-9]{64}$/i.test(normalized)) {
    return "";
  }

  return crypto
    .createHash("sha256")
    .update(normalized)
    .digest("hex");
}

export async function issueOrderPaymentRetryCapability(
  order,
  connection = pool,
) {
  const orderId =
    Number(order?.id || 0);

  if (
    !Number.isInteger(orderId)
    || orderId <= 0
  ) {
    return null;
  }

  const token =
    generateOrderPaymentRetryToken();

  const tokenHash =
    hashOrderPaymentRetryToken(token);

  const [result] =
    await connection.execute(
      `
        INSERT INTO order_payment_retry_capabilities (
          order_id,
          token_hash,
          expires_at
        )
        SELECT
          id,
          ?,
          reserved_until
        FROM orders
        WHERE id = ?
          AND order_status = 'RESERVED'
          AND payment_status = 'PENDING'
          AND payment_method = 'MERCADO_PAGO'
          AND reserved_until IS NOT NULL
          AND reserved_until > NOW()
        ON DUPLICATE KEY UPDATE
          token_hash = VALUES(token_hash),
          expires_at = VALUES(expires_at),
          updated_at = CURRENT_TIMESTAMP
      `,
      [
        tokenHash,
        orderId,
      ],
    );

  if (
    Number(result?.affectedRows || 0)
    < 1
  ) {
    return null;
  }

  return token;
}

export async function authorizeOrderPaymentRetryCapability(
  orderId,
  token,
  connection = pool,
) {
  const normalizedOrderId =
    Number(orderId || 0);

  const tokenHash =
    hashOrderPaymentRetryToken(token);

  if (
    !Number.isInteger(normalizedOrderId)
    || normalizedOrderId <= 0
    || !tokenHash
  ) {
    return null;
  }

  const [rows] =
    await connection.execute(
      `
        SELECT
          oprc.order_id AS orderId,
          oprc.expires_at AS expiresAt
        FROM order_payment_retry_capabilities oprc
        INNER JOIN orders o
          ON o.id = oprc.order_id
        WHERE oprc.order_id = ?
          AND oprc.token_hash = ?
          AND oprc.expires_at > NOW()
          AND o.order_status = 'RESERVED'
          AND o.payment_status = 'PENDING'
          AND o.payment_method = 'MERCADO_PAGO'
          AND o.reserved_until IS NOT NULL
          AND o.reserved_until > NOW()
        LIMIT 1
      `,
      [
        normalizedOrderId,
        tokenHash,
      ],
    );

  return rows?.[0] || null;
}
