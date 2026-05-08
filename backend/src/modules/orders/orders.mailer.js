import { sendBrandedEmail } from '../mail/mail.client.js';
import { renderApprovedOrderEmail } from '../mail/templates/approved-order.template.js';
import { renderReceivedOrderPendingPaymentEmail } from '../mail/templates/received-order-pending-payment.template.js';

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

export async function sendReceivedOrderPendingPaymentEmail(order) {
  const toEmail = order?.customer?.email;
  if (!toEmail) return { skipped: true };

  const email = renderReceivedOrderPendingPaymentEmail({ order });

  return sendBrandedEmail({
    to: toEmail,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
}
