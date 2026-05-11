import { parsePositiveIntParam, parseSlugOrIdParam } from '../../utils/request-validation.js';
import { updateSeoPageSchema } from './seo.schemas.js';
import {
  buildGoogleProductsFeedXml,
  buildRobotsTxt,
  buildSitemapXml,
  getPublicArticleSeo,
  getPublicSiteSeo,
  listSeoPages,
  updateSeoPage,
} from './seo.service.js';

function getAuditContext(req) {
  return {
    actorUserId: req.auth?.userId || null,
    actorLabel: req.auth?.email || null,
    source: req.auditSource,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] || null,
  };
}

export async function getRobotsTxt(_req, res) {
  res.type('text/plain; charset=utf-8');
  return res.send(await buildRobotsTxt());
}

export async function getSitemapXml(_req, res) {
  res.type('application/xml; charset=utf-8');
  return res.send(await buildSitemapXml());
}

export async function getGoogleProductsFeed(_req, res) {
  res.type('application/xml; charset=utf-8');
  return res.send(await buildGoogleProductsFeedXml());
}

export async function getPublicSiteSeoConfig(_req, res) {
  return res.json({ ok: true, ...(await getPublicSiteSeo()) });
}

export async function getPublicArticleSeoConfig(req, res) {
  return res.json({ ok: true, seo: await getPublicArticleSeo(parseSlugOrIdParam(req.params.slugOrId, 'articulo')) });
}

export async function getAdminSeoPages(_req, res) {
  return res.json({ ok: true, items: await listSeoPages() });
}

export async function putAdminSeoPage(req, res) {
  const input = updateSeoPageSchema.parse(req.body);
  const page = await updateSeoPage(parsePositiveIntParam(req.params.id, 'id'), input, getAuditContext(req));
  return res.json({ ok: true, page });
}
