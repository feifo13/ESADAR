import { useEffect, useState } from 'react';
import AdminToolbar from '../../components/admin/AdminToolbar.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { apiFetch } from '../../lib/api.js';
import { formatCurrency, formatDate } from '../../lib/format.js';

const OFFER_STATUS_LABELS = {
  PENDING: 'Pendiente',
  ACCEPTED: 'Aceptada',
  REJECTED: 'Rechazada',
  CANCELLED: 'Cancelada',
  EXPIRED: 'Vencida',
};

export default function AdminOffersPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [offers, setOffers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let ignore = false;

    async function loadOffers() {
      try {
        setLoading(true);
        setError('');
        const params = new URLSearchParams({ page: String(page) });
        if (status) params.set('status', status);
        const response = await apiFetch(`/api/admin/offers?${params.toString()}`);
        if (ignore) return;
        setOffers(response.items || []);
        setPagination(response.pagination || { page: 1, pageSize: 25, total: 0 });
      } catch (err) {
        if (!ignore) setError(err.message || 'No se pudieron cargar las ofertas');
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadOffers();
    return () => {
      ignore = true;
    };
  }, [page, status]);

  async function handleStatusChange(offerId, nextStatus) {
    try {
      setError('');
      setMessage('');
      await apiFetch(`/api/admin/offers/${offerId}/status`, {
        method: 'PATCH',
        body: { status: nextStatus },
      });
      setMessage('La oferta fue actualizada correctamente.');
      const params = new URLSearchParams({ page: String(page) });
      if (status) params.set('status', status);
      const response = await apiFetch(`/api/admin/offers?${params.toString()}`);
      setOffers(response.items || []);
      setPagination(response.pagination || { page: 1, pageSize: 25, total: 0 });
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la oferta');
    }
  }

  const totalPages = Math.max(1, Math.ceil(Number(pagination.total || 0) / Number(pagination.pageSize || 25)));

  return (
    <div className="container page-stack admin-page-shell">
      <AdminToolbar />
      <section className="section-card page-stack">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Administración</p>
            <h1>Ofertas</h1>
          </div>
          <select className="input input-inline" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            <option value="">Todos los estados</option>
            <option value="PENDING">Pendientes</option>
            <option value="ACCEPTED">Aceptadas</option>
            <option value="REJECTED">Rechazadas</option>
            <option value="CANCELLED">Canceladas</option>
            <option value="EXPIRED">Vencidas</option>
          </select>
        </div>

        {message ? <p className="success-copy">{message}</p> : null}
        {error ? <p className="error-copy">{error}</p> : null}
        {loading ? <div className="centered-card">Cargando…</div> : null}

        {!loading ? (
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Artículo</th>
                  <th>Contacto</th>
                  <th>Monto</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((offer) => (
                  <tr key={offer.id}>
                    <td>{formatDate(offer.createdAt)}</td>
                    <td>
                      <div className="cell-stack">
                        <strong>{offer.article.title}</strong>
                        <span className="muted-copy">#{offer.article.id}</span>
                      </div>
                    </td>
                    <td>
                      <div className="cell-stack">
                        <strong>{offer.contact.firstName} {offer.contact.lastName}</strong>
                        <span className="muted-copy">{offer.contact.email || 'Sin email'}</span>
                        <span className="muted-copy">{offer.contact.phone || 'Sin teléfono'}</span>
                      </div>
                    </td>
                    <td>{formatCurrency(offer.offeredAmount)}</td>
                    <td><StatusBadge status={offer.status} labels={OFFER_STATUS_LABELS} /></td>
                    <td>
                      {offer.status === 'PENDING' ? (
                        <div className="table-actions">
                          <button type="button" className="ghost-button" onClick={() => handleStatusChange(offer.id, 'ACCEPTED')}>Aceptar</button>
                          <button type="button" className="ghost-button" onClick={() => handleStatusChange(offer.id, 'REJECTED')}>Rechazar</button>
                          <button type="button" className="ghost-button" onClick={() => handleStatusChange(offer.id, 'CANCELLED')}>Cancelar</button>
                        </div>
                      ) : (
                        <span className="muted-copy">Sin acciones</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!offers.length ? (
                  <tr>
                    <td colSpan="6"><p className="muted-copy">No hay ofertas para mostrar.</p></td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="pagination-row">
          <span className="muted-copy">Página {page} de {totalPages}</span>
          <div className="table-actions">
            <button type="button" className="button button-secondary" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1 || loading}>Anterior</button>
            <button type="button" className="button button-secondary" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages || loading}>Siguiente</button>
          </div>
        </div>
      </section>
    </div>
  );
}
