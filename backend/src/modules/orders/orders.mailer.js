import { generateOrderReceiptPdf } from '../account/pdf/order-receipt-pdf.js';
import { sendBrandedEmail } from '../mail/mail.client.js';
import { renderApprovedOrderEmail } from '../mail/templates/approved-order.template.js';
import { renderReceivedOrderPendingPaymentEmail } from '../mail/templates/received-order-pending-payment.template.js';
import { getPaymentInstructionsForOrder } from '../collecting/collecting.service.js';

function getSafeOrderNumber(order) {
  return String(order?.orderNumber || order?.id || 'orden').replace(/[^a-zA-Z0-9_-]/g, '-');
}

async function buildOrderReceiptAttachment(order) {
  const pdfBuffer = await generateOrderReceiptPdf(order);
  return {
    filename: `comprobante-compra-${getSafeOrderNumber(order)}.pdf`,
    content: pdfBuffer,
    contentType: 'application/pdf',
  };
}

async function withPaymentInstructions(order) {
  const paymentInstructions =
    order?.paymentInstructions ||
    (await getPaymentInstructionsForOrder(order));

  return {
    ...order,
    paymentInstructions,
  };
}

export async function sendApprovedOrderEmail(order) {
  const toEmail = order?.customer?.email;
  if (!toEmail) return { skipped: true };

  const [email, receiptAttachment] = await Promise.all([
    Promise.resolve(renderApprovedOrderEmail({ order })),
    buildOrderReceiptAttachment(order),
  ]);

  return sendBrandedEmail({
    to: toEmail,
    subject: email.subject,
    text: email.text,
    html: email.html,
    attachments: [receiptAttachment],
  });
}

export async function sendReceivedOrderPendingPaymentEmail(order) {
  const toEmail = order?.customer?.email;
  if (!toEmail) return { skipped: true };

  const enrichedOrder = await withPaymentInstructions(order);
  const email = renderReceivedOrderPendingPaymentEmail({ order: enrichedOrder });

  return sendBrandedEmail({
    to: toEmail,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
}
