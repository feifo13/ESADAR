import nodemailer from "nodemailer";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/app-error.js";

let cachedTransporter = null;

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sanitizeSmtpErrorDetails(error) {
  if (env.isProduction) return null;

  const redactions = [
    env.mail.user,
    env.mail.fromEmail,
    env.mail.replyTo,
    env.mail.password,
  ]
    .filter(Boolean)
    .map((value) => String(value));

  function redact(value) {
    let text = String(value || "");
    for (const secret of redactions) {
      if (secret) text = text.split(secret).join("[redacted]");
    }
    return text.slice(0, 500);
  }

  return {
    code: error?.code || null,
    command: error?.command || null,
    responseCode: error?.responseCode || null,
    response: error?.response ? redact(error.response) : null,
  };
}

function ensureMailConfig() {
  if (!env.mail.host || !env.mail.fromEmail) {
    throw new AppError(
      "El sistema de correo no esta configurado para responder mensajes.",
      503,
    );
  }
}

function getTransporter() {
  ensureMailConfig();

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: env.mail.host,
      port: env.mail.port,
      secure: env.mail.secure,
      auth: env.mail.user
        ? {
            user: env.mail.user,
            pass: env.mail.password,
          }
        : undefined,
      tls: {
        rejectUnauthorized: env.mail.tlsRejectUnauthorized,
        servername: env.mail.host,
      },
    });
  }

  return cachedTransporter;
}

export async function sendContactReplyEmail({
  toEmail,
  toName,
  message,
  replyMessage,
}) {
  if (!toEmail) {
    throw new AppError("Este mensaje no tiene email para responder.", 400);
  }

  const transporter = getTransporter();
  const safeName = escapeHtml(toName || "");
  const safeReplyMessage = escapeHtml(replyMessage);
  const safeOriginalMessage = escapeHtml(message || "");
  const subject = `Respuesta de ESADAR para ${toName || "tu consulta"}`;
  const plainText = [
    `Hola ${toName || ""}`.trim(),
    "",
    "Gracias por escribirnos a ESADAR.",
    "",
    "Esta es nuestra respuesta:",
    replyMessage,
    "",
    "Tu mensaje original:",
    message || "",
    "",
    "Equipo ESADAR",
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;color:#102b34;line-height:1.6;">
      <p>Hola ${safeName},</p>
      <p>Gracias por escribirnos a ESADAR.</p>
      <p><strong>Esta es nuestra respuesta:</strong></p>
      <div style="padding:16px;border:1px solid #d8e3e8;background:#f7fbfc;white-space:pre-wrap;">${safeReplyMessage}</div>
      <p style="margin-top:20px;"><strong>Tu mensaje original:</strong></p>
      <div style="padding:16px;border:1px solid #e6ecef;background:#ffffff;white-space:pre-wrap;">${safeOriginalMessage}</div>
      <p style="margin-top:20px;">Equipo ESADAR</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"${env.mail.fromName}" <${env.mail.fromEmail}>`,
      to: toEmail,
      replyTo: env.mail.replyTo || env.mail.fromEmail,
      subject,
      text: plainText,
      html,
    });
  } catch (error) {
    throw new AppError(
      "No se pudo enviar el correo SMTP. Revisá la configuración de Gmail/App Password.",
      502,
      sanitizeSmtpErrorDetails(error),
    );
  }
}
