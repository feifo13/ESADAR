import {
  approveOrder,
  batchUpdateOrders,
  cancelOrder,
  createOrderPayment,
  getOrderDetail,
  listOrders,
  shipOrder,
  updateOrderTrackingCode,
} from './orders.service.js';
import {
  createCheckoutOrder,
  getCheckoutOrderPaymentStatus,
  reconcileReturnedMercadoPagoPayment,
  retryCheckoutOrderPayment,
} from './orders.checkout.service.js';
import { expireReservedOrders } from './orders.expiration.service.js';
import {
  createOrderPaymentSchema,
  createOrderSchema,
  cancelOrderSchema,
  batchOrderActionSchema,
  adminOrderListQuerySchema,
  expireReservationsSchema,
  orderTrackingUpdateSchema,
} from './orders.schemas.js';
import {
  retryOrderPaymentSchema,
} from './orders.payment-retry.schemas.js';
import {
  reconcileReturnedMercadoPagoPaymentSchema,
} from './orders.payment-return.schemas.js';
import { getPagination } from '../../utils/pagination.js';
import { parsePositiveIntParam } from '../../utils/request-validation.js';
import { generateOrderReceiptPdf } from '../account/pdf/order-receipt-pdf.js';
import { retryAccountOrderPayment } from '../account/account.service.js';

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

  const order = await createCheckoutOrder(
    input,
    req.auth || null,
    getAuditContext(req),
  );

  return res.status(201).json({
    ok: true,
    order,
  });
}

export async function reconcilePublicMercadoPagoReturn(
  req,
  res,
) {
  const orderId =
    parsePositiveIntParam(
      req.params.id,
      "id",
    );

  const input =
    reconcileReturnedMercadoPagoPaymentSchema.parse(
      req.body,
    );

  const result =
    await reconcileReturnedMercadoPagoPayment(
      orderId,
      input.paymentId,
      input.retryToken,
      getAuditContext(req),
    );

  return res.json({
    ok: true,
    ...result,
  });
}

export async function retryPublicOrderPayment(req, res) {
  const orderId =
    parsePositiveIntParam(
      req.params.id,
      'id',
    );

  const accountRecovery =
    req.body?.accountRecovery
      === true;

  const result =
    accountRecovery
    && req.auth?.userId
      ? await retryAccountOrderPayment(
          req.auth.userId,
          orderId,
          getAuditContext(req),
        )
      : await retryCheckoutOrderPayment(
          orderId,
          retryOrderPaymentSchema
            .parse(req.body)
            .retryToken,
          getAuditContext(req),
        );

  return res.json({
    ok: true,
    ...result,
  });
}

export async function getPublicOrderPaymentStatus(req, res) {
  const orderId =
    parsePositiveIntParam(
      req.params.id,
      'id',
    );

  const input =
    retryOrderPaymentSchema.parse(
      req.body,
    );

  const result =
    await getCheckoutOrderPaymentStatus(
      orderId,
      input.retryToken,
    );

  return res.json({
    ok: true,
    ...result,
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


export async function batchAdminOrders(req, res) {
  const input = batchOrderActionSchema.parse(req.body);
  const result = await batchUpdateOrders(input, getAuditContext(req));
  return res.json({ ok: result.failed === 0, ...result });
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

export async function updateAdminOrderTracking(req, res) {
  const input = orderTrackingUpdateSchema.parse(req.body);
  const order = await updateOrderTrackingCode(
    parsePositiveIntParam(req.params.id, 'id'),
    input,
    getAuditContext(req),
  );
  return res.json({ ok: true, order });
}

export async function createAdminOrderPayment(req, res) {
  const input = createOrderPaymentSchema.parse(req.body);
  const order = await createOrderPayment(parsePositiveIntParam(req.params.id, 'id'), input, getAuditContext(req));
  return res.status(201).json({ ok: true, order });
}
