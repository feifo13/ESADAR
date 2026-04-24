import {
  listBrands,
  listCategories,
  listPaymentMethods,
  listShippingMethods,
  listSizes,
} from './lookups.service.js';

export async function getPublicLookups(_req, res) {
  const [categories, brands, sizes, shippingMethods, paymentMethods] = await Promise.all([
    listCategories(),
    listBrands(),
    listSizes(),
    listShippingMethods(),
    listPaymentMethods(),
  ]);

  return res.json({
    ok: true,
    categories,
    brands,
    sizes,
    shippingMethods,
    paymentMethods,
  });
}

export async function getPublicCategories(_req, res) {
  const items = await listCategories();
  return res.json({ ok: true, items });
}

export async function getPublicBrands(_req, res) {
  const items = await listBrands();
  return res.json({ ok: true, items });
}

export async function getPublicSizes(_req, res) {
  const items = await listSizes();
  return res.json({ ok: true, items });
}

export async function getPublicShippingMethods(_req, res) {
  const items = await listShippingMethods();
  return res.json({ ok: true, items });
}

export async function getPublicPaymentMethods(_req, res) {
  const items = await listPaymentMethods();
  return res.json({ ok: true, items });
}
