import { pool } from '../../db/pool.js';
import { notFound } from '../../utils/app-error.js';

export async function findCustomerByUserId(userId, connection = pool) {
  if (!userId) return null;

  const [rows] = await connection.execute(
    `
      SELECT
        id,
        user_id AS userId,
        first_name AS firstName,
        last_name AS lastName,
        birth_date AS birthDate,
        email,
        address,
        phone,
        instagram
      FROM customers
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 1
    `,
    [userId],
  );

  return rows[0] || null;
}

export async function ensureCustomerForUser(userId, connection = pool) {
  const existing = await findCustomerByUserId(userId, connection);
  if (existing) return existing;

  const [userRows] = await connection.execute(
    `
      SELECT
        id,
        first_name AS firstName,
        last_name AS lastName,
        birth_date AS birthDate,
        email,
        address,
        phone,
        instagram
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [userId],
  );

  if (!userRows.length) {
    throw notFound('User not found');
  }

  const user = userRows[0];

  const [insertResult] = await connection.execute(
    `
      INSERT INTO customers (
        user_id,
        first_name,
        last_name,
        birth_date,
        email,
        address,
        phone,
        instagram,
        source,
        created_by,
        updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'REGISTERED', ?, ?)
    `,
    [
      user.id,
      user.firstName,
      user.lastName,
      user.birthDate || null,
      user.email || null,
      user.address || null,
      user.phone || null,
      user.instagram || null,
      user.id,
      user.id,
    ],
  );

  return {
    id: insertResult.insertId,
    userId: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    birthDate: user.birthDate,
    email: user.email,
    address: user.address,
    phone: user.phone,
    instagram: user.instagram,
  };
}

export async function createPotentialCustomerFromInput(input, options = {}, connection = pool) {
  const [insertResult] = await connection.execute(
    `
      INSERT INTO potential_customers (
        first_name,
        last_name,
        birth_date,
        email,
        address,
        phone,
        instagram,
        source,
        linked_customer_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      input.firstName,
      input.lastName,
      input.birthDate || null,
      input.email || null,
      input.address || null,
      input.phone || null,
      input.instagram || null,
      options.source || 'CHECKOUT',
      options.linkedCustomerId || null,
    ],
  );

  return {
    id: insertResult.insertId,
    ...input,
  };
}
