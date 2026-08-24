import { AppError } from "../../utils/app-error.js";
import { pool } from "../../db/pool.js";

import {
  prepareOrderPayment,
} from "../payments/payment-orchestrator.service.js";

import {
  authorizeOrderPaymentReturnCapability,
  authorizeOrderPaymentRetryCapability,
  isOrderPaymentRetryEligible,
  issueOrderPaymentRetryCapability,
} from "./order-payment-retry-capability.js";

import {
  applyMercadoPagoPaymentToOrder,
  createOrder,
  getOrderDetail,
} from "./orders.service.js";

import {
  sendReceivedOrderPendingPaymentEmail,
} from "./orders.mailer.js";

import {
  getCollectingSettings,
} from "../collecting/collecting.service.js";

import {
  evaluateMercadoPagoReconciliation,
} from "../payments/providers/mercado-pago.reconciliation.js";

import {
  fetchMercadoPagoPayment,
} from "../payments/providers/mercado-pago.payment.service.js";

export async function createCheckoutOrder(
  input,
  actor,
  auditContext = {},
) {
  const order = await createOrder(
    input,
    actor,
    auditContext,
  );

  const paymentInstructions =
    await prepareOrderPayment(
      order,
      undefined,
      {
        publicSiteUrl:
          auditContext.publicSiteUrl,
      },
    );

  let paymentRetryToken = null;

  if (
    paymentInstructions?.method
    === "MERCADO_PAGO"
  ) {
    try {
      paymentRetryToken =
        await issueOrderPaymentRetryCapability(
          order,
        );
    } catch (error) {
      console.error(
        "[orders] payment retry capability issue failed",
        {
          orderId:
            order?.id || null,
          errorName:
            error?.name || "Error",
        },
      );
    }
  }

  const enrichedOrder = {
    ...order,
    paymentInstructions,
    paymentRetryToken,
    paymentActionAllowed:
      Boolean(paymentRetryToken)
      && isOrderPaymentRetryEligible(
        order,
      ),
  };

  const mailOrder = {
    ...order,
    paymentInstructions,
  };

  sendReceivedOrderPendingPaymentEmail(
    mailOrder,
    {
      publicSiteUrl:
        auditContext.publicSiteUrl,
    },
  ).catch((error) => {
    console.warn(
      "[orders] received order pending payment email failed",
      error?.message || error,
    );
  });

  return enrichedOrder;
}

export async function getLocalOrderPaymentStatusProjection(
  orderId,
  connection = pool,
) {
  const [rows] =
    await connection.execute(
      `
        SELECT
          o.id AS orderId,
          o.order_number AS orderNumber,
          o.payment_method AS paymentMethod,
          o.order_status AS orderStatus,
          o.payment_status AS paymentStatus,
          o.reserved_until AS reservedUntil,
          (
            SELECT p.status
            FROM payments p
            WHERE p.order_id = o.id
            ORDER BY p.updated_at DESC, p.id DESC
            LIMIT 1
          ) AS latestProviderPaymentStatus
        FROM orders o
        WHERE o.id = ?
          AND o.payment_method = 'MERCADO_PAGO'
        LIMIT 1
      `,
      [Number(orderId)],
    );

  const row = rows?.[0] || null;

  if (!row) return null;

  const projection = {
    orderId: Number(row.orderId),
    orderNumber: String(row.orderNumber || ""),
    paymentMethod: String(row.paymentMethod || ""),
    orderStatus: String(row.orderStatus || ""),
    paymentStatus: String(row.paymentStatus || ""),
    reservedUntil: row.reservedUntil || null,
    latestProviderPaymentStatus:
      row.latestProviderPaymentStatus
        ? String(row.latestProviderPaymentStatus)
        : null,
  };

  return {
    ...projection,
    paymentActionAllowed:
      isOrderPaymentRetryEligible(
        projection,
      ),
  };
}

export async function getCheckoutOrderPaymentStatus(
  orderId,
  retryToken,
  dependencies = {},
) {
  const normalizedOrderId =
    Number(orderId || 0);

  const connection =
    dependencies.connection || pool;

  const authorize =
    dependencies.authorize
    || authorizeOrderPaymentReturnCapability;

  const capability =
    await authorize(
      normalizedOrderId,
      retryToken,
      connection,
    );

  if (!capability) {
    throw new AppError(
      "No pudimos consultar el estado de esta orden.",
      404,
    );
  }

  const loadProjection =
    dependencies.loadProjection
    || getLocalOrderPaymentStatusProjection;

  const projection =
    await loadProjection(
      normalizedOrderId,
      connection,
    );

  if (
    !projection
    || Number(projection.orderId)
      !== normalizedOrderId
    || projection.paymentMethod
      !== "MERCADO_PAGO"
  ) {
    throw new AppError(
      "No pudimos consultar el estado de esta orden.",
      404,
    );
  }

  return projection;
}

export async function retryCheckoutOrderPayment(
  orderId,
  retryToken,
  auditContext = {},
  dependencies = {},
) {
  const connection =
    dependencies.connection;

  const authorize =
    dependencies.authorize
    || authorizeOrderPaymentRetryCapability;

  const loadOrder =
    dependencies.loadOrder
    || getOrderDetail;

  const loadProjection =
    dependencies.loadProjection
    || getLocalOrderPaymentStatusProjection;

  const prepare =
    dependencies.prepare
    || prepareOrderPayment;

  const capability =
    await authorize(
      orderId,
      retryToken,
      connection,
    );

  if (!capability) {
    throw new AppError(
      "No se pudo reintentar el pago de esta orden.",
      404,
    );
  }

  const order =
    await loadOrder(
      Number(orderId),
    );

  const projection =
    await loadProjection(
      Number(orderId),
      connection,
    );

  const sameOrder =
    Number(projection?.orderId)
      === Number(order?.id)
    && String(projection?.orderNumber || "")
      === String(order?.orderNumber || "")
    && projection?.paymentMethod
      === "MERCADO_PAGO";

  if (
    !sameOrder
    || !isOrderPaymentRetryEligible(
      projection,
    )
  ) {
    throw new AppError(
      "No se pudo reintentar el pago de esta orden.",
      404,
    );
  }

  const paymentInstructions =
    await prepare(
      order,
      connection,
      {
        publicSiteUrl:
          auditContext.publicSiteUrl,
      },
    );

  const refreshedProjection =
    await loadProjection(
      Number(orderId),
      connection,
    );

  const stillSameOrder =
    Number(refreshedProjection?.orderId)
      === Number(order.id)
    && String(
      refreshedProjection?.orderNumber
      || "",
    ) === String(order.orderNumber || "")
    && refreshedProjection?.paymentMethod
      === "MERCADO_PAGO";

  if (
    !stillSameOrder
    || !isOrderPaymentRetryEligible(
      refreshedProjection,
    )
  ) {
    throw new AppError(
      "No se pudo reintentar el pago de esta orden.",
      404,
    );
  }

  return {
    orderId:
      order.id,
    orderNumber:
      order.orderNumber,
    paymentInstructions,
    paymentActionAllowed: true,
  };
}

function normalizeReturnedMercadoPagoPaymentId(
  value,
) {
  const text =
    String(value ?? "").trim();

  return /^\d{1,40}$/.test(text)
    ? text
    : "";
}

export async function reconcileReturnedMercadoPagoPayment(
  orderId,
  paymentId,
  retryToken,
  auditContext = {},
  dependencies = {},
) {
  const normalizedOrderId =
    Number(orderId || 0);

  const normalizedPaymentId =
    normalizeReturnedMercadoPagoPaymentId(
      paymentId,
    );

  if (
    !Number.isInteger(normalizedOrderId)
    || normalizedOrderId <= 0
    || !normalizedPaymentId
  ) {
    throw new AppError(
      "No pudimos validar el pago de esta orden.",
      404,
    );
  }

  const authorize =
    dependencies.authorize
    || authorizeOrderPaymentReturnCapability;

  const capability =
    await authorize(
      normalizedOrderId,
      retryToken,
      dependencies.connection,
    );

  if (!capability) {
    throw new AppError(
      "No pudimos validar el pago de esta orden.",
      404,
    );
  }

  const loadOrder =
    dependencies.loadOrder
    || getOrderDetail;

  const order =
    await loadOrder(
      normalizedOrderId,
    );

  if (
    !order
    || order.paymentMethod !== "MERCADO_PAGO"
  ) {
    throw new AppError(
      "No pudimos validar el pago de esta orden.",
      404,
    );
  }

  const loadSettings =
    dependencies.loadSettings
    || getCollectingSettings;

  const settings =
    await loadSettings();

  if (
    !settings?.isMercadoPagoEnabled
    || !String(
      settings?.mercadoPagoAccessToken
      || "",
    ).trim()
  ) {
    throw new AppError(
      "No pudimos confirmar el pago en este momento.",
      503,
    );
  }

  const fetchPayment =
    dependencies.fetchPayment
    || fetchMercadoPagoPayment;

  const paymentResponse =
    await fetchPayment(
      normalizedPaymentId,
      settings.mercadoPagoAccessToken,
    );

  if (!paymentResponse?.ok) {
    throw new AppError(
      "No pudimos confirmar el pago en este momento.",
      502,
    );
  }

  const payment =
    paymentResponse.payment;

  const authoritativePaymentId =
    normalizeReturnedMercadoPagoPaymentId(
      payment?.id,
    );

  if (
    !authoritativePaymentId
    || authoritativePaymentId
      !== normalizedPaymentId
  ) {
    throw new AppError(
      "No pudimos validar el pago de esta orden.",
      409,
    );
  }

  const evaluate =
    dependencies.evaluate
    || evaluateMercadoPagoReconciliation;

  const reconciliation =
    evaluate(
      payment,
      order,
    );

  /*
   * El retorno no prueba el pago.
   * El GET autoritativo debe identificar esta misma
   * orden y coincidir en identidad, monto y moneda
   * antes de reutilizar el apply canónico.
   */
  if (
    !reconciliation?.automaticApprovalAllowed
  ) {
    throw new AppError(
      "El pago informado no coincide con esta orden.",
      409,
    );
  }

  const applyPayment =
    dependencies.applyPayment
    || applyMercadoPagoPaymentToOrder;

  const applyResult =
    await applyPayment(
      payment,
      {
        ...auditContext,
        actorUserId: null,
        actorLabel:
          "Mercado Pago return verification",
      },
    );

  const refreshedOrder =
    await loadOrder(
      normalizedOrderId,
    );

  const sameOrder =
    Number(refreshedOrder?.id)
      === normalizedOrderId
    && String(
      refreshedOrder?.orderNumber
      || "",
    ) === String(
      order?.orderNumber
      || "",
    );

  if (!sameOrder) {
    throw new AppError(
      "No pudimos confirmar el estado final de la orden.",
      500,
    );
  }

  const confirmed =
    refreshedOrder?.paymentStatus
      === "PAID"
    && [
      "APPROVED",
      "SHIPPED",
    ].includes(
      refreshedOrder?.orderStatus,
    );

  return {
    orderId:
      refreshedOrder.id,
    orderNumber:
      refreshedOrder.orderNumber,
    paymentStatus:
      refreshedOrder.paymentStatus,
    orderStatus:
      refreshedOrder.orderStatus,
    confirmed,
    reconciliationStatus:
      applyResult?.status
      || "unknown",
    manualReviewRequired:
      Boolean(
        applyResult
          ?.manualReviewRequired,
      ),
  };
}
