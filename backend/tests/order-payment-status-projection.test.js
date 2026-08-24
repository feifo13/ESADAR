import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getCheckoutOrderPaymentStatus,
  getLocalOrderPaymentStatusProjection,
} from "../src/modules/orders/orders.checkout.service.js";

const TOKEN = "a".repeat(64);

test("local payment status projection returns only approved public fields", async () => {
  let sql = "";
  const connection = {
    async execute(statement, args) {
      sql = String(statement);
      assert.deepEqual(args, [42]);
      return [[{
        orderId: 42,
        orderNumber: "ES-42",
        paymentMethod: "MERCADO_PAGO",
        orderStatus: "RESERVED",
        paymentStatus: "PENDING",
        reservedUntil: "2099-01-01 00:00:00",
        latestProviderPaymentStatus: "REJECTED",
      }]];
    },
  };

  const result = await getLocalOrderPaymentStatusProjection(42, connection);

  assert.deepEqual(Object.keys(result).sort(), [
    "latestProviderPaymentStatus",
    "orderId",
    "orderNumber",
    "orderStatus",
    "paymentActionAllowed",
    "paymentMethod",
    "paymentStatus",
    "reservedUntil",
  ]);
  assert.equal(result.paymentActionAllowed, true);
  assert.doesNotMatch(sql, /customer|email|phone|address/i);
  assert.doesNotMatch(sql, /raw_response|access_token|webhook_secret/i);
  assert.match(sql, /FROM payments p/);
});

test("invalid or expired capability reveals no order projection", async () => {
  let loadCount = 0;

  await assert.rejects(
    () => getCheckoutOrderPaymentStatus(42, TOKEN, {
      authorize: async () => null,
      loadProjection: async () => {
        loadCount += 1;
        return {};
      },
    }),
    (error) => Number(error?.statusCode) === 404,
  );

  assert.equal(loadCount, 0);
});

test("valid capability restores confirmed local state without provider access", async () => {
  const result = await getCheckoutOrderPaymentStatus(42, TOKEN, {
    authorize: async () => ({ orderId: 42 }),
    loadProjection: async () => ({
      orderId: 42,
      orderNumber: "ES-42",
      paymentMethod: "MERCADO_PAGO",
      orderStatus: "APPROVED",
      paymentStatus: "PAID",
      reservedUntil: "2099-01-01 00:00:00",
      latestProviderPaymentStatus: "APPROVED",
    }),
  });

  assert.equal(result.paymentStatus, "PAID");
  assert.equal(result.orderStatus, "APPROVED");

  const source = readFileSync(
    new URL("../src/modules/orders/orders.checkout.service.js", import.meta.url),
    "utf8",
  );
  const start = source.indexOf("export async function getCheckoutOrderPaymentStatus");
  const end = source.indexOf("\nexport async function retryCheckoutOrderPayment", start);
  const projectionFunction = source.slice(start, end);
  assert.doesNotMatch(
    projectionFunction,
    /fetchMercadoPagoPayment|prepareOrderPayment|applyMercadoPagoPaymentToOrder/,
  );
});

test("public status route is rate limited and keeps capability in POST body", () => {
  const routes = readFileSync(
    new URL("../src/modules/orders/orders.routes.js", import.meta.url),
    "utf8",
  );
  const controller = readFileSync(
    new URL("../src/modules/orders/orders.controller.js", import.meta.url),
    "utf8",
  );

  assert.match(routes, /'\/:id\/payment\/status'/);
  assert.match(
    routes,
    /'\/:id\/payment\/status'[\s\S]*optionalAuth[\s\S]*checkoutRateLimit[\s\S]*getPublicOrderPaymentStatus/,
  );
  assert.match(
    controller,
    /getPublicOrderPaymentStatus[\s\S]*retryOrderPaymentSchema\.parse\([\s\S]*req\.body/,
  );
});
