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
    '',
    'Al ingresar al sistema vas a ver la oferta aceptada y se aplicará a 1 unidad de esa prenda en tu carrito.',
    articleUrl,
    '',
    'Equipo ESADAR',
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;color:#102b34;line-height:1.6;">
      <p>Hola ${escapeHtml(name)},</p>
      <p><strong>Aceptamos tu oferta</strong> por ${escapeHtml(articleTitle)}.</p>
      <p>Precio aceptado: <strong>${escapeHtml(amount)}</strong>.</p>
      <p>Al ingresar al sistema vas a ver la oferta aceptada y se aplicará a <strong>1 unidad</strong> de esa prenda en tu carrito.</p>
      <p><a href="${escapeHtml(articleUrl)}">Ver prenda</a></p>
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
