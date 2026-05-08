import { sendBrandedEmail } from '../mail/mail.client.js';
import { renderAcceptedOfferEmail } from '../mail/templates/accepted-offer.template.js';

export async function sendAcceptedOfferEmail(offer) {
  const toEmail = offer?.contact?.email;
  if (!toEmail) return { skipped: true };

  const email = renderAcceptedOfferEmail({ offer });

  return sendBrandedEmail({
    to: toEmail,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
}
