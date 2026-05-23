import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Run from backend with `npm run emails:preview`.
// Generates mock HTML previews in backend/tmp/email-previews/ without sending emails.
process.env.NODE_ENV ||= "development";
process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_USER ||= "email-preview";
process.env.DB_NAME ||= "esadar_email_preview";
process.env.JWT_SECRET ||= "email-preview-secret";
process.env.PUBLIC_SITE_URL ||= process.env.EMAIL_PREVIEW_SITE_URL || "http://localhost:5173";
process.env.APP_ORIGIN ||= process.env.PUBLIC_SITE_URL;
process.env.CORS_ORIGINS ||= process.env.PUBLIC_SITE_URL;
process.env.MAIL_ALLOWED_SITE_URLS ||= [
  process.env.PUBLIC_SITE_URL,
  "http://localhost:5173",
  "https://sandbox.esadar.com.uy",
  "https://esadar.com.uy",
].join(",");
process.env.EMAIL_ASSETS_MODE ||= "external";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(scriptDir, "..");
const outputDir = path.join(backendRoot, "tmp", "email-previews");
const publicSiteUrl = process.env.PUBLIC_SITE_URL;

const [
  { renderWelcomeUserEmail },
  { renderReceivedOrderPendingPaymentEmail },
  { renderAcceptedOfferEmail },
  { renderApprovedOrderEmail },
  { renderShippedOrderEmail },
  { renderPasswordResetEmail },
  { renderContactReplyEmail },
] = await Promise.all([
  import("../src/modules/mail/templates/welcome-user.template.js"),
  import("../src/modules/mail/templates/received-order-pending-payment.template.js"),
  import("../src/modules/mail/templates/accepted-offer.template.js"),
  import("../src/modules/mail/templates/approved-order.template.js"),
  import("../src/modules/mail/templates/shipped-order.template.js"),
  import("../src/modules/mail/templates/password-reset.template.js"),
  import("../src/modules/mail/templates/contact-reply.template.js"),
]);

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const mockCustomer = {
  firstName: "Lucia",
  lastName: "Cliente",
  email: "lucia@example.test",
  phone: "099 123 456",
};

const mockItems = [
  {
    articleTitle: "Camisa blanca vintage",
    quantity: 1,
    lineTotal: 1690,
    currencyCode: "UYU",
    image: "/assets/article-image-fallback.png",
  },
  {
    articleTitle: "Jean recto azul",
    quantity: 1,
    lineTotal: 2005,
    currencyCode: "UYU",
    acceptedOfferId: 77,
    acceptedOfferPrice: 2005,
    image: "/assets/article-image-fallback.png",
  },
];

const mockOrder = {
  id: 42,
  orderNumber: "ES-2026-0042",
  total: 3695,
  currencyCode: "UYU",
  paymentMethod: "BANK_TRANSFER",
  paymentInstructions: {
    enabled: true,
    method: "BANK_TRANSFER",
    title: "Datos de transferencia",
    fields: [
      { label: "Banco", value: "Banco ejemplo" },
      { label: "Cuenta", value: "123456789" },
      { label: "Titular", value: "ESADAR" },
    ],
    instructions: "Enviar comprobante respondiendo este correo.",
  },
  shippingMethodDescription: "Ahiva / Correo Uruguayo",
  trackingCode: "UY123456789",
  shippedAt: "2026-05-23T14:30:00.000Z",
  customer: mockCustomer,
  items: mockItems,
};

const mockOffer = {
  id: 88,
  offeredAmount: 2005,
  currencyCode: "UYU",
  contact: mockCustomer,
  article: {
    id: 15,
    slug: "jean-recto-azul",
    title: "Jean recto azul",
    image: { thumbFilePath: "/assets/article-image-fallback.png" },
  },
};

const previews = [
  {
    filename: "bienvenida.html",
    label: "Bienvenida",
    email: renderWelcomeUserEmail({
      user: mockCustomer,
      accountUrl: `${publicSiteUrl}/cuenta/perfil`,
      publicSiteUrl,
    }),
  },
  {
    filename: "orden-creada-pago-pendiente.html",
    label: "Orden creada / pago pendiente",
    email: renderReceivedOrderPendingPaymentEmail({
      order: mockOrder,
      publicSiteUrl,
    }),
  },
  {
    filename: "oferta-aceptada.html",
    label: "Oferta aceptada",
    email: renderAcceptedOfferEmail({
      offer: mockOffer,
      publicSiteUrl,
    }),
  },
  {
    filename: "orden-aprobada.html",
    label: "Orden aprobada",
    email: renderApprovedOrderEmail({
      order: mockOrder,
      publicSiteUrl,
    }),
  },
  {
    filename: "orden-enviada.html",
    label: "Orden enviada",
    email: renderShippedOrderEmail({
      order: mockOrder,
      publicSiteUrl,
    }),
  },
  {
    filename: "reset-password.html",
    label: "Reset password",
    email: renderPasswordResetEmail({
      toName: mockCustomer.firstName,
      resetUrl: `${publicSiteUrl}/reset-password?token=mock-token`,
      publicSiteUrl,
    }),
  },
  {
    filename: "contacto-respuesta.html",
    label: "Contacto / respuesta",
    email: renderContactReplyEmail({
      toName: mockCustomer.firstName,
      message: "Hola, quisiera consultar por el estado de una orden.",
      replyMessage:
        "Gracias por escribirnos. Revisamos tu consulta y te vamos a mantener al tanto por este mismo medio.",
      publicSiteUrl,
    }),
  },
];

function renderIndex() {
  const rows = previews
    .map(
      ({ filename, label, email }) => `
        <tr>
          <td><a href="./${escapeHtml(filename)}">${escapeHtml(label)}</a></td>
          <td>${escapeHtml(email.subject)}</td>
          <td>${escapeHtml(email.preheader || "")}</td>
        </tr>
      `,
    )
    .join("");

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Previews de mails ESADAR</title>
    <style>
      body { margin: 0; padding: 28px; background: #f7fafb; color: #102b34; font-family: Arial, Helvetica, sans-serif; }
      h1 { margin: 0 0 18px; font-size: 24px; }
      table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid rgba(16,43,52,0.14); }
      th, td { padding: 12px 14px; border-bottom: 1px solid rgba(16,43,52,0.1); text-align: left; vertical-align: top; }
      th { color: #56737a; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; }
      a { color: #008e97; font-weight: 700; }
    </style>
  </head>
  <body>
    <h1>Previews de mails ESADAR</h1>
    <table>
      <thead>
        <tr>
          <th>Template</th>
          <th>Subject</th>
          <th>Preheader</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </body>
</html>`;
}

await fs.mkdir(outputDir, { recursive: true });

await Promise.all(
  previews.map(({ filename, email }) =>
    fs.writeFile(path.join(outputDir, filename), email.html, "utf8"),
  ),
);
await fs.writeFile(path.join(outputDir, "index.html"), renderIndex(), "utf8");

console.log(`Generated ${previews.length} email previews in ${path.relative(backendRoot, outputDir)}`);
