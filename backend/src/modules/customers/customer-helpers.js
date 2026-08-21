import { pool } from '../../db/pool.js';
import { badRequest, notFound } from '../../utils/app-error.js';
import { normalizeCustomerAddress } from '../../../../frontend/src/shared/customer-profile.js';

function normalizeAddressRow(row) {
  if (!row?.id) return null;
  return {
    id: Number(row.id),
    label: row.label || null,
    addressLine: row.addressLine || null,
    city: row.city || null,
    state: row.state || null,
    country: row.country || null,
    postalCode: row.postalCode || null,
    dwellingType: row.dwellingType || null,
    apartment: row.apartment || null,
    deliveryNotes: row.deliveryNotes || null,
    isDefault: Boolean(row.isDefault),
  };
}

function resolveStructuredAddress(input = {}) {
  const candidate = input?.defaultAddress || input?.address;
  if (!candidate || typeof candidate !== 'object') return null;
  return normalizeCustomerAddress(candidate);
}

export async function getDefaultCustomerAddress(customerId, connection = pool) {
  if (!customerId) return null;
  const [rows] = await connection.execute(
    `
      SELECT
        id, label, address_line AS addressLine, city, state, country,
        postal_code AS postalCode, dwelling_type AS dwellingType, apartment,
        delivery_notes AS deliveryNotes, is_default AS isDefault
      FROM customer_addresses
      WHERE customer_id = ?
      ORDER BY is_default DESC, updated_at DESC, id DESC
      LIMIT 1
    `,
    [customerId],
  );
  return normalizeAddressRow(rows[0] || null);
}

export async function syncDefaultCustomerAddress(customerId, address, connection = pool) {
  const currentAddress = await getDefaultCustomerAddress(customerId, connection);
  if (!address) {
    if (currentAddress?.id) {
      await connection.execute('DELETE FROM customer_addresses WHERE id = ?', [currentAddress.id]);
    }
    return null;
  }

  const normalized = normalizeCustomerAddress(address);
  const values = [
    normalized.label || 'Envío principal', normalized.addressLine, normalized.city,
    normalized.state, normalized.country, normalized.postalCode, normalized.dwellingType,
    normalized.apartment, normalized.deliveryNotes,
  ];

  if (currentAddress?.id) {
    await connection.execute('UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?', [customerId]);
    await connection.execute(
      `
        UPDATE customer_addresses
        SET label = ?, address_line = ?, city = ?, state = ?, country = ?, postal_code = ?,
            dwelling_type = ?, apartment = ?, delivery_notes = ?, is_default = 1
        WHERE id = ?
      `,
      [...values, currentAddress.id],
    );
    return getDefaultCustomerAddress(customerId, connection);
  }

  await connection.execute('UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?', [customerId]);
  await connection.execute(
    `
      INSERT INTO customer_addresses (
        customer_id, label, address_line, city, state, country, postal_code,
        dwelling_type, apartment, delivery_notes, is_default
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `,
    [customerId, ...values],
  );
  return getDefaultCustomerAddress(customerId, connection);
}

export async function findCustomerByUserId(userId, connection = pool) {
  if (!userId) return null;
  const [rows] = await connection.execute(
    `
      SELECT
        c.id, c.user_id AS userId,
        COALESCE(NULLIF(TRIM(c.first_name), ''), NULLIF(TRIM(u.first_name), '')) AS firstName,
        COALESCE(NULLIF(TRIM(c.last_name), ''), NULLIF(TRIM(u.last_name), '')) AS lastName,
        COALESCE(c.birth_date, u.birth_date) AS birthDate, u.email, c.address,
        COALESCE(NULLIF(TRIM(c.phone), ''), NULLIF(TRIM(u.phone), '')) AS phone,
        COALESCE(NULLIF(TRIM(c.instagram), ''), NULLIF(TRIM(u.instagram), '')) AS instagram,
        c.preferred_payment_method AS preferredPaymentMethod,
        c.preferred_shipping_method_id AS preferredShippingMethodId
      FROM customers c
      INNER JOIN users u ON u.id = c.user_id
      WHERE c.user_id = ?
      ORDER BY c.id DESC
      LIMIT 1
    `,
    [userId],
  );
  return rows[0] || null;
}

export async function findCustomerProfileByUserId(userId, connection = pool) {
  const customer = await findCustomerByUserId(userId, connection);
  if (!customer) return null;
  return { ...customer, defaultAddress: await getDefaultCustomerAddress(customer.id, connection) };
}

export async function ensureCustomerForUser(userId, connection = pool) {
  const existing = await findCustomerByUserId(userId, connection);
  if (existing) return existing;
  const [userRows] = await connection.execute(
    `SELECT id, first_name AS firstName, last_name AS lastName, birth_date AS birthDate,
            email, address, phone, instagram FROM users WHERE id = ? LIMIT 1`,
    [userId],
  );
  if (!userRows.length) throw notFound('User not found');

  const user = userRows[0];
  const [insertResult] = await connection.execute(
    `
      INSERT INTO customers (
        user_id, first_name, last_name, birth_date, email, address, phone, instagram,
        source, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'REGISTERED', ?, ?)
    `,
    [
      user.id, user.firstName || null, user.lastName || null, user.birthDate || null,
      user.email || null, user.address || null, user.phone || null, user.instagram || null,
      user.id, user.id,
    ],
  );
  return {
    id: insertResult.insertId, userId: user.id, firstName: user.firstName || null,
    lastName: user.lastName || null, birthDate: user.birthDate || null, email: user.email || null,
    address: user.address || null, phone: user.phone || null, instagram: user.instagram || null,
    preferredPaymentMethod: null, preferredShippingMethodId: null,
  };
}

function potentialCustomerAddressColumns(input = {}) {
  const structured = resolveStructuredAddress(input);
  const legacyAddress = structured?.addressLine
    || (typeof input.address === 'string' ? input.address.trim() || null : null);
  return { structured, legacyAddress };
}

function normalizePotentialCustomerRow(row) {
  if (!row?.id) return null;
  const hasStructuredAddress = Boolean(row.addressLine || row.city || row.state || row.postalCode || row.dwellingType);
  return { ...row, defaultAddress: hasStructuredAddress ? normalizeCustomerAddress(row) : null };
}

const POTENTIAL_CUSTOMER_SELECT = `
  id, first_name AS firstName, last_name AS lastName, birth_date AS birthDate,
  email, address, phone, instagram, address_line AS addressLine, city, state, country,
  postal_code AS postalCode, dwelling_type AS dwellingType, apartment,
  delivery_notes AS deliveryNotes, source, lead_status AS leadStatus,
  admin_notes AS adminNotes, linked_customer_id AS linkedCustomerId
`;

export async function createPotentialCustomerFromInput(input, options = {}, connection = pool) {
  const { structured, legacyAddress } = potentialCustomerAddressColumns(input);
  const [insertResult] = await connection.execute(
    `
      INSERT INTO potential_customers (
        first_name, last_name, birth_date, email, address, phone, instagram,
        address_line, city, state, country, postal_code, dwelling_type, apartment,
        delivery_notes, source, linked_customer_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      input.firstName || null, input.lastName || null, input.birthDate || null,
      input.email || null, legacyAddress, input.phone || null, input.instagram || null,
      structured?.addressLine || null, structured?.city || null, structured?.state || null,
      structured?.country || null, structured?.postalCode || null, structured?.dwellingType || null,
      structured?.apartment || null, structured?.deliveryNotes || null,
      options.source || 'CHECKOUT', options.linkedCustomerId || null,
    ],
  );
  return { id: insertResult.insertId, ...input, address: legacyAddress, defaultAddress: structured };
}

export async function findPotentialCustomerByContact(input, connection = pool) {
  const clauses = [];
  const params = [];
  if (input?.email) { clauses.push('email = ?'); params.push(input.email); }
  if (input?.phone) { clauses.push('phone = ?'); params.push(input.phone); }
  if (input?.instagram) { clauses.push('instagram = ?'); params.push(input.instagram); }
  if (!clauses.length) return null;
  const [rows] = await connection.execute(
    `SELECT ${POTENTIAL_CUSTOMER_SELECT} FROM potential_customers
      WHERE ${clauses.map((clause) => `(${clause})`).join(' OR ')} ORDER BY id DESC LIMIT 1`,
    params,
  );
  return normalizePotentialCustomerRow(rows[0] || null);
}

export async function upsertPotentialCustomerByContact(input, options = {}, connection = pool) {
  if (!input?.email && !input?.phone && !input?.instagram) {
    throw badRequest('At least one contact field is required');
  }
  const existing = await findPotentialCustomerByContact(input, connection);
  if (!existing) {
    const created = await createPotentialCustomerFromInput(input, options, connection);
    return { ...created, source: options.source || 'MANUAL', leadStatus: options.leadStatus || 'NEW', adminNotes: options.adminNotes || null };
  }

  const { structured, legacyAddress } = potentialCustomerAddressColumns(input);
  const nextAddress = structured || existing.defaultAddress;
  await connection.execute(
    `
      UPDATE potential_customers SET
        first_name = ?, last_name = ?, birth_date = ?, email = ?, address = ?, phone = ?, instagram = ?,
        address_line = ?, city = ?, state = ?, country = ?, postal_code = ?, dwelling_type = ?, apartment = ?,
        delivery_notes = ?, source = ?, lead_status = ?, admin_notes = ?
      WHERE id = ?
    `,
    [
      input.firstName ?? existing.firstName ?? null, input.lastName ?? existing.lastName ?? null,
      input.birthDate ?? existing.birthDate ?? null, input.email ?? existing.email ?? null,
      legacyAddress ?? existing.address ?? null, input.phone ?? existing.phone ?? null,
      input.instagram ?? existing.instagram ?? null, nextAddress?.addressLine || null,
      nextAddress?.city || null, nextAddress?.state || null, nextAddress?.country || null,
      nextAddress?.postalCode || null, nextAddress?.dwellingType || null, nextAddress?.apartment || null,
      nextAddress?.deliveryNotes || null, options.source || existing.source || 'MANUAL',
      options.leadStatus || existing.leadStatus || 'NEW', options.adminNotes ?? existing.adminNotes ?? null,
      existing.id,
    ],
  );
  return {
    ...existing, ...input, address: legacyAddress ?? existing.address ?? null,
    defaultAddress: nextAddress || null, source: options.source || existing.source || 'MANUAL',
    leadStatus: options.leadStatus || existing.leadStatus || 'NEW',
    adminNotes: options.adminNotes ?? existing.adminNotes ?? null,
  };
}

export async function findPotentialCustomerByLinkedCustomerId(customerId, connection = pool) {
  if (!customerId) return null;
  const [rows] = await connection.execute(
    `SELECT ${POTENTIAL_CUSTOMER_SELECT} FROM potential_customers
      WHERE linked_customer_id = ? ORDER BY id DESC LIMIT 1`,
    [customerId],
  );
  return normalizePotentialCustomerRow(rows[0] || null);
}

export async function ensurePotentialCustomerForCustomer(customer, options = {}, connection = pool) {
  if (!customer?.id) throw badRequest('Customer id is required');
  const existing = await findPotentialCustomerByLinkedCustomerId(customer.id, connection);
  const payload = {
    firstName: customer.firstName || null, lastName: customer.lastName || null,
    birthDate: customer.birthDate || null, email: customer.email || null,
    address: customer.defaultAddress || customer.address || null, phone: customer.phone || null,
    instagram: customer.instagram || null,
  };

  if (existing) {
    const { structured, legacyAddress } = potentialCustomerAddressColumns(payload);
    await connection.execute(
      `
        UPDATE potential_customers SET
          first_name = ?, last_name = ?, birth_date = ?, email = ?, address = ?, phone = ?, instagram = ?,
          address_line = ?, city = ?, state = ?, country = ?, postal_code = ?, dwelling_type = ?, apartment = ?,
          delivery_notes = ?, source = ?, lead_status = ?, admin_notes = ?
        WHERE id = ?
      `,
      [
        payload.firstName, payload.lastName, payload.birthDate, payload.email, legacyAddress,
        payload.phone, payload.instagram, structured?.addressLine || null, structured?.city || null,
        structured?.state || null, structured?.country || null, structured?.postalCode || null,
        structured?.dwellingType || null, structured?.apartment || null, structured?.deliveryNotes || null,
        options.source || existing.source || 'MANUAL', options.leadStatus || existing.leadStatus || 'NEW',
        options.adminNotes ?? existing.adminNotes ?? null, existing.id,
      ],
    );
    return {
      ...existing,
      ...payload,
      address: legacyAddress,
      defaultAddress: structured,
      source: options.source || existing.source || 'MANUAL',
      leadStatus: options.leadStatus || existing.leadStatus || 'NEW',
      adminNotes: options.adminNotes ?? existing.adminNotes ?? null,
    };
  }
  return createPotentialCustomerFromInput(
    payload,
    { source: options.source || 'MANUAL', linkedCustomerId: customer.id },
    connection,
  );
}
