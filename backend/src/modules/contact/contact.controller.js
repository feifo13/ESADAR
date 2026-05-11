import { getPagination } from '../../utils/pagination.js';
import { parsePositiveIntParam } from '../../utils/request-validation.js';
import {
  adminContactMessageListQuerySchema,
  createContactMessageSchema,
  replyContactMessageSchema,
  updateContactMessageStatusSchema,
} from './contact.schemas.js';
import {
  createContactMessage,
  getContactMessageById,
  listContactMessages,
  replyContactMessage,
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


export async function getAdminContactMessage(req, res) {
  const message = await getContactMessageById(parsePositiveIntParam(req.params.id, 'id'));
  return res.json({ ok: true, message });
}

export async function updateAdminContactMessageStatus(req, res) {
  const input = updateContactMessageStatusSchema.parse(req.body);
  const message = await updateContactMessageStatus(
    parsePositiveIntParam(req.params.id, 'id'),
    input.status,
    getAuditContext(req),
  );

  return res.json({ ok: true, message });
}

export async function replyAdminContactMessage(req, res) {
  const input = replyContactMessageSchema.parse(req.body);
  const message = await replyContactMessage(
    parsePositiveIntParam(req.params.id, 'id'),
    input.replyMessage,
    getAuditContext(req),
  );

  return res.json({ ok: true, message });
}
