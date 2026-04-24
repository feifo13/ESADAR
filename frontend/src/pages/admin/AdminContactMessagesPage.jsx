import { useEffect, useState } from 'react';
import AdminToolbar from '../../components/admin/AdminToolbar.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { apiFetch } from '../../lib/api.js';
import { formatDate } from '../../lib/format.js';

const CONTACT_STATUS_LABELS = {
  NEW: 'Nuevo',
  READ: 'Leído',
  REPLIED: 'Respondido',
  ARCHIVED: 'Archivado',
};

export default function AdminContactMessagesPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let ignore = false;

    async function loadMessages() {
      try {
        setLoading(true);
        setError('');
        const params = new URLSearchParams({ page: String(page) });
        if (status) params.set('status', status);
        const response = await apiFetch(`/api/admin/contact-messages?${params.toString()}`);
        if (ignore) return;
        setItems(response.items || []);
        setPagination(response.pagination || { page: 1, pageSize: 25, total: 0 });
      } catch (err) {
        if (!ignore) setError(err.message || 'No se pudieron cargar los contactos');
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadMessages();
    return () => {
      ignore = true;
    };
  }, [page, status]);

  async function updateStatus(messageId, nextStatus) {
    try {
      setError('');
      setMessage('');
      await apiFetch(`/api/admin/contact-messages/${messageId}/status`, {
        method: 'PATCH',
        body: { status: nextStatus },
      });
      setMessage('El estado del mensaje fue actualizado.');
      const params = new URLSearchParams({ page: String(page) });
      if (status) params.set('status', status);
      const response = await apiFetch(`/api/admin/contact-messages?${params.toString()}`);
      setItems(response.items || []);
      setPagination(response.pagination || { page: 1, pageSize: 25, total: 0 });
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el mensaje');
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
            <h1>Contactos</h1>
          </div>
          <select className="input input-inline" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            <option value="">Todos los estados</option>
            <option value="NEW">Nuevos</option>
            <option value="READ">Leídos</option>
            <option value="REPLIED">Respondidos</option>
            <option value="ARCHIVED">Archivados</option>
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
                  <th>Nombre</th>
                  <th>Contacto</th>
                  <th>Mensaje</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>
                      <div className="cell-stack">
                        <strong>{item.firstName} {item.lastName}</strong>
                        <span className="muted-copy">{item.birthDate ? String(item.birthDate).slice(0, 10) : 'Sin fecha de nacimiento'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="cell-stack">
                        <span>{item.email || 'Sin email'}</span>
                        <span className="muted-copy">{item.phone || 'Sin teléfono'}</span>
                        <span className="muted-copy">{item.instagram || 'Sin Instagram'}</span>
                      </div>
                    </td>
                    <td className="cell-copy">{item.message}</td>
                    <td><StatusBadge status={item.status} labels={CONTACT_STATUS_LABELS} /></td>
                    <td>
                      <div className="table-actions">
                        {item.status !== 'READ' ? <button type="button" className="ghost-button" onClick={() => updateStatus(item.id, 'READ')}>Leer</button> : null}
                        {item.status !== 'REPLIED' ? <button type="button" className="ghost-button" onClick={() => updateStatus(item.id, 'REPLIED')}>Responder</button> : null}
                        {item.status !== 'ARCHIVED' ? <button type="button" className="ghost-button" onClick={() => updateStatus(item.id, 'ARCHIVED')}>Archivar</button> : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {!items.length ? (
                  <tr>
                    <td colSpan="6"><p className="muted-copy">No hay mensajes para mostrar.</p></td>
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
