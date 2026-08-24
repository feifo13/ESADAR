import {
  CHECKOUT_PAYMENT_STATES,
  getCheckoutPaymentPresentation,
} from "../lib/checkoutPaymentPresentation.js";

function getSafeCheckoutUrl(value) {
  try {
    const url = new URL(
      String(value || "").trim(),
    );

    return url.protocol === "https:"
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

export default function AccountOrderPaymentPanel({
  order,
  onPaymentAction,
  retrying = false,
  error = "",
}) {
  if (
    order?.paymentMethod
    !== "MERCADO_PAGO"
    || !order?.paymentRecovery
  ) {
    return null;
  }

  const recovery =
    order.paymentRecovery;

  const checkoutUrl =
    getSafeCheckoutUrl(
      recovery.checkoutUrl,
    );

  const presentation =
    getCheckoutPaymentPresentation({
      paymentMethod:
        order.paymentMethod,
      orderStatus:
        recovery.orderStatus
        || order.orderStatus,
      paymentStatus:
        recovery.paymentStatus
        || order.paymentStatus,
      reservedUntil:
        recovery.reservedUntil
        || order.reservedUntil,
      latestProviderPaymentStatus:
        recovery
          .latestProviderPaymentStatus,
      instructionsStatus:
        recovery.instructionsStatus,
      hasCheckoutUrl:
        Boolean(checkoutUrl),
      paymentActionAllowed:
        recovery.paymentActionAllowed === true,
      verificationState:
        recovery.verificationState,
      mpReturnResult:
        recovery.mpReturnResult,
    });

  const showPaymentCta =
    presentation.showPaymentCta
    && Boolean(checkoutUrl)
    && typeof onPaymentAction === "function";

  const showRetry =
    presentation.showRetry
    && recovery.paymentActionAllowed === true
    && typeof onPaymentAction === "function";

  const paymentCtaLabel =
    presentation.state
      === CHECKOUT_PAYMENT_STATES.FAILED
      ? "Reintentar pago"
      : "Pagar con Mercado Pago";

  return (
    <section
      className={`section-card page-stack account-order-payment-panel account-order-payment-panel--${presentation.state.toLowerCase()}`}
      data-payment-state={presentation.state}
    >
      <div className="account-order-payment-panel__heading">
        <div>
          <p className="section-kicker">
            {presentation.kicker}
          </p>
          <h2>{presentation.title}</h2>
        </div>
      </div>

      <p className="muted-copy account-order-payment-panel__copy">
        {presentation.body}
      </p>

      {error ? (
        <p
          className="error-copy account-order-payment-panel__error"
          aria-live="polite"
        >
          {error}
        </p>
      ) : null}

      {showPaymentCta ? (
        <div className="inline-action-group account-order-payment-panel__actions">
          <button
            type="button"
            className="button button-primary"
            disabled={retrying}
            onClick={() => void onPaymentAction()}
          >
            {paymentCtaLabel}
          </button>
        </div>
      ) : null}

      {showRetry ? (
        <div className="inline-action-group account-order-payment-panel__actions">
          <button
            type="button"
            className="button button-primary"
            disabled={retrying}
            onClick={() => void onPaymentAction()}
          >
            {retrying
              ? "Reintentando..."
              : "Reintentar pago"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
