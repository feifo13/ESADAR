import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  dirname,
  resolve,
} from "node:path";
import {
  fileURLToPath,
} from "node:url";

import {
  buildMercadoPagoBackUrls,
  buildMercadoPagoPreferencePayload,
  prepareMercadoPagoCheckout,
} from "../src/modules/payments/providers/mercado-pago.checkout-pro.service.js";

const __dirname =
  dirname(
    fileURLToPath(
      import.meta.url,
    ),
  );

const order = {
  id: 42,
  orderNumber: "ORD-TEST-42",
  total: 1990,
  currencyCode: "UYU",
  paymentMethod:
    "MERCADO_PAGO",

  customer: {
    firstName:
      "Cliente",
    lastName:
      "Prueba",
    email:
      "cliente@example.test",
  },
};

const settings = {
  isMercadoPagoEnabled: true,
  mercadoPagoEnvironment:
    "test",
  mercadoPagoAccessToken:
    "TEST_TOKEN_NOT_REAL",
  mercadoPagoCheckoutUrl:
    "",
  mercadoPagoNotificationUrl:
    "https://sandbox.esadar.com.uy/api/webhooks/mercado-pago",
  mercadoPagoUserId:
    "TEST_USER",
  mercadoPagoPreferenceNote:
    "",
  mercadoPagoInstructions:
    "",
};

class FakeConnection {
  constructor() {
    this.canonical = null;
    this.events = [];
  }

  async execute(sql, params = []) {
    if (
      sql.includes(
        "INSERT IGNORE INTO mercado_pago_checkout_preferences",
      )
    ) {
      if (this.canonical) {
        return [
          {
            affectedRows: 0,
          },
          [],
        ];
      }

      const [
        orderId,
        orderNumber,
        environment,
      ] = params;

      this.canonical = {
        orderId,
        orderNumber,
        environment,
        status:
          "CREATING",
        preferenceId:
          null,
        checkoutUrl:
          null,
        attemptCount:
          1,
        updatedAt:
          new Date(),
      };

      return [
        {
          affectedRows: 1,
        },
        [],
      ];
    }

    if (
      sql.includes(
        "FROM mercado_pago_checkout_preferences",
      )
    ) {
      if (!this.canonical) {
        return [[], []];
      }

      const [
        orderId,
        environment,
      ] = params;

      if (
        Number(
          this.canonical.orderId,
        ) !==
          Number(orderId) ||
        this.canonical
          .environment !==
          environment
      ) {
        return [[], []];
      }

      return [
        [
          {
            ...this.canonical,
          },
        ],
        [],
      ];
    }

    if (
      sql.includes(
        "UPDATE mercado_pago_checkout_preferences",
      ) &&
      sql.includes(
        "attempt_count = attempt_count + 1",
      )
    ) {
      if (
        !this.canonical ||
        this.canonical.status ===
          "READY"
      ) {
        return [
          {
            affectedRows: 0,
          },
          [],
        ];
      }

      if (
        this.canonical.status ===
          "CREATING"
      ) {
        return [
          {
            affectedRows: 0,
          },
          [],
        ];
      }

      this.canonical.status =
        "CREATING";

      this.canonical
        .attemptCount += 1;

      return [
        {
          affectedRows: 1,
        },
        [],
      ];
    }

    if (
      sql.includes(
        "status = 'READY'",
      )
    ) {
      const [
        preferenceId,
        checkoutUrl,
      ] = params;

      if (
        !this.canonical ||
        this.canonical.status !==
          "CREATING"
      ) {
        return [
          {
            affectedRows: 0,
          },
          [],
        ];
      }

      this.canonical.status =
        "READY";

      this.canonical.preferenceId =
        preferenceId;

      this.canonical.checkoutUrl =
        checkoutUrl;

      return [
        {
          affectedRows: 1,
        },
        [],
      ];
    }

    if (
      sql.includes(
        "status = 'FAILED'",
      )
    ) {
      if (this.canonical) {
        this.canonical.status =
          "FAILED";
      }

      return [
        {
          affectedRows: 1,
        },
        [],
      ];
    }

    if (
      sql.includes(
        "INSERT INTO mercado_pago_preference_events",
      )
    ) {
      this.events.push(params);

      return [
        {
          insertId:
            this.events.length,
        },
        [],
      ];
    }

    throw new Error(
      `Unexpected SQL: ${sql}`,
    );
  }
}

test("Checkout Pro return URLs use the public checkout completion route", () => {
  const urls =
    buildMercadoPagoBackUrls(
      order,
      {
        publicSiteUrl:
          "https://sandbox.esadar.com.uy",
      },
    );

  for (
    const [result, value]
    of Object.entries(urls)
  ) {
    const url =
      new URL(value);

    assert.equal(
      url.origin,
      "https://sandbox.esadar.com.uy",
    );

    assert.equal(
      url.pathname,
      "/checkout/completa",
    );

    assert.equal(
      url.searchParams.get(
        "mp_result",
      ),
      result,
    );

    assert.equal(
      url.searchParams.get(
        "order",
      ),
      null,
    );

    assert.doesNotMatch(
      url.pathname,
      /cuenta\/ordenes/,
    );
  }
});

test("Checkout Pro payload is UYU and keeps strict local order identity", () => {
  const payload =
    buildMercadoPagoPreferencePayload(
      order,
      settings,
      {
        publicSiteUrl:
          "https://sandbox.esadar.com.uy",
      },
    );

  assert.equal(
    payload.items.length,
    1,
  );

  assert.equal(
    payload.items[0]
      .currency_id,
    "UYU",
  );

  assert.equal(
    payload.external_reference,
    order.orderNumber,
  );

  assert.equal(
    payload.metadata.order_id,
    order.id,
  );

  assert.equal(
    payload.metadata.order_number,
    order.orderNumber,
  );

  assert.equal(
    new URL(
      payload.notification_url,
    ).protocol,
    "https:",
  );
});

test("non-UYU order cannot build an automatic Mercado Pago preference", () => {
  const payload =
    buildMercadoPagoPreferencePayload(
      {
        ...order,
        currencyCode: "USD",
      },
      settings,
      {
        publicSiteUrl:
          "https://sandbox.esadar.com.uy",
      },
    );

  assert.equal(
    payload,
    null,
  );
});

test("successful preference is persisted and reused without a second remote request", async () => {
  const connection =
    new FakeConnection();

  let fetchCount = 0;

  const fetchImpl =
    async () => {
      fetchCount += 1;

      return {
        ok: true,

        async json() {
          return {
            id:
              "TEST-PREF-42",
            sandbox_init_point:
              "https://sandbox.mercadopago.com.uy/checkout/v1/redirect?pref_id=TEST-PREF-42",
          };
        },
      };
    };

  const first =
    await prepareMercadoPagoCheckout(
      order,
      settings,
      connection,
      {
        publicSiteUrl:
          "https://sandbox.esadar.com.uy",
        fetchImpl,
      },
    );

  const second =
    await prepareMercadoPagoCheckout(
      order,
      settings,
      connection,
      {
        publicSiteUrl:
          "https://sandbox.esadar.com.uy",
        fetchImpl,
      },
    );

  assert.equal(
    fetchCount,
    1,
  );

  assert.equal(
    first.enabled,
    true,
  );

  assert.equal(
    second.enabled,
    true,
  );

  assert.equal(
    first.checkoutUrl,
    second.checkoutUrl,
  );

  assert.equal(
    connection
      .canonical
      .status,
    "READY",
  );

  assert.equal(
    connection
      .canonical
      .preferenceId,
    "TEST-PREF-42",
  );
});

test("existing creation claim prevents a concurrent duplicate preference request", async () => {
  const connection =
    new FakeConnection();

  connection.canonical = {
    orderId: order.id,
    orderNumber:
      order.orderNumber,
    environment: "test",
    status: "CREATING",
    preferenceId: null,
    checkoutUrl: null,
    attemptCount: 1,
    updatedAt: new Date(),
  };

  let fetchCount = 0;

  const result =
    await prepareMercadoPagoCheckout(
      order,
      settings,
      connection,
      {
        publicSiteUrl:
          "https://sandbox.esadar.com.uy",

        fetchImpl:
          async () => {
            fetchCount += 1;

            throw new Error(
              "must not be called",
            );
          },
      },
    );

  assert.equal(
    fetchCount,
    0,
  );

  assert.equal(
    result.enabled,
    false,
  );

  assert.equal(
    result.status,
    "TEMPORARILY_UNAVAILABLE",
  );

  assert.equal(
    result.preferenceFailureReason,
    "mercado_pago_preference_creation_in_progress",
  );
});

test("remote preference failure is isolated and marks canonical state FAILED", async () => {
  const connection =
    new FakeConnection();

  const result =
    await prepareMercadoPagoCheckout(
      order,
      settings,
      connection,
      {
        publicSiteUrl:
          "https://sandbox.esadar.com.uy",

        fetchImpl:
          async () => ({
            ok: false,
            status: 503,

            async text() {
              return (
                '{"message":"temporary"}'
              );
            },
          }),
      },
    );

  assert.equal(
    result.enabled,
    false,
  );

  assert.equal(
    result.status,
    "TEMPORARILY_UNAVAILABLE",
  );

  assert.equal(
    connection
      .canonical
      .status,
    "FAILED",
  );
});

test("live Mercado Pago provider delegates to isolated Checkout Pro service", () => {
  const source =
    readFileSync(
      resolve(
        __dirname,
        "../src/modules/payments/providers/mercado-pago.provider.js",
      ),
      "utf8",
    );

  assert.match(
    source,
    /prepareMercadoPagoCheckout/,
  );

  assert.doesNotMatch(
    source,
    /getMercadoPagoPaymentInstructionsForOrder/,
  );
});


test(
  "Mercado Pago back URLs expose only the return result and no order identity",
  () => {
    const urls =
      buildMercadoPagoBackUrls(
        {
          id: 42,
          orderNumber: "ORD-42",
        },
        {
          publicSiteUrl:
            "https://sandbox.esadar.com.uy",
        },
      );

    for (
      const [result, value]
      of Object.entries(urls)
    ) {
      const url =
        new URL(value);

      assert.equal(
        url.pathname,
        "/checkout/completa",
      );

      assert.equal(
        url.searchParams.get(
          "mp_result",
        ),
        result,
      );

      assert.equal(
        url.searchParams.has(
          "order",
        ),
        false,
      );

      assert.deepEqual(
        [
          ...url.searchParams.keys(),
        ],
        ["mp_result"],
      );
    }
  },
);
