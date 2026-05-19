import { pool } from '../../db/pool.js';
import { getCollectingSettings } from '../collecting/collecting.service.js';
import { PAYMENT_METHODS } from './lookups.constants.js';

export async function listCategories() {
  const [rows] = await pool.execute(
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
  const [rows] = await pool.execute(
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
  const [rows] = await pool.execute(
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
  const [rows] = await pool.execute(
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
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        description,
        base_cost AS baseCost,
        pricing_type AS pricingType,
        official_rates_label AS officialRatesLabel,
        official_rates_url AS officialRatesUrl,
        official_rates_file_path AS officialRatesFilePath,
        instructions
      FROM shipping_methods
      WHERE is_active = 1
      ORDER BY id ASC
    `,
  );

  const ids = rows.map((row) => Number(row.id)).filter((id) => Number.isInteger(id) && id > 0);
  const ratesByMethod = new Map();

  if (ids.length) {
    const placeholders = ids.map(() => '?').join(', ');
    const [rateRows] = await pool.execute(
      `
        SELECT
          shipping_method_id AS shippingMethodId,
          min_weight_kg AS minWeightKg,
          max_weight_kg AS maxWeightKg,
          price,
          label,
          sort_order AS sortOrder,
          is_active AS isActive
        FROM shipping_method_weight_rates
        WHERE shipping_method_id IN (${placeholders})
          AND is_active = 1
        ORDER BY shipping_method_id ASC, sort_order ASC, min_weight_kg ASC, max_weight_kg ASC, id ASC
      `,
      ids,
    );

    for (const row of rateRows) {
      const methodId = Number(row.shippingMethodId);
      if (!ratesByMethod.has(methodId)) ratesByMethod.set(methodId, []);
      ratesByMethod.get(methodId).push({
        minWeightKg: Number(row.minWeightKg || 0),
        maxWeightKg: Number(row.maxWeightKg || 0),
        price: Number(row.price || 0),
        label: row.label || '',
        sortOrder: Number(row.sortOrder || 0),
        isActive: Boolean(row.isActive),
      });
    }
  }

  return rows.map((row) => ({
    ...row,
    baseCost: Number(row.baseCost),
    pricingType: row.pricingType || 'FIXED',
    officialRatesLabel: row.officialRatesLabel || null,
    officialRatesUrl: row.officialRatesUrl || null,
    officialRatesFilePath: row.officialRatesFilePath || null,
    rates: ratesByMethod.get(Number(row.id)) || [],
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
