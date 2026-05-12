import { escapeHtml } from "../mail.escape.js";
import { renderEmailShell } from "./base-shell.js";
import { buildResetPasswordUrl, buildLoginUrl } from "./url-helpers.js";

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

export function renderPasswordResetEmail({ toName, resetUrl } = {}) {
  const targetUrl = buildResetPasswordUrl(resetUrl);
  const loginUrl = buildLoginUrl();
  const name = toName || "";
  const subject = "Recuperar contraseña de ESADAR";
  const preheader = "Usá este enlace para crear una nueva contraseña. Vence en 1 hora.";
  const greeting = `Hola ${name}`.trim();
  const text = [
    greeting,
    "",
    "Recibimos una solicitud para recuperar tu contraseña de ESADAR.",
    "Usá este enlace para elegir una nueva contraseña:",
    targetUrl,
    "",
    "El enlace vence en 1 hora. Si no hiciste esta solicitud, podés ignorar este mensaje.",
    "",
    "Equipo ESADAR",
  ].join("\n");

  const bodyHtml = `
    <p style="margin:0 0 14px;">${escapeHtml(greeting)},</p>
    <p style="margin:0 0 14px;">Recibimos una solicitud para recuperar tu contraseña de <strong style="color:#102b34;">ESADAR</strong>.</p>
    <p style="margin:0 0 18px;">Usá el botón de abajo para crear una nueva contraseña. Este enlace vence en <strong style="color:#102b34;">1 hora</strong>.</p>
  `;

  const secondaryHtml = `
    <p style="margin:22px 0 0; color:#56737a; font-size:14px; line-height:1.6;">Si el botón no funciona, copiá y pegá este enlace en tu navegador:</p>
    <p style="margin:8px 0 0; color:#102b34; font-size:13px; line-height:1.5; word-break:break-all;">${escapeHtml(targetUrl)}</p>
    <p style="margin:22px 0 0; color:#56737a; font-size:14px; line-height:1.6;">Si no hiciste esta solicitud, podés ignorar este mensaje.</p>
  `;

  return {
    subject,
    preheader,
    text,
    html: renderEmailShell({
      subject,
      preheader,
      eyebrow: "SEGURIDAD DE CUENTA",
      title: "Recuperar contraseña",
      bodyHtml,
      ctaHtml: renderButton(targetUrl, "Crear nueva contraseña"),
      secondaryHtml: `${secondaryHtml}${renderButton(loginUrl, "Ir al login")}`,
    }),
  };
}
