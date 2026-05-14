import { escapeHtml } from "../mail.escape.js";
import { getArticleEmailImageUrl } from "../mail.assets.js";
import { buildCustomerName, formatCurrencyUYU } from "../mail.format.js";
import { renderEmailShell } from "./base-shell.js";
import { buildArticleUrl } from "./url-helpers.js";

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

function renderArticleImage(imageUrl, title) {
  if (!imageUrl) return "";

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:18px 0 22px; background:#eef4f5; border:1px solid rgba(16,43,52,0.12);">
      <tr>
        <td style="padding:14px; width:92px;" valign="top">
          <img src="${escapeHtml(imageUrl)}" width="80" alt="${escapeHtml(title)}" style="display:block; width:80px; height:80px; object-fit:cover; border:0; outline:none; text-decoration:none;" />
        </td>
        <td style="padding:14px 14px 14px 0; color:#102b34; font-size:15px; line-height:1.45; font-weight:700;" valign="middle">
          ${escapeHtml(title)}
        </td>
      </tr>
    </table>
  `;
}

export function renderAcceptedOfferEmail({ offer, publicSiteUrl } = {}) {
  const urlOptions = { publicSiteUrl };
  const name = buildCustomerName(offer?.contact);
  const articleTitle = offer?.article?.title || "la prenda";
  const articleUrl = buildArticleUrl(offer?.article, urlOptions);
  const amount = formatCurrencyUYU(offer?.offeredAmount, offer?.currencyCode || "UYU");
  const imageUrl = getArticleEmailImageUrl(offer?.article?.image || offer?.article, urlOptions);
  const subject = `Aceptamos tu oferta - ${articleTitle}`;
  const preheader = "Tu oferta fue aceptada y ya podés comprar la prenda.";
  const plainText = [
    `Hola ${name},`,
    "",
    `Aceptamos tu oferta por ${articleTitle}.`,
    `Precio aceptado: ${amount}.`,
    "La oferta aplica a 1 unidad.",
    "",
    "Para comprarla, ingresá al sistema y agregá la prenda al carrito. Vas a ver la oferta aceptada aplicada en tu cuenta.",
    articleUrl,
    "",
    "Equipo ESADAR",
  ].join("\n");

  const bodyHtml = `
    <p style="margin:0 0 14px;">Hola ${escapeHtml(name)},</p>
    <p style="margin:0 0 14px;"><strong style="color:#102b34;">Aceptamos tu oferta</strong> por la prenda:</p>
    ${renderArticleImage(imageUrl, articleTitle)}
    ${!imageUrl ? `<p style="margin:0 0 18px; color:#102b34; font-size:18px; font-weight:700;">${escapeHtml(articleTitle)}</p>` : ""}
    <p style="margin:0 0 18px;">Para comprarla, ingresá al sistema y agregá la prenda al carrito. Vas a ver la oferta aceptada aplicada en tu cuenta.</p>
  `;

  const detailsHtml = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:22px 0; background:#eef4f5; border:1px solid rgba(16,43,52,0.12);">
      <tr>
        <td style="padding:18px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-meta-table">
            <tr>
              <td style="padding:4px 0; color:#56737a; font-size:14px;">Precio aceptado</td>
              <td align="right" style="padding:4px 0; color:#102b34; font-size:20px; font-weight:700;">${escapeHtml(amount)}</td>
            </tr>
            <tr>
              <td style="padding:4px 0; color:#56737a; font-size:14px;">Regla de oferta</td>
              <td align="right" style="padding:4px 0; color:#102b34; font-size:14px; font-weight:700;">Aplica a 1 unidad</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  return {
    subject,
    preheader,
    text: plainText,
    html: renderEmailShell({
      subject,
      preheader,
      eyebrow: "OFERTA ACEPTADA",
      title: "Aceptamos tu oferta",
      bodyHtml,
      detailsHtml,
      ctaHtml: renderButton(articleUrl, "Ver prenda"),
      publicSiteUrl,
    }),
  };
}
