import { pool } from '../../db/pool.js';
import { getCollectingSettings } from '../collecting/collecting.service.js';
import { PAYMENT_METHODS } from './lookups.constants.js';

export async function listCategories() {
  const [rows] = await pool.query(
    `
      SELECT
        id,
        name,
        slug,
        description,
        sort_order AS sortOrder
      FROM categories
      WHERE is_active = 1
      ORDER BY COALESCE(sort_order, 999999) ASC, name ASC
    `,
  );

  return rows;
}

export async function listBrands() {
  const [rows] = await pool.query(
    `
      SELECT
        id,
        name,
        slug
      FROM brands
      WHERE is_active = 1
      ORDER BY name ASC
    `,
  );

  return rows;
}

export async function listAvailableArticleBrands() {
  const [rows] = await pool.query(
    `
      SELECT DISTINCT
        b.id,
        b.name,
        b.slug
      FROM brands b
      INNER JOIN articles a ON a.brand_id = b.id
      WHERE
        b.is_active = 1
        AND a.status = 'ACTIVE'
        AND COALESCE(a.quantity_available, 0) > 0
      ORDER BY b.name ASC
    `,
  );

  return rows;
}

export async function listSizes() {
  const [rows] = await pool.query(
    `
      SELECT
        id,
        code,
        description,
        sort_order AS sortOrder
      FROM sizes
      WHERE is_active = 1
      ORDER BY COALESCE(sort_order, 999999) ASC, id ASC
    `,
  );

  return rows;
}

export async function listShippingMethods() {
  const [rows] = await pool.query(
    `
      SELECT
        id,
        description,
        base_cost AS baseCost,
        instructions
      FROM shipping_methods
      WHERE is_active = 1
      ORDER BY id ASC
    `,
  );

  return rows.map((row) => ({
    ...row,
    baseCost: Number(row.baseCost),
  }));
}

function hasText(value) {
  return String(value || '').trim().length > 0;
}

function isPaymentMethodAvailable(method, settings) {
  if (method.id === 'BANK_TRANSFER') {
    return Boolean(settings.isBankTransferEnabled);
  }

  if (method.id === 'MERCADO_PAGO') {
    return Boolean(
      settings.isMercadoPagoEnabled &&
        (hasText(settings.mercadoPagoAccessToken) ||
          hasText(settings.mercadoPagoCheckoutUrl)),
    );
  }

  return false;
}

export async function listPaymentMethods() {
  const settings = await getCollectingSettings();
  return PAYMENT_METHODS.filter((method) =>
    isPaymentMethodAvailable(method, settings),
  );
}
