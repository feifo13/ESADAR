import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderApprovedOrderEmail } from "../src/modules/mail/templates/approved-order.template.js";
import { renderReceivedOrderPendingPaymentEmail } from "../src/modules/mail/templates/received-order-pending-payment.template.js";
import { renderShippedOrderEmail } from "../src/modules/mail/templates/shipped-order.template.js";

const baseOrder = {
  id: 42,
  orderNumber: "ES-42",
  total: 10200,
  currencyCode: "UYU",
  paymentMethod: "BANK_TRANSFER",
  paymentInstructions: {
    enabled: true,
    method: "BANK_TRANSFER",
    title: "Datos para transferencia bancaria",
    fields: [
      { label: "Cuenta", value: "123456" },
      { label: "Moneda", value: "UYU" },
    ],
    instructions: "",
  },
  shippingMethodDescription: "Retiro en showroom",
  shippedAt: "2026-05-14T15:30:00.000Z",
  customer: {
    firstName: "Lucia",
    lastName: "Cliente",
    email: "lucia@example.test",
  },
  items: [
    {
      articleTitle: "Camisa blanca",
      quantity: 1,
      lineTotal: 2200,
      currencyCode: "UYU",
    },
    {
      articleTitle: "Jean recto",
      quantity: 2,
      lineTotal: 3600,
      currencyCode: "UYU",
    },
    {
      articleTitle: "Blazer oferta",
      quantity: 1,
      lineTotal: 2800,
      currencyCode: "UYU",
      acceptedOfferId: 77,
      acceptedOfferPrice: 2800,
    },
    {
      articleTitle: "Vestido largo",
      quantity: 1,
      lineTotal: 1600,
      currencyCode: "UYU",
    },
  ],
};

const renderCases = [
  ["received pending payment", renderReceivedOrderPendingPaymentEmail],
  ["approved", renderApprovedOrderEmail],
  ["shipped", renderShippedOrderEmail],
];

for (const [name, renderEmail] of renderCases) {
  test(`${name} order email lists all items and flags offer items`, () => {
    const email = renderEmail({
      order: baseOrder,
      publicSiteUrl: "https://esadar.example.test",
    });

    assert.match(email.html, /Total de articulos|Total de art.culos/);
    assert.match(email.html, /5 articulos|5 art.culos/);
    assert.match(email.text, /Total de articulos: 5 articulos|Total de art.culos: 5 art.culos/);

    assert.match(email.html, /Camisa blanca/);
    assert.match(email.html, /Jean recto/);
    assert.match(email.html, /Blazer oferta/);
    assert.match(email.html, /Vestido largo/);
    assert.match(email.text, /Vestido largo x1/);

    assert.match(email.html, /Oferta aplicada/);
    assert.match(email.text, /Blazer oferta x1: .*Oferta aplicada/);
  });
}

test("bank pending email follows the approved payment copy contract", () => {
  const email = renderReceivedOrderPendingPaymentEmail({
    order: baseOrder,
    publicSiteUrl: "https://esadar.example.test",
  });

  assert.equal(
    email.subject,
    "Recibimos tu orden - Completá la transferencia",
  );
  assert.equal(
    email.preheader,
    "Reservamos tus prendas por 24 horas. Te enviamos los datos para transferir.",
  );
  assert.match(email.html, /transferí el total usando los datos incluidos/);
  assert.match(email.text, /transferí el total usando los datos incluidos/);
  assert.match(email.html, /ES-42/);
  assert.match(email.text, /ES-42/);
  assert.match(email.html, /Cuenta/);
  assert.match(email.html, /123456/);
  assert.match(email.html, /Moneda/);
  assert.match(email.html, /UYU/);
  assert.doesNotMatch(email.html, /motivo|concepto|observación/i);
  assert.doesNotMatch(email.text, /motivo|concepto|observación/i);
  assert.doesNotMatch(email.html, /envi(ar|á).*comprobante/i);
  assert.doesNotMatch(email.text, /envi(ar|á).*comprobante/i);
  assert.match(email.html, /orden sea aprobada y despachada/);
  assert.match(email.text, /orden sea aprobada y despachada/);
  assert.match(email.html, /lo tenga disponible/);
});

test("Mercado Pago ready pending email has CTA and no QR or receipt request", () => {
  const email = renderReceivedOrderPendingPaymentEmail({
    order: {
      ...baseOrder,
      paymentMethod: "MERCADO_PAGO",
      paymentInstructions: {
        enabled: true,
        method: "MERCADO_PAGO",
        status: "READY",
        title: "Datos para pagar con Mercado Pago",
        fields: [],
        instructions: "",
        checkoutUrl: "https://www.mercadopago.com.uy/checkout/mock",
        qrCodeUrl: null,
      },
    },
    publicSiteUrl: "https://esadar.example.test",
  });

  assert.equal(email.subject, "Recibimos tu orden - Completá el pago");
  assert.equal(
    email.preheader,
    "Reservamos tus prendas por 24 horas. Completá el pago con Mercado Pago.",
  );
  assert.match(email.html, />Pagar con Mercado Pago</);
  assert.match(email.text, /Pagar con Mercado Pago: https:\/\//);
  assert.match(email.html, /No necesitás enviarnos un comprobante/);
  assert.doesNotMatch(email.html, /QR|escane/i);
  assert.doesNotMatch(email.text, /QR|escane/i);
  assert.doesNotMatch(email.html, /Adjuntamos el comprobante/);
});

test("Mercado Pago unavailable pending email omits invalid payment CTA", () => {
  const email = renderReceivedOrderPendingPaymentEmail({
    order: {
      ...baseOrder,
      paymentMethod: "MERCADO_PAGO",
      paymentInstructions: {
        enabled: false,
        method: "MERCADO_PAGO",
        status: "TEMPORARILY_UNAVAILABLE",
        title: "Datos para pagar con Mercado Pago",
        fields: [],
        instructions: "",
        checkoutUrl: null,
        qrCodeUrl: null,
      },
    },
    publicSiteUrl: "https://esadar.example.test",
  });

  assert.equal(email.subject, "Recibimos tu orden - Pago pendiente");
  assert.equal(email.preheader, "Tu orden quedó reservada por 24 horas.");
  assert.match(email.html, /No pudimos habilitar el acceso a Mercado Pago/);
  assert.match(email.text, /No pudimos habilitar el acceso a Mercado Pago/);
  assert.doesNotMatch(email.html, />Pagar con Mercado Pago</);
  assert.doesNotMatch(email.text, /Pagar con Mercado Pago: https:\/\//);
  assert.doesNotMatch(email.html, /QR|escane/i);
});

test("approved email confirms payment and the mailer keeps the purchase PDF", () => {
  const email = renderApprovedOrderEmail({
    order: baseOrder,
    publicSiteUrl: "https://esadar.example.test",
  });

  assert.equal(email.subject, "Pago confirmado - Orden ES-42");
  assert.equal(email.preheader, "Confirmamos el pago y aprobamos tu orden.");
  assert.match(email.html, /Confirmamos el pago de tu orden/);
  assert.match(email.text, /Confirmamos el pago de tu orden/);
  assert.match(email.html, /comprobante de compra en PDF/);

  const mailerSource = readFileSync(
    new URL("../src/modules/orders/orders.mailer.js", import.meta.url),
    "utf8",
  );
  assert.match(mailerSource, /sendApprovedOrderEmail[\s\S]*attachments: \[receiptAttachment\]/);
  assert.doesNotMatch(
    mailerSource,
    /sendReceivedOrderPendingPaymentEmail[\s\S]*attachments:/,
  );
});

test("Mercado Pago failure email remains intentionally unimplemented", () => {
  const mailerSource = readFileSync(
    new URL("../src/modules/orders/orders.mailer.js", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(
    mailerSource,
    /send(?:Rejected|Failed|Cancelled)PaymentEmail/,
  );
});

test("approved email defers tracking code to shipped email", () => {
  const email = renderApprovedOrderEmail({
    order: { ...baseOrder, trackingCode: "UY123456" },
    publicSiteUrl: "https://esadar.example.test",
  });

  assert.doesNotMatch(email.html, /UY123456/);
  assert.doesNotMatch(email.text, /UY123456/);
  assert.match(email.html, /orden sea enviada/);
  assert.match(email.text, /orden sea enviada/);
  assert.match(email.html, /sujeto a disponibilidad/);
});

test("shipped email includes tracking code when present", () => {
  const email = renderShippedOrderEmail({
    order: { ...baseOrder, trackingCode: "UY123456" },
    publicSiteUrl: "https://esadar.example.test",
  });

  assert.match(email.html, /Código de seguimiento/);
  assert.match(email.html, /UY123456/);
  assert.match(email.html, /Retiro en showroom/);
  assert.match(email.text, /Código de seguimiento: UY123456/);
  assert.match(email.text, /sujeto a disponibilidad/);
});

test("shipped email does not render empty tracking block", () => {
  const email = renderShippedOrderEmail({
    order: { ...baseOrder, trackingCode: "" },
    publicSiteUrl: "https://esadar.example.test",
  });

  assert.doesNotMatch(email.html, /Código de seguimiento/);
  assert.doesNotMatch(email.text, /Código de seguimiento:/);
  assert.match(email.html, /sujeto a disponibilidad/);
  assert.match(email.text, /sujeto a disponibilidad/);
});
