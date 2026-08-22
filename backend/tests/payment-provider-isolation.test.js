import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  evaluatePaymentProviderAvailability,
  filterAvailablePaymentMethods,
  isPaymentMethodAvailable,
} from "../src/modules/payments/payment-orchestrator.service.js";

import {
  getPaymentProvider,
  listPaymentProviders,
} from "../src/modules/payments/payment-provider.registry.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const methods = [
  {
    id: "BANK_TRANSFER",
    label: "Transferencia bancaria",
  },
  {
    id: "MERCADO_PAGO",
    label: "Mercado Pago",
  },
];

test("payment provider registry exposes current providers without duplicate ids", () => {
  const providers = listPaymentProviders();
  const ids = providers.map((provider) => provider.id);

  assert.deepEqual(
    ids.sort(),
    ["BANK_TRANSFER", "MERCADO_PAGO"].sort(),
  );

  assert.equal(new Set(ids).size, ids.length);
  assert.equal(getPaymentProvider("BANK_TRANSFER")?.id, "BANK_TRANSFER");
  assert.equal(getPaymentProvider("MERCADO_PAGO")?.id, "MERCADO_PAGO");
  assert.equal(getPaymentProvider("UNKNOWN"), null);
});

test("bank transfer availability does not depend on Mercado Pago configuration", () => {
  const settings = {
    isBankTransferEnabled: true,
    isMercadoPagoEnabled: false,
    mercadoPagoAccessToken: "",
    mercadoPagoCheckoutUrl: "",
  };

  assert.equal(
    isPaymentMethodAvailable("BANK_TRANSFER", settings),
    true,
  );

  assert.equal(
    isPaymentMethodAvailable("MERCADO_PAGO", settings),
    false,
  );

  assert.deepEqual(
    filterAvailablePaymentMethods(methods, settings)
      .map((method) => method.id),
    ["BANK_TRANSFER"],
  );
});

test("Mercado Pago availability does not alter bank transfer availability", () => {
  const settings = {
    isBankTransferEnabled: true,
    isMercadoPagoEnabled: true,
    mercadoPagoEnvironment: "test",
    mercadoPagoAccessToken: "TEST_TOKEN_NOT_REAL",
    mercadoPagoCheckoutUrl: "",
    mercadoPagoNotificationUrl:
      "https://sandbox.esadar.com.uy/api/webhooks/mercado-pago",
    mercadoPagoWebhookSecret:
      "TEST_SECRET_NOT_REAL",
  };

  assert.equal(
    isPaymentMethodAvailable("BANK_TRANSFER", settings),
    true,
  );

  assert.equal(
    isPaymentMethodAvailable("MERCADO_PAGO", settings),
    true,
  );

  assert.deepEqual(
    filterAvailablePaymentMethods(methods, settings)
      .map((method) => method.id),
    ["BANK_TRANSFER", "MERCADO_PAGO"],
  );
});

test("a broken provider availability implementation fails closed without affecting another provider", () => {
  const brokenProvider = {
    id: "BROKEN_PROVIDER",
    isAvailable() {
      throw new Error("provider failure");
    },
  };

  assert.equal(
    evaluatePaymentProviderAvailability(
      brokenProvider,
      {},
    ),
    false,
  );

  assert.equal(
    isPaymentMethodAvailable(
      "BANK_TRANSFER",
      {
        isBankTransferEnabled: true,
      },
    ),
    true,
  );
});

test("orders and lookups no longer implement provider-specific availability branches", () => {
  const ordersSource = readFileSync(
    resolve(
      __dirname,
      "../src/modules/orders/orders.service.js",
    ),
    "utf8",
  );

  const lookupsSource = readFileSync(
    resolve(
      __dirname,
      "../src/modules/lookups/lookups.service.js",
    ),
    "utf8",
  );

  assert.match(
    ordersSource,
    /assertPaymentMethodAvailable/,
  );

  assert.doesNotMatch(
    ordersSource,
    /async function assertPaymentMethodIsAvailable/,
  );

  assert.doesNotMatch(
    lookupsSource,
    /method\.id === ['"]MERCADO_PAGO['"]/,
  );

  assert.doesNotMatch(
    lookupsSource,
    /method\.id === ['"]BANK_TRANSFER['"]/,
  );

  assert.match(
    lookupsSource,
    /listAvailablePaymentMethods/,
  );
});


test("Mercado Pago fallback URL alone is not considered available", () => {
  const settings = {
    isBankTransferEnabled: true,
    isMercadoPagoEnabled: true,
    mercadoPagoEnvironment: "test",
    mercadoPagoAccessToken: "",
    mercadoPagoCheckoutUrl:
      "https://example.test/fallback",
    mercadoPagoNotificationUrl: "",
    mercadoPagoWebhookSecret: "",
  };

  assert.equal(
    isPaymentMethodAvailable(
      "MERCADO_PAGO",
      settings,
    ),
    false,
  );

  assert.equal(
    isPaymentMethodAvailable(
      "BANK_TRANSFER",
      settings,
    ),
    true,
  );
});
