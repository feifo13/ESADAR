import { listAudit } from './audit.service.js';
import { getPagination } from '../../utils/pagination.js';

export async function getAuditLog(req, res) {
  const pagination = getPagination(req.query, { pageSize: 25 });
  const result = await listAudit(pagination);
  return res.json({ ok: true, ...result });
}
