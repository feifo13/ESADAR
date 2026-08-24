import assert from "node:assert/strict";
import {
  readFileSync,
} from "node:fs";
import test from "node:test";

import {
  authorizeOrderPaymentRetryCapability,
  generateOrderPaymentRetryToken,
  hashOrderPaymentRetryToken,
  issueOrderPaymentRetryCapability,
} from "../src/modules/orders/order-payment-retry-capability.js";

import {
  retryCheckoutOrderPayment,
} from "../src/modules/orders/orders.checkout.service.js";

import {
  retryOrderPaymentSchema,
} from "../src/modules/orders/orders.payment-retry.schemas.js";

function eligibleProjection(overrides = {}) {
  return {
    orderId: 42,
    orderNumber:
      "ORD-RETRY-42",
    paymentMethod:
      "MERCADO_PAGO",
    orderStatus:
      "RESERVED",
    paymentStatus:
      "PENDING",
    reservedUntil:
      "2099-01-01T00:00:00.000Z",
    latestProviderPaymentStatus:
      null,
    ...overrides,
  };
}


test(
  "retry capability uses 256-bit opaque token and stores only its SHA-256 hash",
  async () => {
    const calls = [];

    const connection = {
      async execute(sql, args) {
        calls.push({
          sql: String(sql),
          args,
        });

        return [
          {
            affectedRows: 1,
          },
        ];
      },
    };

    const token =
      await issueOrderPaymentRetryCapability(
        {
          id: 42,
        },
        connection,
      );

    assert.match(
      token,
      /^[a-f0-9]{64}$/,
    );

    assert.equal(
      calls.length,
      1,
    );

    assert.match(
      calls[0].sql,
      /order_payment_retry_capabilities/,
    );

    assert.match(
      calls[0].sql,
      /payment_method = 'MERCADO_PAGO'/,
    );

    const storedHash =
      calls[0].args[0];

    assert.equal(
      storedHash,
      hashOrderPaymentRetryToken(token),
    );

    assert.notEqual(
      storedHash,
      token,
    );
  },
);


test(
  "retry capability authorization hashes token and returns no customer data",
  async () => {
    const token =
      generateOrderPaymentRetryToken();

    const connection = {
      async execute(sql, args) {
        assert.match(
          String(sql),
          /token_hash = \?/,
        );

        assert.match(
          String(sql),
          /o\.payment_method = 'MERCADO_PAGO'/,
        );

        assert.match(
          String(sql),
          /o\.payment_status IN \('PENDING', 'FAILED'\)/,
        );

        assert.deepEqual(
          args,
          [
            42,
            hashOrderPaymentRetryToken(
              token,
            ),
          ],
        );

        return [
          [
            {
              orderId: 42,
              expiresAt:
                "2099-01-01 00:00:00",
            },
          ],
        ];
      },
    };

    const result =
      await authorizeOrderPaymentRetryCapability(
        42,
        token,
        connection,
      );

    assert.deepEqual(
      result,
      {
        orderId: 42,
        expiresAt:
          "2099-01-01 00:00:00",
      },
    );
  },
);


test(
  "invalid retry capability fails before order lookup or provider preparation",
  async () => {
    let loadCount = 0;
    let projectionCount = 0;
    let prepareCount = 0;

    await assert.rejects(
      () =>
        retryCheckoutOrderPayment(
          42,
          "0".repeat(64),
          {},
          {
            authorize:
              async () => null,

            loadOrder:
              async () => {
                loadCount += 1;
                return {};
              },

            loadProjection:
              async () => {
                projectionCount += 1;
                return {};
              },

            prepare:
              async () => {
                prepareCount += 1;
                return {};
              },
          },
        ),
      (error) =>
        Number(error?.statusCode)
          === 404,
    );

    assert.equal(
      loadCount,
      0,
    );

    assert.equal(
      projectionCount,
      0,
    );

    assert.equal(
      prepareCount,
      0,
    );
  },
);


test(
  "valid retry capability re-prepares payment for same order only",
  async () => {
    const order =
      Object.freeze({
        id: 42,
        orderNumber:
          "ORD-RETRY-42",
        paymentMethod:
          "MERCADO_PAGO",
      });

    let prepareCount = 0;
    let preparedOrder = null;

    const result =
      await retryCheckoutOrderPayment(
        42,
        "a".repeat(64),
        {
          publicSiteUrl:
            "https://sandbox.esadar.com.uy",
        },
        {
          authorize:
            async () => ({
              orderId: 42,
            }),

          loadOrder:
            async (orderId) => {
              assert.equal(
                orderId,
                42,
              );

              return order;
            },

          loadProjection:
            async (
              orderId,
            ) => {
              assert.equal(
                orderId,
                42,
              );

              return eligibleProjection();
            },

          prepare:
            async (
              receivedOrder,
              _connection,
              options,
            ) => {
              prepareCount += 1;
              preparedOrder =
                receivedOrder;

              assert.equal(
                options.publicSiteUrl,
                "https://sandbox.esadar.com.uy",
              );

              return {
                method:
                  "MERCADO_PAGO",
                enabled:
                  true,
                status:
                  "READY",
                checkoutUrl:
                  "https://example.invalid/preference",
                retryable:
                  false,
              };
            },
        },
      );

    assert.equal(
      prepareCount,
      1,
    );

    assert.equal(
      preparedOrder,
      order,
    );

    assert.equal(
      result.orderId,
      42,
    );

    assert.equal(
      result.orderNumber,
      "ORD-RETRY-42",
    );

    assert.equal(
      result.paymentInstructions
        .status,
      "READY",
    );

    assert.equal(
      result.paymentActionAllowed,
      true,
    );
  },
);


test(
  "click-time revalidation blocks state transitions before provider preparation",
  async () => {
    const order = {
      id: 42,
      orderNumber:
        "ORD-RETRY-42",
      paymentMethod:
        "MERCADO_PAGO",
    };

    const unsafeTransitions = [
      [
        "approved before click",
        {
          orderStatus: "APPROVED",
          paymentStatus: "PAID",
          latestProviderPaymentStatus:
            "APPROVED",
        },
      ],
      [
        "provider pending before click",
        {
          latestProviderPaymentStatus:
            "PENDING",
        },
      ],
      [
        "provider approved awaiting manual review before click",
        {
          latestProviderPaymentStatus:
            "APPROVED",
        },
      ],
      [
        "reservation expired before click",
        {
          paymentStatus: "FAILED",
          reservedUntil:
            "2000-01-01T00:00:00.000Z",
          latestProviderPaymentStatus:
            "REJECTED",
        },
      ],
    ];

    let prepareCount = 0;

    for (const [name, transition] of unsafeTransitions) {
      await assert.rejects(
        () => retryCheckoutOrderPayment(
          42,
          "a".repeat(64),
          {},
          {
            authorize:
              async () => ({ orderId: 42 }),
            loadOrder:
              async () => order,
            loadProjection:
              async () => eligibleProjection(
                transition,
              ),
            prepare:
              async () => {
                prepareCount += 1;
                return {};
              },
          },
        ),
        (error) =>
          Number(error?.statusCode) === 404,
        name,
      );
    }

    assert.equal(
      prepareCount,
      0,
    );
  },
);


test(
  "authoritative failed remains eligible after click-time revalidation",
  async () => {
    let prepareCount = 0;

    const result =
      await retryCheckoutOrderPayment(
        42,
        "a".repeat(64),
        {},
        {
          authorize:
            async () => ({ orderId: 42 }),
          loadOrder:
            async () => ({
              id: 42,
              orderNumber:
                "ORD-RETRY-42",
              paymentMethod:
                "MERCADO_PAGO",
            }),
          loadProjection:
            async () => eligibleProjection({
              paymentStatus: "FAILED",
              latestProviderPaymentStatus:
                "REJECTED",
            }),
          prepare:
            async () => {
              prepareCount += 1;
              return {
                method:
                  "MERCADO_PAGO",
                enabled: true,
                status: "READY",
                checkoutUrl:
                  "https://example.invalid/reused-preference",
              };
            },
        },
      );

    assert.equal(prepareCount, 1);
    assert.equal(
      result.paymentActionAllowed,
      true,
    );
    assert.equal(
      result.paymentInstructions
        .checkoutUrl,
      "https://example.invalid/reused-preference",
    );
  },
);


test(
  "state transition during preference preparation blocks the redirect response",
  async () => {
    let projectionCount = 0;
    let prepareCount = 0;

    await assert.rejects(
      () => retryCheckoutOrderPayment(
        42,
        "a".repeat(64),
        {},
        {
          authorize:
            async () => ({ orderId: 42 }),
          loadOrder:
            async () => ({
              id: 42,
              orderNumber:
                "ORD-RETRY-42",
              paymentMethod:
                "MERCADO_PAGO",
            }),
          loadProjection:
            async () => {
              projectionCount += 1;

              return projectionCount === 1
                ? eligibleProjection()
                : eligibleProjection({
                    orderStatus: "APPROVED",
                    paymentStatus: "PAID",
                    latestProviderPaymentStatus:
                      "APPROVED",
                  });
            },
          prepare:
            async () => {
              prepareCount += 1;
              return {
                method: "MERCADO_PAGO",
                enabled: true,
                status: "READY",
                checkoutUrl:
                  "https://example.invalid/preference",
              };
            },
        },
      ),
      (error) =>
        Number(error?.statusCode) === 404,
    );

    assert.equal(projectionCount, 2);
    assert.equal(prepareCount, 1);
  },
);


test(
  "retry request schema accepts only opaque 64-hex capability",
  () => {
    assert.equal(
      retryOrderPaymentSchema
        .parse({
          retryToken:
            "a".repeat(64),
        })
        .retryToken,
      "a".repeat(64),
    );

    assert.throws(
      () =>
        retryOrderPaymentSchema.parse({
          retryToken:
            "guessable-token",
        }),
    );
  },
);


test(
  "public retry route uses checkout rate limit and does not expose admin route",
  () => {
    const source =
      readFileSync(
        new URL(
          "../src/modules/orders/orders.routes.js",
          import.meta.url,
        ),
        "utf8",
      );

    assert.match(
      source,
      /'\/:id\/payment\/retry'/,
    );

    assert.match(
      source,
      /optionalAuth[\s\S]*checkoutRateLimit[\s\S]*retryPublicOrderPayment/,
    );
  },
);


test(
  "checkout response issues retry token separately from mail payload",
  () => {
    const source =
      readFileSync(
        new URL(
          "../src/modules/orders/orders.checkout.service.js",
          import.meta.url,
        ),
        "utf8",
      );

    assert.match(
      source,
      /paymentRetryToken/,
    );

    assert.match(
      source,
      /const mailOrder = \{[\s\S]*paymentInstructions[\s\S]*\};/,
    );

    assert.doesNotMatch(
      source,
      /const mailOrder = \{[\s\S]*paymentRetryToken[\s\S]*\};/,
    );
  },
);


test(
  "payment capabilities SQL stay aligned with persisted MERCADO_PAGO payment code",
  () => {
    const source =
      readFileSync(
        new URL(
          "../src/modules/orders/order-payment-retry-capability.js",
          import.meta.url,
        ),
        "utf8",
      );

    const legacyLabel =
      ["Mercado", "Pago"].join(" ");

    assert.equal(
      source.includes(
        `payment_method = '${legacyLabel}'`,
      ),
      false,
    );

    assert.equal(
      (
        source.match(
          /payment_method\s*=\s*'MERCADO_PAGO'/g,
        )
        || []
      ).length,
      3,
    );
  },
);
