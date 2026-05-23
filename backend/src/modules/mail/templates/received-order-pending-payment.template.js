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
  "Una vez aprobada y despachada la orden, te enviaremos el código de seguimiento en el mail de confirmación de envío, sujeto a disponibilidad del proveedor del servicio de cadetería o correspondencia.";

function renderPaymentInstructions(paymentInstructions, orderLabel) {
  if (!paymentInstructions) return "";

  const fields = Array.isArray(paymentInstructions.fields)
    ? paymentInstructions.fields.filter((field) => field?.value)
    : [];
  const hasInstructions = Boolean(paymentInstructions.instructions);
  const checkoutUrl = paymentInstructions.checkoutUrl || "";
  const qrCodeUrl = paymentInstructions.qrCodeUrl || "";
  const isMercadoPago = paymentInstructions.method === "MERCADO_PAGO";
  const isBankTransfer = paymentInstructions.method === "BANK_TRANSFER";
  const transferReasonText =
    isBankTransfer && orderLabel
      ? `Importante: en el motivo/concepto de la transferencia escribí tu número de orden: ${orderLabel}.`
      : "";
  if (
    !fields.length &&
    !hasInstructions &&
    !checkoutUrl &&
    !qrCodeUrl &&
    !transferReasonText
  )
    return "";

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

  const instructionsHtml = hasInstructions
    ? `<p style="margin:12px 0 0; color:#56737a; font-size:14px; line-height:1.55;">${escapeHtml(paymentInstructions.instructions).replace(/\n/g, "<br />")}</p>`
    : "";
  const transferReasonHtml = transferReasonText
    ? `<p style="margin:14px 0 0; padding:12px 14px; background:#fff4eb; border:1px solid rgba(236,103,43,0.36); color:#ec672b; font-size:14px; line-height:1.5; font-weight:700;">${escapeHtml(transferReasonText)}</p>`
    : "";

  const mercadoPagoButtonHtml =
    isMercadoPago && checkoutUrl
      ? `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:16px 0 0;">
        <tr>
          <td>
            <a href="${escapeHtml(checkoutUrl)}" target="_blank" style="display:inline-block; padding:12px 18px; background:#008e97; color:#ffffff; text-decoration:none; font-weight:700; border:1px solid #008e97;">Pagar ahora con Mercado Pago</a>
          </td>
        </tr>
      </table>
    `
      : "";

  const qrHtml =
    isMercadoPago && qrCodeUrl
      ? `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:16px 0 0;">
        <tr>
          <td style="padding:12px; border:1px solid rgba(16,43,52,0.14); background:#ffffff;">
            <img src="${escapeHtml(qrCodeUrl)}" width="180" height="180" alt="QR para pagar con Mercado Pago" style="display:block; width:180px; height:180px; border:0; outline:none; text-decoration:none;" />
          </td>
        </tr>
        <tr>
          <td style="padding-top:8px; color:#56737a; font-size:12px; line-height:1.45;">Escaneá este QR para abrir el pago en Mercado Pago. Si no ves la imagen, usá el botón o el link de pago.</td>
        </tr>
      </table>
    `
      : "";

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:22px 0; background:#ffffff; border:1px solid rgba(16,43,52,0.14);">
      <tr>
        <td style="padding:16px 18px;">
          <p style="margin:0 0 10px; color:#008e97; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;">${escapeHtml(paymentInstructions.title || "Datos de pago")}</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-meta-table">
            ${rows}
          </table>
          ${mercadoPagoButtonHtml}
          ${qrHtml}
          ${transferReasonHtml}
          ${instructionsHtml}
        </td>
      </tr>
    </table>
  `;
}

function formatPaymentInstructionLines(paymentInstructions, orderLabel) {
  if (!paymentInstructions) return [];
  const lines = [];
  const fields = Array.isArray(paymentInstructions.fields)
    ? paymentInstructions.fields.filter((field) => field?.value)
    : [];

  if (
    !fields.length &&
    !paymentInstructions.instructions &&
    !paymentInstructions.checkoutUrl &&
    !(paymentInstructions.method === "BANK_TRANSFER" && orderLabel)
  )
    return lines;

  lines.push("", paymentInstructions.title || "Datos de pago");
  fields.forEach((field) => lines.push(`${field.label}: ${field.value}`));
  if (
    paymentInstructions.method === "MERCADO_PAGO" &&
    paymentInstructions.checkoutUrl
  ) {
    lines.push(
      `Pagar ahora con Mercado Pago: ${paymentInstructions.checkoutUrl}`,
    );
    if (paymentInstructions.qrCodeUrl) {
      lines.push(`QR de pago: ${paymentInstructions.qrCodeUrl}`);
    }
  }
  if (paymentInstructions.instructions) {
    lines.push(String(paymentInstructions.instructions));
  }
  if (paymentInstructions.method === "BANK_TRANSFER" && orderLabel) {
    lines.push(
      `Importante: en el motivo/concepto de la transferencia escribí tu número de orden: ${orderLabel}.`,
    );
  }
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
  const subject = `Recibimos tu orden - Pago pendiente`;
  const preheader = "Recibimos tu orden y reservamos tus prendas por 24 horas.";

  const textLines = [
    `Hola ${name},`,
    "",
    "Recibimos tu orden en ESADAR.",
    "La recepción del pago está pendiente.",
    "Reservamos tu orden por 24 horas.",
    "",
    `Orden: ${orderLabel}`,
    `Total de artículos: ${articleCount}`,
    `Total: ${total}`,
    "Estado: Pago pendiente",
  ];
  if (paymentMethod) textLines.push(`Método de pago: ${paymentMethod}`);
  if (shippingMethod) textLines.push(`Método de envío: ${shippingMethod}`);
  textLines.push(...formatOrderItemsTextLines(items));
  textLines.push(
    ...formatPaymentInstructionLines(paymentInstructions, orderLabel),
  );
  textLines.push(
    "",
    "Los datos de pago también quedan incluidos en este correo.",
    TRACKING_AVAILABILITY_COPY,
    "Podés revisar los detalles desde tu cuenta.",
    orderUrl,
    "",
    "Equipo ESADAR",
  );

  const bodyHtml = `
    <p style="margin:0 0 14px;">Hola ${escapeHtml(name)},</p>
    <p style="margin:0 0 14px;">Recibimos tu orden en <strong style="color:#102b34;">ESADAR</strong>.</p>
    <p style="margin:0 0 14px;">La recepción del pago está <strong style="color:#102b34;">pendiente</strong>.</p>
    <p style="margin:0 0 18px;">Reservamos tu orden por <strong style="color:#102b34;">24 horas</strong>.</p>
    <p style="margin:0 0 18px;">Los datos de pago también quedan incluidos en este correo. El comprobante PDF se enviará cuando la orden sea aprobada.</p>
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
    ${renderPaymentInstructions(paymentInstructions, orderLabel)}
    ${renderOrderItemsTable(items, urlOptions)}
  `;

  return {
    subject,
    preheader,
    text: textLines.join("\n"),
    html: renderEmailShell({
      subject,
      preheader,
      eyebrow: "ORDEN RECIBIDA",
      title: "Recibimos tu orden",
      bodyHtml,
      detailsHtml,
      ctaHtml: renderButton(orderUrl, "Ver mi orden"),
      publicSiteUrl,
    }),
  };
}
