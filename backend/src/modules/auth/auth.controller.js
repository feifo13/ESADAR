import { loginSchema, registerSchema } from './auth.schemas.js';
import { getCurrentUser, loginUser, registerUser } from './auth.service.js';

function getAuditContext(req) {
  return {
    actorUserId: req.auth?.userId || null,
    source: req.auditSource,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] || null,
  };
}

export async function register(req, res) {
  const input = registerSchema.parse(req.body);
  const result = await registerUser(input, getAuditContext(req));
  return res.status(201).json({ ok: true, ...result });
}

export async function login(req, res) {
  const input = loginSchema.parse(req.body);
  const result = await loginUser(input, getAuditContext(req));
  return res.json({ ok: true, ...result });
}

export async function me(req, res) {
  const user = await getCurrentUser(req.auth.userId);
  return res.json({ ok: true, user });
}
