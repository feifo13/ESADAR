import { pool } from '../../db/pool.js';
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

export async function listPaymentMethods() {
  return PAYMENT_METHODS;
}
