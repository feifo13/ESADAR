import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { formatCurrency } from '../lib/format.js';
import { resolveAssetUrl, apiFetch } from '../lib/api.js';
import { PAYMENT_METHOD_OPTIONS, SHIPPING_METHOD_OPTIONS } from '../constants/lookups.js';

const STORAGE_KEY = 'esadar-checkout-draft';

const initialGuest = {
  firstName: '',
  lastName: '',
  birthDate: '',
  email: '',
  address: '',
  phone: '',
  instagram: '',
};

const steps = [
  { key: 'resumen', label: 'Resumen de compra', kicker: 'Paso 1' },
  { key: 'comprador', label: 'Datos de comprador', kicker: 'Paso 2' },
  { key: 'pago', label: 'Método de pago', kicker: 'Paso 3' },
  { key: 'envio', label: 'Método de envío', kicker: 'Paso 4' },
  { key: 'confirmacion', label: 'Orden pendiente de aprobación', kicker: 'Paso 5' },
];

function readDraft() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { items, subtotal, removeItem, updateQuantity, clearCart } = useCart();
  const { user, isAuthenticated } = useAuth();

  const savedDraft = readDraft();
  const [guest, setGuest] = useState(savedDraft?.guest || initialGuest);
  const [shippingMethodId, setShippingMethodId] = useState(savedDraft?.shippingMethodId || 1);
  const [paymentMethod, setPaymentMethod] = useState(savedDraft?.paymentMethod || 'BANK_TRANSFER');
  const [notes, setNotes] = useState(savedDraft?.notes || '');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currentStepKey = location.pathname.split('/')[2] || 'resumen';
  const currentStepIndex = Math.max(0, steps.findIndex((step) => step.key === currentStepKey));
  const currentStep = steps[currentStepIndex] || steps[0];

  const shipping = useMemo(
    () => SHIPPING_METHOD_OPTIONS.find((item) => item.id === Number(shippingMethodId)) || SHIPPING_METHOD_OPTIONS[0],
    [shippingMethodId],
  );

  const payment = PAYMENT_METHOD_OPTIONS.find((item) => item.id === paymentMethod);
  const total = subtotal + Number(shipping?.cost || 0);

  const buyerComplete = isAuthenticated
    || (guest.firstName.trim().length >= 2 && guest.lastName.trim().length >= 2);
  const paymentComplete = Boolean(paymentMethod);
  const shippingComplete = Boolean(shippingMethodId);

  const completion = {
    resumen: items.length > 0,
    comprador: buyerComplete,
    pago: paymentComplete,
    envio: shippingComplete,
    confirmacion: items.length > 0 && buyerComplete && paymentComplete && shippingComplete,
  };

  const maxAllowedStepIndex = useMemo(() => {
    let allowed = 0;
    if (!completion.resumen) return 0;
    allowed = 1;
    if (!completion.comprador) return allowed;
    allowed = 2;
    if (!completion.pago) return allowed;
    allowed = 3;
    if (!completion.envio) return allowed;
    return 4;
  }, [completion]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ guest, shippingMethodId, paymentMethod, notes }),
    );
  }, [guest, shippingMethodId, paymentMethod, notes]);

  useEffect(() => {
    if (!items.length && currentStepKey !== 'resumen') {
      navigate('/checkout/resumen', { replace: true });
      return;
    }

    if (currentStepIndex > maxAllowedStepIndex) {
      navigate(`/checkout/${steps[maxAllowedStepIndex].key}`, { replace: true });
    }
  }, [items.length, currentStepIndex, currentStepKey, maxAllowedStepIndex, navigate]);

  function goToStep(index) {
    if (index > maxAllowedStepIndex) return;
    navigate(`/checkout/${steps[index].key}`);
  }

  function validateCurrentStep() {
    setError('');

    if (currentStepKey === 'resumen' && !items.length) {
      setError('Tu carro está vacío.');
      return false;
    }

    if (currentStepKey === 'comprador' && !buyerComplete) {
      setError('Completa al menos nombre y apellido del comprador para continuar.');
      return false;
    }

    if (currentStepKey === 'pago' && !paymentComplete) {
      setError('Selecciona un medio de pago para continuar.');
      return false;
    }

    if (currentStepKey === 'envio' && !shippingComplete) {
      setError('Selecciona un método de envío para continuar.');
      return false;
    }

    return true;
  }

  function handleNext() {
    if (!validateCurrentStep()) return;
    const nextIndex = Math.min(currentStepIndex + 1, steps.length - 1);
    navigate(`/checkout/${steps[nextIndex].key}`);
  }

  function handleBack() {
    const previousIndex = Math.max(currentStepIndex - 1, 0);
    navigate(`/checkout/${steps[previousIndex].key}`);
  }

  async function handleConfirmOrder() {
    if (!completion.confirmacion || !items.length) {
      setError('Completa los pasos previos antes de confirmar la orden.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setSuccess('');

      const payload = {
        shippingMethodId: Number(shippingMethodId),
        paymentMethod,
        notes: notes || null,
        items: items.map((item) => ({ articleId: item.articleId, quantity: item.quantity })),
      };

      if (!isAuthenticated) {
        payload.guest = {
          ...guest,
          birthDate: guest.birthDate || null,
          email: guest.email || null,
          address: guest.address || null,
          phone: guest.phone || null,
          instagram: guest.instagram || null,
        };
      }

      const response = await apiFetch('/api/public/orders', {
        method: 'POST',
        body: payload,
      });

      clearCart();
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(STORAGE_KEY);
      }
      setSuccess(`Orden ${response.order.orderNumber} creada. Será redirigido al inicio.`);
      setTimeout(() => navigate('/'), 1800);
    } catch (err) {
      setError(err.message || 'No se pudo crear la orden');
    } finally {
      setSubmitting(false);
    }
  }

  function renderSummaryStep() {
    return (
      <div className="checkout-step-grid">
        <div className="checkout-items-block section-card nested-card">
          <div className="section-heading compact-heading">
            <div>
              <p className="section-kicker">Resumen</p>
              <h2>Prendas en la orden</h2>
            </div>
          </div>

          <div className="checkout-items">
            {items.map((item) => (
              <div key={item.articleId} className="checkout-item">
                <img src={resolveAssetUrl(item.image)} alt={item.title} />
                <div>
                  <p className="checkout-item-title">{item.title}</p>
                  <p className="muted-copy">{item.brandName || 'Sin marca'} {item.sizeLabel ? `· ${item.sizeLabel}` : ''}</p>
                  <div className="quantity-row">
                    <label>
                      Cantidad
                      <input
                        className="input input-small"
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(event) => updateQuantity(item.articleId, Number(event.target.value || 1))}
                      />
                    </label>
                    <button type="button" className="ghost-button" onClick={() => removeItem(item.articleId)}>
                      Quitar
                    </button>
                  </div>
                </div>
                <strong>{formatCurrency(item.discountedPrice * item.quantity)}</strong>
              </div>
            ))}
          </div>
        </div>

        <aside className="checkout-side-summary section-card nested-card">
          <p className="section-kicker">Totales</p>
          <div className="order-summary-card checkout-summary-plain">
            <p className="summary-line"><span>Subtotal</span><strong>{formatCurrency(subtotal)}</strong></p>
            <p className="summary-line"><span>Envío estimado</span><strong>{formatCurrency(shipping?.cost || 0)}</strong></p>
            <p className="summary-line total"><span>Total estimado</span><strong>{formatCurrency(total)}</strong></p>
          </div>
        </aside>
      </div>
    );
  }

  function renderBuyerStep() {
    if (isAuthenticated) {
      return (
        <div className="section-card nested-card">
          <p className="section-kicker">Comprador autenticado</p>
          <h2>{user.firstName} {user.lastName}</h2>
          <div className="detail-meta-list checkout-meta-list">
            <div><span>Email</span><strong>{user.email || 'Sin email'}</strong></div>
            <div><span>Teléfono</span><strong>{user.phone || 'Sin teléfono'}</strong></div>
            <div><span>Instagram</span><strong>{user.instagram || 'Sin Instagram'}</strong></div>
          </div>
          <p className="muted-copy">La orden se generará con esta cuenta.</p>
        </div>
      );
    }

    return (
      <div className="section-card nested-card">
        <p className="section-kicker">Datos del comprador</p>
        <div className="form-grid-two">
          <label className="field-group"><span>Nombre</span><input className="input" value={guest.firstName} onChange={(event) => setGuest((current) => ({ ...current, firstName: event.target.value }))} required /></label>
          <label className="field-group"><span>Apellido</span><input className="input" value={guest.lastName} onChange={(event) => setGuest((current) => ({ ...current, lastName: event.target.value }))} required /></label>
          <label className="field-group"><span>Fecha de nacimiento</span><input className="input" type="date" value={guest.birthDate} onChange={(event) => setGuest((current) => ({ ...current, birthDate: event.target.value }))} /></label>
          <label className="field-group"><span>Teléfono</span><input className="input" value={guest.phone} onChange={(event) => setGuest((current) => ({ ...current, phone: event.target.value }))} /></label>
          <label className="field-group form-grid-span-two"><span>Dirección</span><input className="input" value={guest.address} onChange={(event) => setGuest((current) => ({ ...current, address: event.target.value }))} /></label>
          <label className="field-group"><span>Instagram</span><input className="input" value={guest.instagram} onChange={(event) => setGuest((current) => ({ ...current, instagram: event.target.value }))} /></label>
          <label className="field-group"><span>Email</span><input className="input" type="email" value={guest.email} onChange={(event) => setGuest((current) => ({ ...current, email: event.target.value }))} /></label>
        </div>
        <p className="muted-copy">Puedes comprar sin usuario o <Link to="/login">ingresar</Link> para usar tu cuenta.</p>
      </div>
    );
  }

  function renderPaymentStep() {
    return (
      <div className="section-card nested-card">
        <p className="section-kicker">Medio seleccionado</p>
        <div className="stack-gap-sm">
          {PAYMENT_METHOD_OPTIONS.map((option) => (
            <label key={option.id} className="radio-card radio-card-plain">
              <input type="radio" name="paymentMethod" checked={paymentMethod === option.id} onChange={() => setPaymentMethod(option.id)} />
              <div>
                <strong>{option.label}</strong>
                <p>{option.instructions}</p>
              </div>
            </label>
          ))}
        </div>
        <label className="field-group checkout-notes">
          <span>Notas</span>
          <textarea className="input textarea" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
      </div>
    );
  }

  function renderShippingStep() {
    return (
      <div className="section-card nested-card">
        <p className="section-kicker">Envío</p>
        <div className="stack-gap-sm">
          {SHIPPING_METHOD_OPTIONS.map((option) => (
            <label key={option.id} className="radio-card radio-card-plain">
              <input type="radio" name="shippingMethodId" checked={Number(shippingMethodId) === option.id} onChange={() => setShippingMethodId(option.id)} />
              <div>
                <strong>{option.label}</strong>
                <p>{formatCurrency(option.cost)}</p>
                <p className="muted-copy">{option.instructions}</p>
              </div>
            </label>
          ))}
        </div>
      </div>
    );
  }

  function renderConfirmationStep() {
    return (
      <div className="checkout-confirmation-grid">
        <div className="section-card nested-card checkout-confirm-panel">
          <p className="section-kicker">Orden pendiente de aprobación</p>
          <div className="detail-meta-list checkout-meta-list">
            <div><span>Artículos</span><strong>{items.length}</strong></div>
            <div><span>Comprador</span><strong>{isAuthenticated ? `${user.firstName} ${user.lastName}` : `${guest.firstName} ${guest.lastName}`}</strong></div>
            <div><span>Medio de pago</span><strong>{payment?.label}</strong></div>
            <div><span>Método de envío</span><strong>{shipping?.label}</strong></div>
            <div><span>Instrucciones de pago</span><strong>{payment?.instructions}</strong></div>
            <div><span>Entrega</span><strong>{shipping?.instructions}</strong></div>
          </div>
          <p className="muted-copy">La reserva dura 24 horas y la orden será validada manualmente desde backoffice.</p>
        </div>

        <aside className="section-card nested-card checkout-confirm-summary">
          <p className="summary-line"><span>Subtotal</span><strong>{formatCurrency(subtotal)}</strong></p>
          <p className="summary-line"><span>Envío</span><strong>{formatCurrency(shipping?.cost || 0)}</strong></p>
          <p className="summary-line total"><span>Total</span><strong>{formatCurrency(total)}</strong></p>
          {notes ? <p className="muted-copy">Notas: {notes}</p> : null}
        </aside>
      </div>
    );
  }

  function renderCurrentStep() {
    if (currentStepKey === 'comprador') return renderBuyerStep();
    if (currentStepKey === 'pago') return renderPaymentStep();
    if (currentStepKey === 'envio') return renderShippingStep();
    if (currentStepKey === 'confirmacion') return renderConfirmationStep();
    return renderSummaryStep();
  }

  if (!items.length) {
    return (
      <div className="container">
        <div className="section-card centered-card checkout-empty-card">
          <h1>Tu carro está vacío</h1>
          <p>Cuando agregues prendas aparecerán aquí con resumen de orden.</p>
          <Link className="button button-primary" to="/">Volver al catálogo</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container page-stack checkout-page-stack">
      <section className="section-card checkout-shell">
        <div className="checkout-shell-header">
          <div>
            <p className="section-kicker">Proceso de compra</p>
            <h1>{currentStep.label}</h1>
          </div>
          <p className="muted-copy checkout-shell-copy">Paso {currentStepIndex + 1} de {steps.length}</p>
        </div>

        <div className="checkout-steps-row">
          {steps.map((step, index) => {
            const isActive = index === currentStepIndex;
            const isEnabled = index <= maxAllowedStepIndex;
            const isDone = index < currentStepIndex && index <= maxAllowedStepIndex;

            return (
              <button
                key={step.key}
                type="button"
                className={`checkout-step-chip${isActive ? ' active' : ''}${isDone ? ' done' : ''}`}
                disabled={!isEnabled}
                onClick={() => goToStep(index)}
              >
                <span>{step.kicker}</span>
                <strong>{step.label}</strong>
              </button>
            );
          })}
        </div>

        {renderCurrentStep()}

        <div className="checkout-navigation">
          <button
            type="button"
            className="button button-secondary"
            onClick={handleBack}
            disabled={currentStepIndex === 0 || submitting}
          >
            Anterior
          </button>

          <div className="checkout-navigation-status">
            {error ? <p className="error-copy">{error}</p> : null}
            {success ? <p className="success-copy">{success}</p> : null}
          </div>

          {currentStepKey === 'confirmacion' ? (
            <button
              type="button"
              className="button button-primary"
              onClick={handleConfirmOrder}
              disabled={submitting}
            >
              {submitting ? 'Creando orden…' : 'Confirmar orden'}
            </button>
          ) : (
            <button type="button" className="button button-primary" onClick={handleNext}>
              Siguiente
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
