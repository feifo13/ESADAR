import { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCart } from "../contexts/CartContext.jsx";
import { formatCurrency } from "../lib/format.js";

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

export default function CheckoutCompletePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { clearCart } = useCart();
  const didCleanupRef = useRef(false);

  const completedOrder = useMemo(() => {
    const stored = readCompletedOrder() || {};
    return location.state?.orderNumber
      ? { ...stored, ...location.state }
      : stored.orderNumber
        ? stored
        : null;
  }, [location.state]);

  const paymentInstructions = completedOrder?.paymentInstructions || null;
  const isBankTransfer = paymentInstructions?.method === "BANK_TRANSFER";
  const showTransferDetails = isBankTransfer && paymentInstructions?.enabled;
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
          <p className="checkout-complete-copy">
            Tu orden quedó registrada correctamente y permanece pendiente de
            validación manual.
          </p>
          <p className="checkout-complete-copy">
            Tienes <strong>24 horas</strong> para completar el pago.
          </p>
          <p className="checkout-complete-order">
            Orden <strong>{completedOrder.orderNumber}</strong>
          </p>
          <p className="checkout-complete-copy">
            Cuando tu orden sea aprobada y despachada, te enviaremos un correo
            de notificación con la información del envío y el código de
            seguimiento, siempre que el proveedor de cadetería o correspondencia
            lo tenga disponible.
          </p>

          {renderTransferDetails()}

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
