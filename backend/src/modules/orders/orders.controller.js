import {
  approveOrder,
  cancelOrder,
  createOrder,
  createOrderPayment,
  getOrderDetail,
  listOrders,
  shipOrder,
} from './orders.service.js';
import { expireReservedOrders } from './orders.expiration.service.js';
import {
  createOrderPaymentSchema,
  createOrderSchema,
  cancelOrderSchema,
  adminOrderListQuerySchema,
  expireReservationsSchema,
} from './orders.schemas.js';
import { getPagination } from '../../utils/pagination.js';
import { parsePositiveIntParam } from '../../utils/request-validation.js';
import { generateOrderReceiptPdf } from '../account/pdf/order-receipt-pdf.js';
import { getPaymentInstructionsForOrder } from '../collecting/collecting.service.js';

function getAuditContext(req) {
  return {
    actorUserId: req.auth?.userId || null,
    actorLabel: req.auth?.email || null,
    source: req.auditSource,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] || null,
    publicSiteUrl: req.publicSiteUrl,
  };
}

export async function createPublicOrder(req, res) {
  const input = createOrderSchema.parse(req.body);
  const order = await createOrder(input, req.auth || null, getAuditContext(req));
  const paymentInstructions =
    order.paymentMethod === 'BANK_TRANSFER'
      ? await getPaymentInstructionsForOrder(order)
      : null;

  return res.status(201).json({
    ok: true,
    order: paymentInstructions ? { ...order, paymentInstructions } : order,
  });
}

export async function getAdminOrders(req, res) {
  const filters = adminOrderListQuerySchema.parse(req.query);
  const pagination = getPagination(filters, { pageSize: 25 });
  const result = await listOrders({ filters, pagination });
  return res.json({ ok: true, ...result });
}

export async function getAdminOrder(req, res) {
  const order = await getOrderDetail(parsePositiveIntParam(req.params.id, 'id'));
  return res.json({ ok: true, order });
}



export async function getAdminOrderReceiptPdf(req, res) {
  const order = await getOrderDetail(parsePositiveIntParam(req.params.id, 'id'));
  const pdfBuffer = await generateOrderReceiptPdf(order);
  const safeOrderNumber = String(order.orderNumber || req.params.id).replace(/[^a-zA-Z0-9_-]/g, '-');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', pdfBuffer.length);
  res.setHeader('Content-Disposition', `attachment; filename="boleta-${safeOrderNumber}.pdf"`);
  return res.send(pdfBuffer);
}

export async function approveAdminOrder(req, res) {
  const order = await approveOrder(parsePositiveIntParam(req.params.id, 'id'), getAuditContext(req));
  return res.json({ ok: true, order });
}

export async function cancelAdminOrder(req, res) {
  const input = cancelOrderSchema.parse(req.body);
  const order = await cancelOrder(parsePositiveIntParam(req.params.id, 'id'), input.reason, getAuditContext(req));
  return res.json({ ok: true, order });
}

export async function expireAdminOrderReservations(req, res) {
  const input = expireReservationsSchema.parse(req.body || {});
  const result = await expireReservedOrders({
    now: input.now ? new Date(input.now) : new Date(),
    limit: input.limit || 100,
    auditContext: getAuditContext(req),
  });
  return res.json({ ok: true, ...result });
}

export async function shipAdminOrder(req, res) {
  const order = await shipOrder(parsePositiveIntParam(req.params.id, 'id'), getAuditContext(req));
  return res.json({ ok: true, order });
}

export async function createAdminOrderPayment(req, res) {
  const input = createOrderPaymentSchema.parse(req.body);
  const order = await createOrderPayment(parsePositiveIntParam(req.params.id, 'id'), input, getAuditContext(req));
  return res.status(201).json({ ok: true, order });
}
