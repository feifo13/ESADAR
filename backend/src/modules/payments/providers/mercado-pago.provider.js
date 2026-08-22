import {
  getCollectingSettings,
} from "../../collecting/collecting.service.js";

import {
  prepareMercadoPagoCheckout,
} from "./mercado-pago.checkout-pro.service.js";

function hasText(value) {
  return String(value || "").trim().length > 0;
}

export const mercadoPagoProvider = Object.freeze({
  id: "MERCADO_PAGO",

  isAvailable(settings = {}) {
    return Boolean(
      settings.isMercadoPagoEnabled &&
        (
          hasText(settings.mercadoPagoAccessToken) ||
          hasText(settings.mercadoPagoCheckoutUrl)
        ),
    );
  },

  async prepare(
    order,
    connection,
    options = {},
  ) {
    const settings =
      await getCollectingSettings(
        connection,
      );

    return prepareMercadoPagoCheckout(
      order,
      settings,
      connection,
      options,
    );
  },
});
