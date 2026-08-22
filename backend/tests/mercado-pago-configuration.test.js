import assert from "node:assert/strict";
import {
  readFileSync,
} from "node:fs";
import test from "node:test";

import {
  buildCollectingSettingsUpdate,
} from "../src/modules/collecting/collecting.service.js";

import {
  getMercadoPagoConfigurationIssues,
  isHttpsUrl,
  isMercadoPagoConfigurationReady,
} from "../src/modules/collecting/mercado-pago-configuration.js";

const before = {
  bankTaxRate: 0.025,
  isBankTransferEnabled: false,
  bankAccountHolder: "Cuenta existente",
  bankName: "Banco existente",
  bankAccountType: "Caja",
  bankAccountNumber: "123",
  bankBranch: "1",
  bankCurrency: "UYU",
  bankAlias: "alias",
  bankDocument: "doc",
  bankInstructions: "instrucciones",

  isMercadoPagoEnabled: false,
  mercadoPagoEnvironment: "test",
  mercadoPagoPublicKey: "PUBLIC",
  mercadoPagoAccessToken:
    "TEST_TOKEN_NOT_REAL",
  mercadoPagoUserId: "TEST_USER",
  mercadoPagoCheckoutUrl:
    "https://example.test/fallback",
  mercadoPagoNotificationUrl:
    "https://sandbox.esadar.com.uy/api/webhooks/mercado-pago",
  mercadoPagoWebhookSecret:
    "TEST_SECRET_NOT_REAL",
  mercadoPagoPreferenceNote: "nota",
  mercadoPagoInstructions: "mp instrucciones",
};

test(
  "partial collecting update preserves omitted settings and never enables Mercado Pago",
  () => {
    const next =
      buildCollectingSettingsUpdate(
        {
          bankTaxPercent: 3,
        },
        before,
      );

    assert.equal(
      next.bankTaxRate,
      0.03,
    );

    assert.equal(
      next.isBankTransferEnabled,
      false,
    );

    assert.equal(
      next.bankAccountHolder,
      before.bankAccountHolder,
    );

    assert.equal(
      next.bankName,
      before.bankName,
    );

    assert.equal(
      next.isMercadoPagoEnabled,
      false,
    );

    assert.equal(
      next.mercadoPagoAccessToken,
      before.mercadoPagoAccessToken,
    );

    assert.equal(
      next.mercadoPagoWebhookSecret,
      before.mercadoPagoWebhookSecret,
    );

    assert.equal(
      next.mercadoPagoNotificationUrl,
      before.mercadoPagoNotificationUrl,
    );
  },
);

test(
  "blank secret inputs preserve configured secrets while regular blank fields can clear",
  () => {
    const next =
      buildCollectingSettingsUpdate(
        {
          mercadoPagoAccessToken: "",
          mercadoPagoWebhookSecret: "",
          mercadoPagoNotificationUrl: null,
        },
        before,
      );

    assert.equal(
      next.mercadoPagoAccessToken,
      before.mercadoPagoAccessToken,
    );

    assert.equal(
      next.mercadoPagoWebhookSecret,
      before.mercadoPagoWebhookSecret,
    );

    assert.equal(
      next.mercadoPagoNotificationUrl,
      null,
    );
  },
);

test(
  "Mercado Pago requires token HTTPS notification secret and canonical environment",
  () => {
    const complete = {
      isMercadoPagoEnabled: true,
      mercadoPagoEnvironment: "test",
      mercadoPagoAccessToken:
        "TEST_TOKEN_NOT_REAL",
      mercadoPagoNotificationUrl:
        "https://sandbox.esadar.com.uy/api/webhooks/mercado-pago",
      mercadoPagoWebhookSecret:
        "TEST_SECRET_NOT_REAL",
    };

    assert.deepEqual(
      getMercadoPagoConfigurationIssues(
        complete,
      ),
      [],
    );

    assert.equal(
      isMercadoPagoConfigurationReady(
        complete,
      ),
      true,
    );

    assert.equal(
      isHttpsUrl(
        complete.mercadoPagoNotificationUrl,
      ),
      true,
    );
  },
);

test(
  "fallback checkout URL cannot substitute for secure Mercado Pago integration",
  () => {
    const fallbackOnly = {
      isMercadoPagoEnabled: true,
      mercadoPagoEnvironment: "test",
      mercadoPagoCheckoutUrl:
        "https://example.test/fallback",
    };

    const issues =
      getMercadoPagoConfigurationIssues(
        fallbackOnly,
      );

    assert.ok(
      issues.includes(
        "mercadoPagoAccessToken",
      ),
    );

    assert.ok(
      issues.includes(
        "mercadoPagoNotificationUrl",
      ),
    );

    assert.ok(
      issues.includes(
        "mercadoPagoWebhookSecret",
      ),
    );

    assert.equal(
      isMercadoPagoConfigurationReady(
        fallbackOnly,
      ),
      false,
    );
  },
);

test(
  "HTTP webhook URL is not a valid Mercado Pago readiness configuration",
  () => {
    assert.equal(
      isHttpsUrl(
        "http://sandbox.esadar.com.uy/api/webhooks/mercado-pago",
      ),
      false,
    );
  },
);

test(
  "collecting update service enforces configuration issues before enabling Mercado Pago",
  () => {
    const source =
      readFileSync(
        new URL(
          "../src/modules/collecting/collecting.service.js",
          import.meta.url,
        ),
        "utf8",
      );

    assert.match(
      source,
      /if \(next\.isMercadoPagoEnabled\)/,
    );

    assert.match(
      source,
      /getMercadoPagoConfigurationIssues\(\s*next,/,
    );

    assert.match(
      source,
      /throw badRequest\(/,
    );
  },
);
