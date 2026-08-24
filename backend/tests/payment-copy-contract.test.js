import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(relativeUrl) {
  return readFileSync(new URL(relativeUrl, import.meta.url), "utf8");
}

test("active bank transfer surfaces never require an order reference in the transfer", () => {
  const activeSurfaces = [
    source("../../frontend/src/pages/CheckoutPage.jsx"),
    source("../../frontend/src/pages/CheckoutCompletePage.jsx"),
    source("../../frontend/src/pages/PurchaseGuidePage.jsx"),
    source("../../frontend/src/pages/TermsAndConditionsPage.jsx"),
    source("../src/modules/mail/templates/received-order-pending-payment.template.js"),
  ].join("\n");

  assert.doesNotMatch(
    activeSurfaces,
    /(?:motivo|concepto|observación)[^\n]{0,140}(?:orden|transferencia)|(?:orden|transferencia)[^\n]{0,140}(?:motivo|concepto|observación)/i,
  );
  assert.doesNotMatch(activeSurfaces, /Transferencia Prex|isPrexTransfer/);
  assert.doesNotMatch(activeSurfaces, /<span>Referencia<\/span>/);
  assert.match(activeSurfaces, /Copiar número de orden/);
});

test("payment source defaults do not request customer receipts", () => {
  const seed = source("../../db/scripts/01_from_scratch_superadmin_seed.sql");
  const pendingTemplate = source(
    "../src/modules/mail/templates/received-order-pending-payment.template.js",
  );

  assert.doesNotMatch(seed, /responde este correo con el comprobante/i);
  assert.doesNotMatch(pendingTemplate, /envi(ar|á).*comprobante para validar/i);
  assert.match(
    pendingTemplate,
    /No necesitás enviarnos un comprobante\. Confirmaremos el pago directamente con Mercado Pago\./,
  );
});

test("Mercado Pago active copy promises no QR and no premature confirmation", () => {
  const lookup = source("../src/modules/lookups/lookups.constants.js");
  const checkoutComplete = source(
    "../../frontend/src/pages/CheckoutCompletePage.jsx",
  );
  const mapper = source(
    "../../frontend/src/lib/checkoutPaymentPresentation.js",
  );
  const pendingTemplate = source(
    "../src/modules/mail/templates/received-order-pending-payment.template.js",
  );

  assert.doesNotMatch(lookup, /QR|escane/i);
  assert.doesNotMatch(checkoutComplete, /QR|qrCodeUrl|escane/i);
  assert.doesNotMatch(pendingTemplate, /QR|qrCodeUrl|escane/i);
  assert.doesNotMatch(checkoutComplete, /Compra confirmada/);
  assert.match(mapper, /paymentStatus === "PAID"/);
  assert.match(mapper, /CONFIRMED_ORDER_STATUSES\.has\(orderStatus\)/);
});

test("purchase PDF language remains explicitly distinct from a customer receipt", () => {
  const approvedTemplate = source(
    "../src/modules/mail/templates/approved-order.template.js",
  );
  assert.match(approvedTemplate, /comprobante de compra en PDF/);
});
