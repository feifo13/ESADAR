import {
  prepareOrderPayment,
} from "../payments/payment-orchestrator.service.js";

import {
  createOrder,
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

  const enrichedOrder = {
    ...order,
    paymentInstructions,
  };

  sendReceivedOrderPendingPaymentEmail(
    enrichedOrder,
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
