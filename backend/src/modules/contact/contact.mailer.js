import { AppError } from '../../utils/app-error.js';
import { sendBrandedEmail } from '../mail/mail.client.js';
import { renderContactReplyEmail } from '../mail/templates/contact-reply.template.js';

const CONTACT_MAILER_MESSAGE =
  'El sistema de correo no esta configurado para responder mensajes.';

export async function sendContactReplyEmail({
  toEmail,
  toName,
  message,
  replyMessage,
  publicSiteUrl,
}) {
  if (!toEmail) {
    throw new AppError('Este mensaje no tiene email para responder.', 400);
  }

  const email = renderContactReplyEmail({ toName, message, replyMessage, publicSiteUrl });

  return sendBrandedEmail({
    to: toEmail,
    subject: email.subject,
    text: email.text,
    html: email.html,
    requiredMessage: CONTACT_MAILER_MESSAGE,
    smtpErrorMessage:
      'No se pudo enviar el correo SMTP. Revisá la configuración de Gmail/App Password.',
  });
}
