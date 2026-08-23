import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCart } from "../contexts/CartContext.jsx";
import { formatCurrency } from "../lib/format.js";
import { apiFetch } from "../lib/api.js";
import { getFriendlyErrorMessage } from "../lib/validation.js";
import CopyValueButton from "../components/CopyValueButton.jsx";

const COMPLETE_STORAGE_KEY = "esadar-checkout-complete";

function readCompletedOrder() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return JSON.parse(
      window.sessionStorage.getItem(COMPLETE_STORAGE_KEY) || "null",
    );
  } catch {
    return null;
  }
}

function getInstructionField(paymentInstructions, label) {
  const normalizedLabel = String(label || "")
    .trim()
    .toLowerCase();
  return (paymentInstructions?.fields || []).find(
    (field) =>
      String(field.label || "")
        .trim()
        .toLowerCase() === normalizedLabel,
  );
}

function getPaymentFieldValue(paymentInstructions, label) {
  return getInstructionField(paymentInstructions, label)?.value || "";
}

function isPrexTransfer(paymentInstructions) {
  const haystack = [
    paymentInstructions?.label,
    paymentInstructions?.title,
    getPaymentFieldValue(paymentInstructions, "Banco"),
    paymentInstructions?.instructions,
  ]
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return haystack.includes("prex");
}

const MERCADO_PAGO_RETURN_RESULTS = new Set([
  "success",
  "failure",
  "pending",
]);

function getMercadoPagoReturnResult(search) {
  const params = new URLSearchParams(String(search || ""));
  const result = params.get("mp_result");

  return MERCADO_PAGO_RETURN_RESULTS.has(result)
    ? result
    : null;
}

function getMercadoPagoReturnPaymentId(search) {
  const params =
    new URLSearchParams(
      String(search || ""),
    );

  const paymentId =
    String(
      params.get("payment_id")
      || "",
    ).trim();

  return /^\d{1,40}$/.test(paymentId)
    ? paymentId
    : "";
}

function getSafeMercadoPagoCheckoutUrl(value) {
  try {
    const url = new URL(String(value || "").trim());

    return url.protocol === "https:"
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

function getMercadoPagoReturnMessage(result) {
  if (result === "success") {
    return (
      "Volviste de Mercado Pago. Esto no significa que el pago ya esté "
      + "confirmado: estamos esperando la confirmación automática del pago."
    );
  }

  if (result === "pending") {
    return (
      "Volviste de Mercado Pago con una operación pendiente. "
      + "Tu orden seguirá pendiente hasta que recibamos la confirmación del pago."
    );
  }

  if (result === "failure") {
    return (
      "El pago no se completó en Mercado Pago. Tu orden sigue registrada "
      + "y podés volver a intentar el pago mientras el enlace esté disponible."
    );
  }

  return null;
}

export default function CheckoutCompletePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { clearCart } = useCart();
  const didCleanupRef = useRef(false);

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
    useState({
      status: "idle",
      message: "",
    });
  const didMercadoPagoVerificationRef =
    useRef("");

  const paymentInstructions = completedOrder?.paymentInstructions || null;
  const isBankTransfer = paymentInstructions?.method === "BANK_TRANSFER";
  const showTransferDetails = isBankTransfer && paymentInstructions?.enabled;

  const isMercadoPago =
    paymentInstructions?.method === "MERCADO_PAGO";

  const mercadoPagoCheckoutUrl = isMercadoPago
    ? getSafeMercadoPagoCheckoutUrl(paymentInstructions?.checkoutUrl)
    : "";

  const mercadoPagoReturnResult = isMercadoPago
    ? getMercadoPagoReturnResult(location.search)
    : null;

  const mercadoPagoReturnPaymentId = isMercadoPago
    ? getMercadoPagoReturnPaymentId(location.search)
    : "";

  const mercadoPagoConfirmed =
    mercadoPagoVerification.status === "confirmed";

  const mercadoPagoAwaitingConfirmation =
    !mercadoPagoConfirmed
    && (
      mercadoPagoReturnResult === "success"
      || mercadoPagoReturnResult === "pending"
    );

  const mercadoPagoReady =
    isMercadoPago
    && paymentInstructions?.enabled === true
    && paymentInstructions?.status === "READY"
    && Boolean(mercadoPagoCheckoutUrl);

  const showMercadoPagoCheckout =
    mercadoPagoReady
    && !mercadoPagoAwaitingConfirmation
    && !mercadoPagoConfirmed;

  const mercadoPagoUnavailable =
    isMercadoPago
    && !mercadoPagoConfirmed
    && !mercadoPagoReady;

  const paymentRetryToken = String(
    completedOrder?.paymentRetryToken || "",
  ).trim();

  const mercadoPagoRetryAvailable =
    mercadoPagoUnavailable
    && paymentInstructions?.retryable === true
    && Number.isInteger(Number(completedOrder?.orderId))
    && Number(completedOrder?.orderId) > 0
    && /^[a-f0-9]{64}$/i.test(paymentRetryToken);

  const transferLabel = isPrexTransfer(paymentInstructions)
    ? "Transferencia Prex"
    : "Transferencia bancaria";
  const transferReference = completedOrder?.orderNumber
    ? `${completedOrder.orderNumber}`
    : "ESADAR";

  useEffect(() => {
    if (!completedOrder?.orderNumber) {
      navigate("/", { replace: true });
      return;
    }

    if (didCleanupRef.current) {
      return;
    }

    didCleanupRef.current = true;
    clearCart();

    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("esadar-checkout-draft");
    }
  }, [clearCart, completedOrder?.orderNumber, navigate]);

  useEffect(() => {
    const orderId =
      Number(
        completedOrder?.orderId
        || 0,
      );

    const canVerify =
      isMercadoPago
      && (
        mercadoPagoReturnResult === "success"
        || mercadoPagoReturnResult === "pending"
      )
      && Number.isInteger(orderId)
      && orderId > 0
      && /^\d{1,40}$/.test(
        mercadoPagoReturnPaymentId,
      )
      && /^[a-f0-9]{64}$/i.test(
        paymentRetryToken,
      );

    if (!canVerify) {
      return undefined;
    }

    const attemptKey =
      [
        orderId,
        mercadoPagoReturnPaymentId,
        paymentRetryToken,
      ].join(":");

    if (
      didMercadoPagoVerificationRef.current
      === attemptKey
    ) {
      return undefined;
    }

    didMercadoPagoVerificationRef.current =
      attemptKey;

    let cancelled = false;

    setMercadoPagoVerification({
      status: "checking",
      message:
        "Estamos verificando el pago directamente con Mercado Pago.",
    });

    apiFetch(
      `/api/public/orders/${encodeURIComponent(
        orderId,
      )}/payment/mercado-pago/reconcile`,
      {
        method: "POST",
        body: {
          paymentId:
            mercadoPagoReturnPaymentId,
          retryToken:
            paymentRetryToken,
        },
      },
    )
      .then((response) => {
        if (cancelled) return;

        const sameOrder =
          Number(response?.orderId)
            === orderId
          && String(
            response?.orderNumber
            || "",
          ) === String(
            completedOrder?.orderNumber
            || "",
          );

        if (!sameOrder) {
          throw new Error(
            "No pudimos validar la identidad de la orden.",
          );
        }

        if (
          response?.confirmed === true
          && response?.paymentStatus === "PAID"
        ) {
          setMercadoPagoVerification({
            status: "confirmed",
            message:
              "Mercado Pago confirmó el pago de tu orden.",
          });
          return;
        }

        setMercadoPagoVerification({
          status: "pending",
          message:
            "Mercado Pago todavía no confirmó el pago. Seguiremos esperando la confirmación automática.",
        });
      })
      .catch((error) => {
        if (cancelled) return;

        setMercadoPagoVerification({
          status: "error",
          message:
            getFriendlyErrorMessage(
              error,
              "No pudimos verificar el pago en este momento. La orden seguirá esperando la confirmación automática.",
            ),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    completedOrder?.orderId,
    completedOrder?.orderNumber,
    isMercadoPago,
    mercadoPagoReturnPaymentId,
    mercadoPagoReturnResult,
    paymentRetryToken,
  ]);

  async function handleRetryMercadoPagoPayment() {
    if (
      !mercadoPagoRetryAvailable
      || retryingPayment
    ) {
      return;
    }

    setRetryingPayment(true);
    setRetryError("");

    try {
      const response = await apiFetch(
        `/api/public/orders/${encodeURIComponent(
          completedOrder.orderId,
        )}/payment/retry`,
        {
          method: "POST",
          body: {
            retryToken: paymentRetryToken,
          },
        },
      );

      const nextPaymentInstructions =
        response?.paymentInstructions || null;

      const sameOrder =
        Number(response?.orderId)
          === Number(completedOrder.orderId)
        && String(response?.orderNumber || "")
          === String(completedOrder.orderNumber || "");

      if (
        !sameOrder
        || nextPaymentInstructions?.method
          !== "MERCADO_PAGO"
      ) {
        throw new Error(
          "No pudimos validar el reintento de pago.",
        );
      }

      const nextCompletedOrder = {
        ...completedOrder,
        paymentInstructions:
          nextPaymentInstructions,
      };

      setCompletedOrder(
        nextCompletedOrder,
      );

      if (
        typeof window !== "undefined"
      ) {
        window.sessionStorage.setItem(
          COMPLETE_STORAGE_KEY,
          JSON.stringify(
            nextCompletedOrder,
          ),
        );
      }
    } catch (error) {
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

  function handleAccept() {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(COMPLETE_STORAGE_KEY);
      window.dispatchEvent(
        new CustomEvent("esadar:suppress-footer-reveal", {
          detail: { release: true },
        }),
      );
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
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
        <p className="section-kicker">Pago pendiente</p>
        <h2>{transferLabel}</h2>
        <p className="checkout-complete-copy">
          Para completar la compra, realizá la transferencia con los datos de
          cobro configurados en ESADAR. Estos datos también serán enviados por
          correo para que los tengas a mano.
        </p>
        <p className="checkout-complete-copy payment-reference-note offer-sidebar-accent">
          Importante
        </p>
        <p className="checkout-complete-copy">
          <strong>
            En el motivo/concepto de la transferencia escribí tu número de
            orden:{" "}
          </strong>
        </p>
        <p className="checkout-complete-copy payment-reference-note">
          {completedOrder.orderNumber}
        </p>
        <CopyValueButton
          value={completedOrder.orderNumber}
          ariaLabel={`Copiar número de orden ${completedOrder.orderNumber}`}
          title="Copiar número de orden"
          successMessage="Número de orden copiado"
          className="button button-secondary"
          style={{ width: "100%", justifyContent: "center" }}
        >
          Copiar código de compra
        </CopyValueButton>

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

          <div className="checkout-complete-payment-row">
            <span>Referencia</span>
            <strong>{transferReference}</strong>
          </div>
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

    const returnMessage =
      mercadoPagoVerification.message
      || getMercadoPagoReturnMessage(
        mercadoPagoReturnResult,
      );

    return (
      <div className="checkout-complete-transfer-panel checkout-complete-mercado-pago-panel">
        <p className="section-kicker">
          {mercadoPagoConfirmed
            ? "Pago confirmado"
            : mercadoPagoAwaitingConfirmation
              ? "Verificando pago"
              : "Pago pendiente"}
        </p>

        <h2>Mercado Pago</h2>

        {returnMessage ? (
          <p
            className="checkout-complete-copy payment-reference-note offer-sidebar-accent"
            aria-live="polite"
          >
            {returnMessage}
          </p>
        ) : (
          <p className="checkout-complete-copy">
            Para completar la compra, continuá hacia Mercado Pago.
            Al regresar, ESADAR seguirá esperando la confirmación
            automática del pago antes de marcar la orden como pagada.
          </p>
        )}

        {mercadoPagoUnavailable ? (
          <>
            <p className="checkout-complete-copy payment-reference-note offer-sidebar-accent">
              Enlace de pago temporalmente no disponible
            </p>

            <p className="checkout-complete-copy">
              {paymentInstructions?.instructions
                || (
                  "Tu orden quedó registrada correctamente, pero no pudimos "
                  + "generar el enlace de Mercado Pago en este momento."
                )}
            </p>

            {retryError ? (
              <p
                className="checkout-complete-copy payment-reference-note offer-sidebar-accent"
                aria-live="polite"
              >
                {retryError}
              </p>
            ) : null}

            {mercadoPagoRetryAvailable ? (
              <div className="checkout-complete-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={retryingPayment}
                  onClick={() => void handleRetryMercadoPagoPayment()}
                >
                  {retryingPayment
                    ? "Reintentando..."
                    : "Reintentar pago"}
                </button>
              </div>
            ) : null}
          </>
        ) : null}

        {showMercadoPagoCheckout ? (
          <div className="checkout-complete-actions">
            <a
              className="button button-primary"
              href={mercadoPagoCheckoutUrl}
            >
              Pagar con Mercado Pago
            </a>
          </div>
        ) : null}

        {!mercadoPagoConfirmed
        && !mercadoPagoUnavailable
        && paymentInstructions?.instructions ? (
          <p className="muted-copy checkout-complete-bank-instructions">
            {paymentInstructions.instructions}
          </p>
        ) : null}
      </div>
    );
  }

  if (!completedOrder?.orderNumber) {
    return null;
  }

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
          <p className="section-kicker">Compra confirmada</p>
          <h1>Muchas gracias por tu compra</h1>
          {mercadoPagoConfirmed ? (
            <p className="checkout-complete-copy">
              Tu orden quedó registrada correctamente y el pago fue confirmado por Mercado Pago.
            </p>
          ) : (
            <>
              <p className="checkout-complete-copy">
                Tu orden quedó registrada correctamente y permanece pendiente de
                validación.
              </p>
              <p className="checkout-complete-copy">
                Tienes <strong>24 horas</strong> para completar el pago.
              </p>
            </>
          )}
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
            Copiar código de compra
          </CopyValueButton>
          <p className="checkout-complete-copy">
            Cuando tu orden sea aprobada y despachada, te enviaremos un correo
            de notificación con la información del envío y el código de
            seguimiento, siempre que el proveedor de cadetería o correspondencia
            lo tenga disponible.
          </p>

          {renderTransferDetails()}
          {renderMercadoPagoDetails()}

          <div className="checkout-complete-actions">
            <button
              type="button"
              className="button button-primary"
              onClick={handleAccept}
            >
              Aceptar
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
