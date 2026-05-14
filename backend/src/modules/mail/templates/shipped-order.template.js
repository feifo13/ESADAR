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

export function renderShippedOrderEmail({ order, publicSiteUrl } = {}) {
  const urlOptions = { publicSiteUrl };
  const items = order?.items || [];
  const name = buildCustomerName(order?.customer);
  const orderLabel = order?.orderNumber || order?.id || "";
  const orderUrl = buildOrderUrl(order, urlOptions);
  const total = formatCurrencyUYU(order?.total, order?.currencyCode || "UYU");
  const articleCount = formatOrderArticleCount(items);
  const paymentMethod = getPaymentMethodLabel(order?.paymentMethod);
  const shippingMethod = order?.shippingMethodDescription || "";
  const subject = `Tu orden fue enviada - ${orderLabel}`;
  const preheader = "Tu compra ya fue marcada como enviada.";

  const textLines = [
    `Hola ${name},`,
    "",
    "Tu orden fue enviada.",
    "",
    `Orden: ${orderLabel}`,
    `Total de artículos: ${articleCount}`,
    `Total: ${total}`,
    "Estado: Enviada",
  ];
  if (paymentMethod) textLines.push(`Método de pago: ${paymentMethod}`);
  if (shippingMethod) textLines.push(`Método de envío: ${shippingMethod}`);
  textLines.push(...formatOrderItemsTextLines(items, { title: "Prendas enviadas" }));
  textLines.push("", "Podés revisar los detalles desde tu cuenta.", orderUrl, "", "Equipo ESADAR");

  const bodyHtml = `
    <p style="margin:0 0 14px;">Hola ${escapeHtml(name)},</p>
    <p style="margin:0 0 14px;">Tu orden fue <strong style="color:#102b34;">enviada</strong>.</p>
    <p style="margin:0 0 14px;">Te avisamos para que puedas seguir el estado de tu compra desde tu cuenta.</p>
    <p style="margin:0 0 18px;">Gracias por elegir <strong style="color:#102b34;">ESADAR</strong>.</p>
  `;

  const detailsHtml = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:22px 0; background:#eef4f5; border:1px solid rgba(16,43,52,0.12);">
      <tr>
        <td style="padding:18px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-meta-table">
            ${renderSummaryRow("Orden", orderLabel)}
            ${renderSummaryRow("Total de artículos", articleCount)}
            ${renderSummaryRow("Total", total, { large: true })}
            ${renderSummaryRow("Estado", "Enviada", { accent: true })}
            ${renderSummaryRow("Método de pago", paymentMethod)}
            ${renderSummaryRow("Método de envío", shippingMethod)}
          </table>
        </td>
      </tr>
    </table>
    ${renderOrderItemsTable(items, urlOptions, { title: "Prendas enviadas" })}
  `;

  return {
    subject,
    preheader,
    text: textLines.join("\n"),
    html: renderEmailShell({
      subject,
      preheader,
      eyebrow: "ORDEN ENVIADA",
      title: "Tu orden fue enviada",
      bodyHtml,
      detailsHtml,
      ctaHtml: renderButton(orderUrl, "Ver mi orden"),
      publicSiteUrl,
    }),
  };
}
