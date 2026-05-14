import { escapeHtml } from "../mail.escape.js";
import { getArticleEmailImageUrl } from "../mail.assets.js";
import { formatCurrencyUYU } from "../mail.format.js";

function getItemQuantity(item) {
  const quantity = Number(item?.quantity);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function hasAcceptedOffer(item) {
  return Boolean(
    item?.acceptedOffer ||
      item?.acceptedOfferId ||
      item?.acceptedOfferPrice ||
      item?.acceptedOfferPriceSnapshot ||
      Number(item?.acceptedOfferQuantity || item?.acceptedOfferQuantitySnapshot || 0) > 0,
  );
}

function getAcceptedOfferPrice(item) {
  const value =
    item?.acceptedOffer?.price ??
    item?.acceptedOfferPrice ??
    item?.acceptedOfferPriceSnapshot ??
    null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function renderOfferBadge(item, currencyCode) {
  if (!hasAcceptedOffer(item)) return "";

  const acceptedOfferPrice = getAcceptedOfferPrice(item);
  const label = acceptedOfferPrice
    ? `Oferta aplicada: ${formatCurrencyUYU(acceptedOfferPrice, currencyCode)}`
    : "Oferta aplicada";

  return `<br /><span style="display:inline-block; margin-top:5px; padding:3px 7px; background:#eef8f6; color:#008e97; border:1px solid rgba(0,142,151,0.25); font-size:12px; font-weight:700;">${escapeHtml(label)}</span>`;
}

export function getOrderArticleCount(items = []) {
  if (!Array.isArray(items) || !items.length) return 0;
  return items.reduce((total, item) => total + getItemQuantity(item), 0);
}

export function formatOrderArticleCount(items = []) {
  const count = getOrderArticleCount(items);
  return `${count} ${count === 1 ? "artículo" : "artículos"}`;
}

export function formatOrderItemsTextLines(items = [], options = {}) {
  if (!Array.isArray(items) || !items.length) return [];

  const title = options.title || "Prendas de la orden";
  return [
    "",
    `${title}:`,
    ...items.map((item) => {
      const itemTitle = item.articleTitle || item.title || "Prenda";
      const quantity = getItemQuantity(item);
      const lineTotal = formatCurrencyUYU(item.lineTotal, item.currencyCode || "UYU");
      const offerSuffix = hasAcceptedOffer(item) ? " - Oferta aplicada" : "";
      return `- ${itemTitle} x${quantity}: ${lineTotal}${offerSuffix}`;
    }),
  ];
}

export function renderOrderItemsTable(items = [], urlOptions = {}, options = {}) {
  if (!Array.isArray(items) || !items.length) return "";

  const title = options.title || "Prendas de la orden";
  const rows = items
    .map((item) => {
      const itemTitle = item.articleTitle || item.title || "Prenda";
      const quantity = getItemQuantity(item);
      const currencyCode = item.currencyCode || "UYU";
      const lineTotal = formatCurrencyUYU(item.lineTotal, currencyCode);
      const imageUrl = getArticleEmailImageUrl(item.image || item.imageSnapshot || item, urlOptions);
      const imageCell = imageUrl
        ? `<td style="padding:10px 12px 10px 0; width:58px;" valign="top"><img class="email-item-image" src="${escapeHtml(imageUrl)}" width="52" height="52" alt="${escapeHtml(itemTitle)}" style="display:block; width:52px; height:52px; object-fit:cover; border:0; outline:none; text-decoration:none;" /></td>`
        : "";

      return `
        <tr>
          ${imageCell}
          <td style="padding:10px 0; border-top:1px solid rgba(16,43,52,0.10); color:#102b34; font-size:14px; line-height:1.45;" valign="middle">
            <strong>${escapeHtml(itemTitle)}</strong><br />
            <span style="color:#56737a;">Cantidad: ${escapeHtml(quantity)}</span>
            ${renderOfferBadge(item, currencyCode)}
          </td>
          <td align="right" style="padding:10px 0 10px 12px; border-top:1px solid rgba(16,43,52,0.10); color:#102b34; font-size:14px; font-weight:700; white-space:nowrap;" valign="middle">${escapeHtml(lineTotal)}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:22px 0; background:#ffffff; border:1px solid rgba(16,43,52,0.12);">
      <tr>
        <td style="padding:14px 16px 6px; color:#102b34; font-size:15px; font-weight:700;">${escapeHtml(title)}</td>
      </tr>
      <tr>
        <td style="padding:0 16px 12px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${rows}</table>
        </td>
      </tr>
    </table>
  `;
}
