import { env } from "../../../config/env.js";
import { escapeHtml, nl2br } from "../mail.escape.js";
import { renderEmailShell } from "./base-shell.js";

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

export function renderContactReplyEmail({ toName, message, replyMessage } = {}) {
  const name = toName || "";
  const subject = "Respuesta de ESADAR para tu consulta";
  const preheader = "Te respondimos el mensaje que nos enviaste.";
  const greeting = `Hola ${name}`.trim();
  const text = [
    greeting,
    "",
    "Gracias por escribirnos a ESADAR. Te dejamos nuestra respuesta:",
    "",
    replyMessage || "",
    "",
    "Tu mensaje original:",
    message || "",
    "",
    "Equipo ESADAR",
  ].join("\n");

  const bodyHtml = `
    <p style="margin:0 0 14px;">${escapeHtml(greeting)},</p>
    <p style="margin:0 0 18px;">Gracias por escribirnos a <strong style="color:#102b34;">ESADAR</strong>. Te dejamos nuestra respuesta:</p>
    <div style="margin:22px 0; padding:18px; background:#eef4f5; border:1px solid rgba(16,43,52,0.12); color:#102b34; font-size:15px; line-height:1.65;">${nl2br(replyMessage)}</div>
    <p style="margin:22px 0 8px; color:#102b34; font-weight:700;">Tu mensaje original</p>
    <div style="padding:16px; background:#ffffff; border:1px solid rgba(16,43,52,0.12); color:#56737a; font-size:14px; line-height:1.6;">${nl2br(message)}</div>
  `;

  return {
    subject,
    preheader,
    text,
    html: renderEmailShell({
      subject,
      preheader,
      eyebrow: "RESPUESTA DE ESADAR",
      title: "Respondimos tu consulta",
      bodyHtml,
      ctaHtml: renderButton(env.publicSiteUrl, "Ir a ESADAR"),
    }),
  };
}
