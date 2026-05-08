import { getPagination } from "../../utils/pagination.js";
import { badRequest } from '../../utils/app-error.js';
import {
  addArticleImages,
  adjustArticleStock,
  changeArticleStatus,
  createArticle,
  deleteArticleImage,
  getAdminArticleById,
  getRelatedPublicArticles,
  getPublicArticleBySlugOrId,
  listAdminArticles,
  listPublicArticles,
  reorderArticleImages,
  updateArticleImage,
  updateArticle,
  updateArticleQuickFlags,
} from "./articles.service.js";
import {
  adminArticleListQuerySchema,
  articleCreateSchema,
  articleExportQuerySchema,
  articleImageReorderSchema,
  articleImageUpdateSchema,
  articleImportOptionsSchema,
  articleImportTemplateQuerySchema,
  articleQuickFlagsSchema,
  articleStatusSchema,
  articleStockAdjustmentSchema,
  articleUpdateSchema,
  adminBulkArticleCreateSchema,
} from "./articles.schemas.js";
import {
  buildArticleExport,
  buildArticleImportTemplate,
  previewArticleImport,
  runManualBulkArticleCreate,
  runArticleImport,
} from './articles.batch.service.js';

function getAuditContext(req) {
  return {
    actorUserId: req.auth?.userId || null,
    actorLabel: req.auth?.email || null,
    source: req.auditSource,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"] || null,
  };
}

export async function getPublicArticles(req, res) {
  const pagination = getPagination(req.query, { pageSize: 20 });
  const result = await listPublicArticles({ filters: req.query, pagination });
  return res.json({ ok: true, ...result });
}

export async function getPublicArticle(req, res) {
  const article = await getPublicArticleBySlugOrId(req.params.slugOrId);
  return res.json({ ok: true, article });
}

export async function getPublicRelatedArticles(req, res) {
  const related = await getRelatedPublicArticles(req.params.slugOrId, Number(req.query.limit || 8));
  return res.json({ ok: true, ...related });
}

export async function getAdminArticles(req, res) {
  const filters = adminArticleListQuerySchema.parse(req.query);
  const pagination = getPagination(filters, { pageSize: 25 });
  const result = await listAdminArticles({ filters, pagination });
  return res.json({ ok: true, ...result });
}

export async function getAdminArticle(req, res) {
  const article = await getAdminArticleById(Number(req.params.id));
  return res.json({ ok: true, article });
}

export async function previewAdminArticleImport(req, res) {
  if (!req.file) {
    throw badRequest('Debes adjuntar un archivo CSV o XLSX');
  }

  const options = articleImportOptionsSchema.parse(req.body);
  const result = await previewArticleImport({
    file: req.file,
    options: {
      updateExisting: Boolean(options.updateExisting),
      createMissingLookups: Boolean(options.createMissingLookups),
    },
  });

  return res.json({ ok: true, ...result });
}

export async function importAdminArticles(req, res) {
  if (!req.file) {
    throw badRequest('Debes adjuntar un archivo CSV o XLSX');
  }

  const options = articleImportOptionsSchema.parse(req.body);
  const result = await runArticleImport({
    file: req.file,
    options: {
      updateExisting: Boolean(options.updateExisting),
      createMissingLookups: Boolean(options.createMissingLookups),
    },
    auditContext: getAuditContext(req),
  });

  return res.status(201).json({ ok: true, ...result });
}

export async function downloadAdminArticleImportTemplate(req, res) {
  const query = articleImportTemplateQuerySchema.parse(req.query);
  const result = await buildArticleImportTemplate(query);

  res.setHeader('Content-Type', result.contentType);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${result.fileName}"; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
  );
  return res.send(result.payload);
}

export async function exportAdminArticles(req, res) {
  const query = articleExportQuerySchema.parse(req.query);
  const { format, ...filters } = query;
  const result = await buildArticleExport({
    filters,
    format,
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

export async function createAdminArticle(req, res) {
  const input = articleCreateSchema.parse(req.body);
  const article = await createArticle(input, getAuditContext(req));
  return res.status(201).json({ ok: true, article });
}

export async function createAdminBulkArticles(req, res) {
  const input = adminBulkArticleCreateSchema.parse(req.body);
  const result = await runManualBulkArticleCreate({
    articles: input.articles,
    options: {
      createMissingLookups: Boolean(input.createMissingLookups),
    },
    auditContext: getAuditContext(req),
  });

  return res.status(201).json({ ok: true, ...result });
}

export async function updateAdminArticle(req, res) {
  const input = articleUpdateSchema.parse(req.body);
  const article = await updateArticle(
    Number(req.params.id),
    input,
    getAuditContext(req),
  );
  return res.json({ ok: true, article });
}

export async function createAdminArticleStockAdjustment(req, res) {
  const input = articleStockAdjustmentSchema.parse(req.body);
  const article = await adjustArticleStock(
    Number(req.params.id),
    input,
    getAuditContext(req),
  );
  return res.json({ ok: true, article });
}

export async function updateAdminArticleStatus(req, res) {
  const input = articleStatusSchema.parse(req.body);
  const article = await changeArticleStatus(
    Number(req.params.id),
    input.status,
    getAuditContext(req),
  );
  return res.json({ ok: true, article });
}

export async function updateAdminArticleQuickFlags(req, res) {
  const input = articleQuickFlagsSchema.parse(req.body);
  const article = await updateArticleQuickFlags(
    Number(req.params.id),
    input,
    getAuditContext(req),
  );
  return res.json({ ok: true, article });
}

export async function uploadAdminArticleImages(req, res) {
  const images = await addArticleImages(
    Number(req.params.id),
    req.files,
    getAuditContext(req),
  );
  return res.status(201).json({ ok: true, images });
}

export async function updateAdminArticleImage(req, res) {
  const input = articleImageUpdateSchema.parse(req.body);
  const images = await updateArticleImage(
    Number(req.params.articleId),
    Number(req.params.imageId),
    input,
    getAuditContext(req),
  );

  return res.json({ ok: true, images });
}

export async function deleteAdminArticleImage(req, res) {
  const images = await deleteArticleImage(
    Number(req.params.articleId),
    Number(req.params.imageId),
    getAuditContext(req),
  );

  return res.json({ ok: true, images });
}

export async function reorderAdminArticleImages(req, res) {
  const input = articleImageReorderSchema.parse(req.body);
  const images = await reorderArticleImages(
    Number(req.params.articleId),
    input.imageIds,
    getAuditContext(req),
  );

  return res.json({ ok: true, images });
}
