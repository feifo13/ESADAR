import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCart } from "../contexts/CartContext.jsx";
import CopyValueButton from "../components/CopyValueButton.jsx";
import { apiFetch } from "../lib/api.js";
import {
  CHECKOUT_PAYMENT_STATES,
  getCheckoutPaymentPresentation,
} from "../lib/checkoutPaymentPresentation.js";
import { formatCurrency } from "../lib/format.js";
import { getFriendlyErrorMessage } from "../lib/validation.js";

const COMPLETE_STORAGE_KEY = "esadar-checkout-complete";

function readCompletedOrder() {
  if (typeof window === "undefined") return null;

  try {
    return JSON.parse(
      window.sessionStorage.getItem(COMPLETE_STORAGE_KEY) || "null",
    );
  } catch {
    return null;
  }
}

const MERCADO_PAGO_RETURN_RESULTS = new Set([
  "success",
  "failure",
  "pending",
]);

function getMercadoPagoReturnResult(search) {
  const params = new URLSearchParams(String(search || ""));
  const result = params.get("mp_result");
  return MERCADO_PAGO_RETURN_RESULTS.has(result) ? result : null;
}

function getMercadoPagoReturnPaymentId(search) {
  const params = new URLSearchParams(String(search || ""));
  const paymentId = String(params.get("payment_id") || "").trim();
  return /^\d{1,40}$/.test(paymentId) ? paymentId : "";
}

function getSafeMercadoPagoCheckoutUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function isValidPaymentCapability(value) {
  return /^[a-f0-9]{64}$/i.test(String(value || "").trim());
}

export default function CheckoutCompletePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { clearCart } = useCart();
  const didCleanupRef = useRef(false);
  const didMercadoPagoVerificationRef = useRef("");

  const [completedOrder, setCompletedOrder] = useState(() => {
    const stored = readCompletedOrder() || {};
    return location.state?.orderNumber
      ? { ...stored, ...location.state }
      : stored.orderNumber
        ? stored
        : null;
  });
  const [retryingPayment, setRetryingPayment] = useState(false);
  const [retryError, setRetryError] = useState("");
  const [mercadoPagoVerification, setMercadoPagoVerification] =
    useState({ status: "idle" });

  const updateCompletedOrder = useCallback((patch) => {
    setCompletedOrder((current) => {
      if (!current) return current;

      const next = { ...current, ...patch };

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          COMPLETE_STORAGE_KEY,
          JSON.stringify(next),
        );
      }

      return next;
    });
  }, []);

  const paymentInstructions = completedOrder?.paymentInstructions || null;
  const paymentMethod =
    paymentInstructions?.method || completedOrder?.paymentMethod || "";
  const isBankTransfer = paymentMethod === "BANK_TRANSFER";
  const isMercadoPago = paymentMethod === "MERCADO_PAGO";
  const showTransferDetails =
    isBankTransfer && paymentInstructions?.enabled;

  const mercadoPagoCheckoutUrl = isMercadoPago
    ? getSafeMercadoPagoCheckoutUrl(paymentInstructions?.checkoutUrl)
    : "";
  const mercadoPagoReturnResult = isMercadoPago
    ? getMercadoPagoReturnResult(location.search)
    : null;
  const mercadoPagoReturnPaymentId = isMercadoPago
    ? getMercadoPagoReturnPaymentId(location.search)
    : "";
  const paymentRetryToken = String(
    completedOrder?.paymentRetryToken || "",
  ).trim();
  const orderId = Number(completedOrder?.orderId || 0);
  const hasPaymentCapability =
    Number.isInteger(orderId)
    && orderId > 0
    && isValidPaymentCapability(paymentRetryToken);
  const paymentActionAllowed =
    isMercadoPago
    && hasPaymentCapability
    && completedOrder?.paymentActionAllowed === true;

  const presentation = getCheckoutPaymentPresentation({
    paymentMethod,
    orderStatus: completedOrder?.orderStatus,
    paymentStatus: completedOrder?.paymentStatus,
    latestProviderPaymentStatus:
      completedOrder?.latestProviderPaymentStatus,
    instructionsStatus:
      paymentInstructions?.status
      || (paymentInstructions?.enabled ? "READY" : "TEMPORARILY_UNAVAILABLE"),
    mpReturnResult: mercadoPagoReturnResult,
    verificationState: mercadoPagoVerification.status,
    reservedUntil: completedOrder?.reservedUntil,
    hasCheckoutUrl: Boolean(mercadoPagoCheckoutUrl),
    paymentActionAllowed,
  });

  const refreshLocalPaymentStatus = useCallback(async () => {
    if (!isMercadoPago || !hasPaymentCapability) return null;

    const response = await apiFetch(
      `/api/public/orders/${encodeURIComponent(orderId)}/payment/status`,
      {
        method: "POST",
        body: { retryToken: paymentRetryToken },
      },
    );

    const sameOrder =
      Number(response?.orderId) === orderId
      && String(response?.orderNumber || "")
        === String(completedOrder?.orderNumber || "");

    if (!sameOrder) {
      throw new Error("No pudimos validar la identidad de la orden.");
    }

    updateCompletedOrder({
      orderStatus: response.orderStatus,
      paymentStatus: response.paymentStatus,
      reservedUntil: response.reservedUntil,
      latestProviderPaymentStatus:
        response.latestProviderPaymentStatus || null,
      paymentActionAllowed:
        response.paymentActionAllowed === true,
    });

    return response;
  }, [
    completedOrder?.orderNumber,
    hasPaymentCapability,
    isMercadoPago,
    orderId,
    paymentRetryToken,
    updateCompletedOrder,
  ]);

  useEffect(() => {
    if (!completedOrder?.orderNumber) {
      navigate("/", { replace: true });
      return;
    }

    if (didCleanupRef.current) return;

    didCleanupRef.current = true;
    clearCart();

    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("esadar-checkout-draft");
    }
  }, [clearCart, completedOrder?.orderNumber, navigate]);

  useEffect(() => {
    void refreshLocalPaymentStatus().catch(() => {
      // Missing or expired capabilities must not reveal order state.
    });
  }, [refreshLocalPaymentStatus]);

  useEffect(() => {
    const canVerify =
      isMercadoPago
      && (
        mercadoPagoReturnResult === "success"
        || mercadoPagoReturnResult === "pending"
      )
      && Number.isInteger(orderId)
      && orderId > 0
      && /^\d{1,40}$/.test(mercadoPagoReturnPaymentId)
      && isValidPaymentCapability(paymentRetryToken);

    if (!canVerify) return undefined;

    const attemptKey = [
      orderId,
      mercadoPagoReturnPaymentId,
      paymentRetryToken,
    ].join(":");

    if (didMercadoPagoVerificationRef.current === attemptKey) {
      return undefined;
    }

    didMercadoPagoVerificationRef.current = attemptKey;
    let cancelled = false;

    setMercadoPagoVerification({ status: "checking" });

    apiFetch(
      `/api/public/orders/${encodeURIComponent(
        orderId,
      )}/payment/mercado-pago/reconcile`,
      {
        method: "POST",
        body: {
          paymentId: mercadoPagoReturnPaymentId,
          retryToken: paymentRetryToken,
        },
      },
    )
      .then(async (response) => {
        if (cancelled) return;

        const sameOrder =
          Number(response?.orderId) === orderId
          && String(response?.orderNumber || "")
            === String(completedOrder?.orderNumber || "");

        if (!sameOrder) {
          throw new Error("No pudimos validar la identidad de la orden.");
        }

        updateCompletedOrder({
          orderStatus: response.orderStatus,
          paymentStatus: response.paymentStatus,
        });

        try {
          await refreshLocalPaymentStatus();
        } catch {
          // Reconciliation already returned the safe local order state.
        }

        if (cancelled) return;

        setMercadoPagoVerification({
          status:
            response?.confirmed === true
            && response?.paymentStatus === "PAID"
              ? "confirmed"
              : "pending",
        });
      })
      .catch(async () => {
        if (cancelled) return;

        try {
          await refreshLocalPaymentStatus();
        } catch {
          // The technical copy remains the safe fallback.
        }

        if (!cancelled) {
          setMercadoPagoVerification({ status: "error" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    completedOrder?.orderNumber,
    isMercadoPago,
    mercadoPagoReturnPaymentId,
    mercadoPagoReturnResult,
    orderId,
    paymentRetryToken,
    refreshLocalPaymentStatus,
    updateCompletedOrder,
  ]);

  async function handleMercadoPagoPaymentAction() {
    if (
      !(
        presentation.showPaymentCta
        || presentation.showRetry
      )
      || !paymentActionAllowed
      || retryingPayment
    ) {
      return;
    }

    setRetryingPayment(true);
    setRetryError("");

    try {
      const response = await apiFetch(
        `/api/public/orders/${encodeURIComponent(orderId)}/payment/retry`,
        {
          method: "POST",
          body: { retryToken: paymentRetryToken },
        },
      );
      const nextPaymentInstructions = response?.paymentInstructions || null;
      const nextCheckoutUrl =
        getSafeMercadoPagoCheckoutUrl(
          nextPaymentInstructions?.checkoutUrl,
        );
      const sameOrder =
        Number(response?.orderId) === orderId
        && String(response?.orderNumber || "")
          === String(completedOrder?.orderNumber || "");

      if (
        !sameOrder
        || nextPaymentInstructions?.method !== "MERCADO_PAGO"
        || response?.paymentActionAllowed !== true
      ) {
        throw new Error("No pudimos validar el reintento de pago.");
      }

      updateCompletedOrder({
        paymentInstructions: nextPaymentInstructions,
        paymentActionAllowed: true,
      });
      setMercadoPagoVerification({ status: "idle" });

      if (
        nextPaymentInstructions?.enabled === true
        && nextPaymentInstructions?.status === "READY"
      ) {
        if (!nextCheckoutUrl) {
          throw new Error("No pudimos validar el reintento de pago.");
        }

        window.location.assign(nextCheckoutUrl);
      }
    } catch (error) {
      try {
        await refreshLocalPaymentStatus();
      } catch {
        // The click-time backend decision remains authoritative.
      }

      setRetryError(
        getFriendlyErrorMessage(
          error,
          "No pudimos volver a generar el enlace de Mercado Pago. Intentá nuevamente en unos minutos.",
        ),
      );
    } finally {
      setRetryingPayment(false);
    }
  }

  function handleCompletionPrimaryAction() {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(COMPLETE_STORAGE_KEY);
      window.dispatchEvent(
        new CustomEvent("esadar:suppress-footer-reveal", {
          detail: { release: true },
        }),
      );
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }

    if (
      presentation.state
      === CHECKOUT_PAYMENT_STATES.CONFIRMED
    ) {
      navigate("/cuenta/ordenes", {
        replace: true,
      });
      return;
    }

    navigate("/", {
      replace: true,
      state: { replayIntro: true, replayIntroReason: "checkout-accepted" },
    });
  }

  function renderTransferDetails() {
    if (!showTransferDetails) return null;

    const fields = paymentInstructions.fields || [];
    const amount = completedOrder?.total;

    return (
      <div className="checkout-complete-transfer-panel">
        <h2>{presentation.panelTitle}</h2>
        <div className="checkout-complete-payment-details">
          {fields.map((field) => (
            <div key={field.label} className="checkout-complete-payment-row">
              <span>{field.label}</span>
              <strong>{field.value}</strong>
            </div>
          ))}
          {amount != null ? (
            <div className="checkout-complete-payment-row">
              <span>Monto</span>
              <strong>{formatCurrency(amount)}</strong>
            </div>
          ) : null}
        </div>
        {paymentInstructions.instructions ? (
          <p className="muted-copy checkout-complete-bank-instructions">
            {paymentInstructions.instructions}
          </p>
        ) : null}
      </div>
    );
  }

  function renderMercadoPagoDetails() {
    if (!isMercadoPago) return null;

    const showPaymentCta =
      presentation.showPaymentCta && Boolean(mercadoPagoCheckoutUrl);
    const showRetry =
      presentation.showRetry
      && paymentActionAllowed;
    const showDynamicInstructions =
      presentation.state === CHECKOUT_PAYMENT_STATES.ACTION_REQUIRED
      && Boolean(paymentInstructions?.instructions);

    if (
      !presentation.panelBody
      && !showPaymentCta
      && !showRetry
      && !retryError
      && !showDynamicInstructions
    ) {
      return null;
    }

    return (
      <div className="checkout-complete-transfer-panel checkout-complete-mercado-pago-panel">
        <h2>{presentation.panelTitle}</h2>
        {presentation.panelBody ? (
          <p className="checkout-complete-copy">
            {presentation.panelBody}
          </p>
        ) : null}
        {retryError ? (
          <p
            className="checkout-complete-copy payment-reference-note offer-sidebar-accent"
            aria-live="polite"
          >
            {retryError}
          </p>
        ) : null}
        {showRetry ? (
          <div className="checkout-complete-actions">
            <button
              type="button"
              className="button button-secondary"
              disabled={retryingPayment}
              onClick={() => void handleMercadoPagoPaymentAction()}
            >
              {retryingPayment ? "Reintentando..." : "Reintentar pago"}
            </button>
          </div>
        ) : null}
        {showPaymentCta ? (
          <div className="checkout-complete-actions">
            <button
              type="button"
              className="button button-primary"
              disabled={retryingPayment}
              onClick={() => void handleMercadoPagoPaymentAction()}
            >
              {presentation.paymentCtaLabel}
            </button>
          </div>
        ) : null}
        {showDynamicInstructions ? (
          <p className="muted-copy checkout-complete-bank-instructions">
            {paymentInstructions.instructions}
          </p>
        ) : null}
      </div>
    );
  }

  if (!completedOrder?.orderNumber) return null;

  return (
    <div className="container page-stack checkout-complete-page">
      <div className="checkout-complete-screen">
        <div className="checkout-fireworks-layer" aria-hidden="true">
          <span className="firework firework--one" />
          <span className="firework firework--two" />
          <span className="firework firework--three" />
          <span className="firework firework--four" />
          <span className="firework firework--five" />
          <span className="firework firework--six" />
        </div>

        <section className="section-card checkout-complete-card">
          <p className="section-kicker">{presentation.kicker}</p>
          <h1>{presentation.title}</h1>
          <p className="checkout-complete-copy" aria-live="polite">
            {presentation.body}
          </p>
          <p className="checkout-complete-order">
            Orden <strong>{completedOrder.orderNumber}</strong>
          </p>
          <CopyValueButton
            value={completedOrder.orderNumber}
            ariaLabel={`Copiar número de orden ${completedOrder.orderNumber}`}
            title="Copiar número de orden"
            successMessage="Número de orden copiado"
            className="button button-secondary"
            style={{ width: "100%", justifyContent: "center" }}
          >
            Copiar número de orden
          </CopyValueButton>

          {renderTransferDetails()}
          {renderMercadoPagoDetails()}

          <p className="checkout-complete-copy">
            Cuando tu orden sea aprobada y despachada, te enviaremos un correo
            de notificación con la información del envío y el código de
            seguimiento, siempre que el proveedor de cadetería o correspondencia
            lo tenga disponible.
          </p>
          <div className="checkout-complete-actions">
            <button
              type="button"
              className="button button-primary"
              onClick={handleCompletionPrimaryAction}
            >
              {presentation.state
                === CHECKOUT_PAYMENT_STATES.CONFIRMED
                ? "Ver mis órdenes"
                : "Aceptar"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
