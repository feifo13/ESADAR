import { sendBrandedEmail, assertMailConfigured } from '../mail/mail.client.js';
import { renderPasswordResetEmail } from '../mail/templates/password-reset.template.js';
import { renderWelcomeUserEmail } from '../mail/templates/welcome-user.template.js';

const PASSWORD_RESET_MAILER_MESSAGE =
  'El sistema de correo no esta configurado para recuperar contraseñas.';

export function assertPasswordResetMailerReady() {
  assertMailConfigured(PASSWORD_RESET_MAILER_MESSAGE);
}

export async function sendPasswordResetEmail({ toEmail, toName, resetUrl, publicSiteUrl }) {
  const email = renderPasswordResetEmail({ toName, resetUrl, publicSiteUrl });

  await sendBrandedEmail({
    to: toEmail,
    subject: email.subject,
    text: email.text,
    html: email.html,
    requiredMessage: PASSWORD_RESET_MAILER_MESSAGE,
  });
}

export async function sendWelcomeUserEmail({ user, accountUrl, publicSiteUrl }) {
  const toEmail = user?.email;
  if (!toEmail) return { skipped: true };

  const email = renderWelcomeUserEmail({ user, accountUrl, publicSiteUrl });

  return sendBrandedEmail({
    to: toEmail,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
}
