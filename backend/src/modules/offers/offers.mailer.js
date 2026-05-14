import { sendBrandedEmail } from '../mail/mail.client.js';
import { renderAcceptedOfferEmail } from '../mail/templates/accepted-offer.template.js';

export async function sendAcceptedOfferEmail(offer, options = {}) {
  const toEmail = offer?.contact?.email;
  if (!toEmail) return { skipped: true };

  const email = renderAcceptedOfferEmail({ offer, publicSiteUrl: options.publicSiteUrl });

  return sendBrandedEmail({
    to: toEmail,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
}
