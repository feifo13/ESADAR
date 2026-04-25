import { pool } from '../../db/pool.js';
import { badRequest, notFound } from '../../utils/app-error.js';

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
        instagram,
        preferred_payment_method AS preferredPaymentMethod,
        preferred_shipping_method_id AS preferredShippingMethodId
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
        preferredPaymentMethod: null,
        preferredShippingMethodId: null,
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

export async function findPotentialCustomerByContact(input, connection = pool) {
  const clauses = [];
  const params = [];

  if (input?.email) {
    clauses.push('email = ?');
    params.push(input.email);
  }

  if (input?.phone) {
    clauses.push('phone = ?');
    params.push(input.phone);
  }

  if (input?.instagram) {
    clauses.push('instagram = ?');
    params.push(input.instagram);
  }

  if (!clauses.length) {
    return null;
  }

  const [rows] = await connection.execute(
    `
      SELECT
        id,
        first_name AS firstName,
        last_name AS lastName,
        birth_date AS birthDate,
        email,
        address,
        phone,
        instagram,
        source,
        lead_status AS leadStatus,
        admin_notes AS adminNotes,
        linked_customer_id AS linkedCustomerId
      FROM potential_customers
      WHERE ${clauses.map((clause) => `(${clause})`).join(' OR ')}
      ORDER BY id DESC
      LIMIT 1
    `,
    params,
  );

  return rows[0] || null;
}

export async function upsertPotentialCustomerByContact(input, options = {}, connection = pool) {
  if (!input?.email && !input?.phone && !input?.instagram) {
    throw badRequest('At least one contact field is required');
  }

  const existing = await findPotentialCustomerByContact(input, connection);
  if (!existing) {
    const created = await createPotentialCustomerFromInput(input, options, connection);
    return {
      ...created,
      source: options.source || 'MANUAL',
      leadStatus: options.leadStatus || 'NEW',
      adminNotes: options.adminNotes || null,
    };
  }

  await connection.execute(
    `
      UPDATE potential_customers
      SET
        first_name = ?,
        last_name = ?,
        birth_date = ?,
        email = ?,
        address = ?,
        phone = ?,
        instagram = ?,
        source = ?,
        lead_status = ?,
        admin_notes = ?
      WHERE id = ?
    `,
    [
      input.firstName || existing.firstName,
      input.lastName || existing.lastName,
      input.birthDate || existing.birthDate || null,
      input.email || existing.email || null,
      input.address || existing.address || null,
      input.phone || existing.phone || null,
      input.instagram || existing.instagram || null,
      options.source || existing.source || 'MANUAL',
      options.leadStatus || existing.leadStatus || 'NEW',
      options.adminNotes ?? existing.adminNotes ?? null,
      existing.id,
    ],
  );

  return {
    ...existing,
    firstName: input.firstName || existing.firstName,
    lastName: input.lastName || existing.lastName,
    birthDate: input.birthDate || existing.birthDate || null,
    email: input.email || existing.email || null,
    address: input.address || existing.address || null,
    phone: input.phone || existing.phone || null,
    instagram: input.instagram || existing.instagram || null,
    source: options.source || existing.source || 'MANUAL',
    leadStatus: options.leadStatus || existing.leadStatus || 'NEW',
    adminNotes: options.adminNotes ?? existing.adminNotes ?? null,
  };
}

export async function findPotentialCustomerByLinkedCustomerId(customerId, connection = pool) {
  if (!customerId) return null;

  const [rows] = await connection.execute(
    `
      SELECT
        id,
        first_name AS firstName,
        last_name AS lastName,
        birth_date AS birthDate,
        email,
        address,
        phone,
        instagram,
        source,
        lead_status AS leadStatus,
        admin_notes AS adminNotes,
        linked_customer_id AS linkedCustomerId
      FROM potential_customers
      WHERE linked_customer_id = ?
      ORDER BY id DESC
      LIMIT 1
    `,
    [customerId],
  );

  return rows[0] || null;
}

export async function ensurePotentialCustomerForCustomer(customer, options = {}, connection = pool) {
  if (!customer?.id) {
    throw badRequest('Customer id is required');
  }

  const existing = await findPotentialCustomerByLinkedCustomerId(customer.id, connection);
  const payload = {
    firstName: customer.firstName || 'Cliente',
    lastName: customer.lastName || 'ESADAR',
    birthDate: customer.birthDate || null,
    email: customer.email || null,
    address: customer.address || null,
    phone: customer.phone || null,
    instagram: customer.instagram || null,
  };

  if (existing) {
    await connection.execute(
      `
        UPDATE potential_customers
        SET
          first_name = ?,
          last_name = ?,
          birth_date = ?,
          email = ?,
          address = ?,
          phone = ?,
          instagram = ?,
          source = ?,
          lead_status = COALESCE(lead_status, 'NEW'),
          admin_notes = COALESCE(admin_notes, ?)
        WHERE id = ?
      `,
      [
        payload.firstName,
        payload.lastName,
        payload.birthDate,
        payload.email,
        payload.address,
        payload.phone,
        payload.instagram,
        options.source || existing.source || 'MANUAL',
        options.adminNotes || null,
        existing.id,
      ],
    );

    return {
      ...existing,
      ...payload,
      source: options.source || existing.source || 'MANUAL',
      adminNotes: existing.adminNotes || options.adminNotes || null,
      linkedCustomerId: customer.id,
    };
  }

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
        lead_status,
        admin_notes,
        linked_customer_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.firstName,
      payload.lastName,
      payload.birthDate,
      payload.email,
      payload.address,
      payload.phone,
      payload.instagram,
      options.source || 'MANUAL',
      options.leadStatus || 'NEW',
      options.adminNotes || null,
      customer.id,
    ],
  );

  return {
    id: Number(insertResult.insertId),
    ...payload,
    source: options.source || 'MANUAL',
    leadStatus: options.leadStatus || 'NEW',
    adminNotes: options.adminNotes || null,
    linkedCustomerId: customer.id,
  };
}
