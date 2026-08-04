import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildInitialInventorySnapshot,
  getManualInventoryActionAvailability,
  getInventoryMovementLimit,
  INITIAL_STOCK_STATES,
} from "../src/lib/adminInventory.js";

test("creation inventory state maps available and sold-out articles correctly", () => {
  assert.deepEqual(
    buildInitialInventorySnapshot(3, INITIAL_STOCK_STATES.AVAILABLE),
    {
      quantityTotal: 3,
      quantityAvailable: 3,
      quantityReserved: 0,
      quantitySold: 0,
      quantityLost: 0,
    },
  );
  assert.deepEqual(
    buildInitialInventorySnapshot(2, INITIAL_STOCK_STATES.SOLD_OUT),
    {
      quantityTotal: 2,
      quantityAvailable: 0,
      quantityReserved: 0,
      quantitySold: 2,
      quantityLost: 0,
    },
  );
});

test("row actions reflect available, reserved and sold inventory", () => {
  assert.deepEqual(
    getManualInventoryActionAvailability({
      quantityAvailable: 1,
      quantityReserved: 0,
      quantitySold: 0,
    }),
    {
      canSell: true,
      saleBlockedByReservation: false,
      canReturn: false,
      isSoldOutBySale: false,
    },
  );
  assert.equal(
    getManualInventoryActionAvailability({
      quantityAvailable: 2,
      quantityReserved: 1,
      quantitySold: 0,
    }).saleBlockedByReservation,
    true,
  );
  assert.equal(
    getManualInventoryActionAvailability({
      quantityAvailable: 0,
      quantityReserved: 0,
      quantitySold: 1,
    }).isSoldOutBySale,
    true,
  );
});

test("movement dialog limits sale and return quantities to semantic counters", () => {
  const article = { quantityAvailable: 4, quantitySold: 2 };
  assert.equal(getInventoryMovementLimit(article, "sale"), 4);
  assert.equal(getInventoryMovementLimit(article, "return"), 2);
});

test("admin pages expose shared manual sale confirmation and refresh callbacks", async () => {
  const [dialog, table, form, stock] = await Promise.all([
    readFile(new URL("../src/components/admin/AdminInventoryMovementDialog.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/admin/AdminArticlesPage.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/admin/AdminArticleFormPage.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/admin/AdminArticleStockPage.jsx", import.meta.url), "utf8"),
  ]);

  assert.match(dialog, /Registrar venta manual/);
  assert.match(dialog, /useState\("1"\)/);
  assert.match(dialog, /endpoint: "manual-sale"/);
  assert.match(dialog, /endpoint: "return"/);
  assert.match(dialog, /onCompleted\?\.\(response\.article\)/);
  assert.match(table, /Registrar venta/);
  assert.match(table, /Registrar devolución/);
  assert.match(form, /Ya vendido \/ agotado/);
  assert.match(form, /initialStockState/);
  assert.match(stock, /Corrección administrativa/);
  assert.match(stock, /Registrar venta manual/);
});

test("mobile inventory actions preserve their semantic text", async () => {
  const [table, responsiveLabels, mobileCss] = await Promise.all([
    readFile(new URL("../src/pages/admin/AdminArticlesPage.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/ResponsiveTableLabels.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/52-checkout-mobile-controls.css", import.meta.url), "utf8"),
  ]);

  const semanticButtons = table.match(
    /<button[\s\S]*?admin-inventory-row-action[\s\S]*?<\/button>/g,
  ) || [];

  assert.equal(semanticButtons.length, 2);
  semanticButtons.forEach((button) => {
    assert.match(button, /data-mobile-action="text"/);
    assert.match(button, /aria-label=/);
  });
  assert.match(semanticButtons[0], /Registrar venta/);
  assert.match(semanticButtons[1], /Registrar devoluci/);

  assert.match(
    responsiveLabels,
    /control\.dataset\.mobileAction === 'text'/,
  );
  assert.match(
    responsiveLabels,
    /control\.classList\.contains\('admin-inventory-row-action'\)/,
  );

  const mobileActionRule = mobileCss.match(
    /\.admin-page-shell \.data-table \.table-actions \.admin-inventory-row-action\s*\{([^}]*)\}/,
  );
  assert.ok(mobileActionRule, "missing the mobile semantic action rule");
  assert.match(mobileActionRule[1], /flex:\s*0 0 100% !important/);
  assert.match(mobileActionRule[1], /width:\s*100% !important/);
  assert.match(mobileActionRule[1], /overflow:\s*visible !important/);
  assert.match(mobileActionRule[1], /font-size:\s*0\.85rem !important/);
  assert.doesNotMatch(mobileActionRule[1], /font-size:\s*0\s*(?:!important\s*)?;/);
  assert.doesNotMatch(mobileActionRule[1], /overflow:\s*hidden/);
  assert.doesNotMatch(mobileActionRule[1], /text-indent/);
  assert.match(
    mobileCss,
    /\.admin-page-shell \.data-table \.table-actions \.admin-inventory-row-action:disabled\s*\{[^}]*opacity:/,
  );
});

test("public sold-out contract remains present", async () => {
  const [card, articlePage, seo] = await Promise.all([
    readFile(new URL("../src/components/ArticleCard.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/ArticlePage.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/seo.js", import.meta.url), "utf8"),
  ]);

  assert.match(card, /Agotado/);
  assert.match(articlePage, /isSoldOut/);
  assert.match(articlePage, /Agregar al carrito/);
  assert.match(seo, /schema\.org\/OutOfStock/);
});
