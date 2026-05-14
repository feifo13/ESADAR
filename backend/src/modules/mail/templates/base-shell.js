import { env } from "../../../config/env.js";
import { escapeHtml } from "../mail.escape.js";
import { getEmailLogoSrc, getEmailBrandGradientSrc } from "../mail.assets.js";
import { buildPublicUrl } from "./url-helpers.js";

export function renderEmailShell({
  subject,
  preheader,
  eyebrow,
  title,
  bodyHtml,
  detailsHtml = "",
  ctaHtml = "",
  secondaryHtml = "",
  publicSiteUrl,
}) {
  const safeSubject = escapeHtml(subject || env.storeName || "ESADAR");
  const safePreheader = escapeHtml(preheader || "");
  const safeEyebrow = escapeHtml(eyebrow || "");
  const safeTitle = escapeHtml(title || "");
  const urlOptions = { publicSiteUrl };
  const logoUrl = escapeHtml(getEmailLogoSrc(urlOptions));
  const brandGradientUrl = escapeHtml(getEmailBrandGradientSrc(urlOptions));
  const siteUrl = escapeHtml(buildPublicUrl("/", urlOptions));

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>${safeSubject}</title>
    <style>
      @media only screen and (max-width: 620px) {
        .email-container { width: 100% !important; }
        .email-content { padding: 24px 20px !important; }
        .email-title { font-size: 26px !important; line-height: 1.12 !important; }
        .email-button { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; }
        .email-meta-table td { display: block !important; width: 100% !important; padding: 7px 0 !important; text-align: left !important; }
        .email-item-image { width: 64px !important; height: 64px !important; }
      }
    </style>
  </head>
  <body style="margin:0; padding:0; background:#f7fafb; color:#102b34; font-family:'IBM Plex Sans', Arial, Helvetica, sans-serif;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent; line-height:1px; font-size:1px;">
      ${safePreheader}
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f7fafb; margin:0; padding:0;">
      <tr>
        <td align="center" style="padding:28px 12px;">
          <table role="presentation" class="email-container" width="640" cellspacing="0" cellpadding="0" border="0" style="width:640px; max-width:640px;">
            <tr>
              <td align="left" style="padding:0 4px 18px;">
                <a href="${siteUrl}" target="_blank" style="display:inline-block; text-decoration:none;">
                  <img src="${logoUrl}" width="118" alt="ESADAR" style="display:block; width:118px; max-width:118px; height:auto; border:0; outline:none; text-decoration:none;" />
                </a>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff; border:1px solid rgba(16,43,52,0.12); box-shadow:0 16px 40px rgba(0,34,68,0.08); overflow:hidden;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="background:#002244; font-size:0; line-height:0;">
                      <img
                        src="${brandGradientUrl}"
                        width="640"
                        height="8"
                        alt=""
                        style="display:block; width:100%; max-width:640px; height:8px; border:0; outline:none; text-decoration:none;"
                      />
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td class="email-content" style="padding:32px 32px 28px;">
                      ${safeEyebrow ? `<p style="margin:0 0 8px; color:#008e97; text-transform:uppercase; letter-spacing:0.08em; font-size:12px; font-weight:700;">${safeEyebrow}</p>` : ""}
                      ${safeTitle ? `<h1 class="email-title" style="margin:0 0 16px; color:#102b34; font-size:32px; line-height:1.05; font-weight:700;">${safeTitle}</h1>` : ""}
                      <div style="color:#56737a; font-size:16px; line-height:1.65;">
                        ${bodyHtml || ""}
                      </div>
                      ${detailsHtml || ""}
                      ${ctaHtml || ""}
                      ${secondaryHtml || ""}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:22px 20px 0;">
                <p style="margin:0 0 8px; color:#56737a; font-size:13px; line-height:1.5;">ESADAR · Curaduría de prendas</p>
                <p style="margin:0; color:#7b9399; font-size:12px; line-height:1.5;">Recibiste este correo porque tenés una cuenta, orden, consulta u operación asociada a ESADAR.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
