import test from "node:test";
import assert from "node:assert/strict";
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
    title: "Datos de transferencia",
    fields: [{ label: "Cuenta", value: "123456" }],
    instructions: "Enviar comprobante por mail.",
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

test("received pending payment email asks to include order number in transfer reason", () => {
  const email = renderReceivedOrderPendingPaymentEmail({
    order: baseOrder,
    publicSiteUrl: "https://esadar.example.test",
  });

  assert.match(email.html, /motivo\/concepto/);
  assert.match(email.html, /ES-42/);
  assert.match(email.text, /motivo\/concepto/);
  assert.match(email.text, /ES-42/);
  assert.match(email.html, /orden enviada/);
  assert.match(email.text, /orden enviada/);
  assert.match(email.html, /sujeto a disponibilidad/);
});

test("approved email defers tracking code to shipped email", () => {
  const email = renderApprovedOrderEmail({
    order: { ...baseOrder, trackingCode: "UY123456" },
    publicSiteUrl: "https://esadar.example.test",
  });

  assert.doesNotMatch(email.html, /UY123456/);
  assert.doesNotMatch(email.text, /UY123456/);
  assert.match(email.html, /orden enviada/);
  assert.match(email.text, /orden enviada/);
  assert.match(email.html, /sujeto a disponibilidad/);
});

test("shipped email includes tracking code when present", () => {
  const email = renderShippedOrderEmail({
    order: { ...baseOrder, trackingCode: "UY123456" },
    publicSiteUrl: "https://esadar.example.test",
  });

  assert.match(email.html, /Codigo de seguimiento/);
  assert.match(email.html, /UY123456/);
  assert.match(email.html, /Retiro en showroom/);
  assert.match(email.text, /Codigo de seguimiento: UY123456/);
  assert.match(email.text, /sujeto a disponibilidad/);
});

test("shipped email does not render empty tracking block", () => {
  const email = renderShippedOrderEmail({
    order: { ...baseOrder, trackingCode: "" },
    publicSiteUrl: "https://esadar.example.test",
  });

  assert.doesNotMatch(email.html, /Codigo de seguimiento/);
  assert.doesNotMatch(email.text, /Codigo de seguimiento:/);
  assert.match(email.html, /sujeto a disponibilidad/);
  assert.match(email.text, /sujeto a disponibilidad/);
});
