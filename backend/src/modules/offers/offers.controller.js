import { getPagination } from '../../utils/pagination.js';
import { parsePositiveIntParam } from '../../utils/request-validation.js';
import {
  adminOfferListQuerySchema,
  batchOfferActionSchema,
  createOfferSchema,
  updateOfferStatusSchema,
} from './offers.schemas.js';
import {
  batchUpdateOffers,
  changeOfferStatus,
  createOffer,
  getOfferEligibilityForUser,
  listAcceptedOffersForUser,
  listOffers,
  listOffersForUser,
} from './offers.service.js';

function getAuditContext(req) {
  return {
    actorUserId: req.auth?.userId || null,
    actorLabel: req.auth?.email || null,
    source: req.auditSource,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] || null,
    publicSiteUrl: req.publicSiteUrl,
  };
}

export async function createPublicOffer(req, res) {
  const input = createOfferSchema.parse(req.body);
  const offer = await createOffer(input, req.auth || null, getAuditContext(req));
  return res.status(201).json({ ok: true, offer });
}

export async function getAcceptedOffers(req, res) {
  const items = await listAcceptedOffersForUser(req.auth?.userId);
  return res.json({ ok: true, items });
}

export async function getMyOffers(req, res) {
  const items = await listOffersForUser(req.auth?.userId);
  return res.json({ ok: true, items });
}

export async function getArticleOfferEligibility(req, res) {
  const eligibility = await getOfferEligibilityForUser(
    req.auth?.userId,
    parsePositiveIntParam(req.params.articleId, 'articleId'),
  );
  return res.json({ ok: true, eligibility });
}

export async function getAdminOffers(req, res) {
  const filters = adminOfferListQuerySchema.parse(req.query);
  const pagination = getPagination(filters, { pageSize: 25 });
  const result = await listOffers({ filters, pagination });
  return res.json({ ok: true, ...result });
}


export async function batchAdminOffers(req, res) {
  const input = batchOfferActionSchema.parse(req.body);
  const result = await batchUpdateOffers(input, getAuditContext(req));
  return res.json({ ok: result.failed === 0, ...result });
}

export async function updateAdminOfferStatus(req, res) {
  const input = updateOfferStatusSchema.parse(req.body);
  const offer = await changeOfferStatus(parsePositiveIntParam(req.params.id, 'id'), input, getAuditContext(req));
  return res.json({ ok: true, offer });
}
