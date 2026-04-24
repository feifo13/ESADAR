import { listAudit } from './audit.service.js';
import { getPagination } from '../../utils/pagination.js';
import { auditListQuerySchema } from './audit.schemas.js';

export async function getAuditLog(req, res) {
  const filters = auditListQuerySchema.parse(req.query);
  const pagination = getPagination(filters, { pageSize: 25 });
  const result = await listAudit({ ...filters, ...pagination });
  return res.json({ ok: true, ...result });
}
