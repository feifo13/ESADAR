import { getPagination } from '../../utils/pagination.js';
import { parsePositiveIntParam } from '../../utils/request-validation.js';
import {
  articleLotListQuerySchema,
  articleLotOptionsQuerySchema,
  articleLotProfitProjectionExportQuerySchema,
  articleLotStatusSchema,
  articleLotWriteSchema,
} from './article-lots.schemas.js';
import {
  createArticleLot,
  exportArticleLotProfitProjection,
  getArticleLotDetail,
  getArticleLotReport,
  listArticleLotOptions,
  listArticleLotsForAdmin,
  updateArticleLot,
  updateArticleLotStatus,
} from './article-lots.service.js';

function getAuditContext(req) {
  return {
    actorUserId: req.auth?.userId || null,
    actorLabel: req.auth?.email || null,
    source: req.auditSource,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] || null,
  };
}

export async function getAdminArticleLots(req, res) {
  const filters = articleLotListQuerySchema.parse(req.query);
  const pagination = getPagination(filters, { pageSize: 25 });
  const result = await listArticleLotsForAdmin({ filters, pagination });
  return res.json({ ok: true, ...result });
}

export async function getAdminArticleLotOptions(req, res) {
  const query = articleLotOptionsQuerySchema.parse(req.query);
  const items = await listArticleLotOptions(query);
  return res.json({ ok: true, items });
}

export async function getAdminArticleLot(req, res) {
  const lot = await getArticleLotDetail(parsePositiveIntParam(req.params.id, 'id'));
  return res.json({ ok: true, lot });
}

export async function createAdminArticleLot(req, res) {
  const input = articleLotWriteSchema.parse(req.body);
  const lot = await createArticleLot(input, getAuditContext(req));
  return res.status(201).json({ ok: true, lot });
}

export async function updateAdminArticleLot(req, res) {
  const input = articleLotWriteSchema.parse(req.body);
  const lot = await updateArticleLot(
    parsePositiveIntParam(req.params.id, 'id'),
    input,
    getAuditContext(req),
  );
  return res.json({ ok: true, lot });
}

export async function updateAdminArticleLotStatus(req, res) {
  const input = articleLotStatusSchema.parse(req.body);
  const lot = await updateArticleLotStatus(
    parsePositiveIntParam(req.params.id, 'id'),
    input.status,
    getAuditContext(req),
  );
  return res.json({ ok: true, lot });
}

export async function getAdminArticleLotReport(req, res) {
  const result = await getArticleLotReport(parsePositiveIntParam(req.params.id, 'id'));
  return res.json({ ok: true, ...result });
}

export async function exportAdminArticleLotProfitProjection(req, res) {
  const query = articleLotProfitProjectionExportQuerySchema.parse(req.query);
  const result = await exportArticleLotProfitProjection({
    id: parsePositiveIntParam(req.params.id, 'id'),
    format: query.format,
    auditContext: getAuditContext(req),
  });

  res.setHeader('Content-Type', result.contentType);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${result.fileName}"; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
  );
  res.setHeader('X-Export-Count', String(result.itemCount));
  return res.send(result.payload);
}
