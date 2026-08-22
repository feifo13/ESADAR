import { pool } from "../../../db/pool.js";
import { resolveMailSiteUrl } from "../../mail/mail.url-context.js";
import { getPaymentMethodLabel } from "../../payment-methods.js";

const MERCADO_PAGO_PREFERENCE_URL =
  "https://api.mercadopago.com/checkout/preferences";

const STALE_CREATION_SECONDS = 30;

function clean(value) {
  if (value == null) return null;

  const text = String(value).trim();

  return text || null;
}

function normalizeEnvironment(value) {
  return String(value || "test").toLowerCase() ===
    "production"
    ? "production"
    : "test";
}

function getOrderLabel(order) {
  return String(
    order?.orderNumber ||
    order?.id ||
    "orden",
  ).trim();
}

function toAmount(value) {
  const amount = Number(value || 0);

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return null;
  }

  return Number(amount.toFixed(2));
}

function sanitizeLogValue(value) {
  if (!value) return null;

  try {
    const parsed =
      typeof value === "string"
        ? JSON.parse(value)
        : value;

    return JSON.parse(
      JSON.stringify(
        parsed,
        (key, entry) => {
          if (
            /token|authorization|secret/i.test(
              String(key),
            )
          ) {
            return "[redacted]";
          }

          return entry;
        },
      ),
    );
  } catch {
    return String(value)
      .replace(
        /(bearer\s+)[^\s"',}]+/gi,
        "$1[redacted]",
      )
      .slice(0, 1000);
  }
}

function buildQrCodeUrl(_checkoutUrl) {
  // Keep the provider independent from external QR services.
  // A local QR implementation can be added later if desired.
  return null;
}

export function buildMercadoPagoBackUrls(
  order,
  options = {},
) {
  const siteUrl =
    resolveMailSiteUrl(
      options.publicSiteUrl,
    );

  const buildUrl = (result) => {
    const url = new URL(
      "/checkout/completa",
      `${siteUrl}/`,
    );

    url.searchParams.set(
      "mp_result",
      result,
    );

    return url.toString();
  };

  return {
    success: buildUrl("success"),
    failure: buildUrl("failure"),
    pending: buildUrl("pending"),
  };
}

function buildNotificationUrl(value) {
  const raw = clean(value);

  if (!raw) return null;

  try {
    const url = new URL(raw);

    if (url.protocol !== "https:") {
      return null;
    }

    if (
      !url.searchParams.has(
        "source_news",
      )
    ) {
      url.searchParams.set(
        "source_news",
        "webhooks",
      );
    }

    return url.toString();
  } catch {
    return null;
  }
}

export function buildMercadoPagoPreferencePayload(
  order,
  settings,
  options = {},
) {
  const orderLabel =
    getOrderLabel(order);

  const amount =
    toAmount(order?.total);

  if (!amount) return null;

  const currencyCode = String(
    order?.currencyCode || "UYU",
  ).toUpperCase();

  if (currencyCode !== "UYU") {
    return null;
  }

  const customer =
    order?.customer || {};

  const payload = {
    items: [
      {
        id: String(
          order?.id ||
          orderLabel,
        ),
        title:
          `Orden ESADAR ${orderLabel}`,
        description:
          `Pago de orden ${orderLabel}`,
        quantity: 1,
        currency_id: "UYU",
        unit_price: amount,
      },
    ],

    payer: {
      email:
        clean(customer.email) ||
        undefined,
      name:
        clean(customer.firstName) ||
        undefined,
      surname:
        clean(customer.lastName) ||
        undefined,
    },

    back_urls:
      buildMercadoPagoBackUrls(
        order,
        options,
      ),

    auto_return: "approved",

    external_reference:
      orderLabel,

    statement_descriptor:
      "ESADAR",

    metadata: {
      order_id:
        order?.id || null,
      order_number:
        order?.orderNumber || null,
      source:
        "esadar_checkout",
    },
  };

  const notificationUrl =
    buildNotificationUrl(
      settings
        ?.mercadoPagoNotificationUrl,
    );

  if (notificationUrl) {
    payload.notification_url =
      notificationUrl;
  }

  return payload;
}

function selectCheckoutUrl(
  preference,
  environment,
) {
  const initPoint =
    clean(preference?.init_point);

  const sandboxInitPoint =
    clean(
      preference
        ?.sandbox_init_point,
    );

  if (environment === "test") {
    return (
      sandboxInitPoint ||
      initPoint
    );
  }

  return (
    initPoint ||
    sandboxInitPoint
  );
}

async function recordPreferenceEvent(
  connection,
  event,
) {
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
      normalizeEnvironment(
        event.environment,
      ),
      event.status,
      clean(event.source),
      clean(event.preferenceId),
      clean(event.checkoutUrl),
      clean(
        event.fallbackCheckoutUrl,
      ),
      Number.isFinite(
        Number(event.failureStatus),
      )
        ? Number(event.failureStatus)
        : null,
      clean(event.failureReason),
      event.payload == null
        ? null
        : JSON.stringify(
            sanitizeLogValue(
              event.payload,
            ),
          ),
      event.response == null
        ? null
        : JSON.stringify(
            sanitizeLogValue(
              event.response,
            ),
          ),
    ],
  );
}

async function getCanonicalPreference(
  orderId,
  environment,
  connection,
) {
  const [rows] =
    await connection.execute(
      `
        SELECT
          order_id AS orderId,
          order_number AS orderNumber,
          environment,
          status,
          preference_id AS preferenceId,
          checkout_url AS checkoutUrl,
          attempt_count AS attemptCount,
          last_failure_status AS lastFailureStatus,
          last_failure_reason AS lastFailureReason,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM mercado_pago_checkout_preferences
        WHERE order_id = ?
          AND environment = ?
        LIMIT 1
      `,
      [
        orderId,
        environment,
      ],
    );

  return rows[0] || null;
}

async function claimPreferenceCreation(
  order,
  environment,
  connection,
) {
  const orderId =
    Number(order?.id || 0);

  const orderNumber =
    clean(order?.orderNumber);

  if (
    !Number.isInteger(orderId) ||
    orderId <= 0 ||
    !orderNumber
  ) {
    return {
      action: "INVALID",
      row: null,
    };
  }

  const [insertResult] =
    await connection.execute(
      `
        INSERT IGNORE INTO mercado_pago_checkout_preferences (
          order_id,
          order_number,
          environment,
          status,
          attempt_count
        ) VALUES (?, ?, ?, 'CREATING', 1)
      `,
      [
        orderId,
        orderNumber,
        environment,
      ],
    );

  if (
    Number(
      insertResult?.affectedRows || 0,
    ) === 1
  ) {
    return {
      action: "CREATE",
      row: await getCanonicalPreference(
        orderId,
        environment,
        connection,
      ),
    };
  }

  const current =
    await getCanonicalPreference(
      orderId,
      environment,
      connection,
    );

  if (
    current?.status === "READY" &&
    clean(current.preferenceId) &&
    clean(current.checkoutUrl)
  ) {
    return {
      action: "REUSE",
      row: current,
    };
  }

  const [claimResult] =
    await connection.execute(
      `
        UPDATE mercado_pago_checkout_preferences
        SET
          order_number = ?,
          status = 'CREATING',
          preference_id = NULL,
          checkout_url = NULL,
          attempt_count = attempt_count + 1,
          last_failure_status = NULL,
          last_failure_reason = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE order_id = ?
          AND environment = ?
          AND (
            status = 'FAILED'
            OR (
              status = 'CREATING'
              AND updated_at <
                DATE_SUB(
                  NOW(),
                  INTERVAL ${STALE_CREATION_SECONDS} SECOND
                )
            )
          )
      `,
      [
        orderNumber,
        orderId,
        environment,
      ],
    );

  if (
    Number(
      claimResult?.affectedRows || 0,
    ) === 1
  ) {
    return {
      action: "CREATE",
      row: await getCanonicalPreference(
        orderId,
        environment,
        connection,
      ),
    };
  }

  return {
    action: "BUSY",
    row: current,
  };
}

async function markPreferenceReady(
  order,
  environment,
  preference,
  connection,
) {
  const [result] =
    await connection.execute(
      `
        UPDATE mercado_pago_checkout_preferences
        SET
          status = 'READY',
          preference_id = ?,
          checkout_url = ?,
          last_failure_status = NULL,
          last_failure_reason = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE order_id = ?
          AND environment = ?
          AND status = 'CREATING'
      `,
      [
        clean(preference?.id),
        clean(
          preference?.checkoutUrl,
        ),
        Number(order.id),
        environment,
      ],
    );

  if (
    Number(
      result?.affectedRows || 0,
    ) !== 1
  ) {
    throw new Error(
      "Mercado Pago canonical preference update failed.",
    );
  }
}

async function markPreferenceFailed(
  order,
  environment,
  failure,
  connection,
) {
  await connection.execute(
    `
      UPDATE mercado_pago_checkout_preferences
      SET
        status = 'FAILED',
        preference_id = NULL,
        checkout_url = NULL,
        last_failure_status = ?,
        last_failure_reason = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE order_id = ?
        AND environment = ?
        AND status = 'CREATING'
    `,
    [
      Number.isFinite(
        Number(
          failure?.failureStatus,
        ),
      )
        ? Number(
            failure.failureStatus,
          )
        : null,
      clean(
        failure?.failureReason,
      ),
      Number(order.id),
      environment,
    ],
  );
}

function buildDetails(
  settings,
  preference = null,
) {
  const fallbackCheckoutUrl =
    clean(
      settings
        ?.mercadoPagoCheckoutUrl,
    );

  const checkoutUrl =
    clean(
      preference?.checkoutUrl,
    ) ||
    fallbackCheckoutUrl;

  const enabled = Boolean(
    settings?.isMercadoPagoEnabled &&
    checkoutUrl,
  );

  const preferenceFailed =
    preference?.source ===
      "dynamic_preference_failed" ||
    preference?.source ===
      "preference_creation_busy";

  const fields = [
    [
      "Link de pago",
      checkoutUrl,
    ],
    [
      "Preferencia Mercado Pago",
      preference?.id,
    ],
    [
      "Usuario / Collector ID",
      settings
        ?.mercadoPagoUserId,
    ],
    [
      "Referencia",
      settings
        ?.mercadoPagoPreferenceNote,
    ],
  ]
    .filter(
      ([, value]) =>
        clean(value),
    )
    .map(
      ([label, value]) => ({
        label,
        value: clean(value),
      }),
    );

  const instructions = [
    clean(
      settings
        ?.mercadoPagoInstructions,
    ),

    settings
        ?.isMercadoPagoEnabled &&
      !checkoutUrl
      ? (
          "Mercado Pago está habilitado, "
          + "pero no pudimos generar el "
          + "enlace de pago en este momento."
        )
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    method: "MERCADO_PAGO",
    label:
      getPaymentMethodLabel(
        "MERCADO_PAGO",
      ),
    title:
      "Datos para pagar con Mercado Pago",
    enabled,
    status:
      enabled
        ? "READY"
        : "TEMPORARILY_UNAVAILABLE",
    fields,
    instructions:
      clean(instructions),
    checkoutUrl,
    qrCodeUrl:
      buildQrCodeUrl(
        checkoutUrl,
      ),
    environment:
      normalizeEnvironment(
        preference?.environment ||
        settings
          ?.mercadoPagoEnvironment,
      ),
    source:
      preference?.source ||
      (
        fallbackCheckoutUrl
          ? "configured_link"
          : null
      ),
    retryable:
      !enabled ||
      preferenceFailed,
    preferenceFailureReason:
      preference
        ?.failureReason ||
      null,
  };
}

export async function prepareMercadoPagoCheckout(
  order,
  settings,
  connection = pool,
  options = {},
) {
  const environment =
    normalizeEnvironment(
      settings
        ?.mercadoPagoEnvironment,
    );

  const fallbackCheckoutUrl =
    clean(
      settings
        ?.mercadoPagoCheckoutUrl,
    );

  const accessToken =
    clean(
      settings
        ?.mercadoPagoAccessToken,
    );

  const baseEvent = {
    orderId:
      order?.id || null,
    orderNumber:
      order?.orderNumber || null,
    environment,
    fallbackCheckoutUrl,
  };

  if (
    !settings
      ?.isMercadoPagoEnabled
  ) {
    return buildDetails(
      settings,
      {
        environment,
        source:
          "provider_disabled",
      },
    );
  }

  if (!accessToken) {
    await recordPreferenceEvent(
      connection,
      {
        ...baseEvent,
        status:
          fallbackCheckoutUrl
            ? "SKIPPED"
            : "FAILED",
        source:
          fallbackCheckoutUrl
            ? "configured_link"
            : "dynamic_preference_skipped",
        failureReason:
          "mercado_pago_access_token_missing",
      },
    );

    return buildDetails(
      settings,
      {
        environment,
        source:
          fallbackCheckoutUrl
            ? "configured_link"
            : "dynamic_preference_failed",
        failureReason:
          "mercado_pago_access_token_missing",
      },
    );
  }

  const payload =
    buildMercadoPagoPreferencePayload(
      order,
      settings,
      options,
    );

  if (!payload) {
    await recordPreferenceEvent(
      connection,
      {
        ...baseEvent,
        status:
          fallbackCheckoutUrl
            ? "FALLBACK_USED"
            : "FAILED",
        source:
          "dynamic_preference_failed",
        failureReason:
          "mercado_pago_invalid_preference_payload",
      },
    );

    return buildDetails(
      settings,
      {
        environment,
        source:
          "dynamic_preference_failed",
        failureReason:
          "mercado_pago_invalid_preference_payload",
      },
    );
  }

  const claim =
    await claimPreferenceCreation(
      order,
      environment,
      connection,
    );

  if (
    claim.action === "REUSE"
  ) {
    return buildDetails(
      settings,
      {
        id:
          clean(
            claim.row
              ?.preferenceId,
          ),
        checkoutUrl:
          clean(
            claim.row
              ?.checkoutUrl,
          ),
        environment,
        source:
          "stored_preference",
      },
    );
  }

  if (
    claim.action === "BUSY"
  ) {
    return buildDetails(
      settings,
      {
        environment,
        source:
          "preference_creation_busy",
        failureReason:
          "mercado_pago_preference_creation_in_progress",
      },
    );
  }

  if (
    claim.action !== "CREATE"
  ) {
    return buildDetails(
      settings,
      {
        environment,
        source:
          "dynamic_preference_failed",
        failureReason:
          "mercado_pago_invalid_order_identity",
      },
    );
  }

  const fetchImpl =
    options.fetchImpl ||
    globalThis.fetch;

  if (
    typeof fetchImpl !== "function"
  ) {
    await markPreferenceFailed(
      order,
      environment,
      {
        failureReason:
          "mercado_pago_fetch_unavailable",
      },
      connection,
    );

    return buildDetails(
      settings,
      {
        environment,
        source:
          "dynamic_preference_failed",
        failureReason:
          "mercado_pago_fetch_unavailable",
      },
    );
  }

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      8000,
    );

  try {
    const response =
      await fetchImpl(
        MERCADO_PAGO_PREFERENCE_URL,
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${accessToken}`,
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify(
              payload,
            ),

          signal:
            controller.signal,
        },
      );

    if (!response.ok) {
      const responseText =
        await response
          .text()
          .catch(() => "");

      const failure = {
        failureStatus:
          response.status,
        failureReason:
          "mercado_pago_preference_response_not_ok",
      };

      await markPreferenceFailed(
        order,
        environment,
        failure,
        connection,
      );

      await recordPreferenceEvent(
        connection,
        {
          ...baseEvent,
          status:
            fallbackCheckoutUrl
              ? "FALLBACK_USED"
              : "FAILED",
          source:
            "dynamic_preference_failed",
          ...failure,
          payload,
          response:
            sanitizeLogValue(
              responseText,
            ),
        },
      );

      return buildDetails(
        settings,
        {
          environment,
          source:
            "dynamic_preference_failed",
          ...failure,
        },
      );
    }

    const remotePreference =
      await response.json();

    const checkoutUrl =
      selectCheckoutUrl(
        remotePreference,
        environment,
      );

    const preferenceId =
      clean(
        remotePreference?.id,
      );

    if (
      !preferenceId ||
      !checkoutUrl
    ) {
      const failure = {
        failureReason:
          "mercado_pago_preference_without_checkout_url",
      };

      await markPreferenceFailed(
        order,
        environment,
        failure,
        connection,
      );

      await recordPreferenceEvent(
        connection,
        {
          ...baseEvent,
          status:
            fallbackCheckoutUrl
              ? "FALLBACK_USED"
              : "FAILED",
          source:
            "dynamic_preference_failed",
          preferenceId,
          ...failure,
          payload,
          response:
            remotePreference,
        },
      );

      return buildDetails(
        settings,
        {
          id:
            preferenceId,
          environment,
          source:
            "dynamic_preference_failed",
          ...failure,
        },
      );
    }

    const canonical = {
      id:
        preferenceId,
      checkoutUrl,
      environment,
      source:
        "dynamic_preference",
    };

    await markPreferenceReady(
      order,
      environment,
      canonical,
      connection,
    );

    await recordPreferenceEvent(
      connection,
      {
        ...baseEvent,
        status:
          "CREATED",
        source:
          "dynamic_preference",
        preferenceId,
        checkoutUrl,
        payload,
        response:
          remotePreference,
      },
    );

    return buildDetails(
      settings,
      canonical,
    );
  } catch (error) {
    const failure = {
      failureReason:
        error?.name ===
          "AbortError"
          ? "mercado_pago_preference_timeout"
          : "mercado_pago_preference_exception",
    };

    await markPreferenceFailed(
      order,
      environment,
      failure,
      connection,
    );

    await recordPreferenceEvent(
      connection,
      {
        ...baseEvent,
        status:
          fallbackCheckoutUrl
            ? "FALLBACK_USED"
            : "FAILED",
        source:
          "dynamic_preference_failed",
        ...failure,
        payload,
        response: {
          name:
            error?.name || null,
        },
      },
    );

    return buildDetails(
      settings,
      {
        environment,
        source:
          "dynamic_preference_failed",
        ...failure,
      },
    );
  } finally {
    clearTimeout(timeout);
  }
}
