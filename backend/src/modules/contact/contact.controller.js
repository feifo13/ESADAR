import { getPagination } from '../../utils/pagination.js';
import {
  adminContactMessageListQuerySchema,
  createContactMessageSchema,
  updateContactMessageStatusSchema,
} from './contact.schemas.js';
import {
  createContactMessage,
  listContactMessages,
  updateContactMessageStatus,
} from './contact.service.js';

function getAuditContext(req) {
  return {
    actorUserId: req.auth?.userId || null,
    actorLabel: req.auth?.email || null,
    source: req.auditSource,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] || null,
  };
}

export async function createPublicContactMessage(req, res) {
  const input = createContactMessageSchema.parse(req.body);
  const message = await createContactMessage(input, getAuditContext(req));
  return res.status(201).json({ ok: true, message });
}

export async function getAdminContactMessages(req, res) {
  const filters = adminContactMessageListQuerySchema.parse(req.query);
  const pagination = getPagination(filters, { pageSize: 25 });
  const result = await listContactMessages({
    filters,
    pagination,
  });
  return res.json({ ok: true, ...result });
}

export async function updateAdminContactMessageStatus(req, res) {
  const input = updateContactMessageStatusSchema.parse(req.body);
  const message = await updateContactMessageStatus(
    Number(req.params.id),
    input.status,
    getAuditContext(req),
  );

  return res.json({ ok: true, message });
}
