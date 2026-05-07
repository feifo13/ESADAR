import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/app-error.js';

let cachedTransporter = null;

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function assertPasswordResetMailerReady() {
  if (!env.mail.host || !env.mail.fromEmail) {
    throw new AppError(
      'El sistema de correo no esta configurado para recuperar contraseñas.',
      503,
    );
  }
}

function getTransporter() {
  assertPasswordResetMailerReady();

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
    });
  }

  return cachedTransporter;
}

export async function sendPasswordResetEmail({ toEmail, toName, resetUrl }) {
  const transporter = getTransporter();
  const safeName = escapeHtml(toName || '');
  const safeResetUrl = escapeHtml(resetUrl);
  const subject = 'Recuperar contraseña de ESADAR';
  const greeting = `Hola ${toName || ''}`.trim();
  const plainText = [
    greeting,
    '',
    'Recibimos una solicitud para recuperar tu contraseña de ESADAR.',
    'Usa este link para elegir una nueva contraseña:',
    resetUrl,
    '',
    'El link vence en 1 hora. Si no hiciste esta solicitud, puedes ignorar este mensaje.',
    '',
    'Equipo ESADAR',
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;color:#102b34;line-height:1.6;">
      <p>Hola ${safeName},</p>
      <p>Recibimos una solicitud para recuperar tu contraseña de ESADAR.</p>
      <p>
        <a href="${safeResetUrl}" style="display:inline-block;padding:12px 18px;background:#20b8c7;color:#ffffff;text-decoration:none;font-weight:700;">
          Crear nueva contraseña
        </a>
      </p>
      <p>Si el botón no funciona, copia y pega este link en tu navegador:</p>
      <p style="word-break:break-all;">${safeResetUrl}</p>
      <p>El link vence en 1 hora. Si no hiciste esta solicitud, puedes ignorar este mensaje.</p>
      <p>Equipo ESADAR</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"${env.mail.fromName}" <${env.mail.fromEmail}>`,
    to: toEmail,
    replyTo: env.mail.replyTo || env.mail.fromEmail,
    subject,
    text: plainText,
    html,
  });
}
