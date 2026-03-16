import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminToolbar from '../../components/admin/AdminToolbar.jsx';
import OrderStatusBadge from '../../components/OrderStatusBadge.jsx';
import { apiFetch, resolveAssetUrl } from '../../lib/api.js';
import { formatCurrency, formatDate } from '../../lib/format.js';

export default function AdminOrdersPage() {
  const [status, setStatus] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    async function loadOrders() {
      try {
        setLoading(true);
        const response = await apiFetch(`/api/admin/orders${status ? `?status=${status}` : ''}`);
        if (!ignore) setOrders(response.items || []);
      } catch (err) {
        if (!ignore) setError(err.message || 'No se pudo cargar órdenes');
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadOrders();
    return () => {
      ignore = true;
    };
  }, [status]);

  return (
    <div className="container page-stack admin-page-shell">
      <AdminToolbar />
      <section className="section-card page-stack">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Administración</p>
            <h1>Órdenes</h1>
          </div>
          <select className="input input-inline" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todos los estados</option>
            <option value="RESERVED">Reservadas</option>
            <option value="APPROVED">Aprobadas</option>
            <option value="SHIPPED">Enviadas</option>
            <option value="CANCELLED">Canceladas</option>
            <option value="EXPIRED">Vencidas</option>
          </select>
        </div>

        {error ? <p className="error-copy">{error}</p> : null}
        {loading ? <div className="centered-card">Cargando…</div> : null}

        <div className="admin-list">
          {orders.map((order) => (
            <article key={order.id} className="admin-row-card">
              <img src={resolveAssetUrl(order.previewImage)} alt={order.previewTitle} />
              <div>
                <p className="eyebrow">{order.orderNumber}</p>
                <h3>{order.previewTitle}</h3>
                <p className="muted-copy">{order.customer.firstName} {order.customer.lastName} · {order.customer.email || 'Sin email'}</p>
                <p className="muted-copy">Ingreso: {formatDate(order.createdAt)}</p>
              </div>
              <div className="admin-row-actions">
                <OrderStatusBadge status={order.orderStatus} />
                <strong>{formatCurrency(order.total)}</strong>
                <Link to={`/admin/orders/${order.id}`} className="button button-secondary">Ver orden</Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
