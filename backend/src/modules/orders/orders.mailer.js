import { sendBrandedEmail } from '../mail/mail.client.js';
import { renderApprovedOrderEmail } from '../mail/templates/approved-order.template.js';

export async function sendApprovedOrderEmail(order) {
  const toEmail = order?.customer?.email;
  if (!toEmail) return { skipped: true };

  const email = renderApprovedOrderEmail({ order });

  return sendBrandedEmail({
    to: toEmail,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
}
