import test from "node:test";
import assert from "node:assert/strict";

import {
  authorizeOrderPaymentReturnCapability,
} from "../src/modules/orders/order-payment-retry-capability.js";

import {
  reconcileReturnedMercadoPagoPayment,
} from "../src/modules/orders/orders.checkout.service.js";

const TOKEN = "a".repeat(64);

function order(overrides = {}) {
  return {
    id: 18,
    orderNumber: "ORD-RETURN-18",
    total: 445,
    paymentMethod: "MERCADO_PAGO",
    paymentStatus: "PENDING",
    orderStatus: "RESERVED",
    ...overrides,
  };
}

function payment(overrides = {}) {
  return {
    id: "123456789",
    status: "approved",
    transaction_amount: 445,
    currency_id: "UYU",
    external_reference: "ORD-RETURN-18",
    metadata: {
      order_id: 18,
      order_number: "ORD-RETURN-18",
    },
    ...overrides,
  };
}

function dependencies(overrides = {}) {
  let loadCount = 0;

  return {
    authorize:
      async () => ({
        orderId: 18,
      }),

    loadSettings:
      async () => ({
        isMercadoPagoEnabled: true,
        mercadoPagoAccessToken:
          "test-access-token",
      }),

    fetchPayment:
      async () => ({
        ok: true,
        payment: payment(),
      }),

    loadOrder:
      async () => {
        loadCount += 1;

        return loadCount === 1
          ? order()
          : order({
              paymentStatus: "PAID",
              orderStatus: "APPROVED",
            });
      },

    applyPayment:
      async () => ({
        status: "processed",
        manualReviewRequired: false,
      }),

    ...overrides,
  };
}

test(
  "return capability validates token without requiring pending order state",
  async () => {
    let sql = "";

    const connection = {
      execute:
        async (statement) => {
          sql = String(statement);

          return [[{
            orderId: 18,
            orderStatus: "APPROVED",
            paymentStatus: "PAID",
          }]];
        },
    };

    const result =
      await authorizeOrderPaymentReturnCapability(
        18,
        TOKEN,
        connection,
      );

    assert.equal(
      result.orderId,
      18,
    );

    assert.match(
      sql,
      /oprc\.expires_at > NOW\(\)/,
    );

    assert.match(
      sql,
      /o\.payment_method = 'MERCADO_PAGO'/,
    );

    assert.doesNotMatch(
      sql,
      /o\.order_status = 'RESERVED'/,
    );

    assert.doesNotMatch(
      sql,
      /o\.payment_status = 'PENDING'/,
    );
  },
);

test(
  "invalid capability stops before provider GET",
  async () => {
    let fetched = false;

    await assert.rejects(
      () =>
        reconcileReturnedMercadoPagoPayment(
          18,
          "123456789",
          TOKEN,
          {},
          dependencies({
            authorize:
              async () => null,
            fetchPayment:
              async () => {
                fetched = true;
                return {
                  ok: true,
                  payment: payment(),
                };
              },
          }),
        ),
      /No pudimos validar el pago/i,
    );

    assert.equal(fetched, false);
  },
);

test(
  "identity mismatch never applies payment",
  async () => {
    let applied = false;

    await assert.rejects(
      () =>
        reconcileReturnedMercadoPagoPayment(
          18,
          "123456789",
          TOKEN,
          {},
          dependencies({
            fetchPayment:
              async () => ({
                ok: true,
                payment:
                  payment({
                    external_reference:
                      "ORD-OTHER",
                  }),
              }),
            applyPayment:
              async () => {
                applied = true;
                return {
                  status: "processed",
                };
              },
          }),
        ),
      /no coincide con esta orden/i,
    );

    assert.equal(applied, false);
  },
);

test(
  "different authoritative payment id is rejected",
  async () => {
    let applied = false;

    await assert.rejects(
      () =>
        reconcileReturnedMercadoPagoPayment(
          18,
          "123456789",
          TOKEN,
          {},
          dependencies({
            fetchPayment:
              async () => ({
                ok: true,
                payment:
                  payment({
                    id: "987654321",
                  }),
              }),
            applyPayment:
              async () => {
                applied = true;
                return {
                  status: "processed",
                };
              },
          }),
        ),
      /No pudimos validar el pago/i,
    );

    assert.equal(applied, false);
  },
);

test(
  "valid authoritative payment reuses canonical apply path",
  async () => {
    let applied = 0;

    const result =
      await reconcileReturnedMercadoPagoPayment(
        18,
        "123456789",
        TOKEN,
        {},
        dependencies({
          applyPayment:
            async () => {
              applied += 1;
              return {
                status: "processed",
                manualReviewRequired: false,
              };
            },
        }),
      );

    assert.equal(applied, 1);
    assert.equal(result.orderId, 18);
    assert.equal(
      result.orderNumber,
      "ORD-RETURN-18",
    );
    assert.equal(
      result.paymentStatus,
      "PAID",
    );
    assert.equal(
      result.orderStatus,
      "APPROVED",
    );
    assert.equal(
      result.confirmed,
      true,
    );
  },
);

test(
  "webhook already winning race remains confirmed and idempotent",
  async () => {
    const paidOrder =
      order({
        paymentStatus: "PAID",
        orderStatus: "APPROVED",
      });

    const result =
      await reconcileReturnedMercadoPagoPayment(
        18,
        "123456789",
        TOKEN,
        {},
        dependencies({
          loadOrder:
            async () => paidOrder,
          applyPayment:
            async () => ({
              status: "ignored",
              manualReviewRequired: false,
            }),
        }),
      );

    assert.equal(
      result.confirmed,
      true,
    );
    assert.equal(
      result.paymentStatus,
      "PAID",
    );
    assert.equal(
      result.orderStatus,
      "APPROVED",
    );
  },
);

test(
  "canonical Mercado Pago apply preserves caller provenance",
  async () => {
    const {
      readFile,
    } = await import(
      "node:fs/promises"
    );

    const source =
      await readFile(
        new URL(
          "../src/modules/orders/orders.service.js",
          import.meta.url,
        ),
        "utf8",
      );

    const marker =
      "export async function "
      + "applyMercadoPagoPaymentToOrder(";

    const start =
      source.indexOf(marker);

    assert.ok(start >= 0);

    const next =
      source.indexOf(
        "\nexport ",
        start + 1,
      );

    const applySource =
      next >= 0
        ? source.slice(start, next)
        : source.slice(start);

    assert.equal(
      (
        applySource.match(
          /actorLabel:\s*"Mercado Pago webhook"/g,
        )
        || []
      ).length,
      0,
    );

    assert.equal(
      (
        applySource.match(
          /actorLabel:\s*auditContext\.actorLabel\s*\|\|\s*"Mercado Pago webhook"/g,
        )
        || []
      ).length,
      9,
    );
  },
);

test(
  "confirmed Mercado Pago return hides all additional payment actions",
  async () => {
    const {
      readFile,
    } = await import(
      "node:fs/promises"
    );

    const source =
      await readFile(
        new URL(
          "../../frontend/src/pages/CheckoutCompletePage.jsx",
          import.meta.url,
        ),
        "utf8",
      );

    assert.match(
      source,
      /const showMercadoPagoCheckout\s*=[\s\S]{0,220}?&& !mercadoPagoConfirmed;/,
    );

    assert.match(
      source,
      /const mercadoPagoUnavailable\s*=[\s\S]{0,220}?&& !mercadoPagoConfirmed[\s\S]{0,100}?&& !mercadoPagoReady;/,
    );

    assert.match(
      source,
      /\{!mercadoPagoConfirmed[\s\S]{0,100}?&& !mercadoPagoUnavailable[\s\S]{0,100}?&& paymentInstructions\?\.instructions \? \(/,
    );
  },
);

test(
  "authoritative return forces system audit provenance for authenticated caller",
  async () => {
    let receivedAuditContext = null;

    await reconcileReturnedMercadoPagoPayment(
      18,
      "123456789",
      TOKEN,
      {
        actorUserId: 77,
        actorLabel:
          "authenticated-customer@example.test",
        source: "FRONTEND",
        ipAddress: "127.0.0.1",
        userAgent: "test-agent",
      },
      dependencies({
        applyPayment:
          async (
            _payment,
            auditContext,
          ) => {
            receivedAuditContext =
              auditContext;

            return {
              status: "processed",
              manualReviewRequired: false,
            };
          },
      }),
    );

    assert.equal(
      receivedAuditContext?.actorLabel,
      "Mercado Pago return verification",
    );

    /*
     * La confirmación es una acción de sistema.
     * Conservamos contexto de transporte, no identidad humana
     * como actor de la aprobación.
     */
    assert.equal(
      receivedAuditContext?.actorUserId,
      null,
    );

    assert.equal(
      receivedAuditContext?.source,
      "FRONTEND",
    );

    assert.equal(
      receivedAuditContext?.ipAddress,
      "127.0.0.1",
    );

    assert.equal(
      receivedAuditContext?.userAgent,
      "test-agent",
    );
  },
);
