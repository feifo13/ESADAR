import { getAuditContext } from '../../utils/audit-context.js';
import {
  getAdminSiteHero,
  getPublicSiteHero,
  updateAdminSiteHero,
  updateAdminSiteHeroImage,
} from './site.service.js';
import { siteHeroImageUpdateSchema, siteHeroUpdateSchema } from './site.schemas.js';

export async function getSiteHero(_req, res) {
  return res.json({ ok: true, hero: await getPublicSiteHero() });
}

export async function getAdminHero(_req, res) {
  return res.json({ ok: true, hero: await getAdminSiteHero() });
}

export async function putAdminHero(req, res) {
  const input = siteHeroUpdateSchema.parse(req.body);
  const hero = await updateAdminSiteHero(input, getAuditContext(req));
  return res.json({ ok: true, hero });
}

export async function postAdminHeroImage(req, res) {
  const input = siteHeroImageUpdateSchema.parse(req.body);
  const hero = await updateAdminSiteHeroImage(req.file, input, getAuditContext(req));
  return res.status(201).json({ ok: true, hero });
}
