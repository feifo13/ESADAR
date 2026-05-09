import { getPagination } from '../../utils/pagination.js';
import {
  adminShippingListQuerySchema,
  shippingMethodStatusSchema,
  shippingMethodWriteSchema,
} from './shipping.schemas.js';
import {
  createShippingMethod,
  deleteShippingMethod,
  getShippingMethodDetail,
  listShippingMethodsForAdmin,
  setShippingMethodActiveStatus,
  updateShippingMethod,
} from './shipping.service.js';

function getAuditContext(req) {
  return {
    actorUserId: req.auth?.userId || null,
    actorLabel: req.auth?.email || null,
    source: req.auditSource,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] || null,
  };
}

export async function getAdminShippingMethods(req, res) {
  const filters = adminShippingListQuerySchema.parse(req.query);
  const pagination = getPagination(filters, { pageSize: 25 });
  const result = await listShippingMethodsForAdmin({ filters, pagination });
  return res.json({ ok: true, ...result });
}

export async function getAdminShippingMethod(req, res) {
  const method = await getShippingMethodDetail(Number(req.params.id));
  return res.json({ ok: true, method });
}

export async function createAdminShippingMethod(req, res) {
  const input = shippingMethodWriteSchema.parse(req.body);
  const method = await createShippingMethod(input, getAuditContext(req));
  return res.status(201).json({ ok: true, method });
}

export async function updateAdminShippingMethod(req, res) {
  const input = shippingMethodWriteSchema.parse(req.body);
  const method = await updateShippingMethod(Number(req.params.id), input, getAuditContext(req));
  return res.json({ ok: true, method });
}

export async function updateAdminShippingMethodStatus(req, res) {
  const input = shippingMethodStatusSchema.parse(req.body);
  const method = await setShippingMethodActiveStatus(Number(req.params.id), input.isActive, getAuditContext(req));
  return res.json({ ok: true, method });
}

export async function removeAdminShippingMethod(req, res) {
  const result = await deleteShippingMethod(Number(req.params.id), getAuditContext(req));
  return res.json({ ok: true, ...result });
}
