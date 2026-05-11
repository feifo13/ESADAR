import { parsePositiveIntParam } from '../../utils/request-validation.js';
import {
  addCartItemSchema,
  updateCartItemSchema,
} from './cart.schemas.js';
import {
  addCartItem,
  clearCart,
  getCartForUser,
  removeCartItem,
  updateCartItem,
} from './cart.service.js';

function getAuditContext(req) {
  return {
    actorUserId: req.auth?.userId || null,
    actorLabel: req.auth?.email || null,
    source: req.auditSource,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] || null,
  };
}

export async function getCurrentCart(req, res) {
  const cart = await getCartForUser(req.auth.userId);
  return res.json({ ok: true, cart });
}

export async function createCartItem(req, res) {
  const input = addCartItemSchema.parse(req.body);
  const cart = await addCartItem(req.auth.userId, input, getAuditContext(req));
  return res.status(201).json({ ok: true, cart });
}

export async function patchCartItem(req, res) {
  const input = updateCartItemSchema.parse(req.body);
  const cart = await updateCartItem(
    req.auth.userId,
    parsePositiveIntParam(req.params.id, 'id'),
    input,
    getAuditContext(req),
  );

  return res.json({ ok: true, cart });
}

export async function deleteCartItem(req, res) {
  const cart = await removeCartItem(req.auth.userId, parsePositiveIntParam(req.params.id, 'id'), getAuditContext(req));
  return res.json({ ok: true, cart });
}

export async function deleteCurrentCart(req, res) {
  const cart = await clearCart(req.auth.userId, getAuditContext(req));
  return res.json({ ok: true, cart });
}
