import { publicPageVisitSchema } from './page-visits.schemas.js';
import { recordPublicPageVisit } from './page-visits.service.js';

export async function postPublicPageVisit(req, res) {
  const input = publicPageVisitSchema.parse(req.body);
  await recordPublicPageVisit(input);
  return res.status(201).json({ ok: true, recorded: true });
}
