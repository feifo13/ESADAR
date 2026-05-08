import nodemailer from "nodemailer";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/app-error.js";
import { getDefaultEmailAttachments } from "./mail.assets.js";

let cachedTransporter = null;

export function isMailConfigured() {
  return Boolean(env.mail.host && env.mail.fromEmail);
}

export function assertMailConfigured(message = "El sistema de correo no esta configurado.") {
  if (!isMailConfigured()) {
    throw new AppError(message, 503);
  }
}

export function getMailTransporter({ requiredMessage } = {}) {
  if (!isMailConfigured()) {
    if (requiredMessage) assertMailConfigured(requiredMessage);
    return null;
  }

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

export function sanitizeSmtpErrorDetails(error) {
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

export async function sendBrandedEmail({
  to,
  subject,
  text,
  html,
  replyTo,
  requiredMessage,
  smtpErrorMessage,
  smtpErrorStatus = 502,
  attachments = [],
}) {
  const transporter = getMailTransporter({ requiredMessage });
  if (!transporter) return { skipped: true };

  try {
    const result = await transporter.sendMail({
      from: `"${env.mail.fromName}" <${env.mail.fromEmail}>`,
      to,
      replyTo: replyTo || env.mail.replyTo || env.mail.fromEmail,
      subject,
      text,
      html,
      attachments: [...getDefaultEmailAttachments(), ...attachments],
    });

    return { skipped: false, result };
  } catch (error) {
    if (smtpErrorMessage) {
      throw new AppError(
        smtpErrorMessage,
        smtpErrorStatus,
        sanitizeSmtpErrorDetails(error),
      );
    }
    throw error;
  }
}
