const MERCADO_PAGO_PAYMENT_URL =
  "https://api.mercadopago.com/v1/payments";

export async function fetchMercadoPagoPayment(
  paymentId,
  accessToken,
) {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      10000,
    );

  try {
    const response =
      await fetch(
        `${MERCADO_PAGO_PAYMENT_URL}/${encodeURIComponent(
          paymentId,
        )}`,
        {
          method: "GET",
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
            "Content-Type":
              "application/json",
          },
          signal:
            controller.signal,
        },
      );

    const responseText =
      await response.text();

    let body = null;

    try {
      body =
        responseText
          ? JSON.parse(responseText)
          : null;
    } catch {
      body = {
        raw: responseText,
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        status:
          response.status,
        body,
        message:
          body?.message
          || `Mercado Pago respondio ${response.status}`,
      };
    }

    return {
      ok: true,
      payment: body,
    };
  } finally {
    clearTimeout(timeout);
  }
}
