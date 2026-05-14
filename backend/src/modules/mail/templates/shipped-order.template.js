import { escapeHtml } from "../mail.escape.js";
import { getArticleEmailImageUrl } from "../mail.assets.js";
import { buildCustomerName, formatCurrencyUYU, formatDateTimeEsUy } from "../mail.format.js";
import { getPaymentMethodLabel } from "../../payment-methods.js";
import { renderEmailShell } from "./base-shell.js";
import { buildOrderUrl } from "./url-helpers.js";

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

function renderOrderItems(items = [], urlOptions = {}) {
  const visibleItems = items.slice(0, 3);
  if (!visibleItems.length) return "";

  const rows = visibleItems
    .map((item) => {
      const title = item.articleTitle || item.title || "Prenda";
      const quantity = Number(item.quantity || 1);
      const lineTotal = formatCurrencyUYU(item.lineTotal, item.currencyCode || "UYU");
      const imageUrl = getArticleEmailImageUrl(item.image || item.imageSnapshot || item, urlOptions);
      const imageCell = imageUrl
        ? `<td style="padding:10px 12px 10px 0; width:58px;" valign="top"><img class="email-item-image" src="${escapeHtml(imageUrl)}" width="52" height="52" alt="${escapeHtml(title)}" style="display:block; width:52px; height:52px; object-fit:cover; border:0; outline:none; text-decoration:none;" /></td>`
        : "";

      return `
        <tr>
          ${imageCell}
          <td style="padding:10px 0; border-top:1px solid rgba(16,43,52,0.10); color:#102b34; font-size:14px; line-height:1.45;" valign="middle">
            <strong>${escapeHtml(title)}</strong><br />
            <span style="color:#56737a;">Cantidad: ${escapeHtml(quantity)}</span>
          </td>
          <td align="right" style="padding:10px 0 10px 12px; border-top:1px solid rgba(16,43,52,0.10); color:#102b34; font-size:14px; font-weight:700; white-space:nowrap;" valign="middle">${escapeHtml(lineTotal)}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:22px 0; background:#ffffff; border:1px solid rgba(16,43,52,0.12);">
      <tr>
        <td style="padding:14px 16px 6px; color:#102b34; font-size:15px; font-weight:700;">Prendas enviadas</td>
      </tr>
      <tr>
        <td style="padding:0 16px 12px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${rows}</table>
        </td>
      </tr>
    </table>
  `;
}

export function renderShippedOrderEmail({ order, publicSiteUrl } = {}) {
  const urlOptions = { publicSiteUrl };
  const name = buildCustomerName(order?.customer);
  const orderLabel = order?.orderNumber || order?.id || "";
  const orderUrl = buildOrderUrl(order, urlOptions);
  const total = formatCurrencyUYU(order?.total, order?.currencyCode || "UYU");
  const paymentMethod = getPaymentMethodLabel(order?.paymentMethod);
  const shippingMethod = order?.shippingMethodDescription || "";
  const shippedAt = formatDateTimeEsUy(order?.shippedAt);
  const subject = `Tu orden fue enviada - ${orderLabel}`;
  const preheader = "Tu compra ya fue marcada como enviada.";

  const textLines = [
    `Hola ${name},`,
    "",
    "Tu orden fue enviada.",
    "",
    `Orden: ${orderLabel}`,
    `Total: ${total}`,
    "Estado: Enviada",
  ];
  if (shippedAt) textLines.push(`Fecha de envío: ${shippedAt}`);
  if (paymentMethod) textLines.push(`Método de pago: ${paymentMethod}`);
  if (shippingMethod) textLines.push(`Método de envío: ${shippingMethod}`);
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
            ${renderSummaryRow("Total", total, { large: true })}
            ${renderSummaryRow("Estado", "Enviada", { accent: true })}
            ${renderSummaryRow("Fecha de envío", shippedAt)}
            ${renderSummaryRow("Método de pago", paymentMethod)}
            ${renderSummaryRow("Método de envío", shippingMethod)}
          </table>
        </td>
      </tr>
    </table>
    ${renderOrderItems(order?.items || [], urlOptions)}
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
