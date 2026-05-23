import { getAuditContext } from '../../utils/audit-context.js';
import {
  getAdminSiteHero,
  getAdminSiteTicker,
  deleteAdminSiteHeroImage,
  getPublicSiteHero,
  getPublicSiteTicker,
  updateAdminSiteHero,
  updateAdminSiteHeroImage,
  updateAdminSiteTicker,
} from './site.service.js';
import {
  siteHeroImageUpdateSchema,
  siteHeroUpdateSchema,
  siteTickerUpdateSchema,
} from './site.schemas.js';

export async function getSiteHero(_req, res) {
  return res.json({ ok: true, hero: await getPublicSiteHero() });
}

export async function getSiteTicker(_req, res) {
  return res.json({ ok: true, ticker: await getPublicSiteTicker() });
}

export async function getAdminHero(_req, res) {
  return res.json({ ok: true, hero: await getAdminSiteHero() });
}

export async function getAdminTicker(_req, res) {
  return res.json({ ok: true, ticker: await getAdminSiteTicker() });
}

export async function putAdminHero(req, res) {
  const input = siteHeroUpdateSchema.parse(req.body);
  const hero = await updateAdminSiteHero(input, getAuditContext(req));
  return res.json({ ok: true, hero });
}

export async function postAdminHeroImage(req, res) {
  const input = siteHeroImageUpdateSchema.parse(req.body);
  const hero = await updateAdminSiteHeroImage(req.files || req.file, input, getAuditContext(req));
  return res.status(201).json({ ok: true, hero });
}

export async function putAdminTicker(req, res) {
  const input = siteTickerUpdateSchema.parse(req.body);
  const ticker = await updateAdminSiteTicker(input, getAuditContext(req));
  return res.json({ ok: true, ticker });
}

export async function deleteAdminHeroImage(req, res) {
  const imageId = Number(req.params.imageId);
  const hero = await deleteAdminSiteHeroImage(imageId, getAuditContext(req));
  return res.json({ ok: true, hero });
}
