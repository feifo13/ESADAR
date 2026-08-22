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
});
