import { escapeHtml } from "../mail.escape.js";
import { buildCustomerName } from "../mail.format.js";
import { renderEmailShell } from "./base-shell.js";
import { buildAccountUrl } from "./url-helpers.js";

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

export function renderWelcomeUserEmail({ user, accountUrl, publicSiteUrl } = {}) {
  const urlOptions = { publicSiteUrl };
  const name = buildCustomerName(user);
  const targetUrl = accountUrl || buildAccountUrl(urlOptions);
  const subject = "Bienvenido/a a ESADAR";
  const preheader = "Tu cuenta ya está lista para guardar prendas, hacer ofertas y comprar.";
  const text = [
    `Hola ${name},`,
    "",
    "Tu cuenta en ESADAR ya está activa.",
    "Desde ahora podés guardar prendas, hacer ofertas, seguir tus órdenes y completar compras desde tu cuenta.",
    "",
    targetUrl,
    "",
    "Equipo ESADAR",
  ].join("\n");

  const bodyHtml = `
    <p style="margin:0 0 14px;">Hola ${escapeHtml(name)},</p>
    <p style="margin:0 0 14px;">Tu cuenta en <strong style="color:#102b34;">ESADAR</strong> ya está activa.</p>
    <p style="margin:0 0 18px;">Desde ahora podés guardar prendas, hacer ofertas, seguir tus órdenes y completar compras desde tu cuenta.</p>
  `;

  return {
    subject,
    preheader,
    text,
    html: renderEmailShell({
      subject,
      preheader,
      eyebrow: "NUEVA CUENTA",
      title: "Bienvenido/a a ESADAR",
      bodyHtml,
      ctaHtml: renderButton(targetUrl, "Ir a mi cuenta"),
      publicSiteUrl,
    }),
  };
}
