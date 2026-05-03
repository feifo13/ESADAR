import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { notFound } from '../../utils/app-error.js';
import { logAudit } from '../audit/audit.service.js';
import {
  ensureCustomerForUser,
  ensurePotentialCustomerForCustomer,
  findCustomerByUserId,
  findPotentialCustomerByLinkedCustomerId,
} from '../customers/customer-helpers.js';
import { getOrderDetail } from '../orders/orders.service.js';

function parseJsonField(value, fallback = []) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

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
    deliveryNotes: row.deliveryNotes || null,
    isDefault: Boolean(row.isDefault),
  };
}

async function getUserRow(userId, connection = pool) {
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
        instagram
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [userId],
  );

  if (!rows.length) {
    throw notFound('User not found');
  }

  return rows[0];
}

async function getDefaultCustomerAddress(customerId, connection = pool) {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        label,
        address_line AS addressLine,
        city,
        state,
        country,
        postal_code AS postalCode,
        delivery_notes AS deliveryNotes,
        is_default AS isDefault
      FROM customer_addresses
      WHERE customer_id = ?
      ORDER BY is_default DESC, updated_at DESC, id DESC
      LIMIT 1
    `,
    [customerId],
  );

  return normalizeAddressRow(rows[0] || null);
}

async function getLeadPreferencesByPotentialCustomerId(potentialCustomerId, connection = pool) {
  if (!potentialCustomerId) {
    return {
      preferredCategories: [],
      preferredBrands: [],
      preferredSizes: [],
      preferredColors: [],
      notes: null,
    };
  }

  const [rows] = await connection.execute(
    `
      SELECT
        preferred_categories_json AS preferredCategories,
        preferred_brands_json AS preferredBrands,
        preferred_sizes_json AS preferredSizes,
        preferred_colors_json AS preferredColors,
        notes
      FROM lead_preferences
      WHERE potential_customer_id = ?
      LIMIT 1
    `,
    [potentialCustomerId],
  );

  if (!rows.length) {
    return {
      preferredCategories: [],
      preferredBrands: [],
      preferredSizes: [],
      preferredColors: [],
      notes: null,
    };
  }

  return {
    preferredCategories: parseJsonField(rows[0].preferredCategories, []),
    preferredBrands: parseJsonField(rows[0].preferredBrands, []),
    preferredSizes: parseJsonField(rows[0].preferredSizes, []),
    preferredColors: parseJsonField(rows[0].preferredColors, []),
    notes: rows[0].notes || null,
  };
}

async function upsertLeadPreferences(potentialCustomerId, preferences, connection) {
  const [rows] = await connection.execute(
    'SELECT id FROM lead_preferences WHERE potential_customer_id = ? LIMIT 1',
    [potentialCustomerId],
  );

  const values = [
    JSON.stringify(preferences.preferredCategories || []),
    JSON.stringify(preferences.preferredBrands || []),
    JSON.stringify(preferences.preferredSizes || []),
    JSON.stringify(preferences.preferredColors || []),
    preferences.notes || null,
  ];

  if (!rows.length) {
    await connection.execute(
      `
        INSERT INTO lead_preferences (
          potential_customer_id,
          preferred_categories_json,
          preferred_brands_json,
          preferred_sizes_json,
          preferred_colors_json,
          notes
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [potentialCustomerId, ...values],
    );
    return;
  }

  await connection.execute(
    `
      UPDATE lead_preferences
      SET
        preferred_categories_json = ?,
        preferred_brands_json = ?,
        preferred_sizes_json = ?,
        preferred_colors_json = ?,
        notes = ?
      WHERE potential_customer_id = ?
    `,
    [...values, potentialCustomerId],
  );
}

async function resolveShippingPreference(shippingMethodId, connection = pool) {
  if (!shippingMethodId) return null;

  const [rows] = await connection.execute(
    `
      SELECT
        id,
        name,
        description,
        base_cost AS baseCost
      FROM shipping_methods
      WHERE id = ?
      LIMIT 1
    `,
    [shippingMethodId],
  );

  return rows[0]
    ? {
      id: Number(rows[0].id),
      name: rows[0].name,
      description: rows[0].description || null,
      baseCost: Number(rows[0].baseCost || 0),
    }
    : null;
}

async function buildAccountProfile(customer, connection = pool) {
  const user = await getUserRow(customer.userId, connection);
  const defaultAddress = await getDefaultCustomerAddress(customer.id, connection);
  const linkedPotentialCustomer = await findPotentialCustomerByLinkedCustomerId(customer.id, connection);
  const preferences = await getLeadPreferencesByPotentialCustomerId(linkedPotentialCustomer?.id, connection);
  const preferredShippingMethod = await resolveShippingPreference(customer.preferredShippingMethodId, connection);

  return {
    customerId: Number(customer.id),
    userId: Number(user.id),
    firstName: customer.firstName || user.firstName || '',
    lastName: customer.lastName || user.lastName || '',
    birthDate: customer.birthDate || user.birthDate || null,
    email: customer.email || user.email || null,
    phone: customer.phone || user.phone || null,
    instagram: customer.instagram || user.instagram || null,
    defaultAddress,
    preferredPaymentMethod: customer.preferredPaymentMethod || null,
    preferredShippingMethodId: customer.preferredShippingMethodId != null
      ? Number(customer.preferredShippingMethodId)
      : null,
    preferredShippingMethod,
    preferredCategories: preferences.preferredCategories || [],
    preferredBrands: preferences.preferredBrands || [],
    preferredSizes: preferences.preferredSizes || [],
    preferredColors: preferences.preferredColors || [],
    preferenceNotes: preferences.notes || null,
    linkedPotentialCustomerId: linkedPotentialCustomer?.id ? Number(linkedPotentialCustomer.id) : null,
  };
}

function mergeProfileInput(current, input = {}) {
  return {
    firstName: input.firstName ?? current.firstName ?? '',
    lastName: input.lastName ?? current.lastName ?? '',
    birthDate: input.birthDate ?? current.birthDate ?? null,
    email: input.email ?? current.email ?? null,
    phone: input.phone ?? current.phone ?? null,
    instagram: input.instagram ?? current.instagram ?? null,
    defaultAddress: input.defaultAddress === undefined
      ? current.defaultAddress
      : input.defaultAddress,
    preferredPaymentMethod: input.preferredPaymentMethod ?? current.preferredPaymentMethod ?? null,
    preferredShippingMethodId: input.preferredShippingMethodId ?? current.preferredShippingMethodId ?? null,
    preferredCategories: input.preferredCategories ?? current.preferredCategories ?? [],
    preferredBrands: input.preferredBrands ?? current.preferredBrands ?? [],
    preferredSizes: input.preferredSizes ?? current.preferredSizes ?? [],
    preferredColors: input.preferredColors ?? current.preferredColors ?? [],
    preferenceNotes: input.preferenceNotes ?? current.preferenceNotes ?? null,
  };
}

async function syncDefaultAddress(customerId, nextAddress, connection) {
  const currentAddress = await getDefaultCustomerAddress(customerId, connection);
  const hasAddressData = [
    nextAddress?.addressLine,
    nextAddress?.city,
    nextAddress?.state,
    nextAddress?.country,
    nextAddress?.postalCode,
    nextAddress?.deliveryNotes,
  ].some(Boolean);

  if (!hasAddressData) {
    if (currentAddress?.id) {
      await connection.execute('DELETE FROM customer_addresses WHERE id = ?', [currentAddress.id]);
    }
    return null;
  }

  const values = [
    nextAddress?.label || 'Envio principal',
    nextAddress?.addressLine,
    nextAddress?.city || null,
    nextAddress?.state || null,
    nextAddress?.country || 'Uruguay',
    nextAddress?.postalCode || null,
    nextAddress?.deliveryNotes || null,
  ];

  if (currentAddress?.id) {
    await connection.execute(
      `
        UPDATE customer_addresses
        SET
          label = ?,
          address_line = ?,
          city = ?,
          state = ?,
          country = ?,
          postal_code = ?,
          delivery_notes = ?,
          is_default = 1
        WHERE id = ?
      `,
      [...values, currentAddress.id],
    );
    return getDefaultCustomerAddress(customerId, connection);
  }

  await connection.execute(
    'UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?',
    [customerId],
  );

  await connection.execute(
    `
      INSERT INTO customer_addresses (
        customer_id,
        label,
        address_line,
        city,
        state,
        country,
        postal_code,
        delivery_notes,
        is_default
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `,
    [customerId, ...values],
  );

  return getDefaultCustomerAddress(customerId, connection);
}

export async function getAccountProfile(userId) {
  const customer = await findCustomerByUserId(userId);
  if (!customer) {
    throw notFound('Customer profile not found');
  }

  return buildAccountProfile(customer);
}

export async function saveAccountProfile(userId, input, auditContext) {
  return withTransaction(async (connection) => {
    const customer = await ensureCustomerForUser(userId, connection);
    const before = await buildAccountProfile(customer, connection);
    const next = mergeProfileInput(before, input);

    await connection.execute(
      `
        UPDATE users
        SET
          first_name = ?,
          last_name = ?,
          birth_date = ?,
          email = ?,
          address = ?,
          phone = ?,
          instagram = ?
        WHERE id = ?
      `,
      [
        next.firstName,
        next.lastName,
        next.birthDate || null,
        next.email || null,
        next.defaultAddress?.addressLine || null,
        next.phone || null,
        next.instagram || null,
        userId,
      ],
    );

    await connection.execute(
      `
        UPDATE customers
        SET
          first_name = ?,
          last_name = ?,
          birth_date = ?,
          email = ?,
          address = ?,
          phone = ?,
          instagram = ?,
          preferred_payment_method = ?,
          preferred_shipping_method_id = ?,
          updated_by = ?
        WHERE id = ?
      `,
      [
        next.firstName,
        next.lastName,
        next.birthDate || null,
        next.email || null,
        next.defaultAddress?.addressLine || null,
        next.phone || null,
        next.instagram || null,
        next.preferredPaymentMethod || null,
        next.preferredShippingMethodId || null,
        auditContext.actorUserId || userId,
        customer.id,
      ],
    );

    await syncDefaultAddress(customer.id, next.defaultAddress, connection);

    const potentialCustomer = await ensurePotentialCustomerForCustomer(
      {
        ...customer,
        firstName: next.firstName,
        lastName: next.lastName,
        birthDate: next.birthDate || null,
        email: next.email || null,
        address: next.defaultAddress?.addressLine || null,
        phone: next.phone || null,
        instagram: next.instagram || null,
      },
      { source: 'PRODUCT_INTEREST' },
      connection,
    );

    await upsertLeadPreferences(
      potentialCustomer.id,
      {
        preferredCategories: next.preferredCategories || [],
        preferredBrands: next.preferredBrands || [],
        preferredSizes: next.preferredSizes || [],
        preferredColors: next.preferredColors || [],
        notes: next.preferenceNotes || null,
      },
      connection,
    );

    const refreshedCustomer = await findCustomerByUserId(userId, connection);
    const profile = await buildAccountProfile(refreshedCustomer, connection);

    await logAudit(
      {
        actorUserId: auditContext.actorUserId || userId,
        actorLabel: auditContext.actorLabel || next.email || null,
        actionCode: 'ACCOUNT_PROFILE_UPDATED',
        entityType: 'customers',
        entityId: customer.id,
        beforeJson: before,
        afterJson: profile,
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return profile;
  });
}

export async function listAccountOrders(userId) {
  const customer = await findCustomerByUserId(userId);
  if (!customer) {
    return [];
  }

  const [rows] = await pool.execute(
    `
      SELECT
        o.id,
        o.order_number AS orderNumber,
        o.payment_method AS paymentMethod,
        o.payment_status AS paymentStatus,
        o.order_status AS orderStatus,
        o.total_snapshot AS total,
        o.created_at AS createdAt,
        COALESCE(sm.description, o.shipping_method_description_snapshot) AS shippingMethodName,
        COUNT(oi.id) AS itemsCount
      FROM orders o
      LEFT JOIN shipping_methods sm ON sm.id = o.shipping_method_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.user_id = ? OR o.customer_id = ?
      GROUP BY o.id, shippingMethodName
      ORDER BY o.created_at DESC, o.id DESC
      LIMIT 25
    `,
    [userId, customer.id],
  );

  return rows.map((row) => ({
    id: Number(row.id),
    orderNumber: row.orderNumber,
    paymentMethod: row.paymentMethod,
    paymentStatus: row.paymentStatus,
    orderStatus: row.orderStatus,
    total: Number(row.total || 0),
    createdAt: row.createdAt,
    shippingMethodName: row.shippingMethodName || null,
    itemsCount: Number(row.itemsCount || 0),
  }));
}

export async function getAccountOrderDetail(userId, orderId) {
  const customer = await findCustomerByUserId(userId);

  const [ownershipRows] = await pool.execute(
    `
      SELECT id
      FROM orders
      WHERE id = ?
        AND (user_id = ? OR customer_id <=> ?)
      LIMIT 1
    `,
    [orderId, userId, customer?.id || null],
  );

  if (!ownershipRows.length) {
    throw notFound('Order not found');
  }

  const order = await getOrderDetail(orderId);

  return {
    id: Number(order.id),
    orderNumber: order.orderNumber,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    shippingMethodDescription: order.shippingMethodDescription || null,
    shippingCost: Number(order.shippingCost || 0),
    subtotal: Number(order.subtotal || 0),
    discountTotal: Number(order.discountTotal || 0),
    total: Number(order.total || 0),
    reservedUntil: order.reservedUntil,
    approvedAt: order.approvedAt,
    cancelledAt: order.cancelledAt,
    shippedAt: order.shippedAt,
    cancellationReason: order.cancellationReason || null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: (order.items || []).map((item) => ({
      id: Number(item.id),
      articleId: item.articleId != null ? Number(item.articleId) : null,
      quantity: Number(item.quantity || 0),
      articleTitle: item.articleTitle,
      articleSlug: item.articleSlug,
      brandName: item.brandName || null,
      size: item.size || null,
      image: item.image || null,
      finalUnitPrice: Number(item.finalUnitPrice || 0),
      lineTotal: Number(item.lineTotal || 0),
    })),
    history: (order.history || []).map((entry) => ({
      id: Number(entry.id),
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      reason: entry.reason || null,
      changedAt: entry.changedAt,
      source: entry.source || null,
    })),
  };
}

export async function listAccountAlerts(userId) {
  const customer = await findCustomerByUserId(userId);
  if (!customer) {
    return [];
  }

  const potentialCustomer = await findPotentialCustomerByLinkedCustomerId(customer.id);
  if (!potentialCustomer?.id) {
    return [];
  }

  const [rows] = await pool.execute(
    `
      SELECT
        aia.id,
        aia.article_id AS articleId,
        aia.alert_type AS alertType,
        aia.status,
        aia.created_at AS createdAt,
        aia.updated_at AS updatedAt,
        a.title AS articleTitle,
        a.slug AS articleSlug
      FROM article_interest_alerts aia
      LEFT JOIN articles a ON a.id = aia.article_id
      WHERE aia.potential_customer_id = ?
      ORDER BY aia.created_at DESC, aia.id DESC
    `,
    [potentialCustomer.id],
  );

  return rows.map((row) => ({
    id: Number(row.id),
    articleId: row.articleId != null ? Number(row.articleId) : null,
    alertType: row.alertType,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    articleTitle: row.articleTitle || null,
    articleSlug: row.articleSlug || null,
  }));
}
