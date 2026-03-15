import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { formatCurrency } from '../lib/format.js';
import { resolveAssetUrl, apiFetch } from '../lib/api.js';
import { PAYMENT_METHOD_OPTIONS, SHIPPING_METHOD_OPTIONS } from '../constants/lookups.js';

const initialGuest = {
  firstName: '',
  lastName: '',
  birthDate: '',
  email: '',
  address: '',
  phone: '',
  instagram: '',
};

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { items, subtotal, removeItem, updateQuantity, clearCart } = useCart();
  const { user, isAuthenticated } = useAuth();
  const [guest, setGuest] = useState(initialGuest);
  const [shippingMethodId, setShippingMethodId] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const shipping = useMemo(
    () => SHIPPING_METHOD_OPTIONS.find((item) => item.id === Number(shippingMethodId)) || SHIPPING_METHOD_OPTIONS[0],
    [shippingMethodId],
  );

  const payment = PAYMENT_METHOD_OPTIONS.find((item) => item.id === paymentMethod);
  const total = subtotal + Number(shipping?.cost || 0);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!items.length) return;

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
      setSuccess(`Orden ${response.order.orderNumber} creada. Quedó reservada por 24 horas.`);
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      setError(err.message || 'No se pudo crear la orden');
    } finally {
      setSubmitting(false);
    }
  }

  if (!items.length) {
    return (
      <div className="container">
        <div className="section-card centered-card">
          <h1>Tu carro está vacío</h1>
          <p>Cuando agregues prendas aparecerán aquí con resumen de orden.</p>
          <Link className="button button-primary" to="/">Volver al catálogo</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container page-stack">
      <section className="section-card">
        <p className="section-kicker">Resumen de orden</p>
        <h1>Carro + proceso de compra</h1>
        <div className="checkout-grid">
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
                    <button type="button" className="ghost-button" onClick={() => removeItem(item.articleId)}>Quitar</button>
                  </div>
                </div>
                <strong>{formatCurrency(item.discountedPrice * item.quantity)}</strong>
              </div>
            ))}
          </div>

          <form className="checkout-sidebar" onSubmit={handleSubmit}>
            {!isAuthenticated ? (
              <div className="section-card">
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
            ) : (
              <div className="section-card">
                <p className="section-kicker">Comprador autenticado</p>
                <h3>{user.firstName} {user.lastName}</h3>
                <p className="muted-copy">{user.email}</p>
              </div>
            )}

            <div className="section-card">
              <p className="section-kicker">Envío</p>
              <div className="stack-gap-sm">
                {SHIPPING_METHOD_OPTIONS.map((option) => (
                  <label key={option.id} className="radio-card">
                    <input type="radio" name="shippingMethodId" checked={Number(shippingMethodId) === option.id} onChange={() => setShippingMethodId(option.id)} />
                    <div>
                      <strong>{option.label}</strong>
                      <p>{formatCurrency(option.cost)}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="section-card">
              <p className="section-kicker">Pasarela de pago</p>
              <div className="stack-gap-sm">
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <label key={option.id} className="radio-card">
                    <input type="radio" name="paymentMethod" checked={paymentMethod === option.id} onChange={() => setPaymentMethod(option.id)} />
                    <div>
                      <strong>{option.label}</strong>
                      <p>{option.instructions}</p>
                    </div>
                  </label>
                ))}
              </div>
              <label className="field-group">
                <span>Notas</span>
                <textarea className="input textarea" value={notes} onChange={(event) => setNotes(event.target.value)} />
              </label>
              <p className="muted-copy">Orden pendiente de aprobación. La reserva dura 24 horas.</p>
            </div>

            <div className="section-card order-summary-card">
              <p className="summary-line"><span>Subtotal</span><strong>{formatCurrency(subtotal)}</strong></p>
              <p className="summary-line"><span>Envío</span><strong>{formatCurrency(shipping?.cost || 0)}</strong></p>
              <p className="summary-line total"><span>Total</span><strong>{formatCurrency(total)}</strong></p>
              <p className="muted-copy">{payment?.instructions}</p>
              {error ? <p className="error-copy">{error}</p> : null}
              {success ? <p className="success-copy">{success}</p> : null}
              <button className="button button-primary" type="submit" disabled={submitting}>
                {submitting ? 'Creando orden…' : 'Confirmar orden'}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
