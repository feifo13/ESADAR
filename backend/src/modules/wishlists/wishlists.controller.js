import { getPagination } from '../../utils/pagination.js';
import { parsePositiveIntParam } from '../../utils/request-validation.js';
import { adminWishlistFiltersSchema, adminWishlistListQuerySchema, adminWishlistTopQuerySchema } from './wishlists.schemas.js';
import {
  getAdminWishlistById,
  getAdminWishlistSummary,
  getAdminWishlistTopArticles,
  getAdminWishlistTopUsers,
  listAdminWishlists,
} from './wishlists.service.js';

export async function getAdminWishlists(req, res) {
  const filters = adminWishlistListQuerySchema.parse(req.query);
  const pagination = getPagination(filters, { pageSize: 25 });
  const result = await listAdminWishlists({ filters, pagination });
  return res.json({ ok: true, ...result });
}

export async function getAdminWishlist(req, res) {
  const wishlist = await getAdminWishlistById(parsePositiveIntParam(req.params.id, 'id'));
  return res.json({ ok: true, wishlist });
}

export async function getAdminWishlistsSummary(req, res) {
  const filters = adminWishlistFiltersSchema.parse(req.query);
  const summary = await getAdminWishlistSummary(filters);
  return res.json({ ok: true, summary });
}

export async function getAdminWishlistsTopArticles(req, res) {
  const filters = adminWishlistTopQuerySchema.parse(req.query);
  const items = await getAdminWishlistTopArticles(filters, filters.limit);
  return res.json({ ok: true, items });
}

export async function getAdminWishlistsTopUsers(req, res) {
  const filters = adminWishlistTopQuerySchema.parse(req.query);
  const items = await getAdminWishlistTopUsers(filters, filters.limit);
  return res.json({ ok: true, items });
}
