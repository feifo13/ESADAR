import { getPagination } from "../../utils/pagination.js";
import {
  addArticleImages,
  changeArticleStatus,
  createArticle,
  getAdminArticleById,
  getPublicArticleBySlugOrId,
  listAdminArticles,
  listPublicArticles,
  updateArticle,
} from "./articles.service.js";
import {
  articleCreateSchema,
  articleStatusSchema,
  articleUpdateSchema,
} from "./articles.schemas.js";

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

export async function getAdminArticles(req, res) {
  const pagination = getPagination(req.query, { pageSize: 25 });
  const result = await listAdminArticles({ filters: req.query, pagination });
  return res.json({ ok: true, ...result });
}

export async function getAdminArticle(req, res) {
  const article = await getAdminArticleById(Number(req.params.id));
  return res.json({ ok: true, article });
}

export async function createAdminArticle(req, res) {
  const input = articleCreateSchema.parse(req.body);
  const article = await createArticle(input, getAuditContext(req));
  return res.status(201).json({ ok: true, article });
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

export async function updateAdminArticleStatus(req, res) {
  const input = articleStatusSchema.parse(req.body);
  const article = await changeArticleStatus(
    Number(req.params.id),
    input.status,
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
