import { getPagination } from '../../utils/pagination.js';
import { clientLogCreateSchema, clientLogListQuerySchema } from './client-logs.schemas.js';
import { createClientLog, listClientLogs } from './client-logs.service.js';

export async function postClientLog(req, res) {
  const input = clientLogCreateSchema.parse(req.body);
  const result = await createClientLog(input, {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] || null,
    requestId: req.requestId || req.id || null,
  });
  return res.status(201).json({ ok: true, ...result });
}

export async function getAdminClientLogs(req, res) {
  const filters = clientLogListQuerySchema.parse(req.query);
  const pagination = getPagination(filters, { pageSize: 25 });
  const result = await listClientLogs({ filters, pagination });
  return res.json({ ok: true, ...result });
}
