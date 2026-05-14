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

    assert.match(email.html, /Total de artículos/);
    assert.match(email.html, /5 artículos/);
    assert.match(email.text, /Total de artículos: 5 artículos/);

    assert.match(email.html, /Camisa blanca/);
    assert.match(email.html, /Jean recto/);
    assert.match(email.html, /Blazer oferta/);
    assert.match(email.html, /Vestido largo/);
    assert.match(email.text, /Vestido largo x1/);

    assert.match(email.html, /Oferta aplicada/);
    assert.match(email.text, /Blazer oferta x1: .*Oferta aplicada/);
  });
}
