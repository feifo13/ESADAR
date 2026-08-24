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
import {
  getCollectingSettings,
} from "../src/modules/collecting/collecting.service.js";
import {
  getStoredMercadoPagoCheckoutInstructions,
} from "../src/modules/payments/providers/mercado-pago.checkout-pro.service.js";

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

function createCollectingPreferenceConnection({
  mercadoPagoInstructions = null,
  preference = null,
  settingsRowPresent = true,
} = {}) {
  const calls = [];

  return {
    calls,
    async execute(statement, args = []) {
      const sql = String(statement);
      calls.push({ sql, args });

      if (/^\s*(?:INSERT|UPDATE|DELETE)\b/i.test(sql)) {
        return [{ affectedRows: 1 }];
      }

      if (sql.includes("FROM company_collecting_settings")) {
        return [settingsRowPresent
          ? [{
              id: 1,
              isMercadoPagoEnabled: 1,
              mercadoPagoEnvironment: "test",
              mercadoPagoCheckoutUrl: null,
              mercadoPagoInstructions,
            }]
          : []];
      }

      if (sql.includes("FROM mercado_pago_checkout_preferences")) {
        assert.deepEqual(args, [42, "test"]);
        return [[preference].filter(Boolean)];
      }

      throw new Error(
        "Unexpected SQL in account payment recovery regression test",
      );
    },
  };
}

function assertSelectOnlyCollectingReads(
  connection,
  {
    collectingSelectCount = 1,
    preferenceSelectCount = 1,
  } = {},
) {
  const statements = connection.calls.map(({ sql }) => sql.trim());
  const insertCount = statements.filter((sql) => /^INSERT\b/i.test(sql)).length;
  const updateCount = statements.filter((sql) => /^UPDATE\b/i.test(sql)).length;
  const deleteCount = statements.filter((sql) => /^DELETE\b/i.test(sql)).length;
  const upsertCount = statements.filter(
    (sql) => /\bON\s+DUPLICATE\s+KEY\s+UPDATE\b/i.test(sql),
  ).length;

  assert.equal(insertCount, 0);
  assert.equal(updateCount, 0);
  assert.equal(deleteCount, 0);
  assert.equal(upsertCount, 0);
  assert.equal(
    statements.every((sql) => /^SELECT\b/i.test(sql)),
    true,
  );
  assert.equal(
    statements.filter((sql) =>
      sql.includes("FROM company_collecting_settings")
    ).length,
    collectingSelectCount,
  );
  assert.equal(
    statements.filter((sql) =>
      sql.includes("FROM mercado_pago_checkout_preferences")
    ).length,
    preferenceSelectCount,
  );
}

test("canonical collecting settings getter preserves singleton initialization", async () => {
  const statements = [];
  const connection = {
    async execute(statement) {
      const sql = String(statement).trim();
      statements.push(sql);

      if (/^INSERT\b/i.test(sql)) {
        return [{ affectedRows: 1 }];
      }

      if (/^SELECT\b/i.test(sql)) {
        return [[]];
      }

      throw new Error("Unexpected collecting settings SQL");
    },
  };

  const settings = await getCollectingSettings(connection);

  assert.equal(settings.id, 1);
  assert.equal(statements.length, 2);
  assert.match(statements[0], /^INSERT\b/i);
  assert.match(statements[0], /\bON\s+DUPLICATE\s+KEY\s+UPDATE\b/i);
  assert.match(statements[1], /^SELECT\b/i);
});

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

test("real account detail path tolerates NULL Mercado Pago instructions without provider activity", async () => {
  const checkoutUrl = "https://www.mercadopago.com.uy/checkout/mock";
  const preference = {
    orderId: 42,
    orderNumber: "ORD-ACCOUNT-42",
    environment: "test",
    status: "READY",
    preferenceId: "pref-42",
    checkoutUrl,
    attemptCount: 1,
    lastFailureStatus: null,
    lastFailureReason: null,
  };
  const originalFetch = globalThis.fetch;
  let providerCallCount = 0;

  globalThis.fetch = async () => {
    providerCallCount += 1;
    throw new Error("Provider network call is forbidden while rendering an account order");
  };

  try {
    const confirmedConnection = createCollectingPreferenceConnection({
      mercadoPagoInstructions: null,
      preference,
    });
    const confirmed = await getAccountOrderDetail(
      7,
      42,
      {
        connection: confirmedConnection,
        assertOwnership: async () => {},
        loadOrder: async () => ({
          ...baseOrder,
          orderStatus: "APPROVED",
          paymentStatus: "PAID",
        }),
        loadPaymentProjection: async () => paymentProjection({
          orderStatus: "APPROVED",
          paymentStatus: "PAID",
          latestProviderPaymentStatus: "APPROVED",
        }),
      },
    );

    assert.deepEqual(confirmed.paymentRecovery, {
      orderStatus: "APPROVED",
      paymentStatus: "PAID",
      reservedUntil: "2099-01-01T00:00:00.000Z",
      latestProviderPaymentStatus: "APPROVED",
      instructionsStatus: "READY",
      checkoutUrl,
      paymentActionAllowed: false,
      retryAllowed: false,
    });

    const actionableConnection = createCollectingPreferenceConnection({
      mercadoPagoInstructions: null,
      preference,
    });
    const actionable = await getAccountOrderDetail(
      7,
      42,
      {
        connection: actionableConnection,
        assertOwnership: async () => {},
        loadOrder: async () => ({ ...baseOrder }),
        loadPaymentProjection: async () => paymentProjection(),
      },
    );

    assert.equal(actionable.paymentRecovery.orderStatus, "RESERVED");
    assert.equal(actionable.paymentRecovery.paymentStatus, "PENDING");
    assert.equal(actionable.paymentRecovery.instructionsStatus, "READY");
    assert.equal(actionable.paymentRecovery.checkoutUrl, checkoutUrl);
    assert.equal(actionable.paymentRecovery.paymentActionAllowed, true);
    assert.equal(actionable.paymentRecovery.retryAllowed, true);
    assertSelectOnlyCollectingReads(confirmedConnection);
    assertSelectOnlyCollectingReads(actionableConnection);
    assert.equal(providerCallCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("missing collecting settings row stays absent during account detail rendering", async () => {
  const connection = createCollectingPreferenceConnection({
    settingsRowPresent: false,
    preference: {
      orderId: 42,
      orderNumber: "ORD-ACCOUNT-42",
      environment: "test",
      status: "READY",
      preferenceId: "pref-42",
      checkoutUrl: "https://www.mercadopago.com.uy/checkout/mock",
      attemptCount: 1,
      lastFailureStatus: null,
      lastFailureReason: null,
    },
  });
  const originalFetch = globalThis.fetch;
  let providerCallCount = 0;

  globalThis.fetch = async () => {
    providerCallCount += 1;
    throw new Error("Provider network call is forbidden while rendering an account order");
  };

  try {
    const detail = await getAccountOrderDetail(
      7,
      42,
      {
        connection,
        assertOwnership: async () => {},
        loadOrder: async () => ({
          ...baseOrder,
          orderStatus: "APPROVED",
          paymentStatus: "PAID",
        }),
        loadPaymentProjection: async () => paymentProjection({
          orderStatus: "APPROVED",
          paymentStatus: "PAID",
          latestProviderPaymentStatus: "APPROVED",
        }),
      },
    );
    const storedInstructions =
      await getStoredMercadoPagoCheckoutInstructions(
        baseOrder,
        connection,
      );

    assert.equal(detail.paymentRecovery.orderStatus, "APPROVED");
    assert.equal(detail.paymentRecovery.paymentStatus, "PAID");
    assert.equal(detail.paymentRecovery.paymentActionAllowed, false);
    assert.equal(detail.paymentRecovery.retryAllowed, false);
    assert.equal(storedInstructions.instructions, null);
    assertSelectOnlyCollectingReads(connection, {
      collectingSelectCount: 2,
      preferenceSelectCount: 2,
    });
    assert.equal(providerCallCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("stored checkout reader preserves optional supplemental instructions without provider activity", async () => {
  const checkoutUrl = "https://www.mercadopago.com.uy/checkout/mock";
  const connection = createCollectingPreferenceConnection({
    mercadoPagoInstructions: "Información suplementaria",
    preference: {
      orderId: 42,
      orderNumber: "ORD-ACCOUNT-42",
      environment: "test",
      status: "READY",
      preferenceId: "pref-42",
      checkoutUrl,
      attemptCount: 1,
      lastFailureStatus: null,
      lastFailureReason: null,
    },
  });
  const originalFetch = globalThis.fetch;
  let providerCallCount = 0;

  globalThis.fetch = async () => {
    providerCallCount += 1;
    throw new Error("Provider network call is forbidden while reading stored checkout data");
  };

  try {
    const result = await getStoredMercadoPagoCheckoutInstructions(
      baseOrder,
      connection,
    );

    assert.equal(result.status, "READY");
    assert.equal(result.checkoutUrl, checkoutUrl);
    assert.equal(result.instructions, "Información suplementaria");
    assertSelectOnlyCollectingReads(connection);
    assert.equal(providerCallCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
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
