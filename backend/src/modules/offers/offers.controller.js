import { getPagination } from '../../utils/pagination.js';
import { createOfferSchema, updateOfferStatusSchema } from './offers.schemas.js';
import { changeOfferStatus, createOffer, listOffers } from './offers.service.js';

function getAuditContext(req) {
  return {
    actorUserId: req.auth?.userId || null,
    actorLabel: req.auth?.email || null,
    source: req.auditSource,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] || null,
  };
}

export async function createPublicOffer(req, res) {
  const input = createOfferSchema.parse(req.body);
  const offer = await createOffer(input, req.auth || null, getAuditContext(req));
  return res.status(201).json({ ok: true, offer });
}

export async function getAdminOffers(req, res) {
  const pagination = getPagination(req.query, { pageSize: 25 });
  const result = await listOffers({ ...pagination, status: req.query.status || null });
  return res.json({ ok: true, ...result });
}

export async function updateAdminOfferStatus(req, res) {
  const input = updateOfferStatusSchema.parse(req.body);
  const offer = await changeOfferStatus(Number(req.params.id), input, getAuditContext(req));
  return res.json({ ok: true, offer });
}
