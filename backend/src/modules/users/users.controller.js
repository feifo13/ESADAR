import { getPagination } from '../../utils/pagination.js';
import { adminUserListQuerySchema, adminUserStatusSchema } from './users.schemas.js';
import { deleteUser, listUsers, setUserActiveStatus } from './users.service.js';

function getAuditContext(req) {
  return {
    actorUserId: req.auth?.userId || null,
    actorLabel: req.auth?.email || null,
    source: req.auditSource,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] || null,
  };
}

export async function getAdminUsers(req, res) {
  const filters = adminUserListQuerySchema.parse(req.query);
  const pagination = getPagination(filters, { pageSize: 25 });
  const result = await listUsers({ filters, pagination });
  return res.json({ ok: true, ...result });
}

export async function updateAdminUserStatus(req, res) {
  const input = adminUserStatusSchema.parse(req.body);
  const user = await setUserActiveStatus(Number(req.params.id), input.isActive, getAuditContext(req));
  return res.json({ ok: true, user });
}

export async function removeAdminUser(req, res) {
  const result = await deleteUser(Number(req.params.id), getAuditContext(req));
  return res.json({ ok: true, ...result });
}
