import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  preparePaymentWithProvider,
} from "../src/modules/payments/payment-orchestrator.service.js";

const __dirname =
  dirname(fileURLToPath(import.meta.url));

test("provider preparation failure returns an isolated unavailable result instead of throwing", async () => {
  const order = Object.freeze({
    id: 9001,
    orderNumber: "ORD-ISO-9001",
    paymentMethod: "MERCADO_PAGO",
    total: 1000,
  });

  const brokenProvider = {
    id: "MERCADO_PAGO",

    async prepare() {
      throw new Error(
        "simulated provider failure",
      );
    },
  };

  const result =
    await preparePaymentWithProvider(
      brokenProvider,
      order,
      null,
      {},
    );

  assert.equal(
    result.method,
    "MERCADO_PAGO",
  );

  assert.equal(result.enabled, false);

  assert.equal(
    result.status,
    "TEMPORARILY_UNAVAILABLE",
  );

  assert.equal(result.retryable, true);

  assert.equal(
    result.failureReason,
    "payment_provider_prepare_failed",
  );

  assert.equal(order.id, 9001);
  assert.equal(
    order.orderNumber,
    "ORD-ISO-9001",
  );
});

test("a provider failure does not poison preparation of another provider", async () => {
  const brokenProvider = {
    id: "BROKEN_PROVIDER",

    async prepare() {
      throw new Error("failure");
    },
  };

  const healthyProvider = {
    id: "BANK_TRANSFER",

    async prepare() {
      return {
        method: "BANK_TRANSFER",
        label: "Transferencia bancaria",
        title:
          "Datos para transferencia bancaria",
        enabled: true,
        fields: [
          {
            label: "Banco",
            value: "Banco de prueba",
          },
        ],
        instructions:
          "Transferí el total indicado.",
      };
    },
  };

  const failed =
    await preparePaymentWithProvider(
      brokenProvider,
      {
        paymentMethod:
          "BROKEN_PROVIDER",
      },
      null,
      {},
    );

  const healthy =
    await preparePaymentWithProvider(
      healthyProvider,
      {
        paymentMethod:
          "BANK_TRANSFER",
      },
      null,
      {},
    );

  assert.equal(failed.enabled, false);

  assert.equal(
    failed.status,
    "TEMPORARILY_UNAVAILABLE",
  );

  assert.equal(healthy.enabled, true);
  assert.equal(healthy.status, "READY");

  assert.equal(
    healthy.method,
    "BANK_TRANSFER",
  );
});

test("unsupported provider fails closed without throwing", async () => {
  const result =
    await preparePaymentWithProvider(
      null,
      {
        paymentMethod:
          "FUTURE_PROVIDER",
      },
      null,
      {},
    );

  assert.equal(
    result.method,
    "FUTURE_PROVIDER",
  );

  assert.equal(result.enabled, false);

  assert.equal(
    result.status,
    "TEMPORARILY_UNAVAILABLE",
  );

  assert.equal(result.retryable, false);
});

test("checkout lifecycle prepares payment only after createOrder resolves", () => {
  const source = readFileSync(
    resolve(
      __dirname,
      "../src/modules/orders/orders.checkout.service.js",
    ),
    "utf8",
  );

  const createIndex =
    source.indexOf("await createOrder(");

  const prepareIndex =
    source.indexOf(
      "await prepareOrderPayment(",
    );

  const emailIndex =
    source.indexOf(
      "sendReceivedOrderPendingPaymentEmail(",
    );

  assert.ok(createIndex >= 0);
  assert.ok(prepareIndex > createIndex);
  assert.ok(emailIndex > prepareIndex);
});

test("order core no longer sends received-order email or prepares provider payment", () => {
  const source = readFileSync(
    resolve(
      __dirname,
      "../src/modules/orders/orders.service.js",
    ),
    "utf8",
  );

  assert.doesNotMatch(
    source,
    /sendReceivedOrderPendingPaymentEmail/,
  );

  assert.doesNotMatch(
    source,
    /prepareOrderPayment/,
  );

  assert.match(
    source,
    /assertPaymentMethodAvailable/,
  );

  assert.match(
    source,
    /getCostingSettings/,
  );
});

test("received-order mailer never prepares payment instructions", () => {
  const source = readFileSync(
    resolve(
      __dirname,
      "../src/modules/orders/orders.mailer.js",
    ),
    "utf8",
  );

  assert.doesNotMatch(
    source,
    /getPaymentInstructionsForOrder/,
  );

  assert.doesNotMatch(
    source,
    /collecting\.service/,
  );

  assert.doesNotMatch(
    source,
    /withPaymentInstructions/,
  );
});

test("public order controller delegates lifecycle to checkout service", () => {
  const source = readFileSync(
    resolve(
      __dirname,
      "../src/modules/orders/orders.controller.js",
    ),
    "utf8",
  );

  assert.match(
    source,
    /createCheckoutOrder/,
  );

  assert.doesNotMatch(
    source,
    /getPaymentInstructionsForOrder/,
  );

  assert.doesNotMatch(
    source,
    /collecting\.service/,
  );
});
