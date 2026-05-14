import { generateOrderReceiptPdf } from '../account/pdf/order-receipt-pdf.js';
import { sendBrandedEmail } from '../mail/mail.client.js';
import { renderApprovedOrderEmail } from '../mail/templates/approved-order.template.js';
import { renderReceivedOrderPendingPaymentEmail } from '../mail/templates/received-order-pending-payment.template.js';
import { renderShippedOrderEmail } from '../mail/templates/shipped-order.template.js';
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

async function withPaymentInstructions(order, options = {}) {
  const paymentInstructions =
    order?.paymentInstructions ||
    (await getPaymentInstructionsForOrder(order, undefined, options));

  return {
    ...order,
    paymentInstructions,
  };
}

export async function sendApprovedOrderEmail(order, options = {}) {
  const toEmail = order?.customer?.email;
  if (!toEmail) return { skipped: true };

  const [email, receiptAttachment] = await Promise.all([
    Promise.resolve(renderApprovedOrderEmail({ order, publicSiteUrl: options.publicSiteUrl })),
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

export async function sendReceivedOrderPendingPaymentEmail(order, options = {}) {
  const toEmail = order?.customer?.email;
  if (!toEmail) return { skipped: true };

  const enrichedOrder = await withPaymentInstructions(order, options);
  const email = renderReceivedOrderPendingPaymentEmail({ order: enrichedOrder, publicSiteUrl: options.publicSiteUrl });

  return sendBrandedEmail({
    to: toEmail,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
}


export async function sendShippedOrderEmail(order, options = {}) {
  const toEmail = order?.customer?.email;
  if (!toEmail) return { skipped: true };

  const email = renderShippedOrderEmail({ order, publicSiteUrl: options.publicSiteUrl });

  return sendBrandedEmail({
    to: toEmail,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
}
