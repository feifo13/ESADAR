import assert from "node:assert/strict";
import test from "node:test";
import {
  CHECKOUT_PAYMENT_STATES,
  getCheckoutPaymentPresentation,
} from "../src/lib/checkoutPaymentPresentation.js";

const ready = {
  paymentMethod: "MERCADO_PAGO",
  orderStatus: "RESERVED",
  paymentStatus: "PENDING",
  instructionsStatus: "READY",
  hasCheckoutUrl: true,
  paymentActionAllowed: true,
  reservedUntil: "2026-08-24T12:00:00.000Z",
  now: "2026-08-23T12:00:00.000Z",
};

test("Mercado Pago ready order requires action", () => {
  const result = getCheckoutPaymentPresentation(ready);
  assert.equal(result.state, CHECKOUT_PAYMENT_STATES.ACTION_REQUIRED);
  assert.equal(result.title, "Completá el pago");
  assert.equal(result.showPaymentCta, true);
  assert.equal(result.paymentCtaLabel, "Pagar con Mercado Pago");
});

test("temporarily unavailable order shows retry only when allowed", () => {
  const result = getCheckoutPaymentPresentation({
    ...ready,
    instructionsStatus: "TEMPORARILY_UNAVAILABLE",
    hasCheckoutUrl: false,
    paymentActionAllowed: true,
  });
  assert.equal(result.state, CHECKOUT_PAYMENT_STATES.ACTION_REQUIRED);
  assert.equal(result.title, "El pago está pendiente");
  assert.equal(result.showPaymentCta, false);
  assert.equal(result.showRetry, true);
});

test("success return is processing until local state confirms it", () => {
  const result = getCheckoutPaymentPresentation({
    ...ready,
    mpReturnResult: "success",
  });
  assert.equal(result.state, CHECKOUT_PAYMENT_STATES.PROCESSING);
  assert.equal(result.title, "Estamos verificando tu pago");
  assert.equal(result.showPaymentCta, false);
  assert.equal(result.showRetry, false);
});

test("authoritative pending remains processing and never rejected", () => {
  const result = getCheckoutPaymentPresentation({
    ...ready,
    latestProviderPaymentStatus: "PENDING",
  });
  assert.equal(result.state, CHECKOUT_PAYMENT_STATES.PROCESSING);
  assert.equal(result.title, "Mercado Pago está procesando tu pago");
  assert.doesNotMatch(result.body, /rechaz/i);
  assert.equal(result.showPaymentCta, false);
  assert.equal(result.showRetry, false);
});

test("local paid and approved state is confirmed after refresh", () => {
  const result = getCheckoutPaymentPresentation({
    ...ready,
    orderStatus: "APPROVED",
    paymentStatus: "PAID",
  });
  assert.equal(result.state, CHECKOUT_PAYMENT_STATES.CONFIRMED);
  assert.equal(result.title, "Tu compra está confirmada");
  assert.equal(result.showPaymentCta, false);
  assert.equal(result.showRetry, false);
});

test("failure return alone remains actionable and non-authoritative", () => {
  const result = getCheckoutPaymentPresentation({
    ...ready,
    mpReturnResult: "failure",
  });
  assert.equal(result.state, CHECKOUT_PAYMENT_STATES.ACTION_REQUIRED);
  assert.equal(result.title, "No se completó este intento de pago");
  assert.equal(result.showPaymentCta, true);
  assert.equal(result.showRetry, false);
});

test("local failed status produces authoritative failed presentation", () => {
  const result = getCheckoutPaymentPresentation({
    ...ready,
    paymentStatus: "FAILED",
    latestProviderPaymentStatus: "REJECTED",
  });
  assert.equal(result.state, CHECKOUT_PAYMENT_STATES.FAILED);
  assert.equal(result.title, "Pago no completado");
  assert.equal(result.showPaymentCta, true);
  assert.equal(result.showRetry, false);
});

test("technical verification error never becomes rejection", () => {
  const result = getCheckoutPaymentPresentation({
    ...ready,
    verificationState: "error",
  });
  assert.equal(result.state, CHECKOUT_PAYMENT_STATES.TECHNICAL_ERROR);
  assert.equal(result.title, "No pudimos verificar el pago en este momento");
  assert.doesNotMatch(result.body, /rechaz/i);
  assert.equal(result.showPaymentCta, false);
  assert.equal(result.showRetry, false);
});

test("authoritative failed without a link retries only when domain allows it", () => {
  const eligible = getCheckoutPaymentPresentation({
    ...ready,
    paymentStatus: "FAILED",
    latestProviderPaymentStatus: "REJECTED",
    instructionsStatus: "TEMPORARILY_UNAVAILABLE",
    hasCheckoutUrl: false,
    paymentActionAllowed: true,
  });
  assert.equal(eligible.state, CHECKOUT_PAYMENT_STATES.FAILED);
  assert.equal(eligible.showPaymentCta, false);
  assert.equal(eligible.showRetry, true);

  const blocked = getCheckoutPaymentPresentation({
    ...ready,
    paymentStatus: "FAILED",
    latestProviderPaymentStatus: "REJECTED",
    instructionsStatus: "TEMPORARILY_UNAVAILABLE",
    hasCheckoutUrl: false,
    paymentActionAllowed: false,
  });
  assert.equal(blocked.showPaymentCta, false);
  assert.equal(blocked.showRetry, false);
});

test("expired or cancelled reservations never expose payment actions", () => {
  const expired = getCheckoutPaymentPresentation({
    ...ready,
    reservedUntil: "2026-08-22T12:00:00.000Z",
    paymentActionAllowed: true,
  });
  assert.equal(expired.showPaymentCta, false);
  assert.equal(expired.showRetry, false);

  const cancelled = getCheckoutPaymentPresentation({
    ...ready,
    orderStatus: "CANCELLED",
    paymentActionAllowed: true,
  });
  assert.equal(cancelled.showPaymentCta, false);
  assert.equal(cancelled.showRetry, false);
});

test("server eligibility is required even when a READY checkout URL exists", () => {
  const result = getCheckoutPaymentPresentation({
    ...ready,
    paymentActionAllowed: false,
  });

  assert.equal(result.showPaymentCta, false);
  assert.equal(result.showRetry, false);
});

test("checking, successful return, provider pending and manual review outrank historical failure", () => {
  for (const [name, overrides, expectedState] of [
    [
      "checking",
      { verificationState: "checking" },
      CHECKOUT_PAYMENT_STATES.PROCESSING,
    ],
    [
      "success return",
      { mpReturnResult: "success" },
      CHECKOUT_PAYMENT_STATES.PROCESSING,
    ],
    [
      "provider pending",
      { latestProviderPaymentStatus: "PENDING" },
      CHECKOUT_PAYMENT_STATES.PROCESSING,
    ],
    [
      "provider approved awaiting local approval",
      { latestProviderPaymentStatus: "APPROVED" },
      CHECKOUT_PAYMENT_STATES.PROCESSING,
    ],
    [
      "technical error",
      { verificationState: "error" },
      CHECKOUT_PAYMENT_STATES.TECHNICAL_ERROR,
    ],
  ]) {
    const result = getCheckoutPaymentPresentation({
      ...ready,
      paymentStatus: "FAILED",
      ...overrides,
    });

    assert.equal(result.state, expectedState, name);
    assert.equal(result.showPaymentCta, false, name);
    assert.equal(result.showRetry, false, name);
  }
});

test("pending aggregate with pending or approved provider state never exposes payment", () => {
  for (const latestProviderPaymentStatus of ["PENDING", "APPROVED"]) {
    const result = getCheckoutPaymentPresentation({
      ...ready,
      paymentStatus: "PENDING",
      latestProviderPaymentStatus,
    });

    assert.equal(result.state, CHECKOUT_PAYMENT_STATES.PROCESSING);
    assert.equal(result.showPaymentCta, false);
    assert.equal(result.showRetry, false);
  }
});

test("paid and approved aggregate outranks every return marker", () => {
  for (const mpReturnResult of ["", "success", "pending", "failure"]) {
    const result = getCheckoutPaymentPresentation({
      ...ready,
      orderStatus: "APPROVED",
      paymentStatus: "PAID",
      mpReturnResult,
      verificationState: mpReturnResult ? "checking" : "error",
    });

    assert.equal(result.state, CHECKOUT_PAYMENT_STATES.CONFIRMED);
    assert.equal(result.showPaymentCta, false);
    assert.equal(result.showRetry, false);
  }
});

test("expired failed order remains historical and exposes no payment action", () => {
  const result = getCheckoutPaymentPresentation({
    ...ready,
    paymentStatus: "FAILED",
    latestProviderPaymentStatus: "REJECTED",
    reservedUntil: "2026-08-22T12:00:00.000Z",
  });

  assert.equal(result.state, CHECKOUT_PAYMENT_STATES.FAILED);
  assert.equal(result.showPaymentCta, false);
  assert.equal(result.showRetry, false);
});

test("bank transfer remains provider-agnostic and keeps support order separate", () => {
  const result = getCheckoutPaymentPresentation({
    paymentMethod: "BANK_TRANSFER",
  });
  assert.equal(result.state, CHECKOUT_PAYMENT_STATES.ACTION_REQUIRED);
  assert.equal(result.panelTitle, "Transferencia bancaria");
  assert.doesNotMatch(JSON.stringify(result), /Prex|motivo|concepto|referencia/i);
});
