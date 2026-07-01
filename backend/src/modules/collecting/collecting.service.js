import { env } from "../../config/env.js";
import { resolveMailSiteUrl } from "../mail/mail.url-context.js";
import { pool } from "../../db/pool.js";
import { withTransaction } from "../../db/transaction.js";
import { logAudit } from "../audit/audit.service.js";
import { getPaymentMethodLabel } from "../payment-methods.js";
import {
  DEFAULT_BANK_TAX_RATE,
  bankTaxRateToPercent,
  normalizeBankTaxRate,
} from "../articles/article-pricing-calculator.js";

const MERCADO_PAGO_PREFERENCE_URL =
  "https://api.mercadopago.com/checkout/preferences";

function normalizeMercadoPagoEnvironment(value) {
  return String(
    value || env.mercadoPago.environment || "test",
  ).toLowerCase() === "production"
    ? "production"
    : "test";
}

function clean(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function redactMercadoPagoText(value) {
  const text = String(value || "");
  return text
    .replace(/(access[_-]?token["'\s:=]+)([^"',\s}]+)/gi, "$1[redacted]")
    .replace(/(authorization["'\s:=]+bearer\s+)([^"',\s}]+)/gi, "$1[redacted]")
    .replace(/(token["'\s:=]+)([^"',\s}]+)/gi, "$1[redacted]")
    .slice(0, 1000);
}

function sanitizeMercadoPagoLogPayload(value) {
  if (!value) return "";

  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return JSON.parse(
      JSON.stringify(parsed, (key, entry) => {
        if (/token|authorization|secret/i.test(key)) return "[redacted]";
        if (typeof entry === "string") return redactMercadoPagoText(entry);
        return entry;
      }),
    );
  } catch {
    return redactMercadoPagoText(value);
  }
}

function toJson(value) {
  if (value == null) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ serializationError: true });
  }
}

async function recordMercadoPagoPreferenceEvent(connection, event) {
  try {
    await connection.execute(
      `
        INSERT INTO mercado_pago_preference_events (
          order_id,
          order_number,
          environment,
          status,
          source,
          preference_id,
          checkout_url,
          fallback_checkout_url,
          failure_status,
          failure_reason,
          payload_json,
          response_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        event.orderId || null,
        clean(event.orderNumber),
        normalizeMercadoPagoEnvironment(event.environment),
        event.status,
        clean(event.source),
        clean(event.preferenceId),
        clean(event.checkoutUrl),
        clean(event.fallbackCheckoutUrl),
        event.failureStatus || null,
        clean(event.failureReason),
        toJson(event.payload),
        toJson(event.response),
      ],
    );
  } catch (error) {
    console.warn("[MercadoPago] No se pudo registrar evento de preferencia", {
      message: redactMercadoPagoText(error?.message || error),
      orderId: event.orderId || null,
      orderNumber: event.orderNumber || null,
    });
  }
}

function bool(value, fallback = false) {
  if (value == null) return fallback;
  return Boolean(Number(value));
}

function resolveBankTaxRateInput(input = {}, fallback = DEFAULT_BANK_TAX_RATE) {
  if (input.bankTaxPercent != null && input.bankTaxPercent !== "") {
    return normalizeBankTaxRate(Number(input.bankTaxPercent) / 100);
  }

  if (input.bankTaxRate != null && input.bankTaxRate !== "") {
    return normalizeBankTaxRate(input.bankTaxRate);
  }

  return normalizeBankTaxRate(fallback);
}

function normalizeSettingsRow(row = {}) {
  const bankTaxRate = resolveBankTaxRateInput(
    { bankTaxRate: row.bankTaxRate },
    DEFAULT_BANK_TAX_RATE,
  );

  return {
    id: Number(row.id || 1),
    bankTaxRate,
    bankTaxPercent: bankTaxRateToPercent(bankTaxRate),
    isBankTransferEnabled: bool(row.isBankTransferEnabled, true),
    bankAccountHolder: row.bankAccountHolder || "",
    bankName: row.bankName || "",
    bankAccountType: row.bankAccountType || "",
    bankAccountNumber: row.bankAccountNumber || "",
    bankBranch: row.bankBranch || "",
    bankCurrency: row.bankCurrency || "UYU",
    bankAlias: row.bankAlias || "",
    bankDocument: row.bankDocument || "",
    bankInstructions: row.bankInstructions || "",
    isMercadoPagoEnabled: bool(row.isMercadoPagoEnabled, true),
    mercadoPagoEnvironment: normalizeMercadoPagoEnvironment(
      row.mercadoPagoEnvironment,
    ),
    mercadoPagoPublicKey:
      row.mercadoPagoPublicKey || env.mercadoPago.publicKey || "",
    mercadoPagoAccessToken:
      row.mercadoPagoAccessToken || env.mercadoPago.accessToken || "",
    mercadoPagoAccessTokenConfigured: Boolean(
      row.mercadoPagoAccessToken || env.mercadoPago.accessToken,
    ),
    mercadoPagoUserId: row.mercadoPagoUserId || env.mercadoPago.userId || "",
    mercadoPagoCheckoutUrl:
      row.mercadoPagoCheckoutUrl || env.mercadoPago.checkoutUrl || "",
    mercadoPagoNotificationUrl:
      row.mercadoPagoNotificationUrl || env.mercadoPago.notificationUrl || "",
    mercadoPagoWebhookSecret:
      row.mercadoPagoWebhookSecret || env.mercadoPago.webhookSecret || "",
    mercadoPagoWebhookSecretConfigured: Boolean(
      row.mercadoPagoWebhookSecret || env.mercadoPago.webhookSecret,
    ),
    mercadoPagoPreferenceNote: row.mercadoPagoPreferenceNote || "",
    mercadoPagoInstructions: row.mercadoPagoInstructions || "",
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
}

function normalizeSettingsForAudit(settings) {
  if (!settings) return null;
  return {
    ...settings,
    mercadoPagoAccessToken: settings.mercadoPagoAccessToken
      ? "[configured]"
      : "",
    mercadoPagoWebhookSecret: settings.mercadoPagoWebhookSecret
      ? "[configured]"
      : "",
  };
}

async function ensureSettingsRow(connection = pool) {
  await connection.execute(
    `
      INSERT INTO company_collecting_settings (id, bank_currency, mercado_pago_environment)
      VALUES (1, 'UYU', 'test')
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
        bank_tax_rate AS bankTaxRate,
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
        mercado_pago_environment AS mercadoPagoEnvironment,
        mercado_pago_public_key AS mercadoPagoPublicKey,
        mercado_pago_access_token AS mercadoPagoAccessToken,
        mercado_pago_user_id AS mercadoPagoUserId,
        mercado_pago_checkout_url AS mercadoPagoCheckoutUrl,
        mercado_pago_notification_url AS mercadoPagoNotificationUrl,
        mercado_pago_webhook_secret AS mercadoPagoWebhookSecret,
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

export async function getCostingSettings(connection = pool) {
  const settings = await getCollectingSettings(connection);
  return {
    bankTaxRate: settings.bankTaxRate,
    bankTaxPercent: settings.bankTaxPercent,
  };
}

export async function updateCollectingSettings(input, auditContext) {
  return withTransaction(async (connection) => {
    const before = await getCollectingSettings(connection);
    const bankTaxRate = resolveBankTaxRateInput(input, before.bankTaxRate);

    await connection.execute(
      `
        UPDATE company_collecting_settings
        SET
          bank_tax_rate = ?,
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
          mercado_pago_environment = ?,
          mercado_pago_public_key = ?,
          mercado_pago_access_token = ?,
          mercado_pago_user_id = ?,
          mercado_pago_checkout_url = ?,
          mercado_pago_notification_url = ?,
          mercado_pago_webhook_secret = ?,
          mercado_pago_preference_note = ?,
          mercado_pago_instructions = ?,
          updated_by = ?
        WHERE id = 1
      `,
      [
        bankTaxRate,
        input.isBankTransferEnabled ? 1 : 0,
        clean(input.bankAccountHolder),
        clean(input.bankName),
        clean(input.bankAccountType),
        clean(input.bankAccountNumber),
        clean(input.bankBranch),
        clean(input.bankCurrency) || "UYU",
        clean(input.bankAlias),
        clean(input.bankDocument),
        clean(input.bankInstructions),
        input.isMercadoPagoEnabled ? 1 : 0,
        normalizeMercadoPagoEnvironment(input.mercadoPagoEnvironment),
        clean(input.mercadoPagoPublicKey),
        clean(input.mercadoPagoAccessToken) ||
          before.mercadoPagoAccessToken ||
          null,
        clean(input.mercadoPagoUserId),
        clean(input.mercadoPagoCheckoutUrl),
        clean(input.mercadoPagoNotificationUrl),
        clean(input.mercadoPagoWebhookSecret) ||
          before.mercadoPagoWebhookSecret ||
          null,
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
        actionCode: "COLLECTING_SETTINGS_UPDATED",
        entityType: "company_collecting_settings",
        entityId: 1,
        beforeJson: normalizeSettingsForAudit(before),
        afterJson: normalizeSettingsForAudit(after),
        metadataJson: {
          bankTaxRate: {
            from: before.bankTaxRate,
            to: after.bankTaxRate,
          },
          bankTaxPercent: {
            from: before.bankTaxPercent,
            to: after.bankTaxPercent,
          },
        },
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
    ["Titular", settings.bankAccountHolder],
    ["Banco", settings.bankName],
    ["Tipo de cuenta", settings.bankAccountType],
    ["Número de cuenta", settings.bankAccountNumber],
    ["Sucursal", settings.bankBranch],
    ["Moneda", settings.bankCurrency],
    ["Alias", settings.bankAlias],
    ["Documento/RUT", settings.bankDocument],
  ]
    .filter(([, value]) => clean(value))
    .map(([label, value]) => ({ label, value: clean(value) }));

  return {
    method: "BANK_TRANSFER",
    label: getPaymentMethodLabel("BANK_TRANSFER"),
    title: "Datos para transferencia bancaria",
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

function getOrderUrl(order, options = {}) {
  const siteUrl = resolveMailSiteUrl(options.publicSiteUrl);
  return `${siteUrl}/cuenta/ordenes${order?.id ? `/${order.id}` : ""}`;
}

function getOrderLabel(order) {
  return String(order?.orderNumber || order?.id || "orden").trim();
}

function toMercadoPagoAmount(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Number(amount.toFixed(2));
}

function getMercadoPagoBackUrl(order, options = {}) {
  return getOrderUrl(order, options);
}

function buildMercadoPagoNotificationUrl(value) {
  const url = clean(value);
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("source_news")) {
      parsed.searchParams.set("source_news", "webhooks");
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function buildMercadoPagoPreferencePayload(order, settings, options = {}) {
  const orderLabel = getOrderLabel(order);
  const total = toMercadoPagoAmount(order?.total);
  if (!total) return null;

  const customer = order?.customer || {};
  const orderUrl = getMercadoPagoBackUrl(order, options);
  const notificationUrl = buildMercadoPagoNotificationUrl(
    settings.mercadoPagoNotificationUrl,
  );

  const payload = {
    items: [
      {
        id: String(order?.id || orderLabel),
        title: `Orden ESADAR ${orderLabel}`,
        description: `Pago de orden ${orderLabel}`,
        quantity: 1,
        currency_id: order?.currencyCode || "UYU",
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
    auto_return: "approved",
    external_reference: orderLabel,
    statement_descriptor: "ESADAR",
    metadata: {
      order_id: order?.id || null,
      order_number: order?.orderNumber || null,
      source: "esadar_checkout",
    },
  };

  if (notificationUrl) {
    payload.notification_url = notificationUrl;
  }

  return payload;
}

function selectMercadoPagoCheckoutUrl(preference, environment) {
  const initPoint = clean(preference?.init_point);
  const sandboxInitPoint = clean(preference?.sandbox_init_point);

  if (environment === "test") return sandboxInitPoint || initPoint;
  return initPoint || sandboxInitPoint;
}

async function createMercadoPagoPreference(order, settings, connection = pool, options = {}) {
  const accessToken = clean(settings.mercadoPagoAccessToken);
  const environment = normalizeMercadoPagoEnvironment(
    settings.mercadoPagoEnvironment,
  );
  const fallbackCheckoutUrl = clean(settings.mercadoPagoCheckoutUrl);
  const baseEvent = {
    orderId: order?.id || null,
    orderNumber: order?.orderNumber || null,
    environment,
    fallbackCheckoutUrl,
  };

  if (!accessToken) {
    await recordMercadoPagoPreferenceEvent(connection, {
      ...baseEvent,
      status: fallbackCheckoutUrl ? "SKIPPED" : "FAILED",
      source: fallbackCheckoutUrl
        ? "configured_link"
        : "dynamic_preference_skipped",
      failureReason: "mercado_pago_access_token_missing",
    });
    return null;
  }

  const payload = buildMercadoPagoPreferencePayload(order, settings, options);
  if (!payload) {
    await recordMercadoPagoPreferenceEvent(connection, {
      ...baseEvent,
      status: fallbackCheckoutUrl ? "FALLBACK_USED" : "FAILED",
      source: "dynamic_preference_failed",
      failureReason: "mercado_pago_invalid_preference_payload",
    });
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(MERCADO_PAGO_PREFERENCE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      const sanitizedBody = sanitizeMercadoPagoLogPayload(errorText);
      console.error("[MercadoPago] Error creando preferencia", {
        status: response.status,
        body: sanitizedBody,
        orderId: order?.id || null,
        orderNumber: order?.orderNumber || null,
      });
      await recordMercadoPagoPreferenceEvent(connection, {
        ...baseEvent,
        status: fallbackCheckoutUrl ? "FALLBACK_USED" : "FAILED",
        source: "dynamic_preference_failed",
        failureStatus: response.status,
        failureReason: "mercado_pago_preference_response_not_ok",
        payload,
        response: sanitizedBody,
      });
      return {
        environment,
        source: "dynamic_preference_failed",
        failureStatus: response.status,
        failureReason: "mercado_pago_preference_response_not_ok",
      };
    }

    const preference = await response.json();
    const checkoutUrl = selectMercadoPagoCheckoutUrl(preference, environment);

    if (!checkoutUrl) {
      console.error("[MercadoPago] Preferencia sin link de checkout", {
        preferenceId: clean(preference.id),
        environment,
        orderId: order?.id || null,
        orderNumber: order?.orderNumber || null,
      });
      await recordMercadoPagoPreferenceEvent(connection, {
        ...baseEvent,
        status: fallbackCheckoutUrl ? "FALLBACK_USED" : "FAILED",
        source: "dynamic_preference_failed",
        preferenceId: clean(preference.id),
        failureReason: "mercado_pago_preference_without_checkout_url",
        payload,
        response: sanitizeMercadoPagoLogPayload(preference),
      });
      return {
        id: clean(preference.id),
        environment,
        source: "dynamic_preference_failed",
        failureReason: "mercado_pago_preference_without_checkout_url",
      };
    }

    await recordMercadoPagoPreferenceEvent(connection, {
      ...baseEvent,
      status: "CREATED",
      source: "dynamic_preference",
      preferenceId: clean(preference.id),
      checkoutUrl,
      payload,
      response: sanitizeMercadoPagoLogPayload(preference),
    });

    return {
      id: clean(preference.id),
      checkoutUrl,
      environment,
      source: "dynamic_preference",
    };
  } catch (error) {
    console.error("[MercadoPago] No se pudo crear preferencia", {
      message: redactMercadoPagoText(error?.message || error),
      name: error?.name || null,
      orderId: order?.id || null,
      orderNumber: order?.orderNumber || null,
    });
    await recordMercadoPagoPreferenceEvent(connection, {
      ...baseEvent,
      status: fallbackCheckoutUrl ? "FALLBACK_USED" : "FAILED",
      source: "dynamic_preference_failed",
      failureReason: error?.name === "AbortError"
        ? "mercado_pago_preference_timeout"
        : "mercado_pago_preference_exception",
      payload,
      response: {
        name: error?.name || null,
        message: redactMercadoPagoText(error?.message || error),
      },
    });
    return {
      environment,
      source: "dynamic_preference_failed",
      failureReason: error?.name === "AbortError"
        ? "mercado_pago_preference_timeout"
        : "mercado_pago_preference_exception",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildMercadoPagoDetails(settings, preference = null) {
  const checkoutUrl =
    clean(preference?.checkoutUrl) || clean(settings.mercadoPagoCheckoutUrl);
  const environment = normalizeMercadoPagoEnvironment(
    preference?.environment || settings.mercadoPagoEnvironment,
  );
  const preferenceFailed = preference?.source === "dynamic_preference_failed";
  const fields = [
    ["Link de pago", checkoutUrl],
    ["Preferencia Mercado Pago", preference?.id],
    ["Usuario / Collector ID", settings.mercadoPagoUserId],
    ["Referencia", settings.mercadoPagoPreferenceNote],
  ]
    .filter(([, value]) => clean(value))
    .map(([label, value]) => ({ label, value: clean(value) }));

  if (preferenceFailed && checkoutUrl) {
    fields.push({
      label: "Fallback",
      value: "Se usó el link configurado porque la preferencia dinámica no pudo generarse.",
    });
  }

  if (settings.isMercadoPagoEnabled && !checkoutUrl) {
    fields.push({
      label: "Estado",
      value: "Link de pago no disponible. Requiere revision manual.",
    });
  }

  const instructions = [
    clean(settings.mercadoPagoInstructions),
    settings.isMercadoPagoEnabled && !checkoutUrl
      ? "Mercado Pago esta habilitado, pero no pudimos generar el link automatico ni hay un link fallback configurado. ESADAR te contactara para completar el pago."
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    method: "MERCADO_PAGO",
    label: getPaymentMethodLabel("MERCADO_PAGO"),
    title: "Datos para pagar con Mercado Pago",
    enabled: Boolean(settings.isMercadoPagoEnabled && checkoutUrl),
    fields,
    instructions: clean(instructions),
    checkoutUrl,
    qrCodeUrl: buildMercadoPagoQrUrl(checkoutUrl),
    environment,
    source:
      preference?.checkoutUrl
        ? preference.source
        : checkoutUrl && preferenceFailed
          ? "configured_link_after_preference_failure"
          : checkoutUrl
            ? "configured_link"
            : preference?.source || null,
    preferenceFailureReason: preferenceFailed
      ? preference.failureReason || null
      : null,
  };
}

export async function getPaymentInstructionsForOrder(order, connection = pool, options = {}) {
  const settings = await getCollectingSettings(connection);
  const paymentMethod = order?.paymentMethod;

  if (paymentMethod === "BANK_TRANSFER")
    return buildBankTransferDetails(settings);

  if (paymentMethod === "MERCADO_PAGO") {
    const preference =
      order?.id && Number(order?.total || 0) > 0
        ? await createMercadoPagoPreference(order, settings, connection, options)
        : null;
    return buildMercadoPagoDetails(settings, preference);
  }

  return {
    method: paymentMethod || "",
    label: getPaymentMethodLabel(paymentMethod),
    title: "Datos de pago",
    enabled: true,
    fields: [],
    instructions: null,
  };
}

export async function getPaymentInstructionsForMethod(
  paymentMethod,
  connection = pool,
) {
  return getPaymentInstructionsForOrder({ paymentMethod }, connection);
}
