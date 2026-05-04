import { accountProfileUpdateSchema } from './account.schemas.js';
import {
  getAccountProfile,
  listAccountAlerts,
  getAccountOrderDetail,
  listAccountOrders,
  removeAccountAlert,
  saveAccountProfile,
} from './account.service.js';

function getAuditContext(req) {
  return {
    actorUserId: req.auth?.userId || null,
    actorLabel: req.auth?.email || null,
    source: req.auditSource,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] || null,
  };
}

export async function getPublicAccountProfile(req, res) {
  const profile = await getAccountProfile(req.auth.userId);
  return res.json({ ok: true, profile });
}

export async function putPublicAccountProfile(req, res) {
  const input = accountProfileUpdateSchema.parse(req.body);
  const profile = await saveAccountProfile(req.auth.userId, input, getAuditContext(req));
  return res.json({ ok: true, profile });
}

export async function getPublicAccountOrders(req, res) {
  const items = await listAccountOrders(req.auth.userId);
  return res.json({ ok: true, items });
}

export async function getPublicAccountOrder(req, res) {
  const order = await getAccountOrderDetail(req.auth.userId, Number(req.params.id));
  return res.json({ ok: true, order });
}

export async function getPublicAccountAlerts(req, res) {
  const items = await listAccountAlerts(req.auth.userId);
  return res.json({ ok: true, items });
}


export async function deletePublicAccountAlert(req, res) {
  const result = await removeAccountAlert(req.auth.userId, Number(req.params.id), getAuditContext(req));
  return res.json({ ok: true, ...result });
}
