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
  CHECKOUT_PAYMENT_STATES,
  getCheckoutPaymentPresentation,
} from "../src/lib/checkoutPaymentPresentation.js";

const currentDir = dirname(
  fileURLToPath(import.meta.url),
);

function source(relativePath) {
  return readFileSync(
    resolve(currentDir, relativePath),
    "utf8",
  );
}

const accountDetailSource = source(
  "../src/pages/AccountOrderDetailPage.jsx",
);
const accountPanelSource = source(
  "../src/components/AccountOrderPaymentPanel.jsx",
);
const checkoutCompleteSource = source(
  "../src/pages/CheckoutCompletePage.jsx",
);

const eligibleAccountOrder = {
  paymentMethod: "MERCADO_PAGO",
  orderStatus: "RESERVED",
  paymentStatus: "PENDING",
  reservedUntil: "2026-08-24T12:00:00.000Z",
  instructionsStatus: "READY",
  hasCheckoutUrl: true,
  paymentActionAllowed: true,
  now: "2026-08-23T12:00:00.000Z",
};

test("confirmed checkout uses the canonical My Orders action", () => {
  assert.match(
    checkoutCompleteSource,
    /Ver mis órdenes/,
  );
  assert.match(
    checkoutCompleteSource,
    /navigate\("\/cuenta\/ordenes",\s*\{\s*replace:\s*true/s,
  );
  assert.match(
    checkoutCompleteSource,
    /CONFIRMED[\s\S]*\? "Ver mis órdenes"[\s\S]*: "Aceptar"/,
  );
});

test("account panel reuses the canonical payment presentation", () => {
  assert.match(
    accountPanelSource,
    /getCheckoutPaymentPresentation\(/,
  );
  assert.match(
    accountPanelSource,
    /data-payment-state=\{presentation\.state\}/,
  );
  assert.doesNotMatch(
    accountPanelSource,
    /paymentStatus\s*!==?\s*["']PAID["']/,
  );
});

test("account confirmed and processing states expose no duplicate-payment CTA", () => {
  const confirmed = getCheckoutPaymentPresentation({
    ...eligibleAccountOrder,
    orderStatus: "APPROVED",
    paymentStatus: "PAID",
  });
  assert.equal(confirmed.state, CHECKOUT_PAYMENT_STATES.CONFIRMED);
  assert.equal(confirmed.kicker, "Pago confirmado");
  assert.equal(confirmed.showPaymentCta, false);
  assert.equal(confirmed.showRetry, false);

  const processing = getCheckoutPaymentPresentation({
    ...eligibleAccountOrder,
    latestProviderPaymentStatus: "PENDING",
  });
  assert.equal(processing.state, CHECKOUT_PAYMENT_STATES.PROCESSING);
  assert.equal(processing.showPaymentCta, false);
  assert.equal(processing.showRetry, false);
});

test("account action-required and failed states expose only eligible actions", () => {
  const actionRequired = getCheckoutPaymentPresentation(
    eligibleAccountOrder,
  );
  assert.equal(actionRequired.showPaymentCta, true);
  assert.equal(actionRequired.showRetry, false);

  const unavailable = getCheckoutPaymentPresentation({
    ...eligibleAccountOrder,
    instructionsStatus: "TEMPORARILY_UNAVAILABLE",
    hasCheckoutUrl: false,
  });
  assert.equal(unavailable.showPaymentCta, false);
  assert.equal(unavailable.showRetry, true);

  const failed = getCheckoutPaymentPresentation({
    ...eligibleAccountOrder,
    paymentStatus: "FAILED",
    latestProviderPaymentStatus: "REJECTED",
    instructionsStatus: "TEMPORARILY_UNAVAILABLE",
    hasCheckoutUrl: false,
  });
  assert.equal(failed.state, CHECKOUT_PAYMENT_STATES.FAILED);
  assert.equal(failed.showRetry, true);
});

test("verifying, technical-error and expired account states expose no CTA", () => {
  for (const input of [
    {
      ...eligibleAccountOrder,
      mpReturnResult: "success",
    },
    {
      ...eligibleAccountOrder,
      verificationState: "error",
    },
    {
      ...eligibleAccountOrder,
      reservedUntil: "2026-08-22T12:00:00.000Z",
    },
  ]) {
    const presentation = getCheckoutPaymentPresentation(input);
    assert.equal(presentation.showPaymentCta, false);
    assert.equal(presentation.showRetry, false);
  }
});

test("loading account detail is local-only; retry uses the existing endpoint on click", () => {
  assert.match(
    accountDetailSource,
    /apiFetch\(`\/api\/public\/account\/orders\/\$\{id\}`\)/,
  );
  assert.match(
    accountDetailSource,
    /accountRecovery:\s*true/,
  );
  assert.match(
    accountDetailSource,
    /\/api\/public\/orders\/\$\{encodeURIComponent\(order\.id\)\}\/payment\/retry/,
  );
  assert.doesNotMatch(
    accountDetailSource,
    /mercadopago\.com|payment\/mercado-pago\/reconcile/,
  );
  assert.match(
    accountDetailSource,
    /window\.location\.assign\(/,
  );
  assert.doesNotMatch(
    accountPanelSource,
    /<a[\s\S]*href=\{checkoutUrl\}/,
  );
  assert.match(
    accountPanelSource,
    /onClick=\{\(\) => void onPaymentAction\(\)\}/,
  );
});

test("account order header localizes order and payment enums", () => {
  assert.match(
    accountDetailSource,
    /<OrderStatusBadge status=\{order\.orderStatus\} \/>/,
  );
  assert.match(
    accountDetailSource,
    /<StatusBadge[\s\S]*status=\{order\.paymentStatus\}[\s\S]*labels=\{PAYMENT_STATUS_LABELS\}/,
  );

  for (const [technical, label] of [
    ["PENDING", "Pendiente"],
    ["PAID", "Pagado"],
    ["FAILED", "No completado"],
  ]) {
    assert.match(
      accountDetailSource,
      new RegExp(`${technical}: ["']${label}["']`),
    );
  }

  const orderBadgeSource = source(
    "../src/components/OrderStatusBadge.jsx",
  );

  for (const [technical, label] of [
    ["RESERVED", "Reservada"],
    ["APPROVED", "Aprobada"],
  ]) {
    assert.match(
      orderBadgeSource,
      new RegExp(`${technical}: ["']${label}["']`),
    );
  }
});
