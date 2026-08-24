import {
  costIntegrityReportQuerySchema,
  profitProjectionReportQuerySchema,
  realizedProfitsReportQuerySchema,
  salesReportQuerySchema,
  stockReportQuerySchema,
  stockRotationReportQuerySchema,
} from './reports.schemas.js';
import { buildReportDownload } from './reports.service.js';

function getAuditContext(req) {
  return {
    actorUserId: req.auth?.userId || null,
    actorLabel: req.auth?.email || null,
    source: req.auditSource,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] || null,
  };
}

export function sendReportDownloadResponse(res, result) {
  res.setHeader('Content-Type', result.contentType);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${result.fileName}"; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
  );
  res.setHeader('X-Export-Count', String(result.itemCount));
  return res.send(result.payload);
}

export function createReportDownloadHandler(
  reportId,
  schema,
  { buildDownload = buildReportDownload } = {},
) {
  return async function reportDownloadHandler(req, res) {
    const query = schema.parse(req.query);
    const result = await buildDownload({
      reportId,
      query,
      auditContext: getAuditContext(req),
    });
    return sendReportDownloadResponse(res, result);
  };
}

export const getAdminSalesReport = createReportDownloadHandler(
  'sales',
  salesReportQuerySchema,
);
export const getAdminProfitProjectionReport = createReportDownloadHandler(
  'profit-projection',
  profitProjectionReportQuerySchema,
);
export const getAdminRealizedProfitsReport = createReportDownloadHandler(
  'realized-profits',
  realizedProfitsReportQuerySchema,
);
export const getAdminStockReport = createReportDownloadHandler(
  'stock',
  stockReportQuerySchema,
);
export const getAdminStockRotationReport = createReportDownloadHandler(
  'stock-rotation',
  stockRotationReportQuerySchema,
);
export const getAdminCostIntegrityReport = createReportDownloadHandler(
  'cost-integrity',
  costIntegrityReportQuerySchema,
);
