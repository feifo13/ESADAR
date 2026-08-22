import {
  getCollectingSettings,
} from "../../collecting/collecting.service.js";

import {
  prepareMercadoPagoCheckout,
} from "./mercado-pago.checkout-pro.service.js";

import {
  isMercadoPagoConfigurationReady,
} from "../../collecting/mercado-pago-configuration.js";

export const mercadoPagoProvider = Object.freeze({
  id: "MERCADO_PAGO",

  isAvailable(settings = {}) {
    return isMercadoPagoConfigurationReady(
      settings,
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
