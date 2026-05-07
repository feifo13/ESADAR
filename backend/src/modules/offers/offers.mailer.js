import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';

let transporter = null;

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getTransporter() {
  if (!env.mail.host || !env.mail.fromEmail) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.mail.host,
      port: env.mail.port,
      secure: env.mail.secure,
      auth: env.mail.user ? { user: env.mail.user, pass: env.mail.password } : undefined,
    });
  }
  return transporter;
}

export async function sendAcceptedOfferEmail(offer) {
  const toEmail = offer?.contact?.email;
  if (!toEmail) return;
  const mailer = getTransporter();
  if (!mailer) return;

  const name = [offer.contact?.firstName, offer.contact?.lastName].filter(Boolean).join(' ') || 'cliente';
  const articleTitle = offer.article?.title || 'la prenda';
  const amount = Number(offer.offeredAmount || 0).toLocaleString('es-UY', {
    style: 'currency',
    currency: offer.currencyCode || 'UYU',
    maximumFractionDigits: 0,
  });
  const articleUrl = `${env.publicSiteUrl}/articles/${offer.article?.slug || offer.article?.id || ''}`;

  const text = [
    `Hola ${name},`,
    '',
    `Aceptamos tu oferta por ${articleTitle}.`,
    `Precio aceptado: ${amount}.`,
    'La oferta aplica a 1 unidad.',
    '',
    'Para comprar, ingresa al sistema y agrega la prenda al carrito. Vas a ver la oferta aceptada disponible en tu cuenta.',
    articleUrl,
    '',
    'Equipo ESADAR',
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;color:#102b34;line-height:1.6;">
      <p>Hola ${escapeHtml(name)},</p>
      <p><strong>Aceptamos tu oferta</strong> por ${escapeHtml(articleTitle)}.</p>
      <p>Precio aceptado: <strong>${escapeHtml(amount)}</strong>.</p>
      <p>La oferta aplica a <strong>1 unidad</strong>.</p>
      <p>Para comprar, ingresa al sistema y agrega la prenda al carrito. Vas a ver la oferta aceptada disponible en tu cuenta.</p>
      <p>
        <a href="${escapeHtml(articleUrl)}" style="display:inline-block;padding:12px 18px;background:#20b8c7;color:#ffffff;text-decoration:none;font-weight:700;">
          Ver prenda
        </a>
      </p>
      <p>Equipo ESADAR</p>
    </div>
  `;

  await mailer.sendMail({
    from: `"${env.mail.fromName}" <${env.mail.fromEmail}>`,
    to: toEmail,
    replyTo: env.mail.replyTo || env.mail.fromEmail,
    subject: `Aceptamos tu oferta - ${articleTitle}`,
    text,
    html,
  });
}
