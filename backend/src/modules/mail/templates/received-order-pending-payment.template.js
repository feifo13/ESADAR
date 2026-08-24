import { escapeHtml } from "../mail.escape.js";
import { buildCustomerName, formatCurrencyUYU } from "../mail.format.js";
import { getPaymentMethodLabel } from "../../payment-methods.js";
import { renderEmailShell } from "./base-shell.js";
import { buildOrderUrl } from "./url-helpers.js";
import {
  formatOrderArticleCount,
  formatOrderItemsTextLines,
  renderOrderItemsTable,
} from "./order-items.js";

function renderButton(url, label) {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px;">
      <tr>
        <td>
          <a href="${escapeHtml(url)}" class="email-button" target="_blank" style="display:inline-block; padding:13px 22px; background:#008e97; color:#ffffff; text-decoration:none; font-weight:700; border:1px solid #008e97;">${escapeHtml(label)}</a>
        </td>
      </tr>
    </table>
  `;
}

function renderSummaryRow(label, value, options = {}) {
  if (!value && value !== 0) return "";
  return `
    <tr>
      <td style="padding:4px 0; color:#56737a; font-size:14px;">${escapeHtml(label)}</td>
      <td align="right" style="padding:4px 0; color:${options.accent ? "#008e97" : "#102b34"}; font-size:${options.large ? "20px" : "14px"}; font-weight:700;">${escapeHtml(value)}</td>
    </tr>
  `;
}

const TRACKING_AVAILABILITY_COPY =
  "Cuando tu orden sea aprobada y despachada, te enviaremos un correo de notificación con la información del envío y el código de seguimiento, siempre que el proveedor de cadetería o correspondencia lo tenga disponible.";

function getPendingPaymentCopy(paymentInstructions = {}) {
  const method = String(paymentInstructions.method || "").trim();
  const mercadoPagoReady =
    method === "MERCADO_PAGO"
    && paymentInstructions.enabled === true
    && paymentInstructions.status === "READY"
    && Boolean(paymentInstructions.checkoutUrl);

  if (method === "BANK_TRANSFER") {
    return {
      subject: "Recibimos tu orden - Completá la transferencia",
      preheader:
        "Reservamos tus prendas por 24 horas. Te enviamos los datos para transferir.",
      paragraphs: [
        "Recibimos tu orden y reservamos tus prendas por 24 horas. Para completar la compra, transferí el total usando los datos incluidos en este correo. ESADAR validará el pago antes de aprobar la orden.",
      ],
      showMercadoPagoCta: false,
    };
  }

  if (mercadoPagoReady) {
    return {
      subject: "Recibimos tu orden - Completá el pago",
      preheader:
        "Reservamos tus prendas por 24 horas. Completá el pago con Mercado Pago.",
      paragraphs: [
        "Recibimos tu orden y reservamos tus prendas por 24 horas. El pago todavía está pendiente. Para completar la compra, usá el botón «Pagar con Mercado Pago».",
        "No necesitás enviarnos un comprobante. Confirmaremos el pago directamente con Mercado Pago.",
      ],
      showMercadoPagoCta: true,
    };
  }

  return {
    subject: "Recibimos tu orden - Pago pendiente",
    preheader: "Tu orden quedó reservada por 24 horas.",
    paragraphs: [
      "Recibimos tu orden y reservamos tus prendas por 24 horas. El pago todavía está pendiente.",
      "No pudimos habilitar el acceso a Mercado Pago en este momento. Si todavía tenés abierta la pantalla de confirmación, podés volver a intentarlo desde allí. Si el problema continúa, contactanos.",
    ],
    showMercadoPagoCta: false,
  };
}

function renderPaymentDetails(paymentInstructions, copy) {
  if (!paymentInstructions) return "";

  const fields = Array.isArray(paymentInstructions.fields)
    ? paymentInstructions.fields.filter((field) => field?.value)
    : [];
  const instructions = String(paymentInstructions.instructions || "").trim();
  const checkoutUrl = copy.showMercadoPagoCta
    ? String(paymentInstructions.checkoutUrl || "").trim()
    : "";

  if (!fields.length && !instructions && !checkoutUrl) return "";

  const rows = fields
    .map(
      (field) => `
        <tr>
          <td style="padding:5px 0; color:#56737a; font-size:14px;">${escapeHtml(field.label)}</td>
          <td align="right" style="padding:5px 0; color:#102b34; font-size:14px; font-weight:700; word-break:break-word;">${escapeHtml(field.value)}</td>
        </tr>
      `,
    )
    .join("");

  const paymentButton = checkoutUrl
    ? renderButton(checkoutUrl, "Pagar con Mercado Pago")
    : "";

  const instructionsHtml = instructions
    ? `<p style="margin:12px 0 0; color:#56737a; font-size:14px; line-height:1.55;">${escapeHtml(instructions).replace(/\n/g, "<br />")}</p>`
    : "";

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:22px 0; background:#ffffff; border:1px solid rgba(16,43,52,0.14);">
      <tr>
        <td style="padding:16px 18px;">
          <p style="margin:0 0 10px; color:#008e97; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;">${escapeHtml(paymentInstructions.title || "Datos de pago")}</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-meta-table">
            ${rows}
          </table>
          ${paymentButton}
          ${instructionsHtml}
        </td>
      </tr>
    </table>
  `;
}

function formatPaymentInstructionLines(paymentInstructions, copy) {
  if (!paymentInstructions) return [];

  const lines = [];
  const fields = Array.isArray(paymentInstructions.fields)
    ? paymentInstructions.fields.filter((field) => field?.value)
    : [];
  const instructions = String(paymentInstructions.instructions || "").trim();
  const checkoutUrl = copy.showMercadoPagoCta
    ? String(paymentInstructions.checkoutUrl || "").trim()
    : "";

  if (!fields.length && !instructions && !checkoutUrl) return lines;

  lines.push("", paymentInstructions.title || "Datos de pago");
  fields.forEach((field) => lines.push(`${field.label}: ${field.value}`));
  if (checkoutUrl) {
    lines.push(`Pagar con Mercado Pago: ${checkoutUrl}`);
  }
  if (instructions) lines.push(instructions);
  return lines;
}

export function renderReceivedOrderPendingPaymentEmail({
  order,
  publicSiteUrl,
} = {}) {
  const urlOptions = { publicSiteUrl };
  const items = order?.items || [];
  const name = buildCustomerName(order?.customer);
  const orderLabel = order?.orderNumber || order?.id || "";
  const orderUrl = buildOrderUrl(order, urlOptions);
  const total = formatCurrencyUYU(order?.total, order?.currencyCode || "UYU");
  const articleCount = formatOrderArticleCount(items);
  const paymentMethod = getPaymentMethodLabel(order?.paymentMethod);
  const shippingMethod = order?.shippingMethodDescription || "";
  const paymentInstructions = order?.paymentInstructions || null;
  const copy = getPendingPaymentCopy(paymentInstructions || {
    method: order?.paymentMethod,
  });

  const textLines = [
    `Hola ${name},`,
    "",
    ...copy.paragraphs,
    "",
    `Orden: ${orderLabel}`,
    `Total de artículos: ${articleCount}`,
    `Total: ${total}`,
    "Estado: Pago pendiente",
  ];
  if (paymentMethod) textLines.push(`Método de pago: ${paymentMethod}`);
  if (shippingMethod) textLines.push(`Método de envío: ${shippingMethod}`);
  textLines.push(...formatOrderItemsTextLines(items));
  textLines.push(...formatPaymentInstructionLines(paymentInstructions, copy));
  textLines.push(
    "",
    TRACKING_AVAILABILITY_COPY,
    "Podés revisar los detalles desde tu cuenta.",
    orderUrl,
    "",
    "Equipo ESADAR",
  );

  const bodyHtml = `
    <p style="margin:0 0 14px;">Hola ${escapeHtml(name)},</p>
    ${copy.paragraphs
      .map((paragraph) => `<p style="margin:0 0 14px;">${escapeHtml(paragraph)}</p>`)
      .join("")}
    <p style="margin:0 0 18px; color:#56737a; font-size:14px; line-height:1.55;">${escapeHtml(TRACKING_AVAILABILITY_COPY)}</p>
  `;

  const detailsHtml = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:22px 0; background:#eef4f5; border:1px solid rgba(16,43,52,0.12);">
      <tr>
        <td style="padding:18px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-meta-table">
            ${renderSummaryRow("Orden", orderLabel)}
            ${renderSummaryRow("Total de artículos", articleCount)}
            ${renderSummaryRow("Total", total, { large: true })}
            ${renderSummaryRow("Estado", "Pago pendiente", { accent: true })}
            ${renderSummaryRow("Método de pago", paymentMethod)}
            ${renderSummaryRow("Método de envío", shippingMethod)}
          </table>
        </td>
      </tr>
    </table>
    ${renderPaymentDetails(paymentInstructions, copy)}
    ${renderOrderItemsTable(items, urlOptions)}
  `;

  return {
    subject: copy.subject,
    preheader: copy.preheader,
    text: textLines.join("\n"),
    html: renderEmailShell({
      subject: copy.subject,
      preheader: copy.preheader,
      eyebrow: "ORDEN RECIBIDA",
      title: "Recibimos tu orden",
      bodyHtml,
      detailsHtml,
      ctaHtml: renderButton(orderUrl, "Ver mi orden"),
      publicSiteUrl,
    }),
  };
}
