import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AdminToolbar from '../../components/admin/AdminToolbar.jsx';
import OrderStatusBadge from '../../components/OrderStatusBadge.jsx';
import { apiFetch, resolveAssetUrl } from '../../lib/api.js';
import { formatCurrency, formatDate } from '../../lib/format.js';

export default function AdminOrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  async function loadOrder() {
    try {
      setLoading(true);
      setError('');
      const response = await apiFetch(`/api/admin/orders/${id}`);
      setOrder(response.order);
    } catch (err) {
      setError(err.message || 'No se pudo cargar la orden');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrder();
  }, [id]);

  async function runAction(action) {
    try {
      setError('');
      setMessage('');
      if (action === 'cancel' && !cancelReason.trim()) {
        setError('Escribe un motivo de cancelación.');
        return;
      }

      const path =
        action === 'approve'
          ? `/api/admin/orders/${id}/approve`
          : action === 'ship'
            ? `/api/admin/orders/${id}/ship`
            : `/api/admin/orders/${id}/cancel`;

      const options = {
        method: 'PATCH',
      };

      if (action === 'cancel') {
        options.body = { reason: cancelReason };
      }

      const response = await apiFetch(path, options);
      setOrder(response.order);
      setMessage('La orden fue actualizada correctamente.');
      setCancelReason('');
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la orden');
    }
  }

  if (loading) {
    return <div className="container section-card centered-card">Cargando orden…</div>;
  }

  if (error && !order) {
    return <div className="container section-card error-card">{error}</div>;
  }

  return (
    <div className="container page-stack">
      <AdminToolbar />
      <section className="section-card page-stack">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Orden</p>
            <h1>{order.orderNumber}</h1>
          </div>
          <div className="stack-gap-xs align-end">
            <OrderStatusBadge status={order.orderStatus} />
            <Link to="/admin/orders" className="ghost-button linklike">Volver</Link>
          </div>
        </div>

        <div className="order-detail-grid">
          <div className="page-stack">
            <div className="section-card nested-card">
              <h3>Cliente</h3>
              <p>{order.customer.firstName} {order.customer.lastName}</p>
              <p className="muted-copy">{order.customer.email || 'Sin email'} · {order.customer.phone || 'Sin teléfono'}</p>
              <p className="muted-copy">{order.customer.address || 'Sin dirección'}</p>
            </div>

            <div className="section-card nested-card">
              <h3>Items</h3>
              <div className="admin-list compact-list">
                {order.items.map((item) => (
                  <article key={item.id} className="admin-row-card compact-row">
                    <img src={resolveAssetUrl(item.image)} alt={item.articleTitle} />
                    <div>
                      <h4>{item.articleTitle}</h4>
                      <p className="muted-copy">{item.brandName || 'Sin marca'} · {item.size || 'Sin talle'}</p>
                    </div>
                    <strong>{formatCurrency(item.lineTotal)}</strong>
                  </article>
                ))}
              </div>
            </div>

            <div className="section-card nested-card">
              <h3>Historial</h3>
              <div className="history-list">
                {order.history.map((entry) => (
                  <div key={entry.id} className="history-row">
                    <strong>{entry.toStatus}</strong>
                    <span>{entry.reason}</span>
                    <span>{formatDate(entry.changedAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="page-stack">
            <div className="section-card nested-card">
              <h3>Resumen</h3>
              <p className="summary-line"><span>Subtotal</span><strong>{formatCurrency(order.subtotal)}</strong></p>
              <p className="summary-line"><span>Descuento</span><strong>{formatCurrency(order.discountTotal)}</strong></p>
              <p className="summary-line"><span>Envío</span><strong>{formatCurrency(order.shippingCost)}</strong></p>
              <p className="summary-line total"><span>Total</span><strong>{formatCurrency(order.total)}</strong></p>
              <p className="muted-copy">Creada: {formatDate(order.createdAt)}</p>
              <p className="muted-copy">Aprobada: {formatDate(order.approvedAt)}</p>
              <p className="muted-copy">Enviada: {formatDate(order.shippedAt)}</p>
              <p className="muted-copy">Cancelada: {formatDate(order.cancelledAt)}</p>
            </div>

            {message ? <p className="success-copy">{message}</p> : null}
            {error ? <p className="error-copy">{error}</p> : null}

            <div className="section-card nested-card stack-gap-sm">
              <h3>Acciones</h3>
              {['RESERVED', 'PENDING'].includes(order.orderStatus) ? (
                <>
                  <button type="button" className="button button-primary" onClick={() => runAction('approve')}>Aprobar</button>
                  <label className="field-group">
                    <span>Motivo de cancelación</span>
                    <textarea className="input textarea" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
                  </label>
                  <button type="button" className="button button-secondary" onClick={() => runAction('cancel')}>Cancelar</button>
                </>
              ) : null}

              {order.orderStatus === 'APPROVED' ? (
                <button type="button" className="button button-primary" onClick={() => runAction('ship')}>Marcar enviada</button>
              ) : null}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
