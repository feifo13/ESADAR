import {
  approveOrder,
  cancelOrder,
  createOrder,
  getOrderDetail,
  listOrders,
  shipOrder,
} from './orders.service.js';
import { createOrderSchema, cancelOrderSchema } from './orders.schemas.js';
import { getPagination } from '../../utils/pagination.js';

function getAuditContext(req) {
  return {
    actorUserId: req.auth?.userId || null,
    actorLabel: req.auth?.email || null,
    source: req.auditSource,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] || null,
  };
}

export async function createPublicOrder(req, res) {
  const input = createOrderSchema.parse(req.body);
  const order = await createOrder(input, req.auth || null, getAuditContext(req));
  return res.status(201).json({ ok: true, order });
}

export async function getAdminOrders(req, res) {
  const pagination = getPagination(req.query, { pageSize: 25 });
  const result = await listOrders({ ...pagination, status: req.query.status || null });
  return res.json({ ok: true, ...result });
}

export async function getAdminOrder(req, res) {
  const order = await getOrderDetail(Number(req.params.id));
  return res.json({ ok: true, order });
}

export async function approveAdminOrder(req, res) {
  const order = await approveOrder(Number(req.params.id), getAuditContext(req));
  return res.json({ ok: true, order });
}

export async function cancelAdminOrder(req, res) {
  const input = cancelOrderSchema.parse(req.body);
  const order = await cancelOrder(Number(req.params.id), input.reason, getAuditContext(req));
  return res.json({ ok: true, order });
}

export async function shipAdminOrder(req, res) {
  const order = await shipOrder(Number(req.params.id), getAuditContext(req));
  return res.json({ ok: true, order });
}
