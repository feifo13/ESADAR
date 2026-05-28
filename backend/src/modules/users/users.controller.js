import { getPagination } from '../../utils/pagination.js';
import { parsePositiveIntParam } from '../../utils/request-validation.js';
import { adminUserListQuerySchema, adminUserPasswordSchema, adminUserStatusSchema, adminUserUpdateSchema } from './users.schemas.js';
import { deleteUser, getUserByIdForAdmin, listUsers, setUserActiveStatus, updateUserForAdmin, updateUserPasswordForAdmin } from './users.service.js';

function getAuditContext(req) {
  return {
    actorUserId: req.auth?.userId || null,
    actorLabel: req.auth?.email || null,
    actorRoles: req.auth?.roles || [],
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


export async function getAdminUser(req, res) {
  const user = await getUserByIdForAdmin(parsePositiveIntParam(req.params.id, 'id'));
  return res.json({ ok: true, user });
}

export async function updateAdminUser(req, res) {
  const input = adminUserUpdateSchema.parse(req.body);
  const user = await updateUserForAdmin(parsePositiveIntParam(req.params.id, 'id'), input, getAuditContext(req));
  return res.json({ ok: true, user });
}


export async function updateAdminUserPassword(req, res) {
  const input = adminUserPasswordSchema.parse(req.body);
  const user = await updateUserPasswordForAdmin(
    parsePositiveIntParam(req.params.id, 'id'),
    input,
    getAuditContext(req),
  );
  return res.json({ ok: true, user });
}

export async function updateAdminUserStatus(req, res) {
  const input = adminUserStatusSchema.parse(req.body);
  const user = await setUserActiveStatus(parsePositiveIntParam(req.params.id, 'id'), input.isActive, getAuditContext(req));
  return res.json({ ok: true, user });
}

export async function removeAdminUser(req, res) {
  const result = await deleteUser(parsePositiveIntParam(req.params.id, 'id'), getAuditContext(req));
  return res.json({ ok: true, ...result });
}
