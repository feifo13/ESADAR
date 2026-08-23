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
