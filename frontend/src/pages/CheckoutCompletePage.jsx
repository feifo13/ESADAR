import { useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext.jsx';

const COMPLETE_STORAGE_KEY = 'esadar-checkout-complete';

function readCompletedOrder() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return JSON.parse(window.sessionStorage.getItem(COMPLETE_STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

export default function CheckoutCompletePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { clearCart } = useCart();
  const didCleanupRef = useRef(false);

  const completedOrder = useMemo(
    () => (location.state?.orderNumber ? { orderNumber: location.state.orderNumber } : readCompletedOrder()),
    [location.state?.orderNumber],
  );

  useEffect(() => {
    if (!completedOrder?.orderNumber) {
      navigate('/', { replace: true });
      return;
    }

    if (didCleanupRef.current) {
      return;
    }

    didCleanupRef.current = true;
    clearCart();

    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('esadar-checkout-draft');
    }
  }, [clearCart, completedOrder?.orderNumber, navigate]);

  function handleAccept() {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(COMPLETE_STORAGE_KEY);
    }

    navigate('/', {
      replace: true,
      state: { replayIntro: true, replayIntroReason: 'order-complete' },
    });
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
            Tu orden quedó registrada correctamente y permanece pendiente de validación manual.
          </p>
          <p className="checkout-complete-copy">
            Tienes <strong>24 horas</strong> para completar el pago.
          </p>
          <p className="checkout-complete-order">Orden <strong>{completedOrder.orderNumber}</strong></p>

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
