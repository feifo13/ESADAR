import { getPagination } from '../../utils/pagination.js';
import {
  adminArticleEventsQuerySchema,
  adminLeadListQuerySchema,
  articleEventSchema,
  publicLeadPreferencesSchema,
  publicNewsletterLeadSchema,
  publicStockAlertSchema,
  updateLeadStatusSchema,
  wishlistMutationSchema,
  wishlistQuerySchema,
} from './leads.schemas.js';
import {
  addWishlistItem,
  createNewsletterLead,
  createStockAlert,
  getLeadById,
  getWishlist,
  listArticleEvents,
  listLeads,
  removeWishlistItem,
  saveLeadPreferences,
  trackArticleEvent,
  updateLeadStatus,
} from './leads.service.js';

function getAuditContext(req) {
  return {
    actorUserId: req.auth?.userId || null,
    actorLabel: req.auth?.email || null,
    source: req.auditSource,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] || null,
  };
}

export async function createPublicNewsletterLead(req, res) {
  const input = publicNewsletterLeadSchema.parse(req.body);
  const lead = await createNewsletterLead(input, getAuditContext(req));
  return res.status(201).json({ ok: true, lead });
}

export async function savePublicLeadPreferences(req, res) {
  const input = publicLeadPreferencesSchema.parse(req.body);
  const lead = await saveLeadPreferences(input, getAuditContext(req));
  return res.status(201).json({ ok: true, lead });
}

export async function createPublicStockAlert(req, res) {
  const input = publicStockAlertSchema.parse(req.body);
  const result = await createStockAlert(input, getAuditContext(req));
  return res.status(201).json({ ok: true, ...result });
}

export async function createPublicWishlistItem(req, res) {
  const input = wishlistMutationSchema.parse(req.body);
  const wishlist = await addWishlistItem(input, req.auth || null, getAuditContext(req));
  return res.status(201).json({ ok: true, wishlist });
}

export async function deletePublicWishlistItem(req, res) {
  const query = wishlistQuerySchema.parse(req.query);
  const wishlist = await removeWishlistItem(
    Number(req.params.articleId),
    query,
    req.auth || null,
    getAuditContext(req),
  );
  return res.json({ ok: true, wishlist });
}

export async function getPublicWishlist(req, res) {
  const query = wishlistQuerySchema.parse(req.query);
  const wishlist = await getWishlist(query, req.auth || null);
  return res.json({ ok: true, wishlist });
}

export async function createPublicArticleEvent(req, res) {
  const input = articleEventSchema.parse(req.body);
  const event = await trackArticleEvent(input, req.auth || null, getAuditContext(req));
  return res.status(201).json({ ok: true, event });
}

export async function getAdminLeads(req, res) {
  const filters = adminLeadListQuerySchema.parse(req.query);
  const pagination = getPagination(filters, { pageSize: 25 });
  const result = await listLeads({ filters, pagination });
  return res.json({ ok: true, ...result });
}

export async function getAdminLead(req, res) {
  const lead = await getLeadById(Number(req.params.id));
  return res.json({ ok: true, lead });
}

export async function patchAdminLeadStatus(req, res) {
  const input = updateLeadStatusSchema.parse(req.body);
  const lead = await updateLeadStatus(Number(req.params.id), input, getAuditContext(req));
  return res.json({ ok: true, lead });
}

export async function getAdminArticleEvents(req, res) {
  const filters = adminArticleEventsQuerySchema.parse(req.query);
  const pagination = getPagination(filters, { pageSize: 25 });
  const result = await listArticleEvents({ filters, pagination });
  return res.json({ ok: true, ...result });
}
