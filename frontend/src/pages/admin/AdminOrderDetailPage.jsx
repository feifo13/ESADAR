import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AdminToolbar from '../../components/admin/AdminToolbar.jsx';
import OrderStatusBadge from '../../components/OrderStatusBadge.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import SummaryItemCard from '../../components/SummaryItemCard.jsx';
import { DownloadIcon } from '../../components/ActionIcons.jsx';
import { useNotification } from '../../contexts/NotificationContext.jsx';
import { apiDownload, apiFetch } from '../../lib/api.js';
import { formatCurrency, formatDate } from '../../lib/format.js';
import { formatPaymentMethod } from '../../lib/paymentMethods.js';
import { formatWeightKg } from '../../lib/shippingRates.js';
import AppLoader from "../../components/AppLoader.jsx";

const HISTORY_STATUS_LABELS = {
  RESERVED: 'Reservada',
  PENDING: 'Pendiente',
  APPROVED: 'Aprobada',
  SHIPPED: 'Enviada',
  CANCELLED: 'Cancelada',
  EXPIRED: 'Vencida',
};

const PAYMENT_STATUS_LABELS = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  FAILED: 'Fallido',
  REFUNDED: 'Reintegrado',
  PAID: 'Pagado',
};

function getHistoryMetadata(entry) {
  const metadata = entry?.metadataJson ?? entry?.metadata ?? null;
  if (!metadata) return {};
  if (typeof metadata === 'object') return metadata;
  try {
    return JSON.parse(metadata);
  } catch {
    return {};
  }
}

function isTrackingHistoryEntry(entry) {
  return entry?.eventType === 'TRACKING_UPDATED';
}

function getTrackingHistoryDetails(entry, order) {
  const metadata = getHistoryMetadata(entry);
  const trackingCode = String(metadata.trackingCode || '').trim();
  return {
    trackingCode,
    shippingMethod:
      metadata.shippingMethod ||
      order?.shippingMethodDescription ||
      order?.shippingMethodName ||
      'Sin datos',
    isCleared: !trackingCode,
  };
}

export default function AdminOrderDetailPage() {
  const { id } = useParams();
  const { notifySuccess, notifyError } = useNotification();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [trackingCode, setTrackingCode] = useState('');
  const [trackingSubmitting, setTrackingSubmitting] = useState(false);

  async function loadOrder() {
    try {
      setLoading(true);
      setError('');
      const response = await apiFetch(`/api/admin/orders/${id}`);
      setOrder(response.order);
      setTrackingCode(response.order?.trackingCode || '');
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
        const errorMessage = 'Escribe un motivo de cancelacion.';
        setError(errorMessage);
        notifyError(errorMessage);
        return;
      }

      const path =
        action === 'approve'
          ? `/api/admin/orders/${id}/approve`
          : action === 'ship'
            ? `/api/admin/orders/${id}/ship`
            : `/api/admin/orders/${id}/cancel`;

      const options = { method: 'PATCH' };

      if (action === 'cancel') {
        options.body = { reason: cancelReason };
      }

      const response = await apiFetch(path, options);
      setOrder(response.order);
      const successMessage =
        action === 'cancel' && response.order?.hasOffers
          ? 'La orden fue cancelada y el intento de oferta quedó consumido.'
          : 'La orden fue actualizada correctamente.';
      setMessage(successMessage);
      notifySuccess(successMessage);
      setCancelReason('');
    } catch (err) {
      const errorMessage = err.message || 'No se pudo actualizar la orden';
      setError(errorMessage);
      notifyError(errorMessage);
    }
  }


  async function handleDownloadPdf() {
    try {
      setError('');
      await apiDownload(`/api/admin/orders/${id}/receipt.pdf`, {
        fileName: `boleta-${order?.orderNumber || id}.pdf`,
        extension: 'pdf',
      });
    } catch (err) {
      const errorMessage = err.message || 'No se pudo descargar el PDF de la orden';
      setError(errorMessage);
      notifyError(errorMessage);
    }
  }

  async function handleRegisterPayment() {
    try {
      setPaymentSubmitting(true);
      setError('');
      setMessage('');
      const response = await apiFetch(`/api/admin/orders/${id}/payments`, {
        method: 'POST',
        body: {},
      });
      setOrder(response.order);
      const successMessage = 'El pago interno quedo registrado.';
      setMessage(successMessage);
      notifySuccess(successMessage);
    } catch (err) {
      const errorMessage = err.message || 'No se pudo registrar el pago';
      setError(errorMessage);
      notifyError(errorMessage);
    } finally {
      setPaymentSubmitting(false);
    }
  }

  async function handleSaveTracking(event) {
    event.preventDefault();

    try {
      setTrackingSubmitting(true);
      setError('');
      setMessage('');
      const response = await apiFetch(`/api/admin/orders/${id}/tracking`, {
        method: 'PATCH',
        body: { trackingCode },
      });
      setOrder(response.order);
      setTrackingCode(response.order?.trackingCode || '');
      const successMessage = response.order?.trackingCode
        ? 'Codigo de seguimiento guardado.'
        : 'Codigo de seguimiento limpiado.';
      setMessage(successMessage);
      notifySuccess(successMessage);
    } catch (err) {
      const errorMessage = err.message || 'No se pudo guardar el seguimiento';
      setError(errorMessage);
      notifyError(errorMessage);
    } finally {
      setTrackingSubmitting(false);
    }
  }

  if (loading) {
    return <div className="container section-card centered-card"><AppLoader variant="card" label="Cargando orden" /></div>;
  }

  if (error && !order) {
    return <div className="container section-card error-card">{error}</div>;
  }

  return (
    <div className="container page-stack admin-page-shell">
      <AdminToolbar />
      <section className="section-card page-stack admin-order-detail-shell">
        <div className="section-card nested-card page-stack admin-order-detail-hero-card">
          <div className="section-heading admin-order-detail-titlebar">
          <div>
            <p className="section-kicker">Orden</p>
            <h1>{order.orderNumber}</h1>
          </div>
          <div className="inline-action-group admin-order-hero-actions">
            {order.hasOffers ? <span className="pill pill-offer">{order.offerCount || 1} oferta{Number(order.offerCount || 1) === 1 ? "" : "s"}</span> : null}
            <OrderStatusBadge status={order.orderStatus} />
            <button
              type="button"
              className="ghost-button admin-icon-action"
              onClick={handleDownloadPdf}
              title="Descargar PDF"
            >
              <DownloadIcon />
              <span className="admin-action-label">Descargar PDF</span>
            </button>
            <Link to="/admin/orders" className="ghost-button linklike">Volver</Link>
          </div>
          </div>

          <div className="admin-detail-meta account-order-detail-meta admin-order-detail-meta">
          <p className="summary-line">
            <span>Creada</span>
            <strong>{formatDate(order.createdAt)}</strong>
          </p>
          <p className="summary-line">
            <span>Pago</span>
            <strong><StatusBadge status={order.paymentStatus} labels={PAYMENT_STATUS_LABELS} /></strong>
          </p>
          <p className="summary-line">
            <span>Método</span>
            <strong>{formatPaymentMethod(order.paymentMethod)}</strong>
          </p>
          <p className="summary-line">
            <span>Envío</span>
            <strong>{order.shippingMethodDescription || order.shippingMethodName || "Sin datos"}</strong>
          </p>
          <p className="summary-line">
            <span>Seguimiento</span>
            <strong>{order.trackingCode || "Sin cargar"}</strong>
          </p>
          <p className="summary-line total">
            <span>Total</span>
            <strong>{formatCurrency(order.total)}</strong>
          </p>
          </div>
        </div>

        <div className="order-detail-grid admin-order-detail-grid">
          <div className="page-stack admin-order-detail-main">
            <div className="section-card nested-card page-stack">
              <div className="section-heading">
                <div>
                  <p className="section-kicker">Prendas</p>
                  <h3>Resumen de la orden</h3>
                </div>
              </div>
              <div className="summary-item-card-list account-order-items-card-list">
                {order.items.map((item) => (
                  <SummaryItemCard
                    key={item.id}
                    readOnly
                    item={{
                      articleId: item.articleId || item.id,
                      slug: item.articleSlug || item.articleId,
                      title: item.articleTitle,
                      image: item.image,
                      brandName: item.brandName,
                      sizeLabel: item.size,
                      quantity: item.quantity,
                      maxQuantity: item.quantity,
                      salePrice: item.salePrice || item.finalUnitPrice,
                      discountedPrice: item.finalUnitPrice,
                      lineTotal: item.lineTotal,
                      acceptedOffer: item.acceptedOffer,
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="section-card nested-card">
              <h3>Historial</h3>
              <div className="history-list">
                {(order.history || []).map((entry) => {
                  if (isTrackingHistoryEntry(entry)) {
                    const tracking = getTrackingHistoryDetails(entry, order);
                    return (
                      <div key={entry.id} className="history-row">
                        <strong>{entry.reason || 'Seguimiento actualizado'}</strong>
                        <span>
                          Método de envío: {tracking.shippingMethod}
                          <br />
                          {tracking.isCleared
                            ? 'Código de seguimiento limpiado'
                            : `Código de seguimiento: ${tracking.trackingCode}`}
                          {entry.changedByName ? (
                            <>
                              <br />
                              Admin: {entry.changedByName}
                            </>
                          ) : null}
                        </span>
                        <span>{formatDate(entry.changedAt)}</span>
                      </div>
                    );
                  }

                  return (
                    <div key={entry.id} className="history-row">
                      <strong><StatusBadge status={entry.toStatus} labels={HISTORY_STATUS_LABELS} /></strong>
                      <span>{entry.reason}</span>
                      <span>{formatDate(entry.changedAt)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <aside className="page-stack admin-order-detail-sidebar" aria-label="Cliente, resumen y acciones de la orden">
            <div className="section-card nested-card admin-order-side-card admin-order-client-card">
              <h3>Cliente</h3>
              <p>{order.customer.firstName} {order.customer.lastName}</p>
              <p className="muted-copy">{order.customer.email || 'Sin email'} - {order.customer.phone || 'Sin teléfono'}</p>
              <p className="muted-copy">{order.customer.address || 'Sin dirección'}</p>
            </div>

            <div className="section-card nested-card admin-order-side-card admin-order-summary-card">
              <h3>Resumen</h3>
              <p className="summary-line"><span>Subtotal</span><strong>{formatCurrency(order.subtotal)}</strong></p>
              <p className="summary-line"><span>Descuento</span><strong>{formatCurrency(order.discountTotal)}</strong></p>
              {order.hasOffers ? <p className="summary-line"><span>Ofertas</span><strong>{order.offerCount || 1}</strong></p> : null}
              <p className="summary-line"><span>Peso aprox.</span><strong>{formatWeightKg(order.packageWeightKg)}</strong></p>
              <p className="summary-line"><span>Envio</span><strong>{formatCurrency(order.shippingCost)}</strong></p>
              <p className="summary-line total"><span>Total</span><strong>{formatCurrency(order.total)}</strong></p>
              <p className="muted-copy">Creada: {formatDate(order.createdAt)}</p>
              <p className="muted-copy">Aprobada: {formatDate(order.approvedAt)}</p>
              <p className="muted-copy">Enviada: {formatDate(order.shippedAt)}</p>
              <p className="muted-copy">Cancelada: {formatDate(order.cancelledAt)}</p>
              <p className="muted-copy">Estado de pago: <strong><StatusBadge status={order.paymentStatus} labels={PAYMENT_STATUS_LABELS} /></strong></p>
            </div>

            <form className="section-card nested-card stack-gap-sm admin-order-side-card" onSubmit={handleSaveTracking}>
              <h3>Seguimiento</h3>
              <label className="field-group">
                <span>Codigo de seguimiento</span>
                <input
                  className="input"
                  value={trackingCode}
                  onChange={(event) => setTrackingCode(event.target.value)}
                  maxLength={120}
                  placeholder="Ej: UY123456789"
                />
                <span className="field-helper">
                  Se informa al cliente en el mail de orden enviada.
                </span>
              </label>
              <button type="submit" className="button button-secondary" disabled={trackingSubmitting}>
                {trackingSubmitting ? 'Guardando...' : 'Guardar seguimiento'}
              </button>
            </form>

            <div className="section-card nested-card stack-gap-sm admin-order-side-card">
              <h3>Pagos</h3>
              {order.payments.length ? (
                <div className="history-list">
                  {order.payments.map((payment) => (
                    <div key={payment.id} className="history-row">
                      <strong>{payment.providerName || formatPaymentMethod(payment.paymentMethod)}</strong>
                      <span>{formatCurrency(payment.amount)} - {payment.providerReference || 'Sin referencia'}</span>
                      <span><StatusBadge status={payment.status} labels={PAYMENT_STATUS_LABELS} /></span>
                      <span>{formatDate(payment.paidAt || payment.createdAt)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted-copy">Todavía no hay pagos registrados para esta orden.</p>
              )}

              {!order.payments.length && order.orderStatus === 'APPROVED' ? (
                <button type="button" className="button button-secondary" onClick={handleRegisterPayment} disabled={paymentSubmitting}>
                  {paymentSubmitting ? 'Registrando pago...' : 'Registrar pago interno'}
                </button>
              ) : null}
            </div>

            <div className="section-card nested-card stack-gap-sm admin-order-side-card admin-order-actions-card">
              <h3>Acciones</h3>
              {['RESERVED', 'PENDING'].includes(order.orderStatus) ? (
                <>
                  <button type="button" className="button button-primary" onClick={() => runAction('approve')}>Aprobar</button>
                  <label className="field-group">
                    <span>Motivo de cancelacion</span>
                    <textarea className="input textarea" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
                  </label>
                  <button type="button" className="button button-secondary" onClick={() => runAction('cancel')}>Cancelar</button>
                </>
              ) : null}

              {order.orderStatus === 'APPROVED' ? (
                <button type="button" className="button button-primary" onClick={() => runAction('ship')}>Marcar como enviada</button>
              ) : null}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
