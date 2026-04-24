import { useEffect, useState } from 'react';
import AdminToolbar from '../../components/admin/AdminToolbar.jsx';
import { apiFetch } from '../../lib/api.js';
import { formatDate } from '../../lib/format.js';

function formatActor(entry) {
  if (entry.actorLabel) return entry.actorLabel;
  if (entry.actorUserId) return `Usuario #${entry.actorUserId}`;
  return 'Sistema';
}

export default function AdminAuditPage() {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    async function loadAudit() {
      try {
        setLoading(true);
        setError('');
        const response = await apiFetch(`/api/admin/audit?page=${page}`);
        if (ignore) return;
        setItems(response.items || []);
        setPagination(response.pagination || { page: 1, pageSize: 25, total: 0 });
      } catch (err) {
        if (!ignore) setError(err.message || 'No se pudo cargar la auditoría');
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadAudit();
    return () => {
      ignore = true;
    };
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(Number(pagination.total || 0) / Number(pagination.pageSize || 25)));

  return (
    <div className="container page-stack admin-page-shell">
      <AdminToolbar />
      <section className="section-card page-stack">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Administración</p>
            <h1>Auditoría</h1>
          </div>
          <p className="muted-copy">{pagination.total || 0} eventos</p>
        </div>

        {error ? <p className="error-copy">{error}</p> : null}
        {loading ? <div className="centered-card">Cargando…</div> : null}

        {!loading ? (
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario / actor</th>
                  <th>Acción</th>
                  <th>Entidad</th>
                  <th>Entity ID</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {items.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDate(entry.createdAt)}</td>
                    <td>{formatActor(entry)}</td>
                    <td>{entry.actionCode}</td>
                    <td>{entry.entityType}</td>
                    <td>{entry.entityId || '—'}</td>
                    <td>{entry.source}</td>
                  </tr>
                ))}
                {!items.length ? (
                  <tr>
                    <td colSpan="6"><p className="muted-copy">No hay eventos de auditoría para mostrar.</p></td>
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
