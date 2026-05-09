import { env } from '../../config/env.js';
import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { logAudit } from '../audit/audit.service.js';
import { getPaymentMethodLabel } from '../payment-methods.js';

const MERCADO_PAGO_PREFERENCE_URL = 'https://api.mercadopago.com/checkout/preferences';

function clean(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function bool(value, fallback = false) {
  if (value == null) return fallback;
  return Boolean(Number(value));
}

function normalizeSettingsRow(row = {}) {
  return {
    id: Number(row.id || 1),
    isBankTransferEnabled: bool(row.isBankTransferEnabled, true),
    bankAccountHolder: row.bankAccountHolder || '',
    bankName: row.bankName || '',
    bankAccountType: row.bankAccountType || '',
    bankAccountNumber: row.bankAccountNumber || '',
    bankBranch: row.bankBranch || '',
    bankCurrency: row.bankCurrency || 'UYU',
    bankAlias: row.bankAlias || '',
    bankDocument: row.bankDocument || '',
    bankInstructions: row.bankInstructions || '',
    isMercadoPagoEnabled: bool(row.isMercadoPagoEnabled, true),
    mercadoPagoPublicKey: row.mercadoPagoPublicKey || '',
    mercadoPagoAccessToken: row.mercadoPagoAccessToken || '',
    mercadoPagoUserId: row.mercadoPagoUserId || '',
    mercadoPagoCheckoutUrl: row.mercadoPagoCheckoutUrl || '',
    mercadoPagoPreferenceNote: row.mercadoPagoPreferenceNote || '',
    mercadoPagoInstructions: row.mercadoPagoInstructions || '',
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
}

function normalizeSettingsForAudit(settings) {
  if (!settings) return null;
  return {
    ...settings,
    mercadoPagoAccessToken: settings.mercadoPagoAccessToken ? '[configured]' : '',
  };
}

async function ensureSettingsRow(connection = pool) {
  await connection.execute(
    `
      INSERT INTO company_collecting_settings (id, bank_currency)
      VALUES (1, 'UYU')
      ON DUPLICATE KEY UPDATE id = id
    `,
  );
}

export async function getCollectingSettings(connection = pool) {
  await ensureSettingsRow(connection);
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        is_bank_transfer_enabled AS isBankTransferEnabled,
        bank_account_holder AS bankAccountHolder,
        bank_name AS bankName,
        bank_account_type AS bankAccountType,
        bank_account_number AS bankAccountNumber,
        bank_branch AS bankBranch,
        bank_currency AS bankCurrency,
        bank_alias AS bankAlias,
        bank_document AS bankDocument,
        bank_instructions AS bankInstructions,
        is_mercado_pago_enabled AS isMercadoPagoEnabled,
        mercado_pago_public_key AS mercadoPagoPublicKey,
        mercado_pago_access_token AS mercadoPagoAccessToken,
        mercado_pago_user_id AS mercadoPagoUserId,
        mercado_pago_checkout_url AS mercadoPagoCheckoutUrl,
        mercado_pago_preference_note AS mercadoPagoPreferenceNote,
        mercado_pago_instructions AS mercadoPagoInstructions,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM company_collecting_settings
      WHERE id = 1
      LIMIT 1
    `,
  );

  return normalizeSettingsRow(rows[0] || { id: 1 });
}

export async function updateCollectingSettings(input, auditContext) {
  return withTransaction(async (connection) => {
    const before = await getCollectingSettings(connection);

    await connection.execute(
      `
        UPDATE company_collecting_settings
        SET
          is_bank_transfer_enabled = ?,
          bank_account_holder = ?,
          bank_name = ?,
          bank_account_type = ?,
          bank_account_number = ?,
          bank_branch = ?,
          bank_currency = ?,
          bank_alias = ?,
          bank_document = ?,
          bank_instructions = ?,
          is_mercado_pago_enabled = ?,
          mercado_pago_public_key = ?,
          mercado_pago_access_token = ?,
          mercado_pago_user_id = ?,
          mercado_pago_checkout_url = ?,
          mercado_pago_preference_note = ?,
          mercado_pago_instructions = ?,
          updated_by = ?
        WHERE id = 1
      `,
      [
        input.isBankTransferEnabled ? 1 : 0,
        clean(input.bankAccountHolder),
        clean(input.bankName),
        clean(input.bankAccountType),
        clean(input.bankAccountNumber),
        clean(input.bankBranch),
        clean(input.bankCurrency) || 'UYU',
        clean(input.bankAlias),
        clean(input.bankDocument),
        clean(input.bankInstructions),
        input.isMercadoPagoEnabled ? 1 : 0,
        clean(input.mercadoPagoPublicKey),
        clean(input.mercadoPagoAccessToken),
        clean(input.mercadoPagoUserId),
        clean(input.mercadoPagoCheckoutUrl),
        clean(input.mercadoPagoPreferenceNote),
        clean(input.mercadoPagoInstructions),
        auditContext.actorUserId || null,
      ],
    );

    const after = await getCollectingSettings(connection);

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: 'COLLECTING_SETTINGS_UPDATED',
        entityType: 'company_collecting_settings',
        entityId: 1,
        beforeJson: normalizeSettingsForAudit(before),
        afterJson: normalizeSettingsForAudit(after),
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return after;
  });
}

function buildBankTransferDetails(settings) {
  const fields = [
    ['Titular', settings.bankAccountHolder],
    ['Banco', settings.bankName],
    ['Tipo de cuenta', settings.bankAccountType],
    ['Número de cuenta', settings.bankAccountNumber],
    ['Sucursal', settings.bankBranch],
    ['Moneda', settings.bankCurrency],
    ['Alias', settings.bankAlias],
    ['Documento/RUT', settings.bankDocument],
  ]
    .filter(([, value]) => clean(value))
    .map(([label, value]) => ({ label, value: clean(value) }));

  return {
    method: 'BANK_TRANSFER',
    label: getPaymentMethodLabel('BANK_TRANSFER'),
    title: 'Datos para transferencia bancaria',
    enabled: settings.isBankTransferEnabled,
    fields,
    instructions: clean(settings.bankInstructions),
  };
}

function buildMercadoPagoQrUrl(checkoutUrl) {
  const url = clean(checkoutUrl);
  if (!url) return null;
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(url)}`;
}

function getOrderUrl(order) {
  return `${env.publicSiteUrl}/cuenta/ordenes${order?.id ? `/${order.id}` : ''}`;
}

function getOrderLabel(order) {
  return String(order?.orderNumber || order?.id || 'orden').trim();
}

function toMercadoPagoAmount(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Number(amount.toFixed(2));
}

function buildMercadoPagoPreferencePayload(order) {
  const orderLabel = getOrderLabel(order);
  const total = toMercadoPagoAmount(order?.total);
  if (!total) return null;

  const customer = order?.customer || {};
  const orderUrl = getOrderUrl(order);

  return {
    items: [
      {
        id: String(order?.id || orderLabel),
        title: `Orden ESADAR ${orderLabel}`,
        description: `Pago de orden ${orderLabel}`,
        quantity: 1,
        currency_id: order?.currencyCode || 'UYU',
        unit_price: total,
      },
    ],
    payer: {
      email: clean(customer.email) || undefined,
      name: clean(customer.firstName) || undefined,
      surname: clean(customer.lastName) || undefined,
    },
    back_urls: {
      success: orderUrl,
      failure: orderUrl,
      pending: orderUrl,
    },
    auto_return: 'approved',
    external_reference: orderLabel,
    metadata: {
      order_id: order?.id || null,
      order_number: order?.orderNumber || null,
    },
  };
}

async function createMercadoPagoPreferenceUrl(order, settings) {
  const accessToken = clean(settings.mercadoPagoAccessToken);
  if (!accessToken) return null;

  const payload = buildMercadoPagoPreferencePayload(order);
  if (!payload) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(MERCADO_PAGO_PREFERENCE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const preference = await response.json();
    return clean(preference.init_point) || clean(preference.sandbox_init_point);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function buildMercadoPagoDetails(settings, checkoutUrlOverride = null) {
  const checkoutUrl = clean(checkoutUrlOverride) || clean(settings.mercadoPagoCheckoutUrl);
  const fields = [
    ['Link de pago', checkoutUrl],
    ['Usuario / Collector ID', settings.mercadoPagoUserId],
    ['Referencia', settings.mercadoPagoPreferenceNote],
  ]
    .filter(([, value]) => clean(value))
    .map(([label, value]) => ({ label, value: clean(value) }));

  return {
    method: 'MERCADO_PAGO',
    label: getPaymentMethodLabel('MERCADO_PAGO'),
    title: 'Datos para pagar con Mercado Pago',
    enabled: settings.isMercadoPagoEnabled,
    fields,
    instructions: clean(settings.mercadoPagoInstructions),
    checkoutUrl,
    qrCodeUrl: buildMercadoPagoQrUrl(checkoutUrl),
  };
}

export async function getPaymentInstructionsForOrder(order, connection = pool) {
  const settings = await getCollectingSettings(connection);
  const paymentMethod = order?.paymentMethod;

  if (paymentMethod === 'BANK_TRANSFER') return buildBankTransferDetails(settings);

  if (paymentMethod === 'MERCADO_PAGO') {
    const preferenceCheckoutUrl = await createMercadoPagoPreferenceUrl(order, settings);
    return buildMercadoPagoDetails(settings, preferenceCheckoutUrl);
  }

  return {
    method: paymentMethod || '',
    label: getPaymentMethodLabel(paymentMethod),
    title: 'Datos de pago',
    enabled: true,
    fields: [],
    instructions: null,
  };
}

export async function getPaymentInstructionsForMethod(paymentMethod, connection = pool) {
  return getPaymentInstructionsForOrder({ paymentMethod }, connection);
}
