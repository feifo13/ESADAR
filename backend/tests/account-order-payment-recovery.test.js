import assert from "node:assert/strict";
import {
  readFileSync,
} from "node:fs";
import test from "node:test";

import {
  getAccountOrderDetail,
  retryAccountOrderPayment,
} from "../src/modules/account/account.service.js";
import {
  isOrderPaymentRetryEligible,
} from "../src/modules/orders/order-payment-retry-capability.js";

const baseOrder = Object.freeze({
  id: 42,
  orderNumber: "ORD-ACCOUNT-42",
  orderStatus: "RESERVED",
  paymentStatus: "PENDING",
  paymentMethod: "MERCADO_PAGO",
  reservedUntil: "2099-01-01T00:00:00.000Z",
  total: 1200,
  items: [],
  history: [],
});

function paymentProjection(overrides = {}) {
  return {
    orderId: 42,
    orderNumber: "ORD-ACCOUNT-42",
    orderStatus: "RESERVED",
    paymentStatus: "PENDING",
    paymentMethod: "MERCADO_PAGO",
    reservedUntil: "2099-01-01T00:00:00.000Z",
    latestProviderPaymentStatus: null,
    ...overrides,
  };
}

test("account order detail exposes only the local payment projection after ownership", async () => {
  const calls = [];
  const connection = {};

  const result = await getAccountOrderDetail(
    7,
    42,
    {
      connection,
      assertOwnership: async (userId, orderId) => {
        calls.push(["ownership", userId, orderId]);
      },
      loadOrder: async () => ({ ...baseOrder }),
      loadPaymentProjection: async (orderId, receivedConnection) => {
        assert.equal(orderId, 42);
        assert.equal(receivedConnection, connection);
        calls.push(["projection"]);
        return paymentProjection();
      },
      loadStoredPaymentInstructions: async (order, receivedConnection) => {
        assert.equal(order.id, 42);
        assert.equal(receivedConnection, connection);
        calls.push(["stored-instructions"]);
        return {
          method: "MERCADO_PAGO",
          enabled: true,
          status: "READY",
          checkoutUrl: "https://example.invalid/preference",
        };
      },
    },
  );

  assert.deepEqual(calls[0], ["ownership", 7, 42]);
  assert.equal(result.id, 42);
  assert.deepEqual(result.paymentRecovery, {
    orderStatus: "RESERVED",
    paymentStatus: "PENDING",
    reservedUntil: "2099-01-01T00:00:00.000Z",
    latestProviderPaymentStatus: null,
    instructionsStatus: "READY",
    checkoutUrl: "https://example.invalid/preference",
    paymentActionAllowed: true,
    retryAllowed: true,
  });
});

test("authoritative local pending payment blocks retry eligibility", () => {
  assert.equal(
    isOrderPaymentRetryEligible({
      ...baseOrder,
      latestProviderPaymentStatus: "PENDING",
    }),
    false,
  );

  assert.equal(
    isOrderPaymentRetryEligible({
      ...baseOrder,
      paymentStatus: "FAILED",
      latestProviderPaymentStatus: "REJECTED",
    }),
    true,
  );

  assert.equal(
    isOrderPaymentRetryEligible({
      ...baseOrder,
      orderStatus: "EXPIRED",
    }),
    false,
  );
});

test("authenticated account recovery reuses the existing capability and retry service", async () => {
  const connection = {};
  const token = "a".repeat(64);
  let issuedFor = null;
  let retryCall = null;

  const result = await retryAccountOrderPayment(
    7,
    42,
    { publicSiteUrl: "https://example.invalid" },
    {
      connection,
      assertOwnership: async () => {},
      loadOrder: async () => ({ ...baseOrder }),
      loadPaymentProjection: async () => paymentProjection(),
      issueCapability: async (order, receivedConnection) => {
        issuedFor = order;
        assert.equal(receivedConnection, connection);
        return token;
      },
      retryPayment: async (...args) => {
        retryCall = args;
        return {
          orderId: 42,
          orderNumber: "ORD-ACCOUNT-42",
          paymentInstructions: {
            method: "MERCADO_PAGO",
            status: "READY",
          },
          paymentActionAllowed: true,
        };
      },
    },
  );

  assert.equal(issuedFor.id, 42);
  assert.equal(retryCall[0], 42);
  assert.equal(retryCall[1], token);
  assert.equal(retryCall[3].connection, connection);
  assert.equal(result.orderId, 42);
});

test("cross-customer ownership failure blocks state inspection and payment action", async () => {
  const ownershipError = new Error("Order not found");
  let detailReads = 0;
  let actionCalls = 0;

  await assert.rejects(
    getAccountOrderDetail(
      8,
      42,
      {
        assertOwnership: async () => {
          throw ownershipError;
        },
        loadOrder: async () => {
          detailReads += 1;
          return baseOrder;
        },
      },
    ),
    ownershipError,
  );

  await assert.rejects(
    retryAccountOrderPayment(
      8,
      42,
      {},
      {
        assertOwnership: async () => {
          throw ownershipError;
        },
        loadOrder: async () => {
          actionCalls += 1;
          return baseOrder;
        },
        issueCapability: async () => {
          actionCalls += 1;
          return "a".repeat(64);
        },
        retryPayment: async () => {
          actionCalls += 1;
        },
      },
    ),
    ownershipError,
  );

  assert.equal(detailReads, 0);
  assert.equal(actionCalls, 0);
});

test("retry SQL blocks latest pending/approved payments and account rendering has no provider preparation", () => {
  const capabilitySource = readFileSync(
    new URL(
      "../src/modules/orders/order-payment-retry-capability.js",
      import.meta.url,
    ),
    "utf8",
  );
  const accountSource = readFileSync(
    new URL(
      "../src/modules/account/account.service.js",
      import.meta.url,
    ),
    "utf8",
  );
  const storedCheckoutSource = readFileSync(
    new URL(
      "../src/modules/payments/providers/mercado-pago.checkout-pro.service.js",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    capabilitySource,
    /COALESCE\([\s\S]*SELECT p\.status[\s\S]*IN \('NO_PAYMENT', 'FAILED', 'REJECTED'\)/,
  );
  assert.doesNotMatch(
    accountSource,
    /prepareOrderPayment|fetchMercadoPagoPayment/,
  );

  const storedReader = storedCheckoutSource.match(
    /export async function getStoredMercadoPagoCheckoutInstructions[\s\S]*?\n}\n\nexport async function prepareMercadoPagoCheckout/,
  )?.[0] || "";
  assert.match(storedReader, /getCanonicalPreference/);
  assert.doesNotMatch(storedReader, /fetchImpl|MERCADO_PAGO_PREFERENCE_URL/);
});

test("existing public retry endpoint accepts account recovery only through authenticated ownership flow", () => {
  const controllerSource = readFileSync(
    new URL(
      "../src/modules/orders/orders.controller.js",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    controllerSource,
    /accountRecovery[\s\S]*req\.auth\?\.userId[\s\S]*retryAccountOrderPayment/,
  );
  assert.match(
    controllerSource,
    /retryOrderPaymentSchema[\s\S]*retryCheckoutOrderPayment/,
  );

  const accountSource = readFileSync(
    new URL(
      "../src/modules/account/account.service.js",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    accountSource,
    /\? IS NOT NULL[\s\S]*customer_id = \?/,
  );
  assert.doesNotMatch(
    accountSource,
    /customer_id\s*<=>\s*\?/,
  );
});
