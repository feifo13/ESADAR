export const CHECKOUT_PAYMENT_STATES = Object.freeze({
  ACTION_REQUIRED: "ACTION_REQUIRED",
  PROCESSING: "PROCESSING",
  CONFIRMED: "CONFIRMED",
  FAILED: "FAILED",
  TECHNICAL_ERROR: "TECHNICAL_ERROR",
});

const CONFIRMED_ORDER_STATUSES = new Set([
  "APPROVED",
  "SHIPPED",
]);

const FAILED_PROVIDER_STATUSES = new Set([
  "REJECTED",
  "FAILED",
]);

function normalize(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function hasActivePaymentReservation(input, orderStatus) {
  if (orderStatus !== "RESERVED") return false;

  const reservedUntil = new Date(
    input.reservedUntil || "",
  ).getTime();

  const now = input.now == null
    ? Date.now()
    : new Date(input.now).getTime();

  return (
    Number.isFinite(reservedUntil)
    && Number.isFinite(now)
    && reservedUntil > now
  );
}

function bankTransferPresentation() {
  return {
    state: CHECKOUT_PAYMENT_STATES.ACTION_REQUIRED,
    variant: "BANK_TRANSFER",
    kicker: "Orden recibida",
    title: "Completá la transferencia",
    body:
      "Tu orden quedó registrada y reservada por 24 horas. Transferí el total usando los datos que aparecen a continuación.",
    panelTitle: "Transferencia bancaria",
    panelBody: "",
    showPaymentCta: false,
    paymentCtaLabel: "",
    showRetry: false,
    warning: "",
    supportHint: "",
  };
}

function mercadoPagoBase(overrides) {
  return {
    state: CHECKOUT_PAYMENT_STATES.ACTION_REQUIRED,
    variant: "MP_ACTION_REQUIRED_READY",
    kicker: "Orden recibida",
    title: "Completá el pago",
    body:
      "Tu orden quedó registrada y reservada por 24 horas. Para completar la compra, pagá con Mercado Pago.",
    panelTitle: "Mercado Pago",
    panelBody:
      "Continuá a Mercado Pago para completar el pago. Cuando vuelvas, verificaremos el resultado antes de marcar la orden como pagada.",
    showPaymentCta: true,
    paymentCtaLabel: "Pagar con Mercado Pago",
    showRetry: false,
    warning: "",
    supportHint: "",
    ...overrides,
  };
}

export function getCheckoutPaymentPresentation(input = {}) {
  const paymentMethod = normalize(input.paymentMethod);

  if (paymentMethod === "BANK_TRANSFER") {
    return bankTransferPresentation();
  }

  const orderStatus = normalize(input.orderStatus);
  const paymentStatus = normalize(input.paymentStatus);
  const latestProviderPaymentStatus =
    normalize(input.latestProviderPaymentStatus);
  const instructionsStatus = normalize(input.instructionsStatus);
  const mpReturnResult = String(input.mpReturnResult || "")
    .trim()
    .toLowerCase();
  const verificationState = String(input.verificationState || "idle")
    .trim()
    .toLowerCase();
  const instructionsReady =
    instructionsStatus === "READY"
    && Boolean(input.hasCheckoutUrl);
  const paymentActionAllowed =
    input.paymentActionAllowed === true
    &&
    hasActivePaymentReservation(
      input,
      orderStatus,
    );

  const confirmed =
    paymentStatus === "PAID"
    && CONFIRMED_ORDER_STATUSES.has(orderStatus);

  if (confirmed) {
    return mercadoPagoBase({
      state: CHECKOUT_PAYMENT_STATES.CONFIRMED,
      variant: "MP_CONFIRMED",
      kicker: "Pago confirmado",
      title: "Tu compra está confirmada",
      body:
        "Mercado Pago confirmó el pago y tu orden fue aprobada.",
      panelBody: "",
      showPaymentCta: false,
      paymentCtaLabel: "",
      showRetry: false,
    });
  }

  const returnNeedsVerification =
    verificationState === "checking"
    || mpReturnResult === "success"
    || mpReturnResult === "pending";

  if (returnNeedsVerification) {
    return mercadoPagoBase({
      state: CHECKOUT_PAYMENT_STATES.PROCESSING,
      variant: "MP_RETURN_VERIFYING",
      kicker: "Pago en verificación",
      title: "Estamos verificando tu pago",
      body:
        "Volviste de Mercado Pago. Estamos verificando el pago antes de aprobar la orden. Si ya lo completaste, no vuelvas a pagarlo.",
      panelBody: "",
      showPaymentCta: false,
      paymentCtaLabel: "",
      showRetry: false,
    });
  }

  const authoritativePending =
    latestProviderPaymentStatus === "PENDING"
    || latestProviderPaymentStatus === "APPROVED"
    || verificationState === "pending";

  if (authoritativePending) {
    return mercadoPagoBase({
      state: CHECKOUT_PAYMENT_STATES.PROCESSING,
      variant: "MP_AUTHORITATIVE_PENDING",
      kicker: "Pago pendiente",
      title: "Mercado Pago está procesando tu pago",
      body:
        "Tu pago todavía está pendiente de confirmación. La orden permanece reservada mientras esperamos el resultado. Si ya realizaste el pago, no vuelvas a intentarlo.",
      panelBody: "",
      showPaymentCta: false,
      paymentCtaLabel: "",
      showRetry: false,
    });
  }

  if (verificationState === "error") {
    return mercadoPagoBase({
      state: CHECKOUT_PAYMENT_STATES.TECHNICAL_ERROR,
      variant: "MP_TECHNICAL_ERROR",
      kicker: "Pago en verificación",
      title:
        "No pudimos verificar el pago en este momento",
      body:
        "Tu orden sigue registrada. Si ya realizaste el pago, no vuelvas a intentarlo. Esperá unos minutos y, si no recibís la confirmación, contactanos indicando tu número de orden.",
      panelBody: "",
      showPaymentCta: false,
      paymentCtaLabel: "",
      showRetry: false,
    });
  }

  const failed =
    paymentStatus === "FAILED"
    || FAILED_PROVIDER_STATUSES.has(
      latestProviderPaymentStatus,
    );

  if (failed) {
    return mercadoPagoBase({
      state: CHECKOUT_PAYMENT_STATES.FAILED,
      variant: "MP_AUTHORITATIVE_FAILED",
      kicker: "Orden recibida",
      title: "Pago no completado",
      body:
        "Mercado Pago informó que el pago no se completó. Tu orden sigue registrada y podés volver a intentarlo mientras la reserva esté vigente.",
      panelBody: "",
      showPaymentCta:
        instructionsReady
        && paymentActionAllowed,
      paymentCtaLabel:
        "Volver a intentar con Mercado Pago",
      showRetry:
        !instructionsReady
        && paymentActionAllowed,
    });
  }

  if (mpReturnResult === "failure") {
    return mercadoPagoBase({
      state: CHECKOUT_PAYMENT_STATES.ACTION_REQUIRED,
      variant: "MP_RETURN_FAILURE",
      kicker: "Orden recibida",
      title: "No se completó este intento de pago",
      body:
        "Tu orden sigue registrada y podés volver a intentarlo mientras la reserva esté vigente.",
      panelBody: "",
      showPaymentCta:
        instructionsReady
        && paymentActionAllowed,
      paymentCtaLabel:
        "Volver a intentar con Mercado Pago",
      showRetry:
        !instructionsReady
        && paymentActionAllowed,
    });
  }

  if (!paymentActionAllowed) {
    return mercadoPagoBase({
      variant: "MP_PAYMENT_ACTION_UNAVAILABLE",
      title: "El pago está pendiente",
      body:
        "Esta orden ya no admite un nuevo intento de pago.",
      panelBody: "",
      showPaymentCta: false,
      paymentCtaLabel: "",
      showRetry: false,
    });
  }

  if (!instructionsReady) {
    return mercadoPagoBase({
      variant: "MP_ACTION_REQUIRED_UNAVAILABLE",
      title: "El pago está pendiente",
      body:
        "Tu orden quedó registrada y reservada por 24 horas. No pudimos habilitar Mercado Pago en este momento.",
      panelBody:
        "No pudimos abrir Mercado Pago. Tu orden quedó registrada y reservada. Podés intentar generar el enlace nuevamente mientras la reserva esté vigente.",
      showPaymentCta: false,
      paymentCtaLabel: "",
      showRetry: paymentActionAllowed,
    });
  }

  return mercadoPagoBase();
}
