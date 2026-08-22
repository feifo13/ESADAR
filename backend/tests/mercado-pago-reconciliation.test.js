import assert from "node:assert/strict";
import {
  readFileSync,
} from "node:fs";
import {
  dirname,
  resolve,
} from "node:path";
import test from "node:test";
import {
  fileURLToPath,
} from "node:url";

import {
  evaluateMercadoPagoReconciliation,
  getMercadoPagoCurrencyCode,
  getMercadoPagoOrderIdentity,
  getMercadoPagoTransactionAmount,
} from "../src/modules/payments/providers/mercado-pago.reconciliation.js";

const currentDir =
  dirname(
    fileURLToPath(import.meta.url),
  );

const ordersSource =
  readFileSync(
    resolve(
      currentDir,
      "../src/modules/orders/orders.service.js",
    ),
    "utf8",
  );

const migrationSource =
  readFileSync(
    resolve(
      currentDir,
      "../../db/migrations/"
      + "20260822_payments_provider_reference_unique.sql",
    ),
    "utf8",
  );

test(
  "canonical Mercado Pago identity requires all three order identifiers",
  () => {
    assert.deepEqual(
      getMercadoPagoOrderIdentity({
        metadata: {
          order_id: 42,
          order_number: "ORD-42",
        },
        external_reference: "ORD-42",
      }),
      {
        orderId: 42,
        metadataOrderNumber: "ORD-42",
        externalReference: "ORD-42",
        complete: true,
        referencesMatch: true,
      },
    );

    const missing =
      getMercadoPagoOrderIdentity({
        metadata: {
          order_id: 42,
        },
        external_reference: "ORD-42",
      });

    assert.equal(
      missing.complete,
      false,
    );
  },
);

test(
  "contradictory metadata and external reference never reconcile",
  () => {
    const identity =
      getMercadoPagoOrderIdentity({
        metadata: {
          order_id: 42,
          order_number: "ORD-42",
        },
        external_reference: "ORD-99",
      });

    assert.equal(
      identity.complete,
      true,
    );

    assert.equal(
      identity.referencesMatch,
      false,
    );
  },
);

test(
  "transaction_amount is the only automatic reconciliation amount",
  () => {
    assert.equal(
      getMercadoPagoTransactionAmount({
        transaction_amount: 1500,
        transaction_details: {
          total_paid_amount: 1700,
          net_received_amount: 1200,
        },
      }),
      1500,
    );

    assert.equal(
      getMercadoPagoTransactionAmount({
        transaction_details: {
          total_paid_amount: 1700,
          net_received_amount: 1200,
        },
      }),
      0,
    );
  },
);

test(
  "currency must come explicitly from provider payment",
  () => {
    assert.equal(
      getMercadoPagoCurrencyCode({
        currency_id: "uyu",
      }),
      "UYU",
    );

    assert.equal(
      getMercadoPagoCurrencyCode({}),
      "XXX",
    );
  },
);

test(
  "automatic reconciliation requires identity amount and UYU simultaneously",
  () => {
    const order = {
      id: 42,
      orderNumber: "ORD-42",
      total: 1500,
    };

    const valid =
      evaluateMercadoPagoReconciliation(
        {
          metadata: {
            order_id: 42,
            order_number: "ORD-42",
          },
          external_reference: "ORD-42",
          transaction_amount: 1500,
          currency_id: "UYU",
        },
        order,
      );

    assert.equal(
      valid.identityMatches,
      true,
    );

    assert.equal(
      valid.amountMatches,
      true,
    );

    assert.equal(
      valid.currencyMatches,
      true,
    );

    assert.equal(
      valid.automaticApprovalAllowed,
      true,
    );

    const wrongCurrency =
      evaluateMercadoPagoReconciliation(
        {
          metadata: {
            order_id: 42,
            order_number: "ORD-42",
          },
          external_reference: "ORD-42",
          transaction_amount: 1500,
          currency_id: "USD",
        },
        order,
      );

    assert.equal(
      wrongCurrency.automaticApprovalAllowed,
      false,
    );

    const wrongAmount =
      evaluateMercadoPagoReconciliation(
        {
          metadata: {
            order_id: 42,
            order_number: "ORD-42",
          },
          external_reference: "ORD-42",
          transaction_amount: 1499,
          currency_id: "UYU",
        },
        order,
      );

    assert.equal(
      wrongAmount.automaticApprovalAllowed,
      false,
    );
  },
);

test(
  "order id must also match the authoritative local order",
  () => {
    const result =
      evaluateMercadoPagoReconciliation(
        {
          metadata: {
            order_id: 99,
            order_number: "ORD-42",
          },
          external_reference: "ORD-42",
          transaction_amount: 1500,
          currency_id: "UYU",
        },
        {
          id: 42,
          orderNumber: "ORD-42",
          total: 1500,
        },
      );

    assert.equal(
      result.identityMatches,
      false,
    );

    assert.equal(
      result.automaticApprovalAllowed,
      false,
    );
  },
);

test(
  "order lookup uses strict AND correlation and no OR fallback",
  () => {
    const start =
      ordersSource.indexOf(
        "async function findOrderForMercadoPagoPayment(",
      );

    const end =
      ordersSource.indexOf(
        "function getMercadoPagoPaidAt(",
        start,
      );

    assert.ok(start >= 0);
    assert.ok(end > start);

    const section =
      ordersSource.slice(
        start,
        end,
      );

    assert.match(
      section,
      /WHERE id = \?\s+AND order_number = \?/,
    );

    assert.doesNotMatch(
      section,
      /clauses\.join\(" OR "\)/,
    );
  },
);

test(
  "orders service no longer reconciles against provider fee-derived fallbacks",
  () => {
    assert.doesNotMatch(
      ordersSource,
      /net_received_amount/,
    );

    assert.doesNotMatch(
      ordersSource,
      /total_paid_amount/,
    );
  },
);

test(
  "late approved payment requires review without reviving order or selling stock",
  () => {
    assert.match(
      ordersSource,
      /\["EXPIRED", "CANCELLED"\]\.includes/,
    );

    assert.match(
      ordersSource,
      /MERCADO_PAGO_LATE_PAYMENT_REVIEW_REQUIRED/,
    );

    assert.match(
      ordersSource,
      /stockMutation:\s*false/,
    );

    assert.match(
      ordersSource,
      /orderStatusMutation:\s*false/,
    );

    assert.match(
      ordersSource,
      /manualReviewRequired:\s*true/,
    );
  },
);

test(
  "provider payment reference cannot be rebound to another order",
  () => {
    assert.match(
      ordersSource,
      /Number\(existing\.orderId\)\s*!==\s*Number\(orderId\)/,
    );

    assert.match(
      ordersSource,
      /conflict:\s*true/,
    );

    const upsertStart =
      ordersSource.indexOf(
        "async function upsertMercadoPagoPayment(",
      );

    const upsertEnd =
      ordersSource.indexOf(
        "function mapOrderPaymentStatus(",
        upsertStart,
      );

    const upsertSource =
      ordersSource.slice(
        upsertStart,
        upsertEnd,
      );

    assert.doesNotMatch(
      upsertSource,
      /SET[\s\S]*order_id = \?/,
    );
  },
);

test(
  "payments migration enforces provider scoped uniqueness",
  () => {
    assert.match(
      migrationSource,
      /UNIQUE KEY uq_payments_provider_name_reference \(provider_name, provider_reference\)/,
    );
  },
);
