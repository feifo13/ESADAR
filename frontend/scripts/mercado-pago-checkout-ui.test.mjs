import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));

function source(relativePath) {
  return readFileSync(resolve(currentDir, relativePath), "utf8");
}

const completeSource = source("../src/pages/CheckoutCompletePage.jsx");
const checkoutSource = source("../src/pages/CheckoutPage.jsx");

test("bank transfer completion keeps data and removes provider-coupled reference copy", () => {
  assert.match(completeSource, /paymentMethod === "BANK_TRANSFER"/);
  assert.match(completeSource, /renderTransferDetails\(\)/);
  assert.match(completeSource, /paymentInstructions\.fields/);
  assert.match(completeSource, /Monto/);
  assert.match(completeSource, /Copiar número de orden/);
  assert.doesNotMatch(completeSource, /isPrexTransfer|Transferencia Prex/);
  assert.doesNotMatch(completeSource, /motivo\/concepto/);
  assert.doesNotMatch(completeSource, /<span>Referencia<\/span>/);
});

test("Mercado Pago validates HTTPS instructions but never renders a direct provider anchor", () => {
  assert.match(completeSource, /paymentMethod === "MERCADO_PAGO"/);
  assert.match(completeSource, /paymentInstructions\?\.checkoutUrl/);
  assert.match(completeSource, /url\.protocol === "https:"/);
  assert.doesNotMatch(completeSource, /href=\{mercadoPagoCheckoutUrl\}/);
  assert.match(completeSource, /window\.location\.assign\(nextCheckoutUrl\)/);
  assert.match(
    completeSource,
    /payment\/retry[\s\S]*window\.location\.assign\(nextCheckoutUrl\)/,
  );
  assert.doesNotMatch(completeSource, /target=["']_blank["']/);
});

test("provider return is input to presentation and never direct approval", () => {
  assert.match(completeSource, /params\.get\("mp_result"\)/);
  assert.match(completeSource, /mpReturnResult: mercadoPagoReturnResult/);
  assert.match(completeSource, /paymentStatus: completedOrder\?\.paymentStatus/);
  assert.match(completeSource, /orderStatus: completedOrder\?\.orderStatus/);
  assert.doesNotMatch(
    completeSource,
    /mercadoPagoReturnResult\s*===\s*"success"[\s\S]{0,180}(?:PAID|APPROVED)/,
  );
  assert.doesNotMatch(
    completeSource,
    /mercadoPagoReturnResult\s*===\s*"failure"[\s\S]{0,180}(?:FAILED|REJECTED)/,
  );
});

test("completion reads local persisted status through the protected endpoint", () => {
  assert.match(
    completeSource,
    /\/api\/public\/orders\/\$\{encodeURIComponent\(orderId\)\}\/payment\/status/,
  );
  assert.match(
    completeSource,
    /body: \{ retryToken: paymentRetryToken \}/,
  );
  assert.match(completeSource, /latestProviderPaymentStatus/);
  assert.match(completeSource, /window\.sessionStorage\.setItem/);
});

test("checkout persists local domain state with the completion payload", () => {
  for (const field of [
    "orderStatus",
    "paymentStatus",
    "reservedUntil",
    "paymentRetryToken",
    "paymentActionAllowed",
  ]) {
    assert.match(checkoutSource, new RegExp(`${field}:`));
  }

  assert.match(
    checkoutSource,
    /sessionStorage\.setItem\([\s\S]*COMPLETE_STORAGE_KEY/,
  );
});

test("pre-confirmation UI no longer announces a confirmed purchase or QR", () => {
  assert.doesNotMatch(completeSource, /Compra confirmada/);
  assert.doesNotMatch(completeSource, /Muchas gracias por tu compra/);
  assert.doesNotMatch(completeSource, /QR|qrCodeUrl|escane/i);
});
