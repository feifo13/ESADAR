import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import SeoHead from '../components/SeoHead.jsx';
import OrderStatusBadge from '../components/OrderStatusBadge.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import SummaryItemCard from '../components/SummaryItemCard.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useNotification } from '../contexts/NotificationContext.jsx';
import { apiDownload, apiFetch } from '../lib/api.js';
import { formatCurrency, formatDate } from '../lib/format.js';

const PAYMENT_STATUS_LABELS = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  FAILED: 'Fallido',
  REFUNDED: 'Reintegrado',
  PAID: 'Pagado',
};

const PAYMENT_METHOD_LABELS = {
  BANK_TRANSFER: 'Transferencia',
  MERCADO_PAGO: 'Mercado Pago',
};

export default function AccountOrderDetailPage() {
  const { id } = useParams();
  const { isAuthenticated } = useAuth();
  const { notifyError } = useNotification();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptError, setReceiptError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let ignore = false;

    async function loadOrder() {
      try {
        setLoading(true);
        setError('');
        const response = await apiFetch(`/api/public/account/orders/${id}`);
        if (!ignore) setOrder(response.order || null);
      } catch (err) {
        if (!ignore) setError(err.message || 'No pudimos cargar la orden.');
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadOrder();
    return () => {
      ignore = true;
    };
  }, [id, isAuthenticated]);


  async function downloadReceipt() {
    if (!order?.id) return;

    try {
      setReceiptLoading(true);
      setReceiptError('');
      await apiDownload(`/api/public/account/orders/${order.id}/receipt.pdf`, {
        extension: 'pdf',
        fileName: `boleta-${order.orderNumber || order.id}.pdf`,
      });
    } catch (err) {
      const errorMessage = err.message || 'No pudimos generar la boleta de la orden.';
      setReceiptError(errorMessage);
      notifyError(errorMessage);
    } finally {
      setReceiptLoading(false);
    }
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="container page-stack account-page-shell account-order-detail-page">
      <SeoHead title="Detalle de orden | ESADAR" noindex />

      <Link to="/cuenta/ordenes" className="ghost-button linklike account-order-detail-back">
        Volver a mis ordenes
      </Link>

      {loading ? (
        <section className="section-card">
          <p className="muted-copy">Cargando orden...</p>
        </section>
      ) : null}

      {error ? (
        <section className="section-card">
          <p className="error-copy">{error}</p>
        </section>
      ) : null}

      {order ? (
        <>
          <section className="section-card page-stack account-order-detail-hero">
            <div className="section-heading section-heading-wrap">
              <div>
                <p className="section-kicker">Orden</p>
                <h1>{order.orderNumber}</h1>
              </div>
              <div className="inline-action-group">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => void downloadReceipt()}
                  disabled={receiptLoading}
                >
                  {receiptLoading ? 'Generando...' : 'Descargar boleta PDF'}
                </button>
                <OrderStatusBadge status={order.orderStatus} />
              </div>
            </div>
            <div className="admin-detail-meta account-order-detail-meta">
              <p className="summary-line"><span>Creada</span><strong>{formatDate(order.createdAt)}</strong></p>
              <p className="summary-line"><span>Pago</span><strong><StatusBadge status={order.paymentStatus} labels={PAYMENT_STATUS_LABELS} /></strong></p>
              <p className="summary-line"><span>Método</span><strong>{PAYMENT_METHOD_LABELS[order.paymentMethod] || order.paymentMethod}</strong></p>
              <p className="summary-line"><span>Envío</span><strong>{order.shippingMethodName || order.shippingMethodDescription || 'Sin datos'}</strong></p>
              <p className="summary-line total"><span>Total</span><strong>{formatCurrency(order.total)}</strong></p>
            </div>
          </section>

          <section className="section-card page-stack">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Prendas</p>
                <h2>Resumen de la orden</h2>
              </div>
            </div>
            <div className="summary-item-card-list account-order-items-card-list">
              {(order.items || []).map((item) => (
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
                    salePrice: item.finalUnitPrice,
                    discountedPrice: item.finalUnitPrice,
                  }}
                />
              ))}
            </div>
          </section>

          <section className="section-card page-stack account-order-history">
            <div>
              <p className="section-kicker">Historial</p>
              <h2>Seguimiento</h2>
            </div>
            <div className="history-list">
              {(order.history || []).length ? (
                order.history.map((entry) => (
                  <article key={entry.id} className="history-row">
                    <div>
                      <StatusBadge status={entry.toStatus} />
                      <p className="muted-copy">{entry.reason || 'Sin comentario adicional'}</p>
                    </div>
                    <span>{formatDate(entry.changedAt)}</span>
                  </article>
                ))
              ) : (
                <p className="muted-copy">Todavía no hay cambios registrados.</p>
              )}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
