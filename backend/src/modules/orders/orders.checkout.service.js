import { AppError } from "../../utils/app-error.js";

import {
  prepareOrderPayment,
} from "../payments/payment-orchestrator.service.js";

import {
  authorizeOrderPaymentRetryCapability,
  issueOrderPaymentRetryCapability,
} from "./order-payment-retry-capability.js";

import {
  createOrder,
  getOrderDetail,
} from "./orders.service.js";

import {
  sendReceivedOrderPendingPaymentEmail,
} from "./orders.mailer.js";

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

  if (!order) {
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

  return {
    orderId:
      order.id,
    orderNumber:
      order.orderNumber,
    paymentInstructions,
  };
}
