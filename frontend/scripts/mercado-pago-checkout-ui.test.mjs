import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  dirname,
  resolve,
} from "node:path";
import {
  fileURLToPath,
} from "node:url";

const currentDir =
  dirname(
    fileURLToPath(import.meta.url),
  );

function source(relativePath) {
  return readFileSync(
    resolve(currentDir, relativePath),
    "utf8",
  );
}

const completeSource =
  source("../src/pages/CheckoutCompletePage.jsx");

const checkoutSource =
  source("../src/pages/CheckoutPage.jsx");

test("bank transfer completion rendering remains intact", () => {
  assert.match(
    completeSource,
    /paymentInstructions\?\.method === "BANK_TRANSFER"/,
  );

  assert.match(
    completeSource,
    /renderTransferDetails\(\)/,
  );

  assert.match(
    completeSource,
    /showTransferDetails/,
  );
});

test("Mercado Pago uses normalized checkout instructions from the order response", () => {
  assert.match(
    completeSource,
    /paymentInstructions\?\.method === "MERCADO_PAGO"/,
  );

  assert.match(
    completeSource,
    /paymentInstructions\?\.checkoutUrl/,
  );

  assert.match(
    completeSource,
    /paymentInstructions\?\.status === "READY"/,
  );

  assert.match(
    completeSource,
    /paymentInstructions\?\.enabled === true/,
  );

  assert.match(
    completeSource,
    /href=\{mercadoPagoCheckoutUrl\}/,
  );

  assert.match(
    completeSource,
    />\s*Pagar con Mercado Pago\s*</,
  );
});

test("Mercado Pago checkout URL is restricted to absolute HTTPS navigation", () => {
  assert.match(
    completeSource,
    /new URL\(String\(value \|\| ""\)\.trim\(\)\)/,
  );

  assert.match(
    completeSource,
    /url\.protocol === "https:"/,
  );

  assert.doesNotMatch(
    completeSource,
    /target=["']_blank["']/,
  );
});

test("provider return result is informational and never treated as payment approval", () => {
  assert.match(
    completeSource,
    /new URLSearchParams\(String\(search \|\| ""\)\)/,
  );

  assert.match(
    completeSource,
    /params\.get\("mp_result"\)/,
  );

  for (const value of [
    "success",
    "failure",
    "pending",
  ]) {
    assert.match(
      completeSource,
      new RegExp(`"${value}"`),
    );
  }

  assert.match(
    completeSource,
    /Esto no significa que el pago ya esté/,
  );

  assert.match(
    completeSource,
    /esperando la confirmación automática del pago/,
  );

  assert.doesNotMatch(
    completeSource,
    /mp_result[\s\S]{0,200}(?:PAID|APPROVED|aprobado)/,
  );
});

test("success and pending returns suppress a duplicate payment CTA", () => {
  assert.match(
    completeSource,
    /mercadoPagoReturnResult === "success"/,
  );

  assert.match(
    completeSource,
    /mercadoPagoReturnResult === "pending"/,
  );

  assert.match(
    completeSource,
    /showMercadoPagoCheckout[\s\S]*mercadoPagoReady[\s\S]*!mercadoPagoAwaitingConfirmation/,
  );
});

test("temporarily unavailable Mercado Pago keeps the local order valid without a checkout link", () => {
  assert.match(
    completeSource,
    /mercadoPagoUnavailable/,
  );

  assert.match(
    completeSource,
    /Enlace de pago temporalmente no disponible/,
  );

  assert.match(
    completeSource,
    /Tu orden quedó registrada correctamente/,
  );
});

test("checkout completion remains based on the existing normalized order payload", () => {
  assert.match(
    checkoutSource,
    /paymentInstructions: createdOrder\?\.paymentInstructions \|\| null/,
  );

  assert.match(
    checkoutSource,
    /window\.sessionStorage\.setItem/,
  );

  assert.match(
    checkoutSource,
    /navigate\("\/checkout\/completa"/,
  );

  assert.doesNotMatch(
    completeSource,
    /apiFetch/,
  );
});
